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

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-ink-fg hover:opacity-90 active:scale-[0.98] shadow-soft',
  secondary: 'bg-raised text-fg shadow-[inset_0_0_0_1px_rgb(var(--line))] hover:shadow-[inset_0_0_0_1px_rgb(var(--line-strong))] active:scale-[0.98]',
  ghost: 'text-muted hover:text-fg hover:bg-sunken/80 active:scale-[0.98]',
  subtle: 'bg-sunken text-fg hover:bg-line/60 active:scale-[0.98]',
  danger: 'bg-danger text-white hover:brightness-110 active:scale-[0.98]',
};
const SIZES: Record<Size, string> = {
  xs: 'h-6 px-2 text-xs gap-1 rounded-md',
  sm: 'h-7 px-2.5 text-[12.5px] gap-1.5 rounded-md',
  md: 'h-8 px-3.5 text-[13px] gap-1.5 rounded-lg',
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
        'inline-flex items-center justify-center font-medium whitespace-nowrap transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none select-none',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {Icon && <Icon className={size === 'xs' ? 'h-3 w-3' : 'h-3.5 w-3.5'} strokeWidth={2} />}
      {children}
      {IconR && <IconR className="h-3.5 w-3.5" strokeWidth={2} />}
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
          'inline-flex items-center justify-center rounded-md text-muted hover:text-fg hover:bg-sunken/80 transition-colors disabled:opacity-40',
          size === 'sm' ? 'h-6 w-6' : 'h-7 w-7',
          active && 'bg-sunken text-fg',
          className,
        )}
        {...rest}
      >
        <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} strokeWidth={1.9} />
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
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
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
        checked ? 'bg-accent text-accent-fg animate-pop' : cn('shadow-[inset_0_0_0_1.5px_rgb(var(--line-strong))] hover:shadow-[inset_0_0_0_1.5px_rgb(var(--accent))]', tone),
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
      className={cn('relative h-[18px] w-8 rounded-full transition-colors shrink-0', checked ? 'bg-accent' : 'bg-line-strong')}
    >
      <span className={cn('absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-all', checked ? 'left-[16px]' : 'left-[2px]')} />
    </button>
  );
}

// ---------- Badge ----------
const TONES: Record<Tone, string> = {
  neutral: 'text-muted',
  muted: 'text-muted',
  accent: 'text-accent',
  info: 'text-info',
  warn: 'text-warn',
  danger: 'text-danger',
  ok: 'text-ok',
};
/** Quiet status label: a coloured dot + text on a hairline pill (no loud fills). */
export function Badge({ tone = 'neutral', children, className, dot = true }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 h-[20px] text-[11px] font-medium whitespace-nowrap bg-raised/70 shadow-[inset_0_0_0_1px_rgb(var(--line))]', TONES[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      <span className={tone === 'neutral' || tone === 'muted' ? 'text-muted' : 'text-fg/80'}>{children}</span>
    </span>
  );
}

export function DemoBadge() {
  return (
    <span className="inline-flex items-center rounded-sm border border-dashed border-line-strong px-1 font-mono text-[9px] uppercase tracking-[0.1em] text-faint" title="Demo content — remove it in Settings → Data">
      Demo
    </span>
  );
}

export function Tag({ name, color, onRemove }: { name: string; color?: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sunken/80 px-2 h-[20px] text-[11px] text-muted">
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
    <div className={cn('h-[3px] w-full rounded-full bg-line/70 overflow-hidden', className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
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
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--line))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgb(var(--accent))"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(100, value)) / 100)}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <span className="absolute font-mono text-[10px] tabular-nums text-muted">{label ?? `${Math.round(value)}`}</span>
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
      <p className={cn(compact ? 'text-[13px] font-medium' : 'display text-[26px]')}>{title}</p>
      {children && <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn('inline-block h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-accent', className)} />;
}

export function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-4 px-6 py-10 sm:px-10" aria-busy="true" aria-label="Loading">
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
      <div className="absolute inset-0 bg-[rgb(var(--desk)/0.55)] backdrop-blur-[6px]" onClick={onClose} />
      <div className={cn('relative w-full rounded-2xl bg-surface shadow-pop animate-scale max-h-[80vh] flex flex-col ring-1 ring-line/80', width)}>
        {title && (
          <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
            <div>
              <h2 className="display text-[24px]">{title}</h2>
              {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
            </div>
            <IconButton icon={X} label="Close" onClick={onClose} className="-mr-1.5 -mt-0.5" />
          </div>
        )}
        <div className="px-5 pb-4 overflow-y-auto">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3 bg-sunken/40 rounded-b-2xl">{footer}</div>}
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
      <div className="absolute inset-0 bg-[rgb(var(--desk)/0.35)] backdrop-blur-[2px]" onClick={onClose} />
      <div className={cn('relative m-0 h-full w-full bg-surface shadow-pop ring-1 ring-line/80 flex flex-col animate-drawer sm:m-2 sm:h-[calc(100%-1rem)] sm:rounded-2xl overflow-hidden', width)}>{children}</div>
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
        <div className={cn('absolute z-30 mt-1.5 rounded-xl bg-raised/95 backdrop-blur p-1 shadow-pop ring-1 ring-line/80 animate-scale origin-top', width, align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left')} role="menu">
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
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] disabled:opacity-40',
                  it.danger ? 'text-danger hover:bg-danger/10' : 'hover:bg-sunken',
                )}
              >
                {it.icon && <it.icon className="h-3.5 w-3.5 opacity-70" />}
                <span className="flex-1">{it.label}</span>
                {it.checked && <Check className="h-3.5 w-3.5 text-accent" />}
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
          className={cn('flex items-center gap-1.5 pb-2 pt-1 text-[13px] transition-colors whitespace-nowrap', value === t.value ? 'text-fg font-medium' : 'text-faint hover:text-muted')}
        >
          {t.icon && <t.icon className="h-3.5 w-3.5" strokeWidth={1.8} />}
          {t.label}
          {t.count !== undefined && <span className="font-mono text-[10.5px] tabular-nums text-faint">{t.count}</span>}
        </button>
      ))}
      <span className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-line" />
      {bar && <span className="pointer-events-none absolute bottom-0 h-[1.5px] bg-fg transition-all duration-300 ease-out" style={{ left: bar.left, width: bar.width }} />}
    </div>
  );
}

/**
 * Editorial page masthead: mono eyebrow, large serif title, quiet subtitle.
 * The eyebrow defaults to the section of the current page (e.g. "Work — 04").
 */
export function PageHeader({ title, subtitle, actions, eyebrow, children }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; icon?: LucideIcon; eyebrow?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-8 animate-in">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 max-w-3xl">
          {eyebrow !== null && <div className="eyebrow mb-3">{eyebrow ?? <AutoEyebrow />}</div>}
          <h1 className="display text-[40px] sm:text-[52px]">{title}</h1>
          {subtitle && <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted">{subtitle}</p>}
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
    home: 'Home', 'my-day': 'Home — Today', calendar: 'Home — Calendar', tasks: 'Work — 01', projects: 'Work — 02', campaigns: 'Work — 03', content: 'Work — 04', ideas: 'Work — 05',
    library: 'Knowledge — 01', documents: 'Knowledge — 02', notes: 'Knowledge — 03', analytics: 'Performance — 01', reviews: 'Performance — 02', assistant: 'System — AI', settings: 'System — Settings',
  };
  return <>{map[n] ?? 'Work OS'}</>;
}

export function Page({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn('mx-auto w-full px-5 sm:px-10 py-8 sm:py-10', wide ? 'max-w-[1480px]' : 'max-w-[1220px]', className)}>{children}</div>;
}

/** A titled region separated by a hairline rule — the default way to group content (instead of boxing everything). */
export function Section({ title, children, action, className, eyebrow }: { title?: ReactNode; children: ReactNode; action?: ReactNode; className?: string; eyebrow?: ReactNode }) {
  return (
    <section className={cn('animate-in', className)}>
      {(title || action) && (
        <header className="mb-4 flex items-end justify-between gap-3 border-b border-line pb-2.5">
          <div>
            {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
            {title && <h2 className="display text-[22px]">{title}</h2>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Card({ children, className, title, action, icon: Icon, padded = true }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; icon?: LucideIcon; padded?: boolean }) {
  return (
    <section className={cn('card', className)}>
      {title && (
        <header className="flex items-center justify-between gap-2 px-5 pt-4 pb-2.5">
          <h3 className="flex items-center gap-2 eyebrow !text-muted">
            {Icon && <Icon className="h-3 w-3" strokeWidth={2} />}
            {title}
          </h3>
          {action}
        </header>
      )}
      <div className={cn(padded && 'px-5 pb-5', !title && padded && 'pt-5')}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'ok' | 'danger' | 'muted' }) {
  return (
    <div className="min-w-0">
      <div className="eyebrow">{label}</div>
      <div className="num mt-2.5 text-[40px]">{value}</div>
      {sub && <div className={cn('meta mt-1.5', tone === 'ok' ? 'text-ok' : tone === 'danger' ? 'text-danger' : 'text-muted')}>{sub}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-line bg-raised px-1 font-mono text-[10px] text-faint">{children}</kbd>;
}

export function SavedIndicator({ status }: { status: 'idle' | 'pending' | 'saving' | 'saved' | 'error' }) {
  const text = { idle: 'All changes saved', pending: 'Editing…', saving: 'Saving…', saved: 'Saved', error: 'Could not save' }[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-mono text-[10.5px]', status === 'error' ? 'text-danger' : 'text-faint')} aria-live="polite">
      <span className={cn('h-1.5 w-1.5 rounded-full', status === 'pending' || status === 'saving' ? 'bg-warn animate-pulse' : status === 'error' ? 'bg-danger' : 'bg-ok')} />
      {text}
    </span>
  );
}
