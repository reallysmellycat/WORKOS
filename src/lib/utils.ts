import {
  addDays,
  differenceInCalendarDays,
  format,
  isValid,
  parseISO,
} from 'date-fns';

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export const todayISO = () => format(new Date(), 'yyyy-MM-dd');
export const toISODate = (d: Date) => format(d, 'yyyy-MM-dd');
export const monthKey = (d: Date) => format(d, 'yyyy-MM');

export function parseDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = parseISO(s);
  return isValid(d) ? d : null;
}

export function addDaysISO(s: string, n: number): string {
  return toISODate(addDays(parseISO(s), n));
}

/** Days from today until the date (negative = past). */
export function daysUntil(s?: string | null): number | null {
  const d = parseDate(s);
  if (!d) return null;
  return differenceInCalendarDays(d, new Date());
}

export function fmtDate(s?: string | null, pattern = 'd MMM'): string {
  const d = parseDate(s);
  return d ? format(d, pattern) : '';
}

export function fmtTs(ts?: number | null, pattern = 'd MMM yyyy'): string {
  return ts ? format(new Date(ts), pattern) : '';
}

/** Human relative label for a due date. */
export function relativeDay(s?: string | null): string {
  const n = daysUntil(s);
  if (n === null) return '';
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n < 0) return `${-n}d overdue`;
  if (n < 7) return format(parseISO(s!), 'EEEE');
  return fmtDate(s, n > 300 ? 'd MMM yyyy' : 'd MMM');
}

export function timeAgo(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return fmtTs(ts, 'd MMM yyyy');
}

export function fmtNumber(n?: number | null, opts: Intl.NumberFormatOptions = {}): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1, ...opts }).format(n);
}

export function compactNumber(n?: number | null): string {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  const d = (...a: A) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
  d.flush = () => clearTimeout(t);
  return d;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadText(text: string, filename: string, mime = 'text/plain') {
  downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename);
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'untitled';
}

export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/[#>*_`~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function excerpt(md = '', len = 140): string {
  const s = stripMarkdown(md);
  return s.length > len ? s.slice(0, len).trimEnd() + '…' : s;
}

export function wordCount(md = ''): number {
  const s = stripMarkdown(md);
  return s ? s.split(' ').length : 0;
}

export function isUrl(s: string) {
  return /^https?:\/\/\S+$/i.test(s.trim());
}

export function groupBy<T, K extends string>(arr: T[], key: (t: T) => K): Record<K, T[]> {
  return arr.reduce(
    (acc, item) => {
      const k = key(item);
      (acc[k] ||= []).push(item);
      return acc;
    },
    {} as Record<K, T[]>,
  );
}

export const alive = <T extends { deletedAt?: number | null }>(r: T) => !r.deletedAt;

/** localStorage read that never throws (private mode, blocked storage). */
export function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
