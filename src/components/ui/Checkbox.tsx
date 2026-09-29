import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/src/lib/cn';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible label; visible when `children` is not given. */
  label: string;
  /** `md` 16px (task lists), `sm` 15px (side-card lists). */
  size?: 'md' | 'sm';
  children?: ReactNode;
}

/** Square task checkbox. Native input for a11y, custom box for the look. */
export function Checkbox({ checked, onChange, label, size = 'md', children }: CheckboxProps) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={children ? undefined : label}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          'flex shrink-0 items-center justify-center rounded-badge border-[1.5px] text-white transition-colors',
          'peer-focus-visible:shadow-focus',
          size === 'md' ? 'size-4' : 'size-3.75',
          checked
            ? 'border-accent bg-accent'
            : 'border-border-checkbox bg-surface hover:border-border-hover',
        )}
      >
        {checked && <Check size={size === 'md' ? 12 : 11} strokeWidth={3} />}
      </span>
      {children}
    </label>
  );
}

export interface RadioOptionProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  children: ReactNode;
}

/** Full-width bordered radio row, as in the "Mark deal as lost" reason list. */
export function RadioOption({ name, value, checked, onChange, children }: RadioOptionProps) {
  return (
    <label
      className={cn(
        'flex h-control-lg cursor-pointer items-center gap-2.5 rounded-input border px-2.5 text-base transition-colors',
        'has-[:focus-visible]:shadow-focus',
        checked
          ? 'border-accent bg-accent-softer'
          : 'border-border-strong bg-surface hover:bg-surface-hover',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      <span
        aria-hidden
        className={cn(
          'flex size-3.5 items-center justify-center rounded-full border-[1.5px]',
          checked ? 'border-accent' : 'border-border-checkbox',
        )}
      >
        {checked && <span className="size-1.5 rounded-full bg-accent" />}
      </span>
      {children}
    </label>
  );
}
