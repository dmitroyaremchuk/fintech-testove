import type { ReactNode } from 'react';
import { Zap } from 'lucide-react';
import type { Tone } from '@/src/lib/constants';
import { cn } from '@/src/lib/cn';

// Static class map so Tailwind can see every tone class at build time.
export const toneClasses: Record<Tone, string> = {
  gray: 'bg-tone-gray-bg text-tone-gray-fg',
  blue: 'bg-tone-blue-bg text-tone-blue-fg',
  amber: 'bg-tone-amber-bg text-tone-amber-fg',
  green: 'bg-tone-green-bg text-tone-green-fg',
  red: 'bg-tone-red-bg text-tone-red-fg',
  violet: 'bg-tone-violet-bg text-tone-violet-fg',
  teal: 'bg-tone-teal-bg text-tone-teal-fg',
};

// md: tables, headers · sm: dense lists (client card deals, offers) · xs: inline flags ("Duplicate")
const sizes = {
  md: 'px-1.75 py-0.5 text-meta',
  sm: 'px-1.5 py-px text-caption',
  xs: 'px-1.5 py-px text-micro',
};

export interface BadgeProps {
  tone?: Tone;
  size?: keyof typeof sizes;
  icon?: ReactNode;
  title?: string;
  className?: string;
  children: ReactNode;
}

export function Badge({
  tone = 'gray',
  size = 'md',
  icon,
  title,
  className,
  children,
}: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-badge font-medium',
        toneClasses[tone],
        sizes[size],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** Rounded counter: "Deals at risk (3)", sidebar nav counts. */
export function CountBadge({
  tone = 'gray',
  className,
  children,
}: {
  tone?: 'gray' | 'red';
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-4.5 min-w-5 items-center justify-center rounded-full px-1.5 text-caption font-medium tabular-nums',
        tone === 'red' ? 'bg-danger-bg text-danger' : 'bg-surface-muted text-text-tertiary',
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Marks records created by a rule.
 * `icon` (task lists) shows a bolt + "auto"; `mono` (timeline) is the plain monospace tag.
 */
export function AutoTag({ variant = 'icon' }: { variant?: 'icon' | 'mono' }) {
  if (variant === 'mono') {
    return (
      <span className="shrink-0 rounded-track border border-border px-1 font-mono text-micro text-text-faint">
        auto
      </span>
    );
  }
  return (
    <span
      title="Created automatically by a rule"
      className="inline-flex h-4.5 shrink-0 items-center gap-0.5 rounded-badge border border-border px-1.25 text-micro text-text-muted"
    >
      <Zap size={11} strokeWidth={2} />
      auto
    </span>
  );
}
