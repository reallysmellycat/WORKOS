import Dexie, { type Table } from 'dexie';
import type {
  Activity,
  AIConversation,
  Bookmark,
  CalEvent,
  Campaign,
  Collection,
  ContentIdea,
  ContentItem,
  Coverage,
  Dismissal,
  Doc,
  Folder,
  Idea,
  KPI,
  KPIEntry,
  KV,
  MonthlyReview,
  Note,
  PressRelease,
  Project,
  ProjectTemplate,
  Snapshot,
  SocialSnapshot,
  StoredFile,
  Task,
} from './types';

/**
 * Local-first database (IndexedDB via Dexie).
 *
 * MIGRATIONS: never edit an existing version() block once shipped.
 * To change the schema, add `this.version(N + 1).stores({...}).upgrade(tx => ...)`
 * and bump SCHEMA_VERSION. Dexie runs upgrades in order on the user's device.
 */
export const SCHEMA_VERSION = 1;

export class WorkOSDB extends Dexie {
  tasks!: Table<Task, string>;
  projects!: Table<Project, string>;
  templates!: Table<ProjectTemplate, string>;
  campaigns!: Table<Campaign, string>;
  pressReleases!: Table<PressRelease, string>;
  coverage!: Table<Coverage, string>;
  content!: Table<ContentItem, string>;
  contentIdeas!: Table<ContentIdea, string>;
  social!: Table<SocialSnapshot, string>;
  notes!: Table<Note, string>;
  documents!: Table<Doc, string>;
  folders!: Table<Folder, string>;
  collections!: Table<Collection, string>;
  bookmarks!: Table<Bookmark, string>;
  files!: Table<StoredFile, string>;
  ideas!: Table<Idea, string>;
  events!: Table<CalEvent, string>;
  kpis!: Table<KPI, string>;
  kpiEntries!: Table<KPIEntry, string>;
  reviews!: Table<MonthlyReview, string>;
  conversations!: Table<AIConversation, string>;
  activity!: Table<Activity, number>;
  dismissals!: Table<Dismissal, string>;
  snapshots!: Table<Snapshot, number>;
  kv!: Table<KV, string>;

  constructor(name = 'workos') {
    super(name);
    this.version(1).stores({
      tasks: 'id, status, priority, dueDate, projectId, campaignId, parentId, myDay, updatedAt, deletedAt, isDemo, *tags',
      projects: 'id, status, deadline, updatedAt, deletedAt, isDemo, *tags',
      templates: 'id, kind, deletedAt, isDemo',
      campaigns: 'id, status, startDate, endDate, projectId, updatedAt, deletedAt, isDemo, *tags',
      pressReleases: 'id, campaignId, status, distributionDate, updatedAt, deletedAt, isDemo',
      coverage: 'id, campaignId, pressReleaseId, date, deletedAt, isDemo',
      content: 'id, platform, status, publishDate, campaignId, projectId, updatedAt, deletedAt, isDemo, *tags',
      contentIdeas: 'id, kind, updatedAt, deletedAt, isDemo, *tags',
      social: 'id, platform, date, deletedAt, isDemo',
      notes: 'id, kind, folderId, category, updatedAt, deletedAt, isDemo, *tags',
      documents: 'id, docType, status, folderId, updatedAt, deletedAt, isDemo, *tags',
      folders: 'id, scope, deletedAt, isDemo',
      collections: 'id, updatedAt, deletedAt, isDemo',
      bookmarks: 'id, folderId, category, updatedAt, deletedAt, isDemo, *tags',
      files: 'id, folderId, updatedAt, deletedAt, isDemo, *tags',
      ideas: 'id, status, updatedAt, deletedAt, isDemo, *tags',
      events: 'id, date, kind, deletedAt, isDemo',
      kpis: 'id, updatedAt, deletedAt, isDemo',
      kpiEntries: 'id, kpiId, date, deletedAt, isDemo',
      reviews: 'id, &month, deletedAt, isDemo',
      conversations: 'id, updatedAt, deletedAt',
      activity: '++id, at, entity, entityId',
      dismissals: 'key, at',
      snapshots: '++id, at',
      kv: 'key',
    });
  }
}

export let db = new WorkOSDB();

/** Test helper: swap in a fresh database instance. */
export function __setDb(next: WorkOSDB) {
  db = next;
}

/** Tables that hold user records with BaseRecord shape (soft-deletable, exportable). */
export const RECORD_TABLES = [
  'tasks',
  'projects',
  'templates',
  'campaigns',
  'pressReleases',
  'coverage',
  'content',
  'contentIdeas',
  'social',
  'notes',
  'documents',
  'folders',
  'collections',
  'bookmarks',
  'files',
  'ideas',
  'events',
  'kpis',
  'kpiEntries',
  'reviews',
  'conversations',
] as const;

export type RecordTable = (typeof RECORD_TABLES)[number];

/** Ask the browser not to evict our data under storage pressure. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* not supported */
  }
  return false;
}
