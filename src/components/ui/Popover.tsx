'use client';

import { useEffect, useRef, type KeyboardEvent, type ReactNode, type ComponentType } from 'react';
import { cn } from '@/src/lib/cn';

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  /** The trigger; the panel is positioned relative to this wrapper. */
  anchor: ReactNode;
  children: ReactNode;
  /** Horizontal edge the panel lines up with, and whether it opens below or above. */
  align?: 'left' | 'right';
  side?: 'bottom' | 'top';
  className?: string;
  /** Classes for the wrapper around anchor + panel (e.g. `w-full`). */
  wrapperClassName?: string;
}

/**
 * Floating panel for menus and search results. Closes on Esc and on clicks outside the anchor
 * or panel. Style from the design: white, strong border, 8px radius, menu shadow.
 */
export function Popover({
  open,
  onClose,
  anchor,
  children,
  align = 'left',
  side = 'bottom',
  className,
  wrapperClassName,
}: PopoverProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onCloseRef.current();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative', wrapperClassName)}>
      {anchor}
      {open && (
        <div
          className={cn(
            'absolute z-30 rounded-card border border-border-strong bg-surface p-1 shadow-menu',
            'animate-[fp-fade-in_100ms_ease-out]',
            align === 'left' ? 'left-0' : 'right-0',
            side === 'bottom' ? 'top-full mt-1' : 'bottom-full mb-1',
            className,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** Menu list with Up/Down keyboard navigation between items. */
export function Menu({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'ArrowDown' ? index + 1 : index - 1;
    items[(next + items.length) % items.length]?.focus();
  };

  return (
    <div ref={ref} role="menu" aria-label={label} onKeyDown={onKeyDown} className="flex flex-col">
      {children}
    </div>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pt-2 pb-1.5 text-meta text-text-muted">{children}</div>;
}

export interface MenuItemProps {
  icon?: ComponentType<{ size?: number; strokeWidth?: number }>;
  onSelect: () => void;
  children: ReactNode;
  /** Muted helper text on the right, e.g. a shortcut. */
  hint?: ReactNode;
}

export function MenuItem({ icon: Icon, onSelect, children, hint }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={cn(
        'flex h-7.5 w-full items-center gap-2 rounded-control-sm px-2.5 text-left text-control text-text',
        'hover:bg-surface-hover-menu focus-visible:bg-surface-hover-menu focus-visible:outline-none',
      )}
    >
      {Icon && <Icon size={16} strokeWidth={1.75} />}
      <span className="flex-1 truncate">{children}</span>
      {hint && <span className="text-meta text-text-faint">{hint}</span>}
    </button>
  );
}
