import { useRef, useState } from 'react';
import { ArrowRight, Database, FlaskConical, HardDrive, Upload, WifiOff } from 'lucide-react';
import { saveSettings } from '@/lib/settings';
import { ensureBuiltInTemplates } from '@/lib/templates';
import { seedDemo } from '@/lib/demo';
import { importBackup, readBackupFile } from '@/lib/backup';
import { cn } from '@/lib/utils';
import { Button, Input, Spinner } from '@/components/ui';
import { useFeedback } from '@/components/feedback';

export function Onboarding() {
  const [name, setName] = useState('');
  const [withDemo, setWithDemo] = useState(true);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const { toast } = useFeedback();

  const start = async () => {
    setBusy(true);
    try {
      await ensureBuiltInTemplates();
      if (withDemo) await seedDemo();
      await saveSettings({ onboarded: true, name: name.trim() });
    } catch (e) {
      toast(`Setup failed: ${(e as Error).message}`, { tone: 'error' });
      setBusy(false);
    }
  };

  const restore = async (f: File) => {
    setBusy(true);
    const v = await readBackupFile(f);
    if (!v.ok || !v.data) {
      toast(v.errors.join(' '), { tone: 'error' });
      setBusy(false);
      return;
    }
    await importBackup(v.data, 'replace');
    await ensureBuiltInTemplates();
    await saveSettings({ onboarded: true });
  };

  return (
    <div className="min-h-full overflow-y-auto bg-bg">
      <div className="mx-auto flex min-h-full max-w-[980px] flex-col justify-center gap-10 px-6 py-12 md:flex-row md:items-center">
        <div className="flex-1">
          <div className="mb-8 flex h-10 w-10 items-center justify-center rounded-lg bg-fg text-bg">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M5 8h14M5 12h9M5 16h5" />
              <circle cx="17" cy="16" r="1.8" fill="rgb(var(--accent))" stroke="none" />
            </svg>
          </div>
          <h1 className="font-serif text-[40px] font-medium leading-[1.08] tracking-tight">
            Your work,
            <br />
            in one calm place.
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">
            Tasks, projects, campaigns, content, notes and performance — connected, private, and yours.
          </p>
          <ul className="mt-8 space-y-3 text-[13.5px]">
            <li className="flex gap-3">
              <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>
                <strong className="font-medium">Stored on this device.</strong> <span className="text-muted">Your data lives in this browser — nothing is uploaded anywhere.</span>
              </span>
            </li>
            <li className="flex gap-3">
              <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>
                <strong className="font-medium">Works offline.</strong> <span className="text-muted">Install it as an app and use it without a connection.</span>
              </span>
            </li>
            <li className="flex gap-3">
              <Database className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>
                <strong className="font-medium">Back up any time.</strong> <span className="text-muted">Export everything to a single file from Settings → Data.</span>
              </span>
            </li>
          </ul>
        </div>

        <div className="card w-full max-w-[400px] p-6 shadow-pop">
          <h2 className="text-[15px] font-semibold">Let's set up your workspace</h2>
          <label className="mt-5 block">
            <span className="label">What should we call you?</span>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" onKeyDown={(e) => e.key === 'Enter' && start()} />
          </label>
          <div className="mt-5">
            <span className="label">Start with</span>
            <div className="grid gap-2">
              {[
                { v: true, icon: FlaskConical, title: 'Sample content', body: 'Explore with clearly labelled demo items. Remove them in one click later.' },
                { v: false, icon: ArrowRight, title: 'An empty workspace', body: 'Start fresh with just the built-in project templates.' },
              ].map((o) => (
                <button
                  key={String(o.v)}
                  onClick={() => setWithDemo(o.v)}
                  className={cn('flex gap-3 rounded-lg border p-3 text-left transition-colors', withDemo === o.v ? 'border-accent bg-accent-soft/50' : 'border-line hover:border-line-strong')}
                >
                  <o.icon className={cn('mt-0.5 h-4 w-4 shrink-0', withDemo === o.v ? 'text-accent' : 'text-faint')} />
                  <span>
                    <span className="block text-[13.5px] font-medium">{o.title}</span>
                    <span className="block text-xs text-muted leading-relaxed">{o.body}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <Button variant="primary" className="mt-6 w-full !h-9" onClick={start} disabled={busy}>
            {busy ? <Spinner className="!h-3.5 !w-3.5 !border-accent-fg/40 !border-t-accent-fg" /> : 'Open my workspace'}
          </Button>
          <button onClick={() => file.current?.click()} className="mt-3 flex w-full items-center justify-center gap-1.5 text-xs text-muted hover:text-fg" disabled={busy}>
            <Upload className="h-3.5 w-3.5" /> Restore from a backup file instead
          </button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
        </div>
      </div>
    </div>
  );
}
