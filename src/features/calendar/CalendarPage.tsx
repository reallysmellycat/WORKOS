import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useApp } from '@/app/context';
import { update } from '@/lib/repo';
import type { CalEvent, ContentItem, Task } from '@/lib/types';
import { safeGet, cn, toISODate, todayISO } from '@/lib/utils';
import { Button, IconButton, Page, Tabs } from '@/components/ui';
import { FILTER_GROUPS, SOURCE_STYLE, sourceColor, useCalendarItems, type CalItem, type CalSource } from './calendarData';

type View = 'month' | 'week' | 'day';
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 07:00–21:00
const HOUR_PX = 48;

export default function CalendarPage() {
  const { settings, openEntity, openEvent } = useApp();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<View>(() => (safeGet('workos-cal-view') as View) || 'month');
  const [cursor, setCursor] = useState(new Date());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const weekOpts = { weekStartsOn: settings.weekStartsOn };

  useEffect(() => {
    try {
      localStorage.setItem('workos-cal-view', view);
    } catch {
      /* storage unavailable */
    }
  }, [view]);
  useEffect(() => {
    const ev = params.get('event');
    if (ev) {
      openEvent(ev);
      params.delete('event');
      setParams(params, { replace: true });
    }
  }, [params, setParams, openEvent]);

  const [from, to] = useMemo(() => {
    if (view === 'month') return [startOfWeek(startOfMonth(cursor), weekOpts), endOfWeek(endOfMonth(cursor), weekOpts)];
    if (view === 'week') return [startOfWeek(cursor, weekOpts), endOfWeek(cursor, weekOpts)];
    return [cursor, cursor];
  }, [view, cursor, settings.weekStartsOn]); // eslint-disable-line react-hooks/exhaustive-deps

  const raw = useCalendarItems(toISODate(from), toISODate(to));
  const hiddenSources = useMemo(() => new Set(FILTER_GROUPS.filter((g) => hidden.has(g.key)).flatMap((g) => g.sources)), [hidden]);
  const items = useMemo(() => (raw ?? []).filter((i) => !hiddenSources.has(i.source)), [raw, hiddenSources]);
  const byDate = useMemo(() => {
    const m = new Map<string, CalItem[]>();
    for (const i of items) (m.get(i.date) ?? m.set(i.date, []).get(i.date)!).push(i);
    return m;
  }, [items]);

  const step = (n: number) => setCursor((c) => (view === 'month' ? addMonths(c, n) : view === 'week' ? addWeeks(c, n) : addDays(c, n)));
  const title = view === 'month' ? format(cursor, 'MMMM yyyy') : view === 'week' ? `${format(from, 'd MMM')} – ${format(to, 'd MMM yyyy')}` : format(cursor, 'EEEE, d MMMM yyyy');

  const open = (i: CalItem) => openEntity(i.open.type, i.open.id);

  /** Reschedule by dragging (events, tasks and content only). */
  const move = async (key: string, date: string) => {
    const [kind, id] = key.split(':');
    if (kind === 'e') await update<CalEvent>('events', id, { date });
    else if (kind === 't') await update<Task>('tasks', id, { dueDate: date });
    else if (kind === 'c') await update<ContentItem>('content', id, { publishDate: date });
  };

  return (
    <Page wide>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="min-w-[200px] text-h4 font-semibold tracking-tight">{title}</h1>
        <div className="flex items-center gap-1">
          <IconButton icon={ChevronLeft} label="Previous" onClick={() => step(-1)} />
          <Button size="sm" onClick={() => setCursor(new Date())}>
            Today
          </Button>
          <IconButton icon={ChevronRight} label="Next" onClick={() => step(1)} />
        </div>
        <div className="flex-1" />
        <Tabs value={view} onChange={setView} tabs={[{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }, { value: 'day', label: 'Day' }]} />
        <Button variant="primary" icon={Plus} onClick={() => openEvent(null, view === 'day' ? toISODate(cursor) : todayISO())}>
          New event
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {FILTER_GROUPS.map((g) => {
          const off = hidden.has(g.key);
          return (
            <button
              key={g.key}
              onClick={() => {
                const n = new Set(hidden);
                if (off) n.delete(g.key);
                else n.add(g.key);
                setHidden(n);
              }}
              className={cn('flex items-center gap-1.5 rounded-full border px-2.5 h-6 text-body-s transition-colors', off ? 'border-line text-faint line-through' : 'border-line-strong text-muted bg-raised')}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: off ? 'transparent' : sourceColor(g.sources[0]), border: `1.5px solid ${sourceColor(g.sources[0])}` }} />
              {g.label}
            </button>
          );
        })}
      </div>

      {view === 'month' && (
        <MonthGrid from={from} to={to} cursor={cursor} byDate={byDate} onOpen={open} onDay={(d) => openEvent(null, d)} onMove={move} onZoom={(d) => { setCursor(parseISO(d)); setView('day'); }} weekStartsOn={settings.weekStartsOn} />
      )}
      {view === 'week' && <TimeGrid days={Array.from({ length: 7 }, (_, i) => addDays(from, i))} byDate={byDate} onOpen={open} onSlot={(d) => openEvent(null, d)} onMove={move} />}
      {view === 'day' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <TimeGrid days={[cursor]} byDate={byDate} onOpen={open} onSlot={(d) => openEvent(null, d)} onMove={move} />
          <div className="card p-4">
            <h3 className="mb-2 text-body-s font-semibold">Everything on this day</h3>
            {(byDate.get(toISODate(cursor)) ?? []).length === 0 ? (
              <p className="text-body-s text-faint">Nothing scheduled.</p>
            ) : (
              (byDate.get(toISODate(cursor)) ?? []).map((i) => <ItemPill key={i.key} item={i} onOpen={open} detailed />)
            )}
          </div>
        </div>
      )}
    </Page>
  );
}

function ItemPill({ item, onOpen, detailed, draggable }: { item: CalItem; onOpen: (i: CalItem) => void; detailed?: boolean; draggable?: boolean }) {
  const color = sourceColor(item.source);
  const canDrag = draggable && /^(e|t|c):/.test(item.key);
  return (
    <button
      draggable={canDrag}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/cal-key', item.key);
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(item);
      }}
      title={`${SOURCE_STYLE[item.source].label}: ${item.title}${item.sub ? ' — ' + item.sub : ''}`}
      className={cn('group mb-0.5 flex w-full items-center gap-1.5 rounded-sm px-1.5 py-[3px] text-left text-caption leading-tight transition-colors hover:brightness-95', item.done && 'opacity-55')}
      style={{ background: `color-mix(in srgb, ${color} 13%, transparent)`, boxShadow: `inset 2px 0 0 ${color}` }}
    >
      {item.startTime && <span className="shrink-0 tabular-nums text-faint">{item.startTime}</span>}
      <span className={cn('truncate', item.done && 'line-through')}>{item.title}</span>
      {detailed && item.sub && <span className="ml-auto shrink-0 truncate text-faint">{item.sub}</span>}
    </button>
  );
}

function MonthGrid({
  from,
  to,
  cursor,
  byDate,
  onOpen,
  onDay,
  onMove,
  onZoom,
  weekStartsOn,
}: {
  from: Date;
  to: Date;
  cursor: Date;
  byDate: Map<string, CalItem[]>;
  onOpen: (i: CalItem) => void;
  onDay: (d: string) => void;
  onMove: (key: string, date: string) => void;
  onZoom: (d: string) => void;
  weekStartsOn: 0 | 1;
}) {
  const days: Date[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  const [over, setOver] = useState<string | null>(null);
  const today = todayISO();
  const heads = Array.from({ length: 7 }, (_, i) => format(addDays(startOfWeek(new Date(), { weekStartsOn }), i), 'EEE'));
  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-line bg-raised/50">
        {heads.map((h) => (
          <div key={h} className="px-2 py-2 text-caption font-semibold uppercase tracking-wider text-faint">
            {h}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const iso = toISODate(d);
          const list = byDate.get(iso) ?? [];
          const muted = !isSameMonth(d, cursor);
          return (
            <div
              key={iso}
              onClick={() => onDay(iso)}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(iso);
              }}
              onDragLeave={() => setOver((o) => (o === iso ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const k = e.dataTransfer.getData('text/cal-key');
                if (k) onMove(k, iso);
              }}
              className={cn(
                'group min-h-[112px] cursor-pointer border-b border-r border-line p-1.5 transition-colors [&:nth-child(7n)]:border-r-0',
                muted && 'bg-sunken/30',
                over === iso && 'bg-accent-soft/60',
                'hover:bg-sunken/40',
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onZoom(iso);
                  }}
                  className={cn(
                    'flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-body-s tabular-nums hover:bg-sunken',
                    iso === today ? 'bg-accent font-semibold text-accent-fg hover:bg-accent' : muted ? 'text-faint' : 'text-muted',
                  )}
                >
                  {format(d, 'd')}
                </button>
                <Plus className="h-3.5 w-3.5 text-faint opacity-0 group-hover:opacity-100" />
              </div>
              {list.slice(0, 4).map((i) => (
                <ItemPill key={i.key} item={i} onOpen={onOpen} draggable />
              ))}
              {list.length > 4 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onZoom(iso);
                  }}
                  className="px-1.5 text-caption font-medium text-muted hover:text-fg"
                >
                  +{list.length - 4} more
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimeGrid({ days, byDate, onOpen, onSlot, onMove }: { days: Date[]; byDate: Map<string, CalItem[]>; onOpen: (i: CalItem) => void; onSlot: (d: string) => void; onMove: (key: string, date: string) => void }) {
  const today = todayISO();
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  return (
    <div className="card overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="grid border-b border-line" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
          <div />
          {days.map((d) => {
            const iso = toISODate(d);
            const allDay = (byDate.get(iso) ?? []).filter((i) => !i.startTime);
            return (
              <div
                key={iso}
                className="border-l border-line p-1.5"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const k = e.dataTransfer.getData('text/cal-key');
                  if (k) onMove(k, iso);
                }}
              >
                <div className={cn('mb-1 text-body-s', iso === today ? 'font-semibold text-accent-deep' : 'text-muted')}>
                  {format(d, 'EEE')} <span className="tabular-nums">{format(d, 'd')}</span>
                </div>
                {allDay.map((i) => (
                  <ItemPill key={i.key} item={i} onOpen={onOpen} draggable />
                ))}
              </div>
            );
          })}
        </div>
        <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
          <div>
            {HOURS.map((h) => (
              <div key={h} className="relative pr-2 text-right text-caption text-faint tabular-nums" style={{ height: HOUR_PX }}>
                <span className="relative -top-2">{String(h).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>
          {days.map((d) => {
            const iso = toISODate(d);
            const timed = (byDate.get(iso) ?? []).filter((i) => i.startTime);
            return (
              <div key={iso} className="relative border-l border-line" onClick={() => onSlot(iso)}>
                {HOURS.map((h) => (
                  <div key={h} className="border-b border-line/60 hover:bg-sunken/40" style={{ height: HOUR_PX }} />
                ))}
                {iso === today && <NowLine />}
                {timed.map((i) => {
                  const start = Math.max(toMin(i.startTime!), HOURS[0] * 60);
                  const end = i.endTime ? toMin(i.endTime) : start + 30;
                  const top = ((start - HOURS[0] * 60) / 60) * HOUR_PX;
                  const h = Math.max(22, ((end - start) / 60) * HOUR_PX - 2);
                  const color = sourceColor(i.source as CalSource);
                  return (
                    <button
                      key={i.key}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(i);
                      }}
                      className={cn('absolute left-1 right-1 overflow-hidden rounded-sm px-2 py-1 text-left text-caption leading-tight shadow-xs', i.done && 'opacity-55')}
                      style={{ top, height: h, background: `color-mix(in srgb, ${color} 16%, rgb(var(--raised)))`, boxShadow: `inset 2.5px 0 0 ${color}` }}
                    >
                      <div className="truncate font-medium">{i.title}</div>
                      <div className="truncate text-faint tabular-nums">
                        {i.startTime}
                        {i.endTime ? `–${i.endTime}` : ''}
                        {i.sub ? ` · ${i.sub}` : ''}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NowLine() {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes() - HOURS[0] * 60;
  if (mins < 0 || mins > HOURS.length * 60) return null;
  return (
    <div className="pointer-events-none absolute left-0 right-0 z-10 flex items-center" style={{ top: (mins / 60) * HOUR_PX }}>
      <span className="-ml-1 h-2 w-2 rounded-full bg-danger" />
      <span className="h-px flex-1 bg-danger" />
    </div>
  );
}
