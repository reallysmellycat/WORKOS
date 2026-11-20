import {
  BarChart3,
  Bot,
  CalendarDays,
  CalendarCheck,
  CheckSquare,
  FileText,
  FolderKanban,
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

export const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Home',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, shortcut: 'G D' },
      { to: '/my-day', label: 'My Day', icon: Sun, shortcut: 'G M' },
      { to: '/calendar', label: 'Calendar', icon: CalendarDays, shortcut: 'G C' },
    ],
  },
  {
    section: 'Work',
    items: [
      { to: '/tasks', label: 'Tasks', icon: CheckSquare, shortcut: 'G T' },
      { to: '/projects', label: 'Projects', icon: FolderKanban, shortcut: 'G P' },
      { to: '/campaigns', label: 'PR & Campaigns', icon: Megaphone },
      { to: '/content', label: 'Content Studio', icon: Sparkles },
      { to: '/ideas', label: 'Ideas', icon: Lightbulb, shortcut: 'G I' },
    ],
  },
  {
    section: 'Knowledge',
    items: [
      { to: '/library', label: 'Library', icon: Library },
      { to: '/documents', label: 'Documents', icon: FileText },
      { to: '/notes', label: 'Notes', icon: NotebookPen, shortcut: 'G N' },
    ],
  },
  {
    section: 'Performance',
    items: [
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/reviews', label: 'Monthly Reviews', icon: CalendarCheck },
    ],
  },
  {
    section: 'System',
    items: [
      { to: '/assistant', label: 'AI Assistant', icon: Bot },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export const ALL_NAV = NAV.flatMap((s) => s.items);
