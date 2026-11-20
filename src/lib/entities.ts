import type { EntityRef, EntityType } from './types';
import type { RecordTable } from './db';

export interface EntityMeta {
  table: RecordTable;
  label: string;
  plural: string;
  titleField: string;
  route: (id: string) => string;
}

/** Single source of truth for how each entity type is stored, named and opened. */
export const ENTITY: Record<EntityType, EntityMeta> = {
  task: { table: 'tasks', label: 'Task', plural: 'Tasks', titleField: 'title', route: (id) => `/tasks?open=${id}` },
  project: { table: 'projects', label: 'Project', plural: 'Projects', titleField: 'title', route: (id) => `/projects/${id}` },
  campaign: { table: 'campaigns', label: 'Campaign', plural: 'Campaigns', titleField: 'name', route: (id) => `/campaigns/${id}` },
  pressRelease: { table: 'pressReleases', label: 'Press release', plural: 'Press releases', titleField: 'title', route: (id) => `/campaigns?release=${id}` },
  coverage: { table: 'coverage', label: 'Coverage', plural: 'Coverage', titleField: 'headline', route: () => `/campaigns?tab=coverage` },
  content: { table: 'content', label: 'Content', plural: 'Content', titleField: 'title', route: (id) => `/content?open=${id}` },
  contentIdea: { table: 'contentIdeas', label: 'Content idea', plural: 'Content ideas', titleField: 'text', route: () => `/content?tab=bank` },
  note: { table: 'notes', label: 'Note', plural: 'Notes', titleField: 'title', route: (id) => `/notes/${id}` },
  document: { table: 'documents', label: 'Document', plural: 'Documents', titleField: 'title', route: (id) => `/documents/${id}` },
  idea: { table: 'ideas', label: 'Idea', plural: 'Ideas', titleField: 'text', route: () => `/ideas` },
  event: { table: 'events', label: 'Event', plural: 'Events', titleField: 'title', route: (id) => `/calendar?event=${id}` },
  kpi: { table: 'kpis', label: 'KPI', plural: 'KPIs', titleField: 'name', route: (id) => `/analytics?kpi=${id}` },
  bookmark: { table: 'bookmarks', label: 'Link', plural: 'Links', titleField: 'title', route: () => `/library?type=bookmark` },
  file: { table: 'files', label: 'File', plural: 'Files', titleField: 'name', route: () => `/library?type=file` },
};

export const TABLE_TO_ENTITY: Partial<Record<RecordTable, EntityType>> = Object.fromEntries(
  Object.entries(ENTITY).map(([k, v]) => [v.table, k as EntityType]),
) as Partial<Record<RecordTable, EntityType>>;

export function entityTitle(type: EntityType, rec: Record<string, unknown> | undefined | null): string {
  if (!rec) return 'Untitled';
  const v = rec[ENTITY[type].titleField];
  return (typeof v === 'string' && v.trim()) || 'Untitled';
}

export const refKey = (r: EntityRef) => `${r.type}:${r.id}`;
