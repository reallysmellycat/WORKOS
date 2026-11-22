import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { ArrowUpRight, CheckCircle2, CornerDownLeft, FolderKanban, Lightbulb, Megaphone, NotebookPen, Plus, Sparkles, TriangleAlert } from 'lucide-react';
import { db } from '@/lib/db';
import { useById, useCampaigns, useContent, useCoverage, useIdeas, useKPIEntries, useKPIs, useNotes, useProjects, useTasks } from '@/lib/hooks';
import { campaignStatusMeta, isOverdue, priorityMeta, projectProgress, projectStatusMeta, sortByScore } from '@/lib/domain';
import { create, newTask, setTaskStatus } from '@/lib/repo';
import type { Idea, Project, Task } from '@/lib/types';
import { addDaysISO, cn, compactNumber, daysUntil, excerpt, fmtDate, monthKey, relativeDay, timeAgo, todayISO } from '@/lib/utils';
import { Checkbox, Progress, Ring } from '@/components/ui';
import { Cover } from '@/components/Cover';
import { useApp } from '@/app/context';
import { completedByWeek } from '../analytics/metrics';
import { sourceColor, useCalendarItems, type CalItem } from '../calendar/calendarData';
import { ENTITY } from '@/lib/entities';
import { subMonths } from 'date-fns';
import { useChartColors } from '@/lib/tokens';

/* ------------------------------------------------------------------ */
/* Masthead with the "day line" — a signature element                  */
/* ------------------------------------------------------------------ */

const H0 = 7;
const H1 = 21;

export function Masthead({ name }: { name: string }) {
  const today = todayISO();
  const items = useCalendarItems(today, today);
  const load = useLiveQuery(async () => {
    const tasks = (await db.tasks.toArray()).filter((t) => !t.deletedAt && t.status !== 'completed' && !t.parentId);
    return {
      today: tasks.filter((t) => t.dueDate === today || t.myDay === today).length,
      overdue: tasks.filter(isOverdue).length,
    };
  }, []);
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 5 ? 'Still up' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const timed = (items ?? []).filter((i) => i.startTime && ['meeting', 'work_block', 'event', 'reminder', 'content'].includes(i.source));
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const busyMin = timed.reduce((s, i) => s + Math.max(30, (i.endTime ? toMin(i.endTime) : toMin(i.startTime!) + 30) - toMin(i.startTime!)), 0);
  const score = busyMin / 60 + (load?.today ?? 0) * 0.6 + (load?.overdue ?? 0) * 0.3;
  const level = score < 1.5 ? 0 : score < 3.5 ? 1 : score < 6 ? 2 : score < 8.5 ? 3 : 4;
  const LEVELS = ['Open day', 'Light day', 'Steady day', 'Full day', 'Overbooked'];
  const nowPct = ((hour * 60 + now.getMinutes() - H0 * 60) / ((H1 - H0) * 60)) * 100;

  const parts: string[] = [];
  if (load) {
    if (load.today) parts.push(`${load.today} task${load.today > 1 ? 's' : ''} on today's list`);
    const meetings = timed.filter((t) => t.source === 'meeting').length;
    if (meetings) parts.push(`${meetings} meeting${meetings > 1 ? 's' : ''}`);
    if (load.overdue) parts.push(`${load.overdue} overdue`);
  }
  const sentence = load ? (parts.length ? `${parts.join(', ').replace(/, ([^,]*)$/, ' and $1')}.` : 'Nothing scheduled — room for deep work.') : '';

  return (
    <header className="relative mb-10 grid gap-8 border-b border-line pb-9 lg:grid-cols-[1.25fr_1fr] lg:items-end animate-in">
      <div>
        <div className="eyebrow mb-5 flex flex-wrap gap-x-3">
          <span>{format(now, 'EEEE')}</span>
          <span className="text-line-strong">/</span>
          <span>{format(now, 'd MMMM yyyy')}</span>
          <span className="text-line-strong">/</span>
          <span>Week {format(now, 'II')}</span>
        </div>
        <h1 className="display text-display-xl sm:text-display-xl">
          {greeting}
          {name ? (
            <>
              ,<br className="hidden sm:block" /> <em className="text-accent-deep">{name}</em>.
            </>
          ) : (
            '.'
          )}
        </h1>
        <p className="mt-4 max-w-md text-body-l leading-relaxed text-muted">{sentence}</p>
      </div>

      <div className="lg:pb-2">
        <div className="mb-2.5 flex items-baseline justify-between">
          <span className="eyebrow">The day line</span>
          <span className="flex items-center gap-2">
            <span className="flex gap-[3px]" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={cn('h-2.5 w-[5px] rounded-xs transition-colors', i < level ? (level >= 4 ? 'bg-clay' : 'bg-fg') : 'bg-line-strong/60')} />
              ))}
            </span>
            <span className="meta text-caption text-muted">{LEVELS[level]}</span>
          </span>
        </div>
        <div className="relative h-[54px] rounded-md bg-raised/45 shadow-[inset_0_0_0_1px_rgb(var(--edge)/var(--edge-alpha)),var(--shadow-xs)]">
          {Array.from({ length: H1 - H0 + 1 }, (_, i) => (
            <span key={i} className="absolute bottom-0 top-0 w-px bg-line/50" style={{ left: `${(i / (H1 - H0)) * 100}%` }} />
          ))}
          {timed.map((t) => {
            const s = Math.max(toMin(t.startTime!), H0 * 60);
            const e = Math.min(t.endTime ? toMin(t.endTime) : s + 30, H1 * 60);
            if (e <= H0 * 60 || s >= H1 * 60) return null;
            return (
              <Link
                key={t.key}
                to={t.open.type === 'event' ? `/calendar?event=${t.open.id}` : ENTITY[t.open.type].route(t.open.id)}
                title={`${t.startTime} ${t.title}`}
                className="absolute top-[7px] bottom-[7px] origin-left overflow-hidden rounded-xs px-1.5 py-1 text-micro leading-tight text-white/95 transition hover:brightness-110 animate-grow"
                style={{ left: `${((s - H0 * 60) / ((H1 - H0) * 60)) * 100}%`, width: `${Math.max(1.8, ((e - s) / ((H1 - H0) * 60)) * 100)}%`, background: sourceColor(t.source) }}
              >
                <span className="hidden truncate sm:block">{t.title}</span>
              </Link>
            );
          })}
          {nowPct >= 0 && nowPct <= 100 && (
            <span className="absolute -bottom-1 -top-1 w-[2px] rounded-full bg-clay" style={{ left: `${nowPct}%` }}>
              <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-clay" />
            </span>
          )}
        </div>
        <div className="meta mt-1.5 flex justify-between text-micro text-faint">
          {[7, 9, 11, 13, 15, 17, 19, 21].map((h) => (
            <span key={h}>{String(h).padStart(2, '0')}</span>
          ))}
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Section frame                                                        */
/* ------------------------------------------------------------------ */

/** A home region: a translucent floating workspace panel (DESIGN.md §7). `open` renders without a panel. */
export function HomeBlock({ eyebrow, title, href, action, children, className, open }: { eyebrow: string; title?: ReactNode; href?: string; action?: ReactNode; children: ReactNode; className?: string; open?: boolean }) {
  return (
    <section className={cn('min-w-0 animate-in', !open && 'workspace h-full p-6 sm:p-7', className)}>
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <div className="eyebrow mb-1.5">{eyebrow}</div>
          {title && <h2 className="display text-h2">{title}</h2>}
        </div>
        <div className="flex items-center gap-2">
          {action}
          {href && (
            <Link to={href} className="group flex items-center gap-1 text-body-s font-semibold text-muted transition-colors duration-fast hover:text-fg">
              View all <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Today's focus — dark ink panel                                       */
/* ------------------------------------------------------------------ */

function useCompleting() {
  const [done, setDone] = useState<Set<string>>(new Set());
  const complete = (t: Task) => {
    setDone((s) => new Set(s).add(t.id));
    setTimeout(() => void setTaskStatus(t, 'completed'), 650);
  };
  return { done, complete };
}

export function Focus() {
  const tasks = useTasks();
  const projects = useProjects();
  const pm = useById(projects);
  const { openTask } = useApp();
  const { done, complete } = useCompleting();
  const [text, setText] = useState('');
  const [showOverdue, setShowOverdue] = useState(false);
  const today = todayISO();

  const data = useMemo(() => {
    if (!tasks) return null;
    const open = tasks.filter((t) => t.status !== 'completed' && !t.parentId);
    const candidates = sortByScore(open.filter((t) => t.myDay === today || (t.dueDate && t.dueDate <= addDaysISO(today, 2)) || t.priority === 'urgent' || t.status === 'in_progress'));
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const completedToday = tasks.filter((t) => t.completedAt && t.completedAt >= start.getTime()).length;
    return { primary: candidates[0], next: candidates.slice(1, 4), rest: candidates.slice(4), overdue: open.filter(isOverdue), completedToday };
  }, [tasks, today]);

  if (!data) return <div className="skeleton h-[380px] !rounded-xl" />;
  const total = data.completedToday + 1 + data.next.length + data.rest.length;
  const p = data.primary;

  return (
    <section className="ink-panel grain relative overflow-hidden p-6 sm:p-8 animate-in">
      <div className="mb-6 flex items-center justify-between">
        <span className="eyebrow !text-ink-muted">Today's focus</span>
        <span className="meta text-caption text-ink-muted">
          {data.completedToday} done{p ? ` · ${total - data.completedToday} to go` : ''}
        </span>
      </div>

      {p ? (
        <div className={cn('transition-all duration-500', done.has(p.id) && 'opacity-40')}>
          <div className="eyebrow mb-3 !text-ink-muted">The one thing</div>
          <div className="flex items-start gap-4">
            <Checkbox size="lg" checked={done.has(p.id)} onChange={() => complete(p)} className="mt-2 !shadow-[inset_0_0_0_1.5px_rgb(var(--ink-muted))]" />
            <button onClick={() => openTask(p.id)} className="min-w-0 text-left">
              <h3 className="display relative inline text-h1 leading-[1.1] sm:text-display-l">
                {p.title}
                {done.has(p.id) && <span className="absolute left-0 right-0 top-1/2 h-[2px] origin-left bg-ink-fg animate-strike" />}
              </h3>
              <div className="meta mt-3 flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-muted">
                <span className={cn(p.priority === 'urgent' && 'text-ink-alert')}>{priorityMeta(p.priority).label} priority</span>
                {p.dueDate && <span className={cn(isOverdue(p) && 'text-ink-alert')}>{relativeDay(p.dueDate)}</span>}
                {p.projectId && pm.get(p.projectId) && <span>↳ {pm.get(p.projectId)!.title}</span>}
              </div>
            </button>
          </div>
        </div>
      ) : (
        <div>
          <h3 className="display text-h1 leading-tight">A clear runway.</h3>
          <p className="mt-2 max-w-sm text-body-m text-ink-muted">Nothing urgent is waiting. What's the one thing that would make today worthwhile?</p>
        </div>
      )}

      {data.next.length > 0 && (
        <div className="mt-8">
          <div className="eyebrow mb-2 !text-ink-muted">Then</div>
          <div className="divide-y divide-ink-muted/15">
            {data.next.map((t, i) => (
              <div key={t.id} className={cn('group flex items-center gap-3 py-2.5 transition-all duration-500', done.has(t.id) && 'opacity-30')}>
                <span className="meta w-5 text-micro text-ink-muted">{String(i + 2).padStart(2, '0')}</span>
                <Checkbox checked={done.has(t.id)} onChange={() => complete(t)} className="!shadow-[inset_0_0_0_1.5px_rgb(var(--ink-muted))]" />
                <button onClick={() => openTask(t.id)} className="relative min-w-0 flex-1 truncate text-left text-body-m">
                  {t.title}
                  {done.has(t.id) && <span className="absolute left-0 right-0 top-1/2 h-px origin-left bg-ink-fg animate-strike" />}
                </button>
                {t.dueDate && <span className={cn('meta text-caption', isOverdue(t) ? 'text-ink-alert' : 'text-ink-muted')}>{relativeDay(t.dueDate)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          await newTask({ title: text.trim(), myDay: today });
          setText('');
        }}
        className="mt-6 flex items-center gap-3 rounded-lg bg-ink-fg/[0.06] px-3.5 py-2.5"
      >
        <Plus className="h-4 w-4 text-ink-muted" />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add to today…" className="flex-1 bg-transparent text-body-m outline-none placeholder:text-ink-muted" />
        {text && <CornerDownLeft className="h-3.5 w-3.5 text-ink-muted" />}
      </form>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-body-s">
        {data.rest.length > 0 && (
          <Link to="/my-day" className="text-ink-muted hover:text-ink-fg">
            +{data.rest.length} more on today's list →
          </Link>
        )}
        {data.overdue.length > 0 && (
          <button onClick={() => setShowOverdue((s) => !s)} className="flex items-center gap-1.5 text-ink-alert hover:opacity-80">
            <TriangleAlert className="h-3.5 w-3.5" /> {data.overdue.length} overdue
          </button>
        )}
      </div>
      {showOverdue && (
        <div className="mt-3 space-y-1 animate-in">
          {data.overdue.slice(0, 6).map((t) => (
            <button key={t.id} onClick={() => openTask(t.id)} className="flex w-full items-center gap-3 rounded-sm px-2 py-1.5 text-left text-body-s hover:bg-ink-fg/5">
              <span className="meta w-16 text-micro text-ink-alert">{relativeDay(t.dueDate)}</span>
              <span className="truncate">{t.title}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Schedule — editorial timeline                                        */
/* ------------------------------------------------------------------ */

export function Schedule() {
  const today = todayISO();
  const items = useCalendarItems(today, addDaysISO(today, 6));
  const { openEntity, openEvent } = useApp();
  const days = useMemo(() => {
    const m = new Map<string, CalItem[]>();
    for (const i of items ?? []) {
      if (i.done || i.source === 'task') continue;
      (m.get(i.date) ?? m.set(i.date, []).get(i.date)!).push(i);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, 4);
  }, [items]);

  return (
    <HomeBlock eyebrow="Schedule" title="The week ahead" href="/calendar" action={<button onClick={() => openEvent(null, today)} className="text-body-s text-muted hover:text-fg">+ Event</button>}>
      {!items ? (
        <div className="skeleton h-64" />
      ) : days.length === 0 ? (
        <p className="border-l border-line py-6 pl-5 text-body-m text-muted">Nothing on the calendar this week. Block time for the work that matters.</p>
      ) : (
        <div className="relative">
          <span className="absolute bottom-2 left-[62px] top-2 w-px bg-line" />
          {days.map(([date, list]) => (
            <div key={date} className="mb-5 last:mb-0">
              <div className="mb-2 flex items-baseline gap-3">
                <span className="meta w-[52px] text-right text-micro uppercase text-faint">{fmtDate(date, 'EEE d')}</span>
                <span className={cn('display pl-4 text-h4', date === today && 'text-accent-deep')}>{relativeDay(date)}</span>
              </div>
              {list.slice(0, 5).map((i) => (
                <button key={i.key} onClick={() => openEntity(i.open.type, i.open.id)} className="group relative flex w-full items-start gap-3 rounded-md py-1.5 pr-2 text-left hover:bg-sunken/60">
                  <span className="meta w-[52px] shrink-0 pt-[1px] text-right text-caption text-muted">{i.startTime ?? '—'}</span>
                  <span className="relative z-10 mt-[5px] h-[9px] w-[9px] shrink-0 rounded-full ring-[3px] ring-bg" style={{ background: sourceColor(i.source) }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-m group-hover:text-fg">{i.title}</span>
                    {i.sub && <span className="block truncate text-caption text-faint">{i.sub}</span>}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </HomeBlock>
  );
}

/* ------------------------------------------------------------------ */
/* Projects — bodies of work                                            */
/* ------------------------------------------------------------------ */

function nextMilestone(p: Project) {
  return [...p.milestones].filter((m) => !m.done).sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'))[0];
}

export function ProjectsShowcase() {
  const projects = useProjects();
  const tasks = useTasks();
  const { quickAdd } = useApp();
  const lastTouch = useLiveQuery(async () => {
    const m = new Map<string, number>();
    for (const a of await db.activity.orderBy('at').reverse().limit(400).toArray()) if (!m.has(a.entityId)) m.set(a.entityId, a.at);
    return m;
  }, []);
  if (!projects || !tasks) return <div className="skeleton h-80" />;
  const active = projects
    .filter((p) => p.status === 'in_progress' || p.status === 'planning' || p.status === 'on_hold')
    .sort((a, b) => (a.status === 'in_progress' ? 0 : 1) - (b.status === 'in_progress' ? 0 : 1) || (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'));
  const [feat, ...rest] = active;

  return (
    <HomeBlock eyebrow="Bodies of work" title="Active projects" href="/projects">
      {!feat ? (
        <button onClick={() => quickAdd({ type: 'project' })} className="flex w-full items-center gap-5 rounded-xl border border-dashed border-line-strong p-8 text-left hover:border-fg/40">
          <FolderKanban className="h-6 w-6 text-faint" />
          <span>
            <span className="display block text-h3">Start your first project</span>
            <span className="text-body-s text-muted">From a template — PR campaign, event, content series — or a blank page.</span>
          </span>
        </button>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <ProjectFeature p={feat} tasks={tasks} touched={lastTouch?.get(feat.id)} />
          <div className="flex flex-col">
            {rest.slice(0, 5).map((p, i) => {
              const prog = projectProgress(p, tasks);
              const ms = nextMilestone(p);
              return (
                <Link key={p.id} to={`/projects/${p.id}`} className={cn('group flex items-center gap-4 py-3.5', i > 0 && 'border-t border-line')}>
                  <Cover seed={p.id} color={p.color} className="h-14 w-14 shrink-0 transition-transform duration-300 group-hover:scale-[1.04]" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-body-l font-medium group-hover:text-accent-deep">{p.title}</div>
                    <div className="meta mt-0.5 truncate text-caption text-faint">
                      {projectStatusMeta(p.status).label}
                      {ms ? ` · next: ${ms.title}${ms.date ? ` (${fmtDate(ms.date)})` : ''}` : p.deadline ? ` · due ${fmtDate(p.deadline)}` : ''}
                    </div>
                  </div>
                  <Ring value={prog.percent} size={38} stroke={2.5} />
                </Link>
              );
            })}
            {rest.length === 0 && <p className="py-4 text-body-s text-faint">Just one active project — focus is a feature.</p>}
            {rest.length > 5 && (
              <Link to="/projects" className="meta mt-2 text-caption text-muted hover:text-fg">
                +{rest.length - 5} more projects
              </Link>
            )}
          </div>
        </div>
      )}
    </HomeBlock>
  );
}

function ProjectFeature({ p, tasks, touched }: { p: Project; tasks: Task[]; touched?: number }) {
  const prog = projectProgress(p, tasks);
  const ms = nextMilestone(p);
  const open = tasks.filter((t) => t.projectId === p.id && t.status !== 'completed' && !t.parentId).length;
  const d = daysUntil(p.deadline);
  return (
    <Link to={`/projects/${p.id}`} className="group block">
      <Cover seed={p.id} color={p.color} className="aspect-[16/8] w-full !rounded-xl transition-transform duration-500 ease-out group-hover:scale-[1.01]" />
      <div className="mt-5 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="eyebrow mb-2">{projectStatusMeta(p.status).label}{p.deadline ? ` · ${d !== null && d < 0 ? 'overdue' : `${d} days left`}` : ''}</div>
          <h3 className="display text-h1 leading-[1.05] group-hover:text-accent-deep">{p.title}</h3>
          {(p.description || p.objectives) && <p className="mt-2 line-clamp-2 max-w-lg text-body-m text-muted">{p.description || excerpt(p.objectives ?? '', 140)}</p>}
        </div>
        <div className="shrink-0 text-right">
          <div className="num text-display-l">
            {prog.percent}
            <span className="text-h3 text-faint">%</span>
          </div>
        </div>
      </div>
      <Progress value={prog.percent} tone="ink" className="mt-4" />
      <div className="meta mt-3 grid grid-cols-3 gap-4 text-caption text-muted">
        <span>
          <span className="block text-faint">Next milestone</span>
          <span className="text-fg">{ms ? ms.title : '—'}</span>
        </span>
        <span>
          <span className="block text-faint">Open tasks</span>
          <span className="text-fg">{open}</span>
        </span>
        <span>
          <span className="block text-faint">Last activity</span>
          <span className="text-fg">{touched ? timeAgo(touched) : timeAgo(p.updatedAt)}</span>
        </span>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Activity — field notes                                               */
/* ------------------------------------------------------------------ */

const VERB: Record<string, string> = { created: 'Created', updated: 'Edited', completed: 'Completed', deleted: 'Deleted', restored: 'Restored', converted: 'Converted', status: 'Moved' };

export function ActivityStream() {
  const { openEntity } = useApp();
  const feed = useLiveQuery(async () => {
    const acts = (await db.activity.orderBy('at').reverse().limit(60).toArray()).filter((a) => a.action !== 'deleted');
    const since = addDaysISO(todayISO(), -14);
    const published = (await db.content.toArray()).filter((c) => !c.deletedAt && c.status === 'published' && c.publishDate && c.publishDate >= since && c.publishDate <= todayISO());
    const coverage = (await db.coverage.toArray()).filter((c) => !c.deletedAt && c.date && c.date >= since && c.date <= todayISO());
    const items = [
      ...acts.map((a) => ({ key: `a${a.id}`, at: a.at, verb: VERB[a.action], kind: ENTITY[a.entity].label, title: a.title, open: () => openEntity(a.entity, a.entityId), tone: a.action === 'completed' ? 'ok' : 'none' })),
      ...published.map((c) => ({ key: `p${c.id}`, at: new Date(c.publishDate + 'T12:00').getTime(), verb: 'Published', kind: c.platform, title: c.title, open: () => openEntity('content', c.id), tone: 'accent' })),
      ...coverage.map((c) => ({ key: `c${c.id}`, at: new Date(c.date + 'T12:00').getTime(), verb: 'Coverage', kind: c.outlet, title: c.headline, open: () => (c.campaignId ? openEntity('campaign', c.campaignId) : undefined), tone: 'clay' })),
    ]
      .sort((a, b) => b.at - a.at)
      .slice(0, 14);
    const groups = new Map<string, typeof items>();
    for (const i of items) {
      const d = format(i.at, 'yyyy-MM-dd');
      (groups.get(d) ?? groups.set(d, []).get(d)!).push(i);
    }
    return [...groups.entries()];
  }, []);

  return (
    <HomeBlock eyebrow="Field notes" title="Recent activity">
      {!feed ? (
        <div className="skeleton h-64" />
      ) : feed.length === 0 ? (
        <p className="text-body-m text-muted">Your work history will appear here as you go.</p>
      ) : (
        <div className="space-y-5">
          {feed.map(([date, list]) => (
            <div key={date}>
              <div className="eyebrow mb-2">{relativeDay(date)}</div>
              <ol>
                {list.map((i) => (
                  <li key={i.key}>
                    <button onClick={i.open} className="group grid w-full grid-cols-[86px_1fr_auto] items-baseline gap-3 border-t border-line/70 py-2 text-left">
                      <span className={cn('meta text-micro uppercase tracking-wide', i.tone === 'ok' ? 'text-ok' : i.tone === 'accent' ? 'text-accent-deep' : i.tone === 'clay' ? 'text-clay' : 'text-faint')}>{i.verb}</span>
                      <span className="min-w-0 truncate text-body-m group-hover:text-accent-deep">
                        {i.title} <span className="text-caption text-faint">· {i.kind}</span>
                      </span>
                      <span className="meta text-micro text-faint">{format(i.at, 'HH:mm')}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </HomeBlock>
  );
}

/* ------------------------------------------------------------------ */
/* Performance — momentum                                               */
/* ------------------------------------------------------------------ */

export function Momentum() {
  const tasks = useTasks();
  const content = useContent();
  const coverage = useCoverage();
  const kpis = useKPIs();
  const entries = useKPIEntries();
  const weeks = useMemo(() => (tasks ? completedByWeek(tasks, 12) : []), [tasks]);
  const chart = useChartColors();
  if (!tasks || !content || !coverage || !kpis || !entries) return <div className="skeleton h-80" />;
  const thisM = monthKey(new Date());
  const lastM = monthKey(subMonths(new Date(), 1));
  const doneIn = (m: string) => tasks.filter((t) => t.completedAt && monthKey(new Date(t.completedAt)) === m).length;
  const cur = doneIn(thisM);
  const prev = doneIn(lastM);
  const diff = cur - prev;
  const reach30 = content.filter((c) => c.status === 'published' && (daysUntil(c.publishDate) ?? -99) >= -30).reduce((s, c) => s + (c.metrics.reach ?? 0), 0);
  const covM = coverage.filter((c) => c.date?.startsWith(thisM)).length;
  const kpi = kpis
    .map((k) => {
      const list = entries.filter((e) => e.kpiId === k.id).sort((a, b) => a.date.localeCompare(b.date));
      const v = list[list.length - 1]?.value;
      return { k, v, pct: k.target && v !== undefined ? (v / k.target) * 100 : null };
    })
    .filter((x) => x.pct !== null)
    .slice(0, 2);

  return (
    <HomeBlock eyebrow="Momentum" href="/analytics">
      <p className="display text-h2 leading-[1.15]">
        <span className="num text-h1 align-[-2px]">{cur}</span> tasks done this month
        {prev > 0 || cur > 0 ? (
          <span className="text-muted">
            {' '}
            — {diff === 0 ? 'level with' : `${Math.abs(diff)} ${diff > 0 ? 'more than' : 'fewer than'}`} {format(subMonths(new Date(), 1), 'MMMM')}.
          </span>
        ) : (
          '.'
        )}
      </p>
      <div className="-mx-1 mt-4 h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={weeks} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="mom" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chart.series[0]} stopOpacity={0.32} />
                <stop offset="100%" stopColor={chart.series[0]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" hide />
            <Tooltip cursor={{ stroke: chart.grid }} contentStyle={{ background: 'rgb(var(--raised))', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-caption)', boxShadow: 'var(--shadow-lg)' }} labelFormatter={(l) => `Week of ${l}`} />
            <Area type="monotone" dataKey="completed" name="Completed" stroke={chart.resolve('rgb(var(--accent-deep))')} strokeWidth={1.8} fill="url(#mom)" dot={false} activeDot={{ r: 3.5 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="meta flex justify-between text-micro text-faint">
        <span>12 weeks ago</span>
        <span>This week</span>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-6 border-t border-line pt-5">
        <div>
          <div className="eyebrow">Content reach · 30d</div>
          <div className="num mt-2 text-h1">{compactNumber(reach30)}</div>
        </div>
        <div>
          <div className="eyebrow">Coverage · this month</div>
          <div className="num mt-2 text-h1">{covM}</div>
        </div>
      </div>
      {kpi.length > 0 && (
        <div className="mt-5 space-y-3 border-t border-line pt-5">
          {kpi.map(({ k, v, pct }) => (
            <Link key={k.id} to={`/analytics?kpi=${k.id}`} className="block">
              <div className="mb-1.5 flex justify-between text-body-s">
                <span className="text-muted">{k.name}</span>
                <span className="meta text-caption">
                  {v} <span className="text-faint">/ {k.target}</span>
                </span>
              </div>
              <Progress value={pct!} tone={pct! >= 100 ? 'ok' : 'ink'} />
            </Link>
          ))}
        </div>
      )}
    </HomeBlock>
  );
}

/* ------------------------------------------------------------------ */
/* Ideas — index cards                                                  */
/* ------------------------------------------------------------------ */

export function IdeaCards() {
  const ideas = useIdeas();
  const [text, setText] = useState('');
  const inbox = (ideas ?? []).filter((i) => i.status === 'inbox').sort((a, b) => b.createdAt - a.createdAt);
  return (
    <HomeBlock eyebrow="Ideas inbox" title="Loose thoughts" href="/ideas" open>
      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-3 pt-1">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!text.trim()) return;
            await create<Idea>('ideas', { text: text.trim(), status: 'inbox', tags: [] });
            setText('');
          }}
          className="flex h-[150px] w-[220px] shrink-0 snap-start flex-col rounded-lg border border-dashed border-line-strong p-4"
        >
          <Lightbulb className="h-4 w-4 text-ochre" />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Capture a thought…"
            className="mt-2 flex-1 resize-none bg-transparent font-serif text-h4 leading-snug outline-none placeholder:text-faint"
          />
        </form>
        {inbox.slice(0, 10).map((i, n) => (
          <Link
            key={i.id}
            to="/ideas"
            className="flex h-[150px] w-[220px] shrink-0 snap-start flex-col justify-between rounded-lg bg-raised p-4 shadow-md ring-1 ring-line/70 transition-transform duration-300 hover:-translate-y-1 hover:rotate-0"
            style={{ transform: `rotate(${[-0.8, 0.6, -0.4, 0.9, -0.6][n % 5]}deg)` }}
          >
            <p className="line-clamp-4 font-serif text-h4 leading-snug">{i.text}</p>
            <span className="meta text-micro text-faint">{timeAgo(i.createdAt)}</span>
          </Link>
        ))}
        {inbox.length === 0 && <p className="self-center px-4 text-body-s text-faint">Inbox zero. Ideas you capture land here, uncategorised.</p>}
      </div>
    </HomeBlock>
  );
}

/* ------------------------------------------------------------------ */
/* Campaigns — timeline bars                                            */
/* ------------------------------------------------------------------ */

export function CampaignTimeline() {
  const campaigns = useCampaigns();
  const coverage = useCoverage();
  if (!campaigns || !coverage) return <div className="skeleton h-48" />;
  const active = campaigns.filter((c) => c.status !== 'completed' && c.status !== 'archived' && c.startDate).slice(0, 5);
  const today = todayISO();
  const from = addDaysISO(today, -30);
  const to = addDaysISO(today, 45);
  const span = 75;
  const pos = (d: string) => Math.max(0, Math.min(100, ((new Date(d).getTime() - new Date(from).getTime()) / 86400000 / span) * 100));
  return (
    <HomeBlock eyebrow="Communications" title="Campaigns in flight" href="/campaigns">
      {active.length === 0 ? (
        <p className="text-body-m text-muted">No live campaigns.</p>
      ) : (
        <div className="relative">
          <span className="absolute bottom-0 top-0 z-10 w-px bg-clay" style={{ left: `calc(140px + (100% - 140px) * ${pos(today) / 100})` }} />
          {active.map((c) => {
            const s = pos(c.startDate!);
            const e = pos(c.endDate ?? addDaysISO(c.startDate!, 30));
            const cov = coverage.filter((x) => x.campaignId === c.id).length;
            return (
              <Link key={c.id} to={`/campaigns/${c.id}`} className="group grid grid-cols-[140px_1fr] items-center gap-0 border-t border-line/70 py-2.5">
                <span className="min-w-0 pr-3">
                  <span className="block truncate text-body-s group-hover:text-accent-deep">{c.name}</span>
                  <span className="meta text-micro text-faint">
                    {campaignStatusMeta(c.status).label} · {cov} cov.
                  </span>
                </span>
                <span className="relative h-5">
                  <span className="absolute top-1/2 h-[6px] -translate-y-1/2 origin-left rounded-full bg-fg/80 animate-grow" style={{ left: `${s}%`, width: `${Math.max(2, e - s)}%` }} />
                </span>
              </Link>
            );
          })}
          <div className="meta grid grid-cols-[140px_1fr] pt-1 text-micro text-faint">
            <span />
            <span className="flex justify-between">
              <span>{fmtDate(from)}</span>
              <span>{fmtDate(to)}</span>
            </span>
          </div>
        </div>
      )}
    </HomeBlock>
  );
}

/* ------------------------------------------------------------------ */
/* Notes — editorial list                                               */
/* ------------------------------------------------------------------ */

export function NotesList() {
  const notes = useNotes();
  const list = [...(notes ?? [])].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4);
  return (
    <HomeBlock eyebrow="From the archive" title="Recent notes" href="/notes">
      {list.length === 0 ? (
        <p className="text-body-m text-muted">Notes you write will appear here.</p>
      ) : (
        <div>
          {list.map((n) => (
            <Link key={n.id} to={`/notes/${n.id}`} className="group border-t border-line py-3.5">
              <div className="meta mb-1 text-micro uppercase text-faint">
                {n.category ?? n.kind} · {timeAgo(n.updatedAt)}
              </div>
              <div className="display text-h4 leading-snug group-hover:text-accent-deep">{n.title || 'Untitled'}</div>
              <p className="mt-1 line-clamp-2 text-body-s text-muted">{excerpt(n.body, 120) || 'Empty note'}</p>
            </Link>
          ))}
        </div>
      )}
    </HomeBlock>
  );
}

export const SECTION_META: Record<string, { label: string; icon: typeof Sparkles; span: string }> = {
  focus: { label: "Today's focus", icon: CheckCircle2, span: 'lg:col-span-7' },
  schedule: { label: 'Schedule', icon: Sparkles, span: 'lg:col-span-5' },
  projects: { label: 'Active projects', icon: FolderKanban, span: 'lg:col-span-12' },
  activity: { label: 'Recent activity', icon: Sparkles, span: 'lg:col-span-7' },
  performance: { label: 'Momentum', icon: Sparkles, span: 'lg:col-span-5' },
  ideas: { label: 'Ideas inbox', icon: Lightbulb, span: 'lg:col-span-12' },
  campaigns: { label: 'Campaigns', icon: Megaphone, span: 'lg:col-span-7' },
  notes: { label: 'Recent notes', icon: NotebookPen, span: 'lg:col-span-5' },
};
