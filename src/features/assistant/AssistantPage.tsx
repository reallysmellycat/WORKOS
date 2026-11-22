import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, ArrowUp, Bot, CheckSquare, Copy, Eye, FileText, Lightbulb, MessageSquarePlus, NotebookPen, Plus, Settings2, ShieldCheck, Sparkles, Square, Trash2, X } from 'lucide-react';
import { db } from '@/lib/db';
import { createProvider, SYSTEM_PROMPT } from '@/lib/ai';
import { create, newTask, softDelete, update } from '@/lib/repo';
import { ENTITY, refKey } from '@/lib/entities';
import { searchAll, type SearchHit } from '@/lib/search';
import { isOverdue, sortByScore } from '@/lib/domain';
import type { AIConversation, ChatMessage, Doc, EntityRef, Note } from '@/lib/types';
import { addDaysISO, cn, daysUntil, timeAgo, todayISO } from '@/lib/utils';
import { Badge, Button, Card, Checkbox, IconButton, Modal, Spinner } from '@/components/ui';
import { EntitySearch, useRefTitles } from '@/components/pickers';
import { MarkdownView } from '@/components/Markdown';
import { useFeedback } from '@/components/feedback';
import { useApp } from '@/app/context';
import { PRESETS, QUICK_ACTIONS, serializePreset, serializeRef, type Preset } from './context';

export default function AssistantPage() {
  const { settings } = useApp();
  const enabled = settings.ai.provider !== 'none';
  return enabled ? <Chat /> : <NoAI />;
}

function NoAI() {
  return (
    <div className="w-full px-gutter pb-24 pt-10">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-h4 font-semibold tracking-tight">
          <Bot className="h-5 w-5 text-faint" /> AI Assistant
        </h1>
        <p className="mt-1 text-body-s text-muted">Optional. Everything in Work OS works without it.</p>
      </div>
      <div className="card mb-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-deep">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1 text-body-m leading-relaxed">
          <div className="font-medium">No AI provider is connected</div>
          <div className="text-muted">
            To draft posts, summarise projects and plan with AI, connect a free model. The most private option is <strong>Ollama</strong>, which runs on your own computer at no cost. Free online tiers (Groq, OpenRouter, Google AI Studio) also work with your own free key.
          </div>
        </div>
        <Link to="/settings?tab=ai">
          <Button variant="primary" icon={Settings2}>
            Set up AI
          </Button>
        </Link>
      </div>
      <LocalInsights />
    </div>
  );
}

/** Rule-based insights that work without any AI provider. */
function LocalInsights() {
  const { openTask } = useApp();
  const data = useLiveQuery(async () => {
    const tasks = (await db.tasks.toArray()).filter((t) => !t.deletedAt);
    const projects = (await db.projects.toArray()).filter((p) => !p.deletedAt && p.status !== 'completed');
    const content = (await db.content.toArray()).filter((c) => !c.deletedAt);
    const ideas = (await db.ideas.toArray()).filter((i) => !i.deletedAt && i.status === 'inbox');
    const activity = await db.activity.toArray();
    const open = tasks.filter((t) => t.status !== 'completed' && !t.parentId);
    const lastTouch = (id: string) => Math.max(0, ...activity.filter((a) => a.entityId === id).map((a) => a.at));
    const stale = projects.filter((p) => p.status === 'in_progress' && Date.now() - Math.max(p.updatedAt, lastTouch(p.id), ...tasks.filter((t) => t.projectId === p.id).map((t) => t.updatedAt)) > 14 * 86400000);
    const nextWeek = content.filter((c) => c.publishDate && c.publishDate >= todayISO() && c.publishDate <= addDaysISO(todayISO(), 7));
    const atRisk = projects.filter((p) => {
      const d = daysUntil(p.deadline);
      return d !== null && d >= 0 && d <= 14 && tasks.filter((t) => t.projectId === p.id && t.status !== 'completed').length > 3;
    });
    return { overdue: open.filter(isOverdue), priorities: sortByScore(open).slice(0, 5), stale, nextWeek, ideas, atRisk, waiting: open.filter((t) => t.status === 'waiting') };
  }, []);
  if (!data) return null;
  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-body-s font-semibold">
        <Lightbulb className="h-3.5 w-3.5 text-faint" /> Insights from your data <Badge>No AI — simple rules</Badge>
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Suggested priorities">
          {data.priorities.length ? (
            data.priorities.map((t) => (
              <button key={t.id} onClick={() => openTask(t.id)} className="-mx-1.5 block w-full truncate rounded-sm px-1.5 py-1 text-left text-body-s row-hover">
                {t.title} <span className="text-body-s text-faint">· {t.priority}{t.dueDate ? `, due ${t.dueDate}` : ''}</span>
              </button>
            ))
          ) : (
            <p className="text-body-s text-faint">No open tasks.</p>
          )}
          <p className="mt-2 text-caption text-faint">Ranked by overdue status, due date, priority and whether it's in progress.</p>
        </Card>
        <Card title={`Overdue · ${data.overdue.length}`}>
          {data.overdue.length ? data.overdue.slice(0, 6).map((t) => <button key={t.id} onClick={() => openTask(t.id)} className="-mx-1.5 block w-full truncate rounded-sm px-1.5 py-1 text-left text-body-s text-danger row-hover">{t.title}</button>) : <p className="text-body-s text-faint">Nothing overdue.</p>}
          {data.overdue.length > 3 && <p className="mt-2 text-body-s text-muted">Consider rescheduling or dropping some — a long overdue list hides what matters.</p>}
        </Card>
        <Card title="Projects needing attention">
          {data.stale.length === 0 && data.atRisk.length === 0 && <p className="text-body-s text-faint">All active projects have recent activity.</p>}
          {data.atRisk.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`} className="block py-1 text-body-s hover:text-accent-deep">
              <AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-warn" />
              {p.title} — deadline soon with several open tasks
            </Link>
          ))}
          {data.stale.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`} className="block py-1 text-body-s hover:text-accent-deep">
              {p.title} — no activity for 2+ weeks
            </Link>
          ))}
        </Card>
        <Card title="Pipeline check">
          <ul className="space-y-1.5 text-body-s">
            <li>{data.nextWeek.length ? `${data.nextWeek.length} content item(s) planned for the next 7 days.` : 'No content planned for the next 7 days.'}</li>
            <li>{data.ideas.length ? `${data.ideas.length} idea(s) waiting in your inbox.` : 'Ideas inbox is clear.'}</li>
            <li>{data.waiting.length ? `${data.waiting.length} task(s) waiting on others — worth a follow-up?` : 'Nothing marked as waiting.'}</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Chat() {
  const { settings } = useApp();
  const { toast } = useFeedback();
  const navigate = useNavigate();
  const conversations = useLiveQuery(async () => (await db.conversations.toArray()).filter((c) => !c.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt), []);
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [context, setContext] = useState<EntityRef[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; hint?: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState<{ title: string; on: boolean }[] | null>(null);
  const [suggest, setSuggest] = useState<SearchHit[]>([]);
  const abort = useRef<AbortController | null>(null);
  const acc = useRef('');
  const [showCtx, setShowCtx] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const refTitles = useRefTitles(context) ?? [];
  const isLocal = /localhost|127\.0\.0\.1/.test(settings.ai.baseUrl);

  // Block body on purpose: scrollIntoView() returns a Promise in newer browsers,
  // which React would otherwise treat as an effect clean-up function.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  // Context-aware suggestions: items related to what you're typing (you still choose).
  useEffect(() => {
    const q = input.trim();
    if (q.length < 4) return setSuggest([]);
    const t = setTimeout(async () => {
      const words = q.split(/\s+/).filter((w) => w.length > 3).slice(0, 4);
      const hits: SearchHit[] = [];
      for (const w of words) for (const h of await searchAll(w, 4, ['project', 'campaign', 'note', 'document', 'content'])) if (!hits.some((x) => x.id === h.id)) hits.push(h);
      setSuggest(hits.filter((h) => !context.some((c) => c.id === h.id)).slice(0, 4));
    }, 350);
    return () => clearTimeout(t);
  }, [input, context]);

  const loadConv = (c: AIConversation) => {
    setConvId(c.id);
    setMessages(c.messages);
    setContext(c.context);
    setError(null);
  };
  const newChat = () => {
    setConvId(null);
    setMessages([]);
    setContext([]);
    setPresets([]);
    setError(null);
  };

  const buildContext = async () => {
    const parts = [...(await Promise.all(context.map(serializeRef))), ...(await Promise.all(presets.map(serializePreset)))].filter(Boolean);
    return parts.length ? `Today is ${todayISO()}. Context the user chose to share:\n\n${parts.join('\n\n---\n\n')}` : `Today is ${todayISO()}. The user has not shared any items from their workspace.`;
  };

  const send = async (text = input) => {
    if (!text.trim() || busy) return;
    const provider = createProvider(settings.ai);
    if (!provider) return;
    setError(null);
    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setBusy(true);
    setStreaming('');
    acc.current = '';
    abort.current = new AbortController();
    try {
      const ctx = await buildContext();
      const reply = await provider.chat([{ role: 'system', content: `${SYSTEM_PROMPT}\n\n${ctx}` }, ...history], { signal: abort.current.signal, onToken: (t) => {
          acc.current += t;
          setStreaming(acc.current);
        } });
      const final = [...history, { role: 'assistant' as const, content: reply }];
      setMessages(final);
      const title = history[0].content.slice(0, 60);
      if (convId) await update<AIConversation>('conversations', convId, { messages: final, context }, { log: false });
      else setConvId((await create<AIConversation>('conversations', { title, messages: final, context }, { log: false })).id);
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        if (acc.current) setMessages((m) => [...m, { role: 'assistant', content: acc.current + '\n\n_(stopped)_' }]);
      } else {
        const err = e as Error & { hint?: string };
        setError({ text: err.message, hint: err.hint });
      }
    } finally {
      setStreaming('');
      setBusy(false);
    }
  };

  const saveAs = async (kind: 'note' | 'document', content: string) => {
    const title = (content.match(/^#\s+(.+)$/m)?.[1] ?? messages.find((m) => m.role === 'user')?.content ?? 'AI draft').slice(0, 80);
    if (kind === 'note') {
      const n = await create<Note>('notes', { title, body: content, kind: 'note', tags: ['ai-draft'], refs: context.filter((c) => ['project', 'campaign', 'task', 'content'].includes(c.type)) });
      toast('Saved as a note', { action: { label: 'Open', onClick: () => navigate(`/notes/${n.id}`) } });
    } else {
      const d = await create<Doc>('documents', { title, body: content, docType: 'other', status: 'draft', tags: ['ai-draft'], refs: context.filter((c) => ['project', 'campaign', 'task'].includes(c.type)) });
      toast('Saved as a document', { action: { label: 'Open', onClick: () => navigate(`/documents/${d.id}`) } });
    }
  };

  const proposeTasks = (content: string) => {
    const items = [...content.matchAll(/^\s*[-*]\s+\[ \]\s+(.+)$/gm)].map((m) => m[1].trim());
    const fallback = items.length ? items : [...content.matchAll(/^\s*(?:[-*]|\d+\.)\s+(.+)$/gm)].map((m) => m[1].replace(/\*\*/g, '').trim()).slice(0, 15);
    if (!fallback.length) return toast('No list items found to turn into tasks', { tone: 'info' });
    setTaskDraft(fallback.map((title) => ({ title, on: true })));
  };

  const projectInContext = context.find((c) => c.type === 'project')?.id ?? null;

  const contextPanel = (
    <>
        <div className="mb-2 flex items-center gap-1.5 text-body-s font-semibold">
          <ShieldCheck className="h-3.5 w-3.5 text-accent-deep" /> What the assistant can see
        </div>
        <p className="mb-3 text-body-s leading-relaxed text-muted">Nothing from your workspace is shared unless you add it here.</p>
        <div className="space-y-1">
          {refTitles.map(({ ref, title }) => (
            <div key={refKey(ref)} className="group flex items-center gap-2 rounded-sm bg-raised px-2 py-1.5">
              <span className="w-14 shrink-0 text-caption uppercase tracking-wide text-faint">{ENTITY[ref.type].label}</span>
              <span className="flex-1 truncate text-body-s">{title}</span>
              <IconButton icon={X} size="sm" label="Remove" onClick={() => setContext((c) => c.filter((x) => refKey(x) !== refKey(ref)))} />
            </div>
          ))}
          {presets.map((p) => (
            <div key={p} className="flex items-center gap-2 rounded-sm bg-raised px-2 py-1.5">
              <span className="w-14 shrink-0 text-caption uppercase tracking-wide text-faint">Summary</span>
              <span className="flex-1 truncate text-body-s">{PRESETS.find((x) => x.key === p)?.label}</span>
              <IconButton icon={X} size="sm" label="Remove" onClick={() => setPresets((x) => x.filter((y) => y !== p))} />
            </div>
          ))}
        </div>
        <div className="mt-2">
          {adding ? (
            <EntitySearch types={['project', 'campaign', 'task', 'note', 'document', 'content', 'idea', 'file', 'pressRelease']} onPick={(r) => { if (!context.some((c) => refKey(c) === refKey(r))) setContext((c) => [...c, r]); setAdding(false); }} onCancel={() => setAdding(false)} />
          ) : (
            <Button size="sm" icon={Plus} className="w-full" onClick={() => setAdding(true)}>
              Add an item
            </Button>
          )}
        </div>
        <div className="mt-4">
          <div className="mb-1 section-title">Summaries</div>
          {PRESETS.map((p) => (
            <label key={p.key} className="flex cursor-pointer items-start gap-2 rounded-sm px-1 py-1.5 hover:bg-sunken/60">
              <input type="checkbox" checked={presets.includes(p.key)} onChange={(e) => setPresets((x) => (e.target.checked ? [...x, p.key] : x.filter((y) => y !== p.key)))} className="mt-0.5 accent-[rgb(var(--accent))]" />
              <span>
                <span className="block text-body-s">{p.label}</span>
                <span className="block text-caption text-faint">{p.description}</span>
              </span>
            </label>
          ))}
        </div>
        <Button size="sm" variant="ghost" icon={Eye} className="mt-3 w-full" onClick={async () => setPreview(await buildContext())}>
          Preview exactly what's sent
        </Button>
        {!isLocal && <p className="mt-3 rounded-sm bg-warn/10 px-2.5 py-2 text-caption leading-relaxed text-warn">Online provider: shared context leaves this device when you send a message.</p>}
    </>
  );

  return (
    <div className="flex h-[calc(100dvh-var(--nav-height))]">
      <aside className="hidden w-[230px] shrink-0 flex-col border-r border-line bg-surface/50 lg:flex">
        <div className="p-3">
          <Button className="w-full" icon={MessageSquarePlus} onClick={newChat}>
            New chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {(conversations ?? []).map((c) => (
            <div key={c.id} className={cn('group flex items-center rounded-sm', c.id === convId ? 'bg-sunken' : 'hover:bg-sunken/60')}>
              <button onClick={() => loadConv(c)} className="min-w-0 flex-1 px-2.5 py-2 text-left">
                <div className="truncate text-body-s">{c.title}</div>
                <div className="text-caption text-faint">{timeAgo(c.updatedAt)}</div>
              </button>
              <IconButton
                icon={Trash2}
                size="sm"
                label="Delete chat"
                className="mr-1 opacity-0 group-hover:opacity-100"
                onClick={async () => {
                  await softDelete('conversations', c.id);
                  if (c.id === convId) newChat();
                }}
              />
            </div>
          ))}
          {conversations && !conversations.length && <p className="px-2.5 text-body-s text-faint">Chats are saved on this device.</p>}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[760px] px-4 py-6 sm:px-6">
            {messages.length === 0 && !busy ? (
              <div className="pt-6">
                <h1 className="font-serif text-h2 font-medium tracking-tight">How can I help?</h1>
                <p className="mt-1 text-body-s text-muted">
                  Using <strong>{settings.ai.model}</strong> via {settings.ai.provider === 'ollama' ? 'Ollama' : settings.ai.baseUrl.replace(/^https?:\/\//, '').split('/')[0]}.{' '}
                  {isLocal ? 'Runs on your computer — nothing leaves this device.' : 'Online provider — only the context you add on the right is sent.'}
                </p>
                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  {QUICK_ACTIONS.map((a) => (
                    <button
                      key={a.label}
                      onClick={() => {
                        if (a.preset && !presets.includes(a.preset)) setPresets((p) => [...p, a.preset!]);
                        setInput(a.prompt);
                      }}
                      className="rounded-md border border-line bg-surface p-3 text-left hover:border-accent hover:bg-accent-soft/30"
                    >
                      <div className="text-body-m font-medium">{a.label}</div>
                      {a.needs && <div className="mt-0.5 text-body-s text-faint">{a.needs}</div>}
                      {a.preset && <div className="mt-0.5 text-body-s text-faint">Adds “{PRESETS.find((p) => p.key === a.preset)?.label}” to context.</div>}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((m, i) => (
                  <div key={i} className={cn(m.role === 'user' && 'flex justify-end')}>
                    {m.role === 'user' ? (
                      <div className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-sunken px-4 py-2.5 text-body-m">{m.content}</div>
                    ) : (
                      <div>
                        <div className="mb-1.5 flex items-center gap-1.5 text-body-s text-faint">
                          <Bot className="h-3.5 w-3.5" /> Assistant · draft
                        </div>
                        <MarkdownView source={m.content} />
                        <div className="mt-2 flex flex-wrap gap-1">
                          <Button size="xs" variant="ghost" icon={Copy} onClick={() => { void navigator.clipboard.writeText(m.content); toast('Copied'); }}>
                            Copy
                          </Button>
                          <Button size="xs" variant="ghost" icon={NotebookPen} onClick={() => saveAs('note', m.content)}>
                            Save as note
                          </Button>
                          <Button size="xs" variant="ghost" icon={FileText} onClick={() => saveAs('document', m.content)}>
                            Save as document
                          </Button>
                          <Button size="xs" variant="ghost" icon={CheckSquare} onClick={() => proposeTasks(m.content)}>
                            Create tasks…
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {busy && (
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-body-s text-faint">
                      <Spinner className="!h-3 !w-3" /> Thinking…
                    </div>
                    {streaming && <MarkdownView source={streaming} />}
                  </div>
                )}
              </div>
            )}
            {error && (
              <div className="mt-4 rounded-md border border-danger/30 bg-danger/5 p-3 text-body-s">
                <div className="flex items-center gap-1.5 font-medium text-danger">
                  <AlertTriangle className="h-4 w-4" /> {error.text}
                </div>
                {error.hint && <p className="mt-1 text-muted">{error.hint}</p>}
                <Link to="/settings?tab=ai" className="mt-1 inline-block text-body-s text-accent-deep hover:underline">
                  Check AI settings
                </Link>
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>

        <div className="border-t border-line bg-bg/80 px-4 py-3 sm:px-6">
          <div className="mx-auto max-w-[760px]">
            {suggest.length > 0 && (
              <div className="mb-2 flex flex-wrap items-center gap-1.5 text-body-s text-faint">
                Related:
                {suggest.map((h) => (
                  <button key={h.id} onClick={() => setContext((c) => [...c, { type: h.type, id: h.id }])} className="inline-flex items-center gap-1 rounded-full border border-dashed border-line-strong px-2 py-0.5 text-muted hover:border-accent hover:text-accent-deep">
                    <Plus className="h-3 w-3" /> {ENTITY[h.type].label}: {h.title.slice(0, 32)}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2 rounded-lg border border-line bg-raised p-2 shadow-xs focus-within:border-accent/60">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={Math.min(8, Math.max(1, input.split('\n').length))}
                placeholder="Ask, or describe what to draft…  (Enter to send, Shift+Enter for a new line)"
                className="max-h-48 flex-1 resize-none bg-transparent px-1.5 py-1 text-body-m outline-none placeholder:text-faint"
              />
              {busy ? (
                <IconButton icon={Square} label="Stop" onClick={() => abort.current?.abort()} />
              ) : (
                <button onClick={() => send()} disabled={!input.trim()} className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-fg disabled:opacity-40" aria-label="Send">
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </div>
            <button onClick={() => setShowCtx(true)} className="mt-1.5 text-body-s text-accent-deep hover:underline xl:hidden">
              Context: {context.length + presets.length} item(s) shared — change
            </button>
            <p className="mt-1.5 text-caption text-faint">The assistant only drafts and suggests. It can't change your data — saving or creating anything always needs your click.</p>
          </div>
        </div>
      </div>

      <aside className="hidden w-[280px] shrink-0 overflow-y-auto border-l border-line bg-surface/40 p-4 xl:block">{contextPanel}</aside>
      <Modal open={showCtx} onClose={() => setShowCtx(false)} title="Context">{contextPanel}</Modal>

      <Modal open={preview !== null} onClose={() => setPreview(null)} title="Context preview" description="This text is sent with your message (plus the conversation so far)." width="max-w-2xl">
        <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-sm bg-sunken p-3 text-body-s">{preview}</pre>
      </Modal>

      <Modal
        open={!!taskDraft}
        onClose={() => setTaskDraft(null)}
        title="Create tasks from this reply?"
        description={projectInContext ? 'They will be added to the project in context.' : 'Review before anything is created.'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTaskDraft(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!taskDraft?.some((t) => t.on)}
              onClick={async () => {
                const chosen = (taskDraft ?? []).filter((t) => t.on && t.title.trim());
                for (const t of chosen) await newTask({ title: t.title.slice(0, 200), projectId: projectInContext, tags: ['ai-suggested'] });
                setTaskDraft(null);
                toast(`${chosen.length} task(s) created`, { action: { label: 'View', onClick: () => navigate(projectInContext ? `/projects/${projectInContext}` : '/tasks') } });
              }}
            >
              Create {taskDraft?.filter((t) => t.on).length ?? 0} task(s)
            </Button>
          </>
        }
      >
        <div className="space-y-1">
          {(taskDraft ?? []).map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <Checkbox size="sm" checked={t.on} onChange={(v) => setTaskDraft((d) => d!.map((x, j) => (j === i ? { ...x, on: v } : x)))} />
              <input value={t.title} onChange={(e) => setTaskDraft((d) => d!.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} className="field flex-1" />
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

