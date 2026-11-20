import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ExternalLink, FileText, Megaphone, Newspaper, Plus } from 'lucide-react';
import { useById, useCampaigns, useCoverage, usePressReleases } from '@/lib/hooks';
import { CAMPAIGN_STATUSES, campaignStatusMeta, prStatusMeta, PR_STATUSES } from '@/lib/domain';
import type { CampaignStatus, Coverage } from '@/lib/types';
import { compactNumber, fmtDate, relativeDay } from '@/lib/utils';
import { Badge, Button, DemoBadge, Empty, Loading, Page, PageHeader, Progress, Select, Tabs } from '@/components/ui';
import { useApp } from '@/app/context';
import { CoverageModal, newPressRelease, PressReleaseDrawer } from './editors';

type Tab = 'campaigns' | 'releases' | 'coverage';

export default function CampaignsPage() {
  const campaigns = useCampaigns();
  const releases = usePressReleases();
  const coverage = useCoverage();
  const cm = useById(campaigns);
  const { quickAdd } = useApp();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) || 'campaigns');
  const [statusF, setStatusF] = useState<CampaignStatus | 'active' | 'all'>('active');
  const [release, setRelease] = useState<string | null>(null);
  const [cov, setCov] = useState<Coverage | null | 'new'>(null);

  useEffect(() => {
    const r = params.get('release');
    if (r) {
      setTab('releases');
      setRelease(r);
      params.delete('release');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const list = useMemo(
    () => (campaigns ?? []).filter((c) => (statusF === 'all' ? true : statusF === 'active' ? c.status !== 'completed' && c.status !== 'archived' : c.status === statusF)).sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? '')),
    [campaigns, statusF],
  );

  if (!campaigns || !releases || !coverage) return <Loading />;
  const totalReach = coverage.reduce((s, c) => s + (c.reach ?? 0), 0);

  return (
    <Page>
      <PageHeader
        title="PR & Campaigns"
        subtitle={`${campaigns.filter((c) => c.status === 'in_progress').length} in progress · ${releases.length} press releases · ${coverage.length} coverage pieces (${compactNumber(totalReach)} reach)`}
        actions={
          tab === 'campaigns' ? (
            <Button variant="primary" icon={Plus} onClick={() => quickAdd({ type: 'campaign' })}>
              New campaign
            </Button>
          ) : tab === 'releases' ? (
            <Button variant="primary" icon={Plus} onClick={async () => setRelease((await newPressRelease()).id)}>
              New press release
            </Button>
          ) : (
            <Button variant="primary" icon={Plus} onClick={() => setCov('new')}>
              Log coverage
            </Button>
          )
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'campaigns', label: 'Campaigns', icon: Megaphone, count: campaigns.length },
            { value: 'releases', label: 'Press releases', icon: FileText, count: releases.length },
            { value: 'coverage', label: 'Coverage', icon: Newspaper, count: coverage.length },
          ]}
        />
        <div className="flex-1" />
        {tab === 'campaigns' && (
          <Select value={statusF} onChange={(e) => setStatusF(e.target.value as CampaignStatus)} className="w-40" aria-label="Status filter">
            <option value="active">Active</option>
            {CAMPAIGN_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
            <option value="all">All</option>
          </Select>
        )}
      </div>

      {tab === 'campaigns' &&
        (list.length === 0 ? (
          <div className="card">
            <Empty icon={Megaphone} title="No campaigns here" action={<Button icon={Plus} onClick={() => quickAdd({ type: 'campaign' })}>New campaign</Button>}>
              A campaign brings together objectives, key messages, press releases, coverage and content — and shows how it performed.
            </Empty>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {list.map((c) => {
              const sm = campaignStatusMeta(c.status);
              const cv = coverage.filter((x) => x.campaignId === c.id);
              const rl = releases.filter((x) => x.campaignId === c.id);
              const done = c.activities.filter((a) => a.done).length;
              return (
                <Link key={c.id} to={`/campaigns/${c.id}`} className="card group p-4 transition-all hover:border-line-strong hover:shadow-soft">
                  <div className="flex items-center gap-2">
                    <Badge tone={sm.tone} dot>
                      {sm.label}
                    </Badge>
                    {c.isDemo && <DemoBadge />}
                    <div className="flex-1" />
                    <span className="text-xs text-faint">
                      {c.startDate ? fmtDate(c.startDate) : '—'} → {c.endDate ? fmtDate(c.endDate) : '—'}
                    </span>
                  </div>
                  <h3 className="mt-3 text-[15px] font-semibold group-hover:text-accent">{c.name}</h3>
                  {c.description && <p className="mt-1 line-clamp-2 text-[13px] text-muted">{c.description}</p>}
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-sunken/50 py-2">
                      <div className="text-[15px] font-semibold tabular-nums">{rl.length}</div>
                      <div className="text-2xs uppercase tracking-wide text-faint">Releases</div>
                    </div>
                    <div className="rounded-md bg-sunken/50 py-2">
                      <div className="text-[15px] font-semibold tabular-nums">{cv.length}</div>
                      <div className="text-2xs uppercase tracking-wide text-faint">Coverage</div>
                    </div>
                    <div className="rounded-md bg-sunken/50 py-2">
                      <div className="text-[15px] font-semibold tabular-nums">{compactNumber(cv.reduce((s, x) => s + (x.reach ?? 0), 0))}</div>
                      <div className="text-2xs uppercase tracking-wide text-faint">Reach</div>
                    </div>
                  </div>
                  {c.activities.length > 0 && (
                    <div className="mt-3 flex items-center gap-2">
                      <Progress value={(done / c.activities.length) * 100} />
                      <span className="shrink-0 text-xs tabular-nums text-faint">
                        {done}/{c.activities.length} activities
                      </span>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        ))}

      {tab === 'releases' && (
        <div className="card overflow-x-auto">
          {releases.length === 0 ? (
            <Empty icon={FileText} title="No press releases yet" />
          ) : (
            <table className="w-full min-w-[720px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-2xs uppercase tracking-wider text-faint">
                  <th className="px-4 py-2.5 font-semibold">Title</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold">Campaign</th>
                  <th className="px-3 py-2.5 font-semibold">Distribution</th>
                  <th className="px-3 py-2.5 font-semibold">Platform</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {[...releases]
                  .sort((a, b) => (b.distributionDate ?? '9999').localeCompare(a.distributionDate ?? '9999'))
                  .map((r) => (
                    <tr key={r.id} className="cursor-pointer border-b border-line last:border-0 row-hover" onClick={() => setRelease(r.id)}>
                      <td className="px-4 py-2.5 font-medium">
                        {r.title} {r.isDemo && <DemoBadge />}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={prStatusMeta(r.status).tone}>{prStatusMeta(r.status).label}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-muted">{r.campaignId ? cm.get(r.campaignId)?.name ?? '—' : '—'}</td>
                      <td className="px-3 py-2.5 text-muted">{r.distributionDate ? relativeDay(r.distributionDate) : '—'}</td>
                      <td className="px-3 py-2.5 text-muted">{r.platform || '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{coverage.filter((c) => c.pressReleaseId === r.id).length}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
          <div className="flex flex-wrap gap-3 border-t border-line px-4 py-2.5 text-xs text-faint">
            {PR_STATUSES.map((s) => (
              <span key={s.value}>
                {s.label}: <span className="text-fg tabular-nums">{releases.filter((r) => r.status === s.value).length}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {tab === 'coverage' && <CoverageTable coverage={coverage} campaignName={(id) => (id ? cm.get(id)?.name : undefined)} onEdit={(c) => setCov(c)} />}

      <PressReleaseDrawer id={release} onClose={() => setRelease(null)} />
      {cov && <CoverageModal coverage={cov === 'new' ? null : cov} onClose={() => setCov(null)} />}
    </Page>
  );
}

export function CoverageTable({ coverage, campaignName, onEdit }: { coverage: Coverage[]; campaignName?: (id?: string | null) => string | undefined; onEdit: (c: Coverage) => void }) {
  if (!coverage.length) return <div className="card"><Empty icon={Newspaper} title="No coverage logged yet" compact>Log articles, mentions and interviews as they appear.</Empty></div>;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[640px] text-[13px]">
        <thead>
          <tr className="border-b border-line text-left text-2xs uppercase tracking-wider text-faint">
            <th className="px-4 py-2.5 font-semibold">Date</th>
            <th className="px-3 py-2.5 font-semibold">Outlet</th>
            <th className="px-3 py-2.5 font-semibold">Headline</th>
            {campaignName && <th className="px-3 py-2.5 font-semibold">Campaign</th>}
            <th className="px-3 py-2.5 text-right font-semibold">Reach</th>
            <th className="px-3 py-2.5 font-semibold">Sentiment</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {[...coverage]
            .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
            .map((c) => (
              <tr key={c.id} className="cursor-pointer border-b border-line last:border-0 row-hover" onClick={() => onEdit(c)}>
                <td className="whitespace-nowrap px-4 py-2.5 text-muted">{c.date ? fmtDate(c.date, 'd MMM yyyy') : '—'}</td>
                <td className="px-3 py-2.5 font-medium">{c.outlet}</td>
                <td className="px-3 py-2.5">{c.headline}</td>
                {campaignName && <td className="px-3 py-2.5 text-muted">{campaignName(c.campaignId) ?? '—'}</td>}
                <td className="px-3 py-2.5 text-right tabular-nums">{c.reach ? compactNumber(c.reach) : '—'}</td>
                <td className="px-3 py-2.5">{c.sentiment && <Badge tone={c.sentiment === 'positive' ? 'ok' : c.sentiment === 'negative' ? 'danger' : 'neutral'}>{c.sentiment}</Badge>}</td>
                <td className="px-2">
                  {c.url && (
                    <a href={c.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-faint hover:text-accent" aria-label="Open article">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
