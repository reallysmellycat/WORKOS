import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Bell,
  Bot,
  CalendarDays,
  Database,
  Download,
  FlaskConical,
  HardDrive,
  LayoutTemplate,
  Palette,
  Plug,
  Plus,
  RotateCcw,
  Shield,
  SlidersHorizontal,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';
import { db, RECORD_TABLES, SCHEMA_VERSION, type RecordTable } from '@/lib/db';
import { saveSettings, type CustomFieldDef, type Settings } from '@/lib/settings';
import { createSnapshot, CSV_EXPORTS, exportCSV, exportJSON, importBackup, readBackupFile, restoreSnapshot, storageEstimate, type ValidationResult } from '@/lib/backup';
import { hasDemo, removeDemo, seedDemo } from '@/lib/demo';
import { ENTITY, TABLE_TO_ENTITY, entityTitle } from '@/lib/entities';
import { purge, restore, create, update, softDelete } from '@/lib/repo';
import { createProvider, PROVIDER_PRESETS } from '@/lib/ai';
import { exportICS } from '@/lib/ics';
import { useTemplates } from '@/lib/hooks';
import { PRIORITIES } from '@/lib/domain';
import type { Priority, ProjectTemplate } from '@/lib/types';
import { cn, fmtBytes, fmtTs, timeAgo, uid } from '@/lib/utils';
import { Badge, Button, Card, Field, IconButton, Input, Modal, Page, PageHeader, Select, Spinner, Textarea, Toggle } from '@/components/ui';
import { useFeedback } from '@/components/feedback';
import { useApp } from '@/app/context';
import { ensureBuiltInTemplates } from '@/lib/templates';

type Tab = 'general' | 'appearance' | 'notifications' | 'data' | 'trash' | 'customise' | 'templates' | 'ai' | 'integrations' | 'privacy';

const TABS: { value: Tab; label: string; icon: typeof User }[] = [
  { value: 'general', label: 'General', icon: User },
  { value: 'appearance', label: 'Appearance', icon: Palette },
  { value: 'notifications', label: 'Notifications', icon: Bell },
  { value: 'data', label: 'Data & backup', icon: Database },
  { value: 'trash', label: 'Trash', icon: Trash2 },
  { value: 'customise', label: 'Customise', icon: SlidersHorizontal },
  { value: 'templates', label: 'Project templates', icon: LayoutTemplate },
  { value: 'ai', label: 'AI', icon: Bot },
  { value: 'integrations', label: 'Integrations', icon: Plug },
  { value: 'privacy', label: 'Privacy & storage', icon: Shield },
];

export default function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'general';
  const { settings } = useApp();
  return (
    <Page>
      <PageHeader title="Settings" />
      <div className="flex flex-col gap-6 md:flex-row">
        <nav className="flex shrink-0 gap-1 overflow-x-auto md:w-52 md:flex-col" aria-label="Settings sections">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setParams({ tab: t.value })}
              className={cn('flex shrink-0 items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-body-s', tab === t.value ? 'bg-sunken font-medium text-fg' : 'text-muted hover:bg-sunken/60')}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1 space-y-5">
          {tab === 'general' && <General s={settings} />}
          {tab === 'appearance' && <Appearance s={settings} />}
          {tab === 'notifications' && <Notifications s={settings} />}
          {tab === 'data' && <DataBackup s={settings} />}
          {tab === 'trash' && <TrashPanel />}
          {tab === 'customise' && <Customise s={settings} />}
          {tab === 'templates' && <Templates />}
          {tab === 'ai' && <AISettingsPanel s={settings} />}
          {tab === 'integrations' && <Integrations />}
          {tab === 'privacy' && <Privacy />}
        </div>
      </div>
    </Page>
  );
}

function Row({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-line py-3.5 last:border-0 sm:flex-row sm:items-center sm:gap-6">
      <div className="min-w-0 flex-1">
        <div className="text-body-m font-medium">{label}</div>
        {hint && <div className="mt-0.5 text-body-s leading-relaxed text-muted">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function General({ s }: { s: Settings }) {
  const [name, setName] = useState(s.name);
  return (
    <Card title="General">
      <Row label="Your name" hint="Used in the dashboard greeting.">
        <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => saveSettings({ name: name.trim() })} className="w-56" />
      </Row>
      <Row label="Week starts on">
        <Select value={String(s.weekStartsOn)} onChange={(e) => saveSettings({ weekStartsOn: Number(e.target.value) as 0 | 1 })} className="w-40">
          <option value="1">Monday</option>
          <option value="0">Sunday</option>
        </Select>
      </Row>
      <Row label="Default currency" hint="Used for campaign budgets.">
        <Select value={s.currency} onChange={(e) => saveSettings({ currency: e.target.value })} className="w-40">
          {['JPY', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'KRW', 'CNY'].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </Row>
      <Row label="Home layout" hint="Reorder or hide home sections with the arrange button (top right of the home page).">
        <Button size="sm" icon={RotateCcw} onClick={async () => { const { DEFAULT_HOME } = await import('@/lib/settings'); await saveSettings({ home: DEFAULT_HOME }); }}>
          Reset to default
        </Button>
      </Row>
      <Row label="Keyboard shortcuts" hint={<>⌘/Ctrl K search · N quick add · / search · G then D/M/C/T/P/I/N/A/S to jump to a page · Esc closes panels</>}>
        <span />
      </Row>
    </Card>
  );
}

const ACCENTS: { value: Settings['accent']; label: string; role: string }[] = [
  { value: 'sage', label: 'Sage', role: '--color-accent-primary' },
  { value: 'deep', label: 'Deep sage', role: '--color-accent-deep' },
  { value: 'teal', label: 'Teal', role: '--color-accent-teal' },
  { value: 'warm', label: 'Warm', role: '--color-accent-warm' },
  { value: 'violet', label: 'Violet', role: '--color-accent-violet' },
  { value: 'graphite', label: 'Graphite', role: '--color-graphite-soft' },
];

function Appearance({ s }: { s: Settings }) {
  return (
    <Card title="Appearance">
      <Row label="Theme">
        <div className="flex gap-1 rounded-full bg-sunken/45 p-1">
          {(['light', 'dark', 'system'] as const).map((t) => (
            <button key={t} onClick={() => saveSettings({ theme: t })} className={cn('h-7 rounded-full px-3.5 text-body-s font-medium capitalize transition-colors duration-fast', s.theme === t ? 'bg-raised shadow-xs' : 'text-muted hover:text-fg')}>
              {t === 'light' ? 'Daylight' : t === 'dark' ? 'Dusk' : 'System'}
            </button>
          ))}
        </div>
      </Row>
      <Row label="Accent colour">
        <div className="flex gap-2">
          {ACCENTS.map((a) => (
            <button key={a.value} onClick={() => saveSettings({ accent: a.value })} title={a.label} aria-label={a.label} className={cn('h-7 w-7 rounded-full ring-offset-2 ring-offset-surface transition', s.accent === a.value && 'ring-2 ring-fg/40')} style={{ background: `rgb(var(${a.role}))` }} />
          ))}
        </div>
      </Row>
    </Card>
  );
}

function Notifications({ s }: { s: Settings }) {
  const n = s.notifications;
  const { toast } = useFeedback();
  const set = (p: Partial<Settings['notifications']>) => saveSettings({ notifications: { ...n, ...p } });
  const perm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  return (
    <Card title="Notifications">
      <Row label="In-app notifications" hint="Shown in the bell menu. Derived from your data — nothing is sent anywhere.">
        <Toggle checked={n.enabled} onChange={(v) => set({ enabled: v })} />
      </Row>
      <Row label="Upcoming deadlines" hint="How many days ahead to notify about tasks and project deadlines.">
        <Select value={String(n.deadlineDays)} onChange={(e) => set({ deadlineDays: Number(e.target.value) })} className="w-32">
          {[0, 1, 2, 3, 5, 7].map((d) => (
            <option key={d} value={d}>
              {d === 0 ? 'Same day' : `${d} day${d > 1 ? 's' : ''}`}
            </option>
          ))}
        </Select>
      </Row>
      <Row label="Overdue tasks">
        <Toggle checked={n.overdue} onChange={(v) => set({ overdue: v })} />
      </Row>
      <Row label="Project milestones">
        <Toggle checked={n.milestones} onChange={(v) => set({ milestones: v })} />
      </Row>
      <Row label="Scheduled content" hint="Content planned for yesterday, today or tomorrow that isn't published.">
        <Toggle checked={n.content} onChange={(v) => set({ content: v })} />
      </Row>
      <Row label="Reminders" hint="Calendar events of type “Reminder”, on the day.">
        <Toggle checked={n.reminders} onChange={(v) => set({ reminders: v })} />
      </Row>
      <Row
        label="Browser notifications"
        hint={
          perm === 'unsupported'
            ? 'This browser does not support notifications.'
            : perm === 'denied'
              ? 'Blocked in your browser settings. Allow notifications for this site to enable them.'
              : 'Pops up a system notification for urgent items (overdue, due today) — at most once per item, and only while Work OS is open.'
        }
      >
        <Toggle
          checked={n.browser && perm === 'granted'}
          onChange={async (v) => {
            if (!v) return set({ browser: false });
            if (perm === 'unsupported' || perm === 'denied') return toast('Notifications are not available in this browser', { tone: 'error' });
            const r = await Notification.requestPermission();
            if (r === 'granted') set({ browser: true });
            else toast('Permission was not granted', { tone: 'error' });
          }}
        />
      </Row>
      <Row label="Dismissed notifications" hint="Bring back everything you dismissed.">
        <Button size="sm" icon={RotateCcw} onClick={async () => { await db.dismissals.clear(); toast('Dismissed notifications restored'); }}>
          Reset
        </Button>
      </Row>
    </Card>
  );
}

function DataBackup({ s }: { s: Settings }) {
  const { toast, confirm } = useFeedback();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ValidationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [est, setEst] = useState<{ usage: number; quota: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const snaps = useLiveQuery(() => db.snapshots.orderBy('at').reverse().toArray(), []);
  const demo = useLiveQuery(hasDemo, []);
  const counts = useLiveQuery(async () => {
    const out: Record<string, number> = {};
    for (const t of ['tasks', 'projects', 'campaigns', 'content', 'notes', 'documents', 'files', 'ideas', 'events'] as RecordTable[]) out[t] = (await db.table(t).toArray()).filter((r: { deletedAt?: number }) => !r.deletedAt).length;
    return out;
  }, []);

  useEffect(() => {
    storageEstimate().then(setEst);
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  const onFile = async (f: File) => {
    const v = await readBackupFile(f);
    if (!v.ok) {
      toast(v.errors.join(' '), { tone: 'error' });
      return;
    }
    setPending(v);
  };

  const doImport = async (mode: 'merge' | 'replace') => {
    if (!pending?.data) return;
    if (mode === 'replace') {
      const ok = await confirm({
        title: 'Replace all data with this backup?',
        message: 'Everything currently in Work OS will be replaced by the backup. A restore point is saved first, so you can undo this from “Restore points” below.',
        confirmLabel: 'Replace everything',
        danger: true,
        typeToConfirm: 'REPLACE',
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const r = await importBackup(pending.data, mode);
      toast(`Import complete — ${r.added} added, ${r.updated} updated, ${r.skipped} unchanged`);
      setPending(null);
    } catch (e) {
      toast(`Import failed: ${(e as Error).message}. Nothing was changed.`, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card title="Back up your data" icon={HardDrive}>
        <p className="mb-3 text-body-s leading-relaxed text-muted">
          Everything lives in this browser on this device. A backup file contains all your records and files, so you can restore them here or on another device. API keys are never included.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            icon={Download}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await exportJSON();
              setBusy(false);
              toast('Backup downloaded');
            }}
          >
            Download full backup (.json)
          </Button>
          <Button icon={Upload} onClick={() => fileRef.current?.click()}>
            Import a backup…
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { if (e.target.files?.[0]) void onFile(e.target.files[0]); e.target.value = ''; }} />
          <span className="text-body-s text-faint">{s.lastExportAt ? `Last backup ${timeAgo(s.lastExportAt)}` : 'No backup yet'}</span>
        </div>
      </Card>

      <Card title="Export spreadsheets (CSV)">
        <p className="mb-3 text-body-s text-muted">Open these in Excel, Numbers or Google Sheets. CSV exports are for reporting — use the JSON backup to restore.</p>
        <div className="flex flex-wrap gap-2">
          {Object.keys(CSV_EXPORTS).map((k) => (
            <Button key={k} size="sm" icon={Download} onClick={() => exportCSV(k as keyof typeof CSV_EXPORTS)}>
              {k}
            </Button>
          ))}
        </div>
      </Card>

      <Card
        title="Restore points"
        icon={RotateCcw}
        action={
          <Button size="xs" onClick={async () => { await createSnapshot('manual'); toast('Restore point saved'); }}>
            Save one now
          </Button>
        }
      >
        <p className="mb-3 text-body-s text-muted">
          Work OS automatically keeps a daily snapshot of your records (the last 10), plus one before every import. Snapshots don't include file contents, and they live in this browser — they're a safety net, not a replacement for backups.
        </p>
        <Row label="Automatic daily snapshot">
          <Toggle checked={s.autoSnapshot} onChange={(v) => saveSettings({ autoSnapshot: v })} />
        </Row>
        <div className="mt-2 space-y-1">
          {(snaps ?? []).map((sn) => (
            <div key={sn.id} className="flex items-center gap-3 rounded-sm px-1 py-1.5 row-hover">
              <span className="text-body-s">{fmtTs(sn.at, 'd MMM yyyy, HH:mm')}</span>
              <Badge>{sn.reason === 'auto' ? 'Daily' : sn.reason === 'manual' ? 'Manual' : sn.reason === 'before-import' ? 'Before import' : 'Before reset'}</Badge>
              <span className="text-body-s text-faint">{fmtBytes(sn.size)}</span>
              <div className="flex-1" />
              <Button
                size="xs"
                onClick={async () => {
                  const ok = await confirm({ title: 'Restore this snapshot?', message: `Your records will be put back to how they were on ${fmtTs(sn.at, 'd MMM yyyy, HH:mm')}. Files are kept as they are now. A restore point of the current state is saved first.`, confirmLabel: 'Restore', danger: true });
                  if (!ok) return;
                  await restoreSnapshot(sn.id!);
                  toast('Restored');
                }}
              >
                Restore
              </Button>
            </div>
          ))}
          {snaps && !snaps.length && <p className="text-body-s text-faint">No restore points yet.</p>}
        </div>
      </Card>

      <Card title="Sample content" icon={FlaskConical}>
        <Row label={demo ? 'Demo content is loaded' : 'Load demo content'} hint="Clearly labelled sample items for exploring. Removing them never touches your own items.">
          {demo ? (
            <Button
              size="sm"
              variant="danger"
              onClick={async () => {
                const ok = await confirm({ title: 'Remove demo content?', message: 'Only items marked “Demo” are deleted.', confirmLabel: 'Remove', danger: true });
                if (ok) toast(`Removed ${await removeDemo()} demo items`);
              }}
            >
              Remove demo content
            </Button>
          ) : (
            <Button size="sm" onClick={async () => { await ensureBuiltInTemplates(); await seedDemo(); toast('Demo content added'); }}>
              Add demo content
            </Button>
          )}
        </Row>
      </Card>

      <Card title="Storage">
        <Row label="Space used in this browser" hint={est ? `${fmtBytes(est.usage)} of about ${fmtBytes(est.quota)} available to this site.` : 'Not reported by this browser.'}>
          <span />
        </Row>
        <Row label="Protected from automatic clean-up" hint={persisted ? 'Yes — the browser has agreed not to clear Work OS data when space runs low.' : 'Not yet. Installing Work OS as an app (or bookmarking it) usually makes browsers grant this. Regular backups are still recommended.'}>
          <Badge tone={persisted ? 'ok' : 'warn'}>{persisted ? 'Protected' : 'Best effort'}</Badge>
        </Row>
        {counts && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-body-s text-muted">
            {Object.entries(counts).map(([k, v]) => (
              <span key={k}>
                {k}: <span className="tabular-nums text-fg">{v}</span>
              </span>
            ))}
          </div>
        )}
        <p className="mt-2 text-caption text-faint">Database schema version {SCHEMA_VERSION}.</p>
      </Card>

      <Card title="Danger zone">
        <Row label="Erase everything" hint="Deletes all data in this browser. Download a backup first. A restore point is saved, but it's also stored in this browser.">
          <Button
            size="sm"
            variant="danger"
            onClick={async () => {
              const ok = await confirm({ title: 'Erase all data?', message: 'All records, files and settings in this browser will be deleted. This cannot be undone unless you have a backup file.', confirmLabel: 'Erase everything', danger: true, typeToConfirm: 'ERASE' });
              if (!ok) return;
              await createSnapshot('before-clear');
              await db.transaction('rw', [...RECORD_TABLES.map((t) => db.table(t)), db.activity, db.dismissals, db.kv], async () => {
                for (const t of RECORD_TABLES) await db.table(t).clear();
                await db.activity.clear();
                await db.dismissals.clear();
                await db.kv.clear();
              });
              location.href = '/';
            }}
          >
            Erase all data
          </Button>
        </Row>
      </Card>

      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        title="Import backup"
        description={pending?.data ? `Exported ${fmtTs(new Date(pending.data.exportedAt).getTime(), 'd MMM yyyy, HH:mm')}` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button onClick={() => doImport('replace')} disabled={busy}>
              Replace everything
            </Button>
            <Button variant="primary" onClick={() => doImport('merge')} disabled={busy}>
              {busy ? <Spinner className="!h-3.5 !w-3.5" /> : 'Merge (recommended)'}
            </Button>
          </>
        }
      >
        <p className="text-body-s text-muted">The file is valid and contains:</p>
        <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-body-s sm:grid-cols-3">
          {Object.entries(pending?.counts ?? {})
            .filter(([, n]) => n)
            .map(([t, n]) => (
              <span key={t}>
                {t}: <strong className="tabular-nums">{n}</strong>
              </span>
            ))}
        </div>
        <ul className="mt-4 space-y-1.5 text-body-s text-muted">
          <li>
            <strong className="text-fg">Merge</strong> adds new items and updates items only where the backup's copy is newer. Nothing is deleted.
          </li>
          <li>
            <strong className="text-fg">Replace</strong> clears this browser's data and loads the backup exactly.
          </li>
          <li>Either way, a restore point is saved first.</li>
        </ul>
      </Modal>
    </>
  );
}

function TrashPanel() {
  const { confirm, toast } = useFeedback();
  const items = useLiveQuery(async () => {
    const out: { table: RecordTable; id: string; title: string; deletedAt: number; label: string }[] = [];
    for (const t of RECORD_TABLES) {
      const rows = (await db.table(t).toArray()) as Record<string, unknown>[];
      for (const r of rows)
        if (r.deletedAt) {
          const ent = TABLE_TO_ENTITY[t];
          out.push({ table: t, id: r.id as string, title: ent ? entityTitle(ent, r) : String(r.name ?? r.title ?? 'Item'), deletedAt: r.deletedAt as number, label: ent ? ENTITY[ent].label : t === 'folders' ? 'Folder' : t === 'collections' ? 'Collection' : t === 'templates' ? 'Template' : t });
        }
    }
    return out.sort((a, b) => b.deletedAt - a.deletedAt);
  }, []);
  if (!items) return null;
  return (
    <Card
      title={`Trash · ${items.length}`}
      icon={Trash2}
      action={
        items.length > 0 && (
          <Button
            size="xs"
            variant="ghost"
            className="!text-danger"
            onClick={async () => {
              const ok = await confirm({ title: 'Empty the Trash?', message: `${items.length} item(s) will be permanently deleted. This cannot be undone.`, confirmLabel: 'Delete permanently', danger: true });
              if (!ok) return;
              for (const i of items) await purge(i.table, i.id);
              toast('Trash emptied');
            }}
          >
            Empty Trash
          </Button>
        )
      }
    >
      <p className="mb-3 text-body-s text-muted">Deleted items stay here until you remove them permanently. Restoring brings an item back exactly as it was.</p>
      {items.length === 0 ? (
        <p className="py-6 text-center text-body-s text-faint">The Trash is empty.</p>
      ) : (
        <div className="divide-y divide-line">
          {items.map((i) => (
            <div key={i.table + i.id} className="flex items-center gap-3 py-2">
              <span className="w-24 shrink-0 text-caption uppercase tracking-wide text-faint">{i.label}</span>
              <span className="min-w-0 flex-1 truncate text-body-s">{i.title}</span>
              <span className="hidden text-body-s text-faint sm:inline">{timeAgo(i.deletedAt)}</span>
              <Button size="xs" icon={RotateCcw} onClick={async () => { await restore(i.table, i.id); toast('Restored'); }}>
                Restore
              </Button>
              <IconButton
                icon={X}
                size="sm"
                label="Delete permanently"
                onClick={async () => {
                  const ok = await confirm({ title: 'Delete permanently?', message: `“${i.title}” will be gone for good.`, confirmLabel: 'Delete', danger: true });
                  if (ok) await purge(i.table, i.id);
                }}
              />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ListEditor({ label, hint, values, onChange }: { label: string; hint?: string; values: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState('');
  return (
    <div className="border-b border-line py-3.5 last:border-0">
      <div className="text-body-m font-medium">{label}</div>
      {hint && <div className="mb-2 text-body-s text-muted">{hint}</div>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v} className="inline-flex h-6 items-center gap-1 rounded-full border border-line bg-raised pl-2.5 pr-1 text-body-s">
            {v}
            <button onClick={() => onChange(values.filter((x) => x !== v))} className="text-faint hover:text-danger" aria-label={`Remove ${v}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim() && !values.includes(text.trim())) onChange([...values, text.trim()]);
            setText('');
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add…" className="h-6 w-28 rounded-full border border-dashed border-line-strong bg-transparent px-2.5 text-body-s outline-none focus:border-accent" />
        </form>
      </div>
    </div>
  );
}

// Tag colours are palette roles (stored as CSS strings so they follow the theme).
const TAG_COLORS = ['accent', 'teal', 'clay', 'info', 'violet', 'ochre', 'danger', 'accent-deep', 'faint'].map((r) => `rgb(var(--${r}))`);

function Customise({ s }: { s: Settings }) {
  const [tag, setTag] = useState('');
  const usedTags = useLiveQuery(async () => {
    const set = new Set<string>();
    for (const t of ['tasks', 'projects', 'notes', 'documents', 'content', 'campaigns'] as RecordTable[]) for (const r of (await db.table(t).toArray()) as { tags?: string[] }[]) r.tags?.forEach((x) => set.add(x));
    return [...set].sort();
  }, []);
  const [field, setField] = useState<Partial<CustomFieldDef>>({ entity: 'task', kind: 'text', label: '' });
  const unregistered = (usedTags ?? []).filter((t) => !s.tags.some((x) => x.name === t));

  return (
    <>
      <Card title="Labels (tags) & colours">
        <p className="mb-3 text-body-s text-muted">Tags work everywhere. Give the ones you use most a colour so they're easy to spot.</p>
        <div className="space-y-1.5">
          {s.tags.map((t) => (
            <div key={t.name} className="flex items-center gap-2">
              <div className="flex gap-1">
                {TAG_COLORS.map((c) => (
                  <button key={c} onClick={() => saveSettings({ tags: s.tags.map((x) => (x.name === t.name ? { ...x, color: c } : x)) })} className={cn('h-4 w-4 rounded-full', t.color === c && 'ring-2 ring-fg/40 ring-offset-1 ring-offset-surface')} style={{ background: c }} aria-label={`Colour ${c}`} />
                ))}
              </div>
              <span className="flex-1 text-body-s">{t.name}</span>
              <IconButton icon={X} size="sm" label="Remove label" onClick={() => saveSettings({ tags: s.tags.filter((x) => x.name !== t.name) })} />
            </div>
          ))}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (tag.trim() && !s.tags.some((x) => x.name === tag.trim())) saveSettings({ tags: [...s.tags, { name: tag.trim(), color: TAG_COLORS[s.tags.length % TAG_COLORS.length] }] });
            setTag('');
          }}
        >
          <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="New label" className="w-48" />
          <Button type="submit" icon={Plus}>
            Add
          </Button>
        </form>
        {unregistered.length > 0 && (
          <div className="mt-3 text-body-s text-muted">
            Tags in use without a colour:{' '}
            {unregistered.map((t) => (
              <button key={t} className="mr-1.5 text-accent-deep hover:underline" onClick={() => saveSettings({ tags: [...s.tags, { name: t, color: TAG_COLORS[s.tags.length % TAG_COLORS.length] }] })}>
                +{t}
              </button>
            ))}
          </div>
        )}
      </Card>
      <Card title="Categories & lists">
        <ListEditor label="Note & library categories" values={s.noteCategories} onChange={(v) => saveSettings({ noteCategories: v })} />
        <ListEditor label="Idea categories" hint="Ideas are never categorised automatically — these are choices for you." values={s.ideaCategories} onChange={(v) => saveSettings({ ideaCategories: v })} />
        <ListEditor label="Content platforms" values={s.platforms} onChange={(v) => saveSettings({ platforms: v })} />
        <ListEditor label="Content types" values={s.contentTypes} onChange={(v) => saveSettings({ contentTypes: v })} />
      </Card>
      <Card title="Custom fields">
        <p className="mb-3 text-body-s text-muted">Add your own fields to tasks, projects, campaigns or content. They appear in each item's editor.</p>
        {s.customFields.map((f) => (
          <div key={f.id} className="flex items-center gap-3 border-b border-line py-2 last:border-0">
            <Badge>{f.entity}</Badge>
            <span className="flex-1 text-body-s">{f.label}</span>
            <span className="text-body-s text-faint">
              {f.kind}
              {f.options?.length ? `: ${f.options.join(', ')}` : ''}
            </span>
            <IconButton icon={X} size="sm" label="Remove field" onClick={() => saveSettings({ customFields: s.customFields.filter((x) => x.id !== f.id) })} />
          </div>
        ))}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Select value={field.entity} onChange={(e) => setField({ ...field, entity: e.target.value as CustomFieldDef['entity'] })} aria-label="Applies to">
            <option value="task">Task</option>
            <option value="project">Project</option>
            <option value="campaign">Campaign</option>
            <option value="content">Content</option>
          </Select>
          <Input value={field.label} onChange={(e) => setField({ ...field, label: e.target.value })} placeholder="Field name" />
          <Select value={field.kind} onChange={(e) => setField({ ...field, kind: e.target.value as CustomFieldDef['kind'] })} aria-label="Field type">
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="url">Link</option>
            <option value="select">Choice list</option>
          </Select>
          <Button
            icon={Plus}
            disabled={!field.label?.trim()}
            onClick={() => {
              saveSettings({ customFields: [...s.customFields, { id: uid(), entity: field.entity!, label: field.label!.trim(), kind: field.kind!, options: field.kind === 'select' ? (field.options ?? []) : undefined }] });
              setField({ entity: field.entity, kind: 'text', label: '' });
            }}
          >
            Add field
          </Button>
          {field.kind === 'select' && <Input className="col-span-2 sm:col-span-4" placeholder="Choices, separated by commas" onChange={(e) => setField({ ...field, options: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />}
        </div>
      </Card>
      <Card title="Statuses">
        <p className="text-body-s leading-relaxed text-muted">
          Task, project, campaign and content statuses are fixed in this version so that progress, analytics and reviews stay reliable. Use tags or a custom “choice list” field for extra stages. Fully custom statuses are listed as a future improvement in DEVELOPMENT_STATUS.md.
        </p>
      </Card>
    </>
  );
}

function Templates() {
  const templates = useTemplates();
  const [editing, setEditing] = useState<ProjectTemplate | null>(null);
  const { toast, confirm } = useFeedback();
  if (!templates) return null;
  return (
    <>
      <Card
        title="Project templates"
        icon={LayoutTemplate}
        action={
          <Button size="xs" icon={Plus} onClick={async () => setEditing(await create<ProjectTemplate>('templates', { name: 'New template', kind: 'custom', milestones: [], tasks: [], durationDays: 30 }))}>
            New template
          </Button>
        }
      >
        <p className="mb-3 text-body-s text-muted">Templates create a project with milestones and tasks, dated relative to the start date. You can also save any project as a template from its “…” menu.</p>
        <div className="divide-y divide-line">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-body-m font-medium">
                  {t.name} {t.builtIn ? <Badge>Built-in</Badge> : <Badge tone="accent">Custom</Badge>}
                </div>
                <div className="text-body-s text-faint">
                  {t.milestones.length} milestones · {t.tasks.length} tasks{t.durationDays ? ` · ${t.durationDays} days` : ''}
                </div>
              </div>
              <Button size="xs" onClick={() => setEditing(t)}>
                Edit
              </Button>
              <IconButton
                icon={Trash2}
                size="sm"
                label="Delete template"
                onClick={async () => {
                  if (t.builtIn && !(await confirm({ title: 'Delete built-in template?', message: 'It will come back the next time the app starts if you restore it from the Trash.', confirmLabel: 'Delete', danger: true }))) return;
                  await softDelete('templates', t.id);
                  toast('Template moved to Trash', { action: { label: 'Undo', onClick: () => restore('templates', t.id) } });
                }}
              />
            </div>
          ))}
        </div>
      </Card>
      {editing && <TemplateEditor tpl={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function TemplateEditor({ tpl, onClose }: { tpl: ProjectTemplate; onClose: () => void }) {
  const [t, setT] = useState(tpl);
  const save = async () => {
    await update<ProjectTemplate>('templates', t.id, t, { log: false });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Edit template"
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            Save template
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Name" className="col-span-2">
            <Input value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} />
          </Field>
          <Field label="Duration (days)">
            <Input type="number" min={0} value={t.durationDays ?? ''} onChange={(e) => setT({ ...t, durationDays: e.target.value === '' ? null : Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Description">
          <Input value={t.description ?? ''} onChange={(e) => setT({ ...t, description: e.target.value })} />
        </Field>
        <Field label="Objectives (Markdown)">
          <Textarea rows={3} value={t.objectives ?? ''} onChange={(e) => setT({ ...t, objectives: e.target.value })} />
        </Field>
        <div>
          <span className="label">Milestones (day offset from start)</span>
          {t.milestones.map((m, i) => (
            <div key={i} className="mb-1.5 flex gap-2">
              <Input value={m.title} onChange={(e) => setT({ ...t, milestones: t.milestones.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} className="flex-1" />
              <Input type="number" value={m.offsetDays ?? ''} onChange={(e) => setT({ ...t, milestones: t.milestones.map((x, j) => (j === i ? { ...x, offsetDays: e.target.value === '' ? null : Number(e.target.value) } : x)) })} className="w-24" placeholder="Day" />
              <IconButton icon={X} label="Remove" onClick={() => setT({ ...t, milestones: t.milestones.filter((_, j) => j !== i) })} />
            </div>
          ))}
          <Button size="xs" variant="ghost" icon={Plus} onClick={() => setT({ ...t, milestones: [...t.milestones, { title: '', offsetDays: null }] })}>
            Add milestone
          </Button>
        </div>
        <div>
          <span className="label">Tasks</span>
          {t.tasks.map((m, i) => (
            <div key={i} className="mb-1.5 flex gap-2">
              <Input value={m.title} onChange={(e) => setT({ ...t, tasks: t.tasks.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} className="flex-1" />
              <Select value={m.priority} onChange={(e) => setT({ ...t, tasks: t.tasks.map((x, j) => (j === i ? { ...x, priority: e.target.value as Priority } : x)) })} className="w-28">
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
              <Input type="number" value={m.offsetDays ?? ''} onChange={(e) => setT({ ...t, tasks: t.tasks.map((x, j) => (j === i ? { ...x, offsetDays: e.target.value === '' ? null : Number(e.target.value) } : x)) })} className="w-24" placeholder="Day" />
              <IconButton icon={X} label="Remove" onClick={() => setT({ ...t, tasks: t.tasks.filter((_, j) => j !== i) })} />
            </div>
          ))}
          <Button size="xs" variant="ghost" icon={Plus} onClick={() => setT({ ...t, tasks: [...t.tasks, { title: '', priority: 'medium', offsetDays: null }] })}>
            Add task
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function AISettingsPanel({ s }: { s: Settings }) {
  const [ai, setAi] = useState(s.ai);
  const [testing, setTesting] = useState(false);
  const [models, setModels] = useState<string[] | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string; hint?: string } | null>(null);
  const dirty = JSON.stringify(ai) !== JSON.stringify(s.ai);
  const preset = useMemo(() => PROVIDER_PRESETS.find((p) => p.baseUrl === ai.baseUrl && p.provider === ai.provider), [ai]);
  const isRemote = ai.provider !== 'none' && !/localhost|127\.0\.0\.1/.test(ai.baseUrl);

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const p = createProvider(ai);
      if (!p) throw new Error('Choose a provider first.');
      try {
        setModels(await p.listModels());
      } catch {
        setModels(null);
      }
      const reply = await p.chat([{ role: 'user', content: 'Reply with exactly: Connection OK' }]);
      setResult({ ok: true, text: `Connected. The model replied: “${reply.trim().slice(0, 80)}”` });
    } catch (e) {
      const err = e as Error & { hint?: string };
      setResult({ ok: false, text: err.message, hint: err.hint });
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <Card title="AI assistant (optional)" icon={Bot}>
        <p className="text-body-s leading-relaxed text-muted">
          Work OS works fully without AI. If you'd like help drafting and summarising, connect a free model here. Nothing is sent anywhere until you choose a provider and ask the assistant something — and only the items you select are shared.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button onClick={() => setAi({ ...ai, provider: 'none' })} className={cn('rounded-md border p-3 text-left', ai.provider === 'none' ? 'border-accent bg-accent-soft/40' : 'border-line hover:border-line-strong')}>
            <div className="text-body-m font-medium">No AI</div>
            <div className="text-body-s text-muted">Default. The assistant page shows rule-based insights only.</div>
          </button>
          {PROVIDER_PRESETS.map((p) => (
            <button key={p.label} onClick={() => setAi({ ...ai, provider: p.provider, baseUrl: p.baseUrl, model: p.model })} className={cn('rounded-md border p-3 text-left', preset?.label === p.label && ai.provider !== 'none' ? 'border-accent bg-accent-soft/40' : 'border-line hover:border-line-strong')}>
              <div className="flex items-center gap-2 text-body-m font-medium">
                {p.label} {p.local ? <Badge tone="ok">Private</Badge> : <Badge tone="warn">Online</Badge>}
              </div>
              <div className="text-body-s text-muted">{p.note}</div>
            </button>
          ))}
        </div>
      </Card>
      {ai.provider !== 'none' && (
        <Card title="Connection">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Provider type">
              <Select value={ai.provider} onChange={(e) => setAi({ ...ai, provider: e.target.value as Settings['ai']['provider'] })}>
                <option value="ollama">Ollama</option>
                <option value="openai">OpenAI-compatible API</option>
              </Select>
            </Field>
            <Field label="Base URL">
              <Input value={ai.baseUrl} onChange={(e) => setAi({ ...ai, baseUrl: e.target.value })} />
            </Field>
            <Field label="Model" hint={models?.length ? `Available: ${models.slice(0, 8).join(', ')}${models.length > 8 ? '…' : ''}` : undefined}>
              <Input value={ai.model} onChange={(e) => setAi({ ...ai, model: e.target.value })} list="ai-models" />
              <datalist id="ai-models">{models?.map((m) => <option key={m} value={m} />)}</datalist>
            </Field>
            <Field label="Creativity" hint="Lower = more focused, higher = more varied.">
              <input type="range" min={0} max={1} step={0.1} value={ai.temperature} onChange={(e) => setAi({ ...ai, temperature: Number(e.target.value) })} className="w-full accent-[rgb(var(--accent))]" />
            </Field>
            {ai.provider === 'openai' && (
              <Field
                label="API key"
                className="sm:col-span-2"
                hint="Stored only in this browser's local database. It is never included in backups or sent anywhere except the provider above. Use a free-tier key — anyone with access to this browser profile could read it."
              >
                <Input type="password" value={ai.apiKey} onChange={(e) => setAi({ ...ai, apiKey: e.target.value })} placeholder={isRemote ? 'Paste your API key' : 'Not needed for local servers'} autoComplete="off" />
              </Field>
            )}
          </div>
          {isRemote && (
            <p className="mt-3 rounded-sm bg-warn/10 px-3 py-2 text-body-s leading-relaxed text-warn">
              This is an online provider: the text of items you select in the assistant will be sent to it and handled under its privacy terms. For full privacy, use Ollama or LM Studio on your own computer.
            </p>
          )}
          {ai.provider === 'ollama' && (
            <p className="mt-3 text-body-s leading-relaxed text-muted">
              Set-up: install Ollama from ollama.com, then in Terminal run <code className="rounded-sm bg-sunken px-1">ollama pull {ai.model || 'llama3.2'}</code>. If Work OS is hosted online (not on localhost), allow it by setting
              <code className="mx-1 rounded-sm bg-sunken px-1">OLLAMA_ORIGINS={location.origin}</code>and restarting Ollama — see the README for exact steps.
            </p>
          )}
          <div className="mt-4 flex items-center gap-2">
            <Button variant="primary" disabled={!dirty} onClick={() => saveSettings({ ai })}>
              Save
            </Button>
            <Button onClick={test} disabled={testing}>
              {testing ? <Spinner className="!h-3.5 !w-3.5" /> : 'Test connection'}
            </Button>
          </div>
          {result && (
            <div className={cn('mt-3 rounded-sm px-3 py-2 text-body-s', result.ok ? 'bg-ok/10 text-ok' : 'bg-danger/10 text-danger')}>
              {result.text}
              {result.hint && <div className="mt-1 text-body-s text-muted">{result.hint}</div>}
            </div>
          )}
        </Card>
      )}
      {ai.provider === 'none' && dirty && (
        <Button variant="primary" onClick={() => saveSettings({ ai })}>
          Save
        </Button>
      )}
    </>
  );
}

function Integrations() {
  const [o, setO] = useState({ events: true, tasks: true, milestones: true, content: true });
  return (
    <>
      <Card title="Export calendar (.ics)" icon={CalendarDays}>
        <p className="mb-3 text-body-s text-muted">
          Download your Work OS calendar as a file you can import into Google Calendar, Apple Calendar or Outlook. It's a one-time copy (not a live sync) — export again after big changes.
        </p>
        <div className="mb-3 flex flex-wrap gap-4 text-body-s">
          {(Object.keys(o) as (keyof typeof o)[]).map((k) => (
            <label key={k} className="flex items-center gap-1.5 capitalize">
              <input type="checkbox" checked={o[k]} onChange={(e) => setO({ ...o, [k]: e.target.checked })} className="accent-[rgb(var(--accent))]" />
              {k === 'tasks' ? 'Task deadlines' : k === 'content' ? 'Content dates' : k}
            </label>
          ))}
        </div>
        <Button icon={Download} onClick={() => exportICS(o)}>
          Download .ics
        </Button>
      </Card>
      <Card title="Planned integrations">
        <ul className="space-y-3 text-body-s leading-relaxed text-muted">
          <li>
            <strong className="text-fg">Google Calendar (two-way)</strong> — possible later. It needs a Google Cloud project with OAuth set up (free), and is optional. Work OS's own calendar works independently.
          </li>
          <li>
            <strong className="text-fg">Sync between devices</strong> — not available yet. Your data does not sync automatically. Move data between devices with backup files (Data & backup). Optional free sync options are documented in the README.
          </li>
          <li>
            <strong className="text-fg">Social platform analytics</strong> — not connected. Platform APIs require app reviews and business accounts; metrics are entered manually so they're always accurate and under your control.
          </li>
        </ul>
      </Card>
    </>
  );
}

function Privacy() {
  return (
    <Card title="What's stored where" icon={Shield}>
      <div className="space-y-3 text-body-s leading-relaxed text-muted">
        <p>
          <strong className="text-fg">On this device only:</strong> every task, project, note, document, file, campaign, metric and setting is stored in this browser's private database (IndexedDB). There is no account, no server and no tracking.
        </p>
        <p>
          <strong className="text-fg">Sent over the internet:</strong> nothing by default. The only exception is the AI assistant, and only if you configure an online provider — then the items you explicitly select are sent to that provider when you ask a question.
        </p>
        <p>
          <strong className="text-fg">Hosting:</strong> if you use the hosted version, the hosting service only delivers the app's code. It never receives your data.
        </p>
        <p>
          <strong className="text-fg">Risks to know:</strong> clearing your browser's site data, using a private window, or losing the device deletes local data. Keep regular backups. Anyone with access to this browser profile can open Work OS — use your device's login protection.
        </p>
      </div>
    </Card>
  );
}
