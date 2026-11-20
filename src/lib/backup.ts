import { db, RECORD_TABLES, SCHEMA_VERSION, type RecordTable } from './db';
import type { BaseRecord, StoredFile } from './types';
import { downloadText } from './utils';
import { format } from 'date-fns';

export const BACKUP_APP_ID = 'work-os';

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  exportedAt: string;
  tables: Partial<Record<RecordTable, unknown[]>>;
  settings?: unknown;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  // FileReader is unavailable in some test environments; fall back to arrayBuffer.
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(bin)}`;
}

function dataUrlToBlob(url: string): Blob {
  const [head, b64] = url.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'application/octet-stream';
  const bin = atob(b64 ?? '');
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/** Builds a full backup object. Files are embedded as base64 unless excluded. */
export async function buildBackup(opts: { includeFiles?: boolean } = {}): Promise<BackupFile> {
  const includeFiles = opts.includeFiles ?? true;
  const tables: BackupFile['tables'] = {};
  for (const t of RECORD_TABLES) {
    const rows = (await db.table(t).toArray()) as Record<string, unknown>[];
    if (t === 'files') {
      if (!includeFiles) {
        tables[t] = rows.map(({ blob: _b, ...rest }) => ({ ...rest, blob: null }));
      } else {
        tables[t] = await Promise.all(
          rows.map(async (r) => ({ ...r, blob: r.blob instanceof Blob ? await blobToDataUrl(r.blob) : null })),
        );
      }
    } else {
      tables[t] = rows;
    }
  }
  const settings = (await db.kv.get('settings'))?.value;
  return {
    app: BACKUP_APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
    settings: redactSettings(settings),
  };
}

/** API keys are never written to export files. */
function redactSettings(s: unknown) {
  if (!s || typeof s !== 'object') return s;
  const copy = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
  const ai = copy.ai as Record<string, unknown> | undefined;
  if (ai) ai.apiKey = '';
  return copy;
}

export async function exportJSON() {
  const data = await buildBackup();
  downloadText(JSON.stringify(data, null, 1), `work-os-backup-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`, 'application/json');
  const { saveSettings } = await import('./settings');
  await saveSettings({ lastExportAt: Date.now() });
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  counts: Partial<Record<RecordTable, number>>;
  data?: BackupFile;
}

/** Validates the structure of a backup before anything is written. */
export function validateBackup(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const counts: ValidationResult['counts'] = {};
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['File is not a JSON object.'], counts };
  const b = raw as Partial<BackupFile>;
  if (b.app !== BACKUP_APP_ID) errors.push('This file was not exported from Work OS.');
  if (typeof b.schemaVersion !== 'number') errors.push('Missing schema version.');
  else if (b.schemaVersion > SCHEMA_VERSION)
    errors.push(`Backup is from a newer version of Work OS (schema ${b.schemaVersion}). Update the app first.`);
  if (!b.tables || typeof b.tables !== 'object') errors.push('Missing data tables.');
  else {
    for (const [name, rows] of Object.entries(b.tables)) {
      if (!(RECORD_TABLES as readonly string[]).includes(name)) continue; // ignore unknown tables
      if (!Array.isArray(rows)) {
        errors.push(`Table "${name}" is not a list.`);
        continue;
      }
      const bad = rows.filter((r) => !r || typeof r !== 'object' || typeof (r as BaseRecord).id !== 'string');
      if (bad.length) errors.push(`Table "${name}" has ${bad.length} record(s) without a valid id.`);
      counts[name as RecordTable] = rows.length;
    }
  }
  return { ok: errors.length === 0, errors, counts, data: errors.length ? undefined : (b as BackupFile) };
}

/** Upgrades older backups to the current schema. Add steps here when SCHEMA_VERSION increases. */
export function migrateBackup(b: BackupFile): BackupFile {
  const out = b;
  // if (out.schemaVersion < 2) { ...transform...; out.schemaVersion = 2; }
  return out;
}

export interface ImportSummary {
  added: number;
  updated: number;
  skipped: number;
}

/**
 * mode "merge": adds new records; replaces an existing record only if the
 *   imported copy is newer (updatedAt). Nothing is deleted.
 * mode "replace": wipes all records and loads the backup. A restore point is
 *   taken first so this can be undone.
 */
export async function importBackup(b: BackupFile, mode: 'merge' | 'replace'): Promise<ImportSummary> {
  const data = migrateBackup(b);
  await createSnapshot('before-import');
  const summary: ImportSummary = { added: 0, updated: 0, skipped: 0 };
  const tables = RECORD_TABLES.map((t) => db.table(t));
  await db.transaction('rw', [...tables, db.kv], async () => {
    if (mode === 'replace') {
      for (const t of tables) await t.clear();
    }
    for (const name of RECORD_TABLES) {
      const rows = (data.tables[name] ?? []) as Record<string, unknown>[];
      const t = db.table(name);
      for (const raw of rows) {
        const row = { ...raw } as Record<string, unknown> & BaseRecord;
        if (name === 'files') {
          if (typeof row.blob === 'string') row.blob = dataUrlToBlob(row.blob);
          else if (!(row.blob instanceof Blob)) row.blob = new Blob([]);
        }
        const existing = mode === 'merge' ? ((await t.get(row.id)) as BaseRecord | undefined) : undefined;
        if (!existing) {
          await t.put(row);
          summary.added++;
        } else if ((row.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
          await t.put(row);
          summary.updated++;
        } else summary.skipped++;
      }
    }
    if (data.settings && typeof data.settings === 'object') {
      const cur = ((await db.kv.get('settings'))?.value ?? {}) as Record<string, unknown>;
      const incoming = data.settings as Record<string, unknown>;
      const keepKey = ((cur.ai as Record<string, unknown> | undefined)?.apiKey as string) ?? '';
      const merged: Record<string, unknown> = mode === 'replace' ? { ...incoming } : { ...incoming, ...cur };
      merged.ai = { ...((merged.ai as object) ?? {}), apiKey: keepKey };
      merged.onboarded = true;
      await db.kv.put({ key: 'settings', value: merged });
    }
  });
  return summary;
}

export async function readBackupFile(file: File): Promise<ValidationResult> {
  try {
    const text = await file.text();
    return validateBackup(JSON.parse(text));
  } catch {
    return { ok: false, errors: ['Could not read the file as JSON.'], counts: {} };
  }
}

// ---------- Restore points (local snapshots) ----------

const MAX_SNAPSHOTS = 10;

export async function createSnapshot(reason: 'auto' | 'manual' | 'before-import' | 'before-clear') {
  const data = JSON.stringify(await buildBackup({ includeFiles: false }));
  await db.snapshots.add({ at: Date.now(), reason, data, size: data.length });
  const all = await db.snapshots.orderBy('at').primaryKeys();
  if (all.length > MAX_SNAPSHOTS) await db.snapshots.bulkDelete(all.slice(0, all.length - MAX_SNAPSHOTS));
}

/** Takes at most one automatic snapshot per day. */
export async function maybeAutoSnapshot() {
  const last = await db.snapshots.orderBy('at').last();
  if (last && Date.now() - last.at < 20 * 60 * 60 * 1000) return;
  const anyData = await db.tasks.count() + (await db.notes.count()) + (await db.projects.count());
  if (!anyData) return;
  await createSnapshot('auto');
}

export async function restoreSnapshot(id: number) {
  const snap = await db.snapshots.get(id);
  if (!snap) throw new Error('Restore point not found');
  const parsed = validateBackup(JSON.parse(snap.data));
  if (!parsed.data) throw new Error(parsed.errors.join(' '));
  // Snapshots exclude file contents, so keep existing files untouched.
  const files = await db.files.toArray();
  parsed.data.tables.files = [];
  await importBackup(parsed.data, 'replace');
  await db.files.bulkPut(files);
}

// ---------- CSV ----------

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = Array.isArray(v) ? v.join('; ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCSV(rows: Record<string, unknown>[], columns: { key: string; label: string; get?: (r: Record<string, unknown>) => unknown }[]) {
  const head = columns.map((c) => csvCell(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => csvCell(c.get ? c.get(r) : r[c.key])).join(','));
  return '﻿' + [head, ...body].join('\r\n');
}

const ts = (v: unknown) => (typeof v === 'number' ? new Date(v).toISOString() : '');

export const CSV_EXPORTS: Record<string, { table: RecordTable; columns: { key: string; label: string; get?: (r: Record<string, unknown>) => unknown }[] }> = {
  Tasks: {
    table: 'tasks',
    columns: [
      { key: 'title', label: 'Title' },
      { key: 'status', label: 'Status' },
      { key: 'priority', label: 'Priority' },
      { key: 'startDate', label: 'Start date' },
      { key: 'dueDate', label: 'Due date' },
      { key: 'completedAt', label: 'Completed', get: (r) => ts(r.completedAt) },
      { key: 'tags', label: 'Tags' },
      { key: 'projectId', label: 'Project ID' },
      { key: 'description', label: 'Description' },
    ],
  },
  Projects: {
    table: 'projects',
    columns: [
      { key: 'title', label: 'Title' },
      { key: 'status', label: 'Status' },
      { key: 'startDate', label: 'Start date' },
      { key: 'deadline', label: 'Deadline' },
      { key: 'description', label: 'Description' },
      { key: 'objectives', label: 'Objectives' },
      { key: 'tags', label: 'Tags' },
    ],
  },
  Campaigns: {
    table: 'campaigns',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'status', label: 'Status' },
      { key: 'startDate', label: 'Start' },
      { key: 'endDate', label: 'End' },
      { key: 'budget', label: 'Budget' },
      { key: 'spent', label: 'Spent' },
      { key: 'audience', label: 'Audience' },
      { key: 'objectives', label: 'Objectives' },
    ],
  },
  'Press releases': {
    table: 'pressReleases',
    columns: [
      { key: 'title', label: 'Title' },
      { key: 'status', label: 'Status' },
      { key: 'distributionDate', label: 'Distribution date' },
      { key: 'publicationDate', label: 'Publication date' },
      { key: 'platform', label: 'Platform' },
      { key: 'campaignId', label: 'Campaign ID' },
    ],
  },
  Coverage: {
    table: 'coverage',
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'outlet', label: 'Outlet' },
      { key: 'headline', label: 'Headline' },
      { key: 'url', label: 'URL' },
      { key: 'reach', label: 'Reach' },
      { key: 'sentiment', label: 'Sentiment' },
      { key: 'campaignId', label: 'Campaign ID' },
    ],
  },
  Content: {
    table: 'content',
    columns: [
      { key: 'title', label: 'Title' },
      { key: 'platform', label: 'Platform' },
      { key: 'contentType', label: 'Type' },
      { key: 'status', label: 'Status' },
      { key: 'publishDate', label: 'Publish date' },
      { key: 'reach', label: 'Reach', get: (r) => (r.metrics as Record<string, unknown>)?.reach },
      { key: 'impressions', label: 'Impressions', get: (r) => (r.metrics as Record<string, unknown>)?.impressions },
      { key: 'views', label: 'Views', get: (r) => (r.metrics as Record<string, unknown>)?.views },
      { key: 'likes', label: 'Likes', get: (r) => (r.metrics as Record<string, unknown>)?.likes },
      { key: 'comments', label: 'Comments', get: (r) => (r.metrics as Record<string, unknown>)?.comments },
      { key: 'shares', label: 'Shares', get: (r) => (r.metrics as Record<string, unknown>)?.shares },
      { key: 'caption', label: 'Caption' },
    ],
  },
  'Social metrics': {
    table: 'social',
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'platform', label: 'Platform' },
      { key: 'followers', label: 'Followers' },
      { key: 'reach', label: 'Reach' },
      { key: 'impressions', label: 'Impressions' },
      { key: 'engagement', label: 'Engagement' },
      { key: 'views', label: 'Views' },
    ],
  },
  'KPI values': {
    table: 'kpiEntries',
    columns: [
      { key: 'kpiId', label: 'KPI ID' },
      { key: 'date', label: 'Date' },
      { key: 'value', label: 'Value' },
      { key: 'note', label: 'Note' },
    ],
  },
  Ideas: {
    table: 'ideas',
    columns: [
      { key: 'text', label: 'Idea' },
      { key: 'details', label: 'Details' },
      { key: 'category', label: 'Category' },
      { key: 'status', label: 'Status' },
      { key: 'createdAt', label: 'Captured', get: (r) => ts(r.createdAt) },
    ],
  },
};

export async function exportCSV(name: keyof typeof CSV_EXPORTS) {
  const spec = CSV_EXPORTS[name];
  let rows = ((await db.table(spec.table).toArray()) as Record<string, unknown>[]).filter((r) => !r.deletedAt);
  if (spec.table === 'kpiEntries') {
    const kpis = new Map((await db.kpis.toArray()).map((k) => [k.id, k.name]));
    rows = rows.map((r) => ({ ...r, kpiId: kpis.get(r.kpiId as string) ?? r.kpiId }));
  }
  downloadText(toCSV(rows, spec.columns), `work-os-${name.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.csv`, 'text/csv');
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    if (e) return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
  } catch {
    /* ignore */
  }
  return null;
}

export type { StoredFile };
