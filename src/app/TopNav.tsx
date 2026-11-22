import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { Bell, Bot, ChevronDown, Clock3, Command, Moon, Plus, Search, Settings, Sun, X } from 'lucide-react';
import { WORKSPACES, NAV, locate } from './nav';
import { db } from '@/lib/db';
import { saveSettings, type Settings as SettingsT } from '@/lib/settings';
import { projectProgress } from '@/lib/domain';
import { cn } from '@/lib/utils';
import { coverAccent } from '@/components/Cover';
import { IconButton, Kbd } from '@/components/ui';
import { NotificationCenter } from '@/components/NotificationCenter';
import type { AppNotification } from '@/lib/notifications';
import { useRecents } from './recents';

/**
 * Integrated top navigation (DESIGN.md §9): identity + workspace selector,
 * seven workspaces with a gliding indicator, and utilities on the right.
 * It floats as glass over the environment so the canvas reads as one space.
 */
export function TopNav({
  settings,
  compact,
  notifications,
  onSearch,
  onQuickAdd,
}: {
  settings: SettingsT;
  compact: boolean;
  notifications: AppNotification[];
  onSearch: () => void;
  onQuickAdd: (type?: 'project') => void;
}) {
  const { pathname } = useLocation();
  const { workspace } = locate(pathname);
  const [selector, setSelector] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const linksRef = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ left: number; width: number } | null>(null);
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);

  useLayoutEffect(() => {
    const el = linksRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    setInd(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
  }, [pathname, compact]);

  useEffect(() => {
    setSelector(false);
  }, [pathname]);

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 px-3 pt-3 sm:px-4">
      <div className="glass pointer-events-auto relative flex h-[calc(var(--nav-height)-12px)] items-center gap-2 rounded-xl px-2.5 sm:gap-3 sm:px-3">
        {/* Identity + workspace selector */}
        <button
          onClick={() => setSelector((o) => !o)}
          className="flex h-10 items-center gap-2.5 rounded-lg pl-1 pr-2.5 transition-colors duration-fast hover:bg-sunken/35"
          aria-expanded={selector}
          aria-haspopup="dialog"
          aria-label="Open workspace selector"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink text-ink-fg">
            <span className="font-serif text-h4 italic leading-none">w</span>
          </span>
          <span className="hidden text-left leading-tight lg:block">
            <span className="block text-body-s font-bold tracking-tight">WorkOS</span>
            <span className="meta block text-micro text-faint">{workspace?.label ?? 'System'}</span>
          </span>
          <ChevronDown className={cn('h-3.5 w-3.5 text-faint transition-transform duration-normal', selector && 'rotate-180')} />
        </button>

        {/* Workspaces */}
        {!compact && (
          <nav ref={linksRef} className="relative flex flex-1 items-center gap-0.5 overflow-x-auto" aria-label="Workspaces">
            {ind && <span className="pointer-events-none absolute top-1/2 h-9 -translate-y-1/2 rounded-full bg-raised shadow-sm ring-1 ring-edge transition-all duration-smooth ease-out" style={{ left: ind.left, width: ind.width }} />}
            {WORKSPACES.map((w) => {
              const active = workspace?.to === w.to;
              return (
                <NavLink
                  key={w.to}
                  to={w.to}
                  end={w.to === '/'}
                  data-active={active}
                  className={cn('relative z-10 flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-body-s font-semibold transition-colors duration-fast', active ? 'text-fg' : 'text-muted hover:text-fg')}
                >
                  <w.icon className={cn('h-[15px] w-[15px]', active ? 'text-accent-deep' : 'text-faint')} strokeWidth={1.8} />
                  {w.label}
                </NavLink>
              );
            })}
          </nav>
        )}
        {compact && <div className="flex-1" />}

        {/* Utilities */}
        <div className="flex items-center gap-1">
          <button
            onClick={onSearch}
            className={cn('flex h-9 items-center gap-2 rounded-full text-body-s text-faint transition-colors duration-fast hover:text-fg', compact ? 'w-9 justify-center' : 'bg-sunken/30 pl-3 pr-1.5 hover:bg-sunken/50')}
            aria-label="Search and commands"
            title="Search (⌘K)"
          >
            <Search className="h-[16px] w-[16px]" strokeWidth={1.8} />
            {!compact && (
              <>
                <span className="hidden w-24 text-left xl:inline">Search</span>
                <Kbd>⌘K</Kbd>
              </>
            )}
          </button>
          <Link to="/assistant" className={cn('flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-fast hover:bg-sunken/45', pathname.startsWith('/assistant') ? 'bg-sunken/60 text-fg' : 'text-muted hover:text-fg')} aria-label="AI Assistant" title="AI Assistant">
            <Bot className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </Link>
          <div className="relative">
            <IconButton icon={Bell} label="Notifications" onClick={() => setNotifOpen((o) => !o)} active={notifOpen} />
            {notifications.length > 0 && (
              <span className="pointer-events-none absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay px-1 font-mono text-micro font-medium text-ink">
                {notifications.length > 9 ? '9+' : notifications.length}
              </span>
            )}
            {notifOpen && <NotificationCenter items={notifications} onClose={() => setNotifOpen(false)} />}
          </div>
          {!compact && <IconButton icon={dark ? Sun : Moon} label="Toggle Daylight / Dusk" onClick={() => saveSettings({ theme: dark ? 'light' : 'dark' })} />}
          <Link to="/settings" className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft font-serif text-h4 text-ink ring-2 ring-raised transition-transform duration-fast hover:scale-105" aria-label="Settings and profile" title="Settings">
            {(settings.name || 'W').trim()[0]?.toUpperCase()}
          </Link>
        </div>

        {selector && <WorkspaceSelector settings={settings} onClose={() => setSelector(false)} onQuickProject={() => onQuickAdd('project')} dark={dark} />}
      </div>
    </header>
  );
}

/**
 * Workspace selector: every destination, the active-project switcher and
 * recently visited items in one floating panel.
 */
function WorkspaceSelector({ settings, onClose, onQuickProject, dark }: { settings: SettingsT; onClose: () => void; onQuickProject: () => void; dark: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const recents = useRecents();
  const projects = useLiveQuery(async () => {
    const ps = (await db.projects.toArray()).filter((p) => !p.deletedAt && p.status !== 'completed');
    const tasks = (await db.tasks.toArray()).filter((t) => !t.deletedAt);
    return ps
      .sort((a, b) => (a.status === 'in_progress' ? 0 : 1) - (b.status === 'in_progress' ? 0 : 1) || (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'))
      .slice(0, 8)
      .map((p) => ({ p, pct: projectProgress(p, tasks).percent }));
  }, []);

  useEffect(() => {
    const on = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest('[aria-label="Open workspace selector"]')) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', on);
    window.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', on);
      window.removeEventListener('keydown', key);
    };
  }, [onClose]);

  return (
    <div ref={ref} role="dialog" aria-label="Workspace selector" className="elevated absolute left-0 top-[calc(100%+10px)] z-40 grid max-h-[78vh] w-[min(760px,calc(100vw-24px))] origin-top-left overflow-y-auto !rounded-xl p-2 animate-scale sm:grid-cols-[1fr_1.1fr]">
      <div className="p-3">
        <div className="mb-4 flex items-baseline justify-between">
          <span className="display text-h3">{settings.name ? `${settings.name}'s WorkOS` : 'WorkOS'}</span>
          <span className="meta text-faint">{format(new Date(), 'EEE d MMM')}</span>
        </div>
        {NAV.map((sec) => (
          <div key={sec.section} className="mb-3">
            <div className="eyebrow mb-1.5 px-2">{sec.section}</div>
            {sec.items.map((it) => (
              <NavLink key={it.to} to={it.to} end={it.to === '/'} className={({ isActive }) => cn('flex h-8 items-center gap-2.5 rounded-sm px-2 text-body-s transition-colors duration-fast', isActive ? 'bg-sunken/45 font-semibold text-fg' : 'text-muted hover:bg-sunken/30 hover:text-fg')}>
                <it.icon className="h-[15px] w-[15px] text-faint" strokeWidth={1.8} />
                <span className="flex-1">{it.label}</span>
                {it.shortcut && <span className="meta text-micro text-faint">{it.shortcut}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </div>
      <div className="rounded-lg bg-surface/70 p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="eyebrow">Active projects</span>
          <button onClick={onQuickProject} className="flex items-center gap-1 text-caption font-semibold text-accent-deep hover:underline">
            <Plus className="h-3 w-3" /> New
          </button>
        </div>
        {(projects ?? []).length === 0 && <p className="px-1 pb-3 text-body-s text-faint">No active projects.</p>}
        {(projects ?? []).map(({ p, pct }) => (
          <button key={p.id} onClick={() => navigate(`/projects/${p.id}`)} className="group flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors duration-fast hover:bg-raised">
            <span className="h-7 w-7 shrink-0 rounded-sm" style={{ background: coverAccent(p.id, p.color) }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body-s font-semibold">{p.title}</span>
              <span className="mt-1 block h-1 overflow-hidden rounded-full bg-sunken/60">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
              </span>
            </span>
            <span className="meta w-9 text-right text-faint">{pct}%</span>
          </button>
        ))}
        {recents.length > 0 && (
          <>
            <div className="eyebrow mb-2 mt-5 flex items-center gap-1.5 px-1">
              <Clock3 className="h-3 w-3" /> Recently visited
            </div>
            {recents.map((r) => (
              <Link key={r.path} to={r.path} className="flex h-8 items-center gap-2.5 rounded-sm px-2 text-body-s text-muted transition-colors duration-fast hover:bg-raised hover:text-fg">
                <span className="meta w-9 shrink-0 text-micro uppercase text-faint">{r.kind}</span>
                <span className="truncate">{r.title}</span>
              </Link>
            ))}
          </>
        )}
        <div className="mt-5 flex items-center gap-2 border-t border-line px-1 pt-3">
          <button onClick={() => saveSettings({ theme: dark ? 'light' : 'dark' })} className="flex items-center gap-1.5 text-caption font-semibold text-muted hover:text-fg">
            {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />} {dark ? 'Daylight' : 'Dusk'}
          </button>
          <span className="flex-1" />
          <Link to="/settings" className="flex items-center gap-1.5 text-caption font-semibold text-muted hover:text-fg">
            <Settings className="h-3.5 w-3.5" /> Settings
          </Link>
          <button onClick={onClose} className="ml-2 text-faint hover:text-fg sm:hidden" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="col-span-full flex items-center gap-2 px-3 pb-1 pt-2 text-caption text-faint">
        <Command className="h-3 w-3" /> Press <Kbd>⌘K</Kbd> anywhere to search or jump, <Kbd>N</Kbd> to create.
      </div>
    </div>
  );
}

/** Contextual secondary navigation for workspaces with more than one page. */
export function SubNav() {
  const { pathname } = useLocation();
  const { workspace, page } = locate(pathname);
  if (!workspace || workspace.pages.length < 2) return null;
  return (
    <nav aria-label={`${workspace.label} pages`} className="px-gutter pt-5">
      <div className="inline-flex items-center gap-1 rounded-full bg-sunken/30 p-1 shadow-[inset_0_0_0_1px_rgb(var(--edge)/var(--edge-alpha))]">
        {workspace.pages.map((p) => {
          const active = page?.to === p.to;
          return (
            <Link key={p.to} to={p.to} className={cn('flex h-8 items-center gap-2 rounded-full px-3.5 text-body-s font-semibold transition-all duration-normal', active ? 'bg-raised text-fg shadow-sm' : 'text-muted hover:text-fg')}>
              <p.icon className="h-3.5 w-3.5" strokeWidth={1.8} />
              {p.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
