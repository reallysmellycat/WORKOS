import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Gauge, MoreHorizontal, Pencil, Plus, Target, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { subMonths } from 'date-fns';
import { useCampaigns, useContent, useCoverage, useKPIEntries, useKPIs, useProjects, useTasks } from '@/lib/hooks';
import { CAMPAIGN_STATUSES, colorFor, PROJECT_STATUSES, projectProgress, TASK_STATUSES } from '@/lib/domain';
import { create, restore, softDelete, update } from '@/lib/repo';
import type { KPI, KPIEntry } from '@/lib/types';
import { cn, compactNumber, fmtDate, fmtNumber, monthKey, todayISO } from '@/lib/utils';
import { Badge, Button, Card, Empty, Field, IconButton, Input, Loading, Menu, Modal, Page, PageHeader, Progress, Select, Stat, Tabs, Textarea } from '@/components/ui';
import { Bars, StatusBar } from '@/components/charts';
import { useFeedback } from '@/components/feedback';
import { completedByWeek, contentTotals, coverageByMonth, projectsCompletedByMonth, publishedByMonth } from './metrics';

type Tab = 'overview' | 'kpis';

const TONE_COLOR: Record<string, string> = { muted: '#A6A196', info: '#5E7F9E', warn: '#B88A4E', ok: '#6F8F6C', neutral: '#8C8780', accent: '#6F8F6C', danger: '#B5574B' };

export default function AnalyticsPage() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get('kpi') ? 'kpis' : 'overview');
  return (
    <Page>
      <PageHeader title="Analytics" subtitle="Calculated from the data you've recorded in Work OS — nothing is estimated or pulled from outside." actions={<Tabs value={tab} onChange={setTab} tabs={[{ value: 'overview', label: 'Overview', icon: BarChart3 }, { value: 'kpis', label: 'KPIs', icon: Target }]} />} />
      {tab === 'overview' ? <Overview /> : <KPIs focus={params.get('kpi')} />}
    </Page>
  );
}

function delta(cur: number, prev: number) {
  if (!prev) return cur ? { text: 'new this month', tone: 'ok' as const } : { text: 'same as last month', tone: 'muted' as const };
  const d = cur - prev;
  return { text: `${d >= 0 ? '+' : ''}${d} vs last month`, tone: d >= 0 ? ('ok' as const) : ('danger' as const) };
}

function Overview() {
  const tasks = useTasks();
  const projects = useProjects();
  const content = useContent();
  const coverage = useCoverage();
  const campaigns = useCampaigns();
  const weeks = useMemo(() => (tasks ? completedByWeek(tasks, 12) : []), [tasks]);
  if (!tasks || !projects || !content || !coverage || !campaigns) return <Loading />;

  const thisM = monthKey(new Date());
  const lastM = monthKey(subMonths(new Date(), 1));
  const doneIn = (m: string) => tasks.filter((t) => t.completedAt && monthKey(new Date(t.completedAt)) === m).length;
  const pubIn = (m: string) => content.filter((c) => c.status === 'published' && c.publishDate?.startsWith(m)).length;
  const covIn = (m: string) => coverage.filter((c) => c.date?.startsWith(m)).length;
  const projDoneIn = (m: string) => projects.filter((p) => p.status === 'completed' && p.completedAt && monthKey(new Date(p.completedAt)) === m).length;

  const pub = publishedByMonth(content, 6);
  const cov = coverageByMonth(coverage, 6);
  const projDone = projectsCompletedByMonth(projects, 6);
  const totals = contentTotals(content);
  const topTasks = tasks.filter((t) => !t.parentId);
  const active = projects.filter((p) => p.status === 'in_progress' || p.status === 'planning');

  return (
    <div className="space-y-5">
      <div className="card grid grid-cols-2 gap-5 p-5 md:grid-cols-5">
        <Stat label="Tasks completed" value={doneIn(thisM)} sub={delta(doneIn(thisM), doneIn(lastM)).text} tone={delta(doneIn(thisM), doneIn(lastM)).tone} />
        <Stat label="Active projects" value={active.length} sub={`${projects.filter((p) => p.status === 'on_hold').length} on hold`} tone="muted" />
        <Stat label="Projects completed" value={projDoneIn(thisM)} sub={`${projects.filter((p) => p.status === 'completed').length} all time`} tone="muted" />
        <Stat label="Content published" value={pubIn(thisM)} sub={delta(pubIn(thisM), pubIn(lastM)).text} tone={delta(pubIn(thisM), pubIn(lastM)).tone} />
        <Stat label="Coverage pieces" value={covIn(thisM)} sub={delta(covIn(thisM), covIn(lastM)).text} tone={delta(covIn(thisM), covIn(lastM)).tone} />
      </div>

      <Card title="Task throughput · last 12 weeks">
        <Bars data={weeks} x="label" series={[{ key: 'created', label: 'Created', color: '#C9C2B4' }, { key: 'completed', label: 'Completed' }]} height={230} />
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Tasks by status">
          <StatusBar parts={TASK_STATUSES.map((s) => ({ label: s.label, value: topTasks.filter((t) => t.status === s.value).length, color: TONE_COLOR[s.tone] }))} />
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-[17px] font-semibold tabular-nums text-danger">{topTasks.filter((t) => t.status !== 'completed' && t.dueDate && t.dueDate < todayISO()).length}</div>
              <div className="text-2xs uppercase tracking-wide text-faint">Overdue</div>
            </div>
            <div>
              <div className="text-[17px] font-semibold tabular-nums">{topTasks.filter((t) => t.status !== 'completed' && !t.dueDate).length}</div>
              <div className="text-2xs uppercase tracking-wide text-faint">No due date</div>
            </div>
            <div>
              <div className="text-[17px] font-semibold tabular-nums">{topTasks.filter((t) => t.recurrence && t.status !== 'completed').length}</div>
              <div className="text-2xs uppercase tracking-wide text-faint">Recurring</div>
            </div>
          </div>
        </Card>
        <Card title="Projects">
          <StatusBar parts={PROJECT_STATUSES.map((s) => ({ label: s.label, value: projects.filter((p) => p.status === s.value).length, color: TONE_COLOR[s.tone] }))} />
          <div className="mt-4">
            <Bars data={projDone} x="month" series={[{ key: 'completed', label: 'Completed projects' }]} height={120} />
          </div>
        </Card>
      </div>

      <Card title="Project progress">
        {active.length === 0 ? (
          <p className="text-[13px] text-faint">No active projects.</p>
        ) : (
          <div className="space-y-3">
            {active.map((p) => {
              const prog = projectProgress(p, tasks);
              return (
                <Link key={p.id} to={`/projects/${p.id}`} className="-mx-2 grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 rounded-md px-2 py-1 sm:grid-cols-[220px_1fr_auto] row-hover">
                  <span className="truncate text-[13px] font-medium">{p.title}</span>
                  <span className="text-xs tabular-nums text-muted sm:order-last">{prog.percent}%</span>
                  <div className="col-span-2 sm:col-span-1">
                    <Progress value={prog.percent} />
                    <div className="mt-0.5 text-2xs text-faint">{prog.explanation}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Content published per month">
          {pub.platforms.length ? <Bars data={pub.data} x="month" series={pub.platforms.map((p) => ({ key: p, color: colorFor(p) }))} stacked height={200} /> : <p className="text-[13px] text-faint">No published content yet.</p>}
          <div className="mt-3 flex gap-5 text-xs text-muted">
            <span>
              Total reach <strong className="text-fg tabular-nums">{compactNumber(totals.reach)}</strong>
            </span>
            <span>
              Engagement <strong className="text-fg tabular-nums">{compactNumber(totals.engagement)}</strong>
            </span>
            <span>
              Avg. rate <strong className="text-fg tabular-nums">{totals.rate !== null ? `${totals.rate.toFixed(1)}%` : '—'}</strong>
            </span>
          </div>
        </Card>
        <Card title="Coverage per month">
          <Bars data={cov} x="month" series={[{ key: 'pieces', label: 'Pieces' }]} height={200} />
          <div className="mt-3 text-xs text-muted">
            Reach over 6 months <strong className="text-fg tabular-nums">{compactNumber(cov.reduce((s, c) => s + c.reach, 0))}</strong>
          </div>
        </Card>
      </div>

      <Card title="Campaign performance" padded={false}>
        {campaigns.length === 0 ? (
          <p className="px-4 pb-4 text-[13px] text-faint">No campaigns yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead>
                <tr className="border-y border-line text-left text-2xs uppercase tracking-wider text-faint">
                  <th className="px-4 py-2 font-semibold">Campaign</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 text-right font-semibold">Coverage</th>
                  <th className="px-3 py-2 text-right font-semibold">Reach</th>
                  <th className="px-3 py-2 text-right font-semibold">Positive</th>
                  <th className="px-3 py-2 text-right font-semibold">Posts</th>
                  <th className="px-4 py-2 text-right font-semibold">Budget used</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const cv = coverage.filter((x) => x.campaignId === c.id);
                  const posts = content.filter((x) => x.campaignId === c.id && x.status === 'published').length;
                  const st = CAMPAIGN_STATUSES.find((s) => s.value === c.status)!;
                  return (
                    <tr key={c.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-2.5">
                        <Link to={`/campaigns/${c.id}`} className="font-medium hover:text-accent">
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{cv.length}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{compactNumber(cv.reduce((s, x) => s + (x.reach ?? 0), 0))}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{cv.length ? `${Math.round((cv.filter((x) => x.sentiment === 'positive').length / cv.length) * 100)}%` : '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{posts}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{c.budget ? `${Math.round(((c.spent ?? 0) / c.budget) * 100)}%` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------- KPIs ----------

function kpiStats(k: KPI, entries: KPIEntry[]) {
  const list = entries.filter((e) => e.kpiId === k.id).sort((a, b) => a.date.localeCompare(b.date));
  const cur = list[list.length - 1];
  const prev = list[list.length - 2];
  const change = cur && prev ? cur.value - prev.value : null;
  const changePct = cur && prev && prev.value ? ((cur.value - prev.value) / Math.abs(prev.value)) * 100 : null;
  const good = change === null ? null : k.direction === 'up' ? change >= 0 : change <= 0;
  const toTarget = k.target && cur ? (k.direction === 'up' ? (cur.value / k.target) * 100 : (k.target / Math.max(cur.value, 1e-9)) * 100) : null;
  return { list, cur, prev, change, changePct, good, toTarget };
}

function KPIs({ focus }: { focus: string | null }) {
  const kpis = useKPIs();
  const entries = useKPIEntries();
  const { toast, confirm } = useFeedback();
  const [editing, setEditing] = useState<KPI | 'new' | null>(null);
  const [recording, setRecording] = useState<KPI | null>(null);
  const [historyFor, setHistoryFor] = useState<KPI | null>(null);

  useEffect(() => {
    if (focus) document.getElementById(`kpi-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focus, kpis]);

  if (!kpis || !entries) return <Loading />;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-muted">Track anything that matters to you — define the measure, a target, and record values over time.</p>
        <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>
          New KPI
        </Button>
      </div>
      {kpis.length === 0 ? (
        <div className="card">
          <Empty icon={Gauge} title="No KPIs yet" action={<Button icon={Plus} onClick={() => setEditing('new')}>Create a KPI</Button>}>
            Examples: earned media pieces per month, newsletter subscribers, proposals sent, speaking engagements.
          </Empty>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {kpis.map((k) => {
            const st = kpiStats(k, entries);
            const data = st.list.map((e) => ({ date: fmtDate(e.date, 'd MMM'), value: e.value }));
            return (
              <section key={k.id} id={`kpi-${k.id}`} className={cn('card p-4', focus === k.id && 'ring-2 ring-accent/40')}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[14px] font-semibold">{k.name}</h3>
                    <p className="text-xs text-faint">
                      {k.period[0].toUpperCase() + k.period.slice(1)} · {k.direction === 'up' ? 'higher is better' : 'lower is better'}
                      {k.unit ? ` · ${k.unit}` : ''}
                    </p>
                  </div>
                  <Button size="xs" icon={Plus} onClick={() => setRecording(k)}>
                    Record value
                  </Button>
                  <Menu
                    trigger={(t) => <IconButton icon={MoreHorizontal} size="sm" label="KPI actions" onClick={t} />}
                    items={[
                      { label: 'Edit KPI', icon: Pencil, onClick: () => setEditing(k) },
                      { label: 'View / edit history', icon: BarChart3, onClick: () => setHistoryFor(k) },
                      'divider',
                      {
                        label: 'Delete KPI',
                        icon: Trash2,
                        danger: true,
                        onClick: async () => {
                          if (!(await confirm({ title: `Delete “${k.name}”?`, message: 'The KPI and its history move to the Trash.', confirmLabel: 'Delete', danger: true }))) return;
                          await softDelete('kpis', k.id);
                          toast('KPI moved to Trash', { action: { label: 'Undo', onClick: () => restore('kpis', k.id) } });
                        },
                      },
                    ]}
                  />
                </div>
                <div className="mt-3 flex items-end gap-4">
                  <div>
                    <div className="text-[28px] font-semibold leading-none tabular-nums">{st.cur ? fmtNumber(st.cur.value) : '—'}</div>
                    <div className="mt-1 text-xs text-faint">{st.cur ? `as of ${fmtDate(st.cur.date, 'd MMM yyyy')}` : 'No values yet'}</div>
                  </div>
                  {st.change !== null && (
                    <span className={cn('mb-4 inline-flex items-center gap-1 text-xs', st.good ? 'text-ok' : 'text-danger')}>
                      {st.change >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                      {st.change >= 0 ? '+' : ''}
                      {fmtNumber(st.change)}
                      {st.changePct !== null && ` (${st.changePct >= 0 ? '+' : ''}${st.changePct.toFixed(0)}%)`} vs previous
                    </span>
                  )}
                  <div className="flex-1" />
                  {k.target != null && (
                    <div className="w-32 text-right">
                      <div className="text-xs text-muted">
                        Target <span className="tabular-nums text-fg">{fmtNumber(k.target)}</span>
                      </div>
                      <Progress className="mt-1" value={st.toTarget ?? 0} tone={(st.toTarget ?? 0) >= 100 ? 'ok' : 'accent'} />
                    </div>
                  )}
                </div>
                {data.length > 1 ? (
                  <div className="mt-4 h-[150px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} minTickGap={12} />
                        <YAxis tickLine={false} axisLine={false} fontSize={11} width={44} tickFormatter={(v) => compactNumber(v)} domain={['auto', 'auto']} />
                        <Tooltip contentStyle={{ background: 'rgb(var(--raised))', border: '1px solid rgb(var(--line))', borderRadius: 6, fontSize: 12 }} />
                        {k.target != null && <ReferenceLine y={k.target} stroke="rgb(var(--faint))" strokeDasharray="4 4" label={{ value: 'Target', position: 'insideTopRight', fontSize: 10, fill: 'rgb(var(--faint))' }} />}
                        <Line type="monotone" dataKey="value" name={k.name} stroke={k.color ?? '#6F8F6C'} strokeWidth={2} dot={{ r: 2.5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-faint">Record at least two values to see a trend.</p>
                )}
                {k.description && <p className="mt-2 text-xs text-muted">{k.description}</p>}
              </section>
            );
          })}
        </div>
      )}
      {editing && <KPIModal kpi={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {recording && <RecordModal kpi={recording} onClose={() => setRecording(null)} />}
      {historyFor && <HistoryModal kpi={historyFor} entries={entries.filter((e) => e.kpiId === historyFor.id)} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}

function KPIModal({ kpi, onClose }: { kpi: KPI | null; onClose: () => void }) {
  const [k, setK] = useState<Partial<KPI>>(kpi ?? { name: '', period: 'monthly', direction: 'up' });
  const save = async () => {
    if (!k.name?.trim()) return;
    if (kpi) await update<KPI>('kpis', kpi.id, k);
    else await create<KPI>('kpis', { ...(k as KPI), name: k.name.trim() });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={kpi ? 'Edit KPI' : 'New KPI'} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={!k.name?.trim()}>Save</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" className="col-span-2">
          <Input autoFocus value={k.name ?? ''} onChange={(e) => setK({ ...k, name: e.target.value })} placeholder="e.g. Earned media pieces" />
        </Field>
        <Field label="Description" className="col-span-2">
          <Textarea rows={2} value={k.description ?? ''} onChange={(e) => setK({ ...k, description: e.target.value })} placeholder="How it's measured" />
        </Field>
        <Field label="Unit">
          <Input value={k.unit ?? ''} onChange={(e) => setK({ ...k, unit: e.target.value })} placeholder="e.g. pieces, %, ¥" />
        </Field>
        <Field label="Target">
          <Input type="number" value={k.target ?? ''} onChange={(e) => setK({ ...k, target: e.target.value === '' ? null : Number(e.target.value) })} />
        </Field>
        <Field label="Measurement period">
          <Select value={k.period} onChange={(e) => setK({ ...k, period: e.target.value as KPI['period'] })}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </Select>
        </Field>
        <Field label="Better when">
          <Select value={k.direction} onChange={(e) => setK({ ...k, direction: e.target.value as KPI['direction'] })}>
            <option value="up">Higher</option>
            <option value="down">Lower</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

function RecordModal({ kpi, onClose }: { kpi: KPI; onClose: () => void }) {
  const [date, setDate] = useState(todayISO());
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const save = async () => {
    if (value === '' || Number.isNaN(Number(value))) return;
    await create<KPIEntry>('kpiEntries', { kpiId: kpi.id, date, value: Number(value), note: note || undefined });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={`Record ${kpi.name}`} width="max-w-sm" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={value === ''}>Save</Button></>}>
      <div className="space-y-3">
        <Field label={`Value${kpi.unit ? ` (${kpi.unit})` : ''}`}>
          <Input autoFocus type="number" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
        </Field>
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Note (optional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function HistoryModal({ kpi, entries, onClose }: { kpi: KPI; entries: KPIEntry[]; onClose: () => void }) {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Modal open onClose={onClose} title={`${kpi.name} — history`}>
      {sorted.length === 0 ? (
        <p className="text-[13px] text-faint">No values recorded.</p>
      ) : (
        <div className="divide-y divide-line">
          {sorted.map((e) => (
            <div key={e.id} className="flex items-center gap-3 py-2">
              <Input type="date" className="w-40" defaultValue={e.date} onBlur={(ev) => ev.target.value && ev.target.value !== e.date && update<KPIEntry>('kpiEntries', e.id, { date: ev.target.value }, { log: false })} />
              <Input type="number" className="w-28" defaultValue={e.value} onBlur={(ev) => ev.target.value !== '' && Number(ev.target.value) !== e.value && update<KPIEntry>('kpiEntries', e.id, { value: Number(ev.target.value) }, { log: false })} />
              <span className="flex-1 truncate text-xs text-muted">{e.note}</span>
              <IconButton icon={Trash2} size="sm" label="Delete value" onClick={() => softDelete('kpiEntries', e.id)} />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
