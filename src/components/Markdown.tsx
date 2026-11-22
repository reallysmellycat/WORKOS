import { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useNavigate } from 'react-router-dom';
import { Bold, CheckSquare, Code, Eye, Heading1, Heading2, Image as ImageIcon, Italic, Link2, List, ListOrdered, Pencil, Quote, Columns2 } from 'lucide-react';
import { db } from '@/lib/db';
import { create } from '@/lib/repo';
import type { EntityRef, Note, StoredFile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { IconButton } from './ui';

marked.setOptions({ gfm: true, breaks: true });

/** Resolves [[Note title]] wiki-links to existing notes. */
function useNoteTitles() {
  const [map, setMap] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let alive = true;
    db.notes.toArray().then((ns) => {
      if (alive) setMap(new Map(ns.filter((n) => !n.deletedAt).map((n) => [n.title.trim().toLowerCase(), n.id])));
    });
    return () => {
      alive = false;
    };
  }, []);
  return map;
}

export function renderMarkdown(md: string, noteTitles?: Map<string, string>): string {
  const withLinks = md.replace(/\[\[([^\]\n]+)\]\]/g, (_, title: string) => {
    const id = noteTitles?.get(title.trim().toLowerCase());
    return id
      ? `<a class="wikilink" href="/notes/${id}" data-internal="1">${escapeHtml(title)}</a>`
      : `<a class="wikilink missing" data-create="${escapeHtml(title)}" href="#">${escapeHtml(title)}</a>`;
  });
  const html = marked.parse(withLinks, { async: false }) as string;
  return DOMPurify.sanitize(html, { ADD_ATTR: ['data-internal', 'data-create', 'data-file', 'target'], ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|file|blob|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Renders Markdown safely. Images stored locally use `file:<id>` URLs. */
export function MarkdownView({ source, className, onToggleCheckbox }: { source: string; className?: string; onToggleCheckbox?: (index: number) => void }) {
  const titles = useNoteTitles();
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const html = useMemo(() => renderMarkdown(source || '', titles), [source, titles]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const urls: string[] = [];
    el.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
      const src = img.getAttribute('src') ?? '';
      if (src.startsWith('file:')) {
        img.removeAttribute('src');
        db.files.get(src.slice(5)).then((f) => {
          if (!f) return;
          const u = URL.createObjectURL(f.blob);
          urls.push(u);
          img.src = u;
        });
      }
    });
    el.querySelectorAll<HTMLAnchorElement>('a[href^="http"]').forEach((a) => {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    });
    const boxes = el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    boxes.forEach((b, i) => {
      if (onToggleCheckbox) {
        b.disabled = false;
        b.onclick = (e) => {
          e.preventDefault();
          onToggleCheckbox(i);
        };
      }
    });
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [html, onToggleCheckbox]);

  return (
    <div
      ref={ref}
      className={cn('prose-os', className)}
      onClick={async (e) => {
        const a = (e.target as HTMLElement).closest('a');
        if (!a) return;
        if (a.dataset.internal) {
          e.preventDefault();
          navigate(a.getAttribute('href')!);
        } else if (a.dataset.create) {
          e.preventDefault();
          const n = await create<Note>('notes', { title: a.dataset.create, body: '', kind: 'note', tags: [], refs: [] });
          navigate(`/notes/${n.id}`);
        }
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** Toggles the n-th task-list checkbox in a Markdown string. */
export function toggleNthCheckbox(md: string, n: number): string {
  let i = -1;
  return md.replace(/^(\s*[-*+]\s+\[)( |x|X)(\])/gm, (m, a, x, b) => {
    i++;
    if (i !== n) return m;
    return `${a}${x === ' ' ? 'x' : ' '}${b}`;
  });
}

export async function storeInlineFile(file: File, owner?: EntityRef | null): Promise<StoredFile> {
  return create<StoredFile>('files', { name: file.name || 'image.png', mime: file.type, size: file.size, blob: file, tags: [], owner: owner ?? null, inline: true }, { log: false });
}

type Mode = 'write' | 'preview' | 'split';

/**
 * Practical Markdown editor: a calm textarea with a formatting toolbar,
 * live preview, pasted/dropped images saved locally, and [[wiki links]].
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Start writing…  Markdown supported. Link notes with [[Note title]].',
  minHeight = 320,
  owner,
  defaultMode = 'write',
  className,
  serif,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
  owner?: EntityRef | null;
  defaultMode?: Mode;
  className?: string;
  serif?: boolean;
}) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const grow = () => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(minHeight, el.scrollHeight + 4) + 'px';
  };
  useEffect(grow, [value, mode, minHeight]);

  const wrap = (before: string, after = before, placeholderText = 'text') => {
    const el = ta.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = value.slice(s, e) || placeholderText;
    const next = value.slice(0, s) + before + sel + after + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + sel.length);
    });
  };

  const linePrefix = (prefix: string) => {
    const el = ta.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    const block = value.slice(lineStart, e);
    const replaced = block
      .split('\n')
      .map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : prefix + l))
      .join('\n');
    onChange(value.slice(0, lineStart) + replaced + value.slice(e));
    requestAnimationFrame(() => el.focus());
  };

  const insert = (text: string) => {
    const el = ta.current;
    const pos = el?.selectionStart ?? value.length;
    onChange(value.slice(0, pos) + text + value.slice(pos));
  };

  const addImages = async (files: FileList | File[]) => {
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue;
      const stored = await storeInlineFile(f, owner);
      insert(`\n![${f.name || 'image'}](file:${stored.id})\n`);
    }
  };

  const tools = [
    { icon: Heading1, label: 'Heading', run: () => linePrefix('# ') },
    { icon: Heading2, label: 'Subheading', run: () => linePrefix('## ') },
    { icon: Bold, label: 'Bold', run: () => wrap('**') },
    { icon: Italic, label: 'Italic', run: () => wrap('_') },
    { icon: List, label: 'Bulleted list', run: () => linePrefix('- ') },
    { icon: ListOrdered, label: 'Numbered list', run: () => linePrefix('1. ') },
    { icon: CheckSquare, label: 'Checklist', run: () => linePrefix('- [ ] ') },
    { icon: Quote, label: 'Quote', run: () => linePrefix('> ') },
    { icon: Code, label: 'Code', run: () => wrap('`') },
    { icon: Link2, label: 'Link', run: () => wrap('[', '](https://)', 'link text') },
    { icon: ImageIcon, label: 'Insert image', run: () => fileInput.current?.click() },
  ];

  const editor = (
    <textarea
      ref={ta}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      spellCheck
      onPaste={(e) => {
        const imgs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'));
        if (imgs.length) {
          e.preventDefault();
          void addImages(imgs);
        }
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files.length) {
          e.preventDefault();
          void addImages(e.dataTransfer.files);
        }
      }}
      onKeyDown={(e) => {
        const mod = e.metaKey || e.ctrlKey;
        if (mod && e.key === 'b') {
          e.preventDefault();
          wrap('**');
        } else if (mod && e.key === 'i') {
          e.preventDefault();
          wrap('_');
        } else if (e.key === 'Enter' && !e.shiftKey) {
          // Continue lists automatically.
          const el = e.currentTarget;
          const s = el.selectionStart;
          const lineStart = value.lastIndexOf('\n', s - 1) + 1;
          const line = value.slice(lineStart, s);
          const m = /^(\s*)([-*+] \[[ xX]\] |[-*+] |(\d+)\. )/.exec(line);
          if (m) {
            e.preventDefault();
            if (line.trim() === m[2].trim()) {
              onChange(value.slice(0, lineStart) + value.slice(s));
              return;
            }
            const marker = m[3] ? `${Number(m[3]) + 1}. ` : m[2].replace(/\[[xX]\]/, '[ ]');
            const ins = '\n' + m[1] + marker;
            onChange(value.slice(0, s) + ins + value.slice(el.selectionEnd));
            requestAnimationFrame(() => el.setSelectionRange(s + ins.length, s + ins.length));
          }
        }
      }}
      className={cn(
        'w-full resize-none bg-transparent outline-none leading-[1.7] text-[14.5px] placeholder:text-faint',
        serif && 'font-serif text-[16.5px]',
      )}
      style={{ minHeight }}
    />
  );

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="sticky top-[var(--sticky-top,0px)] z-10 -mx-1 mb-3 flex items-center gap-0.5 overflow-x-auto border-b border-line bg-bg/90 px-1 py-1 backdrop-blur">
        {mode !== 'preview' &&
          tools.map((t) => <IconButton key={t.label} icon={t.icon} label={t.label} size="sm" onMouseDown={(e) => e.preventDefault()} onClick={t.run} />)}
        <div className="flex-1" />
        <IconButton icon={Pencil} label="Write" size="sm" active={mode === 'write'} onClick={() => setMode('write')} />
        <IconButton icon={Columns2} label="Split view" size="sm" active={mode === 'split'} onClick={() => setMode('split')} className="hidden md:inline-flex" />
        <IconButton icon={Eye} label="Preview" size="sm" active={mode === 'preview'} onClick={() => setMode('preview')} />
        <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && addImages(e.target.files)} />
      </div>
      {mode === 'write' && editor}
      {mode === 'preview' && (
        <div style={{ minHeight }}>
          {value.trim() ? (
            <MarkdownView source={value} onToggleCheckbox={(i) => onChange(toggleNthCheckbox(value, i))} />
          ) : (
            <p className="text-faint text-[13px]">Nothing to preview yet.</p>
          )}
        </div>
      )}
      {mode === 'split' && (
        <div className="grid grid-cols-2 gap-6">
          {editor}
          <div className="border-l border-line pl-6">
            <MarkdownView source={value} onToggleCheckbox={(i) => onChange(toggleNthCheckbox(value, i))} />
          </div>
        </div>
      )}
    </div>
  );
}
