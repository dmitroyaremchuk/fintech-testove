'use client';

import { useId, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/src/lib/cn';

const focus = 'focus:outline-none focus:border-accent focus:shadow-focus';
const invalidCls = 'border-danger focus:border-danger focus:shadow-focus-danger';

/** Keyboard hint: "/", "⌘K", "Enter". */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center rounded-badge border border-border-strong bg-surface px-1.25 font-mono text-micro font-normal leading-4 text-text-muted',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  /** Renders the label on the left, as in the design's "Sort" and "Log in as" controls. */
  inline?: boolean;
  children: (props: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

/** Label + control + hint/error. Pass the control as a render function to wire ids. */
export function Field({ label, hint, error, inline, children }: FieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;
  return (
    <div className={cn('flex', inline ? 'items-center gap-1.5' : 'flex-col gap-1')}>
      <label htmlFor={id} className="text-sm text-text-muted">
        {label}
      </label>
      {children({ id, describedBy: note ? noteId : undefined, invalid: Boolean(error) })}
      {note && !inline && (
        <span id={noteId} className={cn('text-meta', error ? 'text-danger' : 'text-text-faint')}>
          {note}
        </span>
      )}
    </div>
  );
}

export interface TextInputProps extends Omit<ComponentProps<'input'>, 'size'> {
  /** `md` = 30px default, `sm` = 26px (inline edit in details panel). */
  size?: 'md' | 'sm';
  /** `subtle` = top-bar search look (off-white fill, lighter border). */
  variant?: 'default' | 'subtle';
  leading?: ReactNode;
  trailing?: ReactNode;
  invalid?: boolean;
}

export function TextInput({
  size = 'md',
  variant = 'default',
  leading,
  trailing,
  invalid,
  className,
  ...rest
}: TextInputProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 border px-2.5 text-control transition-[border-color,box-shadow]',
        'focus-within:border-accent focus-within:shadow-focus',
        size === 'md' ? 'h-control rounded-input' : 'h-control-sm rounded-control-sm px-1.5',
        variant === 'subtle'
          ? 'border-border bg-surface-subtle'
          : 'border-border-strong bg-surface',
        invalid && 'border-danger focus-within:border-danger focus-within:shadow-focus-danger',
        className,
      )}
    >
      {leading && <span className="flex shrink-0 text-text-faint">{leading}</span>}
      <input
        aria-invalid={invalid || undefined}
        className="min-w-0 flex-1 bg-transparent text-text outline-none placeholder:text-text-faint"
        {...rest}
      />
      {trailing && <span className="flex shrink-0">{trailing}</span>}
    </div>
  );
}

export interface TextareaProps extends ComponentProps<'textarea'> {
  invalid?: boolean;
}

export function Textarea({ invalid, className, ...rest }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(
        'w-full resize-y rounded-input border border-border-strong bg-surface-subtle px-2.5 py-2',
        'text-control text-text placeholder:text-text-faint focus:bg-surface',
        focus,
        invalid && invalidCls,
        className,
      )}
      {...rest}
    />
  );
}

export interface SelectProps extends Omit<ComponentProps<'select'>, 'size'> {
  /** `lg` 30px (top bar), `md` 28px (toolbars), `sm` 26px (inline in rows). */
  size?: 'lg' | 'md' | 'sm';
}

const selectSizes = {
  lg: 'h-control text-control px-1.5 rounded-control',
  md: 'h-control-md text-sm px-1 rounded-control',
  sm: 'h-control-sm text-sm px-1 rounded-control-sm',
};

export function Select({ size = 'lg', className, ...rest }: SelectProps) {
  return (
    <select
      className={cn(
        'border border-border-strong bg-surface text-text',
        focus,
        selectSizes[size],
        className,
      )}
      {...rest}
    />
  );
}

/** Commission slider (1–3%). Native range tinted with the accent color. */
export function Slider(props: Omit<ComponentProps<'input'>, 'type'>) {
  return <input type="range" className="flex-1 accent-accent" {...props} />;
}
