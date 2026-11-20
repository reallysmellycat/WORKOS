import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Activity as ActivityIcon,
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  FolderKanban,
  Gauge,
  Lightbulb,
  ListTodo,
  Megaphone,
  NotebookPen,
  Plus,
  Sparkles,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { db } from '@/lib/db';
import {
  useById,
  useCampaigns,
  useContent,
  useCoverage,
  useIdeas,
  useKPIEntries,
  useKPIs,
  useNotes,
  useProjects,
  useSocial,
  useTasks,
} from '@/lib/hooks';
import type { WidgetType } from '@/lib/settings';
import { campaignStatusMeta, contentStatusMeta, isBlocked, isOverdue, projectProgress, sortByScore } from '@/lib/domain';
import { create } from '@/lib/repo';
import type { Idea } from '@/lib/types';
import { compactNumber, daysUntil, excerpt, fmtDate, relativeDay, timeAgo, todayISO, addDaysISO } from '@/lib/utils';
import { Badge, Empty, Progress, Ring } from '@/components/ui';
import { ActivityFeed } from '@/components/ActivityFeed';
import { Bars, Sparkline } from '@/components/charts';
import { useApp } from '@/app/context';
import { TaskRow } from '../tasks/TaskRow';
import { completedByWeek, contentTotals, isThisMonth, socialSummary } from '../analytics/metrics';
import { sourceColor, useCalendarItems } from '../calendar/calendarData';

export interface WidgetDef {
  title: string;
  icon: LucideIcon;
  description: string;
  href?: string;
  render: () => ReactNode;
}

const Muted = ({ children }: { children: ReactNode }) => <p className="py-3 text-[13px] text-faint">{children}</p>;

function Priorities() {
  const tasks = useTasks();
  const projects = useProjects();
  const pm = useById(projects);
  const tm = useById(tasks);
  if (!tasks) return null;
  const today = todayISO();
  const open = tasks.filter((t) => t.status !== 'completed' && !t.parentId);
  const list = sortByScore(open.filter((t) => t.myDay === today || (t.dueDate && t.dueDate <= addDaysISO(today, 2)) || t.priority === 'urgent' || t.status === 'in_progress')).slice(0, 7);
  if (!list.length) return <Empty icon={CheckCircle2} title="Nothing pressing" compact>No urgent, in-progress or due-soon tasks. Plan your day in My Day.</Empty>;
  return (
    <div className="-mx-2">
      {list.map((t) => (
        <TaskRow key={t.id} task={t} project={t.projectId ? pm.get(t.projectId) : null} blocked={isBlocked(t, tm)} compact />
      ))}
    </div>
  );
}

function Deadlines() {
  const tasks = useTasks();
  const projects = useProjects();
  const { openEntity } = useApp();
  if (!tasks || !projects) return null;
  const items = [
    ...tasks.filter((t) => t.status !== 'completed' && t.dueDate && (daysUntil(t.dueDate) ?? -1) >= 0 && (daysUntil(t.dueDate) ?? 99) <= 14).map((t) => ({ id: t.id, type: 'task' as const, title: t.title, date: t.dueDate!, kind: 'Task' })),
    ...projects.filter((p) => p.status !== 'completed' && p.deadline && (daysUntil(p.deadline) ?? -1) >= 0 && (daysUntil(p.deadline) ?? 99) <= 30).map((p) => ({ id: p.id, type: 'project' as const, title: p.title, date: p.deadline!, kind: 'Project' })),
    ...projects.flatMap((p) => p.milestones.filter((m) => !m.done && m.date && (daysUntil(m.date) ?? -1) >= 0 && (daysUntil(m.date) ?? 99) <= 14).map((m) => ({ id: p.id, type: 'project' as const, title: m.title, date: m.date!, kind: 'Milestone' }))),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 7);
  if (!items.length) return <Muted>No deadlines in the next two weeks.</Muted>;
  return (
    <div className="-mx-1.5">
      {items.map((i, n) => (
        <button key={n} onClick={() => openEntity(i.type, i.id)} className="flex w-full items-center gap-3 rounded-md px-1.5 py-1.5 text-left row-hover">
          <div className="w-11 shrink-0 text-center">
            <div className="text-2xs uppercase text-faint">{fmtDate(i.date, 'MMM')}</div>
            <div className="text-[15px] font-semibold leading-none tabular-nums">{fmtDate(i.date, 'd')}</div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px]">{i.title}</div>
            <div className="text-xs text-faint">
              {i.kind} · {relativeDay(i.date)}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function Overdue() {
  const tasks = useTasks();
  const projects = useProjects();
  const pm = useById(projects);
  if (!tasks) return null;
  const list = tasks.filter((t) => isOverdue(t) && !t.parentId).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  if (!list.length) return <Empty icon={CheckCircle2} title="Nothing overdue" compact />;
  return (
    <div className="-mx-2">
      {list.slice(0, 6).map((t) => (
        <TaskRow key={t.id} task={t} project={t.projectId ? pm.get(t.projectId) : null} compact />
      ))}
      {list.length > 6 && (
        <Link to="/tasks?view=overdue" className="block px-2 pt-1 text-xs text-muted hover:text-accent">
          +{list.length - 6} more overdue
        </Link>
      )}
    </div>
  );
}

function ActiveProjects({ detailed }: { detailed?: boolean }) {
  const projects = useProjects();
  const tasks = useTasks();
  if (!projects || !tasks) return null;
  const list = projects.filter((p) => p.status === 'in_progress' || p.status === 'planning').sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999')).slice(0, detailed ? 8 : 5);
  if (!list.length) return <Empty icon={FolderKanban} title="No active projects" compact />;
  return (
    <div className="space-y-1">
      {list.map((p) => {
        const prog = projectProgress(p, tasks);
        return (
          <Link key={p.id} to={`/projects/${p.id}`} className="-mx-1.5 flex items-center gap-3 rounded-md px-1.5 py-1.5 row-hover">
            {detailed ? <Ring value={prog.percent} size={32} /> : null}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-medium">{p.title}</span>
                {!detailed && <span className="text-xs tabular-nums text-muted">{prog.percent}%</span>}
              </div>
              {detailed ? (
                <div className="truncate text-xs text-faint">{prog.explanation}</div>
              ) : (
                <Progress value={prog.percent} className="mt-1.5" />
              )}
            </div>
            {p.deadline && <span className="shrink-0 text-xs text-faint">{relativeDay(p.deadline)}</span>}
          </Link>
        );
      })}
    </div>
  );
}

function Events() {
  const today = todayISO();
  const items = useCalendarItems(today, addDaysISO(today, 6));
  const { openEntity } = useApp();
  if (!items) return null;
  const list = items.filter((i) => ['meeting', 'work_block', 'reminder', 'event', 'deadline', 'content', 'milestone', 'release'].includes(i.source) && !i.done).sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? '')).slice(0, 7);
  if (!list.length) return <Muted>Nothing scheduled this week.</Muted>;
  let last = '';
  return (
    <div>
      {list.map((i) => {
        const head = i.date !== last ? relativeDay(i.date) : null;
        last = i.date;
        return (
          <div key={i.key}>
            {head && <div className="pb-1 pt-2 first:pt-0 section-title">{head}</div>}
            <button onClick={() => openEntity(i.open.type, i.open.id)} className="-mx-1.5 flex w-full items-center gap-2.5 rounded-md px-1.5 py-1 text-left row-hover">
              <span className="h-6 w-[3px] shrink-0 rounded-full" style={{ background: sourceColor(i.source) }} />
              <span className="w-11 shrink-0 text-xs tabular-nums text-faint">{i.startTime ?? 'All day'}</span>
              <span className="truncate text-[13px]">{i.title}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function Campaigns() {
  const campaigns = useCampaigns();
  const coverage = useCoverage();
  if (!campaigns || !coverage) return null;
  const active = campaigns.filter((c) => c.status === 'in_progress' || c.status === 'planning' || c.status === 'reviewing');
  if (!active.length) return <Empty icon={Megaphone} title="No active campaigns" compact />;
  return (
    <div className="space-y-1">
      {active.slice(0, 5).map((c) => {
        const cov = coverage.filter((x) => x.campaignId === c.id);
        const done = c.activities.filter((a) => a.done).length;
        const sm = campaignStatusMeta(c.status);
        return (
          <Link key={c.id} to={`/campaigns/${c.id}`} className="-mx-1.5 block rounded-md px-1.5 py-1.5 row-hover">
            <div className="flex items-center gap-2">
              <span className="flex-1 truncate text-[13px] font-medium">{c.name}</span>
              <Badge tone={sm.tone}>{sm.label}</Badge>
            </div>
            <div className="mt-0.5 flex gap-3 text-xs text-faint">
              <span>{cov.length} coverage</span>
              <span>{compactNumber(cov.reduce((s, x) => s + (x.reach ?? 0), 0))} reach</span>
              {c.activities.length > 0 && (
                <span>
                  {done}/{c.activities.length} activities
                </span>
              )}
              {c.endDate && <span>ends {relativeDay(c.endDate).toLowerCase()}</span>}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function ContentOverview() {
  const content = useContent();
  const { openContent } = useApp();
  if (!content) return null;
  const today = todayISO();
  const upcoming = content.filter((c) => c.status !== 'published' && c.publishDate && c.publishDate >= today).sort((a, b) => a.publishDate!.localeCompare(b.publishDate!)).slice(0, 4);
  const pubMonth = content.filter((c) => c.status === 'published' && c.publishDate?.startsWith(today.slice(0, 7))).length;
  const pipeline = (['idea', 'drafting', 'reviewing', 'scheduled'] as const).map((s) => ({ s, n: content.filter((c) => c.status === s).length }));
  return (
    <div>
      <div className="mb-3 grid grid-cols-5 gap-1 text-center">
        {pipeline.map(({ s, n }) => (
          <div key={s} className="rounded-md bg-sunken/60 py-1.5">
            <div className="text-[15px] font-semibold tabular-nums">{n}</div>
            <div className="text-[10px] uppercase tracking-wide text-faint">{contentStatusMeta(s).label}</div>
          </div>
        ))}
        <div className="rounded-md bg-accent-soft/70 py-1.5">
          <div className="text-[15px] font-semibold tabular-nums text-accent">{pubMonth}</div>
          <div className="text-[10px] uppercase tracking-wide text-accent/80">This month</div>
        </div>
      </div>
      {upcoming.length ? (
        upcoming.map((c) => (
          <button key={c.id} onClick={() => openContent(c.id)} className="-mx-1.5 flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left row-hover">
            <span className="w-14 shrink-0 text-xs text-faint">{relativeDay(c.publishDate)}</span>
            <span className="flex-1 truncate text-[13px]">{c.title}</span>
            <span className="text-xs text-faint">{c.platform}</span>
          </button>
        ))
      ) : (
        <Muted>No upcoming content scheduled.</Muted>
      )}
    </div>
  );
}

function Metrics() {
  const tasks = useTasks();
  const content = useContent();
  const social = useSocial();
  const kpis = useKPIs();
  const entries = useKPIEntries();
  const weeks = useMemo(() => (tasks ? completedByWeek(tasks, 8) : []), [tasks]);
  if (!tasks || !content || !social || !kpis || !entries) return null;
  const totals = contentTotals(content.filter((c) => c.publishDate && daysUntil(c.publishDate)! >= -30));
  const soc = socialSummary(social);
  const thisWeek = weeks[weeks.length - 1]?.completed ?? 0;
  return (
    <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-xs text-muted">Tasks completed per week</span>
          <span className="text-xs text-faint">
            This week <strong className="text-fg tabular-nums">{thisWeek}</strong>
          </span>
        </div>
        <Bars data={weeks} x="label" series={[{ key: 'completed', label: 'Completed' }]} height={150} />
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md bg-sunken/50 p-2.5">
            <div className="text-2xs uppercase tracking-wide text-faint">Content reach · 30d</div>
            <div className="mt-0.5 text-[17px] font-semibold tabular-nums">{compactNumber(totals.reach)}</div>
          </div>
          <div className="rounded-md bg-sunken/50 p-2.5">
            <div className="text-2xs uppercase tracking-wide text-faint">Engagement rate</div>
            <div className="mt-0.5 text-[17px] font-semibold tabular-nums">{totals.rate !== null ? `${totals.rate.toFixed(1)}%` : '—'}</div>
          </div>
        </div>
        {soc.slice(0, 2).map((s) => (
          <div key={s.platform} className="flex items-center gap-3">
            <div className="w-24 shrink-0">
              <div className="text-xs text-muted">{s.platform}</div>
              <div className="text-[13px] font-semibold tabular-nums">
                {compactNumber(s.followers)} <span className="text-2xs font-normal text-faint">followers</span>
              </div>
            </div>
            <div className="flex-1">
              <Sparkline values={s.series.map((x) => x.followers ?? 0)} />
            </div>
            {s.followerChange !== null && <span className={s.followerChange >= 0 ? 'text-xs text-ok' : 'text-xs text-danger'}>{s.followerChange >= 0 ? '+' : ''}{compactNumber(s.followerChange)}</span>}
          </div>
        ))}
        {kpis.slice(0, 2).map((k) => {
          const vals = entries.filter((e) => e.kpiId === k.id).sort((a, b) => a.date.localeCompare(b.date));
          const cur = vals[vals.length - 1]?.value;
          return (
            <div key={k.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-muted">{k.name}</div>
                <Progress value={k.target && cur !== undefined ? (cur / k.target) * 100 : 0} className="mt-1" />
              </div>
              <span className="text-xs tabular-nums">
                {cur ?? '—'}
                {k.target ? <span className="text-faint"> / {k.target}</span> : null}
              </span>
            </div>
          );
        })}
        {!soc.length && !kpis.length && <Muted>Add social metrics or KPIs in Analytics to see them here.</Muted>}
      </div>
    </div>
  );
}

function RecentNotes() {
  const notes = useNotes();
  if (!notes) return null;
  const list = [...notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
  if (!list.length) return <Empty icon={NotebookPen} title="No notes yet" compact />;
  return (
    <div className="-mx-1.5">
      {list.map((n) => (
        <Link key={n.id} to={`/notes/${n.id}`} className="block rounded-md px-1.5 py-1.5 row-hover">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[13px] font-medium">{n.title || 'Untitled'}</span>
            <span className="shrink-0 text-2xs text-faint">{timeAgo(n.updatedAt)}</span>
          </div>
          <div className="truncate text-xs text-faint">{excerpt(n.body, 90) || 'Empty note'}</div>
        </Link>
      ))}
    </div>
  );
}

function IdeasInbox() {
  const ideas = useIdeas();
  const [text, setText] = useState('');
  if (!ideas) return null;
  const inbox = ideas.filter((i) => i.status === 'inbox').sort((a, b) => b.createdAt - a.createdAt);
  return (
    <div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          await create<Idea>('ideas', { text: text.trim(), status: 'inbox', tags: [] });
          setText('');
        }}
        className="mb-2 flex items-center gap-2 rounded-md border border-line bg-raised px-2"
      >
        <Plus className="h-3.5 w-3.5 text-faint" />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Capture an idea…" className="h-8 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint" />
      </form>
      {inbox.slice(0, 5).map((i) => (
        <Link to="/ideas" key={i.id} className="-mx-1.5 flex items-start gap-2 rounded-md px-1.5 py-1.5 row-hover">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
          <span className="line-clamp-2 text-[13px]">{i.text}</span>
        </Link>
      ))}
      {inbox.length > 5 && (
        <Link to="/ideas" className="block pt-1 text-xs text-muted hover:text-accent">
          {inbox.length - 5} more in inbox
        </Link>
      )}
      {!inbox.length && <Muted>Inbox zero.</Muted>}
    </div>
  );
}

function Achievements() {
  const data = useLiveQuery(async () => {
    const tasks = (await db.tasks.toArray()).filter((t) => !t.deletedAt);
    const projects = (await db.projects.toArray()).filter((p) => !p.deletedAt);
    const content = (await db.content.toArray()).filter((c) => !c.deletedAt);
    const coverage = (await db.coverage.toArray()).filter((c) => !c.deletedAt);
    const month = todayISO().slice(0, 7);
    return {
      tasks: tasks.filter((t) => isThisMonth(t.completedAt)).length,
      projects: projects.filter((p) => p.status === 'completed' && isThisMonth(p.completedAt)),
      content: content.filter((c) => c.status === 'published' && c.publishDate?.startsWith(month)).length,
      coverage: coverage.filter((c) => c.date?.startsWith(month)).length,
    };
  }, []);
  if (!data) return null;
  const cells = [
    { label: 'Tasks done', value: data.tasks },
    { label: 'Projects completed', value: data.projects.length },
    { label: 'Posts published', value: data.content },
    { label: 'Coverage pieces', value: data.coverage },
  ];
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {cells.map((c) => (
          <div key={c.label} className="rounded-md bg-sunken/50 p-2.5">
            <div className="text-[20px] font-semibold tabular-nums leading-none">{c.value}</div>
            <div className="mt-1 text-2xs uppercase tracking-wide text-faint">{c.label}</div>
          </div>
        ))}
      </div>
      {data.projects.length > 0 && (
        <div className="mt-3 space-y-1">
          {data.projects.map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-[13px]">
              <Trophy className="h-3.5 w-3.5 text-warn" />
              {p.title}
            </div>
          ))}
        </div>
      )}
      <Link to="/reviews" className="mt-3 block text-xs text-muted hover:text-accent">
        Open this month's review →
      </Link>
    </div>
  );
}

function ProjectProgress() {
  return <ActiveProjects detailed />;
}

export const WIDGETS: Record<WidgetType, WidgetDef> = {
  priorities: { title: "Today's priorities", icon: ListTodo, description: 'Your most important open tasks, ranked by urgency and priority.', href: '/my-day', render: () => <Priorities /> },
  deadlines: { title: 'Upcoming deadlines', icon: CalendarClock, description: 'Tasks, milestones and project deadlines in the next two weeks.', href: '/calendar', render: () => <Deadlines /> },
  overdue: { title: 'Overdue', icon: AlertTriangle, description: 'Tasks past their due date.', href: '/tasks?view=overdue', render: () => <Overdue /> },
  activeProjects: { title: 'Active projects', icon: FolderKanban, description: 'Projects in planning or in progress.', href: '/projects', render: () => <ActiveProjects /> },
  projectProgress: { title: 'Project progress', icon: Gauge, description: 'Progress rings with the calculation explained.', href: '/projects', render: () => <ProjectProgress /> },
  events: { title: 'This week', icon: CalendarDays, description: 'Meetings, work blocks, reminders and publishing dates.', href: '/calendar', render: () => <Events /> },
  activity: { title: 'Recent activity', icon: ActivityIcon, description: 'What changed recently across your workspace.', render: () => <ActivityFeed limit={8} /> },
  campaigns: { title: 'PR campaigns', icon: Megaphone, description: 'Active campaigns with coverage and reach.', href: '/campaigns', render: () => <Campaigns /> },
  content: { title: 'Content pipeline', icon: Sparkles, description: 'Pipeline status and what is publishing next.', href: '/content', render: () => <ContentOverview /> },
  metrics: { title: 'Performance', icon: BarChart3, description: 'Completion trend, content reach, followers and KPIs.', href: '/analytics', render: () => <Metrics /> },
  notes: { title: 'Recent notes', icon: NotebookPen, description: 'Notes you edited most recently.', href: '/notes', render: () => <RecentNotes /> },
  ideas: { title: 'Ideas inbox', icon: Lightbulb, description: 'Capture and review unprocessed ideas.', href: '/ideas', render: () => <IdeasInbox /> },
  achievements: { title: 'This month', icon: Trophy, description: 'Your achievements so far this month.', href: '/reviews', render: () => <Achievements /> },
};
