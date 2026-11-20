import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { addMonths, format, parse } from 'date-fns';
import { CalendarCheck, CheckCircle2, ChevronLeft, ChevronRight, Download, FolderKanban, Gauge, ListTodo, Megaphone, Sparkles, Star, Trophy } from 'lucide-react';
import { db } from '@/lib/db';
import { useAutosave } from '@/lib/hooks';
import { create, update } from '@/lib/repo';
import { engagementOf, projectProgress } from '@/lib/domain';
import type { MonthlyReview } from '@/lib/types';
import { cn, compactNumber, downloadText, fmtDate, monthKey, todayISO } from '@/lib/utils';
import { Button, Card, IconButton, Loading, Page, Progress, Stat, Textarea } from '@/components/ui';

export default function ReviewsPage() {
  const { month: param } = useParams();
  const navigate = useNavigate();
  const month = param && /^\d{4}-\d{2}$/.test(param) ? param : monthKey(new Date());
  const date = parse(month + '-01', 'yyyy-MM-dd', new Date());
  const isFuture = month > monthKey(new Date());
  const go = (n: number) => navigate(`/reviews/${monthKey(addMonths(date, n))}`);

  const data = useLiveQuery(() => gather(month), [month]);
  const past = useLiveQuery(async () => (await db.reviews.toArray()).filter((r) => !r.deletedAt).sort((a, b) => b.month.localeCompare(a.month)), []);

  return (
    <Page>
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <p className="flex items-center gap-1.5 text-[13px] text-faint">
            <CalendarCheck className="h-3.5 w-3.5" /> Monthly review
          </p>
          <h1 className="mt-1 font-serif text-[32px] font-medium leading-tight tracking-tight">{format(date, 'MMMM yyyy')}</h1>
        </div>
        <div className="flex items-center gap-1">
          <IconButton icon={ChevronLeft} label="Previous month" onClick={() => go(-1)} />
          <Button size="sm" onClick={() => navigate('/reviews')}>
            This month
          </Button>
          <IconButton icon={ChevronRight} label="Next month" onClick={() => go(1)} disabled={isFuture} />
          {data && (
            <Button size="sm" icon={Download} onClick={async () => downloadText(toMarkdown(month, data, await db.reviews.where('month').equals(month).first()), `review-${month}.md`, 'text/markdown')}>
              Export
            </Button>
          )}
        </div>
      </div>

      {!data ? (
        <Loading />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <div className="space-y-5">
            <div className="card grid grid-cols-2 gap-5 p-5 sm:grid-cols-4">
              <Stat label="Tasks completed" value={data.completedTasks.length} />
              <Stat label="Projects completed" value={data.completedProjects.length} />
              <Stat label="Posts published" value={data.published.length} sub={data.contentReach ? `${compactNumber(data.contentReach)} reach` : undefined} tone="muted" />
              <Stat label="Coverage" value={data.coverage.length} sub={data.coverageReach ? `${compactNumber(data.coverageReach)} reach` : undefined} tone="muted" />
            </div>

            {(data.completedProjects.length > 0 || data.topContent || data.coverage.length > 0) && (
              <Card title="Major achievements" icon={Trophy}>
                <ul className="space-y-1.5 text-[13.5px]">
                  {data.completedProjects.map((p) => (
                    <li key={p.id} className="flex gap-2">
                      <Trophy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
                      Completed project <Link to={`/projects/${p.id}`} className="font-medium hover:text-accent">{p.title}</Link>
                    </li>
                  ))}
                  {data.topContent && (
                    <li className="flex gap-2">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                      Best-performing post: <span className="font-medium">{data.topContent.title}</span> ({compactNumber(engagementOf(data.topContent.metrics))} engagements on {data.topContent.platform})
                    </li>
                  )}
                  {data.coverage.length > 0 && (
                    <li className="flex gap-2">
                      <Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info" />
                      {data.coverage.length} piece{data.coverage.length > 1 ? 's' : ''} of coverage, incl. {data.coverage.slice(0, 3).map((c) => c.outlet).join(', ')}
                    </li>
                  )}
                </ul>
              </Card>
            )}

            <div className="grid gap-5 md:grid-cols-2">
              <Card title={`Completed tasks · ${data.completedTasks.length}`} icon={CheckCircle2}>
                <List items={data.completedTasks.map((t) => ({ key: t.id, text: t.title, sub: fmtDate(new Date(t.completedAt!).toISOString().slice(0, 10)) }))} empty="No tasks completed this month." />
              </Card>
              <Card title={`Outstanding · ${data.outstanding.length}`} icon={ListTodo}>
                <List items={data.outstanding.map((t) => ({ key: t.id, text: t.title, sub: t.dueDate ? `due ${fmtDate(t.dueDate)}` : '', warn: !!t.dueDate && t.dueDate < data.monthEnd }))} empty="Nothing outstanding that was due this month." />
              </Card>
            </div>

            <Card title="Projects" icon={FolderKanban}>
              {data.active.length === 0 && data.completedProjects.length === 0 ? (
                <p className="text-[13px] text-faint">No project activity.</p>
              ) : (
                <div className="space-y-2.5">
                  {[...data.completedProjects, ...data.active].map((p) => (
                    <Link key={p.id} to={`/projects/${p.id}`} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-1 row-hover">
                      <span className="w-48 truncate text-[13px]">{p.title}</span>
                      <Progress value={p.progress} tone={p.status === 'completed' ? 'ok' : 'accent'} />
                      <span className="w-10 text-right text-xs tabular-nums text-muted">{p.progress}%</span>
                    </Link>
                  ))}
                  <p className="text-2xs text-faint">Progress shown is the current value.</p>
                </div>
              )}
            </Card>

            <div className="grid gap-5 md:grid-cols-2">
              <Card title={`Published content · ${data.published.length}`} icon={Sparkles}>
                <List items={data.published.map((c) => ({ key: c.id, text: c.title, sub: c.platform }))} empty="Nothing published this month." />
              </Card>
              <Card title="Campaign activity" icon={Megaphone}>
                {data.campaignRows.length === 0 ? (
                  <p className="text-[13px] text-faint">No campaign activity recorded.</p>
                ) : (
                  data.campaignRows.map((c) => (
                    <div key={c.id} className="py-1">
                      <Link to={`/campaigns/${c.id}`} className="text-[13px] font-medium hover:text-accent">
                        {c.name}
                      </Link>
                      <div className="text-xs text-faint">
                        {[c.coverage && `${c.coverage} coverage`, c.releases && `${c.releases} release(s) distributed`, c.activities && `${c.activities} activities done`].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  ))
                )}
              </Card>
            </div>

            <Card title="KPI progress" icon={Gauge}>
              {data.kpiRows.length === 0 ? (
                <p className="text-[13px] text-faint">No KPI values recorded this month.</p>
              ) : (
                <div className="divide-y divide-line">
                  {data.kpiRows.map((k) => (
                    <div key={k.id} className="flex items-center gap-3 py-2 text-[13px]">
                      <span className="flex-1">{k.name}</span>
                      <span className="tabular-nums">{k.value}</span>
                      {k.prev !== null && <span className={cn('w-20 text-right text-xs tabular-nums', (k.value - k.prev) * (k.direction === 'up' ? 1 : -1) >= 0 ? 'text-ok' : 'text-danger')}>{k.value - k.prev >= 0 ? '+' : ''}{k.value - k.prev}</span>}
                      {k.target != null && <span className="w-24 text-right text-xs text-faint">target {k.target}</span>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-5">
            <Reflection month={month} />
            <Card title="Past reviews">
              {!past?.length ? (
                <p className="text-xs text-faint">Reviews you write will be listed here.</p>
              ) : (
                past.map((r) => (
                  <Link key={r.id} to={`/reviews/${r.month}`} className={cn('-mx-1.5 flex items-center gap-2 rounded-md px-1.5 py-1.5 text-[13px] row-hover', r.month === month && 'bg-sunken')}>
                    <span className="flex-1">{format(parse(r.month + '-01', 'yyyy-MM-dd', new Date()), 'MMMM yyyy')}</span>
                    {r.rating ? <span className="text-xs text-warn">{'★'.repeat(r.rating)}</span> : null}
                  </Link>
                ))
              )}
            </Card>
          </div>
        </div>
      )}
    </Page>
  );
}

function List({ items, empty }: { items: { key: string; text: string; sub?: string; warn?: boolean }[]; empty: string }) {
  const [all, setAll] = useState(false);
  if (!items.length) return <p className="text-[13px] text-faint">{empty}</p>;
  const shown = all ? items : items.slice(0, 8);
  return (
    <div>
      {shown.map((i) => (
        <div key={i.key} className="flex items-center gap-2 py-1 text-[13px]">
          <span className="flex-1 truncate">{i.text}</span>
          <span className={cn('shrink-0 text-xs', i.warn ? 'text-danger' : 'text-faint')}>{i.sub}</span>
        </div>
      ))}
      {items.length > 8 && (
        <button onClick={() => setAll((a) => !a)} className="mt-1 text-xs text-muted hover:text-accent">
          {all ? 'Show less' : `Show all ${items.length}`}
        </button>
      )}
    </div>
  );
}

function Reflection({ month }: { month: string }) {
  const row = useLiveQuery(async () => (await db.reviews.where('month').equals(month).first()) ?? null, [month]);
  const [draft, setDraft] = useState<Partial<MonthlyReview> | null>(null);
  useEffect(() => {
    setDraft(null);
  }, [month]);
  useEffect(() => {
    if (row !== undefined && draft === null) setDraft(row ?? { month });
  }, [row, draft, month]);
  const status = useAutosave(
    draft,
    async (d) => {
      if (!d) return;
      const existing = await db.reviews.where('month').equals(month).first();
      const fields = { reflections: d.reflections, wins: d.wins, challenges: d.challenges, nextFocus: d.nextFocus, rating: d.rating ?? null };
      if (existing) await update<MonthlyReview>('reviews', existing.id, fields, { log: false });
      else await create<MonthlyReview>('reviews', { month, ...fields }, { log: false });
    },
    700,
    draft !== null,
  );
  if (!draft) return <Loading />;
  const set = (p: Partial<MonthlyReview>) => setDraft((d) => ({ ...d, ...p }));
  const field = (k: keyof MonthlyReview, label: string, ph: string) => (
    <label className="block">
      <span className="label">{label}</span>
      <Textarea autoGrow rows={3} value={(draft[k] as string) ?? ''} onChange={(e) => set({ [k]: e.target.value })} placeholder={ph} />
    </label>
  );
  return (
    <Card title="Your reflections" action={<span className="text-2xs text-faint">{status === 'saved' ? 'Saved' : status === 'pending' || status === 'saving' ? 'Saving…' : ''}</span>}>
      <div className="space-y-3">
        <div>
          <span className="label">How did the month feel?</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => set({ rating: draft.rating === n ? null : n })} aria-label={`${n} stars`}>
                <Star className={cn('h-5 w-5', (draft.rating ?? 0) >= n ? 'fill-warn text-warn' : 'text-line-strong')} />
              </button>
            ))}
          </div>
        </div>
        {field('wins', 'Wins', 'What went well? What are you proud of?')}
        {field('challenges', 'Challenges', 'What was hard? What got in the way?')}
        {field('reflections', 'Reflections', 'What did you learn?')}
        {field('nextFocus', 'Focus for next month', 'One to three priorities')}
      </div>
    </Card>
  );
}

async function gather(month: string) {
  const start = new Date(month + '-01T00:00:00').getTime();
  const endDate = addMonths(new Date(month + '-01T00:00:00'), 1);
  const end = endDate.getTime();
  const monthEnd = format(new Date(end - 1), 'yyyy-MM-dd');
  const inMonth = (ts?: number | null) => !!ts && ts >= start && ts < end;
  const alive = <T extends { deletedAt?: number | null }>(a: T[]) => a.filter((x) => !x.deletedAt);
  const tasks = alive(await db.tasks.toArray());
  const projects = alive(await db.projects.toArray());
  const content = alive(await db.content.toArray());
  const coverageAll = alive(await db.coverage.toArray());
  const campaigns = alive(await db.campaigns.toArray());
  const releases = alive(await db.pressReleases.toArray());
  const kpis = alive(await db.kpis.toArray());
  const entries = alive(await db.kpiEntries.toArray());

  const completedTasks = tasks.filter((t) => t.status === 'completed' && inMonth(t.completedAt)).sort((a, b) => a.completedAt! - b.completedAt!);
  const completedProjects = projects.filter((p) => p.status === 'completed' && inMonth(p.completedAt)).map((p) => ({ ...p, progress: 100 }));
  const active = projects.filter((p) => p.status === 'in_progress' || p.status === 'planning').map((p) => ({ ...p, progress: projectProgress(p, tasks).percent }));
  const published = content.filter((c) => c.status === 'published' && c.publishDate?.startsWith(month));
  const topContent = [...published].sort((a, b) => engagementOf(b.metrics) - engagementOf(a.metrics))[0];
  const coverage = coverageAll.filter((c) => c.date?.startsWith(month));
  const isCurrent = month === monthKey(new Date());
  const outstanding = tasks.filter((t) => t.status !== 'completed' && !t.parentId && t.dueDate && t.dueDate <= (isCurrent ? todayISO() : monthEnd) && t.dueDate >= month + '-01');
  const campaignRows = campaigns
    .map((c) => ({
      id: c.id,
      name: c.name,
      coverage: coverage.filter((x) => x.campaignId === c.id).length,
      releases: releases.filter((r) => r.campaignId === c.id && r.distributionDate?.startsWith(month)).length,
      activities: c.activities.filter((a) => a.done && a.date?.startsWith(month)).length,
    }))
    .filter((c) => c.coverage || c.releases || c.activities);
  const kpiRows = kpis
    .map((k) => {
      const list = entries.filter((e) => e.kpiId === k.id).sort((a, b) => a.date.localeCompare(b.date));
      const inM = list.filter((e) => e.date.startsWith(month));
      const last = inM[inM.length - 1];
      const before = list.filter((e) => e.date < month + '-01');
      return last ? { id: k.id, name: k.name, value: last.value, prev: before.length ? before[before.length - 1].value : null, target: k.target, direction: k.direction } : null;
    })
    .filter(Boolean) as { id: string; name: string; value: number; prev: number | null; target?: number | null; direction: 'up' | 'down' }[];

  return {
    monthEnd,
    completedTasks,
    completedProjects,
    active,
    published,
    topContent: topContent && engagementOf(topContent.metrics) > 0 ? topContent : undefined,
    contentReach: published.reduce((s, c) => s + (c.metrics.reach ?? 0), 0),
    coverage,
    coverageReach: coverage.reduce((s, c) => s + (c.reach ?? 0), 0),
    outstanding,
    campaignRows,
    kpiRows,
  };
}

type Gathered = Awaited<ReturnType<typeof gather>>;

function toMarkdown(month: string, d: Gathered, r?: MonthlyReview) {
  const title = format(parse(month + '-01', 'yyyy-MM-dd', new Date()), 'MMMM yyyy');
  const lines = [
    `# Monthly review — ${title}`,
    '',
    `- Tasks completed: ${d.completedTasks.length}`,
    `- Projects completed: ${d.completedProjects.length}`,
    `- Content published: ${d.published.length}`,
    `- Coverage pieces: ${d.coverage.length}`,
    '',
    '## Completed projects',
    ...(d.completedProjects.length ? d.completedProjects.map((p) => `- ${p.title}`) : ['- None']),
    '',
    '## Completed tasks',
    ...(d.completedTasks.length ? d.completedTasks.map((t) => `- ${t.title}`) : ['- None']),
    '',
    '## Published content',
    ...(d.published.length ? d.published.map((c) => `- ${c.title} (${c.platform})`) : ['- None']),
    '',
    '## KPIs',
    ...(d.kpiRows.length ? d.kpiRows.map((k) => `- ${k.name}: ${k.value}${k.target != null ? ` (target ${k.target})` : ''}`) : ['- None recorded']),
    '',
    '## Outstanding',
    ...(d.outstanding.length ? d.outstanding.map((t) => `- [ ] ${t.title}`) : ['- Nothing outstanding']),
  ];
  if (r) {
    if (r.rating) lines.push('', `Rating: ${'★'.repeat(r.rating)}`);
    for (const [h, v] of [['Wins', r.wins], ['Challenges', r.challenges], ['Reflections', r.reflections], ['Focus for next month', r.nextFocus]] as const)
      if (v) lines.push('', `## ${h}`, v);
  }
  return lines.join('\n');
}

