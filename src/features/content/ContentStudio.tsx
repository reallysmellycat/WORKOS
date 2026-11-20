import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, Columns3, Lightbulb, List, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { useContent, useContentIdeas, useSocial } from '@/lib/hooks';
import { colorFor, CONTENT_STATUSES, contentStatusMeta, engagementOf, engagementRate } from '@/lib/domain';
import { create, restore, softDelete, update } from '@/lib/repo';
import type { ContentIdea, ContentIdeaKind, ContentItem, ContentStatus, SocialSnapshot } from '@/lib/types';
import { cn, compactNumber, fmtDate, toISODate, todayISO } from '@/lib/utils';
import { Badge, Button, Card, DemoBadge, Empty, Field, IconButton, Input, Loading, Modal, Page, PageHeader, Select, Stat, Tabs, Textarea } from '@/components/ui';
import { Bars, Lines } from '@/components/charts';
import { useFeedback } from '@/components/feedback';
import { useApp } from '@/app/context';
import { contentTotals, publishedByMonth, socialSummary } from '../analytics/metrics';

type Tab = 'calendar' | 'pipeline' | 'list' | 'bank' | 'analytics';

export default function ContentStudio() {
  const content = useContent();
  const [params, setParams] = useSearchParams();
  const { openContent, quickAdd, settings } = useApp();
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) || 'calendar');
  const [platform, setPlatform] = useState('');

  useEffect(() => {
    const open = params.get('open');
    if (open) {
      openContent(open);
      params.delete('open');
      setParams(params, { replace: true });
    }
  }, [params, setParams, openContent]);

  const filtered = useMemo(() => (content ?? []).filter((c) => !platform || c.platform === platform), [content, platform]);
  if (!content) return <Loading />;
  const platforms = [...new Set([...settings.platforms, ...content.map((c) => c.platform)])];

  return (
    <Page wide={tab === 'calendar' || tab === 'pipeline'}>
      <PageHeader
        title="Content Studio"
        subtitle="Plan, draft, schedule and review content across platforms."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => quickAdd({ type: 'content' })}>
            New content
          </Button>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'calendar', label: 'Calendar', icon: CalendarDays },
            { value: 'pipeline', label: 'Pipeline', icon: Columns3 },
            { value: 'list', label: 'List', icon: List },
            { value: 'bank', label: 'Idea bank', icon: Lightbulb },
            { value: 'analytics', label: 'Social analytics', icon: BarChart3 },
          ]}
        />
        <div className="flex-1" />
        {tab !== 'bank' && tab !== 'analytics' && (
          <Select value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-40" aria-label="Platform filter">
            <option value="">All platforms</option>
            {platforms.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
        )}
      </div>
      {tab === 'calendar' && <ContentCalendar items={filtered} />}
      {tab === 'pipeline' && <Pipeline items={filtered} />}
      {tab === 'list' && <ContentList items={filtered} />}
      {tab === 'bank' && <IdeaBank />}
      {tab === 'analytics' && <SocialAnalytics content={content} />}
    </Page>
  );
}

function PlatformDot({ p }: { p: string }) {
  return <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: colorFor(p) }} />;
}

function ContentCalendar({ items }: { items: ContentItem[] }) {
  const { openContent, quickAdd, settings } = useApp();
  const [cursor, setCursor] = useState(new Date());
  const [over, setOver] = useState<string | null>(null);
  const opts = { weekStartsOn: settings.weekStartsOn };
  const from = startOfWeek(startOfMonth(cursor), opts);
  const to = endOfWeek(endOfMonth(cursor), opts);
  const days: Date[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  const unscheduled = items.filter((c) => !c.publishDate && c.status !== 'published');
  const today = todayISO();
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_260px]">
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <IconButton icon={ChevronLeft} label="Previous month" onClick={() => setCursor(addMonths(cursor, -1))} />
          <span className="min-w-[130px] text-center text-[13.5px] font-semibold">{format(cursor, 'MMMM yyyy')}</span>
          <IconButton icon={ChevronRight} label="Next month" onClick={() => setCursor(addMonths(cursor, 1))} />
          <Button size="xs" variant="ghost" onClick={() => setCursor(new Date())}>
            Today
          </Button>
        </div>
        <div className="grid grid-cols-7">
          {days.slice(0, 7).map((d) => (
            <div key={d.toISOString()} className="border-b border-line px-2 py-1.5 text-2xs font-semibold uppercase tracking-wider text-faint">
              {format(d, 'EEE')}
            </div>
          ))}
          {days.map((d) => {
            const iso = toISODate(d);
            const list = items.filter((c) => c.publishDate === iso);
            return (
              <div
                key={iso}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(iso);
                }}
                onDragLeave={() => setOver((o) => (o === iso ? null : o))}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(null);
                  const id = e.dataTransfer.getData('text/content-id');
                  if (id) void update<ContentItem>('content', id, { publishDate: iso });
                }}
                onDoubleClick={() => quickAdd({ type: 'content', date: iso })}
                className={cn('group min-h-[104px] border-b border-r border-line p-1.5 [&:nth-child(7n)]:border-r-0', !isSameMonth(d, cursor) && 'bg-sunken/30', over === iso && 'bg-accent-soft/60')}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className={cn('flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs tabular-nums', iso === today ? 'bg-accent font-semibold text-accent-fg' : 'text-faint')}>{format(d, 'd')}</span>
                  <button onClick={() => quickAdd({ type: 'content', date: iso })} className="text-faint opacity-0 hover:text-fg group-hover:opacity-100" aria-label="Add content on this day">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                {list.map((c) => (
                  <button
                    key={c.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/content-id', c.id)}
                    onClick={() => openContent(c.id)}
                    className={cn('mb-0.5 flex w-full items-center gap-1.5 rounded border border-line bg-raised px-1.5 py-1 text-left text-[11.5px] shadow-soft hover:border-line-strong', c.status === 'published' && 'opacity-60')}
                    title={`${c.platform} · ${contentStatusMeta(c.status).label}`}
                  >
                    <PlatformDot p={c.platform} />
                    <span className="truncate">{c.title}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <div className="card p-3">
        <h3 className="mb-1 text-[13px] font-semibold">Unscheduled</h3>
        <p className="mb-2 text-xs text-faint">Drag onto a day to schedule.</p>
        {unscheduled.length === 0 && <p className="text-xs text-faint">Everything has a date.</p>}
        {unscheduled.map((c) => (
          <button key={c.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/content-id', c.id)} onClick={() => openContent(c.id)} className="mb-1 flex w-full items-center gap-2 rounded-md border border-line bg-raised px-2 py-1.5 text-left text-[12.5px] hover:border-line-strong">
            <PlatformDot p={c.platform} />
            <span className="flex-1 truncate">{c.title}</span>
            <Badge tone={contentStatusMeta(c.status).tone}>{contentStatusMeta(c.status).label}</Badge>
          </button>
        ))}
        <div className="mt-4 space-y-1 border-t border-line pt-3">
          {[...new Set(items.map((i) => i.platform))].map((p) => (
            <div key={p} className="flex items-center gap-2 text-xs text-muted">
              <PlatformDot p={p} /> {p}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Pipeline({ items }: { items: ContentItem[] }) {
  const { openContent } = useApp();
  const [over, setOver] = useState<string | null>(null);
  return (
    <div className="grid gap-3 overflow-x-auto pb-4" style={{ gridTemplateColumns: 'repeat(5, minmax(230px, 1fr))' }}>
      {CONTENT_STATUSES.map((s) => {
        const list = items.filter((c) => c.status === s.value).sort((a, b) => (a.publishDate ?? '9999').localeCompare(b.publishDate ?? '9999'));
        return (
          <div
            key={s.value}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(s.value);
            }}
            onDragLeave={() => setOver((o) => (o === s.value ? null : o))}
            onDrop={(e) => {
              setOver(null);
              const id = e.dataTransfer.getData('text/content-id');
              if (id) void update<ContentItem>('content', id, { status: s.value as ContentStatus });
            }}
            className={cn('min-h-[320px] rounded-lg bg-sunken/50 p-2', over === s.value && 'bg-accent-soft/60 ring-1 ring-accent/30')}
          >
            <div className="flex items-center gap-2 px-1.5 pb-2 pt-1">
              <Badge tone={s.tone} dot>
                {s.label}
              </Badge>
              <span className="text-xs text-faint">{list.length}</span>
            </div>
            <div className="space-y-1.5">
              {list.map((c) => (
                <button key={c.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/content-id', c.id)} onClick={() => openContent(c.id)} className="block w-full rounded-md border border-line bg-raised p-2.5 text-left shadow-soft hover:border-line-strong">
                  <div className="text-[13px] font-medium leading-snug">{c.title}</div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-faint">
                    <PlatformDot p={c.platform} />
                    {c.platform} · {c.contentType}
                    <span className="flex-1" />
                    {c.publishDate && fmtDate(c.publishDate)}
                  </div>
                  {c.isDemo && <div className="mt-1.5"><DemoBadge /></div>}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ContentList({ items }: { items: ContentItem[] }) {
  const { openContent } = useApp();
  if (!items.length) return <div className="card"><Empty icon={Sparkles} title="No content yet" /></div>;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[760px] text-[13px]">
        <thead>
          <tr className="border-b border-line text-left text-2xs uppercase tracking-wider text-faint">
            <th className="px-4 py-2.5 font-semibold">Title</th>
            <th className="px-3 py-2.5 font-semibold">Platform</th>
            <th className="px-3 py-2.5 font-semibold">Status</th>
            <th className="px-3 py-2.5 font-semibold">Date</th>
            <th className="px-3 py-2.5 text-right font-semibold">Reach</th>
            <th className="px-3 py-2.5 text-right font-semibold">Engagement</th>
            <th className="px-3 py-2.5 text-right font-semibold">Eng. rate</th>
          </tr>
        </thead>
        <tbody>
          {[...items]
            .sort((a, b) => (b.publishDate ?? '').localeCompare(a.publishDate ?? ''))
            .map((c) => {
              const eng = engagementOf(c.metrics);
              const rate = engagementRate(eng, c.metrics.reach, c.metrics.impressions);
              return (
                <tr key={c.id} onClick={() => openContent(c.id)} className="cursor-pointer border-b border-line last:border-0 row-hover">
                  <td className="px-4 py-2.5 font-medium">
                    {c.title} {c.isDemo && <DemoBadge />}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-muted">
                      <PlatformDot p={c.platform} />
                      {c.platform}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={contentStatusMeta(c.status).tone}>{contentStatusMeta(c.status).label}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-muted">{c.publishDate ? fmtDate(c.publishDate, 'd MMM yyyy') : '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{c.metrics.reach ? compactNumber(c.metrics.reach) : '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{eng ? compactNumber(eng) : '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{rate !== null ? `${rate.toFixed(1)}%` : '—'}</td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}

const KINDS: { value: ContentIdeaKind; label: string }[] = [
  { value: 'hook', label: 'Hooks' },
  { value: 'post', label: 'Post ideas' },
  { value: 'video', label: 'Video concepts' },
  { value: 'caption', label: 'Captions' },
  { value: 'reference', label: 'References' },
  { value: 'inspiration', label: 'Inspiration' },
  { value: 'note', label: 'Creative notes' },
];

function IdeaBank() {
  const ideas = useContentIdeas();
  const { settings, openContent } = useApp();
  const { toast } = useFeedback();
  const [kind, setKind] = useState<ContentIdeaKind | 'all'>('all');
  const [text, setText] = useState('');
  const [newKind, setNewKind] = useState<ContentIdeaKind>('post');
  const [url, setUrl] = useState('');
  if (!ideas) return <Loading />;
  const list = ideas.filter((i) => kind === 'all' || i.kind === kind).sort((a, b) => b.createdAt - a.createdAt);

  const toDraft = async (i: ContentIdea) => {
    const firstLine = i.text.split('\n')[0].replace(/^"|"$/g, '').slice(0, 90);
    const c = await create<ContentItem>('content', {
      title: firstLine,
      platform: i.platform || settings.platforms[0] || 'LinkedIn',
      contentType: i.kind === 'video' ? 'Short video' : settings.contentTypes[0] ?? 'Post',
      status: 'drafting',
      draft: i.kind === 'hook' ? `${i.text}\n\n` : i.text,
      caption: i.kind === 'caption' ? i.text : '',
      referenceLinks: i.url ? [{ id: i.id, title: i.url, url: i.url }] : [],
      metrics: {},
      tags: i.tags,
    });
    await update<ContentIdea>('contentIdeas', i.id, { convertedTo: c.id }, { log: false });
    toast('Draft created', { action: { label: 'Open', onClick: () => openContent(c.id) } });
    openContent(c.id);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      <div className="space-y-4">
        <div className="card p-3">
          <Field label="Add to idea bank">
            <Select value={newKind} onChange={(e) => setNewKind(e.target.value as ContentIdeaKind)}>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label.replace(/s$/, '')}
                </option>
              ))}
            </Select>
          </Field>
          <Textarea className="mt-2" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write it down before it's gone…" />
          {(newKind === 'reference' || newKind === 'inspiration') && <Input className="mt-2" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link (optional)" />}
          <Button
            className="mt-2 w-full"
            variant="primary"
            icon={Plus}
            disabled={!text.trim()}
            onClick={async () => {
              await create<ContentIdea>('contentIdeas', { kind: newKind, text: text.trim(), url: url.trim() || undefined, tags: [] });
              setText('');
              setUrl('');
            }}
          >
            Save
          </Button>
        </div>
        <div className="card p-1.5">
          {[{ value: 'all' as const, label: 'Everything' }, ...KINDS].map((k) => (
            <button key={k.value} onClick={() => setKind(k.value)} className={cn('flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[13px]', kind === k.value ? 'bg-sunken font-medium' : 'text-muted hover:bg-sunken/60')}>
              {k.label}
              <span className="text-xs text-faint">{k.value === 'all' ? ideas.length : ideas.filter((i) => i.kind === k.value).length}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        {list.length === 0 ? (
          <div className="card">
            <Empty icon={Lightbulb} title="Nothing here yet">Collect hooks, concepts and references. Turn any of them into a draft with one click.</Empty>
          </div>
        ) : (
          <div className="columns-1 gap-3 md:columns-2 [&>*]:mb-3">
            {list.map((i) => (
              <article key={i.id} className="card group break-inside-avoid p-3.5">
                <div className="mb-2 flex items-center gap-2">
                  <Badge tone="accent">{KINDS.find((k) => k.value === i.kind)?.label.replace(/s$/, '')}</Badge>
                  {i.isDemo && <DemoBadge />}
                  {i.convertedTo && <Badge tone="ok">Drafted</Badge>}
                  <div className="flex-1" />
                  <IconButton
                    icon={Trash2}
                    size="sm"
                    label="Delete"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={async () => {
                      await softDelete('contentIdeas', i.id);
                      toast('Idea deleted', { action: { label: 'Undo', onClick: () => restore('contentIdeas', i.id) } });
                    }}
                  />
                </div>
                <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{i.text}</p>
                {i.url && (
                  <a href={i.url} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-xs text-accent hover:underline">
                    {i.url}
                  </a>
                )}
                <div className="mt-3 flex justify-end">
                  {i.convertedTo ? (
                    <Button size="xs" variant="ghost" onClick={() => openContent(i.convertedTo!)}>
                      Open draft
                    </Button>
                  ) : (
                    <Button size="xs" icon={Wand2} onClick={() => toDraft(i)}>
                      Turn into draft
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SocialAnalytics({ content }: { content: ContentItem[] }) {
  const social = useSocial();
  const { settings } = useApp();
  const [adding, setAdding] = useState(false);
  const [metric, setMetric] = useState<'followers' | 'reach' | 'impressions' | 'engagement' | 'views' | 'rate'>('followers');
  if (!social) return <Loading />;
  const summary = socialSummary(social);
  const pub = publishedByMonth(content, 6);
  const totals = contentTotals(content);

  const dates = [...new Set(social.map((s) => s.date))].sort();
  const platforms = [...new Set(social.map((s) => s.platform))];
  const series = dates.map((d) => {
    const row: Record<string, string | number | null> = { date: fmtDate(d, 'd MMM') };
    for (const p of platforms) {
      const s = social.find((x) => x.date === d && x.platform === p);
      if (!s) row[p] = null;
      else if (metric === 'rate') {
        const r = engagementRate(s.engagement, s.reach, s.impressions);
        row[p] = r !== null ? Number(r.toFixed(2)) : null;
      } else row[p] = (s[metric] as number | null | undefined) ?? null;
    }
    return row;
  });

  const top = content
    .filter((c) => c.status === 'published')
    .map((c) => ({ c, eng: engagementOf(c.metrics), rate: engagementRate(engagementOf(c.metrics), c.metrics.reach, c.metrics.impressions) }))
    .sort((a, b) => b.eng - a.eng)
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 px-4 py-3 text-[13px] text-muted">
        <span className="flex-1">Metrics are entered by you from each platform's analytics — Work OS never connects to or pulls from your social accounts.</span>
        <Button variant="primary" size="sm" icon={Plus} onClick={() => setAdding(true)}>
          Record metrics
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((s) => (
          <div key={s.platform} className="card p-4">
            <div className="flex items-center gap-2 text-xs text-muted">
              <PlatformDot p={s.platform} /> {s.platform}
            </div>
            <div className="mt-2 text-[22px] font-semibold tabular-nums">{compactNumber(s.followers)}</div>
            <div className="text-xs text-faint">
              followers{s.followerChange !== null && <span className={s.followerChange >= 0 ? 'text-ok' : 'text-danger'}> · {s.followerChange >= 0 ? '+' : ''}{compactNumber(s.followerChange)} in 30d</span>}
            </div>
            <div className="mt-1 text-2xs text-faint">Last recorded {fmtDate(s.latest.date, 'd MMM')}</div>
          </div>
        ))}
        <div className="card p-4">
          <Stat label="Published posts" value={totals.published} sub={totals.rate !== null ? `${totals.rate.toFixed(1)}% avg. engagement rate` : 'No metrics yet'} />
        </div>
      </div>
      <Card
        title="Trends"
        action={
          <Select value={metric} onChange={(e) => setMetric(e.target.value as typeof metric)} className="w-44" aria-label="Metric">
            <option value="followers">Followers</option>
            <option value="reach">Reach</option>
            <option value="impressions">Impressions</option>
            <option value="engagement">Engagement</option>
            <option value="views">Views</option>
            <option value="rate">Engagement rate (%)</option>
          </Select>
        }
      >
        {series.length > 1 ? <Lines data={series} x="date" series={platforms.map((p) => ({ key: p, color: colorFor(p) }))} height={240} area={platforms.length === 1} /> : <Empty icon={BarChart3} title="Record at least two snapshots to see a trend" compact />}
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Posts published per month">
          {pub.platforms.length ? <Bars data={pub.data} x="month" series={pub.platforms.map((p) => ({ key: p, color: colorFor(p) }))} stacked height={200} /> : <p className="text-[13px] text-faint">No published content yet.</p>}
        </Card>
        <Card title="Top posts by engagement">
          {top.length ? (
            top.map(({ c, eng, rate }) => (
              <div key={c.id} className="flex items-center gap-2 py-1.5 text-[13px]">
                <PlatformDot p={c.platform} />
                <span className="flex-1 truncate">{c.title}</span>
                <span className="tabular-nums text-muted">{compactNumber(eng)}</span>
                <span className="w-14 text-right text-xs tabular-nums text-faint">{rate !== null ? `${rate.toFixed(1)}%` : ''}</span>
              </div>
            ))
          ) : (
            <p className="text-[13px] text-faint">Add performance figures to published posts to rank them.</p>
          )}
        </Card>
      </div>
      <SnapshotTable snaps={social} />
      {adding && <SnapshotModal platforms={settings.platforms} onClose={() => setAdding(false)} />}
    </div>
  );
}

function SnapshotTable({ snaps }: { snaps: SocialSnapshot[] }) {
  const { toast } = useFeedback();
  const [show, setShow] = useState(false);
  if (!snaps.length) return null;
  return (
    <div className="card">
      <button onClick={() => setShow((s) => !s)} className="w-full px-4 py-3 text-left text-[13px] font-semibold">
        {show ? 'Hide' : 'Show'} recorded snapshots ({snaps.length})
      </button>
      {show && (
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full min-w-[620px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-2xs uppercase tracking-wider text-faint">
                {['Date', 'Platform', 'Followers', 'Reach', 'Impressions', 'Engagement', 'Views', ''].map((h) => (
                  <th key={h} className="px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...snaps]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((s) => (
                  <tr key={s.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2">{fmtDate(s.date, 'd MMM yyyy')}</td>
                    <td className="px-3 py-2">{s.platform}</td>
                    {(['followers', 'reach', 'impressions', 'engagement', 'views'] as const).map((k) => (
                      <td key={k} className="px-3 py-2 tabular-nums">
                        {s[k] ?? '—'}
                      </td>
                    ))}
                    <td className="px-2">
                      <IconButton
                        icon={Trash2}
                        size="sm"
                        label="Delete snapshot"
                        onClick={async () => {
                          await softDelete('social', s.id);
                          toast('Snapshot deleted', { action: { label: 'Undo', onClick: () => restore('social', s.id) } });
                        }}
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SnapshotModal({ platforms, onClose }: { platforms: string[]; onClose: () => void }) {
  const [s, setS] = useState<Partial<SocialSnapshot>>({ platform: platforms[0], date: todayISO() });
  const { toast } = useFeedback();
  const num = (k: keyof SocialSnapshot) => (
    <Input type="number" min={0} value={(s[k] as number | undefined) ?? ''} onChange={(e) => setS({ ...s, [k]: e.target.value === '' ? null : Number(e.target.value) })} />
  );
  return (
    <Modal
      open
      onClose={onClose}
      title="Record social metrics"
      description="Copy the numbers from the platform's own analytics for a given date."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              await create<SocialSnapshot>('social', { platform: s.platform!, date: s.date!, followers: s.followers ?? null, reach: s.reach ?? null, impressions: s.impressions ?? null, engagement: s.engagement ?? null, views: s.views ?? null });
              toast('Metrics recorded');
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Platform">
          <Select value={s.platform} onChange={(e) => setS({ ...s, platform: e.target.value })}>
            {platforms.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
        </Field>
        <Field label="Date">
          <Input type="date" value={s.date} onChange={(e) => setS({ ...s, date: e.target.value })} />
        </Field>
        <Field label="Followers">{num('followers')}</Field>
        <Field label="Reach">{num('reach')}</Field>
        <Field label="Impressions">{num('impressions')}</Field>
        <Field label="Engagement" hint="Likes + comments + shares + saves">
          {num('engagement')}
        </Field>
        <Field label="Views">{num('views')}</Field>
      </div>
    </Modal>
  );
}
