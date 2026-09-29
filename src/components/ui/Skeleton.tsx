import { cn } from '@/src/lib/cn';
import { Card } from './Card';

/** Placeholder block. Size and radius come from className. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('animate-pulse rounded-badge bg-surface-skeleton', className)} />
  );
}

// Bar widths from the design's loading state, so the rows look irregular.
const ROW_WIDTHS = ['72%', '54%', '88%', '40%', '66%', '80%', '48%', '70%'];

/** List rows: square icon + text bar. Use inside a card or table body. */
export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3.5">
      {ROW_WIDTHS.slice(0, rows).map((width) => (
        <div key={width} className="flex items-center gap-3">
          <Skeleton className="size-5.5 shrink-0 rounded-control-sm" />
          <div className="flex-1">
            <Skeleton className="h-2.5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Full-screen loading state from the design: 4 KPI tiles, then a card of rows. */
export function LoadingState({ tiles = 4, rows = 8 }: { tiles?: number; rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-3">
      {tiles > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: tiles }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-card" />
          ))}
        </div>
      )}
      <Card className="p-4">
        <SkeletonRows rows={rows} />
      </Card>
    </div>
  );
}
