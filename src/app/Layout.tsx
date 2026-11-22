import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Menu as MenuIcon,
  Plus,
  Search,
  Sun,
  LayoutDashboard,
  CheckSquare,
  CalendarDays,
} from 'lucide-react';
import { NAV } from './nav';
import { Sidebar } from './Sidebar';
import { useTrackRecents } from './recents';
import { AppContext, type AppCtx, type QuickAddPreset } from './context';
import type { Settings } from '@/lib/settings';
import { ENTITY } from '@/lib/entities';
import { cn } from '@/lib/utils';
import { IconButton } from '@/components/ui';
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

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

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

  useTrackRecents();

  const sidebar = <Sidebar settings={settings} collapsed={collapsed} onSearch={() => setSearchOpen(true)} onQuickProject={() => setQuick({ type: 'project' })} />;

  return (
    <AppContext.Provider value={ctx}>
      <div className="flex h-full bg-desk">
        {!isMobile && <div className="h-full shrink-0">{sidebar}</div>}
        {isMobile && mobileOpen && (
          <div className="fixed inset-0 z-40 flex animate-fade">
            <div className="absolute inset-0 bg-[rgb(var(--desk)/0.6)] backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <div className="relative h-full animate-drawer">
              <Sidebar settings={settings} collapsed={false} mobile onClose={() => setMobileOpen(false)} onSearch={() => setSearchOpen(true)} onQuickProject={() => setQuick({ type: 'project' })} />
            </div>
          </div>
        )}

        <div className={cn('flex min-w-0 flex-1 flex-col', !isMobile && 'py-2 pr-2')}>
          <div className={cn('sheet relative flex min-h-0 flex-1 flex-col overflow-hidden', !isMobile && 'rounded-[16px]')}>
            <header className="glass absolute inset-x-0 top-0 z-20 flex h-[50px] shrink-0 items-center gap-2 border-b border-line/60 px-3 sm:px-5">
              {isMobile && <IconButton icon={MenuIcon} label="Open menu" onClick={() => setMobileOpen(true)} />}
              <Breadcrumb />
              <div className="flex-1" />
              {isMobile && <IconButton icon={Search} label="Search" onClick={() => setSearchOpen(true)} />}
              <div className="relative">
                <IconButton icon={Bell} label="Notifications" onClick={() => setNotifOpen((o) => !o)} active={notifOpen} />
                {notifications.length > 0 && (
                  <span className="pointer-events-none absolute right-0.5 top-0.5 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-clay px-1 font-mono text-[9px] text-white">
                    {notifications.length > 9 ? '9+' : notifications.length}
                  </span>
                )}
                {notifOpen && <NotificationCenter items={notifications} onClose={() => setNotifOpen(false)} />}
              </div>
              <button
                onClick={() => setQuick({})}
                className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-lg bg-ink px-3 text-[13px] font-medium text-ink-fg shadow-soft transition hover:opacity-90 active:scale-[0.97]"
                title="Quick add (N)"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
                <span className="hidden sm:inline">New</span>
                <span className="ml-1 hidden font-mono text-[10px] opacity-50 sm:inline">N</span>
              </button>
            </header>

            <main className={cn('flex-1 overflow-y-auto pt-[50px] [--sticky-top:50px]', isMobile && 'pb-[84px]')} id="main">
              <div key={location.pathname} className="animate-page min-h-full">
                {children}
              </div>
            </main>
          </div>

          {isMobile && (
            <nav className="glass fixed inset-x-3 bottom-3 z-30 flex h-[58px] items-stretch rounded-2xl shadow-pop ring-1 ring-line/80 pb-[env(safe-area-inset-bottom)]" aria-label="Mobile">
              {[
                { to: '/', icon: LayoutDashboard, label: 'Home' },
                { to: '/my-day', icon: Sun, label: 'Today' },
                { to: '', icon: Plus, label: 'New' },
                { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
                { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
              ].map((it) =>
                it.to === '' ? (
                  <button key="new" onClick={() => setQuick({})} className="flex flex-1 flex-col items-center justify-center" aria-label="Quick add">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-ink-fg shadow-soft">
                      <Plus className="h-5 w-5" />
                    </span>
                  </button>
                ) : (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    end={it.to === '/'}
                    className={({ isActive }) => cn('flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px]', isActive ? 'text-fg' : 'text-faint')}
                  >
                    <it.icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
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
  const sec = NAV.find((s) => s.items.some((i) => (i.to === '/' ? pathname === '/' : pathname.startsWith(i.to))));
  const item = sec?.items.find((i) => (i.to === '/' ? pathname === '/' : pathname.startsWith(i.to)));
  if (!item || !sec) return null;
  const section = sec.section;
  return (
    <div className="flex min-w-0 items-center gap-2 text-[13px]">
      <span className="meta hidden text-[10.5px] uppercase tracking-[0.1em] text-faint sm:inline">{section}</span>
      <span className="hidden text-line-strong sm:inline">/</span>
      <span className="truncate text-fg">{item.label}</span>
    </div>
  );
}
