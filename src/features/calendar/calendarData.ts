import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { EntityType, EventKind } from '@/lib/types';

export type CalSource = EventKind | 'task' | 'milestone' | 'project' | 'content' | 'campaign' | 'release';

export interface CalItem {
  key: string;
  date: string;
  title: string;
  source: CalSource;
  startTime?: string | null;
  endTime?: string | null;
  done?: boolean;
  open: { type: EntityType; id: string };
  sub?: string;
}

/** Visual style per source: a coloured left bar + soft background. */
export const SOURCE_STYLE: Record<CalSource, { label: string; color: string }> = {
  meeting: { label: 'Meeting', color: 'var(--info)' },
  work_block: { label: 'Work block', color: 'var(--accent)' },
  reminder: { label: 'Reminder', color: 'var(--warn)' },
  event: { label: 'Event', color: 'var(--ok)' },
  deadline: { label: 'Deadline', color: 'var(--danger)' },
  task: { label: 'Task due', color: 'var(--muted)' },
  milestone: { label: 'Milestone', color: '156 108 142' },
  project: { label: 'Project deadline', color: 'var(--danger)' },
  content: { label: 'Content', color: '184 112 126' },
  campaign: { label: 'Campaign', color: '160 124 52' },
  release: { label: 'Press release', color: '160 124 52' },
};

export const sourceColor = (s: CalSource) => {
  const c = SOURCE_STYLE[s].color;
  return `rgb(${c})`;
};

export const FILTER_GROUPS: { key: string; label: string; sources: CalSource[] }[] = [
  { key: 'events', label: 'Events', sources: ['meeting', 'work_block', 'reminder', 'event', 'deadline'] },
  { key: 'tasks', label: 'Task deadlines', sources: ['task'] },
  { key: 'projects', label: 'Milestones & projects', sources: ['milestone', 'project'] },
  { key: 'content', label: 'Content', sources: ['content'] },
  { key: 'pr', label: 'PR & campaigns', sources: ['campaign', 'release'] },
];

export function useCalendarItems(from: string, to: string): CalItem[] | undefined {
  return useLiveQuery(async () => {
    const inRange = (d?: string | null) => !!d && d >= from && d <= to;
    const out: CalItem[] = [];
    const events = await db.events.where('date').between(from, to, true, true).toArray();
    for (const e of events)
      if (!e.deletedAt)
        out.push({ key: `e:${e.id}`, date: e.date, title: e.title, source: e.kind, startTime: e.startTime, endTime: e.endTime, open: { type: 'event', id: e.id }, sub: e.location });
    const tasks = await db.tasks.where('dueDate').between(from, to, true, true).toArray();
    for (const t of tasks)
      if (!t.deletedAt) out.push({ key: `t:${t.id}`, date: t.dueDate!, title: t.title, source: 'task', done: t.status === 'completed', open: { type: 'task', id: t.id } });
    const projects = (await db.projects.toArray()).filter((p) => !p.deletedAt);
    for (const p of projects) {
      if (inRange(p.deadline)) out.push({ key: `p:${p.id}`, date: p.deadline!, title: p.title, source: 'project', done: p.status === 'completed', open: { type: 'project', id: p.id }, sub: 'Project deadline' });
      for (const m of p.milestones)
        if (inRange(m.date)) out.push({ key: `m:${m.id}`, date: m.date!, title: m.title, source: 'milestone', done: m.done, open: { type: 'project', id: p.id }, sub: p.title });
    }
    const content = await db.content.where('publishDate').between(from, to, true, true).toArray();
    for (const c of content)
      if (!c.deletedAt)
        out.push({ key: `c:${c.id}`, date: c.publishDate!, title: c.title, source: 'content', startTime: c.publishTime, done: c.status === 'published', open: { type: 'content', id: c.id }, sub: `${c.platform} · ${c.status}` });
    const campaigns = (await db.campaigns.toArray()).filter((c) => !c.deletedAt);
    for (const c of campaigns) {
      if (inRange(c.startDate)) out.push({ key: `cs:${c.id}`, date: c.startDate!, title: `${c.name} starts`, source: 'campaign', open: { type: 'campaign', id: c.id } });
      if (inRange(c.endDate)) out.push({ key: `ce:${c.id}`, date: c.endDate!, title: `${c.name} ends`, source: 'campaign', open: { type: 'campaign', id: c.id } });
    }
    const releases = (await db.pressReleases.toArray()).filter((r) => !r.deletedAt);
    for (const r of releases)
      if (inRange(r.distributionDate)) out.push({ key: `r:${r.id}`, date: r.distributionDate!, title: r.title, source: 'release', done: r.status === 'distributed', open: r.campaignId ? { type: 'campaign', id: r.campaignId } : { type: 'pressRelease', id: r.id }, sub: 'Press release distribution' });
    return out.sort((a, b) => (a.startTime ?? '00:00').localeCompare(b.startTime ?? '00:00'));
  }, [from, to]);
}
