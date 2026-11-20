import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, FolderKanban, LayoutGrid, List, Plus, Search } from 'lucide-react';
import { useProjects, useTasks } from '@/lib/hooks';
import { PROJECT_STATUSES, projectProgress, projectStatusMeta } from '@/lib/domain';
import type { ProjectStatus } from '@/lib/types';
import { cn, daysUntil, fmtDate, relativeDay } from '@/lib/utils';
import { Badge, Button, DemoBadge, Empty, Input, Loading, Page, PageHeader, Progress, Tabs } from '@/components/ui';
import { TagList } from '@/components/pickers';
import { useApp } from '@/app/context';

export default function ProjectsPage() {
  const projects = useProjects();
  const tasks = useTasks();
  const { quickAdd } = useApp();
  const [status, setStatus] = useState<ProjectStatus | 'active' | 'all'>('active');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    if (!projects || !tasks) return [];
    return projects
      .filter((p) => (status === 'all' ? true : status === 'active' ? p.status !== 'completed' : p.status === status))
      .filter((p) => !q || p.title.toLowerCase().includes(q.toLowerCase()) || (p.description ?? '').toLowerCase().includes(q.toLowerCase()))
      .map((p) => ({ p, prog: projectProgress(p, tasks), open: tasks.filter((t) => t.projectId === p.id && t.status !== 'completed' && !t.parentId).length }))
      .sort((a, b) => (a.p.deadline ?? '9999').localeCompare(b.p.deadline ?? '9999'));
  }, [projects, tasks, status, q]);

  if (!projects || !tasks) return <Loading />;
  const count = (s: ProjectStatus) => projects.filter((p) => p.status === s).length;

  return (
    <Page>
      <PageHeader
        title="Projects"
        subtitle={`${projects.filter((p) => p.status !== 'completed').length} active · ${count('completed')} completed`}
        actions={
          <>
            <Tabs value={layout} onChange={setLayout} tabs={[{ value: 'grid', label: 'Cards', icon: LayoutGrid }, { value: 'list', label: 'List', icon: List }]} />
            <Button variant="primary" icon={Plus} onClick={() => quickAdd({ type: 'project' })}>
              New project
            </Button>
          </>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Tabs
          value={status}
          onChange={setStatus}
          tabs={[
            { value: 'active', label: 'Active' },
            ...PROJECT_STATUSES.map((s) => ({ value: s.value, label: s.label, count: count(s.value) })),
            { value: 'all', label: 'All' },
          ]}
        />
        <div className="flex-1" />
        <div className="relative w-full sm:w-56">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects" className="pl-8" />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <Empty
            icon={FolderKanban}
            title={projects.length ? 'No projects match' : 'No projects yet'}
            action={
              <Button variant="primary" icon={Plus} onClick={() => quickAdd({ type: 'project' })}>
                Create a project
              </Button>
            }
          >
            Projects hold tasks, milestones, notes, documents and links. Start from a template (PR campaign, event, content…) or a blank page.
          </Empty>
        </div>
      ) : layout === 'grid' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ p, prog, open }) => {
            const sm = projectStatusMeta(p.status);
            const dd = daysUntil(p.deadline);
            return (
              <Link key={p.id} to={`/projects/${p.id}`} className="card group flex flex-col p-4 transition-all hover:border-line-strong hover:shadow-soft">
                <div className="flex items-center gap-2">
                  <Badge tone={sm.tone} dot>
                    {sm.label}
                  </Badge>
                  {p.isDemo && <DemoBadge />}
                  <div className="flex-1" />
                  {p.deadline && (
                    <span className={cn('inline-flex items-center gap-1 text-xs', dd !== null && dd < 0 && p.status !== 'completed' ? 'text-danger' : 'text-faint')}>
                      <CalendarDays className="h-3 w-3" />
                      {relativeDay(p.deadline)}
                    </span>
                  )}
                </div>
                <h3 className="mt-3 text-[15px] font-semibold leading-snug group-hover:text-accent transition-colors">{p.title}</h3>
                {p.description && <p className="mt-1 line-clamp-2 text-[13px] text-muted">{p.description}</p>}
                <div className="flex-1" />
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-faint">{open} open task{open === 1 ? '' : 's'}</span>
                    <span className="font-medium tabular-nums" title={prog.explanation}>
                      {prog.percent}%
                    </span>
                  </div>
                  <Progress value={prog.percent} tone={p.status === 'completed' ? 'ok' : 'accent'} />
                </div>
                {p.tags.length > 0 && (
                  <div className="mt-3">
                    <TagList tags={p.tags} />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="card divide-y divide-line">
          {rows.map(({ p, prog, open }) => {
            const sm = projectStatusMeta(p.status);
            return (
              <Link key={p.id} to={`/projects/${p.id}`} className="flex items-center gap-4 px-4 py-3 row-hover">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13.5px] font-medium">{p.title}</span>
                    {p.isDemo && <DemoBadge />}
                  </div>
                  <div className="text-xs text-faint">{open} open tasks</div>
                </div>
                <Badge tone={sm.tone} dot>
                  {sm.label}
                </Badge>
                <span className="hidden w-24 text-right text-xs text-muted sm:block">{p.deadline ? fmtDate(p.deadline, 'd MMM yyyy') : '—'}</span>
                <div className="hidden w-32 items-center gap-2 md:flex">
                  <Progress value={prog.percent} />
                  <span className="w-8 text-right text-xs tabular-nums">{prog.percent}%</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Page>
  );
}
