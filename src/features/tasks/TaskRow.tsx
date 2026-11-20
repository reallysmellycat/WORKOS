import { memo } from 'react';
import { Ban, CalendarDays, CheckSquare, FolderKanban, GitBranch, Repeat, Sun } from 'lucide-react';
import type { Project, Task } from '@/lib/types';
import { isOverdue, priorityMeta } from '@/lib/domain';
import { toggleTaskDone } from '@/lib/repo';
import { cn, daysUntil, relativeDay, todayISO } from '@/lib/utils';
import { Checkbox, DemoBadge } from '@/components/ui';
import { useApp } from '@/app/context';

const PRIORITY_RING: Record<string, string> = {
  urgent: 'border-danger/70',
  high: 'border-warn/80',
  medium: 'border-line-strong',
  low: 'border-line-strong',
};

export function DueLabel({ date, done }: { date?: string | null; done?: boolean }) {
  if (!date) return null;
  const n = daysUntil(date)!;
  const tone = done ? 'text-faint' : n < 0 ? 'text-danger' : n === 0 ? 'text-warn' : n <= 2 ? 'text-fg' : 'text-muted';
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs tabular-nums', tone)}>
      <CalendarDays className="h-3 w-3" />
      {relativeDay(date)}
    </span>
  );
}

export const TaskRow = memo(function TaskRow({
  task,
  project,
  showProject = true,
  subCount,
  blocked,
  selected,
  onSelect,
  draggable,
  compact,
}: {
  task: Task;
  project?: Project | null;
  showProject?: boolean;
  subCount?: { done: number; total: number };
  blocked?: boolean;
  selected?: boolean;
  onSelect?: (v: boolean) => void;
  draggable?: boolean;
  compact?: boolean;
}) {
  const { openTask } = useApp();
  const done = task.status === 'completed';
  const pm = priorityMeta(task.priority);
  const checklistDone = task.checklist.filter((c) => c.done).length;
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/task-id', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={() => openTask(task.id)}
      className={cn(
        'group flex cursor-pointer items-center gap-2.5 rounded-md px-2 transition-colors hover:bg-sunken/60',
        compact ? 'py-1.5' : 'py-2',
        selected && 'bg-accent-soft/50 hover:bg-accent-soft/70',
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && openTask(task.id)}
    >
      {onSelect && (
        <input
          type="checkbox"
          checked={!!selected}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onSelect(e.target.checked)}
          className={cn('h-3.5 w-3.5 accent-[rgb(var(--accent))] transition-opacity', selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60')}
          aria-label="Select task"
        />
      )}
      <Checkbox checked={done} onChange={() => toggleTaskDone(task)} tone={PRIORITY_RING[task.priority]} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn('truncate text-[13.5px]', done && 'text-faint line-through decoration-faint/60')}>{task.title}</span>
          {task.isDemo && <DemoBadge />}
        </div>
        {!compact && (task.description || (showProject && project)) && (
          <div className="mt-0.5 flex items-center gap-2 text-xs text-faint">
            {showProject && project && (
              <span className="inline-flex items-center gap-1 truncate">
                <FolderKanban className="h-3 w-3" />
                {project.title}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2.5 text-faint">
        {task.myDay === todayISO() && !done && <Sun className="h-3.5 w-3.5 text-warn" aria-label="In My Day" />}
        {blocked && !done && (
          <span className="inline-flex items-center gap-1 text-xs text-warn" title="Waiting on another task">
            <Ban className="h-3 w-3" /> Blocked
          </span>
        )}
        {task.recurrence && <Repeat className="h-3.5 w-3.5" aria-label="Recurring" />}
        {subCount && subCount.total > 0 && (
          <span className="inline-flex items-center gap-1 text-xs tabular-nums">
            <GitBranch className="h-3 w-3" />
            {subCount.done}/{subCount.total}
          </span>
        )}
        {task.checklist.length > 0 && (
          <span className="hidden sm:inline-flex items-center gap-1 text-xs tabular-nums">
            <CheckSquare className="h-3 w-3" />
            {checklistDone}/{task.checklist.length}
          </span>
        )}
        <DueLabel date={task.dueDate} done={done} />
        {(task.priority === 'urgent' || task.priority === 'high') && !done && (
          <span className={cn('text-2xs font-semibold uppercase tracking-wide', task.priority === 'urgent' ? 'text-danger' : 'text-warn')}>{pm.label}</span>
        )}
        {isOverdue(task) && <span className="sr-only">Overdue</span>}
      </div>
    </div>
  );
});
