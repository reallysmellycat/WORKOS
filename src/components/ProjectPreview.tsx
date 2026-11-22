import { Link } from 'react-router-dom';
import { projectStatusMeta, type ProgressBreakdown } from '@/lib/domain';
import type { Project } from '@/lib/types';
import { cn, daysUntil, fmtDate, relativeDay } from '@/lib/utils';
import { Cover } from './Cover';
import { Badge, DemoBadge, Progress } from './ui';
import { TagList } from './pickers';

/**
 * Project preview (DESIGN.md §6 "Project previews"): a body of work, not a row.
 * Cover art identifies it; status, next milestone and progress make it actionable.
 *   size="feature" — the lead project in a composition (wide cover, serif title)
 *   size="standard" — grid tile
 */
export function ProjectPreview({ project: p, progress, openTasks, size = 'standard', className }: { project: Project; progress: ProgressBreakdown; openTasks: number; size?: 'feature' | 'standard'; className?: string }) {
  const sm = projectStatusMeta(p.status);
  const dd = daysUntil(p.deadline);
  const next = [...p.milestones].filter((m) => !m.done).sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'))[0];
  const feature = size === 'feature';
  return (
    <Link to={`/projects/${p.id}`} className={cn('panel lift group flex flex-col overflow-hidden', className)}>
      <div className={cn('relative overflow-hidden', feature && 'min-h-[240px] flex-1')}>
        <Cover seed={p.id} color={p.color} rounded={false} className={cn('w-full transition-transform duration-deliberate ease-out group-hover:scale-[1.02]', feature ? 'absolute inset-0 h-full' : 'aspect-[16/5]')} />
        <div className="absolute left-4 top-4 flex items-center gap-2">
          <Badge tone={sm.tone} className="!bg-raised/85 backdrop-blur">
            {sm.label}
          </Badge>
          {p.isDemo && <DemoBadge />}
        </div>
      </div>
      <div className={cn('flex flex-col', feature ? 'p-7' : 'flex-1 p-5')}>
        <h3 className={cn('transition-colors duration-fast group-hover:text-accent-deep', feature ? 'display text-h1' : 'text-h4 font-semibold tracking-tight')}>{p.title}</h3>
        {p.description && <p className={cn('mt-1.5 line-clamp-2 text-muted', feature ? 'text-body-l' : 'text-body-s')}>{p.description}</p>}
        <div className="flex-1" />
        <dl className="meta mt-5 grid grid-cols-3 gap-3 text-micro">
          <div>
            <dt className="uppercase tracking-[0.08em] text-faint">Next</dt>
            <dd className="mt-1 truncate font-sans text-body-s text-fg">{next ? next.title : '—'}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-[0.08em] text-faint">Open tasks</dt>
            <dd className="mt-1 text-body-s text-fg">{openTasks}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-[0.08em] text-faint">Deadline</dt>
            <dd className={cn('mt-1 text-body-s', dd !== null && dd < 0 && p.status !== 'completed' ? 'text-danger' : 'text-fg')}>{p.deadline ? (Math.abs(dd ?? 99) < 8 ? relativeDay(p.deadline) : fmtDate(p.deadline, 'd MMM')) : '—'}</dd>
          </div>
        </dl>
        <div className="mt-4 flex items-center gap-3">
          <Progress value={progress.percent} tone={p.status === 'completed' ? 'ok' : 'accent'} className="flex-1" />
          <span className="num text-body-s" title={progress.explanation}>
            {progress.percent}%
          </span>
        </div>
        {p.tags.length > 0 && (
          <div className="mt-4">
            <TagList tags={p.tags} />
          </div>
        )}
      </div>
    </Link>
  );
}
