import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, ArrowRightLeft, CheckSquare, FolderKanban, Inbox, Lightbulb, Megaphone, MoreHorizontal, NotebookPen, Pencil, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import { useIdeas } from '@/lib/hooks';
import { create, newTask, restore, softDelete, update, logActivity } from '@/lib/repo';
import { ENTITY } from '@/lib/entities';
import type { Campaign, ContentIdea, EntityRef, Idea, Note } from '@/lib/types';
import { timeAgo } from '@/lib/utils';
import { createProjectFromTemplate } from '@/lib/templates';
import { Badge, Button, DemoBadge, Empty, Field, IconButton, Loading, Menu, Modal, Page, PageHeader, Select, Tabs, Textarea } from '@/components/ui';
import { TagList } from '@/components/pickers';
import { useFeedback } from '@/components/feedback';
import { useApp } from '@/app/context';

type ConvertTarget = 'task' | 'project' | 'contentIdea' | 'note' | 'campaign';
const TARGETS: { value: ConvertTarget; label: string; icon: typeof CheckSquare; hint: string }[] = [
  { value: 'task', label: 'Task', icon: CheckSquare, hint: 'Something to do' },
  { value: 'project', label: 'Project', icon: FolderKanban, hint: 'A bigger initiative' },
  { value: 'contentIdea', label: 'Content idea', icon: Sparkles, hint: 'Goes to the Content idea bank' },
  { value: 'note', label: 'Note', icon: NotebookPen, hint: 'Develop the thinking' },
  { value: 'campaign', label: 'Campaign', icon: Megaphone, hint: 'A PR or marketing campaign' },
];

export default function IdeasPage() {
  const ideas = useIdeas();
  const { settings, openTask } = useApp();
  const { toast } = useFeedback();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Idea['status']>('inbox');
  const [text, setText] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [converting, setConverting] = useState<Idea | null>(null);
  const [editing, setEditing] = useState<Idea | null>(null);

  const list = useMemo(
    () => (ideas ?? []).filter((i) => i.status === tab && (category === 'all' || (category === 'none' ? !i.category : i.category === category))).sort((a, b) => b.createdAt - a.createdAt),
    [ideas, tab, category],
  );
  if (!ideas) return <Loading />;

  const capture = async () => {
    if (!text.trim()) return;
    const [first, ...rest] = text.trim().split('\n');
    await create<Idea>('ideas', { text: first, details: rest.join('\n').trim() || undefined, status: 'inbox', tags: [] });
    setText('');
  };

  const convert = async (idea: Idea, target: ConvertTarget) => {
    let ref: EntityRef;
    const details = idea.details ?? '';
    switch (target) {
      case 'task': {
        const t = await newTask({ title: idea.text, description: details, tags: idea.tags });
        ref = { type: 'task', id: t.id };
        break;
      }
      case 'project': {
        const p = await createProjectFromTemplate(null, { title: idea.text, description: details });
        ref = { type: 'project', id: p.id };
        break;
      }
      case 'contentIdea': {
        const c = await create<ContentIdea>('contentIdeas', { kind: 'post', text: idea.text + (details ? `\n\n${details}` : ''), tags: idea.tags });
        ref = { type: 'contentIdea', id: c.id };
        break;
      }
      case 'note': {
        const n = await create<Note>('notes', { title: idea.text, body: details, kind: 'note', tags: idea.tags, refs: [] });
        ref = { type: 'note', id: n.id };
        break;
      }
      case 'campaign': {
        const c = await create<Campaign>('campaigns', { name: idea.text, description: details, status: 'planning', activities: [], mediaLinks: [], tags: idea.tags, currency: settings.currency });
        ref = { type: 'campaign', id: c.id };
        break;
      }
    }
    await update<Idea>('ideas', idea.id, { status: 'converted', convertedTo: ref }, { log: false });
    await logActivity({ entity: 'idea', entityId: idea.id, action: 'converted', title: idea.text, detail: ENTITY[ref.type].label });
    setConverting(null);
    toast(`Converted to ${ENTITY[ref.type].label.toLowerCase()}`, {
      action: { label: 'Open', onClick: () => (ref.type === 'task' ? openTask(ref.id) : navigate(ENTITY[ref.type].route(ref.id))) },
    });
  };

  const counts = { inbox: ideas.filter((i) => i.status === 'inbox').length, converted: ideas.filter((i) => i.status === 'converted').length, archived: ideas.filter((i) => i.status === 'archived').length };

  return (
    <Page>
      <PageHeader title="Ideas" subtitle="A fast, low-pressure inbox for thoughts. Nothing is categorised unless you decide to." />

      <div className="card mb-6 p-3">
        <Textarea
          autoGrow
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void capture();
            }
          }}
          placeholder="What's on your mind?  (Enter to save · Shift+Enter for a new line — extra lines become details)"
          className="!border-0 !bg-transparent !px-1 !ring-0 text-body-l"
        />
        <div className="flex justify-end">
          <Button variant="primary" size="sm" icon={Lightbulb} onClick={capture} disabled={!text.trim()}>
            Capture
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'inbox', label: 'Inbox', icon: Inbox, count: counts.inbox },
            { value: 'converted', label: 'Converted', icon: ArrowRightLeft, count: counts.converted },
            { value: 'archived', label: 'Archived', icon: Archive, count: counts.archived },
          ]}
        />
        <div className="flex-1" />
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-44" aria-label="Category filter">
          <option value="all">All categories</option>
          <option value="none">Uncategorised</option>
          {settings.ideaCategories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </div>

      {list.length === 0 ? (
        <div className="card">
          <Empty icon={Lightbulb} title={tab === 'inbox' ? 'Inbox zero' : `No ${tab} ideas`}>
            {tab === 'inbox' ? 'Capture anything — a project, a post, something to investigate. Decide later what it becomes.' : undefined}
          </Empty>
        </div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {list.map((i) => (
            <article key={i.id} className="card group flex flex-col p-3.5">
              <div className="flex items-start gap-2">
                <p className="flex-1 whitespace-pre-wrap text-body-m leading-snug">{i.text}</p>
                <Menu
                  trigger={(t) => <IconButton icon={MoreHorizontal} size="sm" label="Idea actions" onClick={t} className="opacity-60 group-hover:opacity-100" />}
                  items={[
                    { label: 'Edit', icon: Pencil, onClick: () => setEditing(i) },
                    ...(i.status === 'inbox'
                      ? [{ label: 'Archive', icon: Archive, onClick: () => update<Idea>('ideas', i.id, { status: 'archived' }, { log: false }) }]
                      : [{ label: 'Move back to inbox', icon: RotateCcw, onClick: () => update<Idea>('ideas', i.id, { status: 'inbox' }, { log: false }) }]),
                    'divider' as const,
                    {
                      label: 'Delete',
                      icon: Trash2,
                      danger: true,
                      onClick: async () => {
                        await softDelete('ideas', i.id);
                        toast('Idea deleted', { action: { label: 'Undo', onClick: () => restore('ideas', i.id) } });
                      },
                    },
                  ]}
                />
              </div>
              {i.details && <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-body-s text-muted">{i.details}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {i.category && <Badge tone="accent">{i.category}</Badge>}
                <TagList tags={i.tags} />
                {i.isDemo && <DemoBadge />}
                <span className="text-caption text-faint">{timeAgo(i.createdAt)}</span>
                <div className="flex-1" />
                {i.status === 'inbox' && (
                  <Button size="xs" icon={ArrowRightLeft} onClick={() => setConverting(i)}>
                    Convert
                  </Button>
                )}
                {i.status === 'converted' && i.convertedTo && (
                  <button className="text-body-s text-accent-deep hover:underline" onClick={() => (i.convertedTo!.type === 'task' ? openTask(i.convertedTo!.id) : navigate(ENTITY[i.convertedTo!.type].route(i.convertedTo!.id)))}>
                    → {ENTITY[i.convertedTo.type].label}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={!!converting} onClose={() => setConverting(null)} title="Convert idea" description={converting?.text}>
        <div className="grid gap-2">
          {TARGETS.map((t) => (
            <button key={t.value} onClick={() => converting && convert(converting, t.value)} className="flex items-center gap-3 rounded-md border border-line p-3 text-left hover:border-accent hover:bg-accent-soft/30">
              <t.icon className="h-4 w-4 text-accent-deep" />
              <span className="flex-1">
                <span className="block text-body-m font-medium">{t.label}</span>
                <span className="block text-body-s text-muted">{t.hint}</span>
              </span>
            </button>
          ))}
          <p className="mt-1 text-body-s text-faint">The idea moves to “Converted” and keeps a link to what it became.</p>
        </div>
      </Modal>

      {editing && <EditIdea idea={editing} categories={settings.ideaCategories} onClose={() => setEditing(null)} />}
    </Page>
  );
}

function EditIdea({ idea, categories, onClose }: { idea: Idea; categories: string[]; onClose: () => void }) {
  const [text, setText] = useState(idea.text);
  const [details, setDetails] = useState(idea.details ?? '');
  const [cat, setCat] = useState(idea.category ?? '');
  return (
    <Modal
      open
      onClose={onClose}
      title="Edit idea"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              await update<Idea>('ideas', idea.id, { text: text.trim() || idea.text, details, category: cat || null });
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Idea">
          <Textarea autoGrow rows={2} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <Field label="Details">
          <Textarea autoGrow rows={4} value={details} onChange={(e) => setDetails(e.target.value)} />
        </Field>
        <Field label="Category (optional)" hint="Categories are only ever set by you. Edit the list in Settings → Customise.">
          <Select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Uncategorised</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

