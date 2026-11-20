import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Plus, Search } from 'lucide-react';
import { useDocs, useFolders } from '@/lib/hooks';
import { create } from '@/lib/repo';
import type { Doc, DocumentType } from '@/lib/types';
import { cn, excerpt, timeAgo, wordCount } from '@/lib/utils';
import { Badge, Button, DemoBadge, Empty, Input, Loading, Modal, Page, PageHeader, Select } from '@/components/ui';
import { TagList } from '@/components/pickers';
import { DOC_TEMPLATES, DOC_TYPES, docTypeLabel } from './docTemplates';
import { NewFolderButton } from '../notes/NotesPage';

export default function DocumentsPage() {
  const docs = useDocs();
  const folders = useFolders();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [type, setType] = useState<DocumentType | ''>('');
  const [folder, setFolder] = useState('all');
  const [choosing, setChoosing] = useState(false);

  const list = useMemo(() => {
    const ql = q.toLowerCase();
    return (docs ?? [])
      .filter((d) => !type || d.docType === type)
      .filter((d) => (folder === 'all' ? true : folder === 'none' ? !d.folderId : d.folderId === folder))
      .filter((d) => !ql || d.title.toLowerCase().includes(ql) || d.body.toLowerCase().includes(ql))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [docs, q, type, folder]);

  if (!docs || !folders) return <Loading />;
  const docFolders = folders.filter((f) => f.scope === 'documents');

  const createDoc = async (t: DocumentType) => {
    const d = await create<Doc>('documents', {
      title: t === 'other' ? 'Untitled document' : `New ${docTypeLabel(t).toLowerCase()}`,
      body: DOC_TEMPLATES[t],
      docType: t,
      status: 'draft',
      folderId: folder !== 'all' && folder !== 'none' ? folder : null,
      tags: [],
      refs: [],
    });
    navigate(`/documents/${d.id}`);
  };

  return (
    <Page>
      <PageHeader
        title="Documents"
        subtitle="Longer professional writing — reports, proposals, strategies, briefs."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setChoosing(true)}>
            New document
          </Button>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents" className="pl-8" />
        </div>
        <Select value={type} onChange={(e) => setType(e.target.value as DocumentType | '')} className="w-44" aria-label="Type">
          <option value="">All types</option>
          {DOC_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
        <Select value={folder} onChange={(e) => setFolder(e.target.value)} className="w-40" aria-label="Folder">
          <option value="all">All folders</option>
          <option value="none">No folder</option>
          {docFolders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
        <NewFolderButton scope="documents" />
      </div>

      {list.length === 0 ? (
        <div className="card">
          <Empty icon={FileText} title={docs.length ? 'No matching documents' : 'No documents yet'} action={<Button icon={Plus} onClick={() => setChoosing(true)}>Start a document</Button>}>
            Start from an outline (report, proposal, brief, meeting summary…) or a blank page. Everything autosaves.
          </Empty>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((d) => (
            <Link key={d.id} to={`/documents/${d.id}`} className="card group flex h-[190px] flex-col p-4 transition-all hover:border-line-strong hover:shadow-soft">
              <div className="flex items-center gap-2">
                <Badge>{docTypeLabel(d.docType)}</Badge>
                <Badge tone={d.status === 'final' ? 'ok' : d.status === 'in_review' ? 'warn' : 'muted'}>{d.status === 'final' ? 'Final' : d.status === 'in_review' ? 'In review' : 'Draft'}</Badge>
                {d.isDemo && <DemoBadge />}
              </div>
              <h3 className="mt-3 line-clamp-2 font-serif text-[17px] font-medium leading-snug group-hover:text-accent">{d.title || 'Untitled'}</h3>
              <p className="mt-1.5 line-clamp-2 text-[12.5px] text-faint">{excerpt(d.body, 140)}</p>
              <div className="flex-1" />
              <div className="flex items-center gap-2 text-2xs text-faint">
                <span>{wordCount(d.body)} words</span>·<span>edited {timeAgo(d.updatedAt)}</span>
                <span className="flex-1" />
                <TagList tags={d.tags.slice(0, 2)} />
              </div>
            </Link>
          ))}
        </div>
      )}

      <Modal open={choosing} onClose={() => setChoosing(false)} title="New document" description="Pick a starting outline. You can change everything." width="max-w-2xl">
        <div className="grid gap-2 sm:grid-cols-3">
          {DOC_TYPES.map((t) => (
            <button key={t.value} onClick={() => createDoc(t.value)} className={cn('rounded-lg border border-line p-3 text-left hover:border-accent hover:bg-accent-soft/30')}>
              <FileText className="mb-2 h-4 w-4 text-accent" />
              <div className="text-[13.5px] font-medium">{t.value === 'other' ? 'Blank document' : t.label}</div>
              <div className="mt-0.5 line-clamp-2 text-xs text-faint">{t.value === 'other' ? 'Start from nothing' : excerpt(DOC_TEMPLATES[t.value], 60)}</div>
            </button>
          ))}
        </div>
      </Modal>
    </Page>
  );
}
