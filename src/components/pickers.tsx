import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Download, ExternalLink, FileIcon, Link2, Paperclip, Plus, Trash2, X } from 'lucide-react';
import { db, type RecordTable } from '@/lib/db';
import { ENTITY, entityTitle, refKey } from '@/lib/entities';
import { create, softDelete } from '@/lib/repo';
import { useApp } from '@/app/context';
import type { ChecklistItem, CustomValues, EntityRef, EntityType, LinkItem, StoredFile } from '@/lib/types';
import type { CustomFieldDef } from '@/lib/settings';
import { cn, downloadBlob, fmtBytes, uid } from '@/lib/utils';
import { Button, Checkbox, IconButton, Input, Select, Tag } from './ui';
import { useCampaigns, useProjects } from '@/lib/hooks';

// ---------- Tags ----------
export function TagInput({ value, onChange, placeholder = 'Add tag…' }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const { settings } = useApp();
  const [text, setText] = useState('');
  const [focus, setFocus] = useState(false);
  const colors = useMemo(() => new Map(settings.tags.map((t) => [t.name, t.color])), [settings.tags]);
  const suggestions = settings.tags.map((t) => t.name).filter((t) => !value.includes(t) && t.toLowerCase().includes(text.toLowerCase())).slice(0, 6);
  const add = (t: string) => {
    const v = t.trim().replace(/^#/, '');
    if (v && !value.includes(v)) onChange([...value, v]);
    setText('');
  };
  return (
    <div className="relative">
      <div className="field flex flex-wrap items-center gap-1 py-1 min-h-[32px]">
        {value.map((t) => (
          <Tag key={t} name={t} color={colors.get(t)} onRemove={() => onChange(value.filter((x) => x !== t))} />
        ))}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setTimeout(() => setFocus(false), 150)}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ',') && text.trim()) {
              e.preventDefault();
              add(text);
            } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
          }}
          placeholder={value.length ? '' : placeholder}
          className="min-w-[80px] flex-1 bg-transparent outline-none text-[13px] placeholder:text-faint"
        />
      </div>
      {focus && suggestions.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-line bg-raised p-1 shadow-pop">
          {suggestions.map((s) => (
            <button key={s} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(s)} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[13px] hover:bg-sunken">
              <span className="h-2 w-2 rounded-full" style={{ background: colors.get(s) }} />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TagList({ tags }: { tags: string[] }) {
  const { settings } = useApp();
  if (!tags?.length) return null;
  const colors = new Map(settings.tags.map((t) => [t.name, t.color]));
  return (
    <span className="inline-flex flex-wrap gap-1">
      {tags.map((t) => (
        <Tag key={t} name={t} color={colors.get(t)} />
      ))}
    </span>
  );
}

// ---------- Selects ----------
export function ProjectSelect({ value, onChange, allowNone = true }: { value?: string | null; onChange: (v: string | null) => void; allowNone?: boolean }) {
  const projects = useProjects();
  return (
    <Select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      {allowNone && <option value="">No project</option>}
      {(projects ?? [])
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
            {p.status === 'completed' ? ' (completed)' : ''}
          </option>
        ))}
    </Select>
  );
}

export function CampaignSelect({ value, onChange }: { value?: string | null; onChange: (v: string | null) => void }) {
  const campaigns = useCampaigns();
  return (
    <Select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">No campaign</option>
      {(campaigns ?? []).map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </Select>
  );
}

// ---------- Checklist ----------
export function ChecklistEditor({ items, onChange }: { items: ChecklistItem[]; onChange: (v: ChecklistItem[]) => void }) {
  const [text, setText] = useState('');
  return (
    <div className="space-y-0.5">
      {items.map((it) => (
        <div key={it.id} className="group flex items-center gap-2 rounded-md px-1 py-1 row-hover">
          <Checkbox size="sm" checked={it.done} onChange={(v) => onChange(items.map((x) => (x.id === it.id ? { ...x, done: v } : x)))} />
          <input
            value={it.text}
            onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)))}
            className={cn('flex-1 bg-transparent text-[13px] outline-none', it.done && 'line-through text-faint')}
          />
          <IconButton icon={X} label="Remove item" size="sm" className="opacity-0 group-hover:opacity-100" onClick={() => onChange(items.filter((x) => x.id !== it.id))} />
        </div>
      ))}
      <div className="flex items-center gap-2 px-1 py-1">
        <Plus className="h-3.5 w-3.5 text-faint" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && text.trim()) {
              onChange([...items, { id: uid(), text: text.trim(), done: false }]);
              setText('');
            }
          }}
          placeholder="Add item and press Enter"
          className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint"
        />
      </div>
    </div>
  );
}

// ---------- Links ----------
export function LinksEditor({ links, onChange }: { links: LinkItem[]; onChange: (v: LinkItem[]) => void }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const add = () => {
    if (!url.trim()) return;
    const u = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    onChange([...links, { id: uid(), title: title.trim() || u.replace(/^https?:\/\//, ''), url: u }]);
    setTitle('');
    setUrl('');
  };
  return (
    <div className="space-y-1.5">
      {links.map((l) => (
        <div key={l.id} className="group flex items-center gap-2 rounded-md px-1 py-1 row-hover">
          <Link2 className="h-3.5 w-3.5 text-faint shrink-0" />
          <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-[13px] hover:text-accent">
            {l.title}
          </a>
          <ExternalLink className="h-3 w-3 text-faint" />
          <IconButton icon={X} label="Remove link" size="sm" className="opacity-0 group-hover:opacity-100" onClick={() => onChange(links.filter((x) => x.id !== l.id))} />
        </div>
      ))}
      <div className="flex gap-1.5">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" className="flex-1" />
        <Input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="https://…" className="flex-[1.4]" />
        <Button onClick={add} icon={Plus} disabled={!url.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}

// ---------- Entity references (cross-linking) ----------
const LINKABLE: EntityType[] = ['project', 'task', 'campaign', 'content', 'note', 'document'];

export function useRefTitles(refs: EntityRef[]) {
  return useLiveQuery(async () => {
    const out: { ref: EntityRef; title: string; exists: boolean }[] = [];
    for (const r of refs) {
      const rec = (await db.table(ENTITY[r.type].table).get(r.id)) as Record<string, unknown> | undefined;
      out.push({ ref: r, title: entityTitle(r.type, rec), exists: !!rec && !rec.deletedAt });
    }
    return out;
  }, [JSON.stringify(refs)]);
}

export function RefsEditor({ refs, onChange, exclude }: { refs: EntityRef[]; onChange: (v: EntityRef[]) => void; exclude?: EntityRef }) {
  const { openEntity } = useApp();
  const resolved = useRefTitles(refs) ?? [];
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-1">
      {resolved.map(({ ref, title, exists }) => (
        <div key={refKey(ref)} className="group flex items-center gap-2 rounded-md px-1 py-1 row-hover">
          <span className="w-16 shrink-0 text-2xs uppercase tracking-wide text-faint">{ENTITY[ref.type].label}</span>
          <button className={cn('flex-1 truncate text-left text-[13px] hover:text-accent', !exists && 'text-faint line-through')} onClick={() => exists && openEntity(ref.type, ref.id)}>
            {title}
          </button>
          <IconButton icon={X} label="Unlink" size="sm" className="opacity-0 group-hover:opacity-100" onClick={() => onChange(refs.filter((r) => refKey(r) !== refKey(ref)))} />
        </div>
      ))}
      {adding ? (
        <EntitySearch
          onPick={(r) => {
            if (!refs.some((x) => refKey(x) === refKey(r))) onChange([...refs, r]);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
          exclude={exclude}
        />
      ) : (
        <Button size="sm" variant="ghost" icon={Plus} onClick={() => setAdding(true)}>
          Link item
        </Button>
      )}
    </div>
  );
}

export function EntitySearch({ onPick, onCancel, types = LINKABLE, exclude }: { onPick: (r: EntityRef) => void; onCancel: () => void; types?: EntityType[]; exclude?: EntityRef }) {
  const [q, setQ] = useState('');
  const results = useLiveQuery(async () => {
    const out: { ref: EntityRef; title: string }[] = [];
    const needle = q.trim().toLowerCase();
    for (const type of types) {
      const rows = (await db.table(ENTITY[type].table as RecordTable).toArray()) as Record<string, unknown>[];
      for (const r of rows) {
        if (r.deletedAt) continue;
        const title = entityTitle(type, r);
        if (exclude && exclude.id === r.id) continue;
        if (!needle || title.toLowerCase().includes(needle)) out.push({ ref: { type, id: r.id as string }, title });
      }
    }
    return out.slice(0, 12);
  }, [q]);
  return (
    <div className="rounded-lg border border-line bg-raised p-1.5 shadow-soft">
      <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects, tasks, notes…" onKeyDown={(e) => e.key === 'Escape' && onCancel()} />
      <div className="mt-1 max-h-56 overflow-y-auto">
        {(results ?? []).map((r) => (
          <button key={refKey(r.ref)} type="button" onClick={() => onPick(r.ref)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] hover:bg-sunken">
            <span className="w-16 shrink-0 text-2xs uppercase tracking-wide text-faint">{ENTITY[r.ref.type].label}</span>
            <span className="truncate">{r.title}</span>
          </button>
        ))}
        {results && !results.length && <p className="px-2 py-2 text-xs text-faint">No matches.</p>}
      </div>
      <div className="mt-1 flex justify-end">
        <Button size="xs" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** Shows notes & documents that link to the given entity (backlinks). */
export function Backlinks({ target }: { target: EntityRef }) {
  const navigate = useNavigate();
  const items = useLiveQuery(async () => {
    const match = (refs?: EntityRef[]) => refs?.some((r) => r.type === target.type && r.id === target.id);
    const notes = (await db.notes.toArray()).filter((n) => !n.deletedAt && match(n.refs));
    const docs = (await db.documents.toArray()).filter((d) => !d.deletedAt && match(d.refs));
    return [...notes.map((n) => ({ id: n.id, title: n.title, type: 'note' as const })), ...docs.map((d) => ({ id: d.id, title: d.title, type: 'document' as const }))];
  }, [target.type, target.id]);
  if (!items?.length) return <p className="text-xs text-faint">No notes or documents link here yet.</p>;
  return (
    <div className="space-y-0.5">
      {items.map((i) => (
        <button key={i.id} onClick={() => navigate(ENTITY[i.type].route(i.id))} className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-[13px] row-hover">
          <span className="w-16 shrink-0 text-2xs uppercase tracking-wide text-faint">{ENTITY[i.type].label}</span>
          <span className="truncate">{i.title || 'Untitled'}</span>
        </button>
      ))}
    </div>
  );
}

// ---------- Attachments ----------
export function Attachments({ owner }: { owner: EntityRef }) {
  const files = useLiveQuery(async () => (await db.files.toArray()).filter((f) => !f.deletedAt && !f.inline && f.owner?.id === owner.id), [owner.id]);
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const upload = async (list: FileList | File[]) => {
    for (const f of Array.from(list)) {
      await create<StoredFile>('files', { name: f.name, mime: f.type || 'application/octet-stream', size: f.size, blob: f, tags: [], owner, inline: false });
    }
  };
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        void upload(e.dataTransfer.files);
      }}
      className={cn('rounded-lg transition-colors', drag && 'bg-accent-soft/60 ring-1 ring-accent/40')}
    >
      <div className="space-y-0.5">
        {(files ?? []).map((f) => (
          <div key={f.id} className="group flex items-center gap-2 rounded-md px-1 py-1 row-hover">
            <FileIcon className="h-3.5 w-3.5 text-faint shrink-0" />
            <button className="flex-1 truncate text-left text-[13px] hover:text-accent" onClick={() => openFile(f)}>
              {f.name}
            </button>
            <span className="text-2xs text-faint tabular-nums">{fmtBytes(f.size)}</span>
            <IconButton icon={Download} label="Download" size="sm" onClick={() => downloadBlob(f.blob, f.name)} />
            <IconButton icon={Trash2} label="Move to Trash" size="sm" className="opacity-0 group-hover:opacity-100" onClick={() => softDelete('files', f.id)} />
          </div>
        ))}
      </div>
      <button onClick={() => input.current?.click()} className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-line-strong py-2 text-xs text-muted hover:border-accent hover:text-accent">
        <Paperclip className="h-3.5 w-3.5" /> Attach files (or drop here)
      </button>
      <input ref={input} type="file" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />
      <p className="mt-1 text-2xs text-faint">Files are stored privately in this browser and included in full backups.</p>
    </div>
  );
}

export function openFile(f: StoredFile) {
  const url = URL.createObjectURL(f.blob);
  const viewable = /^(image\/|application\/pdf|text\/|video\/|audio\/)/.test(f.mime);
  if (viewable) window.open(url, '_blank', 'noopener');
  else downloadBlob(f.blob, f.name);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ---------- Custom fields ----------
export function CustomFields({ entity, values, onChange }: { entity: CustomFieldDef['entity']; values?: CustomValues; onChange: (v: CustomValues) => void }) {
  const { settings } = useApp();
  const defs = settings.customFields.filter((f) => f.entity === entity);
  if (!defs.length) return null;
  const v = values ?? {};
  return (
    <div className="grid grid-cols-2 gap-3">
      {defs.map((d) => (
        <label key={d.id} className="block">
          <span className="label">{d.label}</span>
          {d.kind === 'select' ? (
            <Select value={v[d.id] ?? ''} onChange={(e) => onChange({ ...v, [d.id]: e.target.value })}>
              <option value="">—</option>
              {(d.options ?? []).map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Select>
          ) : (
            <Input type={d.kind === 'number' ? 'number' : d.kind === 'date' ? 'date' : d.kind === 'url' ? 'url' : 'text'} value={v[d.id] ?? ''} onChange={(e) => onChange({ ...v, [d.id]: e.target.value })} />
          )}
        </label>
      ))}
    </div>
  );
}
