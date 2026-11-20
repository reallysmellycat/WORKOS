import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { db, type RecordTable } from './db';
import type {
  Bookmark,
  CalEvent,
  Campaign,
  Collection,
  ContentIdea,
  ContentItem,
  Coverage,
  Doc,
  Folder,
  Idea,
  KPI,
  KPIEntry,
  Note,
  PressRelease,
  Project,
  ProjectTemplate,
  SocialSnapshot,
  StoredFile,
  Task,
} from './types';

/** Live list of non-deleted records from a table. `undefined` while loading. */
export function useAlive<T extends { deletedAt?: number | null }>(table: RecordTable, deps: unknown[] = []): T[] | undefined {
  return useLiveQuery(async () => {
    const rows = (await db.table(table).toArray()) as T[];
    return rows.filter((r) => !r.deletedAt);
  }, deps);
}

export const useTasks = () => useAlive<Task>('tasks');
export const useProjects = () => useAlive<Project>('projects');
export const useTemplates = () => useAlive<ProjectTemplate>('templates');
export const useCampaigns = () => useAlive<Campaign>('campaigns');
export const usePressReleases = () => useAlive<PressRelease>('pressReleases');
export const useCoverage = () => useAlive<Coverage>('coverage');
export const useContent = () => useAlive<ContentItem>('content');
export const useContentIdeas = () => useAlive<ContentIdea>('contentIdeas');
export const useSocial = () => useAlive<SocialSnapshot>('social');
export const useNotes = () => useAlive<Note>('notes');
export const useDocs = () => useAlive<Doc>('documents');
export const useFolders = () => useAlive<Folder>('folders');
export const useCollections = () => useAlive<Collection>('collections');
export const useBookmarks = () => useAlive<Bookmark>('bookmarks');
export const useIdeas = () => useAlive<Idea>('ideas');
export const useEvents = () => useAlive<CalEvent>('events');
export const useKPIs = () => useAlive<KPI>('kpis');
export const useKPIEntries = () => useAlive<KPIEntry>('kpiEntries');

/** File metadata without loading every blob into React state. */
export function useFiles() {
  return useLiveQuery(async () => {
    const rows = await db.files.toArray();
    return rows.filter((f) => !f.deletedAt) as StoredFile[];
  }, []);
}

export function useRecord<T>(table: RecordTable, id: string | undefined) {
  return useLiveQuery(async () => (id ? ((await db.table(table).get(id)) as T | undefined) ?? null : null), [table, id]);
}

export function useById<T extends { id: string }>(rows: T[] | undefined) {
  return useMemo(() => new Map((rows ?? []).map((r) => [r.id, r])), [rows]);
}

/** Object URL for a stored file blob (revoked on unmount). */
export function useFileUrl(id?: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let u: string | null = null;
    let cancelled = false;
    if (id)
      db.files.get(id).then((f) => {
        if (cancelled || !f) return;
        u = URL.createObjectURL(f.blob);
        setUrl(u);
      });
    return () => {
      cancelled = true;
      if (u) URL.revokeObjectURL(u);
    };
  }, [id]);
  return url;
}

/** Debounced autosave. Returns a status for the "Saved" indicator. */
export function useAutosave<T>(value: T, save: (v: T) => Promise<void> | void, delay = 600, enabled = true) {
  const [status, setStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
  const first = useRef(true);
  const latest = useRef(value);
  const saveRef = useRef(save);
  saveRef.current = save;
  latest.current = value;
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const dirty = useRef(false);

  const flush = async () => {
    if (!dirty.current) return;
    dirty.current = false;
    clearTimeout(timer.current);
    setStatus('saving');
    try {
      await saveRef.current(latest.current);
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    if (!enabled) {
      first.current = true;
      return;
    }
    if (first.current) {
      first.current = false;
      return;
    }
    dirty.current = true;
    setStatus('pending');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, enabled]);

  // Save on unmount / tab close so nothing is lost.
  useEffect(() => {
    const onHide = () => void flush();
    window.addEventListener('beforeunload', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('beforeunload', onHide);
      document.removeEventListener('visibilitychange', onHide);
      void flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return status;
}

export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}

export function useHotkey(combo: string, handler: (e: KeyboardEvent) => void, deps: unknown[] = []) {
  useEffect(() => {
    const parts = combo.toLowerCase().split('+');
    const key = parts.pop()!;
    const needMod = parts.includes('mod');
    const needShift = parts.includes('shift');
    const on = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (needMod !== mod) return;
      if (needShift !== e.shiftKey) return;
      if (e.key.toLowerCase() !== key) return;
      handler(e);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Loads a record into an editable draft and autosaves changes back.
 * `record` is the live database copy (null if missing, undefined while loading).
 */
export function useDraft<T extends { id: string; updatedAt: number }>(table: RecordTable, id: string | undefined, delay = 600) {
  const record = useRecord<T>(table, id);
  const [draft, setDraft] = useState<T | null>(null);
  const loadedId = useRef<string | null>(null);
  useEffect(() => {
    if (record && loadedId.current !== record.id) {
      loadedId.current = record.id;
      setDraft(record);
    }
  }, [record]);
  const status = useAutosave(
    draft,
    async (d) => {
      if (!d) return;
      const { update } = await import('./repo');
      await update<T & { createdAt: number }>(table, d.id, d as never);
    },
    delay,
    !!draft && draft.id === id,
  );
  const set = (patch: Partial<T>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  return { record, draft: draft && draft.id === id ? draft : null, set, status, setDraft };
}
