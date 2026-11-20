import { addDays, addMonths, addWeeks, addYears, parseISO } from 'date-fns';
import { db, type RecordTable } from './db';
import { ENTITY, TABLE_TO_ENTITY, entityTitle } from './entities';
import type { Activity, BaseRecord, EntityType, Task } from './types';
import { toISODate, todayISO, uid } from './utils';

type AnyRec = BaseRecord & Record<string, unknown>;

function tbl(table: RecordTable) {
  return db.table(table) as unknown as import('dexie').Table<AnyRec, string>;
}

// Throttle "updated" activity entries so autosave doesn't flood the history.
const lastLogged = new Map<string, number>();

export async function logActivity(a: Omit<Activity, 'id' | 'at'> & { at?: number }) {
  if (a.action === 'updated') {
    const k = `${a.entity}:${a.entityId}`;
    const prev = lastLogged.get(k) ?? 0;
    if (Date.now() - prev < 10 * 60 * 1000) return;
    lastLogged.set(k, Date.now());
  }
  await db.activity.add({ ...a, at: a.at ?? Date.now() });
}

export async function create<T extends BaseRecord>(
  table: RecordTable,
  data: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  opts: { log?: boolean } = {},
): Promise<T> {
  const now = Date.now();
  const rec = { ...data, id: data.id ?? uid(), createdAt: now, updatedAt: now, deletedAt: null } as unknown as T;
  await tbl(table).add(rec as unknown as AnyRec);
  const entity = TABLE_TO_ENTITY[table];
  if (entity && opts.log !== false && !(rec as BaseRecord).isDemo) {
    await logActivity({ entity, entityId: rec.id, action: 'created', title: entityTitle(entity, rec as never) });
  }
  return rec;
}

export async function update<T extends BaseRecord>(
  table: RecordTable,
  id: string,
  patch: Partial<T>,
  opts: { log?: boolean; action?: Activity['action']; detail?: string } = {},
) {
  await tbl(table).update(id, { ...(patch as object), updatedAt: Date.now() });
  const entity = TABLE_TO_ENTITY[table];
  if (entity && opts.log !== false) {
    const rec = await tbl(table).get(id);
    if (rec && !rec.isDemo) {
      await logActivity({
        entity,
        entityId: id,
        action: opts.action ?? 'updated',
        title: entityTitle(entity, rec),
        detail: opts.detail,
      });
    }
  }
}

/** Moves a record to the Trash. Recoverable from Settings → Trash. */
export async function softDelete(table: RecordTable, id: string) {
  await tbl(table).update(id, { deletedAt: Date.now() });
  const entity = TABLE_TO_ENTITY[table];
  const rec = await tbl(table).get(id);
  if (entity && rec) await logActivity({ entity, entityId: id, action: 'deleted', title: entityTitle(entity, rec) });
}

export async function restore(table: RecordTable, id: string) {
  await tbl(table).update(id, { deletedAt: null, updatedAt: Date.now() });
  const entity = TABLE_TO_ENTITY[table];
  const rec = await tbl(table).get(id);
  if (entity && rec) await logActivity({ entity, entityId: id, action: 'restored', title: entityTitle(entity, rec) });
}

/** Permanent deletion. Only called from the Trash after confirmation. */
export async function purge(table: RecordTable, id: string) {
  await tbl(table).delete(id);
  if (table !== 'files') {
    const owned = await db.files.filter((f) => f.owner?.id === id).primaryKeys();
    await db.files.bulkDelete(owned);
  }
}

export async function getRecord(type: EntityType, id: string) {
  return tbl(ENTITY[type].table).get(id);
}

// ---------- Tasks ----------

export function nextOccurrence(due: string, r: NonNullable<Task['recurrence']>): string {
  const d = parseISO(due);
  const n = Math.max(1, r.interval || 1);
  const next =
    r.freq === 'daily' ? addDays(d, n) : r.freq === 'weekly' ? addWeeks(d, n) : r.freq === 'monthly' ? addMonths(d, n) : addYears(d, n);
  return toISODate(next);
}

export async function newTask(data: Partial<Task> & { title: string }): Promise<Task> {
  const count = await db.tasks.count();
  return create<Task>('tasks', {
    priority: 'medium',
    status: 'not_started',
    checklist: [],
    blockedBy: [],
    tags: [],
    order: count,
    ...data,
  });
}

/**
 * Sets a task's status. Completing a recurring task schedules the next
 * occurrence as a fresh task (the completed one stays in history).
 */
export async function setTaskStatus(task: Task, status: Task['status']) {
  if (task.status === status) return;
  const completing = status === 'completed';
  await update<Task>(
    'tasks',
    task.id,
    { status, completedAt: completing ? Date.now() : null },
    { action: completing ? 'completed' : 'status', detail: status },
  );
  if (completing && task.recurrence) {
    const base = task.dueDate ?? todayISO();
    let next = nextOccurrence(base, task.recurrence);
    // If the task was badly overdue, skip forward so the next one is in the future.
    let guard = 0;
    while (next < todayISO() && guard++ < 400) next = nextOccurrence(next, task.recurrence);
    const shift = task.startDate && task.dueDate ? daysBetween(task.startDate, task.dueDate) : null;
    await newTask({
      title: task.title,
      description: task.description,
      priority: task.priority,
      tags: task.tags,
      projectId: task.projectId,
      campaignId: task.campaignId,
      recurrence: task.recurrence,
      checklist: task.checklist.map((c) => ({ ...c, id: uid(), done: false })),
      dueDate: next,
      startDate: shift !== null ? toISODate(addDays(parseISO(next), -shift)) : null,
      isDemo: task.isDemo,
    });
  }
}

function daysBetween(a: string, b: string) {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}

export async function toggleTaskDone(task: Task) {
  await setTaskStatus(task, task.status === 'completed' ? 'not_started' : 'completed');
}
