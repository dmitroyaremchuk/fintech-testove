'use client';

import { useCallback, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/src/lib/cn';

const SHOW_DELAY_MS = 350;
const GAP_PX = 6;
const VIEWPORT_MARGIN_PX = 8;

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  /** Only show when the wrapped text is actually cut off by `truncate`. */
  onlyWhenTruncated?: boolean;
  /** Classes for the trigger wrapper (e.g. `truncate min-w-0` for table cells). */
  className?: string;
}

interface Position {
  top: number;
  left: number;
  placement: 'top' | 'bottom';
}

/**
 * Dark hint on hover or keyboard focus, rendered in a portal so table/card
 * `overflow: hidden` never clips it. Prefers above the trigger, flips below near the top edge.
 */
export function Tooltip({ content, children, onlyWhenTruncated, className }: TooltipProps) {
  const id = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Position | null>(null);

  const show = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    if (onlyWhenTruncated && el.scrollWidth <= el.clientWidth) return;
    timer.current = setTimeout(() => setOpen(true), SHOW_DELAY_MS);
  }, [onlyWhenTruncated]);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
    setPos(null);
  }, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !tipRef.current) return;
    const t = triggerRef.current.getBoundingClientRect();
    const tip = tipRef.current.getBoundingClientRect();
    const placement = t.top - tip.height - GAP_PX < VIEWPORT_MARGIN_PX ? 'bottom' : 'top';
    const top = placement === 'top' ? t.top - tip.height - GAP_PX : t.bottom + GAP_PX;
    const centered = t.left + t.width / 2 - tip.width / 2;
    const maxLeft = window.innerWidth - tip.width - VIEWPORT_MARGIN_PX;
    setPos({ top, left: Math.max(VIEWPORT_MARGIN_PX, Math.min(centered, maxLeft)), placement });
  }, [open]);

  return (
    <>
      <span
        ref={triggerRef}
        className={cn('inline-block max-w-full align-bottom', className)}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        aria-describedby={open ? id : undefined}
      >
        {children}
      </span>
      {open &&
        createPortal(
          <div
            ref={tipRef}
            id={id}
            role="tooltip"
            style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }}
            className={cn(
              'pointer-events-none fixed z-70 max-w-72 rounded-control-sm bg-toast-bg px-2 py-1',
              'text-meta text-toast-text shadow-menu text-pretty',
              pos && 'animate-[fp-fade-in_120ms_ease-out]',
            )}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}

/** Single-line text that ellipsizes and reveals the full value in a tooltip when cut off. */
export function Truncate({ children, className }: { children: string; className?: string }) {
  return (
    <Tooltip content={children} onlyWhenTruncated className={cn('min-w-0 truncate', className)}>
      {children}
    </Tooltip>
  );
}
