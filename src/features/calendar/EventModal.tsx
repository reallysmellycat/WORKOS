import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { create, softDelete, restore, update } from '@/lib/repo';
import { EVENT_KINDS } from '@/lib/domain';
import type { CalEvent, EventKind } from '@/lib/types';
import { todayISO } from '@/lib/utils';
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import { useFeedback } from '@/components/feedback';

export function EventModal({ id, date, onClose }: { id: string | null; date?: string; onClose: () => void }) {
  const [ev, setEv] = useState<Partial<CalEvent> | null>(id ? null : { title: '', kind: 'meeting', date: date ?? todayISO(), startTime: '09:00', endTime: '10:00' });
  const { toast } = useFeedback();

  useEffect(() => {
    if (id) db.events.get(id).then((e) => setEv(e ?? null));
  }, [id]);

  if (!ev) return null;
  const set = (p: Partial<CalEvent>) => setEv((e) => ({ ...e, ...p }));
  const allDay = !ev.startTime;

  const save = async () => {
    if (!ev.title?.trim()) return;
    const data = {
      title: ev.title.trim(),
      kind: ev.kind as EventKind,
      date: ev.date || todayISO(),
      startTime: ev.startTime || null,
      endTime: ev.startTime ? ev.endTime || null : null,
      location: ev.location ?? '',
      notes: ev.notes ?? '',
    };
    if (id) await update<CalEvent>('events', id, data);
    else await create<CalEvent>('events', data);
    toast(id ? 'Event updated' : 'Event added');
    onClose();
  };

  const remove = async () => {
    if (!id) return;
    await softDelete('events', id);
    onClose();
    toast('Event deleted', { action: { label: 'Undo', onClick: () => restore('events', id) } });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={id ? 'Edit event' : 'New event'}
      footer={
        <>
          {id && (
            <Button variant="ghost" icon={Trash2} className="mr-auto !text-danger" onClick={remove}>
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!ev.title?.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input autoFocus value={ev.title ?? ''} onChange={(e) => set({ title: e.target.value })} placeholder="Event title" className="!text-body-l !py-2" onKeyDown={(e) => e.key === 'Enter' && save()} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={ev.kind} onChange={(e) => set({ kind: e.target.value as EventKind })}>
              {EVENT_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" value={ev.date ?? ''} onChange={(e) => set({ date: e.target.value })} />
          </Field>
          <Field label="Start">
            <Input type="time" value={ev.startTime ?? ''} onChange={(e) => set({ startTime: e.target.value || null })} />
          </Field>
          <Field label="End">
            <Input type="time" value={ev.endTime ?? ''} onChange={(e) => set({ endTime: e.target.value || null })} disabled={allDay} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-body-s text-muted">
          <input type="checkbox" checked={allDay} onChange={(e) => set(e.target.checked ? { startTime: null, endTime: null } : { startTime: '09:00', endTime: '10:00' })} className="accent-[rgb(var(--accent))]" />
          All day
        </label>
        <Field label="Location">
          <Input value={ev.location ?? ''} onChange={(e) => set({ location: e.target.value })} placeholder="Optional" />
        </Field>
        <Field label="Notes">
          <Textarea rows={3} value={ev.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
        {ev.kind === 'reminder' && <p className="text-body-s text-faint">Reminders appear in your notification centre on the day.</p>}
      </div>
    </Modal>
  );
}
