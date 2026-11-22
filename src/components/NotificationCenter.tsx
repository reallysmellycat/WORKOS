import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlarmClock, BellOff, CalendarClock, Check, Flag, Repeat, Sparkles, TriangleAlert } from 'lucide-react';
import { dismiss, type AppNotification } from '@/lib/notifications';
import { cn } from '@/lib/utils';
import { Button } from './ui';

const ICONS = {
  overdue: TriangleAlert,
  deadline: CalendarClock,
  milestone: Flag,
  content: Sparkles,
  reminder: AlarmClock,
  recurring: Repeat,
};

export function NotificationCenter({ items, onClose }: { items: AppNotification[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  useEffect(() => {
    const on = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest('[aria-label="Notifications"]')) onClose();
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
    <div ref={ref} className="absolute right-0 top-9 z-40 w-[min(380px,calc(100vw-1.5rem))] rounded-lg border border-line bg-raised shadow-lg animate-in">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <h3 className="text-body-s font-semibold">Notifications</h3>
        {items.length > 0 && (
          <Button size="xs" variant="ghost" icon={Check} onClick={() => dismiss(items.map((i) => i.key))}>
            Dismiss all
          </Button>
        )}
      </div>
      <div className="max-h-[60vh] overflow-y-auto p-1.5">
        {items.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <BellOff className="h-5 w-5 text-faint" />
            <p className="mt-2 text-body-s text-muted">You're all caught up.</p>
          </div>
        ) : (
          items.map((n) => {
            const Icon = ICONS[n.kind];
            return (
              <div key={n.key} className="group flex items-start gap-3 rounded-md px-2.5 py-2 hover:bg-sunken/70">
                <span className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm', n.severity === 'high' ? 'bg-danger/10 text-danger' : 'bg-sunken text-muted')}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    navigate(n.href);
                    onClose();
                  }}
                >
                  <div className="truncate text-body-s font-medium">{n.title}</div>
                  <div className="truncate text-body-s text-muted">{n.detail}</div>
                </button>
                <button className="mt-0.5 text-caption text-faint opacity-0 hover:text-fg group-hover:opacity-100" onClick={() => dismiss([n.key])}>
                  Dismiss
                </button>
              </div>
            );
          })
        )}
      </div>
      <div className="border-t border-line px-4 py-2 text-caption text-faint">
        Change what you're notified about in{' '}
        <button
          className="text-accent-deep hover:underline"
          onClick={() => {
            navigate('/settings?tab=notifications');
            onClose();
          }}
        >
          Settings
        </button>
        .
      </div>
    </div>
  );
}
