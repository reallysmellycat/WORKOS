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
  primary: 'bg-accent text-accent-fg hover:brightness-[1.06] active:brightness-95 shadow-soft',
  secondary: 'bg-raised border border-line text-fg hover:border-line-strong hover:bg-surface shadow-soft',
  ghost: 'text-muted hover:text-fg hover:bg-sunken/70',
  subtle: 'bg-sunken/70 text-fg hover:bg-sunken',
  danger: 'bg-danger text-white hover:brightness-110',
};
const SIZES: Record<Size, string> = {
  xs: 'h-6 px-2 text-xs gap-1',
  sm: 'h-7 px-2.5 text-[12.5px] gap-1.5',
  md: 'h-8 px-3 text-[13px] gap-1.5',
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
        'inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap transition-all disabled:opacity-45 disabled:pointer-events-none select-none',
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
    useEffect(() => grow(inner.current));
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

export function Checkbox({ checked, onChange, label, className, size = 'md', tone }: { checked: boolean; onChange: (v: boolean) => void; label?: string; className?: string; size?: 'sm' | 'md'; tone?: string }) {
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
        'shrink-0 inline-flex items-center justify-center rounded-full border transition-all',
        size === 'sm' ? 'h-3.5 w-3.5' : 'h-[17px] w-[17px]',
        checked ? 'bg-accent border-accent text-accent-fg' : cn('border-line-strong hover:border-accent bg-raised', tone),
        className,
      )}
    >
      {checked && <Check className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} strokeWidth={3} />}
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
  neutral: 'bg-sunken text-muted',
  muted: 'bg-sunken text-muted',
  accent: 'bg-accent-soft text-accent',
  info: 'bg-info/10 text-info',
  warn: 'bg-warn/15 text-warn',
  danger: 'bg-danger/10 text-danger',
  ok: 'bg-ok/15 text-ok',
};
export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded px-1.5 h-[19px] text-2xs font-medium whitespace-nowrap', TONES[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}

export function DemoBadge() {
  return (
    <span className="inline-flex items-center rounded border border-dashed border-line-strong px-1 text-[10px] font-medium uppercase tracking-wider text-faint" title="Demo content — remove it in Settings → Data">
      Demo
    </span>
  );
}

export function Tag({ name, color, onRemove }: { name: string; color?: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-raised px-2 h-[20px] text-2xs text-muted">
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
export function Progress({ value, className, tone = 'accent' }: { value: number; className?: string; tone?: 'accent' | 'ok' | 'warn' }) {
  const bg = tone === 'ok' ? 'bg-ok' : tone === 'warn' ? 'bg-warn' : 'bg-accent';
  return (
    <div className={cn('h-1.5 w-full rounded-full bg-sunken overflow-hidden', className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-all duration-500', bg)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Ring({ value, size = 36, stroke = 3.5, label }: { value: number; size?: number; stroke?: number; label?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--sunken))" strokeWidth={stroke} />
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
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute text-[10px] font-semibold tabular-nums text-muted">{label ?? `${Math.round(value)}`}</span>
    </div>
  );
}

// ---------- Empty state ----------
export function Empty({ icon: Icon, title, children, action, compact }: { icon?: LucideIcon; title: string; children?: ReactNode; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'py-6 px-4' : 'py-14 px-6')}>
      {Icon && (
        <div className={cn('mb-3 flex items-center justify-center rounded-xl bg-sunken text-faint', compact ? 'h-8 w-8' : 'h-11 w-11')}>
          <Icon className={compact ? 'h-4 w-4' : 'h-5 w-5'} strokeWidth={1.6} />
        </div>
      )}
      <p className={cn('font-medium text-fg', compact ? 'text-[13px]' : 'text-sm')}>{title}</p>
      {children && <p className="mt-1 max-w-sm text-[13px] text-muted leading-relaxed">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn('inline-block h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-accent', className)} />;
}

export function Loading() {
  return (
    <div className="flex h-40 items-center justify-center">
      <Spinner />
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
      <div className="absolute inset-0 bg-black/25 dark:bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cn('relative w-full rounded-xl border border-line bg-surface shadow-pop animate-in max-h-[80vh] flex flex-col', width)}>
        {title && (
          <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
            <div>
              <h2 className="text-[15px] font-semibold">{title}</h2>
              {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
            </div>
            <IconButton icon={X} label="Close" onClick={onClose} className="-mr-1.5 -mt-0.5" />
          </div>
        )}
        <div className="px-5 pb-4 overflow-y-auto">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3 bg-raised/50 rounded-b-xl">{footer}</div>}
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
      <div className="absolute inset-0 bg-black/15 dark:bg-black/40" onClick={onClose} />
      <div className={cn('relative h-full w-full border-l border-line bg-surface shadow-pop flex flex-col animate-in', width)}>{children}</div>
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
        <div className={cn('absolute z-30 mt-1 rounded-lg border border-line bg-raised p-1 shadow-pop animate-in', width, align === 'right' ? 'right-0' : 'left-0')} role="menu">
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
export function Tabs<T extends string>({ value, onChange, tabs, className }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string; icon?: LucideIcon; count?: number }[]; className?: string }) {
  return (
    <div className={cn('flex items-center gap-0.5 rounded-lg bg-sunken/70 p-0.5 w-fit max-w-full overflow-x-auto', className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          type="button"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 h-7 text-[12.5px] font-medium transition-all whitespace-nowrap',
            value === t.value ? 'bg-raised text-fg shadow-soft' : 'text-muted hover:text-fg',
          )}
        >
          {t.icon && <t.icon className="h-3.5 w-3.5" />}
          {t.label}
          {t.count !== undefined && <span className="text-faint tabular-nums">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ---------- Layout ----------
export function PageHeader({ title, subtitle, actions, icon: Icon }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          {Icon && <Icon className="h-5 w-5 text-faint" strokeWidth={1.8} />}
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Page({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn('mx-auto w-full px-4 sm:px-8 py-6 sm:py-8', wide ? 'max-w-[1440px]' : 'max-w-[1180px]', className)}>{children}</div>;
}

export function Card({ children, className, title, action, icon: Icon, padded = true }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; icon?: LucideIcon; padded?: boolean }) {
  return (
    <section className={cn('card', className)}>
      {title && (
        <header className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2">
          <h3 className="flex items-center gap-1.5 text-[13px] font-semibold">
            {Icon && <Icon className="h-3.5 w-3.5 text-faint" strokeWidth={2} />}
            {title}
          </h3>
          {action}
        </header>
      )}
      <div className={cn(padded && 'px-4 pb-4', !title && padded && 'pt-4')}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'ok' | 'danger' | 'muted' }) {
  return (
    <div className="min-w-0">
      <div className="text-2xs font-medium uppercase tracking-[0.06em] text-faint">{label}</div>
      <div className="mt-1 text-[22px] font-semibold tracking-tight tabular-nums leading-none">{value}</div>
      {sub && <div className={cn('mt-1 text-xs', tone === 'ok' ? 'text-ok' : tone === 'danger' ? 'text-danger' : 'text-muted')}>{sub}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-line bg-raised px-1 text-[10px] font-medium text-faint font-sans">{children}</kbd>;
}

export function SavedIndicator({ status }: { status: 'idle' | 'pending' | 'saving' | 'saved' | 'error' }) {
  const text = { idle: 'All changes saved', pending: 'Editing…', saving: 'Saving…', saved: 'Saved', error: 'Could not save' }[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs', status === 'error' ? 'text-danger' : 'text-faint')} aria-live="polite">
      <span className={cn('h-1.5 w-1.5 rounded-full', status === 'pending' || status === 'saving' ? 'bg-warn animate-pulse' : status === 'error' ? 'bg-danger' : 'bg-ok')} />
      {text}
    </span>
  );
}
