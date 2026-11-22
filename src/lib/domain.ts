import { CHART_ROLES, roleColor, type ColorRole } from './tokens';
import type {
  CampaignStatus,
  ContentStatus,
  EventKind,
  Priority,
  Project,
  ProjectStatus,
  PressReleaseStatus,
  Task,
  TaskStatus,
} from './types';
import { daysUntil, todayISO } from './utils';

export type Tone = 'neutral' | 'accent' | 'info' | 'warn' | 'danger' | 'ok' | 'muted';

export const PRIORITIES: { value: Priority; label: string; tone: Tone; rank: number }[] = [
  { value: 'urgent', label: 'Urgent', tone: 'danger', rank: 4 },
  { value: 'high', label: 'High', tone: 'warn', rank: 3 },
  { value: 'medium', label: 'Medium', tone: 'info', rank: 2 },
  { value: 'low', label: 'Low', tone: 'muted', rank: 1 },
];
export const priorityMeta = (p: Priority) => PRIORITIES.find((x) => x.value === p)!;

export const TASK_STATUSES: { value: TaskStatus; label: string; tone: Tone }[] = [
  { value: 'not_started', label: 'Not started', tone: 'muted' },
  { value: 'in_progress', label: 'In progress', tone: 'info' },
  { value: 'waiting', label: 'Waiting', tone: 'warn' },
  { value: 'completed', label: 'Completed', tone: 'ok' },
];
export const taskStatusMeta = (s: TaskStatus) => TASK_STATUSES.find((x) => x.value === s)!;

export const PROJECT_STATUSES: { value: ProjectStatus; label: string; tone: Tone }[] = [
  { value: 'planning', label: 'Planning', tone: 'muted' },
  { value: 'in_progress', label: 'In progress', tone: 'info' },
  { value: 'on_hold', label: 'On hold', tone: 'warn' },
  { value: 'completed', label: 'Completed', tone: 'ok' },
];
export const projectStatusMeta = (s: ProjectStatus) => PROJECT_STATUSES.find((x) => x.value === s)!;

export const CAMPAIGN_STATUSES: { value: CampaignStatus; label: string; tone: Tone }[] = [
  { value: 'planning', label: 'Planning', tone: 'muted' },
  { value: 'in_progress', label: 'In progress', tone: 'info' },
  { value: 'reviewing', label: 'Reviewing', tone: 'warn' },
  { value: 'completed', label: 'Completed', tone: 'ok' },
  { value: 'archived', label: 'Archived', tone: 'neutral' },
];
export const campaignStatusMeta = (s: CampaignStatus) => CAMPAIGN_STATUSES.find((x) => x.value === s)!;

export const PR_STATUSES: { value: PressReleaseStatus; label: string; tone: Tone }[] = [
  { value: 'idea', label: 'Idea', tone: 'muted' },
  { value: 'drafting', label: 'Drafting', tone: 'info' },
  { value: 'review', label: 'In review', tone: 'warn' },
  { value: 'approved', label: 'Approved', tone: 'accent' },
  { value: 'distributed', label: 'Distributed', tone: 'ok' },
];
export const prStatusMeta = (s: PressReleaseStatus) => PR_STATUSES.find((x) => x.value === s)!;

export const CONTENT_STATUSES: { value: ContentStatus; label: string; tone: Tone }[] = [
  { value: 'idea', label: 'Idea', tone: 'muted' },
  { value: 'drafting', label: 'Drafting', tone: 'info' },
  { value: 'reviewing', label: 'Reviewing', tone: 'warn' },
  { value: 'scheduled', label: 'Scheduled', tone: 'accent' },
  { value: 'published', label: 'Published', tone: 'ok' },
];
export const contentStatusMeta = (s: ContentStatus) => CONTENT_STATUSES.find((x) => x.value === s)!;

export const EVENT_KINDS: { value: EventKind; label: string; color: string }[] = [
  { value: 'meeting', label: 'Meeting', color: 'info' },
  { value: 'work_block', label: 'Work block', color: 'accent' },
  { value: 'reminder', label: 'Reminder', color: 'warn' },
  { value: 'event', label: 'Event', color: 'ok' },
  { value: 'deadline', label: 'Deadline', color: 'danger' },
];

// ---------- Tasks ----------

export const isDone = (t: Task) => t.status === 'completed';
export const isOverdue = (t: Task) => !isDone(t) && !!t.dueDate && t.dueDate < todayISO();
export const isDueSoon = (t: Task, days = 3) => {
  const n = daysUntil(t.dueDate);
  return !isDone(t) && n !== null && n >= 0 && n <= days;
};

export function isBlocked(t: Task, all: Map<string, Task>): boolean {
  return t.blockedBy.some((id) => {
    const dep = all.get(id);
    return dep && !dep.deletedAt && dep.status !== 'completed';
  });
}

/** Priority score used for "Today's priorities" and the no-AI priority suggestions. */
export function taskScore(t: Task): number {
  let s = priorityMeta(t.priority).rank * 10;
  const n = daysUntil(t.dueDate);
  if (n !== null) s += n < 0 ? 40 + Math.min(-n, 10) : n === 0 ? 35 : n <= 2 ? 25 : n <= 7 ? 10 : 0;
  if (t.status === 'in_progress') s += 8;
  if (t.myDay === todayISO()) s += 30;
  if (t.status === 'waiting') s -= 15;
  return s;
}

export function sortByScore(tasks: Task[]) {
  return [...tasks].sort((a, b) => taskScore(b) - taskScore(a));
}

// ---------- Projects ----------

export interface ProgressBreakdown {
  percent: number;
  mode: 'auto' | 'manual' | 'completed' | 'empty';
  taskDone: number;
  taskTotal: number;
  milestoneDone: number;
  milestoneTotal: number;
  explanation: string;
}

/**
 * Project progress — deliberately simple and explainable:
 *  • Completed projects are always 100%.
 *  • Manual mode uses the value you set.
 *  • Auto mode is the share of top-level linked tasks that are completed.
 *    If the project also has milestones, task share and milestone share are
 *    averaged 50/50 — so adding many small tasks cannot inflate progress on
 *    its own, and milestones keep it anchored to real outcomes.
 *  • Subtasks are excluded (they roll up into their parent).
 */
export function projectProgress(p: Project, tasks: Task[]): ProgressBreakdown {
  const own = tasks.filter((t) => t.projectId === p.id && !t.deletedAt && !t.parentId);
  const taskDone = own.filter(isDone).length;
  const taskTotal = own.length;
  const milestoneDone = p.milestones.filter((m) => m.done).length;
  const milestoneTotal = p.milestones.length;
  const base = { taskDone, taskTotal, milestoneDone, milestoneTotal };

  if (p.status === 'completed') return { ...base, percent: 100, mode: 'completed', explanation: 'Project is marked completed.' };
  if (p.progressMode === 'manual')
    return { ...base, percent: clamp(p.manualProgress), mode: 'manual', explanation: 'Set manually on the project.' };

  const tShare = taskTotal ? taskDone / taskTotal : null;
  const mShare = milestoneTotal ? milestoneDone / milestoneTotal : null;
  if (tShare === null && mShare === null)
    return { ...base, percent: 0, mode: 'empty', explanation: 'No tasks or milestones yet — add some, or switch to manual progress.' };
  let percent: number;
  let explanation: string;
  if (tShare !== null && mShare !== null) {
    percent = ((tShare + mShare) / 2) * 100;
    explanation = `Average of tasks (${taskDone}/${taskTotal}) and milestones (${milestoneDone}/${milestoneTotal}).`;
  } else if (tShare !== null) {
    percent = tShare * 100;
    explanation = `${taskDone} of ${taskTotal} tasks completed.`;
  } else {
    percent = mShare! * 100;
    explanation = `${milestoneDone} of ${milestoneTotal} milestones reached.`;
  }
  return { ...base, percent: Math.round(percent), mode: 'auto', explanation };
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n || 0)));

// ---------- Content ----------

export function engagementOf(m: { likes?: number | null; comments?: number | null; shares?: number | null; saves?: number | null }) {
  return (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0);
}

/** Engagement rate = engagement ÷ reach (or impressions if reach is missing). */
export function engagementRate(engagement?: number | null, reach?: number | null, impressions?: number | null): number | null {
  const base = reach || impressions;
  if (!base || engagement === null || engagement === undefined) return null;
  return (engagement / base) * 100;
}

/**
 * Platform identity colours, mapped onto palette roles (DESIGN.md §12) so they
 * follow the theme. Returned values are CSS strings usable in `style`; charts
 * resolve them with `resolveColor` from lib/tokens.
 */
const PLATFORM_ROLES: Record<string, ColorRole> = {
  LinkedIn: 'info',
  Instagram: 'clay',
  TikTok: 'fg',
  X: 'muted',
  YouTube: 'danger',
  Newsletter: 'ochre',
  Blog: 'accent',
};

export function colorFor(key: string, i = 0): string {
  if (PLATFORM_ROLES[key]) return roleColor(PLATFORM_ROLES[key]);
  let h = i;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return roleColor(CHART_ROLES[h % CHART_ROLES.length]);
}

/** Chart series colours as CSS strings (resolve before passing to SVG attributes). */
export const SERIES = CHART_ROLES.map((r) => roleColor(r));
