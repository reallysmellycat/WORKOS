import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { ChevronRight, ChevronsLeft, ChevronsRight, Clock3, Command, Moon, Plus, Sun, X } from 'lucide-react';
import { NAV } from './nav';
import { db } from '@/lib/db';
import { saveSettings, type Settings } from '@/lib/settings';
import { projectProgress } from '@/lib/domain';
import { cn, safeGet } from '@/lib/utils';
import { coverAccent } from '@/components/Cover';
import { useRecents } from './recents';

/**
 * The sidebar sits directly on the "desk" (no box), with the page as a sheet
 * of paper beside it. Active state is a single indicator that glides between
 * items. Projects expand inline as a quick switcher; recent items follow.
 */
export function Sidebar({
  settings,
  collapsed,
  mobile,
  onClose,
  onSearch,
  onQuickProject,
}: {
  settings: Settings;
  collapsed: boolean;
  mobile?: boolean;
  onClose?: () => void;
  onSearch: () => void;
  onQuickProject: () => void;
}) {
  const { pathname } = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const [ind, setInd] = useState<{ top: number; height: number } | null>(null);
  const [projOpen, setProjOpen] = useState(() => safeGet('workos-side-projects') !== '0');
  const recents = useRecents();

  const projects = useLiveQuery(async () => {
    const ps = (await db.projects.toArray()).filter((p) => !p.deletedAt && p.status !== 'completed');
    const tasks = (await db.tasks.toArray()).filter((t) => !t.deletedAt && ps.some((p) => p.id === t.projectId));
    return ps
      .sort((a, b) => (a.status === 'in_progress' ? -1 : 1) - (b.status === 'in_progress' ? -1 : 1) || (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'))
      .slice(0, 7)
      .map((p) => ({ p, pct: projectProgress(p, tasks).percent }));
  }, []);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const active = nav.querySelector<HTMLElement>('[data-active="true"]');
    if (active) {
      const r = active.getBoundingClientRect();
      const n = nav.getBoundingClientRect();
      setInd({ top: r.top - n.top + nav.scrollTop, height: r.height });
    } else setInd(null);
  }, [pathname, collapsed, projOpen, projects?.length, recents.length]);

  useEffect(() => {
    try {
      localStorage.setItem('workos-side-projects', projOpen ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [projOpen]);

  const isActive = (to: string) => (to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(to + '/') || (to === '/notes' && pathname.startsWith('/notes')));
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);
  const initial = (settings.name || 'W').trim()[0]?.toUpperCase();

  return (
    <aside className={cn('flex h-full flex-col transition-[width] duration-300 ease-out', mobile ? 'w-[280px] bg-desk shadow-pop' : collapsed ? 'w-[64px]' : 'w-[244px]')}>
      {/* Identity */}
      <div className={cn('flex h-[60px] shrink-0 items-center gap-2.5 px-4', collapsed && 'justify-center px-0')}>
        <Link to="/" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-ink text-ink-fg" aria-label="Home">
          <span className="font-serif text-[19px] italic leading-none">w</span>
        </Link>
        {!collapsed && (
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate font-serif text-[19px]">{settings.name ? `${settings.name}'s HQ` : 'Work OS'}</div>
            <div className="meta text-[10.5px] text-faint">{format(new Date(), 'EEE d MMM · ')}W{format(new Date(), 'II')}</div>
          </div>
        )}
        {mobile && (
          <button onClick={onClose} className="text-faint hover:text-fg" aria-label="Close menu">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Command */}
      <div className={cn('px-3 pb-3', collapsed && 'px-2.5')}>
        <button
          onClick={onSearch}
          className={cn('group flex h-9 w-full items-center gap-2 rounded-lg bg-bg/70 px-2.5 text-[13px] text-faint shadow-[inset_0_0_0_1px_rgb(var(--line))] transition hover:bg-bg hover:text-muted', collapsed && 'justify-center px-0')}
          title="Search and commands (⌘K)"
        >
          <Command className="h-3.5 w-3.5" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Jump to…</span>
              <span className="meta text-[10px] text-faint">⌘K</span>
            </>
          )}
        </button>
      </div>

      <nav ref={navRef} className="relative flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        {ind && <span className="pointer-events-none absolute left-3 right-3 rounded-lg bg-bg shadow-soft ring-1 ring-line/70 transition-all duration-300 ease-out" style={{ top: ind.top, height: ind.height }} />}
        {NAV.map((sec) => (
          <div key={sec.section} className="mt-4 first:mt-0">
            {!collapsed ? <div className="eyebrow px-2.5 pb-1.5 !text-[9.5px]">{sec.section}</div> : <div className="mx-auto my-2.5 h-px w-5 bg-line-strong/60" />}
            {sec.items.map((it) => {
              const active = isActive(it.to);
              return (
                <div key={it.to}>
                  <NavLink
                    to={it.to}
                    end={it.to === '/'}
                    data-active={active}
                    title={collapsed ? it.label : undefined}
                    className={cn('relative flex h-[32px] items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors', collapsed && 'justify-center px-0', active ? 'text-fg font-medium' : 'text-muted hover:text-fg')}
                  >
                    <it.icon className={cn('h-[15px] w-[15px] shrink-0 transition-colors', active ? 'text-fg' : 'text-faint')} strokeWidth={1.7} />
                    {!collapsed && <span className="flex-1 truncate">{it.label}</span>}
                    {!collapsed && it.to === '/projects' && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setProjOpen((o) => !o);
                        }}
                        className="-mr-1 flex h-5 w-5 items-center justify-center rounded text-faint hover:bg-sunken hover:text-fg"
                        aria-label={projOpen ? 'Collapse projects' : 'Expand projects'}
                      >
                        <ChevronRight className={cn('h-3 w-3 transition-transform duration-200', projOpen && 'rotate-90')} />
                      </button>
                    )}
                  </NavLink>
                  {!collapsed && it.to === '/projects' && projOpen && (
                    <div className="relative mb-1 ml-[18px] mt-0.5 border-l border-line-strong/50 pl-2 animate-in">
                      {(projects ?? []).map(({ p, pct }) => {
                        const to = `/projects/${p.id}`;
                        const a = pathname === to;
                        return (
                          <NavLink
                            key={p.id}
                            to={to}
                            data-active={a}
                            className={cn('relative flex h-[28px] items-center gap-2 rounded-md px-2 text-[12.5px] transition-colors', a ? 'text-fg' : 'text-muted hover:text-fg')}
                          >
                            <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: coverAccent(p.id, p.color) }} />
                            <span className="flex-1 truncate">{p.title}</span>
                            <span className="meta text-[10px] text-faint">{pct}%</span>
                          </NavLink>
                        );
                      })}
                      <button onClick={onQuickProject} className="flex h-[28px] w-full items-center gap-2 rounded-md px-2 text-[12.5px] text-faint hover:text-fg">
                        <Plus className="h-3 w-3" /> New project
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {!collapsed && recents.length > 0 && (
          <div className="mt-5">
            <div className="eyebrow flex items-center gap-1.5 px-2.5 pb-1.5 !text-[9.5px]">
              <Clock3 className="h-2.5 w-2.5" /> Recent
            </div>
            {recents.map((r) => (
              <NavLink key={r.path} to={r.path} data-active={pathname === r.path && !NAV.some((s) => s.items.some((i) => i.to === r.path))} className="relative flex h-[28px] items-center gap-2 rounded-md px-2.5 text-[12.5px] text-muted hover:text-fg">
                <span className="meta w-[34px] shrink-0 text-[9.5px] uppercase text-faint">{r.kind}</span>
                <span className="truncate">{r.title}</span>
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className={cn('flex shrink-0 items-center gap-1 px-3 py-3', collapsed && 'flex-col px-0')}>
        <Link to="/settings" className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-bg/70', collapsed && 'flex-none px-0')} title="Settings">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft font-serif text-[15px] text-accent">{initial}</span>
          {!collapsed && (
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[12.5px]">{settings.name || 'You'}</span>
              <span className="meta block text-[10px] text-faint">Local · private</span>
            </span>
          )}
        </Link>
        <button onClick={() => saveSettings({ theme: dark ? 'light' : 'dark' })} className="flex h-7 w-7 items-center justify-center rounded-md text-faint hover:bg-bg/70 hover:text-fg" aria-label="Toggle theme" title="Toggle light/dark">
          {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>
        {!mobile && (
          <button onClick={() => saveSettings({ sidebarCollapsed: !settings.sidebarCollapsed })} className="flex h-7 w-7 items-center justify-center rounded-md text-faint hover:bg-bg/70 hover:text-fg" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    </aside>
  );
}
