import { addDays, format, subDays, subMonths, subWeeks } from 'date-fns';
import { db, RECORD_TABLES } from './db';
import { create, newTask } from './repo';
import { BUILTIN_TEMPLATES, createProjectFromTemplate } from './templates';
import type {
  CalEvent,
  Campaign,
  ContentIdea,
  ContentItem,
  Coverage,
  Doc,
  Idea,
  KPI,
  KPIEntry,
  MonthlyReview,
  Note,
  PressRelease,
  Project,
  SocialSnapshot,
  Task,
} from './types';
import { uid } from './utils';

/**
 * Optional sample content so the app can be explored before real data exists.
 * Every record is flagged `isDemo: true`, shows a "Demo" badge, and can be
 * removed in one click from Settings → Data (or the dashboard banner).
 */
const d = (n: number) => format(addDays(new Date(), n), 'yyyy-MM-dd');
const demo = { isDemo: true } as const;

export async function seedDemo() {
  const pr = await db.templates.get('tpl-pr');
  const launch = await createProjectFromTemplate(pr ?? { ...BUILTIN_TEMPLATES[0], createdAt: 0, updatedAt: 0 }, {
    title: 'Autumn product launch PR',
    startDate: d(-20),
    description: 'Press push for the autumn collection launch.',
    isDemo: true,
  });
  // Mark the first few template tasks done so progress looks realistic.
  const launchTasks = await db.tasks.where('projectId').equals(launch.id).sortBy('order');
  for (const t of launchTasks.slice(0, 3)) await db.tasks.update(t.id, { status: 'completed', completedAt: Date.now() - 86400000 * 5 });
  if (launchTasks[3]) await db.tasks.update(launchTasks[3].id, { status: 'in_progress', myDay: d(0) });
  await db.projects.update(launch.id, {
    status: 'in_progress',
    milestones: launch.milestones.map((m, i) => ({ ...m, done: i === 0 })),
  });

  const site = await create<Project>('projects', {
    ...demo,
    title: 'Website refresh',
    description: 'Rewrite key pages and improve the case-study section.',
    objectives: '- Clearer positioning on the homepage\n- Three new case studies\n- Faster load times',
    status: 'in_progress',
    startDate: d(-35),
    deadline: d(18),
    progressMode: 'auto',
    manualProgress: 0,
    milestones: [
      { id: uid(), title: 'Copy approved', date: d(-10), done: true },
      { id: uid(), title: 'Case studies live', date: d(10), done: false },
    ],
    links: [{ id: uid(), title: 'Staging site', url: 'https://example.com' }],
    tags: ['marketing'],
  });
  const research = await create<Project>('projects', {
    ...demo,
    title: 'Audience research Q1',
    description: 'Interviews and survey to sharpen the content strategy.',
    status: 'planning',
    startDate: d(14),
    deadline: d(70),
    progressMode: 'manual',
    manualProgress: 10,
    milestones: [],
    links: [],
    tags: ['research'],
  });
  await create<Project>('projects', {
    ...demo,
    title: 'Industry awards entry',
    description: 'Submitted and shortlisted.',
    status: 'completed',
    startDate: d(-80),
    deadline: d(-30),
    completedAt: Date.now() - 86400000 * 30,
    progressMode: 'auto',
    manualProgress: 0,
    milestones: [],
    links: [],
    tags: [],
  });

  const tasks: (Partial<Task> & { title: string })[] = [
    { title: 'Rewrite homepage hero copy', priority: 'high', dueDate: d(1), projectId: site.id, status: 'in_progress' },
    { title: 'Interview two clients for case studies', priority: 'medium', dueDate: d(4), projectId: site.id },
    { title: 'Compress hero images', priority: 'low', dueDate: d(8), projectId: site.id },
    { title: 'Draft survey questions', priority: 'medium', dueDate: d(16), projectId: research.id },
    { title: 'Send weekly status update', priority: 'medium', dueDate: d(0), recurrence: { freq: 'weekly', interval: 1 }, tags: ['admin'] },
    { title: 'Monthly reporting', priority: 'high', dueDate: d(6), recurrence: { freq: 'monthly', interval: 1 }, tags: ['admin'] },
    { title: 'Reply to podcast invitation', priority: 'urgent', dueDate: d(-2) },
    { title: 'Update media contact list', priority: 'low', dueDate: d(-1), tags: ['pr'] },
    { title: 'Book photographer for launch event', priority: 'high', dueDate: d(2), status: 'waiting' },
    { title: 'Read: annual communications trends report', priority: 'low' },
    { title: 'Plan Q1 content themes', priority: 'medium', dueDate: d(12), checklist: [
      { id: uid(), text: 'Review last quarter performance', done: true },
      { id: uid(), text: 'List 3 themes', done: false },
      { id: uid(), text: 'Map themes to platforms', done: false },
    ] },
  ];
  for (const t of tasks) await newTask({ ...demo, ...t });
  for (let i = 0; i < 9; i++)
    await newTask({ ...demo, title: ['Prepare board slides', 'File expense report', 'Approve design proofs', 'Brief freelance writer', 'Review analytics dashboard', 'Draft newsletter intro', 'Update bio on website', 'Send thank-you notes', 'Check press clippings'][i], priority: 'medium', status: 'completed', completedAt: subDays(new Date(), i * 6 + 2).getTime(), dueDate: format(subDays(new Date(), i * 6 + 2), 'yyyy-MM-dd') });

  const camp = await create<Campaign>('campaigns', {
    ...demo,
    name: 'Autumn collection launch',
    description: 'Earned media and social push for the autumn launch.',
    objectives: '- 10+ pieces of earned coverage\n- 2 tier-one outlets\n- Drive launch-week traffic',
    audience: 'Design-conscious professionals, 28–45; trade and lifestyle press.',
    keyMessages: '- Crafted to last\n- Made locally\n- Designed for real working days',
    status: 'in_progress',
    startDate: d(-20),
    endDate: d(25),
    budget: 800000,
    spent: 320000,
    currency: 'JPY',
    activities: [
      { id: uid(), title: 'Media list finalised', date: d(-14), done: true },
      { id: uid(), title: 'Embargoed briefing calls', date: d(-3), done: true },
      { id: uid(), title: 'Launch-day distribution', date: d(3), done: false },
      { id: uid(), title: 'Post-launch coverage report', date: d(24), done: false },
    ],
    mediaLinks: [],
    projectId: launch.id,
    tags: ['launch'],
  });
  const camp2 = await create<Campaign>('campaigns', {
    ...demo,
    name: 'Founder thought-leadership',
    description: 'Bylined articles and podcast appearances.',
    status: 'reviewing',
    startDate: d(-90),
    endDate: d(-5),
    activities: [],
    mediaLinks: [],
    tags: [],
    currency: 'JPY',
  });
  const rel = await create<PressRelease>('pressReleases', {
    ...demo,
    title: 'Autumn collection launches with locally made range',
    campaignId: camp.id,
    status: 'approved',
    distributionDate: d(3),
    platform: 'PR Times',
    publishedLinks: [],
    body: '# Headline\n\nFor immediate release…',
  });
  await create<PressRelease>('pressReleases', { ...demo, title: 'Founder named to industry shortlist', campaignId: camp2.id, status: 'distributed', distributionDate: d(-40), publicationDate: d(-40), platform: 'Newswire', publishedLinks: [] });
  const outlets = ['Design Weekly', 'Business Daily', 'Lifestyle Monthly', 'Trade Journal', 'City Magazine', 'Tech & Craft'];
  for (let i = 0; i < 6; i++)
    await create<Coverage>('coverage', {
      ...demo,
      outlet: outlets[i],
      headline: ['Five brands redefining workwear', 'Local makers on the rise', 'What to buy this autumn', 'Inside a modern atelier', 'Weekend picks', 'Founder interview'][i],
      date: format(subDays(new Date(), 50 - i * 9), 'yyyy-MM-dd'),
      reach: [42000, 120000, 65000, 18000, 30000, 54000][i],
      sentiment: i === 3 ? 'neutral' : 'positive',
      campaignId: i < 3 ? camp2.id : camp.id,
      pressReleaseId: i < 3 ? null : rel.id,
      url: 'https://example.com',
    });

  const posts: Partial<ContentItem>[] = [
    { title: 'Behind the seams: making the autumn range', platform: 'Instagram', contentType: 'Reel', status: 'published', publishDate: d(-18), metrics: { reach: 8200, impressions: 11000, views: 9400, likes: 610, comments: 44, shares: 32, saves: 120 } },
    { title: 'Why we manufacture locally', platform: 'LinkedIn', contentType: 'Post', status: 'published', publishDate: d(-14), metrics: { reach: 5400, impressions: 7600, likes: 230, comments: 31, shares: 18 } },
    { title: '3 lessons from our first trade show', platform: 'LinkedIn', contentType: 'Carousel', status: 'published', publishDate: d(-8), metrics: { reach: 7900, impressions: 10400, likes: 402, comments: 52, shares: 40 } },
    { title: 'Studio tour', platform: 'TikTok', contentType: 'Short video', status: 'published', publishDate: d(-6), metrics: { reach: 15000, views: 21000, likes: 1300, comments: 70, shares: 95 } },
    { title: 'Launch-day announcement', platform: 'LinkedIn', contentType: 'Post', status: 'scheduled', publishDate: d(3), publishTime: '09:00' },
    { title: 'Launch reel', platform: 'Instagram', contentType: 'Reel', status: 'reviewing', publishDate: d(3) },
    { title: 'Customer story: Ms. Tanaka', platform: 'Instagram', contentType: 'Carousel', status: 'drafting', publishDate: d(9) },
    { title: 'Founder Q&A clips', platform: 'TikTok', contentType: 'Short video', status: 'idea', publishDate: d(15) },
  ];
  for (const p of posts)
    await create<ContentItem>('content', {
      ...demo,
      title: p.title!,
      platform: p.platform!,
      contentType: p.contentType!,
      status: p.status!,
      publishDate: p.publishDate,
      publishTime: p.publishTime ?? null,
      caption: '',
      referenceLinks: [],
      metrics: p.metrics ?? {},
      tags: [],
      campaignId: p.publishDate && p.publishDate > d(-10) ? camp.id : null,
    });
  const ideas: [ContentIdea['kind'], string][] = [
    ['hook', '"Most workwear is designed for meetings. Ours is designed for the other 7 hours."'],
    ['video', 'Time-lapse of one jacket from fabric to finished, 30 seconds'],
    ['post', 'A carousel comparing fast vs. slow manufacturing costs'],
    ['inspiration', 'Brands doing great founder-led video: note pacing and captions'],
  ];
  for (const [kind, text] of ideas) await create<ContentIdea>('contentIdeas', { ...demo, kind, text, tags: [] });

  for (let w = 12; w >= 0; w--) {
    const date = format(subWeeks(new Date(), w), 'yyyy-MM-dd');
    await create<SocialSnapshot>('social', { ...demo, platform: 'LinkedIn', date, followers: 3200 + (12 - w) * 85 + (w % 3) * 10, reach: 9000 + (12 - w) * 600, impressions: 14000 + (12 - w) * 900, engagement: 480 + (12 - w) * 35 });
    await create<SocialSnapshot>('social', { ...demo, platform: 'Instagram', date, followers: 5400 + (12 - w) * 60, reach: 12000 + (12 - w) * 300 + (w % 2) * 900, impressions: 18000 + (12 - w) * 500, engagement: 900 + (12 - w) * 25 });
  }

  await create<Note>('notes', {
    ...demo,
    title: 'Launch messaging framework',
    kind: 'note',
    category: 'Strategy',
    tags: ['launch'],
    refs: [{ type: 'project', id: launch.id }, { type: 'campaign', id: camp.id }],
    body: '# Launch messaging\n\n## Core message\nCrafted to last, made locally, designed for real working days.\n\n## Proof points\n- 92% of materials sourced within 200km\n- 5-year repair promise\n\n## Open questions\n- [x] Confirm sourcing figure\n- [ ] Approve spokesperson quotes\n\nSee also [[Media list notes]].',
  });
  await create<Note>('notes', {
    ...demo,
    title: 'Media list notes',
    kind: 'research',
    category: 'Research',
    tags: ['pr'],
    refs: [],
    body: '## Tier one\n- Business Daily — prefers data-led angles\n- Design Weekly — loves process stories\n\n## Tier two\n- City Magazine — weekend picks column',
  });
  await create<Note>('notes', {
    ...demo,
    title: 'Book notes: Building a StoryBrand',
    kind: 'reference',
    category: 'Learning',
    tags: ['learning'],
    refs: [],
    body: '- Customer is the hero, brand is the guide\n- Clarity beats cleverness\n- One clear call to action',
  });
  await create<Doc>('documents', {
    ...demo,
    title: 'Autumn launch — campaign brief',
    docType: 'brief',
    status: 'final',
    tags: ['launch'],
    refs: [{ type: 'campaign', id: camp.id }],
    body: '# Autumn launch — campaign brief\n\n## Background\nWe are launching our autumn range in early next month.\n\n## Objectives\n1. Secure 10+ pieces of earned coverage\n2. Grow Instagram followers by 8%\n\n## Audience\nDesign-conscious professionals aged 28–45.\n\n## Key messages\n- Crafted to last\n- Made locally\n\n## Timeline\n| Phase | Date |\n|---|---|\n| Briefings | Week 1 |\n| Launch | Week 3 |\n| Report | Week 6 |',
  });
  await create<Doc>('documents', { ...demo, title: 'Q3 performance report', docType: 'report', status: 'draft', tags: [], refs: [], body: '# Q3 performance report\n\n## Summary\n\n## Highlights\n\n## Next quarter' });

  const ideaTexts = ['Podcast series interviewing local makers', 'Automate monthly report with a template', 'Partnership with a co-working space?', 'Write about lessons from the awards entry', 'Investigate newsletter sponsorship rates'];
  for (const text of ideaTexts) await create<Idea>('ideas', { ...demo, text, status: 'inbox', tags: [] });

  const events: Partial<CalEvent>[] = [
    { title: 'Weekly planning', kind: 'work_block', date: d(0), startTime: '09:00', endTime: '09:30' },
    { title: 'Call with Business Daily', kind: 'meeting', date: d(0), startTime: '14:00', endTime: '14:30' },
    { title: 'Deep work: case studies', kind: 'work_block', date: d(1), startTime: '10:00', endTime: '12:00' },
    { title: 'Launch event', kind: 'event', date: d(3), startTime: '18:30', endTime: '21:00', location: 'Studio' },
    { title: 'Send invoices', kind: 'reminder', date: d(0), startTime: '17:00' },
    { title: 'Agency check-in', kind: 'meeting', date: d(5), startTime: '11:00', endTime: '11:45' },
  ];
  for (const e of events) await create<CalEvent>('events', { ...demo, title: e.title!, kind: e.kind!, date: e.date!, startTime: e.startTime ?? null, endTime: e.endTime ?? null, location: e.location });

  const k1 = await create<KPI>('kpis', { ...demo, name: 'Earned media pieces', unit: 'pieces', target: 10, period: 'monthly', direction: 'up', description: 'Articles, mentions and interviews secured.' });
  const k2 = await create<KPI>('kpis', { ...demo, name: 'Newsletter subscribers', unit: 'people', target: 2500, period: 'monthly', direction: 'up' });
  for (let m = 5; m >= 0; m--) {
    const date = format(subMonths(new Date(), m), 'yyyy-MM-dd');
    await create<KPIEntry>('kpiEntries', { ...demo, kpiId: k1.id, date, value: [4, 6, 5, 8, 9, 7][5 - m] });
    await create<KPIEntry>('kpiEntries', { ...demo, kpiId: k2.id, date, value: 1800 + (5 - m) * 110 });
  }
  await create<MonthlyReview>('reviews', {
    ...demo,
    month: format(subMonths(new Date(), 1), 'yyyy-MM'),
    reflections: 'Strong month for coverage. Content cadence slipped in the final week.',
    wins: '- Shortlisted for the industry award\n- Best-performing LinkedIn carousel to date',
    challenges: 'Too many meetings on Tuesdays.',
    nextFocus: 'Protect two deep-work blocks a week.',
    rating: 4,
  });
}

/** Permanently removes all demo records. Your own records are never touched. */
export async function removeDemo(): Promise<number> {
  let removed = 0;
  await db.transaction('rw', RECORD_TABLES.map((t) => db.table(t)), async () => {
    for (const t of RECORD_TABLES) {
      const keys = await db.table(t).filter((r: { isDemo?: boolean }) => !!r.isDemo).primaryKeys();
      removed += keys.length;
      await db.table(t).bulkDelete(keys);
    }
  });
  return removed;
}

export async function hasDemo(): Promise<boolean> {
  return !!(await db.projects.filter((p) => !!p.isDemo).first()) || !!(await db.tasks.filter((t) => !!t.isDemo).first());
}
