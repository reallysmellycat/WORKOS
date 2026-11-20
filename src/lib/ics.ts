import { db } from './db';
import { downloadText } from './utils';

const esc = (s = '') => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
const d8 = (iso: string) => iso.replace(/-/g, '');
const dt = (iso: string, time: string) => `${d8(iso)}T${time.replace(':', '')}00`;
const nextDay = (iso: string) => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Exports events, task deadlines, milestones and content dates as an .ics file
 * you can import into Google Calendar, Apple Calendar or Outlook (one-way, free).
 */
export async function exportICS(opts: { events: boolean; tasks: boolean; milestones: boolean; content: boolean }) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Work OS//EN', 'CALSCALE:GREGORIAN'];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const add = (uid: string, summary: string, date: string, start?: string | null, end?: string | null, desc?: string) => {
    lines.push('BEGIN:VEVENT', `UID:${uid}@work-os`, `DTSTAMP:${stamp}`);
    if (start) {
      lines.push(`DTSTART:${dt(date, start)}`);
      lines.push(`DTEND:${dt(date, end || start)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${d8(date)}`, `DTEND;VALUE=DATE:${d8(nextDay(date))}`);
    }
    lines.push(`SUMMARY:${esc(summary)}`);
    if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
    lines.push('END:VEVENT');
  };
  if (opts.events) for (const e of await db.events.toArray()) if (!e.deletedAt) add(e.id, e.title, e.date, e.startTime, e.endTime, e.notes);
  if (opts.tasks) for (const t of await db.tasks.toArray()) if (!t.deletedAt && t.dueDate && t.status !== 'completed') add(t.id, `Due: ${t.title}`, t.dueDate);
  if (opts.milestones)
    for (const p of await db.projects.toArray())
      if (!p.deletedAt) for (const m of p.milestones) if (m.date) add(m.id, `Milestone: ${m.title} (${p.title})`, m.date);
  if (opts.content) for (const c of await db.content.toArray()) if (!c.deletedAt && c.publishDate) add(c.id, `Publish: ${c.title} (${c.platform})`, c.publishDate, c.publishTime);
  lines.push('END:VCALENDAR');
  downloadText(lines.join('\r\n'), 'work-os-calendar.ics', 'text/calendar');
}
