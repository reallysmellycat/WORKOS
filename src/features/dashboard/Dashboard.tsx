import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { ArrowUpRight, Check, FlaskConical, GripVertical, LayoutGrid, Maximize2, Minimize2, Plus, RotateCcw, Search, ShieldCheck, X } from 'lucide-react';
import { useApp } from '@/app/context';
import { db } from '@/lib/db';
import { DEFAULT_DASHBOARD, saveSettings, type WidgetConfig, type WidgetSize, type WidgetType } from '@/lib/settings';
import { hasDemo, removeDemo } from '@/lib/demo';
import { isOverdue } from '@/lib/domain';
import { cn, todayISO, uid } from '@/lib/utils';
import { Button, IconButton, Kbd, Modal } from '@/components/ui';
import { useFeedback } from '@/components/feedback';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { WIDGETS } from './widgets';

const SPAN: Record<WidgetSize, string> = {
  s: 'lg:col-span-4 md:col-span-6',
  m: 'lg:col-span-6 md:col-span-6',
  l: 'lg:col-span-8 md:col-span-12',
  xl: 'lg:col-span-12 md:col-span-12',
};
const SIZES: WidgetSize[] = ['s', 'm', 'l', 'xl'];
const SIZE_LABEL: Record<WidgetSize, string> = { s: 'Small', m: 'Medium', l: 'Large', xl: 'Full width' };

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  const { settings, quickAdd, openSearch } = useApp();
  const { confirm, toast } = useFeedback();
  const [editing, setEditing] = useState(false);
  const [layout, setLayout] = useState<WidgetConfig[]>(settings.dashboard);
  const [dragId, setDragId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const demo = useLiveQuery(hasDemo, []);

  useEffect(() => {
    if (!editing) setLayout(settings.dashboard);
  }, [settings.dashboard, editing]);

  const summary = useLiveQuery(async () => {
    const today = todayISO();
    const tasks = (await db.tasks.toArray()).filter((t) => !t.deletedAt && t.status !== 'completed');
    const dueToday = tasks.filter((t) => t.dueDate === today || t.myDay === today).length;
    const overdue = tasks.filter(isOverdue).length;
    const events = (await db.events.where('date').equals(today).toArray()).filter((e) => !e.deletedAt && (e.kind === 'meeting' || e.kind === 'event')).length;
    const content = (await db.content.where('publishDate').equals(today).toArray()).filter((c) => !c.deletedAt && c.status !== 'published').length;
    const total = await db.tasks.count();
    return { dueToday, overdue, events, content, total };
  }, []);

  const backupNudge = useMemo(() => {
    if (!summary || summary.total < 5) return false;
    return !settings.lastExportAt || Date.now() - settings.lastExportAt > 14 * 86400000;
  }, [summary, settings.lastExportAt]);

  const save = (next: WidgetConfig[]) => {
    setLayout(next);
    void saveSettings({ dashboard: next });
  };

  const move = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const next = [...layout];
    const from = next.findIndex((w) => w.id === fromId);
    const to = next.findIndex((w) => w.id === toId);
    const [w] = next.splice(from, 1);
    next.splice(to, 0, w);
    save(next);
  };

  const parts: string[] = [];
  if (summary) {
    if (summary.dueToday) parts.push(`${summary.dueToday} task${summary.dueToday > 1 ? 's' : ''} planned for today`);
    if (summary.events) parts.push(`${summary.events} meeting${summary.events > 1 ? 's' : ''}`);
    if (summary.content) parts.push(`${summary.content} post${summary.content > 1 ? 's' : ''} to publish`);
    if (summary.overdue) parts.push(`${summary.overdue} overdue`);
  }
  const sentence = summary ? (parts.length ? `You have ${parts.join(', ').replace(/, ([^,]*)$/, ' and $1')}.` : 'A clear day ahead — a good moment for deep work.') : '';

  const available = (Object.keys(WIDGETS) as WidgetType[]).filter((t) => !layout.some((w) => w.type === t));

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-8 sm:py-8">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] text-faint">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
          <h1 className="mt-1 font-serif text-[34px] font-medium leading-tight tracking-tight">
            {greeting()}
            {settings.name ? `, ${settings.name}` : ''}.
          </h1>
          <p className="mt-1.5 max-w-xl text-[14px] text-muted">{sentence}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button icon={Search} onClick={openSearch} className="hidden sm:inline-flex">
            Search <Kbd>⌘K</Kbd>
          </Button>
          <Button icon={Plus} onClick={() => quickAdd()}>
            Quick add
          </Button>
          {editing ? (
            <Button variant="primary" icon={Check} onClick={() => setEditing(false)}>
              Done
            </Button>
          ) : (
            <IconButton icon={LayoutGrid} label="Customise dashboard" onClick={() => setEditing(true)} />
          )}
        </div>
      </header>

      {demo && !editing && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-line-strong bg-surface px-4 py-3 text-[13px]">
          <FlaskConical className="h-4 w-4 text-accent" />
          <span className="flex-1 text-muted">
            You're looking at <strong className="font-medium text-fg">demo content</strong> (marked “Demo”). Your own items are never mixed in.
          </span>
          <Button
            size="sm"
            onClick={async () => {
              const ok = await confirm({ title: 'Remove all demo content?', message: 'Only items marked “Demo” are deleted. Anything you created yourself stays.', confirmLabel: 'Remove demo content', danger: true });
              if (!ok) return;
              const n = await removeDemo();
              toast(`Removed ${n} demo items`);
            }}
          >
            Remove demo content
          </Button>
        </div>
      )}

      {backupNudge && !demo && !editing && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-[13px]">
          <ShieldCheck className="h-4 w-4 text-accent" />
          <span className="flex-1 text-muted">
            {settings.lastExportAt ? "It's been a while since your last backup." : "You haven't exported a backup yet."} Your data lives only in this browser — a backup file keeps it safe.
          </span>
          <Link to="/settings?tab=data" className="font-medium text-accent hover:underline">
            Back up now
          </Link>
        </div>
      )}

      {editing && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-accent-soft/60 px-4 py-2.5 text-[13px] animate-in">
          <span className="flex-1 text-fg">Drag widgets to reorder. Use the size and remove buttons on each card.</span>
          <Button size="sm" icon={Plus} onClick={() => setAdding(true)} disabled={!available.length}>
            Add widget
          </Button>
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => save(DEFAULT_DASHBOARD)}>
            Reset layout
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {layout.map((w) => {
          const def = WIDGETS[w.type];
          if (!def) return null;
          return (
            <section
              key={w.id}
              draggable={editing}
              onDragStart={() => setDragId(w.id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={(e) => editing && e.preventDefault()}
              onDrop={() => dragId && move(dragId, w.id)}
              className={cn('card flex min-h-[180px] flex-col transition-all', SPAN[w.size], editing && 'cursor-grab ring-1 ring-accent/20 hover:ring-accent/50', dragId === w.id && 'opacity-40')}
            >
              <header className="flex items-center gap-2 px-4 pb-2 pt-3.5">
                {editing && <GripVertical className="h-4 w-4 text-faint" />}
                <def.icon className="h-3.5 w-3.5 text-faint" />
                <h2 className="flex-1 text-[13px] font-semibold">{def.title}</h2>
                {editing ? (
                  <>
                    <IconButton
                      size="sm"
                      icon={w.size === 'xl' ? Minimize2 : Maximize2}
                      label={`Size: ${SIZE_LABEL[w.size]} (click to change)`}
                      onClick={() => save(layout.map((x) => (x.id === w.id ? { ...x, size: SIZES[(SIZES.indexOf(x.size) + 1) % SIZES.length] } : x)))}
                    />
                    <IconButton size="sm" icon={X} label="Remove widget" onClick={() => save(layout.filter((x) => x.id !== w.id))} />
                  </>
                ) : (
                  def.href && (
                    <Link to={def.href} className="text-faint hover:text-fg" aria-label={`Open ${def.title}`}>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  )
                )}
              </header>
              <div className={cn('flex-1 px-4 pb-4', editing && 'pointer-events-none select-none opacity-70')}>
                <ErrorBoundary inline>{def.render()}</ErrorBoundary>
              </div>
            </section>
          );
        })}
      </div>

      {layout.length === 0 && (
        <div className="card py-16 text-center">
          <p className="text-[13px] text-muted">Your dashboard is empty.</p>
          <Button className="mt-3" icon={Plus} onClick={() => { setEditing(true); setAdding(true); }}>
            Add widgets
          </Button>
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a widget" width="max-w-2xl">
        <div className="grid gap-2 sm:grid-cols-2">
          {available.map((t) => {
            const d = WIDGETS[t];
            return (
              <button
                key={t}
                onClick={() => {
                  save([...layout, { id: `w-${uid().slice(0, 8)}`, type: t, size: 'm' }]);
                  setAdding(false);
                }}
                className="flex gap-3 rounded-lg border border-line p-3 text-left hover:border-accent hover:bg-accent-soft/30"
              >
                <d.icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>
                  <span className="block text-[13.5px] font-medium">{d.title}</span>
                  <span className="block text-xs text-muted">{d.description}</span>
                </span>
              </button>
            );
          })}
          {!available.length && <p className="text-[13px] text-muted">All widgets are already on your dashboard.</p>}
        </div>
      </Modal>
    </div>
  );
}
