import { db } from './db';
import { create, newTask } from './repo';
import type { Project, ProjectTemplate, Task } from './types';
import { addDaysISO, todayISO, uid } from './utils';

type Builtin = Omit<ProjectTemplate, 'id' | 'createdAt' | 'updatedAt'> & { id: string };

export const BUILTIN_TEMPLATES: Builtin[] = [
  {
    id: 'tpl-pr',
    name: 'PR campaign',
    kind: 'pr',
    builtIn: true,
    description: 'Plan, write, distribute and measure a press campaign.',
    objectives: '- Secure coverage in priority outlets\n- Communicate the key message clearly\n- Measure reach and sentiment',
    durationDays: 42,
    milestones: [
      { title: 'Messaging approved', offsetDays: 7 },
      { title: 'Press release distributed', offsetDays: 21 },
      { title: 'Coverage report complete', offsetDays: 42 },
    ],
    tasks: [
      { title: 'Define objectives and key messages', priority: 'high', offsetDays: 3 },
      { title: 'Build target media list', priority: 'medium', offsetDays: 7 },
      { title: 'Draft press release', priority: 'high', offsetDays: 10 },
      { title: 'Prepare media kit and visuals', priority: 'medium', offsetDays: 14 },
      { title: 'Distribute press release', priority: 'urgent', offsetDays: 21 },
      { title: 'Follow up with journalists', priority: 'medium', offsetDays: 25 },
      { title: 'Track coverage and compile report', priority: 'medium', offsetDays: 40 },
    ],
  },
  {
    id: 'tpl-marketing',
    name: 'Marketing initiative',
    kind: 'marketing',
    builtIn: true,
    description: 'A focused marketing push with clear goals and measurement.',
    objectives: '- Define the audience and goal\n- Launch across chosen channels\n- Report results against target',
    durationDays: 60,
    milestones: [
      { title: 'Strategy signed off', offsetDays: 10 },
      { title: 'Launch', offsetDays: 30 },
      { title: 'Results review', offsetDays: 60 },
    ],
    tasks: [
      { title: 'Research audience and competitors', priority: 'medium', offsetDays: 5 },
      { title: 'Write strategy and channel plan', priority: 'high', offsetDays: 10 },
      { title: 'Create assets', priority: 'high', offsetDays: 24 },
      { title: 'Launch', priority: 'urgent', offsetDays: 30 },
      { title: 'Mid-point performance check', priority: 'medium', offsetDays: 45 },
      { title: 'Final results report', priority: 'medium', offsetDays: 60 },
    ],
  },
  {
    id: 'tpl-content',
    name: 'Content project',
    kind: 'content',
    builtIn: true,
    description: 'A content series from idea to published, with a review step.',
    objectives: '- Publish a consistent series\n- Grow engagement on the chosen platform',
    durationDays: 30,
    milestones: [
      { title: 'Content plan ready', offsetDays: 5 },
      { title: 'First piece published', offsetDays: 12 },
      { title: 'Series complete', offsetDays: 30 },
    ],
    tasks: [
      { title: 'Collect ideas and references', priority: 'medium', offsetDays: 3 },
      { title: 'Outline the series', priority: 'high', offsetDays: 5 },
      { title: 'Draft first pieces', priority: 'high', offsetDays: 10 },
      { title: 'Review and schedule', priority: 'medium', offsetDays: 12 },
      { title: 'Record performance metrics', priority: 'low', offsetDays: 30 },
    ],
  },
  {
    id: 'tpl-event',
    name: 'Event',
    kind: 'event',
    builtIn: true,
    description: 'Plan and run an event, from venue to follow-up.',
    objectives: '- Deliver a smooth event\n- Hit attendance goal\n- Follow up with attendees',
    durationDays: 45,
    milestones: [
      { title: 'Venue and date confirmed', offsetDays: 7 },
      { title: 'Invitations sent', offsetDays: 21 },
      { title: 'Event day', offsetDays: 40 },
      { title: 'Follow-up complete', offsetDays: 45 },
    ],
    tasks: [
      { title: 'Set goals, budget and format', priority: 'high', offsetDays: 3 },
      { title: 'Book venue', priority: 'urgent', offsetDays: 7 },
      { title: 'Confirm speakers / agenda', priority: 'high', offsetDays: 14 },
      { title: 'Send invitations', priority: 'high', offsetDays: 21 },
      { title: 'Prepare materials', priority: 'medium', offsetDays: 35 },
      { title: 'Run-of-show check', priority: 'high', offsetDays: 39 },
      { title: 'Send thank-you and follow-up', priority: 'medium', offsetDays: 43 },
    ],
  },
  {
    id: 'tpl-general',
    name: 'General project',
    kind: 'general',
    builtIn: true,
    description: 'A simple structure: plan, do, review.',
    objectives: '',
    durationDays: 30,
    milestones: [
      { title: 'Plan agreed', offsetDays: 5 },
      { title: 'Delivered', offsetDays: 28 },
    ],
    tasks: [
      { title: 'Clarify scope and success criteria', priority: 'high', offsetDays: 2 },
      { title: 'Break work into steps', priority: 'medium', offsetDays: 4 },
      { title: 'Review and wrap up', priority: 'medium', offsetDays: 30 },
    ],
  },
];

/** Inserts the built-in templates if they don't exist yet (never overwrites edits). */
export async function ensureBuiltInTemplates() {
  for (const t of BUILTIN_TEMPLATES) {
    const existing = await db.templates.get(t.id);
    if (!existing) await db.templates.put({ ...t, createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null });
  }
}

export async function createProjectFromTemplate(
  tpl: ProjectTemplate | null,
  data: { title: string; startDate?: string | null; deadline?: string | null; description?: string; isDemo?: boolean },
): Promise<Project> {
  const start = data.startDate || todayISO();
  const offset = (d?: number | null) => (d === null || d === undefined ? null : addDaysISO(start, d));
  const project = await create<Project>('projects', {
    title: data.title,
    description: data.description ?? tpl?.description ?? '',
    objectives: tpl?.objectives ?? '',
    status: 'planning',
    startDate: start,
    deadline: data.deadline ?? (tpl?.durationDays ? addDaysISO(start, tpl.durationDays) : null),
    progressMode: 'auto',
    manualProgress: 0,
    milestones: (tpl?.milestones ?? []).map((m) => ({ id: uid(), title: m.title, date: offset(m.offsetDays), done: false })),
    links: [],
    tags: [],
    templateId: tpl?.id ?? null,
    isDemo: data.isDemo,
  });
  for (const [i, t] of (tpl?.tasks ?? []).entries()) {
    await newTask({ title: t.title, priority: t.priority, dueDate: offset(t.offsetDays), projectId: project.id, order: i, isDemo: data.isDemo } as Partial<Task> & { title: string });
  }
  return project;
}

/** Saves an existing project's structure as a reusable custom template. */
export async function saveProjectAsTemplate(project: Project, tasks: Task[], name: string) {
  const start = project.startDate ?? todayISO();
  const diff = (d?: string | null) => (d ? Math.round((new Date(d).getTime() - new Date(start).getTime()) / 86400000) : null);
  return create<ProjectTemplate>('templates', {
    name,
    kind: 'custom',
    description: project.description,
    objectives: project.objectives,
    durationDays: diff(project.deadline),
    milestones: project.milestones.map((m) => ({ title: m.title, offsetDays: diff(m.date) })),
    tasks: tasks.filter((t) => t.projectId === project.id && !t.parentId && !t.deletedAt).map((t) => ({ title: t.title, priority: t.priority, offsetDays: diff(t.dueDate) })),
  });
}
