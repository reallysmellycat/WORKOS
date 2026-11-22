import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarPlus, CheckCircle2, Plus, Sun, Sunrise, X } from 'lucide-react';
import { db } from '@/lib/db';
import { useById, useProjects, useTasks, useAutosave } from '@/lib/hooks';
import { isBlocked, sortByScore, taskScore } from '@/lib/domain';
import { newTask, update } from '@/lib/repo';
import type { Task } from '@/lib/types';
import { addDaysISO, todayISO } from '@/lib/utils';
import { Button, Card, Empty, IconButton, Loading, Page, Progress, Textarea } from '@/components/ui';
import { useApp } from '@/app/context';
import { TaskRow } from '../tasks/TaskRow';
import { sourceColor, useCalendarItems } from '../calendar/calendarData';

export default function MyDay() {
  const tasks = useTasks();
  const projects = useProjects();
  const pm = useById(projects);
  const tm = useById(tasks);
  const today = todayISO();
  const { openEntity, openEvent } = useApp();
  const [title, setTitle] = useState('');
  const schedule = useCalendarItems(today, today);

  const { plan, suggestions, doneToday } = useMemo(() => {
    const t = tasks ?? [];
    const open = t.filter((x) => x.status !== 'completed' && !x.parentId);
    const plan = sortByScore(open.filter((x) => x.myDay === today || (x.dueDate && x.dueDate <= today)));
    const planIds = new Set(plan.map((p) => p.id));
    const suggestions = open
      .filter((x) => !planIds.has(x.id) && (x.priority === 'urgent' || x.priority === 'high' || x.status === 'in_progress' || (x.dueDate && x.dueDate <= addDaysISO(today, 3))))
      .sort((a, b) => taskScore(b) - taskScore(a))
      .slice(0, 6);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const doneToday = t.filter((x) => x.completedAt && x.completedAt >= start.getTime());
    return { plan, suggestions, doneToday };
  }, [tasks, today]);

  if (!tasks) return <Loading />;
  const total = plan.length + doneToday.length;

  const add = async () => {
    if (!title.trim()) return;
    await newTask({ title: title.trim(), myDay: today });
    setTitle('');
  };

  return (
    <Page>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-body-s text-faint">
            <Sun className="h-3.5 w-3.5 text-warn" /> My Day
          </p>
          <h1 className="mt-1 font-serif text-h1 font-medium leading-tight tracking-tight">{format(new Date(), 'EEEE, d MMMM')}</h1>
        </div>
        <div className="w-full max-w-[240px]">
          <div className="mb-1.5 flex justify-between text-body-s text-muted">
            <span>Today's progress</span>
            <span className="tabular-nums">
              {doneToday.length}/{total}
            </span>
          </div>
          <Progress value={total ? (doneToday.length / total) * 100 : 0} tone="ok" />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <div className="card p-1.5">
            <div className="flex items-center gap-2.5 px-2 py-1.5">
              <Plus className="h-4 w-4 text-faint" />
              <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Add a task for today" className="flex-1 bg-transparent py-1 text-body-m outline-none placeholder:text-faint" />
            </div>
            <div className="mx-2 h-px bg-line" />
            {plan.length === 0 ? (
              <Empty icon={Sunrise} title="Your day is a blank page" compact>
                Add tasks above, or pick from the suggestions. Tasks due today appear here automatically.
              </Empty>
            ) : (
              <div className="pt-1">
                {plan.map((t) => (
                  <div key={t.id} className="group relative">
                    <TaskRow task={t} project={t.projectId ? pm.get(t.projectId) : null} blocked={isBlocked(t, tm)} />
                    {t.myDay === today && (!t.dueDate || t.dueDate > today) && (
                      <IconButton
                        icon={X}
                        size="sm"
                        label="Remove from My Day"
                        className="absolute right-1 top-1/2 -translate-y-1/2 bg-surface opacity-0 group-hover:opacity-100"
                        onClick={() => update<Task>('tasks', t.id, { myDay: null }, { log: false })}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {doneToday.length > 0 && (
            <Card title={`Completed today · ${doneToday.length}`} icon={CheckCircle2}>
              <div className="-mx-2">
                {doneToday.map((t) => (
                  <TaskRow key={t.id} task={t} compact />
                ))}
              </div>
            </Card>
          )}

          <DailyNote date={today} />
        </div>

        <div className="space-y-5">
          <Card
            title="Schedule"
            icon={CalendarPlus}
            action={
              <Button size="xs" variant="ghost" icon={Plus} onClick={() => openEvent(null, today)}>
                Block time
              </Button>
            }
          >
            {(schedule ?? []).filter((s) => s.source !== 'task').length === 0 ? (
              <p className="text-body-s text-faint">No meetings or blocks today. Protect some time for focused work.</p>
            ) : (
              <div className="space-y-1">
                {(schedule ?? [])
                  .filter((s) => s.source !== 'task')
                  .map((s) => (
                    <button key={s.key} onClick={() => openEntity(s.open.type, s.open.id)} className="-mx-1.5 flex w-full items-center gap-2.5 rounded-sm px-1.5 py-1.5 text-left row-hover">
                      <span className="h-7 w-[3px] rounded-full" style={{ background: sourceColor(s.source) }} />
                      <span className="w-12 text-body-s tabular-nums text-faint">{s.startTime ?? 'All day'}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body-s">{s.title}</span>
                        {s.endTime && <span className="block text-caption text-faint">until {s.endTime}</span>}
                      </span>
                    </button>
                  ))}
              </div>
            )}
          </Card>

          <Card title="Suggestions" icon={Sun}>
            {suggestions.length === 0 ? (
              <p className="text-body-s text-faint">No suggestions — nothing urgent is waiting.</p>
            ) : (
              <div className="-mx-1.5">
                {suggestions.map((t) => (
                  <div key={t.id} className="group flex items-center gap-2 rounded-sm px-1.5 py-1.5 row-hover">
                    <button className="min-w-0 flex-1 text-left" onClick={() => openEntity('task', t.id)}>
                      <div className="truncate text-body-s">{t.title}</div>
                      <div className="text-caption text-faint">{reason(t, today)}</div>
                    </button>
                    <Button size="xs" icon={Plus} onClick={() => update<Task>('tasks', t.id, { myDay: today }, { log: false })}>
                      Today
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-caption text-faint">Suggested by simple rules (priority, due date, status) — not AI.</p>
          </Card>
        </div>
      </div>
    </Page>
  );
}

function reason(t: Task, today: string) {
  if (t.dueDate && t.dueDate <= addDaysISO(today, 3)) return `Due ${t.dueDate === addDaysISO(today, 1) ? 'tomorrow' : format(new Date(t.dueDate), 'EEEE')}`;
  if (t.status === 'in_progress') return 'In progress';
  return `${t.priority[0].toUpperCase()}${t.priority.slice(1)} priority`;
}

/** A free-form note for the day, stored locally. */
function DailyNote({ date }: { date: string }) {
  const key = `daily:${date}`;
  const row = useLiveQuery(() => db.kv.get(key), [key]);
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (row !== undefined && text === null) setText((row?.value as string) ?? '');
  }, [row, text]);
  const status = useAutosave(text, async (v) => {
    if (v !== null) await db.kv.put({ key, value: v });
  }, 500, text !== null);
  return (
    <Card title="Daily notes" action={<span className="text-caption text-faint">{status === 'saved' ? 'Saved' : status === 'pending' || status === 'saving' ? 'Saving…' : ''}</span>}>
      <Textarea autoGrow rows={4} value={text ?? ''} onChange={(e) => setText(e.target.value)} placeholder="Intentions, notes from today, things to remember tomorrow…" className="!border-0 !bg-transparent !px-0 !ring-0" />
    </Card>
  );
}
