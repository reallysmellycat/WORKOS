import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Plus, LayoutDashboard, CheckSquare, CalendarDays, FolderKanban } from 'lucide-react';
import { TopNav, SubNav } from './TopNav';
import { useTrackRecents } from './recents';
import { AppContext, type AppCtx, type QuickAddPreset } from './context';
import type { Settings } from '@/lib/settings';
import { ENTITY } from '@/lib/entities';
import { cn } from '@/lib/utils';
import { useHotkey, useMediaQuery } from '@/lib/hooks';
import { QuickAdd } from '@/components/QuickAdd';
import { CommandPalette } from '@/components/CommandPalette';
import { pushBrowserNotifications, useNotifications } from '@/lib/notifications';
import { TaskDrawer } from '@/features/tasks/TaskDrawer';
import { ContentDrawer } from '@/features/content/ContentDrawer';
import { EventModal } from '@/features/calendar/EventModal';
import { maybeAutoSnapshot } from '@/lib/backup';

export function Layout({ settings, children }: { settings: Settings; children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 900px)');
  const [quick, setQuick] = useState<QuickAddPreset | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [contentId, setContentId] = useState<string | null>(null);
  const [eventState, setEventState] = useState<{ id: string | null; date?: string } | null>(null);

  const notifications = useNotifications(settings);

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

  const compact = useMediaQuery('(max-width: 1100px)');

  return (
    <AppContext.Provider value={ctx}>
      <div className="relative flex h-full flex-col">
        <TopNav settings={settings} compact={compact} notifications={notifications} onSearch={() => setSearchOpen(true)} onQuickAdd={(type) => setQuick(type ? { type } : {})} />

        <main id="main" className={cn('flex-1 overflow-y-auto pt-nav [--sticky-top:var(--nav-height)]', isMobile && 'pb-24')}>
          <SubNav />
          <div key={location.pathname} className="animate-page">
            {children}
          </div>
        </main>

        {/* Floating quick action (DESIGN.md §9) */}
        {!isMobile && (
          <button
            onClick={() => setQuick({})}
            className="fixed bottom-6 right-6 z-30 flex h-12 items-center gap-2.5 rounded-full bg-ink pl-4 pr-3 text-body-s font-semibold text-ink-fg shadow-lg transition-all duration-normal ease-spring hover:-translate-y-0.5 hover:shadow-xl active:scale-95"
            title="Quick add (N)"
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={2} />
            New
            <span className="rounded-xs bg-ink-fg/15 px-1.5 font-mono text-micro">N</span>
          </button>
        )}

        {isMobile && (
          <nav className="glass fixed inset-x-3 bottom-3 z-30 flex h-[60px] items-stretch rounded-xl pb-[env(safe-area-inset-bottom)]" aria-label="Mobile">
            {[
              { to: '/', icon: LayoutDashboard, label: 'Home' },
              { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
              { to: '', icon: Plus, label: 'New' },
              { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
              { to: '/projects', icon: FolderKanban, label: 'Projects' },
            ].map((it) =>
              it.to === '' ? (
                <button key="new" onClick={() => setQuick({})} className="flex flex-1 flex-col items-center justify-center" aria-label="Quick add">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-ink-fg shadow-md">
                    <Plus className="h-5 w-5" />
                  </span>
                </button>
              ) : (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.to === '/'}
                  className={({ isActive }) => cn('flex flex-1 flex-col items-center justify-center gap-0.5 text-micro font-semibold', isActive ? 'text-fg' : 'text-faint')}
                >
                  <it.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  {it.label}
                </NavLink>
              ),
            )}
          </nav>
        )}
      </div>

      {quick && <QuickAdd preset={quick} onClose={() => setQuick(null)} />}
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <TaskDrawer id={taskId} onClose={() => setTaskId(null)} />
      <ContentDrawer id={contentId} onClose={() => setContentId(null)} />
      {eventState && <EventModal id={eventState.id} date={eventState.date} onClose={() => setEventState(null)} />}
    </AppContext.Provider>
  );
}
