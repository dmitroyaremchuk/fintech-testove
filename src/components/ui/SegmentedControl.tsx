import type { ReactNode } from 'react';
import { cn } from '@/src/lib/cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Extra attributes per segment, e.g. `{ 'data-role-option': 'head' }` for scripts/tests. */
  attrs?: Record<`data-${string}`, string>;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  /** `md` 26px (role switch), `sm` 24px (view toggles in card headers). */
  size?: 'md' | 'sm';
  /** Role switch uses medium weight; view toggles use regular. */
  emphasis?: boolean;
}

/** Pill-in-track toggle: Manager/Head, Kanban/Table, All/Manual/Automatic. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  emphasis,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex gap-0.5 rounded-input bg-surface-muted p-0.5"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            {...option.attrs}
            className={cn(
              'rounded-control-sm px-2.5 whitespace-nowrap transition-colors',
              'focus-visible:outline-none focus-visible:shadow-focus',
              size === 'md' ? 'h-control-sm text-control' : 'h-control-xs text-sm',
              emphasis && 'font-medium',
              active
                ? 'bg-surface text-text shadow-segment'
                : 'bg-transparent text-text-tertiary hover:text-text',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
