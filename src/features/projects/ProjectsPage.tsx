import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, LayoutGrid, List, Plus, Search } from 'lucide-react';
import { useProjects, useTasks } from '@/lib/hooks';
import { PROJECT_STATUSES, projectProgress, projectStatusMeta } from '@/lib/domain';
import type { ProjectStatus } from '@/lib/types';
import { fmtDate } from '@/lib/utils';
import { Badge, Button, DemoBadge, Empty, Input, Loading, Page, PageHeader, Progress, Tabs } from '@/components/ui';
import { ProjectPreview } from '@/components/ProjectPreview';
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
        <div className="grid gap-grid sm:grid-cols-2 xl:grid-cols-12">
          {rows.map(({ p, prog, open }, i) => (
            <ProjectPreview
              key={p.id}
              project={p}
              progress={prog}
              openTasks={open}
              size={i === 0 && rows.length > 2 ? 'feature' : 'standard'}
              className={i === 0 && rows.length > 2 ? 'sm:col-span-2 xl:col-span-7 xl:row-span-2' : 'xl:col-span-5'}
            />
          ))}
        </div>
      ) : (
        <div className="card divide-y divide-line">
          {rows.map(({ p, prog, open }) => {
            const sm = projectStatusMeta(p.status);
            return (
              <Link key={p.id} to={`/projects/${p.id}`} className="flex items-center gap-4 px-4 py-3 row-hover">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-body-m font-medium">{p.title}</span>
                    {p.isDemo && <DemoBadge />}
                  </div>
                  <div className="text-body-s text-faint">{open} open tasks</div>
                </div>
                <Badge tone={sm.tone} dot>
                  {sm.label}
                </Badge>
                <span className="hidden w-24 text-right text-body-s text-muted sm:block">{p.deadline ? fmtDate(p.deadline, 'd MMM yyyy') : '—'}</span>
                <div className="hidden w-32 items-center gap-2 md:flex">
                  <Progress value={prog.percent} />
                  <span className="w-8 text-right text-body-s tabular-nums">{prog.percent}%</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Page>
  );
}
