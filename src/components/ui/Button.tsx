import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/src/lib/cn';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'secondary-danger'
  | 'accent-outline'
  | 'success'
  | 'warning'
  | 'danger'
  | 'warning-outline'
  | 'danger-outline'
  | 'link'
  | 'link-muted';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

const base =
  'inline-flex shrink-0 items-center justify-center whitespace-nowrap border transition-colors ' +
  'focus-visible:outline-none focus-visible:shadow-focus disabled:cursor-not-allowed';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-accent border-accent text-white font-medium hover:bg-accent-hover hover:border-accent-hover ' +
    'disabled:bg-accent-disabled disabled:border-accent-disabled',
  secondary:
    'bg-surface border-border-strong text-text hover:bg-bg focus-visible:border-accent ' +
    'disabled:text-text-disabled disabled:hover:bg-surface',
  'secondary-danger':
    'bg-surface border-border-strong text-danger hover:bg-bg focus-visible:border-accent',
  'accent-outline':
    'bg-surface border-accent text-accent hover:bg-accent-softer disabled:border-accent-disabled',
  success: 'bg-success border-success text-white font-medium hover:brightness-95',
  warning: 'bg-warning border-warning text-white hover:brightness-95',
  danger:
    'bg-danger border-danger text-white font-medium hover:brightness-95 ' +
    'disabled:bg-danger-disabled disabled:border-danger-disabled disabled:hover:brightness-100',
  'warning-outline':
    'bg-surface border-warning-border-strong text-warning-text hover:bg-warning-soft',
  'danger-outline': 'bg-surface border-danger-border-strong text-danger-text hover:bg-danger-soft',
  link: 'border-transparent bg-transparent text-accent hover:text-accent-hover hover:underline',
  'link-muted': 'border-transparent bg-transparent text-text-muted hover:text-text',
};

// Heights and paddings from the design: 24 row actions, 26 banners/cards, 28 toolbars, 30 default.
const sizes: Record<ButtonSize, string> = {
  xs: 'h-control-xs px-2 gap-0.75 rounded-control-sm text-meta',
  sm: 'h-control-sm px-2.5 gap-1 rounded-control text-sm',
  md: 'h-control-md px-2.5 gap-1.25 rounded-control text-sm',
  lg: 'h-control px-3 gap-1.5 rounded-control text-control',
};

const linkSize = 'h-auto p-0 gap-1 text-sm';

const iconSize: Record<ButtonSize, number> = { xs: 13, sm: 15, md: 15, lg: 16 };

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon component (e.g. from lucide-react). Sized automatically. */
  icon?: (props: { size?: number; strokeWidth?: number }) => ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'lg',
  icon: Icon,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const isLink = variant === 'link' || variant === 'link-muted';
  return (
    <button
      type={type}
      className={cn(base, variants[variant], isLink ? linkSize : sizes[size], className)}
      {...rest}
    >
      {Icon && <Icon size={iconSize[size]} strokeWidth={1.75} />}
      {children}
    </button>
  );
}

export interface IconButtonProps extends ComponentProps<'button'> {
  /** Accessible name; also shown as the native tooltip. */
  label: string;
  /** `outlined` = top-bar bell (32px, bordered); `ghost` = close buttons (24px). */
  variant?: 'outlined' | 'ghost';
  children: ReactNode;
}

export function IconButton({
  label,
  variant = 'ghost',
  className,
  type = 'button',
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center transition-colors',
        'focus-visible:outline-none focus-visible:shadow-focus',
        variant === 'outlined'
          ? 'size-8 rounded-input border border-border bg-surface text-text-secondary hover:bg-bg'
          : 'size-6 rounded-control-sm text-text-faint hover:bg-surface-hover-menu hover:text-text',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
