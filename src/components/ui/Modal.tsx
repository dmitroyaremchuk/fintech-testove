'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/src/lib/cn';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Second line under the title (e.g. the deal the action applies to). */
  subtitle?: ReactNode;
  children: ReactNode;
  /** Right-aligned buttons; Cancel first, primary action last. */
  footer?: ReactNode;
  /** `md` 440px (confirmations), `lg` 560px (forms). */
  size?: 'md' | 'lg';
}

/**
 * Centered dialog, 440px. Closes on Esc and overlay click, traps Tab inside,
 * locks page scroll and returns focus to the trigger on close.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex animate-[fp-fade-in_120ms_ease-out] items-center justify-center bg-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'flex max-h-[calc(100vh-48px)] max-w-[calc(100vw-32px)] flex-col rounded-modal bg-surface text-base text-text shadow-modal',
          size === 'lg' ? 'w-modal-lg' : 'w-modal',
        )}
      >
        <div className="px-4.5 pt-4 pb-2.5">
          <h2 id={titleId} className="text-heading font-semibold">
            {title}
          </h2>
          {subtitle && <div className="mt-0.75 text-control text-text-tertiary">{subtitle}</div>}
        </div>
        <div className="min-h-0 overflow-auto px-4.5 pt-1 pb-3">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-border-subtle px-4.5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
