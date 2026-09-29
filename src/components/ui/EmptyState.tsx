import type { ReactNode } from 'react';
import { CloudOff } from 'lucide-react';
import { cn } from '@/src/lib/cn';
import { Button } from './Button';

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  /** Buttons; the first is usually primary. */
  actions?: ReactNode;
  /** Small monospace line under the actions (error code, timestamp). */
  footnote?: ReactNode;
  /** `page` replaces a whole screen; `inline` sits inside a card or table. */
  variant?: 'page' | 'inline';
  tone?: 'neutral' | 'danger';
}

export function EmptyState({
  icon,
  title,
  description,
  actions,
  footnote,
  variant = 'page',
  tone = 'neutral',
}: EmptyStateProps) {
  if (variant === 'inline') {
    return (
      <div className="flex flex-col items-center gap-2 p-10 text-center">
        <span className="text-text-disabled">{icon}</span>
        <div className="font-medium">{title}</div>
        {description && <div className="text-sm text-text-muted">{description}</div>}
        {actions && <div className="mt-1 flex gap-2">{actions}</div>}
      </div>
    );
  }
  return (
    <div className="mx-auto my-18 flex max-w-105 flex-col items-center gap-2.5 text-center">
      <span
        className={cn(
          'flex size-11 items-center justify-center rounded-modal',
          tone === 'danger' ? 'bg-danger-bg text-danger' : 'bg-surface-muted text-text-muted',
        )}
      >
        {icon}
      </span>
      <div className="text-heading font-semibold">{title}</div>
      {description && <div className="text-pretty text-text-tertiary">{description}</div>}
      {actions && <div className="mt-1.5 flex gap-2">{actions}</div>}
      {footnote && <div className="font-mono text-caption text-text-faint">{footnote}</div>}
    </div>
  );
}

export interface ErrorStateProps {
  onRetry: () => void;
  onReport?: () => void;
  /** e.g. "code: NET_TIMEOUT · 29.09 10:14" */
  code?: string;
}

/** Screen-level load failure, copy as in the design. */
export function ErrorState({ onRetry, onReport, code }: ErrorStateProps) {
  return (
    <EmptyState
      tone="danger"
      icon={<CloudOff size={22} strokeWidth={1.75} />}
      title="Couldn’t load data"
      description="Check your connection. Changes made before the failure are saved locally and will sync automatically."
      actions={
        <>
          <Button variant="primary" onClick={onRetry}>
            Try again
          </Button>
          {onReport && <Button onClick={onReport}>Report a problem</Button>}
        </>
      }
      footnote={code}
    />
  );
}
