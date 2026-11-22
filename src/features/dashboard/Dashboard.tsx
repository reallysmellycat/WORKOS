import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDown, ArrowUp, Eye, EyeOff, FlaskConical, RotateCcw, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { useApp } from '@/app/context';
import { db } from '@/lib/db';
import { DEFAULT_HOME, saveSettings, type HomeSection } from '@/lib/settings';
import { hasDemo, removeDemo } from '@/lib/demo';
import { cn } from '@/lib/utils';
import { Button, IconButton } from '@/components/ui';
import { useFeedback } from '@/components/feedback';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ActivityStream, CampaignTimeline, Focus, IdeaCards, Masthead, Momentum, NotesList, ProjectsShowcase, Schedule, SECTION_META } from './home';

const RENDER: Record<HomeSection, () => JSX.Element> = {
  focus: () => <Focus />,
  schedule: () => <Schedule />,
  projects: () => <ProjectsShowcase />,
  activity: () => <ActivityStream />,
  performance: () => <Momentum />,
  ideas: () => <IdeaCards />,
  campaigns: () => <CampaignTimeline />,
  notes: () => <NotesList />,
};

export default function Dashboard() {
  const { settings } = useApp();
  const { confirm, toast } = useFeedback();
  const [arranging, setArranging] = useState(false);
  const demo = useLiveQuery(hasDemo, []);
  const taskCount = useLiveQuery(() => db.tasks.count(), []);
  const home = settings.home;
  const visible = home.order.filter((s) => !home.hidden.includes(s));

  const backupNudge = useMemo(() => (taskCount ?? 0) >= 5 && (!settings.lastExportAt || Date.now() - settings.lastExportAt > 14 * 86400000), [taskCount, settings.lastExportAt]);

  const move = (s: HomeSection, d: -1 | 1) => {
    const o = [...home.order];
    const i = o.indexOf(s);
    const j = i + d;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    void saveSettings({ home: { ...home, order: o } });
  };
  const toggle = (s: HomeSection) => void saveSettings({ home: { ...home, hidden: home.hidden.includes(s) ? home.hidden.filter((x) => x !== s) : [...home.hidden, s] } });

  return (
    <div className="mx-auto w-full max-w-[1320px] px-5 py-8 sm:px-10 sm:py-12">
      <div className="absolute right-5 top-[62px] z-10 sm:right-8">
        <IconButton icon={SlidersHorizontal} label="Arrange home" onClick={() => setArranging((a) => !a)} active={arranging} />
        {arranging && (
          <div className="absolute right-0 top-9 w-[280px] rounded-2xl bg-raised/95 p-3 shadow-pop ring-1 ring-line/80 backdrop-blur animate-scale origin-top-right">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="eyebrow">Arrange home</span>
              <IconButton icon={X} size="sm" label="Close" onClick={() => setArranging(false)} />
            </div>
            {home.order.map((s, i) => {
              const hidden = home.hidden.includes(s);
              return (
                <div key={s} className="flex items-center gap-1 rounded-lg px-1.5 py-1 hover:bg-sunken/70">
                  <span className={cn('flex-1 text-[13px]', hidden && 'text-faint line-through')}>{SECTION_META[s].label}</span>
                  <IconButton icon={ArrowUp} size="sm" label="Move up" disabled={i === 0} onClick={() => move(s, -1)} />
                  <IconButton icon={ArrowDown} size="sm" label="Move down" disabled={i === home.order.length - 1} onClick={() => move(s, 1)} />
                  <IconButton icon={hidden ? EyeOff : Eye} size="sm" label={hidden ? 'Show' : 'Hide'} onClick={() => toggle(s)} />
                </div>
              );
            })}
            <Button size="sm" variant="ghost" icon={RotateCcw} className="mt-1 w-full" onClick={() => saveSettings({ home: DEFAULT_HOME })}>
              Reset to default
            </Button>
          </div>
        )}
      </div>

      <Masthead name={settings.name} />

      {demo && (
        <div className="mb-10 flex flex-wrap items-center gap-3 border-y border-dashed border-line-strong py-3 text-[13px]">
          <FlaskConical className="h-4 w-4 text-accent" />
          <span className="flex-1 text-muted">
            You're exploring <strong className="font-medium text-fg">demo content</strong>, marked “Demo”. Your own items are never mixed in.
          </span>
          <Button
            size="sm"
            onClick={async () => {
              const ok = await confirm({ title: 'Remove all demo content?', message: 'Only items marked “Demo” are deleted. Anything you created yourself stays.', confirmLabel: 'Remove demo content', danger: true });
              if (ok) toast(`Removed ${await removeDemo()} demo items`);
            }}
          >
            Remove demo content
          </Button>
        </div>
      )}
      {backupNudge && !demo && (
        <div className="mb-10 flex flex-wrap items-center gap-3 border-y border-line py-3 text-[13px]">
          <ShieldCheck className="h-4 w-4 text-accent" />
          <span className="flex-1 text-muted">{settings.lastExportAt ? "It's been a while since your last backup." : "You haven't made a backup yet."} Your data lives only in this browser.</span>
          <Link to="/settings?tab=data" className="font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">
            Back up now
          </Link>
        </div>
      )}

      <div className="grid grid-flow-row-dense grid-cols-1 gap-x-12 gap-y-14 lg:grid-cols-12">
        {visible.map((s) => (
          <div key={s} className={SECTION_META[s].span}>
            <ErrorBoundary inline>{RENDER[s]()}</ErrorBoundary>
          </div>
        ))}
      </div>
      {visible.length === 0 && <p className="py-20 text-center text-[13px] text-muted">Every section is hidden. Use the arrange button (top right) to bring some back.</p>}
    </div>
  );
}
