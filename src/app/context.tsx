import { createContext, useContext } from 'react';
import type { Settings } from '@/lib/settings';
import type { EntityType } from '@/lib/types';

export type QuickAddType = 'task' | 'project' | 'note' | 'idea' | 'content' | 'campaign' | 'event' | 'document';

export interface QuickAddPreset {
  type?: QuickAddType;
  title?: string;
  date?: string;
  projectId?: string;
  campaignId?: string;
}

export interface AppCtx {
  settings: Settings;
  quickAdd: (preset?: QuickAddPreset) => void;
  openSearch: () => void;
  openTask: (id: string) => void;
  openContent: (id: string) => void;
  openEvent: (id: string | null, date?: string) => void;
  openEntity: (type: EntityType, id: string) => void;
}

export const AppContext = createContext<AppCtx | null>(null);

export function useApp() {
  const c = useContext(AppContext);
  if (!c) throw new Error('AppContext missing');
  return c;
}
