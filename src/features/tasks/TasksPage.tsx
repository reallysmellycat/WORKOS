import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckSquare, Columns3, Filter, List, Plus, Search, Sun, Trash2, X } from 'lucide-react';
import { useProjects, useTasks, useById } from '@/lib/hooks';
import { isBlocked, isOverdue, PRIORITIES, priorityMeta, sortByScore, TASK_STATUSES } from '@/lib/domain';
import { newTask, restore, setTaskStatus, softDelete, update } from '@/lib/repo';
import type { Priority, Task, TaskStatus } from '@/lib/types';
import { safeGet, cn, daysUntil, todayISO } from '@/lib/utils';
import { Badge, Button, Empty, Input, Loading, Page, PageHeader, Select, Tabs } from '@/components/ui';
import { useFeedback } from '@/components/feedback';
import { useApp } from '@/app/context';
import { TaskRow } from './TaskRow';

type View = 'list' | 'board';
type Smart = 'all' | 'today' | 'upcoming' | 'overdue' | 'nodate' | 'completed';
type Sort = 'smart' | 'due' | 'priority' | 'created' | 'title';
type BoardBy = 'status' | 'priority';

export default function TasksPage() {
  const tasks = useTasks();
  const projects = useProjects();
  const projectMap = useById(projects);
  const taskMap = useById(tasks);
  const [params, setParams] = useSearchParams();
  const { openTask } = useApp();
  const { toast, confirm } = useFeedback();

  const [view, setView] = useState<View>(() => (safeGet('workos-tasks-view') as View) || 'list');
  const [smart, setSmart] = useState<Smart>((params.get('view') as Smart) || 'all');
  const [q, setQ] = useState('');
  const [prio, setPrio] = useState<Priority | ''>('');
  const [statusF, setStatusF] = useState<TaskStatus | ''>('');
  const [projectF, setProjectF] = useState<string>('');
  const [tagF, setTagF] = useState('');
  const [sort, setSort] = useState<Sort>('smart');
  const [boardBy, setBoardBy] = useState<BoardBy>('status');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newTitle, setNewTitle] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('workos-tasks-view', view);
    } catch {
      /* storage unavailable */
    }
  }, [view]);
  useEffect(() => {
    const open = params.get('open');
    if (open) {
      openTask(open);
      params.delete('open');
      setParams(params, { replace: true });
    }
  }, [params, setParams, openTask]);

  const allTags = useMemo(() => [...new Set((tasks ?? []).flatMap((t) => t.tags))].sort(), [tasks]);

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

  const filtered = useMemo(() => {
    if (!tasks) return [];
    const today = todayISO();
    const ql = q.toLowerCase();
    let list = tasks.filter((t) => !t.parentId || q); // subtasks show inside their parent unless searching
    list = list.filter((t) => {
      switch (smart) {
        case 'today':
          return t.status !== 'completed' && ((t.dueDate && t.dueDate <= today) || t.myDay === today);
        case 'upcoming': {
          const n = daysUntil(t.dueDate);
          return t.status !== 'completed' && n !== null && n >= 0 && n <= 14;
        }
        case 'overdue':
          return isOverdue(t);
        case 'nodate':
          return t.status !== 'completed' && !t.dueDate;
        case 'completed':
          return t.status === 'completed';
        default:
          return view === 'board' || t.status !== 'completed' || statusF === 'completed';
      }
    });
    if (ql) list = list.filter((t) => t.title.toLowerCase().includes(ql) || (t.description ?? '').toLowerCase().includes(ql) || t.tags.some((g) => g.toLowerCase().includes(ql)));
    if (prio) list = list.filter((t) => t.priority === prio);
    if (statusF) list = list.filter((t) => t.status === statusF);
    if (projectF) list = list.filter((t) => (projectF === 'none' ? !t.projectId : t.projectId === projectF));
    if (tagF) list = list.filter((t) => t.tags.includes(tagF));
    const by: Record<Sort, (a: Task, b: Task) => number> = {
      smart: () => 0,
      due: (a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'),
      priority: (a, b) => priorityMeta(b.priority).rank - priorityMeta(a.priority).rank,
      created: (a, b) => b.createdAt - a.createdAt,
      title: (a, b) => a.title.localeCompare(b.title),
    };
    if (smart === 'completed') return list.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
    return sort === 'smart' ? sortByScore(list) : list.sort(by[sort]);
  }, [tasks, smart, q, prio, statusF, projectF, tagF, sort, view]);

  const counts = useMemo(() => {
    const t = tasks ?? [];
    const today = todayISO();
    const top = t.filter((x) => !x.parentId);
    return {
      all: top.filter((x) => x.status !== 'completed').length,
      today: top.filter((x) => x.status !== 'completed' && ((x.dueDate && x.dueDate <= today) || x.myDay === today)).length,
      overdue: top.filter(isOverdue).length,
    };
  }, [tasks]);

  if (!tasks || !projects) return <Loading />;

  const sel = [...selected].map((id) => taskMap.get(id)).filter(Boolean) as Task[];
  const clearSel = () => setSelected(new Set());
  const bulk = {
    complete: async () => {
      for (const t of sel) await setTaskStatus(t, 'completed');
      toast(`${sel.length} task(s) completed`);
      clearSel();
    },
    status: async (s: TaskStatus) => {
      for (const t of sel) await setTaskStatus(t, s);
      clearSel();
    },
    priority: async (p: Priority) => {
      for (const t of sel) await update<Task>('tasks', t.id, { priority: p }, { log: false });
      clearSel();
    },
    myDay: async () => {
      for (const t of sel) await update<Task>('tasks', t.id, { myDay: todayISO() }, { log: false });
      toast(`Added ${sel.length} to My Day`);
      clearSel();
    },
    project: async (pid: string | null) => {
      for (const t of sel) await update<Task>('tasks', t.id, { projectId: pid }, { log: false });
      clearSel();
    },
    remove: async () => {
      const ok = await confirm({ title: `Move ${sel.length} task(s) to Trash?`, message: 'You can restore them from Settings → Trash.', confirmLabel: 'Move to Trash', danger: true });
      if (!ok) return;
      const ids = sel.map((t) => t.id);
      for (const id of ids) await softDelete('tasks', id);
      clearSel();
      toast(`${ids.length} task(s) moved to Trash`, { action: { label: 'Undo', onClick: () => ids.forEach((id) => restore('tasks', id)) } });
    },
  };

  const addInline = async () => {
    if (!newTitle.trim()) return;
    await newTask({
      title: newTitle.trim(),
      projectId: projectF && projectF !== 'none' ? projectF : null,
      priority: prio || 'medium',
      dueDate: smart === 'today' ? todayISO() : null,
      myDay: smart === 'today' ? todayISO() : null,
    });
    setNewTitle('');
  };

  const activeFilters = [prio, statusF, projectF, tagF].filter(Boolean).length;

  return (
    <Page wide={view === 'board'}>
      <PageHeader
        title="Tasks"
        subtitle={`${counts.all} open · ${counts.today} for today${counts.overdue ? ` · ${counts.overdue} overdue` : ''}`}
        actions={
          <>
            <Tabs
              value={view}
              onChange={setView}
              tabs={[
                { value: 'list', label: 'List', icon: List },
                { value: 'board', label: 'Board', icon: Columns3 },
              ]}
            />
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tabs
          value={smart}
          onChange={setSmart}
          tabs={[
            { value: 'all', label: 'Open', count: counts.all },
            { value: 'today', label: 'Today', count: counts.today },
            { value: 'upcoming', label: 'Next 14 days' },
            { value: 'overdue', label: 'Overdue', count: counts.overdue },
            { value: 'nodate', label: 'No date' },
            { value: 'completed', label: 'Completed' },
          ]}
        />
        <div className="flex-1" />
        <div className="relative w-full sm:w-56">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks" className="pl-8" />
        </div>
        <Button icon={Filter} onClick={() => setShowFilters((v) => !v)} variant={activeFilters || showFilters ? 'subtle' : 'secondary'}>
          Filter{activeFilters ? ` · ${activeFilters}` : ''}
        </Button>
        {view === 'list' ? (
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="w-40" aria-label="Sort">
            <option value="smart">Sort: Smart</option>
            <option value="due">Sort: Due date</option>
            <option value="priority">Sort: Priority</option>
            <option value="created">Sort: Newest</option>
            <option value="title">Sort: A–Z</option>
          </Select>
        ) : (
          <Select value={boardBy} onChange={(e) => setBoardBy(e.target.value as BoardBy)} className="w-44" aria-label="Group board by">
            <option value="status">Columns: Status</option>
            <option value="priority">Columns: Priority</option>
          </Select>
        )}
      </div>

      {showFilters && (
        <div className="mb-4 flex flex-wrap items-center gap-2 animate-in">
          <FilterPanel
            prio={prio}
            setPrio={setPrio}
            statusF={statusF}
            setStatusF={setStatusF}
            projectF={projectF}
            setProjectF={setProjectF}
            tagF={tagF}
            setTagF={setTagF}
            projects={projects}
            tags={allTags}
          />
          {activeFilters > 0 && (
            <Button
              size="sm"
              variant="ghost"
              icon={X}
              onClick={() => {
                setPrio('');
                setStatusF('');
                setProjectF('');
                setTagF('');
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}

      {selected.size > 0 && (
        <div className="glass sticky top-[calc(var(--sticky-top,0px)+8px)] z-10 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2 shadow-pop animate-in">
          <span className="text-[13px] font-medium">{selected.size} selected</span>
          <div className="h-4 w-px bg-line" />
          <Button size="sm" icon={CheckSquare} onClick={bulk.complete}>
            Complete
          </Button>
          <Button size="sm" icon={Sun} onClick={bulk.myDay}>
            My Day
          </Button>
          <Select className="w-36" value="" onChange={(e) => e.target.value && bulk.status(e.target.value as TaskStatus)} aria-label="Set status">
            <option value="">Set status…</option>
            {TASK_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <Select className="w-36" value="" onChange={(e) => e.target.value && bulk.priority(e.target.value as Priority)} aria-label="Set priority">
            <option value="">Set priority…</option>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
          <Select className="w-40" value="" onChange={(e) => e.target.value && bulk.project(e.target.value === 'none' ? null : e.target.value)} aria-label="Move to project">
            <option value="">Move to project…</option>
            <option value="none">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="ghost" icon={Trash2} className="!text-danger" onClick={bulk.remove}>
            Delete
          </Button>
          <div className="flex-1" />
          <Button size="sm" variant="ghost" icon={X} onClick={clearSel}>
            Clear
          </Button>
        </div>
      )}

      {view === 'list' ? (
        <div className="card p-1.5">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <Plus className="h-4 w-4 text-faint" />
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addInline()}
              placeholder="Add a task and press Enter"
              className="flex-1 bg-transparent py-1 text-[13.5px] outline-none placeholder:text-faint"
            />
            {filtered.length > 0 && (
              <button
                className="text-xs text-faint hover:text-fg"
                onClick={() => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((t) => t.id)))}
              >
                {selected.size === filtered.length ? 'Deselect all' : 'Select all'}
              </button>
            )}
          </div>
          <div className="h-px bg-line mx-2 mb-1" />
          {filtered.length === 0 ? (
            <Empty icon={CheckSquare} title={smart === 'overdue' ? 'Nothing overdue' : smart === 'completed' ? 'No completed tasks yet' : 'No tasks here'} compact>
              {smart === 'overdue' ? 'Nicely done — you are on top of things.' : 'Add one above, or press N anywhere to quick-add.'}
            </Empty>
          ) : (
            <TaskGroups
              tasks={filtered}
              grouped={smart === 'all' && sort === 'smart'}
              render={(t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  project={t.projectId ? projectMap.get(t.projectId) : null}
                  subCount={subCounts.get(t.id)}
                  blocked={isBlocked(t, taskMap)}
                  selected={selected.has(t.id)}
                  onSelect={(v) => {
                    const n = new Set(selected);
                    if (v) n.add(t.id);
                    else n.delete(t.id);
                    setSelected(n);
                  }}
                />
              )}
            />
          )}
        </div>
      ) : (
        <Board tasks={filtered} by={boardBy} projectMap={projectMap} subCounts={subCounts} taskMap={taskMap} />
      )}
    </Page>
  );
}

function TaskGroups({ tasks, grouped, render }: { tasks: Task[]; grouped: boolean; render: (t: Task) => JSX.Element }) {
  if (!grouped) return <div>{tasks.map(render)}</div>;
  const today = todayISO();
  const groups: { label: string; items: Task[] }[] = [
    { label: 'Overdue', items: [] },
    { label: 'Today', items: [] },
    { label: 'Next 7 days', items: [] },
    { label: 'Later', items: [] },
    { label: 'No due date', items: [] },
  ];
  for (const t of tasks) {
    const n = daysUntil(t.dueDate);
    if (n === null) groups[t.myDay === today ? 1 : 4].items.push(t);
    else if (n < 0) groups[0].items.push(t);
    else if (n === 0) groups[1].items.push(t);
    else if (n <= 7) groups[2].items.push(t);
    else groups[3].items.push(t);
  }
  for (const g of groups) if (g.label !== 'Overdue' && g.label !== 'Today') g.items.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || priorityMeta(b.priority).rank - priorityMeta(a.priority).rank);
  return (
    <div>
      {groups
        .filter((g) => g.items.length)
        .map((g) => (
          <div key={g.label} className="mb-1">
            <div className={cn('px-2 pt-3 pb-1 section-title', g.label === 'Overdue' && '!text-danger')}>
              {g.label} <span className="ml-1 font-normal">{g.items.length}</span>
            </div>
            {g.items.map(render)}
          </div>
        ))}
    </div>
  );
}

function FilterPanel(props: {
  prio: Priority | '';
  setPrio: (v: Priority | '') => void;
  statusF: TaskStatus | '';
  setStatusF: (v: TaskStatus | '') => void;
  projectF: string;
  setProjectF: (v: string) => void;
  tagF: string;
  setTagF: (v: string) => void;
  projects: { id: string; title: string }[];
  tags: string[];
}) {
  return (
    <>
      <Select value={props.prio} onChange={(e) => props.setPrio(e.target.value as Priority | '')} className="w-32" aria-label="Priority filter">
        <option value="">Any priority</option>
        {PRIORITIES.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </Select>
      <Select value={props.statusF} onChange={(e) => props.setStatusF(e.target.value as TaskStatus | '')} className="w-32" aria-label="Status filter">
        <option value="">Any status</option>
        {TASK_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </Select>
      <Select value={props.projectF} onChange={(e) => props.setProjectF(e.target.value)} className="w-36" aria-label="Project filter">
        <option value="">Any project</option>
        <option value="none">No project</option>
        {props.projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </Select>
      {props.tags.length > 0 && (
        <Select value={props.tagF} onChange={(e) => props.setTagF(e.target.value)} className="w-32" aria-label="Tag filter">
          <option value="">Any tag</option>
          {props.tags.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
      )}
    </>
  );
}

function Board({
  tasks,
  by,
  projectMap,
  subCounts,
  taskMap,
}: {
  tasks: Task[];
  by: BoardBy;
  projectMap: Map<string, { title: string }>;
  subCounts: Map<string, { done: number; total: number }>;
  taskMap: Map<string, Task>;
}) {
  const [over, setOver] = useState<string | null>(null);
  const columns =
    by === 'status'
      ? TASK_STATUSES.map((s) => ({ key: s.value, label: s.label, tone: s.tone }))
      : PRIORITIES.map((p) => ({ key: p.value, label: p.label, tone: p.tone }));

  const drop = async (colKey: string, id: string) => {
    const t = taskMap.get(id);
    if (!t) return;
    if (by === 'status') await setTaskStatus(t, colKey as TaskStatus);
    else await update<Task>('tasks', id, { priority: colKey as Priority }, { log: false });
  };

  return (
    <div className="grid gap-3 overflow-x-auto pb-4" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(260px, 1fr))` }}>
      {columns.map((col) => {
        const items = tasks.filter((t) => (by === 'status' ? t.status : t.priority) === col.key);
        return (
          <div
            key={col.key}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(col.key);
            }}
            onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = e.dataTransfer.getData('text/task-id');
              if (id) void drop(col.key, id);
            }}
            className={cn('flex min-h-[300px] flex-col rounded-lg bg-sunken/50 p-2 transition-colors', over === col.key && 'bg-accent-soft/60 ring-1 ring-accent/30')}
          >
            <div className="flex items-center gap-2 px-1.5 pb-2 pt-1">
              <Badge tone={col.tone} dot>
                {col.label}
              </Badge>
              <span className="text-xs text-faint tabular-nums">{items.length}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {items.map((t) => (
                <div key={t.id} className="rounded-md border border-line bg-raised shadow-soft">
                  <TaskRow
                    task={t}
                    project={t.projectId ? (projectMap.get(t.projectId) as never) : null}
                    subCount={subCounts.get(t.id)}
                    blocked={isBlocked(t, taskMap)}
                    draggable
                  />
                </div>
              ))}
              {items.length === 0 && <div className="rounded-md border border-dashed border-line-strong/70 py-6 text-center text-xs text-faint">Drop tasks here</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
