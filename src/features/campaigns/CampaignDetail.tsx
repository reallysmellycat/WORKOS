import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, BarChart3, CheckSquare, FileText, Flag, Info, Link2, MoreHorizontal, Newspaper, NotebookPen, Paperclip, Plus, Sparkles, Target, Trash2, X } from 'lucide-react';
import { db } from '@/lib/db';
import { useDraft } from '@/lib/hooks';
import { CAMPAIGN_STATUSES, contentStatusMeta, engagementOf, prStatusMeta } from '@/lib/domain';
import { create, softDelete } from '@/lib/repo';
import type { Campaign, Coverage, Doc, Note } from '@/lib/types';
import { cn, compactNumber, fmtDate, fmtNumber, uid } from '@/lib/utils';
import { Badge, Button, Card, Checkbox, DemoBadge, Empty, Field, IconButton, Input, Loading, Menu, Page, Progress, SavedIndicator, Select, Stat, Tabs, Textarea } from '@/components/ui';
import { Attachments, Backlinks, CustomFields, LinksEditor, ProjectSelect, TagInput } from '@/components/pickers';
import { MarkdownEditor } from '@/components/Markdown';
import { Bars } from '@/components/charts';
import { useFeedback } from '@/components/feedback';
import { useApp } from '@/app/context';
import { CoverageModal, newPressRelease, PressReleaseDrawer } from './editors';
import { CoverageTable } from './CampaignsPage';
import { TaskRow } from '../tasks/TaskRow';

type Tab = 'overview' | 'pr' | 'content' | 'results' | 'files';

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { draft, set, status, record } = useDraft<Campaign>('campaigns', id);
  const { confirm, toast } = useFeedback();
  const { settings, quickAdd, openContent } = useApp();
  const [tab, setTab] = useState<Tab>('overview');
  const [release, setRelease] = useState<string | null>(null);
  const [cov, setCov] = useState<Coverage | null | 'new'>(null);

  const rel = useLiveQuery(async () => {
    if (!id) return null;
    const releases = (await db.pressReleases.where('campaignId').equals(id).toArray()).filter((r) => !r.deletedAt);
    const coverage = (await db.coverage.where('campaignId').equals(id).toArray()).filter((r) => !r.deletedAt);
    const content = (await db.content.where('campaignId').equals(id).toArray()).filter((r) => !r.deletedAt);
    const tasks = (await db.tasks.where('campaignId').equals(id).toArray()).filter((r) => !r.deletedAt);
    return { releases, coverage, content, tasks };
  }, [id]);

  const perf = useMemo(() => {
    if (!rel) return null;
    const reach = rel.coverage.reduce((s, c) => s + (c.reach ?? 0), 0);
    const pub = rel.content.filter((c) => c.status === 'published');
    const cReach = pub.reduce((s, c) => s + (c.metrics.reach ?? 0), 0);
    const cEng = pub.reduce((s, c) => s + engagementOf(c.metrics), 0);
    const byMonth = new Map<string, { month: string; coverage: number; posts: number }>();
    for (const c of rel.coverage) if (c.date) {
      const k = c.date.slice(0, 7);
      const row = byMonth.get(k) ?? { month: k, coverage: 0, posts: 0 };
      row.coverage++;
      byMonth.set(k, row);
    }
    for (const c of pub) if (c.publishDate) {
      const k = c.publishDate.slice(0, 7);
      const row = byMonth.get(k) ?? { month: k, coverage: 0, posts: 0 };
      row.posts++;
      byMonth.set(k, row);
    }
    const timeline = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)).map((r) => ({ ...r, month: fmtDate(r.month + '-01', 'MMM yy') }));
    const sentiment = { positive: rel.coverage.filter((c) => c.sentiment === 'positive').length, neutral: rel.coverage.filter((c) => c.sentiment === 'neutral').length, negative: rel.coverage.filter((c) => c.sentiment === 'negative').length };
    return { reach, cReach, cEng, published: pub.length, timeline, sentiment };
  }, [rel]);

  if (record === null || (record && record.deletedAt))
    return (
      <Page>
        <Empty icon={Info} title="Campaign not found" action={<Link to="/campaigns" className="text-body-s text-accent-deep hover:underline">All campaigns</Link>} />
      </Page>
    );
  if (!draft || !rel || !perf) return <Loading />;

  const remove = async () => {
    const ok = await confirm({ title: 'Move campaign to Trash?', message: `"${draft.name}" will be moved to the Trash. Linked press releases, coverage and content are kept.`, confirmLabel: 'Move to Trash', danger: true });
    if (!ok) return;
    await softDelete('campaigns', draft.id);
    toast('Campaign moved to Trash');
    navigate('/campaigns');
  };
  const newNote = async () => {
    const n = await create<Note>('notes', { title: `${draft.name} — notes`, body: '', kind: 'note', tags: [], refs: [{ type: 'campaign', id: draft.id }] });
    navigate(`/notes/${n.id}`);
  };
  const newBrief = async () => {
    const d = await create<Doc>('documents', {
      title: `${draft.name} — campaign brief`,
      body: `# ${draft.name}\n\n## Objectives\n${draft.objectives ?? ''}\n\n## Audience\n${draft.audience ?? ''}\n\n## Key messages\n${draft.keyMessages ?? ''}\n\n## Timeline\n\n## Budget\n`,
      docType: 'brief',
      status: 'draft',
      tags: [],
      refs: [{ type: 'campaign', id: draft.id }],
    });
    navigate(`/documents/${d.id}`);
  };
  const actDone = draft.activities.filter((a) => a.done).length;
  const budgetPct = draft.budget ? ((draft.spent ?? 0) / draft.budget) * 100 : 0;

  return (
    <Page>
      <div className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate('/campaigns')}>
          Campaigns
        </Button>
        {draft.isDemo && <DemoBadge />}
        <div className="flex-1" />
        <SavedIndicator status={status} />
        <Menu
          trigger={(t) => <IconButton icon={MoreHorizontal} label="Campaign actions" onClick={t} />}
          items={[
            { label: 'Create campaign brief', icon: FileText, onClick: newBrief },
            { label: 'New linked note', icon: NotebookPen, onClick: newNote },
            'divider',
            { label: 'Move to Trash', icon: Trash2, danger: true, onClick: remove },
          ]}
        />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <Textarea autoGrow rows={1} value={draft.name} onChange={(e) => set({ name: e.target.value.replace(/\n/g, ' ') })} className="!border-0 !bg-transparent !px-0 !ring-0 font-serif text-h2 font-medium leading-tight tracking-tight" aria-label="Campaign name" />
          <Textarea autoGrow rows={1} value={draft.description ?? ''} onChange={(e) => set({ description: e.target.value })} placeholder="Short description" className="!border-0 !bg-transparent !px-0 !ring-0 text-body-m text-muted" />

          <div className="mb-5 mt-4">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { value: 'overview', label: 'Overview' },
                { value: 'pr', label: 'Press & coverage', count: rel.releases.length + rel.coverage.length },
                { value: 'content', label: 'Content & tasks', count: rel.content.length + rel.tasks.length },
                { value: 'results', label: 'Results' },
                { value: 'files', label: 'Notes & files' },
              ]}
            />
          </div>

          {tab === 'overview' && (
            <div className="space-y-4">
              <Card title="Objectives" icon={Target}>
                <MarkdownEditor value={draft.objectives ?? ''} onChange={(v) => set({ objectives: v })} minHeight={80} placeholder="What should this campaign achieve?" />
              </Card>
              <div className="grid gap-4 md:grid-cols-2">
                <Card title="Target audience">
                  <Textarea autoGrow rows={3} value={draft.audience ?? ''} onChange={(e) => set({ audience: e.target.value })} placeholder="Who are you trying to reach?" className="!border-0 !bg-transparent !px-0 !ring-0" />
                </Card>
                <Card title="Key messages">
                  <Textarea autoGrow rows={3} value={draft.keyMessages ?? ''} onChange={(e) => set({ keyMessages: e.target.value })} placeholder="- Message one&#10;- Message two" className="!border-0 !bg-transparent !px-0 !ring-0" />
                </Card>
              </div>
              <Card title={`Activities · ${actDone}/${draft.activities.length}`} icon={Flag}>
                <Activities campaign={draft} onChange={(activities) => set({ activities })} />
              </Card>
              <Card title="Campaign notes">
                <Textarea autoGrow rows={3} value={draft.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} className="!border-0 !bg-transparent !px-0 !ring-0" placeholder="Working notes" />
              </Card>
            </div>
          )}

          {tab === 'pr' && (
            <div className="space-y-4">
              <Card
                title="Press releases"
                icon={FileText}
                action={
                  <Button size="xs" icon={Plus} onClick={async () => setRelease((await newPressRelease(draft.id)).id)}>
                    New release
                  </Button>
                }
              >
                {rel.releases.length === 0 ? (
                  <p className="text-body-s text-faint">No press releases yet.</p>
                ) : (
                  rel.releases.map((r) => (
                    <button key={r.id} onClick={() => setRelease(r.id)} className="-mx-1.5 flex w-full items-center gap-3 rounded-sm px-1.5 py-2 text-left row-hover">
                      <FileText className="h-3.5 w-3.5 text-faint" />
                      <span className="flex-1 truncate text-body-m">{r.title}</span>
                      <span className="text-body-s text-faint">{r.distributionDate ? fmtDate(r.distributionDate) : 'No date'}</span>
                      <Badge tone={prStatusMeta(r.status).tone}>{prStatusMeta(r.status).label}</Badge>
                    </button>
                  ))
                )}
              </Card>
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-body-s font-semibold">
                  <Newspaper className="h-3.5 w-3.5 text-faint" /> Coverage
                </h3>
                <Button size="xs" icon={Plus} onClick={() => setCov('new')}>
                  Log coverage
                </Button>
              </div>
              <CoverageTable coverage={rel.coverage} onEdit={(c) => setCov(c)} />
              <Card title="Media links" icon={Link2}>
                <LinksEditor links={draft.mediaLinks} onChange={(mediaLinks) => set({ mediaLinks })} />
              </Card>
            </div>
          )}

          {tab === 'content' && (
            <div className="space-y-4">
              <Card
                title="Related content"
                icon={Sparkles}
                action={
                  <Button size="xs" icon={Plus} onClick={() => quickAdd({ type: 'content', campaignId: draft.id })}>
                    New content
                  </Button>
                }
              >
                {rel.content.length === 0 ? (
                  <p className="text-body-s text-faint">No content linked. Set the campaign on a content item to see it here.</p>
                ) : (
                  rel.content
                    .sort((a, b) => (a.publishDate ?? '').localeCompare(b.publishDate ?? ''))
                    .map((c) => (
                      <button key={c.id} onClick={() => openContent(c.id)} className="-mx-1.5 flex w-full items-center gap-3 rounded-sm px-1.5 py-2 text-left row-hover">
                        <span className="w-20 shrink-0 text-body-s text-faint">{c.publishDate ? fmtDate(c.publishDate) : 'No date'}</span>
                        <span className="flex-1 truncate text-body-m">{c.title}</span>
                        <span className="text-body-s text-faint">{c.platform}</span>
                        <Badge tone={contentStatusMeta(c.status).tone}>{contentStatusMeta(c.status).label}</Badge>
                      </button>
                    ))
                )}
              </Card>
              <Card
                title="Tasks"
                icon={CheckSquare}
                action={
                  <Button size="xs" icon={Plus} onClick={() => quickAdd({ type: 'task', campaignId: draft.id })}>
                    New task
                  </Button>
                }
              >
                {rel.tasks.length === 0 ? <p className="text-body-s text-faint">No tasks linked to this campaign.</p> : <div className="-mx-2">{rel.tasks.map((t) => <TaskRow key={t.id} task={t} compact />)}</div>}
              </Card>
            </div>
          )}

          {tab === 'results' && (
            <div className="space-y-4">
              <div className="card grid grid-cols-2 gap-5 p-5 sm:grid-cols-4">
                <Stat label="Coverage" value={rel.coverage.length} sub={`${perf.sentiment.positive} positive`} />
                <Stat label="Coverage reach" value={compactNumber(perf.reach)} />
                <Stat label="Posts published" value={perf.published} />
                <Stat label="Content engagement" value={compactNumber(perf.cEng)} sub={perf.cReach ? `${((perf.cEng / perf.cReach) * 100).toFixed(1)}% of reach` : undefined} />
              </div>
              <Card title="Activity over time" icon={BarChart3}>
                {perf.timeline.length ? (
                  <Bars data={perf.timeline} x="month" series={[{ key: 'coverage', label: 'Coverage' }, { key: 'posts', label: 'Posts published' }]} height={220} />
                ) : (
                  <p className="text-body-s text-faint">Log coverage or publish linked content to see results over time.</p>
                )}
              </Card>
              <Card title="Results summary">
                <MarkdownEditor value={draft.results ?? ''} onChange={(v) => set({ results: v })} minHeight={120} placeholder="What happened? What worked, what didn't, what you'd repeat." />
              </Card>
              <p className="text-body-s text-faint">Figures are calculated from coverage and content you've logged. Nothing is pulled automatically from external platforms.</p>
            </div>
          )}

          {tab === 'files' && (
            <div className="space-y-4">
              <Card
                title="Linked notes & documents"
                icon={NotebookPen}
                action={
                  <div className="flex gap-1">
                    <Button size="xs" icon={Plus} onClick={newNote}>
                      Note
                    </Button>
                    <Button size="xs" icon={Plus} onClick={newBrief}>
                      Brief
                    </Button>
                  </div>
                }
              >
                <Backlinks target={{ type: 'campaign', id: draft.id }} />
              </Card>
              <Card title="Files" icon={Paperclip}>
                <Attachments owner={{ type: 'campaign', id: draft.id }} />
              </Card>
            </div>
          )}
        </div>

        <aside className="w-full shrink-0 space-y-4 lg:w-[290px]">
          <div className="card space-y-3 p-4">
            <Field label="Status">
              <Select value={draft.status} onChange={(e) => set({ status: e.target.value as Campaign['status'] })}>
                {CAMPAIGN_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Start">
                <Input type="date" value={draft.startDate ?? ''} onChange={(e) => set({ startDate: e.target.value || null })} />
              </Field>
              <Field label="End">
                <Input type="date" value={draft.endDate ?? ''} onChange={(e) => set({ endDate: e.target.value || null })} />
              </Field>
            </div>
            <Field label="Project">
              <ProjectSelect value={draft.projectId} onChange={(v) => set({ projectId: v })} />
            </Field>
            <Field label="Tags">
              <TagInput value={draft.tags} onChange={(tags) => set({ tags })} />
            </Field>
            <CustomFields entity="campaign" values={draft.custom} onChange={(custom) => set({ custom })} />
          </div>
          <div className="card space-y-3 p-4">
            <div className="text-body-s font-semibold">Budget (optional)</div>
            <div className="grid grid-cols-2 gap-2">
              <Field label={`Budget (${draft.currency ?? settings.currency})`}>
                <Input type="number" min={0} value={draft.budget ?? ''} onChange={(e) => set({ budget: e.target.value === '' ? null : Number(e.target.value) })} />
              </Field>
              <Field label="Spent">
                <Input type="number" min={0} value={draft.spent ?? ''} onChange={(e) => set({ spent: e.target.value === '' ? null : Number(e.target.value) })} />
              </Field>
            </div>
            {!!draft.budget && (
              <div>
                <Progress value={budgetPct} tone={budgetPct > 100 ? 'warn' : 'accent'} />
                <p className={cn('mt-1.5 text-body-s', budgetPct > 100 ? 'text-warn' : 'text-muted')}>
                  {fmtNumber(draft.spent ?? 0)} of {fmtNumber(draft.budget)} spent ({Math.round(budgetPct)}%)
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      <PressReleaseDrawer id={release} onClose={() => setRelease(null)} />
      {cov && <CoverageModal coverage={cov === 'new' ? null : cov} campaignId={draft.id} onClose={() => setCov(null)} />}
    </Page>
  );
}

function Activities({ campaign, onChange }: { campaign: Campaign; onChange: (a: Campaign['activities']) => void }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const list = [...campaign.activities].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
  const add = () => {
    if (!title.trim()) return;
    onChange([...campaign.activities, { id: uid(), title: title.trim(), date: date || null, done: false }]);
    setTitle('');
    setDate('');
  };
  return (
    <div>
      {list.map((a) => (
        <div key={a.id} className="group flex items-center gap-2 rounded-sm px-1 py-1.5 row-hover">
          <Checkbox size="sm" checked={a.done} onChange={(v) => onChange(campaign.activities.map((x) => (x.id === a.id ? { ...x, done: v } : x)))} />
          <input value={a.title} onChange={(e) => onChange(campaign.activities.map((x) => (x.id === a.id ? { ...x, title: e.target.value } : x)))} className={cn('min-w-0 flex-1 bg-transparent text-body-m outline-none', a.done && 'text-faint line-through')} />
          <input type="date" value={a.date ?? ''} onChange={(e) => onChange(campaign.activities.map((x) => (x.id === a.id ? { ...x, date: e.target.value || null } : x)))} className="w-[130px] bg-transparent text-body-s text-muted outline-none" />
          <IconButton icon={X} size="sm" label="Remove" className="opacity-0 group-hover:opacity-100" onClick={() => onChange(campaign.activities.filter((x) => x.id !== a.id))} />
        </div>
      ))}
      <div className="mt-2 flex gap-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="New activity (e.g. media briefing)" className="flex-1" />
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[150px]" />
        <Button icon={Plus} onClick={add} disabled={!title.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}
