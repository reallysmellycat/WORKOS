import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

export type WidgetType =
  | 'priorities'
  | 'deadlines'
  | 'overdue'
  | 'activeProjects'
  | 'projectProgress'
  | 'events'
  | 'activity'
  | 'campaigns'
  | 'content'
  | 'metrics'
  | 'notes'
  | 'ideas'
  | 'achievements';

export type WidgetSize = 's' | 'm' | 'l' | 'xl';

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  size: WidgetSize;
}

export interface CustomFieldDef {
  id: string;
  entity: 'task' | 'project' | 'campaign' | 'content';
  label: string;
  kind: 'text' | 'number' | 'date' | 'select' | 'url';
  options?: string[];
}

export interface TagDef {
  name: string;
  color: string;
}

export interface AISettings {
  provider: 'none' | 'ollama' | 'openai';
  baseUrl: string;
  model: string;
  apiKey: string; // stored only in this browser's IndexedDB
  temperature: number;
}

export interface Settings {
  onboarded: boolean;
  name: string;
  theme: 'light' | 'dark' | 'system';
  accent: 'sage' | 'deep' | 'teal' | 'warm' | 'violet' | 'graphite';
  sidebarCollapsed: boolean;
  weekStartsOn: 0 | 1;
  dashboard: WidgetConfig[]; // legacy widget layout (kept for old backups)
  home: HomeLayout;
  notifications: {
    enabled: boolean;
    browser: boolean;
    deadlineDays: number;
    overdue: boolean;
    milestones: boolean;
    content: boolean;
    reminders: boolean;
  };
  tags: TagDef[];
  noteCategories: string[];
  ideaCategories: string[];
  platforms: string[];
  contentTypes: string[];
  customFields: CustomFieldDef[];
  currency: string;
  ai: AISettings;
  autoSnapshot: boolean;
  lastExportAt: number | null;
}

export type HomeSection = 'focus' | 'schedule' | 'projects' | 'activity' | 'performance' | 'ideas' | 'campaigns' | 'notes';
export interface HomeLayout {
  order: HomeSection[];
  hidden: HomeSection[];
}
export const DEFAULT_HOME: HomeLayout = {
  order: ['focus', 'schedule', 'projects', 'activity', 'performance', 'ideas', 'campaigns', 'notes'],
  hidden: [],
};

export const DEFAULT_DASHBOARD: WidgetConfig[] = [
  { id: 'w-priorities', type: 'priorities', size: 'l' },
  { id: 'w-overdue', type: 'overdue', size: 's' },
  { id: 'w-events', type: 'events', size: 's' },
  { id: 'w-deadlines', type: 'deadlines', size: 's' },
  { id: 'w-activity', type: 'activity', size: 's' },
  { id: 'w-metrics', type: 'metrics', size: 'xl' },
  { id: 'w-activeProjects', type: 'activeProjects', size: 's' },
  { id: 'w-campaigns', type: 'campaigns', size: 's' },
  { id: 'w-content', type: 'content', size: 's' },
  { id: 'w-ideas', type: 'ideas', size: 's' },
  { id: 'w-notes', type: 'notes', size: 's' },
  { id: 'w-achievements', type: 'achievements', size: 's' },
];

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  name: '',
  theme: 'system',
  accent: 'sage',
  sidebarCollapsed: false,
  weekStartsOn: 1,
  dashboard: DEFAULT_DASHBOARD,
  home: DEFAULT_HOME,
  notifications: {
    enabled: true,
    browser: false,
    deadlineDays: 2,
    overdue: true,
    milestones: true,
    content: true,
    reminders: true,
  },
  tags: [],
  noteCategories: ['Research', 'Strategy', 'Meetings', 'Learning', 'Reference'],
  ideaCategories: ['Project', 'Content', 'Research', 'Improvement', 'Observation'],
  platforms: ['LinkedIn', 'Instagram', 'TikTok', 'X', 'YouTube', 'Newsletter', 'Blog'],
  contentTypes: ['Post', 'Carousel', 'Reel', 'Short video', 'Story', 'Article', 'Thread', 'Newsletter'],
  customFields: [],
  currency: 'JPY',
  ai: { provider: 'none', baseUrl: 'http://localhost:11434', model: 'llama3.2', apiKey: '', temperature: 0.4 },
  autoSnapshot: true,
  lastExportAt: null,
};

const KEY = 'settings';

export async function getSettings(): Promise<Settings> {
  const row = await db.kv.get(KEY);
  return mergeSettings(row?.value as Partial<Settings> | undefined);
}

export function mergeSettings(v?: Partial<Settings>): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...(v ?? {}),
    notifications: { ...DEFAULT_SETTINGS.notifications, ...(v?.notifications ?? {}) },
    ai: { ...DEFAULT_SETTINGS.ai, ...(v?.ai ?? {}) },
    accent: migrateAccent((v?.accent as string | undefined) ?? DEFAULT_SETTINGS.accent),
    home: { ...DEFAULT_HOME, ...(v?.home ?? {}), order: mergeOrder(v?.home?.order) },
  };
}

export async function saveSettings(patch: Partial<Settings>) {
  await db.transaction('rw', db.kv, async () => {
    const cur = await getSettings();
    await db.kv.put({ key: KEY, value: { ...cur, ...patch } });
  });
}

/** Live settings. Returns undefined while loading. */
export function useSettingsQuery(): Settings | undefined {
  return useLiveQuery(getSettings, []);
}

/** Keeps user order but appends any sections added in newer versions. */
function mergeOrder(order?: HomeSection[]): HomeSection[] {
  const base = (order ?? []).filter((x) => DEFAULT_HOME.order.includes(x));
  return [...base, ...DEFAULT_HOME.order.filter((x) => !base.includes(x))];
}

/** Maps accent names from earlier versions onto the current palette. */
function migrateAccent(a: string): Settings['accent'] {
  const old: Record<string, Settings['accent']> = { clay: 'warm', ochre: 'warm', slate: 'teal', plum: 'violet', ink: 'graphite' };
  const valid = ['sage', 'deep', 'teal', 'warm', 'violet', 'graphite'];
  return (valid.includes(a) ? a : old[a] ?? 'sage') as Settings['accent'];
}
