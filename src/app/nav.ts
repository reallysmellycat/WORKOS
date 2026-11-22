import {
  BarChart3,
  Bot,
  CalendarCheck,
  CalendarDays,
  CheckSquare,
  FileText,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  Lightbulb,
  Library,
  Megaphone,
  NotebookPen,
  Settings,
  Sparkles,
  Sun,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
}

/**
 * Top-level workspaces shown in the top navigation (DESIGN.md §9).
 * `pages` is the contextual secondary navigation shown inside that workspace;
 * every route in the app belongs to exactly one workspace.
 */
export interface Workspace extends NavItem {
  pages: NavItem[];
}

export const WORKSPACES: Workspace[] = [
  {
    to: '/',
    label: 'Home',
    icon: LayoutDashboard,
    shortcut: 'G D',
    pages: [
      { to: '/', label: 'Command centre', icon: LayoutDashboard },
      { to: '/my-day', label: 'My Day', icon: Sun, shortcut: 'G M' },
    ],
  },
  {
    to: '/projects',
    label: 'Projects',
    icon: FolderKanban,
    shortcut: 'G P',
    pages: [
      { to: '/projects', label: 'Projects', icon: FolderKanban },
      { to: '/ideas', label: 'Ideas inbox', icon: Lightbulb, shortcut: 'G I' },
    ],
  },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare, shortcut: 'G T', pages: [] },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, shortcut: 'G C', pages: [] },
  {
    to: '/content',
    label: 'Studio',
    icon: Sparkles,
    pages: [
      { to: '/content', label: 'Content Studio', icon: Sparkles },
      { to: '/campaigns', label: 'PR & Campaigns', icon: Megaphone },
    ],
  },
  {
    to: '/library',
    label: 'Library',
    icon: Library,
    pages: [
      { to: '/library', label: 'Archive', icon: Library },
      { to: '/notes', label: 'Notes', icon: NotebookPen, shortcut: 'G N' },
      { to: '/documents', label: 'Documents', icon: FileText },
    ],
  },
  {
    to: '/analytics',
    label: 'Insights',
    icon: Gauge,
    shortcut: 'G A',
    pages: [
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/reviews', label: 'Monthly reviews', icon: CalendarCheck },
    ],
  },
];

export const UTILITY: NavItem[] = [
  { to: '/assistant', label: 'AI Assistant', icon: Bot },
  { to: '/settings', label: 'Settings', icon: Settings, shortcut: 'G S' },
];

const matches = (to: string, pathname: string) => (to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(to + '/'));

/** The workspace and page that own a route. */
export function locate(pathname: string): { workspace?: Workspace; page?: NavItem } {
  for (const w of WORKSPACES) {
    const page = w.pages.find((p) => matches(p.to, pathname));
    if (page) return { workspace: w, page };
    if (matches(w.to, pathname)) return { workspace: w, page: w };
  }
  const util = UTILITY.find((u) => matches(u.to, pathname));
  return { page: util };
}

/** Grouped list used by the workspace selector and the command palette. */
export const NAV: { section: string; items: NavItem[] }[] = [
  ...WORKSPACES.map((w) => ({ section: w.label, items: w.pages.length ? w.pages : [w] })),
  { section: 'System', items: UTILITY },
];

export const ALL_NAV = NAV.flatMap((s) => s.items);
