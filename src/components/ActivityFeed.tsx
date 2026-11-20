import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, CirclePlus, History, Pencil, RotateCcw, Shuffle, Trash2, ArrowRightLeft } from 'lucide-react';
import { db } from '@/lib/db';
import { ENTITY } from '@/lib/entities';
import type { Activity } from '@/lib/types';
import { timeAgo } from '@/lib/utils';
import { useApp } from '@/app/context';
import { Empty } from './ui';

const ICON = {
  created: CirclePlus,
  updated: Pencil,
  completed: CheckCircle2,
  deleted: Trash2,
  restored: RotateCcw,
  converted: Shuffle,
  status: ArrowRightLeft,
};

const VERB: Record<Activity['action'], string> = {
  created: 'Created',
  updated: 'Edited',
  completed: 'Completed',
  deleted: 'Deleted',
  restored: 'Restored',
  converted: 'Converted',
  status: 'Status changed',
};

export function ActivityFeed({ entityIds, limit = 12, compact }: { entityIds?: string[]; limit?: number; compact?: boolean }) {
  const { openEntity } = useApp();
  const items = useLiveQuery(async () => {
    if (entityIds) {
      if (!entityIds.length) return [];
      return (await db.activity.where('entityId').anyOf(entityIds).toArray()).sort((a, b) => b.at - a.at).slice(0, limit);
    }
    return db.activity.orderBy('at').reverse().limit(limit).toArray();
  }, [entityIds?.join(','), limit]);

  if (!items) return null;
  if (!items.length) return <Empty icon={History} title="No activity yet" compact />;
  return (
    <ol className="space-y-0.5">
      {items.map((a) => {
        const Icon = ICON[a.action];
        return (
          <li key={a.id}>
            <button
              className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left row-hover"
              onClick={() => a.action !== 'deleted' && openEntity(a.entity, a.entityId)}
            >
              <Icon className={`h-3.5 w-3.5 shrink-0 ${a.action === 'completed' ? 'text-ok' : a.action === 'deleted' ? 'text-danger' : 'text-faint'}`} />
              <span className="min-w-0 flex-1 truncate text-[13px]">
                <span className="text-muted">{VERB[a.action]}</span>
                {!compact && <span className="text-faint"> {ENTITY[a.entity].label.toLowerCase()}</span>} <span className="text-fg">{a.title}</span>
              </span>
              <span className="shrink-0 text-2xs text-faint tabular-nums">{timeAgo(a.at)}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
