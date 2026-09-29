'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Ban, CircleCheck, X } from 'lucide-react';
import { TOAST_DURATION_MS } from '@/src/lib/constants';
import { cn } from '@/src/lib/cn';

export interface ToastOptions {
  message: string;
  /** `success` = green check, `blocked` = red "not allowed" (e.g. invalid stage move). */
  kind?: 'success' | 'blocked';
  /** When set, the toast shows an Undo button that calls it. */
  onUndo?: () => void;
}

interface ToastState extends ToastOptions {
  id: number;
}

interface ToastApi {
  show: (options: ToastOptions) => void;
  dismiss: () => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>');
  return api;
}

/** Holds a single toast at a time (a new one replaces the current), as in the design. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const nextId = useRef(0);

  const dismiss = useCallback(() => setToast(null), []);
  const show = useCallback((options: ToastOptions) => {
    nextId.current += 1;
    setToast({ ...options, id: nextId.current });
  }, []);
  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" role="status">
        {toast && <ToastView key={toast.id} toast={toast} onClose={dismiss} />}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  const [paused, setPaused] = useState(false);

  // Auto-dismiss; hovering pauses the timer so the Undo button stays reachable.
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(onClose, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [paused, onClose]);

  const blocked = toast.kind === 'blocked';
  const Icon = blocked ? Ban : CircleCheck;

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={cn(
        'fixed bottom-5.5 left-1/2 z-60 flex max-w-160 -translate-x-1/2 items-center gap-2.5',
        'rounded-toast bg-toast-bg py-2.25 pr-2.5 pl-3.5 text-control text-toast-text shadow-toast',
        'animate-[fp-toast-in_160ms_ease-out]',
      )}
    >
      <Icon
        size={18}
        strokeWidth={1.75}
        className={cn('shrink-0', blocked ? 'text-toast-icon-block' : 'text-toast-icon-ok')}
      />
      <span className="text-pretty">{toast.message}</span>
      {toast.onUndo && (
        <button
          type="button"
          onClick={() => {
            toast.onUndo?.();
            onClose();
          }}
          className={cn(
            'h-control-sm shrink-0 rounded-control border border-toast-border px-2.5 text-sm font-medium text-white',
            'hover:bg-toast-hover focus-visible:outline-none focus-visible:shadow-focus',
          )}
        >
          Undo
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-control-sm text-text-faint',
          'hover:bg-toast-hover hover:text-toast-text focus-visible:outline-none focus-visible:shadow-focus',
        )}
      >
        <X size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
}
