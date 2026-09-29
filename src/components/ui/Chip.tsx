import type { ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/src/lib/cn';

export interface ChipProps {
  children: ReactNode;
  /** Shows the × button. */
  onRemove?: () => void;
  removeLabel?: string;
  /** `md` = 26px filter chip, `lg` = 28px toolbar chip (pipeline owner filter). */
  size?: 'md' | 'lg';
}

/** Active filter chip, removable. */
export function Chip({
  children,
  onRemove,
  removeLabel = 'Remove filter',
  size = 'md',
}: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-accent-soft text-sm font-medium text-accent-strong',
        size === 'md' ? 'h-control-sm pl-2.25' : 'h-control-md pl-2.5',
        onRemove ? 'pr-1' : 'pr-2.25',
      )}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          title={removeLabel}
          className={cn(
            'inline-flex items-center justify-center rounded-full transition-colors hover:bg-accent-chip-hover',
            'focus-visible:outline-none focus-visible:shadow-focus',
            size === 'md' ? 'size-4.5' : 'size-5',
          )}
        >
          <X size={14} strokeWidth={2} />
        </button>
      )}
    </span>
  );
}

/** Dashed "+ Filter" trigger that opens a preset menu. */
export function AddChip({
  children,
  onClick,
  expanded,
}: {
  children: ReactNode;
  onClick?: () => void;
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      className={cn(
        'inline-flex h-control-sm shrink-0 items-center gap-1 rounded-full border border-dashed border-border-checkbox bg-surface px-2.5',
        'text-sm text-text-secondary transition-colors hover:border-border-hover hover:text-text',
        'focus-visible:outline-none focus-visible:shadow-focus',
      )}
    >
      <Plus size={14} strokeWidth={2} />
      {children}
    </button>
  );
}

/** Read-only token, e.g. quick-add parse preview ("Tomorrow · 15:00", "Client not recognized"). */
export function TokenChip({
  icon,
  muted,
  children,
}: {
  icon?: ReactNode;
  muted?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5.5 items-center gap-1 whitespace-nowrap rounded-full px-2 text-meta font-medium',
        muted ? 'bg-surface-track text-text-muted' : 'bg-accent-softer text-accent-strong',
      )}
    >
      {icon}
      {children}
    </span>
  );
}
