'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
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
  /**
   * Render the panel over the page (fixed position) instead of inside the anchor's box —
   * for anchors in scrolling or `overflow: hidden` containers such as kanban columns.
   * Closes when the page scrolls.
   */
  portal?: boolean;
}

const GAP_PX = 4;

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
  portal = false,
}: PopoverProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const [fixed, setFixed] = useState<{ top: number; left?: number; right?: number } | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onCloseRef.current();
    };
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      onCloseRef.current();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    if (portal) {
      window.addEventListener('scroll', onScroll, true);
      window.addEventListener('resize', onScroll);
    }
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, portal]);

  useLayoutEffect(() => {
    if (!open || !portal || !rootRef.current) return;
    const r = rootRef.current.getBoundingClientRect();
    const panelHeight = panelRef.current?.offsetHeight ?? 0;
    const top = side === 'bottom' ? r.bottom + GAP_PX : r.top - GAP_PX - panelHeight;
    setFixed(
      align === 'left' ? { top, left: r.left } : { top, right: window.innerWidth - r.right },
    );
  }, [open, portal, align, side]);

  const panelClass = cn(
    'z-30 rounded-card border border-border-strong bg-surface p-1 shadow-menu',
    'animate-[fp-fade-in_100ms_ease-out]',
    className,
  );

  return (
    <div ref={rootRef} className={cn('relative', wrapperClassName)}>
      {anchor}
      {open && !portal && (
        <div
          ref={panelRef}
          className={cn(
            'absolute',
            align === 'left' ? 'left-0' : 'right-0',
            side === 'bottom' ? 'top-full mt-1' : 'bottom-full mb-1',
            panelClass,
          )}
        >
          {children}
        </div>
      )}
      {open &&
        portal &&
        createPortal(
          <div
            ref={panelRef}
            className={cn('fixed', panelClass, !fixed && 'invisible')}
            style={fixed ?? { top: 0, left: 0 }}
          >
            {children}
          </div>,
          document.body,
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
