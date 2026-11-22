import { Copy, MoreHorizontal, Trash2, X } from 'lucide-react';
import { useDraft } from '@/lib/hooks';
import { CONTENT_STATUSES, engagementOf, engagementRate } from '@/lib/domain';
import { create, restore, softDelete } from '@/lib/repo';
import type { ContentItem, ContentMetrics } from '@/lib/types';
import { DemoBadge, Drawer, Field, IconButton, Input, Menu, SavedIndicator, Select, Textarea } from '@/components/ui';
import { Attachments, CampaignSelect, CustomFields, LinksEditor, ProjectSelect, TagInput } from '@/components/pickers';
import { useFeedback } from '@/components/feedback';
import { useApp } from '@/app/context';

const LIMITS: Record<string, number> = { LinkedIn: 3000, Instagram: 2200, TikTok: 2200, X: 280 };

export function ContentDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  return (
    <Drawer open={!!id} onClose={onClose} width="max-w-[680px]">
      {id && <ContentEditor key={id} id={id} onClose={onClose} />}
    </Drawer>
  );
}

const METRIC_FIELDS: { key: keyof ContentMetrics; label: string }[] = [
  { key: 'reach', label: 'Reach' },
  { key: 'impressions', label: 'Impressions' },
  { key: 'views', label: 'Views' },
  { key: 'likes', label: 'Likes / reactions' },
  { key: 'comments', label: 'Comments' },
  { key: 'shares', label: 'Shares / reposts' },
  { key: 'saves', label: 'Saves' },
  { key: 'clicks', label: 'Link clicks' },
];

function ContentEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const { draft, set, status } = useDraft<ContentItem>('content', id, 500);
  const { settings, openContent } = useApp();
  const { toast } = useFeedback();
  if (!draft) return null;
  const limit = LIMITS[draft.platform];
  const capLen = (draft.caption ?? '').length;
  const eng = engagementOf(draft.metrics);
  const rate = engagementRate(eng, draft.metrics.reach, draft.metrics.impressions);
  const platforms = settings.platforms.includes(draft.platform) ? settings.platforms : [...settings.platforms, draft.platform];
  const types = settings.contentTypes.includes(draft.contentType) ? settings.contentTypes : [...settings.contentTypes, draft.contentType];

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[52px] shrink-0 items-center gap-2 border-b border-line px-5">
        <span className="text-body-s font-medium">Content</span>
        {draft.isDemo && <DemoBadge />}
        <div className="flex-1" />
        <SavedIndicator status={status} />
        <Menu
          trigger={(t) => <IconButton icon={MoreHorizontal} label="More" onClick={t} />}
          items={[
            {
              label: 'Duplicate (e.g. for another platform)',
              icon: Copy,
              onClick: async () => {
                const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = draft;
                const c = await create<ContentItem>('content', { ...rest, title: `${draft.title} (copy)`, status: draft.status === 'published' ? 'drafting' : draft.status, metrics: {}, isDemo: false });
                openContent(c.id);
              },
            },
            'divider',
            {
              label: 'Move to Trash',
              icon: Trash2,
              danger: true,
              onClick: async () => {
                await softDelete('content', id);
                onClose();
                toast('Content moved to Trash', { action: { label: 'Undo', onClick: () => restore('content', id) } });
              },
            },
          ]}
        />
        <IconButton icon={X} label="Close" onClick={onClose} />
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        <Textarea autoGrow rows={1} value={draft.title} onChange={(e) => set({ title: e.target.value.replace(/\n/g, ' ') })} className="!border-0 !bg-transparent !px-0 !ring-0 text-h4 font-semibold" aria-label="Title" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Status">
            <Select value={draft.status} onChange={(e) => set({ status: e.target.value as ContentItem['status'] })}>
              {CONTENT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Platform">
            <Select value={draft.platform} onChange={(e) => set({ platform: e.target.value })}>
              {platforms.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          </Field>
          <Field label="Type">
            <Select value={draft.contentType} onChange={(e) => set({ contentType: e.target.value })}>
              {types.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          </Field>
          <Field label="Publish date">
            <Input type="date" value={draft.publishDate ?? ''} onChange={(e) => set({ publishDate: e.target.value || null })} />
          </Field>
          <Field label="Time">
            <Input type="time" value={draft.publishTime ?? ''} onChange={(e) => set({ publishTime: e.target.value || null })} />
          </Field>
          <Field label="Campaign">
            <CampaignSelect value={draft.campaignId} onChange={(v) => set({ campaignId: v })} />
          </Field>
          <Field label="Project" className="col-span-2 sm:col-span-1">
            <ProjectSelect value={draft.projectId} onChange={(v) => set({ projectId: v })} />
          </Field>
        </div>

        <Field label="Draft / script" hint="Outline, script, or long-form draft.">
          <Textarea autoGrow rows={5} value={draft.draft ?? ''} onChange={(e) => set({ draft: e.target.value })} placeholder="Hook, body, call to action…" />
        </Field>
        <Field
          label="Caption"
          hint={
            <span className={limit && capLen > limit ? 'text-danger' : ''}>
              {capLen.toLocaleString()} characters{limit ? ` · ${draft.platform} limit ${limit.toLocaleString()}` : ''}
            </span>
          }
        >
          <Textarea autoGrow rows={3} value={draft.caption ?? ''} onChange={(e) => set({ caption: e.target.value })} placeholder="Final caption as it will be posted" />
        </Field>

        <div>
          <span className="label">Performance (entered manually)</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {METRIC_FIELDS.map((m) => (
              <label key={m.key} className="block">
                <span className="mb-0.5 block text-caption text-faint">{m.label}</span>
                <Input
                  type="number"
                  min={0}
                  value={draft.metrics[m.key] ?? ''}
                  onChange={(e) => set({ metrics: { ...draft.metrics, [m.key]: e.target.value === '' ? null : Number(e.target.value) } })}
                />
              </label>
            ))}
          </div>
          <p className="mt-2 text-body-s text-muted">
            Engagement: <strong className="text-fg tabular-nums">{eng.toLocaleString()}</strong>
            {rate !== null && (
              <>
                {' '}
                · Engagement rate <strong className="text-fg tabular-nums">{rate.toFixed(2)}%</strong> <span className="text-faint">(engagement ÷ {draft.metrics.reach ? 'reach' : 'impressions'})</span>
              </>
            )}
          </p>
          <p className="mt-1 text-caption text-faint">Copy figures from each platform's own analytics. Work OS does not connect to social accounts.</p>
        </div>

        <div>
          <span className="label">Reference links</span>
          <LinksEditor links={draft.referenceLinks} onChange={(referenceLinks) => set({ referenceLinks })} />
        </div>
        <div>
          <span className="label">Media</span>
          <Attachments owner={{ type: 'content', id }} />
        </div>
        <Field label="Tags">
          <TagInput value={draft.tags} onChange={(tags) => set({ tags })} />
        </Field>
        <CustomFields entity="content" values={draft.custom} onChange={(custom) => set({ custom })} />
        <Field label="Notes">
          <Textarea autoGrow rows={2} value={draft.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}
