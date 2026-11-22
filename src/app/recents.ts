import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { safeGet } from '@/lib/utils';

/** Recently visited detail pages, kept per browser in localStorage (titles are read live). */
const KEY = 'workos-recents';
const ROUTES: { re: RegExp; table: 'projects' | 'notes' | 'documents' | 'campaigns'; kind: string; field: string }[] = [
  { re: /^\/projects\/([^/]+)$/, table: 'projects', kind: 'Proj', field: 'title' },
  { re: /^\/notes\/([^/]+)$/, table: 'notes', kind: 'Note', field: 'title' },
  { re: /^\/documents\/([^/]+)$/, table: 'documents', kind: 'Doc', field: 'title' },
  { re: /^\/campaigns\/([^/]+)$/, table: 'campaigns', kind: 'Camp', field: 'name' },
];

function read(): string[] {
  try {
    return JSON.parse(safeGet(KEY) || '[]');
  } catch {
    return [];
  }
}

/** Call once (in the layout) to record visits. */
export function useTrackRecents() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!ROUTES.some((r) => r.re.test(pathname))) return;
    const next = [pathname, ...read().filter((p) => p !== pathname)].slice(0, 8);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      window.dispatchEvent(new Event('workos-recents'));
    } catch {
      /* ignore */
    }
  }, [pathname]);
}

export function useRecents() {
  const [paths, setPaths] = useState(read);
  useEffect(() => {
    const on = () => setPaths(read());
    window.addEventListener('workos-recents', on);
    return () => window.removeEventListener('workos-recents', on);
  }, []);
  return (
    useLiveQuery(async () => {
      const out: { path: string; title: string; kind: string }[] = [];
      for (const path of paths) {
        const route = ROUTES.find((r) => r.re.test(path));
        if (!route) continue;
        const id = route.re.exec(path)![1];
        const rec = (await db.table(route.table).get(id)) as Record<string, unknown> | undefined;
        if (!rec || rec.deletedAt) continue;
        out.push({ path, title: (rec[route.field] as string) || 'Untitled', kind: route.kind });
      }
      return out.slice(0, 5);
    }, [paths.join('|')]) ?? []
  );
}
