import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { Button, Input, Modal } from './ui';
import { cn } from '@/lib/utils';

// ---------- Toasts ----------
interface Toast {
  id: number;
  message: string;
  tone: 'ok' | 'error' | 'info';
  action?: { label: string; onClick: () => void };
}

interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  /** If set, the user must type this text to confirm (for very destructive actions). */
  typeToConfirm?: string;
}

interface FeedbackCtx {
  toast: (message: string, opts?: { tone?: Toast['tone']; action?: Toast['action'] }) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const Ctx = createContext<FeedbackCtx | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const [typed, setTyped] = useState('');
  const n = useRef(0);

  const toast = useCallback<FeedbackCtx['toast']>((message, opts = {}) => {
    const id = ++n.current;
    setToasts((t) => [...t.slice(-3), { id, message, tone: opts.tone ?? 'ok', action: opts.action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.action ? 6500 : 3200);
  }, []);

  const confirm = useCallback<FeedbackCtx['confirm']>(
    (opts) =>
      new Promise<boolean>((resolve) => {
        setTyped('');
        setDialog({ ...opts, resolve });
      }),
    [],
  );

  const close = (v: boolean) => {
    dialog?.resolve(v);
    setDialog(null);
  };

  const blocked = !!dialog?.typeToConfirm && typed.trim() !== dialog.typeToConfirm;

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}
      <Modal
        open={!!dialog}
        onClose={() => close(false)}
        title={
          dialog && (
            <span className="flex items-center gap-2">
              {dialog.danger && <AlertTriangle className="h-4 w-4 text-danger" />}
              {dialog.title}
            </span>
          )
        }
        width="max-w-md"
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button variant={dialog?.danger ? 'danger' : 'primary'} disabled={blocked} onClick={() => close(true)} autoFocus>
              {dialog?.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      >
        {dialog?.message && <div className="text-body-s text-muted leading-relaxed">{dialog.message}</div>}
        {dialog?.typeToConfirm && (
          <div className="mt-3">
            <p className="mb-1.5 text-body-s text-muted">
              Type <strong className="text-fg">{dialog.typeToConfirm}</strong> to confirm.
            </p>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
          </div>
        )}
      </Modal>
      {createPortal(
        <div className="fixed bottom-[76px] right-4 z-[60] flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))] min-[901px]:bottom-4" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className="flex items-center gap-2.5 rounded-md border border-line bg-raised px-3 py-2.5 shadow-lg animate-in text-body-s">
              {t.tone === 'ok' ? <CheckCircle2 className="h-4 w-4 text-ok shrink-0" /> : t.tone === 'error' ? <AlertTriangle className="h-4 w-4 text-danger shrink-0" /> : <Info className="h-4 w-4 text-info shrink-0" />}
              <span className={cn('flex-1', t.tone === 'error' && 'text-danger')}>{t.message}</span>
              {t.action && (
                <button
                  className="font-medium text-accent-deep hover:underline"
                  onClick={() => {
                    t.action!.onClick();
                    setToasts((x) => x.filter((y) => y.id !== t.id));
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button className="text-faint hover:text-fg" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} aria-label="Dismiss">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </Ctx.Provider>
  );
}

export function useFeedback() {
  const c = useContext(Ctx);
  if (!c) throw new Error('FeedbackProvider missing');
  return c;
}
