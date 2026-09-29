import { cn } from '@/src/lib/cn';

/** "Agro-Skhid LLC" → "AS", "Olena Koval" → "OK". Matches the design's ini() helper. */
export function initials(name: string): string {
  return name
    .replace(/[«»"“”]/g, '')
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

// Pixel sizes and initials font sizes as they appear in the design.
const sizes = {
  xs: 'size-4.5 text-avatar-xs', // 18: deal/client header owner
  sm: 'size-5 text-avatar-sm', // 20: table owner, kanban card owner
  md: 'size-6 text-tiny', // 24: client row, workload row
  lg: 'size-7 text-caption', // 28: sidebar profile
  xl: 'size-8 text-caption', // 32: team card
  '2xl': 'size-11 text-heading', // 44: client card header
};

// Squares are rounder as they grow: 5px at 22–24px, 9px at 44px.
const squareRadius: Record<keyof typeof sizes, string> = {
  xs: 'rounded-control-sm',
  sm: 'rounded-control-sm',
  md: 'rounded-control-sm',
  lg: 'rounded-control',
  xl: 'rounded-input',
  '2xl': 'rounded-toast',
};

export interface AvatarProps {
  name: string;
  size?: keyof typeof sizes;
  /** `circle` = people, `square` = companies and banks. */
  shape?: 'circle' | 'square';
  /** `accent` = owner/current user, `neutral` = everything else. */
  tone?: 'accent' | 'neutral';
  /** Show the full name as a native tooltip (e.g. owner avatar without a label). */
  showTitle?: boolean;
  className?: string;
}

export function Avatar({
  name,
  size = 'md',
  shape = 'circle',
  tone = 'neutral',
  showTitle,
  className,
}: AvatarProps) {
  return (
    <span
      title={showTitle ? name : undefined}
      aria-hidden={!showTitle}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center font-semibold leading-none',
        sizes[size],
        shape === 'circle' ? 'rounded-full' : squareRadius[size],
        tone === 'accent'
          ? 'bg-accent-ring text-accent-strong'
          : 'bg-surface-muted text-text-secondary',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
