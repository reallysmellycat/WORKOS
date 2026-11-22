import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, FileDown, Info, MoreHorizontal, PanelRight, Printer, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { useDraft, useFolders } from '@/lib/hooks';
import { softDelete } from '@/lib/repo';
import type { Doc, DocumentType } from '@/lib/types';
import { downloadBlob, downloadText, fmtTs, slugify, stripMarkdown, timeAgo, wordCount } from '@/lib/utils';
import { Button, DemoBadge, Empty, Field, IconButton, Loading, Menu, SavedIndicator, Select } from '@/components/ui';
import { Attachments, RefsEditor, TagInput } from '@/components/pickers';
import { MarkdownEditor, MarkdownView, renderMarkdown } from '@/components/Markdown';
import { useFeedback } from '@/components/feedback';
import { DOC_TYPES } from './docTemplates';

/** Replaces local `file:` image references with embedded data so exports are self-contained. */
async function inlineImages(md: string): Promise<string> {
  const ids = [...md.matchAll(/\(file:([\w-]+)\)/g)].map((m) => m[1]);
  let out = md;
  for (const id of ids) {
    const f = await db.files.get(id);
    if (!f) continue;
    const buf = new Uint8Array(await f.blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    out = out.replace(`(file:${id})`, `(data:${f.mime};base64,${btoa(bin)})`);
  }
  return out;
}

function htmlDocument(title: string, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, '&lt;')}</title>
<style>body{font-family:Georgia,'Times New Roman',serif;max-width:720px;margin:40px auto;padding:0 24px;line-height:1.6;color:#222}
h1,h2,h3{font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;line-height:1.25}table{border-collapse:collapse;width:100%}
td,th{border:1px solid #ccc;padding:6px 8px;text-align:left}img{max-width:100%}blockquote{border-left:3px solid #ccc;margin:0;padding-left:16px;color:#555}
code{background:#f3f3f3;padding:1px 4px;border-radius:3px}</style></head><body>${body}</body></html>`;
}

export default function DocumentEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { draft, set, status, record } = useDraft<Doc>('documents', id, 800);
  const folders = useFolders();
  const { confirm, toast } = useFeedback();
  const [side, setSide] = useState(true);
  const [focus, setFocus] = useState(false);

  if (record === null || record?.deletedAt)
    return (
      <div className="p-8">
        <Empty icon={Info} title="Document not found">It may have been moved to the Trash.</Empty>
      </div>
    );
  if (!draft || !folders) return <Loading />;

  const name = slugify(draft.title);
  const exportAs = async (kind: 'md' | 'html' | 'doc' | 'txt' | 'pdf') => {
    if (kind === 'pdf') {
      window.print();
      return;
    }
    if (kind === 'txt') return downloadText(`${draft.title}\n\n${stripMarkdown(draft.body)}`, `${name}.txt`);
    const md = await inlineImages(draft.body);
    if (kind === 'md') return downloadText(md, `${name}.md`, 'text/markdown');
    const html = htmlDocument(draft.title, renderMarkdown(md));
    if (kind === 'html') return downloadText(html, `${name}.html`, 'text/html');
    // Word opens HTML saved with a .doc extension — a free, dependency-less export.
    downloadBlob(new Blob(['﻿', html], { type: 'application/msword' }), `${name}.doc`);
    toast('Exported for Word. Word may ask to confirm the format the first time — that is expected.');
  };

  const remove = async () => {
    const ok = await confirm({ title: 'Move document to Trash?', message: 'You can restore it from Settings → Trash.', confirmLabel: 'Move to Trash', danger: true });
    if (!ok) return;
    await softDelete('documents', draft.id);
    toast('Document moved to Trash');
    navigate('/documents');
  };

  return (
    <div className="flex min-h-full">
      <div className="min-w-0 flex-1">
        <div className="glass sticky top-[var(--sticky-top,0px)] z-10 flex h-11 items-center gap-2 border-b border-line px-4">
          <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate('/documents')}>
            Documents
          </Button>
          {draft.isDemo && <DemoBadge />}
          <div className="flex-1" />
          <span className="hidden text-xs text-faint sm:inline">{wordCount(draft.body).toLocaleString()} words · ~{Math.max(1, Math.round(wordCount(draft.body) / 230))} min read</span>
          <SavedIndicator status={status} />
          <Button size="sm" variant={focus ? 'subtle' : 'ghost'} onClick={() => setFocus((f) => !f)}>
            {focus ? 'Exit focus' : 'Focus'}
          </Button>
          <Menu
            width="w-56"
            trigger={(t) => (
              <Button size="sm" icon={Download} onClick={t}>
                Export
              </Button>
            )}
            items={[
              { label: 'PDF (print / save as PDF)', icon: Printer, onClick: () => exportAs('pdf') },
              { label: 'Word (.doc)', icon: FileDown, onClick: () => exportAs('doc') },
              { label: 'Markdown (.md)', icon: FileDown, onClick: () => exportAs('md') },
              { label: 'Web page (.html)', icon: FileDown, onClick: () => exportAs('html') },
              { label: 'Plain text (.txt)', icon: FileDown, onClick: () => exportAs('txt') },
            ]}
          />
          <IconButton icon={PanelRight} label="Toggle details" active={side && !focus} onClick={() => setSide((s) => !s)} className="hidden lg:inline-flex" />
          <Menu trigger={(t) => <IconButton icon={MoreHorizontal} label="Document actions" onClick={t} />} items={[{ label: 'Move to Trash', icon: Trash2, danger: true, onClick: remove }]} />
        </div>
        <div className="mx-auto max-w-[780px] px-5 py-8 sm:px-12" style={{ ["--sticky-top" as string]: "94px" } as React.CSSProperties}>
          <input
            value={draft.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="Untitled document"
            className="mb-6 w-full bg-transparent font-serif text-[34px] font-medium leading-tight tracking-tight outline-none placeholder:text-faint"
          />
          <MarkdownEditor value={draft.body} onChange={(body) => set({ body })} owner={{ type: 'document', id: draft.id }} minHeight={560} serif />
        </div>
      </div>

      {side && !focus && (
        <aside className="hidden w-[280px] shrink-0 space-y-4 border-l border-line bg-surface/40 p-4 lg:block">
          <Field label="Type">
            <Select value={draft.docType} onChange={(e) => set({ docType: e.target.value as DocumentType })}>
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={draft.status} onChange={(e) => set({ status: e.target.value as Doc['status'] })}>
              <option value="draft">Draft</option>
              <option value="in_review">In review</option>
              <option value="final">Final</option>
            </Select>
          </Field>
          <Field label="Folder">
            <Select value={draft.folderId ?? ''} onChange={(e) => set({ folderId: e.target.value || null })}>
              <option value="">No folder</option>
              {folders
                .filter((f) => f.scope === 'documents')
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Tags">
            <TagInput value={draft.tags} onChange={(tags) => set({ tags })} />
          </Field>
          <div>
            <span className="label">Attached to</span>
            <RefsEditor refs={draft.refs} onChange={(refs) => set({ refs })} />
            <p className="mt-1 text-2xs text-faint">Link this document to projects, campaigns or tasks so it shows up there.</p>
          </div>
          <div>
            <span className="label">Files</span>
            <Attachments owner={{ type: 'document', id: draft.id }} />
          </div>
          <p className="text-2xs text-faint">
            Created {fmtTs(draft.createdAt, 'd MMM yyyy')} · edited {timeAgo(record?.updatedAt ?? draft.updatedAt)}
          </p>
        </aside>
      )}

      {/* Print-only rendering used for "Save as PDF" */}
      <div className="print-area hidden print:block">
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, marginBottom: 16 }}>{draft.title}</h1>
        <MarkdownView source={draft.body} />
      </div>
    </div>
  );
}
