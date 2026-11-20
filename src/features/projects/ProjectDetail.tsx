import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  CalendarDays,
  CheckSquare,
  FileText,
  Flag,
  Info,
  Link2,
  Megaphone,
  MoreHorizontal,
  NotebookPen,
  Paperclip,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { db } from '@/lib/db';
import { useById, useDraft, useTasks } from '@/lib/hooks';
import { campaignStatusMeta, contentStatusMeta, isBlocked, PROJECT_STATUSES, projectProgress, sortByScore } from '@/lib/domain';
import { create, newTask, softDelete } from '@/lib/repo';
import { saveProjectAsTemplate } from '@/lib/templates';
import type { Doc, Note, Project } from '@/lib/types';
import { cn, fmtDate, relativeDay, uid, excerpt } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  DemoBadge,
  Empty,
  Field,
  IconButton,
  Input,
  Loading,
  Menu,
  Modal,
  Page,
  Progress,
  Ring,
  SavedIndicator,
  Select,
  Tabs,
  Textarea,
  Toggle,
} from '@/components/ui';
import { Attachments, CustomFields, LinksEditor, TagInput } from '@/components/pickers';
import { MarkdownEditor } from '@/components/Markdown';
import { ActivityFeed } from '@/components/ActivityFeed';
import { useFeedback } from '@/components/feedback';
import { useApp } from '@/app/context';
import { TaskRow } from '../tasks/TaskRow';

type Tab = 'overview' | 'tasks' | 'knowledge' | 'files' | 'activity';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { draft, set, status, record } = useDraft<Project>('projects', id);
  const tasks = useTasks();
  const taskMap = useById(tasks);
  const { confirm, toast } = useFeedback();
  const { quickAdd, openContent } = useApp();
  const [tab, setTab] = useState<Tab>('overview');
  const [newTitle, setNewTitle] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [tplName, setTplName] = useState<string | null>(null);

  const related = useLiveQuery(async () => {
    if (!id) return null;
    const isRef = (refs?: { type: string; id: string }[]) => refs?.some((r) => r.type === 'project' && r.id === id);
    const notes = (await db.notes.toArray()).filter((n) => !n.deletedAt && isRef(n.refs));
    const docs = (await db.documents.toArray()).filter((d) => !d.deletedAt && isRef(d.refs));
    const campaigns = (await db.campaigns.toArray()).filter((c) => !c.deletedAt && c.projectId === id);
    const content = (await db.content.toArray()).filter((c) => !c.deletedAt && c.projectId === id);
    const fileCount = (await db.files.toArray()).filter((f) => !f.deletedAt && !f.inline && f.owner?.id === id).length;
    return { notes, docs, campaigns, content, fileCount };
  }, [id]);

  const projectTasks = useMemo(() => (tasks ?? []).filter((t) => t.projectId === id && !t.parentId), [tasks, id]);
  const subCounts = useMemo(() => {
    const m = new Map<string, { done: number; total: number }>();
    for (const t of tasks ?? [])
      if (t.parentId) {
        const c = m.get(t.parentId) ?? { done: 0, total: 0 };
        c.total++;
        if (t.status === 'completed') c.done++;
        m.set(t.parentId, c);
      }
    return m;
  }, [tasks]);

  if (record === null || (record && record.deletedAt))
    return (
      <Page>
        <Empty icon={Info} title="Project not found" action={<Link to="/projects" className="text-[13px] text-accent hover:underline">All projects</Link>}>
          It may have been moved to the Trash (Settings → Trash).
        </Empty>
      </Page>
    );
  if (!draft || !tasks || !related) return <Loading />;

  const prog = projectProgress(draft, tasks);
  const open = projectTasks.filter((t) => t.status !== 'completed');
  const done = projectTasks.filter((t) => t.status === 'completed');

  const remove = async () => {
    const ok = await confirm({
      title: 'Move project to Trash?',
      message: `"${draft.title}" will be moved to the Trash. Its ${projectTasks.length} task(s) stay in your task list without a project. You can restore it from Settings → Trash.`,
      confirmLabel: 'Move to Trash',
      danger: true,
    });
    if (!ok) return;
    await softDelete('projects', draft.id);
    toast('Project moved to Trash');
    navigate('/projects');
  };

  const asTemplate = () => setTplName(`${draft.title} template`);
  const saveTemplate = async () => {
    if (!tplName?.trim()) return;
    await saveProjectAsTemplate(draft, tasks, tplName.trim());
    setTplName(null);
    toast('Saved as a custom template — find it in Quick add → Project');
  };

  const newNote = async () => {
    const n = await create<Note>('notes', { title: `${draft.title} — notes`, body: '', kind: 'note', tags: [], refs: [{ type: 'project', id: draft.id }] });
    navigate(`/notes/${n.id}`);
  };
  const newDoc = async () => {
    const d = await create<Doc>('documents', { title: `${draft.title} — brief`, body: '', docType: 'brief', status: 'draft', tags: [], refs: [{ type: 'project', id: draft.id }] });
    navigate(`/documents/${d.id}`);
  };

  return (
    <Page>
      <div className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate('/projects')}>
          Projects
        </Button>
        {draft.isDemo && <DemoBadge />}
        <div className="flex-1" />
        <SavedIndicator status={status} />
        <Menu
          trigger={(t) => <IconButton icon={MoreHorizontal} label="Project actions" onClick={t} />}
          items={[
            { label: 'Save as template', icon: Save, onClick: asTemplate },
            { label: 'New linked note', icon: NotebookPen, onClick: newNote },
            { label: 'New linked document', icon: FileText, onClick: newDoc },
            'divider',
            { label: 'Move to Trash', icon: Trash2, danger: true, onClick: remove },
          ]}
        />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <Textarea
            autoGrow
            rows={1}
            value={draft.title}
            onChange={(e) => set({ title: e.target.value.replace(/\n/g, ' ') })}
            className="!border-0 !bg-transparent !px-0 !ring-0 font-serif text-[30px] font-medium leading-tight tracking-tight"
            aria-label="Project title"
          />
          <Textarea
            autoGrow
            rows={1}
            value={draft.description ?? ''}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="One-line description"
            className="!border-0 !bg-transparent !px-0 !ring-0 text-[14px] text-muted"
          />

          <div className="mt-4 mb-5">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { value: 'overview', label: 'Overview' },
                { value: 'tasks', label: 'Tasks', count: open.length },
                { value: 'knowledge', label: 'Notes & docs', count: related.notes.length + related.docs.length },
                { value: 'files', label: 'Files & links', count: related.fileCount + draft.links.length },
                { value: 'activity', label: 'Activity' },
              ]}
            />
          </div>

          {tab === 'overview' && (
            <div className="space-y-5">
              <Card title="Objectives" icon={Flag}>
                <MarkdownEditor value={draft.objectives ?? ''} onChange={(v) => set({ objectives: v })} minHeight={90} placeholder="What does success look like? Use bullet points." owner={{ type: 'project', id: draft.id }} />
              </Card>
              <Card title="Milestones" icon={Flag}>
                <MilestonesEditor project={draft} onChange={(milestones) => set({ milestones })} />
              </Card>
              <Card
                title="Next up"
                icon={CheckSquare}
                action={
                  <Button size="xs" variant="ghost" onClick={() => setTab('tasks')}>
                    All tasks
                  </Button>
                }
              >
                {open.length ? (
                  sortByScore(open)
                    .slice(0, 5)
                    .map((t) => <TaskRow key={t.id} task={t} showProject={false} compact blocked={isBlocked(t, taskMap)} subCount={subCounts.get(t.id)} />)
                ) : (
                  <p className="text-[13px] text-faint">No open tasks.</p>
                )}
              </Card>
              {(related.campaigns.length > 0 || related.content.length > 0) && (
                <Card title="Campaigns & content" icon={Megaphone}>
                  {related.campaigns.map((c) => (
                    <Link key={c.id} to={`/campaigns/${c.id}`} className="flex items-center gap-2 rounded-md px-1 py-1.5 row-hover">
                      <Megaphone className="h-3.5 w-3.5 text-faint" />
                      <span className="flex-1 truncate text-[13px]">{c.name}</span>
                      <Badge tone={campaignStatusMeta(c.status).tone}>{campaignStatusMeta(c.status).label}</Badge>
                    </Link>
                  ))}
                  {related.content.map((c) => (
                    <button key={c.id} onClick={() => openContent(c.id)} className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left row-hover">
                      <Sparkles className="h-3.5 w-3.5 text-faint" />
                      <span className="flex-1 truncate text-[13px]">{c.title}</span>
                      <span className="text-xs text-faint">{c.platform}</span>
                      <Badge tone={contentStatusMeta(c.status).tone}>{contentStatusMeta(c.status).label}</Badge>
                    </button>
                  ))}
                </Card>
              )}
              <Card title="Project notes">
                <Textarea autoGrow rows={3} value={draft.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} placeholder="Quick working notes for this project" />
              </Card>
            </div>
          )}

          {tab === 'tasks' && (
            <div className="card p-1.5">
              <div className="flex items-center gap-2.5 px-2 py-1.5">
                <Plus className="h-4 w-4 text-faint" />
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && newTitle.trim()) {
                      await newTask({ title: newTitle.trim(), projectId: draft.id });
                      setNewTitle('');
                    }
                  }}
                  placeholder="Add a task to this project"
                  className="flex-1 bg-transparent py-1 text-[13.5px] outline-none placeholder:text-faint"
                />
              </div>
              <div className="mx-2 mb-1 h-px bg-line" />
              {open.length === 0 && done.length === 0 && <Empty icon={CheckSquare} title="No tasks yet" compact>Tasks are optional — a project can exist on its own.</Empty>}
              {sortByScore(open).map((t) => (
                <TaskRow key={t.id} task={t} showProject={false} blocked={isBlocked(t, taskMap)} subCount={subCounts.get(t.id)} />
              ))}
              {done.length > 0 && (
                <>
                  <button className="px-2 pt-3 pb-1 section-title hover:text-muted" onClick={() => setShowDone((s) => !s)}>
                    {showDone ? 'Hide' : 'Show'} completed ({done.length})
                  </button>
                  {showDone && done.map((t) => <TaskRow key={t.id} task={t} showProject={false} compact />)}
                </>
              )}
            </div>
          )}

          {tab === 'knowledge' && (
            <div className="space-y-4">
              <Card
                title="Notes"
                icon={NotebookPen}
                action={
                  <Button size="xs" icon={Plus} onClick={newNote}>
                    New note
                  </Button>
                }
              >
                {related.notes.length ? (
                  related.notes.map((n) => (
                    <Link key={n.id} to={`/notes/${n.id}`} className="block rounded-md px-2 py-2 row-hover">
                      <div className="text-[13.5px] font-medium">{n.title || 'Untitled'}</div>
                      <div className="truncate text-xs text-faint">{excerpt(n.body, 120) || 'Empty note'}</div>
                    </Link>
                  ))
                ) : (
                  <p className="text-[13px] text-faint">No linked notes. Link any note to this project from the note's sidebar.</p>
                )}
              </Card>
              <Card
                title="Documents"
                icon={FileText}
                action={
                  <Button size="xs" icon={Plus} onClick={newDoc}>
                    New document
                  </Button>
                }
              >
                {related.docs.length ? (
                  related.docs.map((d) => (
                    <Link key={d.id} to={`/documents/${d.id}`} className="flex items-center gap-2 rounded-md px-2 py-2 row-hover">
                      <FileText className="h-3.5 w-3.5 text-faint" />
                      <span className="flex-1 truncate text-[13.5px]">{d.title || 'Untitled'}</span>
                      <Badge>{d.status === 'final' ? 'Final' : d.status === 'in_review' ? 'In review' : 'Draft'}</Badge>
                    </Link>
                  ))
                ) : (
                  <p className="text-[13px] text-faint">No linked documents.</p>
                )}
              </Card>
            </div>
          )}

          {tab === 'files' && (
            <div className="space-y-4">
              <Card title="Files" icon={Paperclip}>
                <Attachments owner={{ type: 'project', id: draft.id }} />
              </Card>
              <Card title="Links" icon={Link2}>
                <LinksEditor links={draft.links} onChange={(links) => set({ links })} />
              </Card>
            </div>
          )}

          {tab === 'activity' && (
            <Card>
              <ActivityFeed entityIds={[draft.id, ...projectTasks.map((t) => t.id)]} limit={50} />
            </Card>
          )}
        </div>

        {/* Sidebar: properties */}
        <aside className="w-full shrink-0 space-y-4 lg:w-[290px]">
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <Ring value={prog.percent} size={52} stroke={4} label={`${prog.percent}%`} />
              <div className="min-w-0">
                <div className="text-[13px] font-semibold">Progress</div>
                <div className="text-xs text-muted leading-snug">{prog.explanation}</div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-muted">Set progress manually</span>
              <Toggle checked={draft.progressMode === 'manual'} onChange={(v) => set({ progressMode: v ? 'manual' : 'auto', manualProgress: v ? prog.percent : draft.manualProgress })} label="Manual progress" />
            </div>
            {draft.progressMode === 'manual' && (
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={draft.manualProgress}
                onChange={(e) => set({ manualProgress: Number(e.target.value) })}
                className="mt-3 w-full accent-[rgb(var(--accent))]"
                aria-label="Manual progress"
              />
            )}
            <details className="mt-3 text-xs text-faint">
              <summary className="cursor-pointer hover:text-muted">How is this calculated?</summary>
              <p className="mt-1.5 leading-relaxed">
                Automatic progress is the share of this project's top-level tasks that are completed. If the project has milestones too, the
                task share and milestone share are averaged 50/50, so adding lots of small tasks can't inflate it. Completed projects are always
                100%. Switch to manual if neither reflects reality.
              </p>
            </details>
          </div>

          <div className="card space-y-3 p-4">
            <Field label="Status">
              <Select
                value={draft.status}
                onChange={(e) => {
                  const s = e.target.value as Project['status'];
                  set({ status: s, completedAt: s === 'completed' ? Date.now() : null });
                }}
              >
                {PROJECT_STATUSES.map((s) => (
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
              <Field label="Deadline">
                <Input type="date" value={draft.deadline ?? ''} onChange={(e) => set({ deadline: e.target.value || null })} />
              </Field>
            </div>
            {draft.deadline && (
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <CalendarDays className="h-3 w-3" />
                {draft.status === 'completed' ? `Deadline was ${fmtDate(draft.deadline, 'd MMM yyyy')}` : `Due ${relativeDay(draft.deadline).toLowerCase()}`}
              </p>
            )}
            <Field label="Tags">
              <TagInput value={draft.tags} onChange={(tags) => set({ tags })} />
            </Field>
            <CustomFields entity="project" values={draft.custom} onChange={(custom) => set({ custom })} />
          </div>

          <div className="card p-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <MiniStat label="Open" value={open.length} />
              <MiniStat label="Done" value={done.length} />
              <MiniStat label="Milestones" value={`${prog.milestoneDone}/${prog.milestoneTotal}`} />
            </div>
          </div>
          <Button
            className="w-full"
            icon={Megaphone}
            onClick={() => quickAdd({ type: 'campaign', projectId: draft.id, title: '' })}
          >
            Start a linked campaign
          </Button>
        </aside>
      </div>
      <Modal
        open={tplName !== null}
        onClose={() => setTplName(null)}
        title="Save as template"
        description="Milestones and tasks are saved with dates relative to the project start."
        width="max-w-md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTplName(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveTemplate} disabled={!tplName?.trim()}>
              Save template
            </Button>
          </>
        }
      >
        <Input autoFocus value={tplName ?? ''} onChange={(e) => setTplName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveTemplate()} />
      </Modal>
    </Page>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[17px] font-semibold tabular-nums">{value}</div>
      <div className="text-2xs uppercase tracking-wide text-faint">{label}</div>
    </div>
  );
}

function MilestonesEditor({ project, onChange }: { project: Project; onChange: (m: Project['milestones']) => void }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const ms = [...project.milestones].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
  return (
    <div>
      {ms.length > 0 && (
        <ol className="relative mb-3 ml-2 border-l border-line pl-4">
          {ms.map((m) => (
            <li key={m.id} className="group relative py-1.5">
              <span className={cn('absolute -left-[21.5px] top-[11px] h-2.5 w-2.5 rounded-full border-2 border-surface', m.done ? 'bg-ok' : 'bg-line-strong')} />
              <div className="flex items-center gap-2">
                <Checkbox size="sm" checked={m.done} onChange={(v) => onChange(project.milestones.map((x) => (x.id === m.id ? { ...x, done: v } : x)))} />
                <input
                  value={m.title}
                  onChange={(e) => onChange(project.milestones.map((x) => (x.id === m.id ? { ...x, title: e.target.value } : x)))}
                  className={cn('min-w-0 flex-1 bg-transparent text-[13.5px] outline-none', m.done && 'text-faint line-through')}
                />
                <input
                  type="date"
                  value={m.date ?? ''}
                  onChange={(e) => onChange(project.milestones.map((x) => (x.id === m.id ? { ...x, date: e.target.value || null } : x)))}
                  className="w-[130px] bg-transparent text-xs text-muted outline-none"
                />
                <IconButton icon={X} size="sm" label="Remove milestone" className="opacity-0 group-hover:opacity-100" onClick={() => onChange(project.milestones.filter((x) => x.id !== m.id))} />
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="flex gap-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New milestone" className="flex-1" onKeyDown={(e) => e.key === 'Enter' && add()} />
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[150px]" />
        <Button icon={Plus} onClick={add} disabled={!title.trim()}>
          Add
        </Button>
      </div>
      {ms.length > 0 && <Progress className="mt-3" value={(project.milestones.filter((m) => m.done).length / project.milestones.length) * 100} tone="ok" />}
    </div>
  );
  function add() {
    if (!title.trim()) return;
    onChange([...project.milestones, { id: uid(), title: title.trim(), date: date || null, done: false }]);
    setTitle('');
    setDate('');
  }
}
