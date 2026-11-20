import { db } from '@/lib/db';
import { ENTITY } from '@/lib/entities';
import { engagementOf, isOverdue, projectProgress, sortByScore } from '@/lib/domain';
import type { EntityRef } from '@/lib/types';
import { addDaysISO, fmtTs, monthKey, todayISO } from '@/lib/utils';

/** Turns an explicitly selected item into plain text for the model. */
export async function serializeRef(ref: EntityRef): Promise<string> {
  const t = ENTITY[ref.type];
  const r = (await db.table(t.table).get(ref.id)) as Record<string, unknown> | undefined;
  if (!r || r.deletedAt) return '';
  const lines: string[] = [`### ${t.label}: ${r[t.titleField] ?? 'Untitled'}`];
  const add = (label: string, v: unknown) => {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return;
    lines.push(`${label}: ${Array.isArray(v) ? v.join(', ') : String(v)}`);
  };
  switch (ref.type) {
    case 'project': {
      const tasks = (await db.tasks.where('projectId').equals(ref.id).toArray()).filter((x) => !x.deletedAt);
      const p = r as never as import('@/lib/types').Project;
      add('Status', p.status);
      add('Dates', `${p.startDate ?? '?'} → ${p.deadline ?? '?'}`);
      add('Progress', `${projectProgress(p, tasks).percent}% (${projectProgress(p, tasks).explanation})`);
      add('Description', p.description);
      add('Objectives', p.objectives);
      if (p.milestones.length) lines.push('Milestones:\n' + p.milestones.map((m) => `- [${m.done ? 'x' : ' '}] ${m.title}${m.date ? ` (${m.date})` : ''}`).join('\n'));
      if (tasks.length) lines.push('Tasks:\n' + tasks.map((x) => `- [${x.status === 'completed' ? 'x' : ' '}] ${x.title} — ${x.status}, ${x.priority}${x.dueDate ? `, due ${x.dueDate}` : ''}`).join('\n'));
      add('Notes', p.notes);
      break;
    }
    case 'task':
      add('Status', r.status);
      add('Priority', r.priority);
      add('Due', r.dueDate);
      add('Description', r.description);
      add('Notes', r.notes);
      break;
    case 'campaign': {
      const cov = (await db.coverage.where('campaignId').equals(ref.id).toArray()).filter((x) => !x.deletedAt);
      const content = (await db.content.where('campaignId').equals(ref.id).toArray()).filter((x) => !x.deletedAt);
      const rel = (await db.pressReleases.where('campaignId').equals(ref.id).toArray()).filter((x) => !x.deletedAt);
      add('Status', r.status);
      add('Dates', `${r.startDate ?? '?'} → ${r.endDate ?? '?'}`);
      add('Description', r.description);
      add('Objectives', r.objectives);
      add('Audience', r.audience);
      add('Key messages', r.keyMessages);
      if (r.budget) add('Budget', `${r.spent ?? 0} spent of ${r.budget} ${r.currency ?? ''}`);
      if (rel.length) lines.push('Press releases:\n' + rel.map((x) => `- ${x.title} (${x.status}${x.distributionDate ? `, ${x.distributionDate}` : ''})`).join('\n'));
      if (cov.length) lines.push(`Coverage (${cov.length} pieces, total reach ${cov.reduce((s, c) => s + (c.reach ?? 0), 0)}):\n` + cov.map((c) => `- ${c.date ?? ''} ${c.outlet}: "${c.headline}" reach ${c.reach ?? '?'}, ${c.sentiment ?? ''}`).join('\n'));
      if (content.length) lines.push('Content:\n' + content.map((c) => `- ${c.title} (${c.platform}, ${c.status}${c.metrics.reach ? `, reach ${c.metrics.reach}, engagement ${engagementOf(c.metrics)}` : ''})`).join('\n'));
      add('Results', r.results);
      break;
    }
    case 'content':
      add('Platform', r.platform);
      add('Type', r.contentType);
      add('Status', r.status);
      add('Publish date', r.publishDate);
      add('Draft', r.draft);
      add('Caption', r.caption);
      add('Metrics', JSON.stringify(r.metrics));
      break;
    case 'note':
    case 'document':
      add('Tags', r.tags);
      lines.push(String(r.body ?? ''));
      break;
    case 'pressRelease':
      add('Status', r.status);
      lines.push(String(r.body ?? ''));
      break;
    case 'idea':
      add('Details', r.details);
      break;
    case 'file': {
      const f = r as never as import('@/lib/types').StoredFile;
      if (/^text\/|json|markdown|csv/.test(f.mime) || /\.(md|txt|csv)$/i.test(f.name)) lines.push((await f.blob.text()).slice(0, 20000));
      else lines.push(`(Binary file ${f.mime}, ${f.size} bytes — its contents can't be read by the assistant. Paste the relevant text into a note instead.)`);
      break;
    }
    default:
      for (const [k, v] of Object.entries(r)) if (typeof v === 'string' && !['id'].includes(k)) add(k, v);
  }
  return lines.join('\n');
}

export type Preset = 'tasks' | 'projects' | 'month' | 'ideas';

export const PRESETS: { key: Preset; label: string; description: string }[] = [
  { key: 'tasks', label: 'Open tasks overview', description: 'Overdue, due in the next 14 days, and in-progress tasks (titles, priority, dates).' },
  { key: 'projects', label: 'Active projects', description: 'Status, deadline, progress and open task counts.' },
  { key: 'month', label: "This month's activity", description: 'Completed tasks and projects, published content, coverage.' },
  { key: 'ideas', label: 'Ideas inbox', description: 'Unprocessed ideas.' },
];

export async function serializePreset(p: Preset): Promise<string> {
  const today = todayISO();
  const tasks = (await db.tasks.toArray()).filter((t) => !t.deletedAt);
  if (p === 'tasks') {
    const open = sortByScore(tasks.filter((t) => t.status !== 'completed' && (isOverdue(t) || t.status === 'in_progress' || (t.dueDate && t.dueDate <= addDaysISO(today, 14))))).slice(0, 60);
    return `### Open tasks (today is ${today})\n` + open.map((t) => `- ${t.title} — ${t.priority}, ${t.status}${t.dueDate ? `, due ${t.dueDate}${isOverdue(t) ? ' (OVERDUE)' : ''}` : ''}`).join('\n');
  }
  if (p === 'projects') {
    const projects = (await db.projects.toArray()).filter((x) => !x.deletedAt && x.status !== 'completed');
    return '### Active projects\n' + projects.map((x) => `- ${x.title} — ${x.status}, deadline ${x.deadline ?? 'none'}, progress ${projectProgress(x, tasks).percent}%, ${tasks.filter((t) => t.projectId === x.id && t.status !== 'completed').length} open tasks`).join('\n');
  }
  if (p === 'ideas') {
    const ideas = (await db.ideas.toArray()).filter((i) => !i.deletedAt && i.status === 'inbox');
    return '### Ideas inbox\n' + ideas.map((i) => `- ${i.text}${i.details ? ` — ${i.details}` : ''}`).join('\n');
  }
  const m = monthKey(new Date());
  const done = tasks.filter((t) => t.completedAt && monthKey(new Date(t.completedAt)) === m);
  const projects = (await db.projects.toArray()).filter((x) => !x.deletedAt && x.status === 'completed' && x.completedAt && monthKey(new Date(x.completedAt)) === m);
  const content = (await db.content.toArray()).filter((c) => !c.deletedAt && c.status === 'published' && c.publishDate?.startsWith(m));
  const cov = (await db.coverage.toArray()).filter((c) => !c.deletedAt && c.date?.startsWith(m));
  return [
    `### This month (${m})`,
    `Completed tasks (${done.length}):`,
    ...done.map((t) => `- ${t.title} (${fmtTs(t.completedAt, 'd MMM')})`),
    `Completed projects: ${projects.map((x) => x.title).join(', ') || 'none'}`,
    `Published content (${content.length}):`,
    ...content.map((c) => `- ${c.title} on ${c.platform}${c.metrics.reach ? `, reach ${c.metrics.reach}` : ''}`),
    `Coverage (${cov.length}): ${cov.map((c) => `${c.outlet} — ${c.headline}`).join('; ') || 'none'}`,
  ].join('\n');
}

export interface QuickAction {
  label: string;
  prompt: string;
  needs?: string;
  preset?: Preset;
}

export const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Suggest my priorities', prompt: 'Based on my open tasks, suggest my top 3–5 priorities for today and this week, with one line of reasoning each. Flag anything overdue that I should renegotiate or drop.', preset: 'tasks' },
  { label: 'Summarise a project', prompt: 'Summarise this project: where it stands, what is at risk, and the next three actions.', needs: 'Add a project to the context first.' },
  { label: 'Turn rough thoughts into a plan', prompt: 'Turn the following rough thoughts into a structured plan with goals, steps and a checklist of tasks:\n\n' },
  { label: 'Draft a LinkedIn post', prompt: 'Draft a LinkedIn post (150–220 words) with a strong first-line hook, short paragraphs and one clear takeaway. Topic: ' },
  { label: 'Draft a press release', prompt: 'Draft a press release in standard format (headline, subheadline, dateline, lead, body with a quote, boilerplate placeholder, media contact placeholder) based on the campaign in context.', needs: 'Add a campaign (or notes) to the context.' },
  { label: 'Analyse campaign results', prompt: 'Analyse the results of this campaign: what worked, what underperformed, and three concrete recommendations. Only use the numbers provided.', needs: 'Add a campaign to the context.' },
  { label: 'Summarise a document', prompt: 'Summarise this document in 5 bullet points, then list any decisions and action items.', needs: 'Add a note, document or text file to the context.' },
  { label: 'Find connections', prompt: 'Look at the items in context and point out relationships, overlaps or opportunities between them that I might be missing.' },
  { label: 'Prepare my monthly review', prompt: "Using this month's activity, draft my monthly review: highlights, achievements, what slipped, and suggested focus for next month.", preset: 'month' },
  { label: 'Draft a document', prompt: 'Draft a professional document. Type and topic: ' },
];
