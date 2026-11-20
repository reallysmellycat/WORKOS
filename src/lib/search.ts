import { db } from './db';
import { ENTITY, entityTitle } from './entities';
import type { EntityType } from './types';
import { excerpt } from './utils';

export interface SearchHit {
  type: EntityType;
  id: string;
  title: string;
  snippet: string;
  score: number;
}

const SEARCHABLE: { type: EntityType; fields: string[] }[] = [
  { type: 'task', fields: ['title', 'description', 'notes'] },
  { type: 'project', fields: ['title', 'description', 'objectives', 'notes'] },
  { type: 'campaign', fields: ['name', 'description', 'objectives', 'keyMessages', 'audience', 'notes'] },
  { type: 'pressRelease', fields: ['title', 'body'] },
  { type: 'content', fields: ['title', 'caption', 'draft', 'notes'] },
  { type: 'contentIdea', fields: ['text'] },
  { type: 'note', fields: ['title', 'body'] },
  { type: 'document', fields: ['title', 'body'] },
  { type: 'idea', fields: ['text', 'details'] },
  { type: 'event', fields: ['title', 'notes', 'location'] },
  { type: 'bookmark', fields: ['title', 'url', 'description'] },
  { type: 'file', fields: ['name'] },
  { type: 'kpi', fields: ['name', 'description'] },
];

/**
 * Simple, fast local full-text search. Every word in the query must appear
 * somewhere in the record; title matches rank higher; recent items break ties.
 */
export async function searchAll(query: string, limit = 40, types?: EntityType[]): Promise<SearchHit[]> {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hits: SearchHit[] = [];
  for (const { type, fields } of SEARCHABLE) {
    if (types && !types.includes(type)) continue;
    const rows = (await db.table(ENTITY[type].table).toArray()) as Record<string, unknown>[];
    for (const r of rows) {
      if (r.deletedAt) continue;
      const title = entityTitle(type, r);
      const tl = title.toLowerCase();
      const tags = Array.isArray(r.tags) ? (r.tags as string[]).join(' ').toLowerCase() : '';
      const body = fields.map((f) => (typeof r[f] === 'string' ? (r[f] as string) : '')).join(' \n ');
      const bl = body.toLowerCase();
      if (!words.every((w) => tl.includes(w) || bl.includes(w) || tags.includes(w))) continue;
      let score = 0;
      for (const w of words) {
        if (tl.startsWith(w)) score += 12;
        else if (tl.includes(w)) score += 8;
        if (tags.includes(w)) score += 4;
        if (bl.includes(w)) score += 1;
      }
      score += Math.max(0, 3 - (Date.now() - ((r.updatedAt as number) ?? 0)) / (30 * 86400000));
      const idx = bl.indexOf(words[0]);
      const snippet = idx >= 0 ? excerpt(body.slice(Math.max(0, idx - 40), idx + 120), 110) : '';
      hits.push({ type, id: r.id as string, title, snippet, score });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
