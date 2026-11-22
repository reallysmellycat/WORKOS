import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { useDraft } from '@/lib/hooks';
import { create, restore, softDelete, update } from '@/lib/repo';
import { PR_STATUSES } from '@/lib/domain';
import type { Coverage, PressRelease } from '@/lib/types';
import { Button, Drawer, Field, IconButton, Input, Modal, SavedIndicator, Select, Textarea } from '@/components/ui';
import { Attachments, CampaignSelect, LinksEditor } from '@/components/pickers';
import { MarkdownEditor } from '@/components/Markdown';
import { useFeedback } from '@/components/feedback';
import { usePressReleases } from '@/lib/hooks';

export async function newPressRelease(campaignId?: string | null) {
  return create<PressRelease>('pressReleases', { title: 'Untitled press release', campaignId: campaignId ?? null, status: 'drafting', publishedLinks: [], body: '' });
}

export function PressReleaseDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  return (
    <Drawer open={!!id} onClose={onClose} width="max-w-[760px]">
      {id && <PressReleaseEditor key={id} id={id} onClose={onClose} />}
    </Drawer>
  );
}

function PressReleaseEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const { draft, set, status } = useDraft<PressRelease>('pressReleases', id);
  const { toast } = useFeedback();
  if (!draft) return null;
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[52px] shrink-0 items-center gap-2 border-b border-line px-5">
        <span className="text-body-s font-medium">Press release</span>
        <div className="flex-1" />
        <SavedIndicator status={status} />
        <IconButton
          icon={Trash2}
          label="Move to Trash"
          onClick={async () => {
            await softDelete('pressReleases', id);
            onClose();
            toast('Press release moved to Trash', { action: { label: 'Undo', onClick: () => restore('pressReleases', id) } });
          }}
        />
        <IconButton icon={X} label="Close" onClick={onClose} />
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        <Textarea autoGrow rows={1} value={draft.title} onChange={(e) => set({ title: e.target.value.replace(/\n/g, ' ') })} className="!border-0 !bg-transparent !px-0 !ring-0 text-h4 font-semibold" aria-label="Title" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Status">
            <Select value={draft.status} onChange={(e) => set({ status: e.target.value as PressRelease['status'] })}>
              {PR_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Campaign">
            <CampaignSelect value={draft.campaignId} onChange={(v) => set({ campaignId: v })} />
          </Field>
          <Field label="Distribution platform">
            <Input value={draft.platform ?? ''} onChange={(e) => set({ platform: e.target.value })} placeholder="e.g. PR Times, Newswire" />
          </Field>
          <Field label="Distribution date">
            <Input type="date" value={draft.distributionDate ?? ''} onChange={(e) => set({ distributionDate: e.target.value || null })} />
          </Field>
          <Field label="Publication date">
            <Input type="date" value={draft.publicationDate ?? ''} onChange={(e) => set({ publicationDate: e.target.value || null })} />
          </Field>
        </div>
        <div>
          <span className="label">Draft</span>
          <div className="rounded-md border border-line bg-raised px-4 pt-1 pb-4">
            <MarkdownEditor value={draft.body ?? ''} onChange={(body) => set({ body })} minHeight={280} owner={{ type: 'pressRelease', id }} placeholder="Headline, dateline, lead paragraph, quotes, boilerplate, media contact…" />
          </div>
        </div>
        <div>
          <span className="label">Published links</span>
          <LinksEditor links={draft.publishedLinks} onChange={(publishedLinks) => set({ publishedLinks })} />
        </div>
        <Field label="Results">
          <Textarea autoGrow rows={3} value={draft.results ?? ''} onChange={(e) => set({ results: e.target.value })} placeholder="Pickups, enquiries, notable outcomes…" />
        </Field>
        <div>
          <span className="label">Files</span>
          <Attachments owner={{ type: 'pressRelease', id }} />
        </div>
      </div>
    </div>
  );
}

export function CoverageModal({ coverage, campaignId, onClose }: { coverage?: Coverage | null; campaignId?: string | null; onClose: () => void }) {
  const releases = usePressReleases();
  const [c, setC] = useState<Partial<Coverage>>(coverage ?? { outlet: '', headline: '', date: new Date().toISOString().slice(0, 10), campaignId: campaignId ?? null, sentiment: 'positive' });
  const { toast } = useFeedback();
  const set = (p: Partial<Coverage>) => setC((x) => ({ ...x, ...p }));
  const save = async () => {
    if (!c.outlet?.trim() || !c.headline?.trim()) return;
    const data = { ...c, outlet: c.outlet.trim(), headline: c.headline.trim(), reach: c.reach === undefined || c.reach === null || Number.isNaN(c.reach) ? null : Number(c.reach) };
    if (coverage) await update<Coverage>('coverage', coverage.id, data);
    else await create<Coverage>('coverage', data as Coverage);
    toast(coverage ? 'Coverage updated' : 'Coverage logged');
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={coverage ? 'Edit coverage' : 'Log coverage'}
      footer={
        <>
          {coverage && (
            <Button
              variant="ghost"
              icon={Trash2}
              className="mr-auto !text-danger"
              onClick={async () => {
                await softDelete('coverage', coverage.id);
                onClose();
                toast('Coverage deleted', { action: { label: 'Undo', onClick: () => restore('coverage', coverage.id) } });
              }}
            >
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!c.outlet?.trim() || !c.headline?.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Outlet" className="col-span-2 sm:col-span-1">
          <Input autoFocus value={c.outlet ?? ''} onChange={(e) => set({ outlet: e.target.value })} placeholder="Publication name" />
        </Field>
        <Field label="Date" className="col-span-2 sm:col-span-1">
          <Input type="date" value={c.date ?? ''} onChange={(e) => set({ date: e.target.value || null })} />
        </Field>
        <Field label="Headline" className="col-span-2">
          <Input value={c.headline ?? ''} onChange={(e) => set({ headline: e.target.value })} />
        </Field>
        <Field label="URL" className="col-span-2">
          <Input value={c.url ?? ''} onChange={(e) => set({ url: e.target.value })} placeholder="https://" />
        </Field>
        <Field label="Estimated reach" hint="Enter the figure you have (e.g. from the outlet's media kit).">
          <Input type="number" min={0} value={c.reach ?? ''} onChange={(e) => set({ reach: e.target.value === '' ? null : Number(e.target.value) })} />
        </Field>
        <Field label="Sentiment">
          <Select value={c.sentiment ?? ''} onChange={(e) => set({ sentiment: (e.target.value || null) as Coverage['sentiment'] })}>
            <option value="">—</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </Select>
        </Field>
        <Field label="Campaign">
          <CampaignSelect value={c.campaignId} onChange={(v) => set({ campaignId: v })} />
        </Field>
        <Field label="Press release">
          <Select value={c.pressReleaseId ?? ''} onChange={(e) => set({ pressReleaseId: e.target.value || null })}>
            <option value="">—</option>
            {(releases ?? [])
              .filter((r) => !c.campaignId || r.campaignId === c.campaignId)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Notes" className="col-span-2">
          <Textarea rows={2} value={c.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
