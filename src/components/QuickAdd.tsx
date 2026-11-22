import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, CheckSquare, FileText, FolderKanban, Lightbulb, Megaphone, NotebookPen, Sparkles } from 'lucide-react';
import { useApp, type QuickAddPreset, type QuickAddType } from '@/app/context';
import { create, newTask } from '@/lib/repo';
import { createProjectFromTemplate } from '@/lib/templates';
import { useTemplates } from '@/lib/hooks';
import { EVENT_KINDS, PRIORITIES } from '@/lib/domain';
import type { CalEvent, Campaign, ContentItem, Doc, EventKind, Idea, Note, Priority } from '@/lib/types';
import { cn, todayISO } from '@/lib/utils';
import { Button, Field, Input, Kbd, Modal, Select } from './ui';
import { ProjectSelect } from './pickers';
import { useFeedback } from './feedback';

const TYPES: { value: QuickAddType; label: string; icon: typeof CheckSquare }[] = [
  { value: 'task', label: 'Task', icon: CheckSquare },
  { value: 'idea', label: 'Idea', icon: Lightbulb },
  { value: 'note', label: 'Note', icon: NotebookPen },
  { value: 'project', label: 'Project', icon: FolderKanban },
  { value: 'content', label: 'Content', icon: Sparkles },
  { value: 'campaign', label: 'Campaign', icon: Megaphone },
  { value: 'event', label: 'Event', icon: CalendarDays },
  { value: 'document', label: 'Document', icon: FileText },
];

export function QuickAdd({ preset, onClose }: { preset: QuickAddPreset; onClose: () => void }) {
  const { settings, openTask, openContent } = useApp();
  const { toast } = useFeedback();
  const navigate = useNavigate();
  const templates = useTemplates();
  const [type, setType] = useState<QuickAddType>(preset.type ?? 'task');
  const [title, setTitle] = useState(preset.title ?? '');
  const [date, setDate] = useState(preset.date ?? '');
  const [time, setTime] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [projectId, setProjectId] = useState<string | null>(preset.projectId ?? null);
  const [templateId, setTemplateId] = useState('');
  const [platform, setPlatform] = useState(settings.platforms[0] ?? 'LinkedIn');
  const [kind, setKind] = useState<EventKind>('meeting');
  const [busy, setBusy] = useState(false);

  const submit = async (openAfter = false) => {
    if (!title.trim() || busy) return;
    setBusy(true);
    const t = title.trim();
    try {
      switch (type) {
        case 'task': {
          const task = await newTask({ title: t, dueDate: date || null, priority, projectId, campaignId: preset.campaignId ?? null });
          toast('Task added', { action: { label: 'Open', onClick: () => openTask(task.id) } });
          if (openAfter) openTask(task.id);
          break;
        }
        case 'idea': {
          await create<Idea>('ideas', { text: t, status: 'inbox', tags: [] });
          toast('Idea captured', { action: { label: 'View', onClick: () => navigate('/ideas') } });
          if (openAfter) navigate('/ideas');
          break;
        }
        case 'note': {
          const n = await create<Note>('notes', { title: t, body: '', kind: 'note', tags: [], refs: projectId ? [{ type: 'project', id: projectId }] : [] });
          navigate(`/notes/${n.id}`);
          break;
        }
        case 'document': {
          const d = await create<Doc>('documents', { title: t, body: '', docType: 'other', status: 'draft', tags: [], refs: projectId ? [{ type: 'project', id: projectId }] : [] });
          navigate(`/documents/${d.id}`);
          break;
        }
        case 'project': {
          const tpl = templates?.find((x) => x.id === templateId) ?? null;
          const p = await createProjectFromTemplate(tpl, { title: t, deadline: date || null });
          navigate(`/projects/${p.id}`);
          break;
        }
        case 'content': {
          const c = await create<ContentItem>('content', {
            title: t,
            platform,
            contentType: settings.contentTypes[0] ?? 'Post',
            status: 'idea',
            publishDate: date || null,
            referenceLinks: [],
            metrics: {},
            tags: [],
            projectId,
            campaignId: preset.campaignId ?? null,
          });
          toast('Content item added', { action: { label: 'Open', onClick: () => openContent(c.id) } });
          if (openAfter) openContent(c.id);
          break;
        }
        case 'campaign': {
          const c = await create<Campaign>('campaigns', {
            name: t,
            status: 'planning',
            startDate: date || null,
            activities: [],
            mediaLinks: [],
            tags: [],
            projectId,
            currency: settings.currency,
          });
          navigate(`/campaigns/${c.id}`);
          break;
        }
        case 'event': {
          await create<CalEvent>('events', { title: t, kind, date: date || todayISO(), startTime: time || null, endTime: null });
          toast('Added to calendar', { action: { label: 'View', onClick: () => navigate('/calendar') } });
          break;
        }
      }
      onClose();
    } catch (e) {
      toast(`Could not save: ${(e as Error).message}`, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const placeholder: Record<QuickAddType, string> = {
    task: 'What needs doing?',
    idea: 'Capture the thought…',
    note: 'Note title',
    project: 'Project name',
    content: 'Working title for the post',
    campaign: 'Campaign name',
    event: 'Event title',
    document: 'Document title',
  };

  const opensPage = ['note', 'document', 'project', 'campaign'].includes(type);

  return (
    <Modal open onClose={onClose} width="max-w-xl">
      <div className="pt-4">
        <div className="flex flex-wrap gap-1 mb-3">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={cn(
                'flex items-center gap-1.5 rounded-sm px-2 h-7 text-body-s transition-colors',
                type === t.value ? 'bg-accent-soft text-accent-deep font-medium' : 'text-muted hover:bg-sunken',
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={placeholder[type]}
            className="w-full bg-transparent py-2 text-h4 font-medium outline-none placeholder:text-faint"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void submit(true);
              }
            }}
          />
          {type !== 'idea' && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {['task', 'content', 'campaign', 'event', 'project'].includes(type) && (
                <Field label={type === 'project' ? 'Deadline' : type === 'campaign' ? 'Start date' : type === 'content' ? 'Publish date' : type === 'event' ? 'Date' : 'Due date'}>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
              )}
              {type === 'task' && (
                <Field label="Priority">
                  <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                    {PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              {['task', 'note', 'content', 'campaign', 'document'].includes(type) && (
                <Field label="Project">
                  <ProjectSelect value={projectId} onChange={setProjectId} />
                </Field>
              )}
              {type === 'project' && (
                <Field label="Template" className="col-span-2">
                  <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                    <option value="">Blank project</option>
                    {(templates ?? []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.builtIn ? '' : ' (custom)'}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              {type === 'content' && (
                <Field label="Platform">
                  <Select value={platform} onChange={(e) => setPlatform(e.target.value)}>
                    {settings.platforms.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </Select>
                </Field>
              )}
              {type === 'event' && (
                <>
                  <Field label="Time">
                    <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                  </Field>
                  <Field label="Type">
                    <Select value={kind} onChange={(e) => setKind(e.target.value as EventKind)}>
                      {EVENT_KINDS.map((k) => (
                        <option key={k.value} value={k.value}>
                          {k.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </>
              )}
            </div>
          )}
          {type === 'idea' && <p className="mt-1 text-body-s text-faint">Ideas land in your inbox uncategorised. You decide what they become.</p>}
          <div className="mt-5 flex items-center justify-between gap-2 border-t border-line pt-3">
            <span className="hidden sm:flex items-center gap-1.5 text-caption text-faint">
              <Kbd>Enter</Kbd> save {!opensPage && (<><Kbd>⌘ Enter</Kbd> save & open</>)} <Kbd>Esc</Kbd> close
            </span>
            <div className="flex gap-2 ml-auto">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={!title.trim() || busy}>
                {opensPage ? `Create ${TYPES.find((t) => t.value === type)!.label.toLowerCase()}` : 'Save'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}
