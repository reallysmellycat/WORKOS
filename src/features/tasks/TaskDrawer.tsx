import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Ban, Copy, GitBranch, MoreHorizontal, Plus, Repeat, Sun, Trash2, X } from 'lucide-react';
import { db } from '@/lib/db';
import { create, newTask, restore, setTaskStatus, softDelete, update } from '@/lib/repo';
import { PRIORITIES, TASK_STATUSES } from '@/lib/domain';
import type { Task } from '@/lib/types';
import { useAutosave } from '@/lib/hooks';
import { cn, fmtTs, todayISO } from '@/lib/utils';
import { Badge, Button, Checkbox, DemoBadge, Drawer, Field, IconButton, Input, Menu, SavedIndicator, Select, Textarea } from '@/components/ui';
import { Attachments, CampaignSelect, ChecklistEditor, CustomFields, EntitySearch, ProjectSelect, TagInput } from '@/components/pickers';
import { useFeedback } from '@/components/feedback';
import { useApp } from '@/app/context';
import { DueLabel } from './TaskRow';

export function TaskDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  return (
    <Drawer open={!!id} onClose={onClose}>
      {id && <TaskEditor key={id} id={id} onClose={onClose} />}
    </Drawer>
  );
}

function TaskEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const record = useLiveQuery(() => db.tasks.get(id), [id]);
  const [draft, setDraft] = useState<Task | null>(null);
  const { toast } = useFeedback();
  const { openTask } = useApp();

  useEffect(() => {
    if (record && !draft) setDraft(record);
    // Keep status/completion in sync if changed elsewhere (e.g. checkbox in a list).
    if (record && draft && (record.status !== draft.status || record.myDay !== draft.myDay)) {
      setDraft((d) => (d ? { ...d, status: record.status, completedAt: record.completedAt, myDay: record.myDay } : d));
    }
  }, [record]); // eslint-disable-line react-hooks/exhaustive-deps

  const status = useAutosave(
    draft,
    async (d) => {
      if (!d) return;
      const { status: _s, completedAt: _c, ...rest } = d;
      await update<Task>('tasks', d.id, rest);
    },
    500,
    !!draft,
  );

  const subtasks = useLiveQuery(async () => (await db.tasks.where('parentId').equals(id).toArray()).filter((t) => !t.deletedAt), [id]);
  const deps = useLiveQuery(async () => (draft?.blockedBy.length ? (await db.tasks.bulkGet(draft.blockedBy)).filter(Boolean) : []), [draft?.blockedBy.join(',')]);
  const parent = useLiveQuery(async () => (draft?.parentId ? db.tasks.get(draft.parentId) : undefined), [draft?.parentId]);
  const [subText, setSubText] = useState('');
  const [addingDep, setAddingDep] = useState(false);

  if (record === null || (record === undefined && draft === null)) {
    return record === null ? (
      <div className="p-6 text-body-s text-muted">This task no longer exists.</div>
    ) : (
      <div className="p-6" />
    );
  }
  if (!draft) return null;
  const set = (patch: Partial<Task>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const done = draft.status === 'completed';

  const remove = async () => {
    await softDelete('tasks', draft.id);
    for (const s of subtasks ?? []) await softDelete('tasks', s.id);
    onClose();
    toast('Task moved to Trash', {
      action: {
        label: 'Undo',
        onClick: async () => {
          await restore('tasks', draft.id);
          for (const s of subtasks ?? []) await restore('tasks', s.id);
        },
      },
    });
  };

  const duplicate = async () => {
    const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = draft;
    const copy = await create<Task>('tasks', { ...rest, title: `${draft.title} (copy)`, status: 'not_started', completedAt: null, isDemo: false });
    openTask(copy.id);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line px-5 h-[52px] shrink-0">
        <Checkbox checked={done} onChange={(v) => setTaskStatus(draft, v ? 'completed' : 'not_started')} />
        <span className="text-body-s text-muted">{done ? `Completed ${fmtTs(draft.completedAt, 'd MMM')}` : 'Mark complete'}</span>
        {draft.isDemo && <DemoBadge />}
        <div className="flex-1" />
        <SavedIndicator status={status} />
        <Menu
          trigger={(t) => <IconButton icon={MoreHorizontal} label="More" onClick={t} />}
          items={[
            { label: draft.myDay === todayISO() ? 'Remove from My Day' : 'Add to My Day', icon: Sun, onClick: () => update<Task>('tasks', draft.id, { myDay: draft.myDay === todayISO() ? null : todayISO() }, { log: false }) },
            { label: 'Duplicate', icon: Copy, onClick: duplicate },
            'divider',
            { label: 'Move to Trash', icon: Trash2, danger: true, onClick: remove },
          ]}
        />
        <IconButton icon={X} label="Close" onClick={onClose} />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {parent && (
          <button onClick={() => openTask(parent.id)} className="text-body-s text-muted hover:text-accent-deep">
            ↑ Subtask of <span className="font-medium">{parent.title}</span>
          </button>
        )}
        <Textarea
          autoGrow
          rows={1}
          value={draft.title}
          onChange={(e) => set({ title: e.target.value.replace(/\n/g, ' ') })}
          className="!border-0 !bg-transparent !px-0 !ring-0 text-h4 font-semibold leading-snug"
          placeholder="Task title"
          aria-label="Title"
        />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <Select value={draft.status} onChange={(e) => setTaskStatus(draft, e.target.value as Task['status'])}>
              {TASK_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={draft.priority} onChange={(e) => set({ priority: e.target.value as Task['priority'] })}>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Start date">
            <Input type="date" value={draft.startDate ?? ''} onChange={(e) => set({ startDate: e.target.value || null })} />
          </Field>
          <Field label="Due date" hint={draft.dueDate ? <DueLabel date={draft.dueDate} done={done} /> : undefined}>
            <Input type="date" value={draft.dueDate ?? ''} onChange={(e) => set({ dueDate: e.target.value || null })} />
          </Field>
          <Field label="Project">
            <ProjectSelect value={draft.projectId} onChange={(v) => set({ projectId: v })} />
          </Field>
          <Field label="Campaign">
            <CampaignSelect value={draft.campaignId} onChange={(v) => set({ campaignId: v })} />
          </Field>
        </div>

        <Field label="Repeat">
          <div className="flex items-center gap-2">
            <Repeat className="h-3.5 w-3.5 text-faint" />
            <Select
              className="w-40"
              value={draft.recurrence?.freq ?? ''}
              onChange={(e) => set({ recurrence: e.target.value ? { freq: e.target.value as 'weekly', interval: draft.recurrence?.interval ?? 1 } : null })}
            >
              <option value="">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </Select>
            {draft.recurrence && (
              <>
                <span className="text-body-s text-muted">every</span>
                <Input
                  type="number"
                  min={1}
                  className="w-16"
                  value={draft.recurrence.interval}
                  onChange={(e) => set({ recurrence: { ...draft.recurrence!, interval: Math.max(1, Number(e.target.value) || 1) } })}
                />
                <span className="text-body-s text-muted">{draft.recurrence.freq.replace('ly', '').replace('dai', 'day')}(s)</span>
              </>
            )}
          </div>
          {draft.recurrence && <p className="mt-1 text-body-s text-faint">When you complete this task, the next one is created automatically{draft.dueDate ? '' : ' (set a due date to anchor the schedule)'}.</p>}
        </Field>

        <Field label="Description">
          <Textarea autoGrow rows={3} value={draft.description ?? ''} onChange={(e) => set({ description: e.target.value })} placeholder="Add context, links or acceptance criteria…" />
        </Field>

        <div>
          <span className="label">Checklist</span>
          <ChecklistEditor items={draft.checklist} onChange={(checklist) => set({ checklist })} />
        </div>

        {!draft.parentId && (
          <div>
            <span className="label flex items-center gap-1">
              <GitBranch className="h-3 w-3" /> Subtasks
            </span>
            <div className="space-y-0.5">
              {(subtasks ?? []).map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-sm px-1 py-1 row-hover cursor-pointer" onClick={() => openTask(s.id)}>
                  <Checkbox size="sm" checked={s.status === 'completed'} onChange={(v) => setTaskStatus(s, v ? 'completed' : 'not_started')} />
                  <span className={cn('flex-1 truncate text-body-s', s.status === 'completed' && 'text-faint line-through')}>{s.title}</span>
                  <DueLabel date={s.dueDate} done={s.status === 'completed'} />
                </div>
              ))}
              <div className="flex items-center gap-2 px-1 py-1">
                <Plus className="h-3.5 w-3.5 text-faint" />
                <input
                  value={subText}
                  onChange={(e) => setSubText(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && subText.trim()) {
                      await newTask({ title: subText.trim(), parentId: draft.id, projectId: draft.projectId, priority: draft.priority });
                      setSubText('');
                    }
                  }}
                  placeholder="Add subtask and press Enter"
                  className="flex-1 bg-transparent text-body-s outline-none placeholder:text-faint"
                />
              </div>
            </div>
          </div>
        )}

        <div>
          <span className="label flex items-center gap-1">
            <Ban className="h-3 w-3" /> Blocked by
          </span>
          <div className="space-y-0.5">
            {(deps ?? []).map((d) =>
              d ? (
                <div key={d.id} className="group flex items-center gap-2 rounded-sm px-1 py-1 row-hover">
                  <Badge tone={d.status === 'completed' ? 'ok' : 'warn'}>{d.status === 'completed' ? 'Done' : 'Open'}</Badge>
                  <button className="flex-1 truncate text-left text-body-s hover:text-accent-deep" onClick={() => openTask(d.id)}>
                    {d.title}
                  </button>
                  <IconButton icon={X} size="sm" label="Remove dependency" className="opacity-0 group-hover:opacity-100" onClick={() => set({ blockedBy: draft.blockedBy.filter((x) => x !== d.id) })} />
                </div>
              ) : null,
            )}
            {addingDep ? (
              <EntitySearch
                types={['task']}
                exclude={{ type: 'task', id: draft.id }}
                onPick={(r) => {
                  if (!draft.blockedBy.includes(r.id)) set({ blockedBy: [...draft.blockedBy, r.id] });
                  setAddingDep(false);
                }}
                onCancel={() => setAddingDep(false)}
              />
            ) : (
              <Button size="sm" variant="ghost" icon={Plus} onClick={() => setAddingDep(true)}>
                Add dependency
              </Button>
            )}
          </div>
        </div>

        <Field label="Tags">
          <TagInput value={draft.tags} onChange={(tags) => set({ tags })} />
        </Field>

        <CustomFields entity="task" values={draft.custom} onChange={(custom) => set({ custom })} />

        <Field label="Notes">
          <Textarea autoGrow rows={2} value={draft.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} placeholder="Private working notes" />
        </Field>

        <div>
          <span className="label">Attachments</span>
          <Attachments owner={{ type: 'task', id: draft.id }} />
        </div>

        <p className="pt-2 text-caption text-faint">
          Created {fmtTs(draft.createdAt, 'd MMM yyyy, HH:mm')} · Updated {fmtTs(record?.updatedAt ?? draft.updatedAt, 'd MMM yyyy, HH:mm')}
        </p>
      </div>
    </div>
  );
}
