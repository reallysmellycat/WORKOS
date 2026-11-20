import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Plus, Search } from 'lucide-react';
import { ALL_NAV } from '@/app/nav';
import { useApp, type QuickAddType } from '@/app/context';
import { searchAll, type SearchHit } from '@/lib/search';
import { ENTITY } from '@/lib/entities';
import { cn } from '@/lib/utils';
import { Kbd } from './ui';

interface Row {
  key: string;
  group: string;
  label: string;
  sub?: string;
  icon?: typeof Search;
  run: () => void;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const { quickAdd, openEntity } = useApp();
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setQ('');
      setHits([]);
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      searchAll(q, 30).then((h) => alive && setHits(h));
    }, 80);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  const rows: Row[] = useMemo(() => {
    const ql = q.toLowerCase().trim();
    const out: Row[] = [];
    for (const h of hits)
      out.push({
        key: `${h.type}:${h.id}`,
        group: 'Results',
        label: h.title,
        sub: `${ENTITY[h.type].label}${h.snippet ? ' · ' + h.snippet : ''}`,
        run: () => openEntity(h.type, h.id),
      });
    const creates: { t: QuickAddType; label: string }[] = [
      { t: 'task', label: 'New task' },
      { t: 'idea', label: 'Capture idea' },
      { t: 'note', label: 'New note' },
      { t: 'project', label: 'New project' },
      { t: 'content', label: 'New content item' },
      { t: 'campaign', label: 'New campaign' },
      { t: 'event', label: 'New calendar event' },
      { t: 'document', label: 'New document' },
    ];
    for (const c of creates)
      if (!ql || c.label.toLowerCase().includes(ql) || hits.length === 0)
        out.push({
          key: `new-${c.t}`,
          group: 'Create',
          label: ql && !c.label.toLowerCase().includes(ql) ? `${c.label}: “${q.trim()}”` : c.label,
          icon: Plus,
          run: () => quickAdd({ type: c.t, title: ql && !c.label.toLowerCase().includes(ql) ? q.trim() : '' }),
        });
    for (const n of ALL_NAV)
      if (!ql || n.label.toLowerCase().includes(ql))
        out.push({ key: `nav-${n.to}`, group: 'Go to', label: n.label, icon: n.icon, run: () => navigate(n.to) });
    return out;
  }, [hits, q, navigate, quickAdd, openEntity]);

  useEffect(() => {
    setActive(0);
  }, [q]);
  useEffect(() => {
    list.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const run = (r: Row) => {
    onClose();
    r.run();
  };

  let lastGroup = '';
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh] animate-fade" role="dialog" aria-modal="true" aria-label="Search">
      <div className="absolute inset-0 bg-black/25 dark:bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-line bg-surface shadow-pop animate-in">
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search className="h-4 w-4 text-faint" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search everything, or type a command…"
            className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(rows.length - 1, a + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === 'Enter' && rows[active]) {
                e.preventDefault();
                run(rows[active]);
              }
            }}
          />
          <Kbd>Esc</Kbd>
        </div>
        <div ref={list} className="max-h-[56vh] overflow-y-auto p-1.5">
          {rows.map((r, i) => {
            const header = r.group !== lastGroup ? r.group : null;
            lastGroup = r.group;
            return (
              <div key={r.key}>
                {header && <div className="px-2.5 pb-1 pt-2.5 section-title">{header}</div>}
                <button
                  data-idx={i}
                  onMouseMove={() => setActive(i)}
                  onClick={() => run(r)}
                  className={cn('flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left', i === active ? 'bg-sunken' : '')}
                >
                  {r.icon ? <r.icon className="h-4 w-4 shrink-0 text-faint" /> : <span className="w-[70px] shrink-0 text-2xs uppercase tracking-wide text-faint">{r.sub?.split(' · ')[0]}</span>}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px]">{r.label}</span>
                    {!r.icon && r.sub?.includes(' · ') && <span className="block truncate text-xs text-faint">{r.sub.split(' · ').slice(1).join(' · ')}</span>}
                  </span>
                  {i === active && <CornerDownLeft className="h-3.5 w-3.5 text-faint" />}
                </button>
              </div>
            );
          })}
          {q && !hits.length && <p className="px-3 py-2 text-xs text-faint">No matching items — you can create one above.</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
