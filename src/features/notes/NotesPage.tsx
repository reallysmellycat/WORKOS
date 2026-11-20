import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Download, FolderPlus, Info, MoreHorizontal, NotebookPen, PanelRight, Pin, PinOff, Plus, Search, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { useDraft, useFolders, useMediaQuery, useNotes } from '@/lib/hooks';
import { create, softDelete } from '@/lib/repo';
import type { Folder, Note, NoteKind } from '@/lib/types';
import { cn, safeGet, downloadText, excerpt, fmtTs, slugify, timeAgo, wordCount } from '@/lib/utils';
import { DemoBadge, Empty, Field, IconButton, Input, Loading, Menu, SavedIndicator, Select } from '@/components/ui';
import { Attachments, RefsEditor, TagInput } from '@/components/pickers';
import { MarkdownEditor } from '@/components/Markdown';
import { useFeedback } from '@/components/feedback';
import { useApp } from '@/app/context';

export const NOTE_KINDS: { value: NoteKind; label: string }[] = [
  { value: 'note', label: 'Note' },
  { value: 'research', label: 'Research' },
  { value: 'reference', label: 'Reference' },
  { value: 'meeting', label: 'Meeting notes' },
];

export default function NotesPage() {
  const { id } = useParams();
  const notes = useNotes();
  const folders = useFolders();
  const navigate = useNavigate();
  const isNarrow = useMediaQuery('(max-width: 900px)');
  const [q, setQ] = useState('');
  const [folder, setFolder] = useState<string>('all');
  const [kind, setKind] = useState<NoteKind | ''>('');

  const list = useMemo(() => {
    const ql = q.toLowerCase();
    return (notes ?? [])
      .filter((n) => (folder === 'all' ? true : folder === 'none' ? !n.folderId : n.folderId === folder))
      .filter((n) => !kind || n.kind === kind)
      .filter((n) => !ql || n.title.toLowerCase().includes(ql) || n.body.toLowerCase().includes(ql) || n.tags.some((t) => t.toLowerCase().includes(ql)))
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt);
  }, [notes, q, folder, kind]);

  if (!notes || !folders) return <Loading />;
  const libFolders = folders.filter((f) => f.scope === 'library');

  const newNote = async () => {
    const n = await create<Note>('notes', { title: '', body: '', kind: kind || 'note', folderId: folder !== 'all' && folder !== 'none' ? folder : null, tags: [], refs: [] });
    navigate(`/notes/${n.id}`);
  };

  const showList = !isNarrow || !id;
  const showEditor = !isNarrow || !!id;

  return (
    <div className="flex h-full">
      {showList && (
        <div className={cn('flex h-full shrink-0 flex-col border-r border-line bg-surface/50', isNarrow ? 'w-full' : 'w-[320px]')}>
          <div className="space-y-2 border-b border-line p-3">
            <div className="flex items-center gap-2">
              <h1 className="flex-1 text-[15px] font-semibold">Notes</h1>
              <NewFolderButton scope="library" />
              <IconButton icon={Plus} label="New note" onClick={newNote} />
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes" className="pl-8" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={folder} onChange={(e) => setFolder(e.target.value)} aria-label="Folder">
                <option value="all">All folders</option>
                <option value="none">No folder</option>
                {libFolders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
              <Select value={kind} onChange={(e) => setKind(e.target.value as NoteKind | '')} aria-label="Kind">
                <option value="">All kinds</option>
                {NOTE_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5">
            {list.length === 0 ? (
              <Empty icon={NotebookPen} title={notes.length ? 'No matching notes' : 'No notes yet'} compact action={<button onClick={newNote} className="text-[13px] text-accent hover:underline">Write a note</button>} />
            ) : (
              list.map((n) => (
                <button
                  key={n.id}
                  onClick={() => navigate(`/notes/${n.id}`)}
                  className={cn('mb-0.5 block w-full rounded-md px-3 py-2.5 text-left transition-colors', n.id === id ? 'bg-sunken' : 'hover:bg-sunken/60')}
                >
                  <div className="flex items-center gap-1.5">
                    {n.pinned && <Pin className="h-3 w-3 shrink-0 text-accent" />}
                    <span className="truncate text-[13.5px] font-medium">{n.title || 'Untitled'}</span>
                    {n.isDemo && <DemoBadge />}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-faint">{excerpt(n.body, 110) || 'Empty note'}</div>
                  <div className="mt-1 flex items-center gap-2 text-2xs text-faint">
                    <span>{timeAgo(n.updatedAt)}</span>
                    {n.category && <span>· {n.category}</span>}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
      {showEditor && (
        <div className="min-w-0 flex-1 overflow-y-auto">
          {id ? (
            <NoteEditor key={id} id={id} folders={libFolders} onBack={isNarrow ? () => navigate('/notes') : undefined} />
          ) : (
            <Empty icon={NotebookPen} title="Select a note or create a new one">
              Notes support Markdown, checklists, images and [[wiki links]] to other notes. Link them to projects, tasks and campaigns from the side panel.
            </Empty>
          )}
        </div>
      )}
    </div>
  );
}

export function NewFolderButton({ scope }: { scope: Folder['scope'] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  if (!open) return <IconButton icon={FolderPlus} label="New folder" onClick={() => setOpen(true)} />;
  return (
    <form
      className="flex items-center gap-1"
      onSubmit={async (e) => {
        e.preventDefault();
        if (name.trim()) await create<Folder>('folders', { name: name.trim(), scope });
        setName('');
        setOpen(false);
      }}
    >
      <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Folder name" className="!h-7 w-32" onBlur={() => !name && setOpen(false)} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)} />
    </form>
  );
}

function NoteEditor({ id, folders, onBack }: { id: string; folders: Folder[]; onBack?: () => void }) {
  const { draft, set, status, record } = useDraft<Note>('notes', id, 700);
  const { settings } = useApp();
  const { confirm, toast } = useFeedback();
  const navigate = useNavigate();
  const [side, setSide] = useState(() => safeGet('workos-note-side') !== '0');

  const backlinks = useLiveQuery(async () => {
    if (!draft) return [];
    const title = draft.title.trim().toLowerCase();
    return (await db.notes.toArray()).filter(
      (n) => !n.deletedAt && n.id !== id && ((title && n.body.toLowerCase().includes(`[[${title}]]`)) || n.refs?.some((r) => r.type === 'note' && r.id === id)),
    );
  }, [id, draft?.title]);

  if (record === null || record?.deletedAt) return <Empty icon={Info} title="Note not found">It may have been moved to the Trash.</Empty>;
  if (!draft) return <Loading />;

  const remove = async () => {
    const ok = await confirm({ title: 'Move note to Trash?', message: 'You can restore it from Settings → Trash.', confirmLabel: 'Move to Trash', danger: true });
    if (!ok) return;
    await softDelete('notes', id);
    toast('Note moved to Trash');
    navigate('/notes');
  };

  const toggleSide = () => {
    setSide((s) => {
      try {
        localStorage.setItem('workos-note-side', s ? '0' : '1');
      } catch {
        /* storage unavailable */
      }
      return !s;
    });
  };

  const meta = (
    <>
          <Field label="Kind">
            <Select value={draft.kind} onChange={(e) => set({ kind: e.target.value as NoteKind })}>
              {NOTE_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Folder">
            <Select value={draft.folderId ?? ''} onChange={(e) => set({ folderId: e.target.value || null })}>
              <option value="">No folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Category">
            <Select value={draft.category ?? ''} onChange={(e) => set({ category: e.target.value || null })}>
              <option value="">None</option>
              {settings.noteCategories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Tags">
            <TagInput value={draft.tags} onChange={(tags) => set({ tags })} />
          </Field>
          <div>
            <span className="label">Linked to</span>
            <RefsEditor refs={draft.refs} onChange={(refs) => set({ refs })} exclude={{ type: 'note', id }} />
          </div>
          <div>
            <span className="label">Backlinks</span>
            {backlinks?.length ? (
              backlinks.map((b) => (
                <button key={b.id} onClick={() => navigate(`/notes/${b.id}`)} className="block w-full truncate rounded-md px-1 py-1 text-left text-[13px] row-hover">
                  ← {b.title || 'Untitled'}
                </button>
              ))
            ) : (
              <p className="text-xs text-faint">No other notes link here. Use [[{draft.title || 'this title'}]] in another note.</p>
            )}
          </div>
          <div>
            <span className="label">Attachments</span>
            <Attachments owner={{ type: 'note', id }} />
          </div>
          <p className="text-2xs text-faint">Created {fmtTs(draft.createdAt, 'd MMM yyyy')}</p>
    </>
  );

  return (
    <div className="flex min-h-full">
      <div className="mx-auto w-full max-w-[760px] px-5 py-6 sm:px-10">
        <div className="mb-4 flex items-center gap-2">
          {onBack && <IconButton icon={ArrowLeft} label="Back to notes" onClick={onBack} />}
          <span className="text-xs text-faint">
            {wordCount(draft.body)} words · edited {timeAgo(record?.updatedAt ?? draft.updatedAt)}
          </span>
          {draft.isDemo && <DemoBadge />}
          <div className="flex-1" />
          <SavedIndicator status={status} />
          <IconButton icon={draft.pinned ? PinOff : Pin} label={draft.pinned ? 'Unpin' : 'Pin to top'} onClick={() => set({ pinned: !draft.pinned })} />
          <IconButton icon={PanelRight} label="Toggle details panel" active={side} onClick={toggleSide} />
          <Menu
            trigger={(t) => <IconButton icon={MoreHorizontal} label="Note actions" onClick={t} />}
            items={[
              { label: 'Download as Markdown', icon: Download, onClick: () => downloadText(`# ${draft.title}\n\n${draft.body}`, `${slugify(draft.title)}.md`, 'text/markdown') },
              'divider',
              { label: 'Move to Trash', icon: Trash2, danger: true, onClick: remove },
            ]}
          />
        </div>
        <input
          value={draft.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Untitled"
          autoFocus={!draft.title}
          className="mb-4 w-full bg-transparent font-serif text-[30px] font-medium leading-tight tracking-tight outline-none placeholder:text-faint"
        />
        <MarkdownEditor value={draft.body} onChange={(body) => set({ body })} owner={{ type: 'note', id }} minHeight={420} />
        <details className="mt-8 rounded-lg border border-line p-4 xl:hidden">
          <summary className="cursor-pointer text-[13px] font-medium">Details, links & attachments</summary>
          <div className="mt-4 space-y-4">{meta}</div>
        </details>
      </div>
      {side && <aside className="hidden w-[280px] shrink-0 space-y-4 border-l border-line bg-surface/40 p-4 xl:block">{meta}</aside>}
    </div>
  );
}
