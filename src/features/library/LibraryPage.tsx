import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookMarked, ExternalLink, FileIcon, FileText, Folder as FolderIcon, FolderPlus, Hash, Layers, Library, Link2, MoreHorizontal, NotebookPen, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { useBookmarks, useCollections, useDocs, useFiles, useFolders, useNotes } from '@/lib/hooks';
import { create, restore, softDelete, update } from '@/lib/repo';
import type { Bookmark, Collection, EntityRef, EntityType, Folder, Note, StoredFile } from '@/lib/types';
import { refKey } from '@/lib/entities';
import { cn, excerpt, fmtBytes, timeAgo } from '@/lib/utils';
import { Badge, Button, DemoBadge, Empty, Field, IconButton, Input, Loading, Menu, Modal, Page, Select, Textarea } from '@/components/ui';
import { TagInput, TagList, openFile } from '@/components/pickers';
import { useFeedback } from '@/components/feedback';
import { useApp } from '@/app/context';

type Kind = 'all' | 'note' | 'document' | 'bookmark' | 'file';

interface Item {
  ref: EntityRef;
  title: string;
  sub: string;
  updatedAt: number;
  tags: string[];
  folderId?: string | null;
  category?: string | null;
  isDemo?: boolean;
  url?: string;
  file?: StoredFile;
}

const KIND_META: Record<Exclude<Kind, 'all'>, { label: string; icon: typeof FileText }> = {
  note: { label: 'Notes', icon: NotebookPen },
  document: { label: 'Documents', icon: FileText },
  bookmark: { label: 'Links', icon: Link2 },
  file: { label: 'Files', icon: FileIcon },
};

export default function LibraryPage() {
  const notes = useNotes();
  const docs = useDocs();
  const bookmarks = useBookmarks();
  const files = useFiles();
  const folders = useFolders();
  const collections = useCollections();
  const { settings } = useApp();
  const navigate = useNavigate();
  const { toast } = useFeedback();
  const [params] = useSearchParams();
  const [kind, setKind] = useState<Kind>((params.get('type') as Kind) || 'all');
  const [folder, setFolder] = useState<string | null>(null);
  const [collection, setCollection] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState<null | 'link' | 'collection' | 'folder'>(null);
  const [editingLink, setEditingLink] = useState<Bookmark | null>(null);
  const upload = useRef<HTMLInputElement>(null);

  const items: Item[] = useMemo(() => {
    if (!notes || !docs || !bookmarks || !files) return [];
    return [
      ...notes.map((n) => ({ ref: { type: 'note' as EntityType, id: n.id }, title: n.title || 'Untitled', sub: excerpt(n.body, 120), updatedAt: n.updatedAt, tags: n.tags, folderId: n.folderId, category: n.category, isDemo: n.isDemo })),
      ...docs.map((d) => ({ ref: { type: 'document' as EntityType, id: d.id }, title: d.title || 'Untitled', sub: excerpt(d.body, 120), updatedAt: d.updatedAt, tags: d.tags, folderId: null, isDemo: d.isDemo })),
      ...bookmarks.map((b) => ({ ref: { type: 'bookmark' as EntityType, id: b.id }, title: b.title, sub: b.description || b.url, updatedAt: b.updatedAt, tags: b.tags, folderId: b.folderId, category: b.category, url: b.url, isDemo: b.isDemo })),
      ...files.filter((f) => !f.inline).map((f) => ({ ref: { type: 'file' as EntityType, id: f.id }, title: f.name, sub: `${f.mime || 'file'} · ${fmtBytes(f.size)}${f.owner ? ' · attached' : ''}`, updatedAt: f.updatedAt, tags: f.tags, folderId: f.folderId, file: f, isDemo: f.isDemo })),
    ];
  }, [notes, docs, bookmarks, files]);

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    const col = collection ? collections?.find((c) => c.id === collection) : null;
    const colKeys = col ? new Set(col.items.map(refKey)) : null;
    return items
      .filter((i) => kind === 'all' || i.ref.type === kind)
      .filter((i) => !folder || i.folderId === folder)
      .filter((i) => !tag || i.tags.includes(tag))
      .filter((i) => !category || i.category === category)
      .filter((i) => !colKeys || colKeys.has(refKey(i.ref)))
      .filter((i) => !ql || i.title.toLowerCase().includes(ql) || i.sub.toLowerCase().includes(ql) || i.tags.some((t) => t.toLowerCase().includes(ql)))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [items, kind, folder, tag, category, collection, collections, q]);

  if (!notes || !docs || !bookmarks || !files || !folders || !collections) return <Loading />;
  const libFolders = folders.filter((f) => f.scope === 'library');
  const allTags = [...new Set(items.flatMap((i) => i.tags))].sort();
  const usedCategories = [...new Set(items.map((i) => i.category).filter(Boolean))] as string[];

  const open = (i: Item) => {
    if (i.ref.type === 'note') navigate(`/notes/${i.ref.id}`);
    else if (i.ref.type === 'document') navigate(`/documents/${i.ref.id}`);
    else if (i.ref.type === 'bookmark' && i.url) window.open(i.url, '_blank', 'noopener');
    else if (i.file) openFile(i.file);
  };

  const tableFor = (t: EntityType) => (t === 'note' ? 'notes' : t === 'document' ? 'documents' : t === 'bookmark' ? 'bookmarks' : 'files') as 'notes';

  const addToCollection = async (c: Collection, i: Item) => {
    if (c.items.some((x) => refKey(x) === refKey(i.ref))) return toast('Already in this collection', { tone: 'info' });
    await update<Collection>('collections', c.id, { items: [...c.items, i.ref] }, { log: false });
    toast(`Added to “${c.name}”`);
  };

  const uploadFiles = async (list: FileList) => {
    for (const f of Array.from(list)) await create<StoredFile>('files', { name: f.name, mime: f.type || 'application/octet-stream', size: f.size, blob: f, tags: [], folderId: folder, owner: null });
    toast(`${list.length} file(s) added`);
  };

  const clearFilters = () => {
    setFolder(null);
    setTag(null);
    setCategory(null);
    setCollection(null);
  };

  const navBtn = (active: boolean) => cn('flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-body-s', active ? 'bg-sunken font-medium text-fg' : 'text-muted hover:bg-sunken/60');
  const activeCollection = collections.find((c) => c.id === collection);

  return (
    <Page wide>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-h4 font-semibold tracking-tight">Library</h1>
          <p className="mt-1 text-body-s text-muted">Your professional knowledge base — notes, research, documents, links and files, all connected.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={Link2} onClick={() => setModal('link')}>
            Save link
          </Button>
          <Button icon={Upload} onClick={() => upload.current?.click()}>
            Upload files
          </Button>
          <Button
            variant="primary"
            icon={Plus}
            onClick={async () => {
              const n = await create<Note>('notes', { title: '', body: '', kind: 'note', folderId: folder, tags: tag ? [tag] : [], refs: [] });
              navigate(`/notes/${n.id}`);
            }}
          >
            New note
          </Button>
          <input ref={upload} type="file" multiple hidden onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="space-y-5" aria-label="Library filters">
          <div>
            <button className={navBtn(kind === 'all' && !folder && !tag && !collection && !category)} onClick={() => { setKind('all'); clearFilters(); }}>
              <Library className="h-3.5 w-3.5" /> Everything <span className="ml-auto text-body-s text-faint">{items.length}</span>
            </button>
            {(Object.keys(KIND_META) as Exclude<Kind, 'all'>[]).map((k) => {
              const M = KIND_META[k];
              return (
                <button key={k} className={navBtn(kind === k)} onClick={() => setKind(k)}>
                  <M.icon className="h-3.5 w-3.5" /> {M.label} <span className="ml-auto text-body-s text-faint">{items.filter((i) => i.ref.type === k).length}</span>
                </button>
              );
            })}
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between px-2.5">
              <span className="section-title">Collections</span>
              <IconButton icon={Plus} size="sm" label="New collection" onClick={() => setModal('collection')} />
            </div>
            {collections.length === 0 && <p className="px-2.5 text-body-s text-faint">Group related items — e.g. “Launch research”.</p>}
            {collections.map((c) => (
              <button key={c.id} className={navBtn(collection === c.id)} onClick={() => setCollection(collection === c.id ? null : c.id)}>
                <Layers className="h-3.5 w-3.5" /> <span className="truncate">{c.name}</span> <span className="ml-auto text-body-s text-faint">{c.items.length}</span>
              </button>
            ))}
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between px-2.5">
              <span className="section-title">Folders</span>
              <IconButton icon={FolderPlus} size="sm" label="New folder" onClick={() => setModal('folder')} />
            </div>
            {libFolders.length === 0 && <p className="px-2.5 text-body-s text-faint">No folders yet.</p>}
            {libFolders.map((f) => (
              <div key={f.id} className="group flex items-center">
                <button className={navBtn(folder === f.id)} onClick={() => setFolder(folder === f.id ? null : f.id)}>
                  <FolderIcon className="h-3.5 w-3.5" /> <span className="truncate">{f.name}</span>
                  <span className="ml-auto text-body-s text-faint">{items.filter((i) => i.folderId === f.id).length}</span>
                </button>
                <Menu
                  trigger={(t) => <IconButton icon={MoreHorizontal} size="sm" label="Folder actions" onClick={t} className="opacity-0 group-hover:opacity-100" />}
                  items={[
                    {
                      label: 'Rename',
                      onClick: async () => {
                        const name = window.prompt('Folder name', f.name);
                        if (name?.trim()) await update<Folder>('folders', f.id, { name: name.trim() }, { log: false });
                      },
                    },
                    {
                      label: 'Delete folder',
                      icon: Trash2,
                      danger: true,
                      onClick: async () => {
                        await softDelete('folders', f.id);
                        if (folder === f.id) setFolder(null);
                        toast('Folder deleted — its items are kept', { action: { label: 'Undo', onClick: () => restore('folders', f.id) } });
                      },
                    },
                  ]}
                />
              </div>
            ))}
          </div>
          {usedCategories.length > 0 && (
            <div>
              <div className="mb-1 px-2.5 section-title">Categories</div>
              {usedCategories.map((c) => (
                <button key={c} className={navBtn(category === c)} onClick={() => setCategory(category === c ? null : c)}>
                  <BookMarked className="h-3.5 w-3.5" /> {c}
                </button>
              ))}
            </div>
          )}
          {allTags.length > 0 && (
            <div>
              <div className="mb-1.5 px-2.5 section-title">Tags</div>
              <div className="flex flex-wrap gap-1 px-2">
                {allTags.map((t) => (
                  <button key={t} onClick={() => setTag(tag === t ? null : t)} className={cn('inline-flex items-center gap-0.5 rounded-full border px-2 h-[22px] text-body-s', tag === t ? 'border-accent bg-accent-soft text-accent-deep' : 'border-line text-muted hover:border-line-strong')}>
                    <Hash className="h-3 w-3" />
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </nav>

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the library" className="pl-8" />
            </div>
            {(folder || tag || collection || category) && (
              <Button size="sm" variant="ghost" icon={X} onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
          {activeCollection && (
            <div className="card mb-4 flex items-center gap-3 px-4 py-3">
              <Layers className="h-4 w-4 text-accent-deep" />
              <div className="min-w-0 flex-1">
                <div className="text-body-m font-semibold">{activeCollection.name}</div>
                {activeCollection.description && <div className="text-body-s text-muted">{activeCollection.description}</div>}
              </div>
              <Button
                size="sm"
                variant="ghost"
                icon={Trash2}
                onClick={async () => {
                  await softDelete('collections', activeCollection.id);
                  setCollection(null);
                  toast('Collection deleted — items are kept', { action: { label: 'Undo', onClick: () => restore('collections', activeCollection.id) } });
                }}
              >
                Delete collection
              </Button>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="card">
              <Empty icon={Library} title={items.length ? 'Nothing matches' : 'Your library is empty'}>
                {items.length ? 'Try a different filter or search.' : 'Write notes, save links and upload files (PDFs, images, anything). Everything stays on this device.'}
              </Empty>
            </div>
          ) : (
            <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((i) => {
                const M = KIND_META[i.ref.type as Exclude<Kind, 'all'>];
                return (
                  <article key={refKey(i.ref)} className="card group flex cursor-pointer flex-col p-3.5 transition-all hover:border-line-strong hover:shadow-xs" onClick={() => open(i)}>
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-sunken text-muted">
                        <M.icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-caption uppercase tracking-wide text-faint">{M.label.replace(/s$/, '')}</span>
                      {i.category && <Badge>{i.category}</Badge>}
                      {i.isDemo && <DemoBadge />}
                      <div className="flex-1" />
                      <div onClick={(e) => e.stopPropagation()}>
                        <Menu
                          width="w-56"
                          trigger={(t) => <IconButton icon={MoreHorizontal} size="sm" label="Item actions" onClick={t} className="opacity-50 group-hover:opacity-100" />}
                          items={[
                            ...(i.ref.type === 'bookmark' ? [{ label: 'Edit link', onClick: () => setEditingLink(bookmarks.find((b) => b.id === i.ref.id) ?? null) }] : []),
                            ...collections.map((c) => ({ label: `Add to “${c.name}”`, icon: Layers, onClick: () => addToCollection(c, i) })),
                            ...(activeCollection
                              ? [{ label: 'Remove from this collection', icon: X, onClick: () => update<Collection>('collections', activeCollection.id, { items: activeCollection.items.filter((x) => refKey(x) !== refKey(i.ref)) }, { log: false }) }]
                              : []),
                            ...(i.ref.type !== 'document'
                              ? libFolders.map((f) => ({ label: `Move to ${f.name}`, icon: FolderIcon, checked: i.folderId === f.id, onClick: () => update(tableFor(i.ref.type), i.ref.id, { folderId: f.id } as never, { log: false }) }))
                              : []),
                            'divider' as const,
                            {
                              label: 'Move to Trash',
                              icon: Trash2,
                              danger: true,
                              onClick: async () => {
                                await softDelete(tableFor(i.ref.type), i.ref.id);
                                toast('Moved to Trash', { action: { label: 'Undo', onClick: () => restore(tableFor(i.ref.type), i.ref.id) } });
                              },
                            },
                          ]}
                        />
                      </div>
                    </div>
                    <h3 className="mt-2.5 line-clamp-2 text-body-m font-medium leading-snug group-hover:text-accent-deep">{i.title}</h3>
                    {i.file?.mime.startsWith('image/') ? <Thumb file={i.file} /> : <p className="mt-1 line-clamp-2 text-body-s text-faint">{i.sub}</p>}
                    <div className="flex-1" />
                    <div className="mt-3 flex items-center gap-2">
                      <TagList tags={i.tags.slice(0, 3)} />
                      <span className="ml-auto text-caption text-faint">{timeAgo(i.updatedAt)}</span>
                      {i.url && <ExternalLink className="h-3 w-3 text-faint" />}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {(modal === 'link' || editingLink) && <LinkModal link={editingLink} folders={libFolders} categories={settings.noteCategories} defaultFolder={folder} onClose={() => { setModal(null); setEditingLink(null); }} />}
      {modal === 'collection' && <NameModal title="New collection" withDescription onSave={async (name, description) => { const c = await create<Collection>('collections', { name, description, items: [] }); setCollection(c.id); }} onClose={() => setModal(null)} />}
      {modal === 'folder' && <NameModal title="New folder" onSave={async (name) => { await create<Folder>('folders', { name, scope: 'library' }); }} onClose={() => setModal(null)} />}
    </Page>
  );
}

function Thumb({ file }: { file: StoredFile }) {
  const [url] = useState(() => URL.createObjectURL(file.blob));
  return <img src={url} alt={file.name} className="mt-2 h-28 w-full rounded-sm border border-line object-cover" onLoad={() => setTimeout(() => URL.revokeObjectURL(url), 30000)} />;
}

function NameModal({ title, onSave, onClose, withDescription }: { title: string; onSave: (name: string, description?: string) => Promise<void>; onClose: () => void; withDescription?: boolean }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const save = async () => {
    if (!name.trim()) return;
    await onSave(name.trim(), desc.trim() || undefined);
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      width="max-w-sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!name.trim()}>
            Create
          </Button>
        </>
      }
    >
      <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" onKeyDown={(e) => e.key === 'Enter' && save()} />
      {withDescription && <Textarea className="mt-2" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)" />}
    </Modal>
  );
}

function LinkModal({ link, folders, categories, defaultFolder, onClose }: { link: Bookmark | null; folders: Folder[]; categories: string[]; defaultFolder: string | null; onClose: () => void }) {
  const [b, setB] = useState<Partial<Bookmark>>(link ?? { title: '', url: '', tags: [], folderId: defaultFolder, refs: [] });
  const set = (p: Partial<Bookmark>) => setB((x) => ({ ...x, ...p }));
  const save = async () => {
    if (!b.url?.trim()) return;
    const url = /^https?:\/\//i.test(b.url.trim()) ? b.url.trim() : `https://${b.url.trim()}`;
    const data = { ...b, url, title: b.title?.trim() || url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0], tags: b.tags ?? [], refs: b.refs ?? [] };
    if (link) await update<Bookmark>('bookmarks', link.id, data);
    else await create<Bookmark>('bookmarks', data as Bookmark);
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={link ? 'Edit link' : 'Save a link'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!b.url?.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="URL">
          <Input autoFocus value={b.url ?? ''} onChange={(e) => set({ url: e.target.value })} placeholder="https://" />
        </Field>
        <Field label="Title" hint="Work OS doesn't fetch pages, so add a title yourself (or leave blank to use the domain).">
          <Input value={b.title ?? ''} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label="Why it's useful">
          <Textarea rows={2} value={b.description ?? ''} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Folder">
            <Select value={b.folderId ?? ''} onChange={(e) => set({ folderId: e.target.value || null })}>
              <option value="">No folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Category">
            <Select value={b.category ?? ''} onChange={(e) => set({ category: e.target.value || null })}>
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Tags">
          <TagInput value={b.tags ?? []} onChange={(tags) => set({ tags })} />
        </Field>
      </div>
    </Modal>
  );
}
