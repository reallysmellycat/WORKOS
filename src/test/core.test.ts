// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { __setDb, db, WorkOSDB } from '@/lib/db';
import { create, newTask, nextOccurrence, purge, restore, setTaskStatus, softDelete } from '@/lib/repo';
import { buildBackup, importBackup, validateBackup, createSnapshot, restoreSnapshot, toCSV } from '@/lib/backup';
import { projectProgress, engagementRate, taskScore } from '@/lib/domain';
import { seedDemo, removeDemo, hasDemo } from '@/lib/demo';
import { ensureBuiltInTemplates, createProjectFromTemplate } from '@/lib/templates';
import { searchAll } from '@/lib/search';
import { computeNotifications, dismiss } from '@/lib/notifications';
import { DEFAULT_SETTINGS, getSettings, saveSettings } from '@/lib/settings';
import type { Note, Project, StoredFile, Task } from '@/lib/types';
import { addDaysISO, todayISO } from '@/lib/utils';

let n = 0;
beforeEach(async () => {
  __setDb(new WorkOSDB(`test-${n++}-${Math.random()}`));
  await db.open();
});

const baseProject = (over: Partial<Project> = {}): Omit<Project, 'id' | 'createdAt' | 'updatedAt'> => ({
  title: 'P',
  status: 'in_progress',
  progressMode: 'auto',
  manualProgress: 0,
  milestones: [],
  links: [],
  tags: [],
  ...over,
});

describe('tasks', () => {
  it('creates and persists a task', async () => {
    const t = await newTask({ title: 'Write report' });
    const got = await db.tasks.get(t.id);
    expect(got?.title).toBe('Write report');
    expect(got?.status).toBe('not_started');
    expect(await db.activity.count()).toBe(1);
  });

  it('computes next recurrence dates', () => {
    expect(nextOccurrence('2026-01-31', { freq: 'monthly', interval: 1 })).toBe('2026-02-28');
    expect(nextOccurrence('2026-01-01', { freq: 'weekly', interval: 2 })).toBe('2026-01-15');
    expect(nextOccurrence('2026-01-01', { freq: 'daily', interval: 1 })).toBe('2026-01-02');
  });

  it('completing a recurring task schedules the next one in the future', async () => {
    const t = await newTask({ title: 'Weekly review', dueDate: addDaysISO(todayISO(), -10), recurrence: { freq: 'weekly', interval: 1 } });
    await setTaskStatus(t, 'completed');
    const all = await db.tasks.toArray();
    expect(all).toHaveLength(2);
    const next = all.find((x) => x.id !== t.id)!;
    expect(next.status).toBe('not_started');
    expect(next.dueDate! >= todayISO()).toBe(true);
    expect((await db.tasks.get(t.id))?.completedAt).toBeTruthy();
  });

  it('scores overdue urgent tasks above low-priority undated ones', () => {
    const a = { priority: 'urgent', dueDate: addDaysISO(todayISO(), -1), status: 'not_started' } as Task;
    const b = { priority: 'low', dueDate: null, status: 'not_started' } as Task;
    expect(taskScore(a)).toBeGreaterThan(taskScore(b));
  });
});

describe('project progress', () => {
  it('is the share of completed top-level tasks', async () => {
    const p = await create<Project>('projects', baseProject());
    const tasks: Task[] = [];
    for (let i = 0; i < 4; i++) tasks.push(await newTask({ title: `t${i}`, projectId: p.id, status: i < 1 ? 'completed' : 'not_started' }));
    // subtasks don't count
    tasks.push(await newTask({ title: 'sub', projectId: p.id, parentId: tasks[0].id }));
    expect(projectProgress(p, tasks).percent).toBe(25);
  });

  it('averages tasks and milestones so many tasks cannot inflate progress', async () => {
    const p = await create<Project>('projects', baseProject({ milestones: [{ id: 'm', title: 'M', done: false }] }));
    const tasks: Task[] = [];
    for (let i = 0; i < 20; i++) tasks.push(await newTask({ title: `t${i}`, projectId: p.id, status: 'completed' }));
    const r = projectProgress(p, tasks);
    expect(r.percent).toBe(50);
    expect(r.explanation).toMatch(/Average/);
  });

  it('respects manual mode and completed status', async () => {
    const p = await create<Project>('projects', baseProject({ progressMode: 'manual', manualProgress: 40 }));
    expect(projectProgress(p, []).percent).toBe(40);
    expect(projectProgress({ ...p, status: 'completed' }, []).percent).toBe(100);
  });

  it('creates projects from templates with dated tasks and milestones', async () => {
    await ensureBuiltInTemplates();
    const tpl = await db.templates.get('tpl-event');
    const p = await createProjectFromTemplate(tpl!, { title: 'Summit', startDate: '2026-03-01' });
    expect(p.milestones.length).toBe(tpl!.milestones.length);
    const tasks = await db.tasks.where('projectId').equals(p.id).toArray();
    expect(tasks.length).toBe(tpl!.tasks.length);
    expect(tasks.every((t) => t.dueDate && t.dueDate >= '2026-03-01')).toBe(true);
  });
});

describe('trash', () => {
  it('soft-deletes, restores and purges', async () => {
    const t = await newTask({ title: 'x' });
    await softDelete('tasks', t.id);
    expect((await db.tasks.get(t.id))?.deletedAt).toBeTruthy();
    await restore('tasks', t.id);
    expect((await db.tasks.get(t.id))?.deletedAt).toBeFalsy();
    await purge('tasks', t.id);
    expect(await db.tasks.get(t.id)).toBeUndefined();
  });
});

describe('backup & restore', () => {
  it('round-trips all data including files', async () => {
    await newTask({ title: 'Keep me' });
    await create<Note>('notes', { title: 'N', body: '# hi', kind: 'note', tags: ['a'], refs: [] });
    await create<StoredFile>('files', { name: 'a.txt', mime: 'text/plain', size: 5, blob: new Blob(['hello'], { type: 'text/plain' }), tags: [] });
    await saveSettings({ name: 'Yvan', ai: { ...DEFAULT_SETTINGS.ai, apiKey: 'secret-key' } });

    const backup = JSON.parse(JSON.stringify(await buildBackup()));
    expect(JSON.stringify(backup)).not.toContain('secret-key'); // API keys never exported
    const v = validateBackup(backup);
    expect(v.ok).toBe(true);
    expect(v.counts.tasks).toBe(1);

    __setDb(new WorkOSDB(`restore-${Math.random()}`));
    await db.open();
    const r = await importBackup(v.data!, 'replace');
    expect(r.added).toBeGreaterThanOrEqual(3);
    expect((await db.tasks.toArray())[0].title).toBe('Keep me');
    const f = (await db.files.toArray())[0];
    expect(await f.blob.text()).toBe('hello');
    expect((await getSettings()).name).toBe('Yvan');
  });

  it('merge never overwrites newer local data', async () => {
    const t = await newTask({ title: 'Local newer' });
    const backup = JSON.parse(JSON.stringify(await buildBackup()));
    backup.tables.tasks[0].title = 'Old copy';
    backup.tables.tasks[0].updatedAt = t.updatedAt - 1000;
    backup.tables.tasks.push({ ...backup.tables.tasks[0], id: 'new-one', title: 'From backup' });
    const r = await importBackup(validateBackup(backup).data!, 'merge');
    expect(r.added).toBe(1);
    expect(r.skipped).toBe(1);
    expect((await db.tasks.get(t.id))?.title).toBe('Local newer');
  });

  it('rejects invalid files without writing anything', () => {
    expect(validateBackup({ foo: 1 }).ok).toBe(false);
    expect(validateBackup({ app: 'work-os', schemaVersion: 999, tables: {} }).errors.join()).toMatch(/newer version/);
    expect(validateBackup({ app: 'work-os', schemaVersion: 1, tables: { tasks: [{ title: 'no id' }] } }).ok).toBe(false);
  });

  it('restores from a snapshot', async () => {
    await newTask({ title: 'before' });
    await createSnapshot('manual');
    await newTask({ title: 'after' });
    const snap = (await db.snapshots.toArray())[0];
    await restoreSnapshot(snap.id!);
    expect((await db.tasks.toArray()).map((t) => t.title)).toEqual(['before']);
  });

  it('escapes CSV correctly', () => {
    const csv = toCSV([{ a: 'x, "y"', b: ['p', 'q'] }], [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }]);
    expect(csv).toContain('"x, ""y"""');
    expect(csv).toContain('p; q');
  });
});

describe('demo content', () => {
  it('seeds labelled demo data and removes only demo data', async () => {
    await ensureBuiltInTemplates();
    const mine = await newTask({ title: 'My real task' });
    await seedDemo();
    expect(await hasDemo()).toBe(true);
    expect(await db.tasks.count()).toBeGreaterThan(10);
    await removeDemo();
    expect(await hasDemo()).toBe(false);
    const left = await db.tasks.toArray();
    expect(left.map((t) => t.id)).toEqual([mine.id]);
    expect(await db.templates.count()).toBeGreaterThan(0); // templates are not demo
  });
});

describe('search & notifications', () => {
  it('finds items across types', async () => {
    await newTask({ title: 'Prepare quarterly board deck' });
    await create<Note>('notes', { title: 'Ideas', body: 'the board wants a deck by friday', kind: 'note', tags: [], refs: [] });
    const hits = await searchAll('board deck');
    expect(hits.map((h) => h.type).sort()).toEqual(['note', 'task']);
    expect(hits[0].type).toBe('task'); // title match ranks higher
  });

  it('derives notifications and honours dismissals', async () => {
    const t = await newTask({ title: 'Late', dueDate: addDaysISO(todayISO(), -2) });
    await newTask({ title: 'Soon', dueDate: addDaysISO(todayISO(), 1) });
    const s = await getSettings();
    let list = await computeNotifications(s);
    expect(list.map((x) => x.title)).toEqual(expect.arrayContaining(['Late', 'Soon']));
    await dismiss([list.find((x) => x.title === 'Late')!.key]);
    list = await computeNotifications(s);
    expect(list.some((x) => x.title === 'Late')).toBe(false);
    await setTaskStatus(t, 'completed');
    expect(engagementRate(50, 1000, null)).toBe(5);
  });
});
