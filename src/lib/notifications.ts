import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Settings } from './settings';
import { daysUntil, fmtDate, relativeDay, todayISO } from './utils';

export interface AppNotification {
  key: string; // stable per occurrence, used for dismissal
  kind: 'overdue' | 'deadline' | 'milestone' | 'content' | 'reminder' | 'recurring';
  title: string;
  detail: string;
  href: string;
  date: string;
  severity: 'high' | 'normal';
}

/**
 * Derives notifications from your data each time it changes. Nothing is
 * stored except which ones you dismissed — so notifications never pile up
 * or go stale. Overdue tasks are grouped when there are many.
 */
export async function computeNotifications(s: Settings): Promise<AppNotification[]> {
  if (!s.notifications.enabled) return [];
  const n = s.notifications;
  const today = todayISO();
  const out: AppNotification[] = [];
  const tasks = (await db.tasks.toArray()).filter((t) => !t.deletedAt && t.status !== 'completed');

  if (n.overdue) {
    const overdue = tasks.filter((t) => t.dueDate && t.dueDate < today);
    if (overdue.length > 4) {
      out.push({
        key: `overdue-group:${today}:${overdue.length}`,
        kind: 'overdue',
        title: `${overdue.length} overdue tasks`,
        detail: overdue.slice(0, 3).map((t) => t.title).join(', ') + '…',
        href: '/tasks?view=overdue',
        date: today,
        severity: 'high',
      });
    } else
      for (const t of overdue)
        out.push({
          key: `overdue:${t.id}:${t.dueDate}`,
          kind: 'overdue',
          title: t.title,
          detail: `Overdue — was due ${fmtDate(t.dueDate, 'd MMM')}`,
          href: `/tasks?open=${t.id}`,
          date: t.dueDate!,
          severity: 'high',
        });
  }

  for (const t of tasks) {
    const d = daysUntil(t.dueDate);
    if (d !== null && d >= 0 && d <= n.deadlineDays)
      out.push({
        key: `due:${t.id}:${t.dueDate}`,
        kind: t.recurrence ? 'recurring' : 'deadline',
        title: t.title,
        detail: `${t.recurrence ? 'Recurring task due' : 'Due'} ${relativeDay(t.dueDate).toLowerCase()}`,
        href: `/tasks?open=${t.id}`,
        date: t.dueDate!,
        severity: d === 0 ? 'high' : 'normal',
      });
  }

  if (n.milestones) {
    const projects = (await db.projects.toArray()).filter((p) => !p.deletedAt && p.status !== 'completed');
    for (const p of projects) {
      for (const m of p.milestones) {
        const d = daysUntil(m.date);
        if (!m.done && d !== null && d <= Math.max(n.deadlineDays, 3) && d >= -7)
          out.push({
            key: `ms:${p.id}:${m.id}:${m.date}`,
            kind: 'milestone',
            title: m.title,
            detail: `${p.title} · milestone ${d < 0 ? 'missed' : relativeDay(m.date).toLowerCase()}`,
            href: `/projects/${p.id}`,
            date: m.date!,
            severity: d <= 0 ? 'high' : 'normal',
          });
      }
      const dd = daysUntil(p.deadline);
      if (dd !== null && dd >= 0 && dd <= n.deadlineDays)
        out.push({
          key: `pd:${p.id}:${p.deadline}`,
          kind: 'deadline',
          title: p.title,
          detail: `Project deadline ${relativeDay(p.deadline).toLowerCase()}`,
          href: `/projects/${p.id}`,
          date: p.deadline!,
          severity: 'normal',
        });
    }
  }

  if (n.content) {
    const items = (await db.content.toArray()).filter((c) => !c.deletedAt && c.status !== 'published');
    for (const c of items) {
      const d = daysUntil(c.publishDate);
      if (d !== null && d >= -1 && d <= 1)
        out.push({
          key: `content:${c.id}:${c.publishDate}`,
          kind: 'content',
          title: c.title,
          detail: `${c.platform} · ${c.status === 'scheduled' ? 'scheduled' : 'planned, not yet scheduled'} for ${relativeDay(c.publishDate).toLowerCase()}`,
          href: `/content?open=${c.id}`,
          date: c.publishDate!,
          severity: c.status !== 'scheduled' ? 'high' : 'normal',
        });
    }
  }

  if (n.reminders) {
    const events = (await db.events.where('date').equals(today).toArray()).filter((e) => !e.deletedAt && e.kind === 'reminder');
    for (const e of events)
      out.push({
        key: `rem:${e.id}:${e.date}`,
        kind: 'reminder',
        title: e.title,
        detail: e.startTime ? `Reminder at ${e.startTime}` : 'Reminder today',
        href: `/calendar?event=${e.id}`,
        date: e.date,
        severity: 'normal',
      });
  }

  const dismissed = new Set((await db.dismissals.toArray()).map((d) => d.key));
  return out
    .filter((x) => !dismissed.has(x.key))
    .sort((a, b) => (a.severity === b.severity ? a.date.localeCompare(b.date) : a.severity === 'high' ? -1 : 1));
}

export function useNotifications(s: Settings | undefined) {
  return useLiveQuery(async () => (s ? computeNotifications(s) : []), [s]) ?? [];
}

export async function dismiss(keys: string[]) {
  await db.dismissals.bulkPut(keys.map((key) => ({ key, at: Date.now() })));
}

// ---------- Browser notifications ----------
const SENT_KEY = 'workos-notified';

/** Sends a browser notification once per item, only if the user enabled it. */
export function pushBrowserNotifications(list: AppNotification[], s: Settings) {
  if (!s.notifications.browser || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  let sent: string[] = [];
  try {
    sent = JSON.parse(localStorage.getItem(SENT_KEY) || '[]');
  } catch {
    /* ignore */
  }
  const fresh = list.filter((n) => n.severity === 'high' && !sent.includes(n.key)).slice(0, 3);
  for (const n of fresh) {
    try {
      new Notification(n.title, { body: n.detail, tag: n.key, icon: '/pwa-192.png' });
    } catch {
      /* some platforms only allow notifications via service worker */
    }
  }
  if (fresh.length) {
    try {
      localStorage.setItem(SENT_KEY, JSON.stringify([...sent, ...fresh.map((f) => f.key)].slice(-300)));
    } catch {
      /* ignore */
    }
  }
}
