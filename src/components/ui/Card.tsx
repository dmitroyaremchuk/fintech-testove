import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/src/lib/cn';

export function Card({ className, ...rest }: ComponentProps<'div'>) {
  return (
    <div className={cn('rounded-card border border-border bg-surface', className)} {...rest} />
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  /** "Helps decide: …" line under the title. */
  caption?: ReactNode;
  /** Right-aligned slot: link, button, segmented control. */
  action?: ReactNode;
  /** `compact` is used by side-column cards (10px vertical padding). */
  compact?: boolean;
}

export function CardHeader({ title, caption, action, compact }: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 border-b border-border-subtle px-3.5',
        compact ? 'py-2.5' : 'py-3',
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 font-semibold">{title}</div>
        {caption && <div className="mt-0.5 text-meta text-text-muted">{caption}</div>}
      </div>
      {action && <div className="flex shrink-0 items-center">{action}</div>}
    </div>
  );
}
