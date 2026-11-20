import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronsLeft,
  ChevronsRight,
  Menu as MenuIcon,
  Moon,
  Plus,
  Search,
  Sun,
  X,
  LayoutDashboard,
  CheckSquare,
  CalendarDays,
} from 'lucide-react';
import { NAV } from './nav';
import { AppContext, type AppCtx, type QuickAddPreset } from './context';
import { saveSettings, type Settings } from '@/lib/settings';
import { ENTITY } from '@/lib/entities';
import { cn } from '@/lib/utils';
import { IconButton, Kbd } from '@/components/ui';
import { useHotkey, useMediaQuery } from '@/lib/hooks';
import { QuickAdd } from '@/components/QuickAdd';
import { CommandPalette } from '@/components/CommandPalette';
import { NotificationCenter } from '@/components/NotificationCenter';
import { pushBrowserNotifications, useNotifications } from '@/lib/notifications';
import { TaskDrawer } from '@/features/tasks/TaskDrawer';
import { ContentDrawer } from '@/features/content/ContentDrawer';
import { EventModal } from '@/features/calendar/EventModal';
import { maybeAutoSnapshot } from '@/lib/backup';

export function Layout({ settings, children }: { settings: Settings; children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 900px)');
  const collapsed = !isMobile && settings.sidebarCollapsed;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quick, setQuick] = useState<QuickAddPreset | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [contentId, setContentId] = useState<string | null>(null);
  const [eventState, setEventState] = useState<{ id: string | null; date?: string } | null>(null);

  const notifications = useNotifications(settings);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  useEffect(() => {
    pushBrowserNotifications(notifications, settings);
  }, [notifications, settings]);

  useEffect(() => {
    if (settings.autoSnapshot) maybeAutoSnapshot().catch(() => {});
  }, [settings.autoSnapshot]);

  const openEntity = useCallback(
    (type: Parameters<AppCtx['openEntity']>[0], id: string) => {
      if (type === 'task') setTaskId(id);
      else if (type === 'content') setContentId(id);
      else if (type === 'event') setEventState({ id });
      else navigate(ENTITY[type].route(id));
    },
    [navigate],
  );

  const ctx: AppCtx = {
    settings,
    quickAdd: (p) => setQuick(p ?? {}),
    openSearch: () => setSearchOpen(true),
    openTask: setTaskId,
    openContent: setContentId,
    openEvent: (id, date) => setEventState({ id, date }),
    openEntity,
  };

  const isTyping = () => {
    const el = document.activeElement as HTMLElement | null;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
  };

  useHotkey('mod+k', (e) => {
    e.preventDefault();
    setSearchOpen(true);
  });

  // Single-key shortcuts: "n" quick add, "/" search, "g x" go-to.
  useEffect(() => {
    let g = false;
    let gt: ReturnType<typeof setTimeout>;
    const on = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping() || document.querySelector('[role="dialog"]')) return;
      const k = e.key.toLowerCase();
      if (g) {
        g = false;
        const map: Record<string, string> = { d: '/', m: '/my-day', c: '/calendar', t: '/tasks', p: '/projects', i: '/ideas', n: '/notes', s: '/settings', a: '/analytics' };
        if (map[k]) {
          e.preventDefault();
          navigate(map[k]);
        }
        return;
      }
      if (k === 'g') {
        g = true;
        clearTimeout(gt);
        gt = setTimeout(() => (g = false), 900);
      } else if (k === 'n' || k === 'q') {
        e.preventDefault();
        setQuick({});
      } else if (k === '/') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [navigate]);

  const toggleTheme = () => {
    const dark = document.documentElement.classList.contains('dark');
    void saveSettings({ theme: dark ? 'light' : 'dark' });
  };

  const sidebar = (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-line bg-surface/80 transition-[width] duration-200',
        isMobile ? 'w-[264px] shadow-pop bg-surface' : collapsed ? 'w-[56px]' : 'w-[232px]',
      )}
    >
      <div className={cn('flex h-[52px] items-center gap-2 px-3', collapsed && 'justify-center px-0')}>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-fg text-bg">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M5 8h14M5 12h9M5 16h5" />
            <circle cx="17" cy="16" r="1.8" fill="rgb(var(--accent))" stroke="none" />
          </svg>
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold leading-tight tracking-tight">Work OS</div>
            <div className="truncate text-2xs text-faint">{settings.name ? `${settings.name}'s workspace` : 'Personal workspace'}</div>
          </div>
        )}
        {isMobile && <IconButton icon={X} label="Close menu" onClick={() => setMobileOpen(false)} />}
      </div>

      <div className={cn('px-2 pb-2', collapsed && 'px-1.5')}>
        <button
          onClick={() => setSearchOpen(true)}
          className={cn(
            'flex w-full items-center gap-2 rounded-md border border-line bg-raised px-2 h-8 text-[13px] text-faint hover:border-line-strong transition-colors',
            collapsed && 'justify-center px-0',
          )}
          title="Search (⌘K)"
        >
          <Search className="h-3.5 w-3.5" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Search</span>
              <Kbd>⌘K</Kbd>
            </>
          )}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label="Main">
        {NAV.map((sec) => (
          <div key={sec.section} className="mt-3 first:mt-1">
            {!collapsed ? <div className="px-2 pb-1 section-title">{sec.section}</div> : <div className="mx-auto my-2 h-px w-6 bg-line" />}
            {sec.items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.to === '/'}
                title={collapsed ? it.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center gap-2.5 rounded-md px-2 h-[30px] text-[13px] transition-colors',
                    collapsed && 'justify-center px-0',
                    isActive ? 'bg-sunken text-fg font-medium' : 'text-muted hover:bg-sunken/60 hover:text-fg',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <it.icon className={cn('h-[15px] w-[15px] shrink-0', isActive ? 'text-accent' : 'text-faint group-hover:text-muted')} strokeWidth={1.9} />
                    {!collapsed && <span className="truncate">{it.label}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {!isMobile && (
        <div className={cn('border-t border-line p-2 flex', collapsed ? 'justify-center' : 'justify-end')}>
          <IconButton
            icon={collapsed ? ChevronsRight : ChevronsLeft}
            label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => saveSettings({ sidebarCollapsed: !settings.sidebarCollapsed })}
          />
        </div>
      )}
    </aside>
  );

  return (
    <AppContext.Provider value={ctx}>
      <div className="flex h-full">
        {!isMobile && <div className="shrink-0 h-full">{sidebar}</div>}
        {isMobile && mobileOpen && (
          <div className="fixed inset-0 z-40 flex animate-fade">
            <div className="absolute inset-0 bg-black/25" onClick={() => setMobileOpen(false)} />
            <div className="relative h-full animate-in">{sidebar}</div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col h-full">
          <header className="glass sticky top-0 z-20 flex h-[52px] shrink-0 items-center gap-2 border-b border-line px-3 sm:px-5">
            {isMobile && <IconButton icon={MenuIcon} label="Open menu" onClick={() => setMobileOpen(true)} />}
            <Breadcrumb />
            <div className="flex-1" />
            {isMobile && <IconButton icon={Search} label="Search" onClick={() => setSearchOpen(true)} />}
            <IconButton icon={document.documentElement.classList.contains('dark') ? Sun : Moon} label="Toggle theme" onClick={toggleTheme} />
            <div className="relative">
              <IconButton icon={Bell} label="Notifications" onClick={() => setNotifOpen((o) => !o)} active={notifOpen} />
              {notifications.length > 0 && (
                <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-danger px-1 text-[9.5px] font-semibold text-white">
                  {notifications.length > 9 ? '9+' : notifications.length}
                </span>
              )}
              {notifOpen && <NotificationCenter items={notifications} onClose={() => setNotifOpen(false)} />}
            </div>
            <button
              onClick={() => setQuick({})}
              className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-2.5 text-[13px] font-medium text-accent-fg shadow-soft hover:brightness-105"
              title="Quick add (N)"
            >
              <Plus className="h-4 w-4" strokeWidth={2.2} />
              <span className="hidden sm:inline">New</span>
            </button>
          </header>

          <main className={cn('flex-1 overflow-y-auto', isMobile && 'pb-[68px]')} id="main">
            {children}
          </main>

          {isMobile && (
            <nav className="glass fixed bottom-0 inset-x-0 z-30 flex h-[60px] items-stretch border-t border-line pb-[env(safe-area-inset-bottom)]" aria-label="Mobile">
              {[
                { to: '/', icon: LayoutDashboard, label: 'Home' },
                { to: '/my-day', icon: Sun, label: 'Today' },
                { to: '', icon: Plus, label: 'New' },
                { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
                { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
              ].map((it) =>
                it.to === '' ? (
                  <button key="new" onClick={() => setQuick({})} className="flex flex-1 flex-col items-center justify-center" aria-label="Quick add">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-fg shadow-soft">
                      <Plus className="h-5 w-5" />
                    </span>
                  </button>
                ) : (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    end={it.to === '/'}
                    className={({ isActive }) => cn('flex flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px]', isActive ? 'text-accent' : 'text-faint')}
                  >
                    <it.icon className="h-[18px] w-[18px]" />
                    {it.label}
                  </NavLink>
                ),
              )}
            </nav>
          )}
        </div>
      </div>

      {quick && <QuickAdd preset={quick} onClose={() => setQuick(null)} />}
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <TaskDrawer id={taskId} onClose={() => setTaskId(null)} />
      <ContentDrawer id={contentId} onClose={() => setContentId(null)} />
      {eventState && <EventModal id={eventState.id} date={eventState.date} onClose={() => setEventState(null)} />}
    </AppContext.Provider>
  );
}

function Breadcrumb() {
  const { pathname } = useLocation();
  const item = NAV.flatMap((s) => s.items).find((i) => (i.to === '/' ? pathname === '/' : pathname.startsWith(i.to)));
  if (!item) return null;
  return (
    <div className="flex items-center gap-2 text-[13px] text-muted min-w-0">
      <item.icon className="h-3.5 w-3.5 text-faint shrink-0" />
      <span className="truncate">{item.label}</span>
    </div>
  );
}
