import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tone } from '@/lib/domain';

// ---------- Button ----------
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type Size = 'xs' | 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
}

// DESIGN.md §6 Buttons: graphite primary, neutral secondary, ghost, 12px radius (8px compact).
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-ink-fg shadow-sm hover:-translate-y-px hover:shadow-md active:translate-y-0 active:scale-[0.98]',
  secondary: 'bg-raised/80 text-fg shadow-[inset_0_0_0_1px_rgb(var(--line)/var(--line-alpha)),var(--shadow-xs)] hover:bg-raised hover:shadow-[inset_0_0_0_1px_rgb(var(--line-strong)/var(--line-strong-alpha)),var(--shadow-sm)] active:scale-[0.98]',
  ghost: 'text-muted hover:text-fg hover:bg-sunken/40 active:scale-[0.98]',
  subtle: 'bg-sunken/45 text-fg hover:bg-sunken/70 active:scale-[0.98]',
  danger: 'bg-danger text-raised shadow-sm hover:brightness-110 active:scale-[0.98]',
};
const SIZES: Record<Size, string> = {
  xs: 'h-6 px-2 text-caption gap-1 rounded-sm',
  sm: 'h-8 px-3 text-body-s gap-1.5 rounded-md',
  md: 'h-9 px-4 text-body-s gap-2 rounded-md',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, iconRight: IconR, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center font-semibold whitespace-nowrap transition-all duration-fast ease-out disabled:opacity-40 disabled:pointer-events-none select-none',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {Icon && <Icon className={size === 'xs' ? 'h-3 w-3' : 'h-[15px] w-[15px]'} strokeWidth={1.9} />}
      {children}
      {IconR && <IconR className="h-[15px] w-[15px]" strokeWidth={1.9} />}
    </button>
  );
});

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; size?: 'sm' | 'md'; active?: boolean }>(
  function IconButton({ icon: Icon, label, size = 'md', active, className, type = 'button', ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        className={cn(
          'inline-flex items-center justify-center rounded-full text-muted transition-colors duration-fast hover:bg-sunken/45 hover:text-fg disabled:opacity-40',
          size === 'sm' ? 'h-7 w-7' : 'h-9 w-9',
          active && 'bg-sunken/60 text-fg',
          className,
        )}
        {...rest}
      >
        <Icon className={size === 'sm' ? 'h-[14px] w-[14px]' : 'h-[18px] w-[18px]'} strokeWidth={1.8} />
      </button>
    );
  },
);

// ---------- Inputs ----------
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn('field', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { autoGrow?: boolean }>(
  function Textarea({ className, autoGrow, onInput, ...rest }, ref) {
    const inner = useRef<HTMLTextAreaElement | null>(null);
    const grow = (el: HTMLTextAreaElement | null) => {
      if (!el || !autoGrow) return;
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 2 + 'px';
    };
    useEffect(() => {
      grow(inner.current);
    });
    return (
      <textarea
        ref={(el) => {
          inner.current = el;
          if (typeof ref === 'function') ref(el);
          else if (ref) ref.current = el;
        }}
        className={cn('field leading-relaxed', autoGrow ? 'resize-none overflow-hidden' : 'resize-y', className)}
        onInput={(e) => {
          grow(e.currentTarget);
          onInput?.(e);
        }}
        {...rest}
      />
    );
  },
);

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn('relative', className)}>
      <select className="field appearance-none pr-7 cursor-pointer" {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-faint" />
    </div>
  );
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-body-s text-faint">{hint}</span>}
    </label>
  );
}

export function Checkbox({ checked, onChange, label, className, size = 'md', tone }: { checked: boolean; onChange: (v: boolean) => void; label?: string; className?: string; size?: 'sm' | 'md' | 'lg'; tone?: string }) {
  const dim = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-6 w-6' : 'h-[18px] w-[18px]';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label ?? (checked ? 'Mark incomplete' : 'Mark complete')}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        'group/cb relative shrink-0 inline-flex items-center justify-center rounded-full transition-all duration-200',
        dim,
        checked ? 'bg-accent text-accent-fg animate-pop' : cn('shadow-[inset_0_0_0_1.5px_rgb(var(--faint)/0.75)] hover:shadow-[inset_0_0_0_1.5px_rgb(var(--accent))]', tone),
        className,
      )}
    >
      {checked ? (
        <svg viewBox="0 0 16 16" className={size === 'lg' ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5'} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.5l3 3 6-7" strokeDasharray={20} className="animate-draw" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" className={cn('opacity-0 transition-opacity group-hover/cb:opacity-40', size === 'lg' ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5')} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      )}
    </button>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('relative h-5 w-9 rounded-full transition-colors duration-normal shrink-0', checked ? 'bg-accent' : 'bg-sunken')}
    >
      <span className={cn('absolute top-[2px] h-4 w-4 rounded-full bg-raised shadow-sm transition-all duration-normal ease-spring', checked ? 'left-[18px]' : 'left-[2px]')} />
    </button>
  );
}

// ---------- Badge ----------
const TONES: Record<Tone, string> = {
  neutral: 'text-muted',
  muted: 'text-muted',
  accent: 'text-accent-deep',
  info: 'text-info',
  warn: 'text-warn',
  danger: 'text-danger',
  ok: 'text-ok',
};
/** Quiet status label: a coloured dot + text on a hairline pill (no loud fills). */
export function Badge({ tone = 'neutral', children, className, dot = true }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn('inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full bg-raised/60 px-2.5 text-caption font-semibold shadow-[inset_0_0_0_1px_rgb(var(--line)/var(--line-alpha))]', TONES[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      <span className={tone === 'neutral' || tone === 'muted' ? 'text-muted' : 'text-fg/80'}>{children}</span>
    </span>
  );
}

export function DemoBadge() {
  return (
    <span className="inline-flex items-center rounded-xs border border-dashed border-line-strong px-1 font-mono text-micro uppercase tracking-[0.1em] text-faint" title="Demo content — remove it in Settings → Data">
      Demo
    </span>
  );
}

export function Tag({ name, color, onRemove }: { name: string; color?: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sunken/80 px-2 h-[20px] text-caption text-muted">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color ?? 'rgb(var(--faint))' }} />
      {name}
      {onRemove && (
        <button type="button" onClick={onRemove} className="-mr-1 text-faint hover:text-fg" aria-label={`Remove ${name}`}>
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

// ---------- Progress ----------
export function Progress({ value, className, tone = 'accent' }: { value: number; className?: string; tone?: 'accent' | 'ok' | 'warn' | 'ink' }) {
  const bg = tone === 'ok' ? 'bg-ok' : tone === 'warn' ? 'bg-warn' : tone === 'ink' ? 'bg-fg' : 'bg-accent';
  return (
    <div className={cn('h-1 w-full rounded-full bg-sunken/60 overflow-hidden', className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full origin-left rounded-full transition-[width] duration-700 ease-out animate-grow', bg)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Ring({ value, size = 36, stroke = 3.5, label }: { value: number; size?: number; stroke?: number; label?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: 'rgb(var(--sunken) / 0.6)' }} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          style={{ stroke: 'rgb(var(--accent-deep))' }}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(100, value)) / 100)}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <span className="absolute font-mono text-micro tabular-nums text-muted">{label ?? `${Math.round(value)}`}</span>
    </div>
  );
}

// ---------- Empty state ----------
export function Empty({ icon: Icon, title, children, action, compact }: { icon?: LucideIcon; title: string; children?: ReactNode; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center animate-in', compact ? 'py-7 px-4' : 'py-16 px-6')}>
      {Icon && (
        <div className={cn('relative mb-4 flex items-center justify-center', compact ? 'h-10 w-10' : 'h-16 w-16')}>
          <span className="absolute inset-0 rounded-full border border-dashed border-line-strong" />
          <span className={cn('absolute rounded-full bg-sunken', compact ? 'inset-1.5' : 'inset-2.5')} />
          <Icon className={cn('relative text-faint', compact ? 'h-4 w-4' : 'h-5 w-5')} strokeWidth={1.5} />
        </div>
      )}
      <p className={cn(compact ? 'text-body-s font-medium' : 'display text-h2')}>{title}</p>
      {children && <p className="mt-1.5 max-w-sm text-body-s leading-relaxed text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn('inline-block h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-accent', className)} />;
}

export function Loading() {
  return (
    <div className="w-full space-y-4 px-gutter py-10" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-3 w-28" />
      <div className="skeleton h-10 w-72" />
      <div className="grid gap-4 pt-4 sm:grid-cols-3">
        <div className="skeleton h-32" />
        <div className="skeleton h-32" />
        <div className="skeleton h-32" />
      </div>
    </div>
  );
}

// ---------- Overlays ----------
function useEscape(onClose: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [onClose, active]);
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'max-w-lg',
  description,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEscape(onClose, open);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh] animate-fade" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-desk/50 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('elevated relative flex max-h-[80vh] w-full flex-col !rounded-xl !shadow-xl animate-scale', width)}>
        {title && (
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
            <div>
              <h2 className="display text-h3">{title}</h2>
              {description && <p className="mt-0.5 text-body-s text-muted">{description}</p>}
            </div>
            <IconButton icon={X} label="Close" onClick={onClose} className="-mr-1.5 -mt-0.5" />
          </div>
        )}
        <div className="overflow-y-auto px-6 pb-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 rounded-b-xl border-t border-line bg-sunken/20 px-6 py-3.5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ open, onClose, children, width = 'max-w-[560px]' }: { open: boolean; onClose: () => void; children: ReactNode; width?: string }) {
  useEscape(onClose, open);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-40 flex justify-end animate-fade" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-desk/35 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cn('elevated relative m-0 flex h-full w-full flex-col overflow-hidden !rounded-none !shadow-xl animate-drawer sm:m-3 sm:h-[calc(100%-1.5rem)] sm:!rounded-xl', width)}>{children}</div>
    </div>,
    document.body,
  );
}

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  checked?: boolean;
}

export function Menu({ trigger, items, align = 'right', width = 'w-48' }: { trigger: (open: () => void) => ReactNode; items: (MenuItem | 'divider')[]; align?: 'left' | 'right'; width?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const on = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', on);
    window.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', on);
      window.removeEventListener('keydown', key);
    };
  }, [open]);
  return (
    <div className="relative inline-block" ref={ref}>
      {trigger(() => setOpen((o) => !o))}
      {open && (
        <div className={cn('elevated absolute z-30 mt-2 p-1.5 animate-scale', width, align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left')} role="menu">
          {items.map((it, i) =>
            it === 'divider' ? (
              <div key={i} className="my-1 h-px bg-line" />
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                disabled={it.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  it.onClick();
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-body-s transition-colors duration-fast disabled:opacity-40',
                  it.danger ? 'text-danger hover:bg-danger/10' : 'hover:bg-sunken/40',
                )}
              >
                {it.icon && <it.icon className="h-3.5 w-3.5 opacity-70" />}
                <span className="flex-1">{it.label}</span>
                {it.checked && <Check className="h-3.5 w-3.5 text-accent-deep" />}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Tabs ----------
/** Editorial tabs: text labels with a sliding underline. */
export function Tabs<T extends string>({ value, onChange, tabs, className }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string; icon?: LucideIcon; count?: number }[]; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null);
  useEffect(() => {
    const el = wrap.current?.querySelector<HTMLElement>(`[data-tab="${value}"]`);
    if (el) setBar({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, tabs.length]);
  return (
    <div ref={wrap} className={cn('relative flex items-center gap-5 overflow-x-auto max-w-full w-fit', className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          data-tab={t.value}
          role="tab"
          type="button"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn('flex items-center gap-1.5 whitespace-nowrap pb-2.5 pt-1 text-body-s font-medium transition-colors duration-fast', value === t.value ? 'text-fg' : 'text-faint hover:text-muted')}
        >
          {t.icon && <t.icon className="h-3.5 w-3.5" strokeWidth={1.8} />}
          {t.label}
          {t.count !== undefined && <span className="font-mono text-micro tabular-nums text-faint">{t.count}</span>}
        </button>
      ))}
      <span className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-line" />
      {bar && <span className="pointer-events-none absolute bottom-0 h-[2px] rounded-full bg-fg transition-all duration-smooth ease-out" style={{ left: bar.left, width: bar.width }} />}
    </div>
  );
}

/**
 * Workspace masthead: mono eyebrow, Instrument Serif title, quiet subtitle.
 * The eyebrow defaults to the workspace the page belongs to (see app/nav.ts).
 */
export function PageHeader({ title, subtitle, actions, eyebrow, children }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; icon?: LucideIcon; eyebrow?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-10 animate-in">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0 max-w-3xl">
          {eyebrow !== null && <div className="eyebrow mb-4">{eyebrow ?? <AutoEyebrow />}</div>}
          <h1 className="display text-display-l">{title}</h1>
          {subtitle && <p className="mt-3 max-w-xl text-body-m text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 pb-1">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

function AutoEyebrow() {
  const n = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] || 'home' : '';
  const map: Record<string, string> = {
    home: 'Home', 'my-day': 'Home · Today', calendar: 'Calendar', tasks: 'Tasks · Execution', projects: 'Projects · Workspace', campaigns: 'Studio · Communications',
    content: 'Studio · Editorial', ideas: 'Library · Inbox', library: 'Library · Archive', documents: 'Library · Documents', notes: 'Library · Notes',
    analytics: 'Insights · Performance', reviews: 'Insights · Monthly', assistant: 'Intelligence', settings: 'System · Settings',
  };
  return <>{map[n] ?? 'WorkOS'}</>;
}

/**
 * Full-width workspace canvas (DESIGN.md §8). Uses the page gutter tokens;
 * pass `reading` only for long-form text that needs a measure.
 */
export function Page({ children, className, reading }: { children: ReactNode; className?: string; wide?: boolean; reading?: boolean }) {
  return <div className={cn('w-full px-gutter pb-24 pt-8 sm:pt-10', reading && 'mx-auto max-w-reading', className)}>{children}</div>;
}

/** A titled region separated by a hairline rule — the default way to group content (instead of boxing everything). */
export function Section({ title, children, action, className, eyebrow }: { title?: ReactNode; children: ReactNode; action?: ReactNode; className?: string; eyebrow?: ReactNode }) {
  return (
    <section className={cn('animate-in', className)}>
      {(title || action) && (
        <header className="mb-5 flex items-end justify-between gap-3 border-b border-line pb-3">
          <div>
            {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
            {title && <h2 className="display text-h2">{title}</h2>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

type PanelVariant = 'solid' | 'glass' | 'workspace' | 'ink' | 'elevated';
/**
 * Floating surface (DESIGN.md §6).
 *  solid      — Level 2 work panel (default)
 *  glass      — Level 2 translucent panel over the environment
 *  workspace  — large Level 2 region (22px radius, deeper shadow)
 *  elevated   — Level 3 (menus, popovers, dialogs)
 *  ink        — inverse graphite panel for the single most important block
 */
export function Panel({ variant = 'solid', as: As = 'section', className, children, ...rest }: { variant?: PanelVariant; as?: 'section' | 'div' | 'article' | 'aside'; className?: string; children: ReactNode } & React.HTMLAttributes<HTMLElement>) {
  const v: Record<PanelVariant, string> = {
    solid: 'panel',
    glass: 'glass rounded-lg',
    workspace: 'workspace',
    elevated: 'elevated',
    ink: 'ink-panel grain overflow-hidden',
  };
  return (
    <As className={cn(v[variant], className)} {...rest}>
      {children}
    </As>
  );
}

/** A titled Level-2 panel. Use when grouping genuinely helps; prefer Section otherwise. */
export function Card({ children, className, title, action, icon: Icon, padded = true }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; icon?: LucideIcon; padded?: boolean }) {
  return (
    <section className={cn('panel', className)}>
      {title && (
        <header className="flex items-center justify-between gap-2 px-5 pb-3 pt-4">
          <h3 className="eyebrow flex items-center gap-2 !text-muted">
            {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />}
            {title}
          </h3>
          {action}
        </header>
      )}
      <div className={cn(padded && 'px-5 pb-5', !title && padded && 'pt-5')}>{children}</div>
    </section>
  );
}

/** Metric: mono label, mono tabular value (DESIGN.md §2 — numbers are technical). */
export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'ok' | 'danger' | 'muted' }) {
  return (
    <div className="min-w-0">
      <div className="eyebrow">{label}</div>
      <div className="num mt-3 text-h1">{value}</div>
      {sub && <div className={cn('meta mt-2', tone === 'ok' ? 'text-ok' : tone === 'danger' ? 'text-danger' : 'text-muted')}>{sub}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-xs bg-sunken/45 px-1 font-mono text-micro text-muted">{children}</kbd>;
}

export function SavedIndicator({ status }: { status: 'idle' | 'pending' | 'saving' | 'saved' | 'error' }) {
  const text = { idle: 'All changes saved', pending: 'Editing…', saving: 'Saving…', saved: 'Saved', error: 'Could not save' }[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-mono text-micro', status === 'error' ? 'text-danger' : 'text-faint')} aria-live="polite">
      <span className={cn('h-1.5 w-1.5 rounded-full', status === 'pending' || status === 'saving' ? 'bg-warn animate-pulse' : status === 'error' ? 'bg-danger' : 'bg-ok')} />
      {text}
    </span>
  );
}
