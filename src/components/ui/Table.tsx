'use client';

import { createContext, useContext, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/src/lib/cn';

type Density = 'default' | 'compact' | 'relaxed';

interface TableContextValue {
  columns: string;
  density: Density;
}

const TableContext = createContext<TableContextValue>({ columns: '1fr', density: 'default' });

// 44px clients, 40px pipeline table, 42px minimum for task lists (two-line cells allowed).
const rowHeight: Record<Density, string> = {
  default: 'h-row',
  compact: 'h-row-compact',
  relaxed: 'min-h-row-task',
};

export interface TableProps {
  /** CSS grid-template-columns shared by the header and every row. */
  columns: string;
  density?: Density;
  /** Accessible name for the table. */
  label: string;
  children: ReactNode;
  className?: string;
}

/**
 * Dense grid table. Put it inside a <Card className="overflow-hidden"> to get the design's frame.
 * Columns are shared through context so header and rows always line up.
 */
export function Table({ columns, density = 'default', label, children, className }: TableProps) {
  return (
    <TableContext.Provider value={{ columns, density }}>
      <div role="table" aria-label={label} className={cn('min-w-0', className)}>
        {children}
      </div>
    </TableContext.Provider>
  );
}

export function TableHeader({ children }: { children: ReactNode }) {
  const { columns } = useContext(TableContext);
  return (
    <div role="rowgroup">
      <div
        role="row"
        style={{ gridTemplateColumns: columns }}
        className="grid h-table-header items-center gap-3 border-b border-border-subtle bg-surface-subtle px-3.5 text-meta text-text-muted"
      >
        {children}
      </div>
    </div>
  );
}

export function TableHead({ children, align }: { children?: ReactNode; align?: 'right' }) {
  return (
    <div role="columnheader" className={cn('truncate', align === 'right' && 'text-right')}>
      {children}
    </div>
  );
}

export function TableBody({ children }: { children: ReactNode }) {
  return <div role="rowgroup">{children}</div>;
}

export interface TableRowProps {
  children: ReactNode;
  /** DOM id, e.g. to scroll the keyboard cursor row into view. */
  id?: string;
  /** Makes the row clickable and keyboard-activatable with Enter. */
  onClick?: () => void;
  /** Keyboard cursor / current row. */
  selected?: boolean;
  /** Subtle red wash for flagged rows (e.g. overloaded manager). */
  flagged?: boolean;
  onMouseEnter?: () => void;
  className?: string;
}

export function TableRow({
  id,
  children,
  onClick,
  selected,
  flagged,
  onMouseEnter,
  className,
}: TableRowProps) {
  const { columns, density } = useContext(TableContext);
  const interactive = Boolean(onClick);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && onClick) onClick();
  };
  return (
    <div
      id={id}
      role="row"
      aria-selected={selected || undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? onKeyDown : undefined}
      onMouseEnter={onMouseEnter}
      style={{ gridTemplateColumns: columns }}
      className={cn(
        'grid items-center gap-3 border-b border-border-row px-3.5 tabular-nums',
        rowHeight[density],
        selected ? 'bg-accent-softer' : flagged ? 'bg-danger-row' : 'bg-surface',
        interactive && 'cursor-pointer focus-visible:outline-none focus-visible:shadow-focus-inset',
        interactive && !selected && 'hover:bg-surface-hover',
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface TableCellProps {
  children?: ReactNode;
  align?: 'right';
  /** Secondary text color (industry, region, owner name). */
  muted?: boolean;
  /** Monospace for EDRPOU / tax IDs. */
  mono?: boolean;
  className?: string;
}

export function TableCell({ children, align, muted, mono, className }: TableCellProps) {
  return (
    <div
      role="cell"
      className={cn(
        'min-w-0',
        align === 'right' && 'text-right whitespace-nowrap',
        muted && 'text-text-secondary',
        mono && 'font-mono text-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}
