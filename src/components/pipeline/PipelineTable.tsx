import { SearchX, Timer } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Truncate,
} from '@/src/components/ui';
import type { DealCard } from '@/src/lib/data/pipeline';
import { formatMoney } from '@/src/lib/format';
import { getStage, stageOrder } from '@/src/lib/rules/stages';

export interface PipelineTableProps {
  cards: DealCard[];
  showOwner: boolean;
  onOpen: (dealId: string) => void;
  onReset: () => void;
}

/** Same deals as the kanban, most advanced stage first. Columns from the design. */
export function PipelineTable({ cards, showOwner, onOpen, onReset }: PipelineTableProps) {
  const rows = [...cards].sort(
    (a, b) => stageOrder(b.deal.stage) - stageOrder(a.deal.stage) || b.daysInStage - a.daysInStage,
  );
  const columns = [
    'minmax(180px,2fr) 170px 100px 120px 96px 60px 120px',
    showOwner ? '140px' : '',
  ].join(' ');

  return (
    <div className="px-6 pb-6">
      <Card className="overflow-hidden">
        <Table columns={columns} density="compact" label="Deals">
          <TableHeader>
            <TableHead>Client</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Product</TableHead>
            <TableHead align="right">Amount</TableHead>
            <TableHead align="right">In stage</TableHead>
            <TableHead align="right">Prob.</TableHead>
            <TableHead align="right">Exp. commission</TableHead>
            {showOwner && <TableHead>Owner</TableHead>}
          </TableHeader>
          <TableBody>
            {rows.map((c) => {
              const stage = getStage(c.deal.stage);
              return (
                <TableRow key={c.deal.id} onClick={() => onOpen(c.deal.id)}>
                  <TableCell>
                    <Truncate className="font-medium">{c.client?.name ?? '—'}</Truncate>
                  </TableCell>
                  <TableCell>
                    <Badge tone={stage.tone}>{stage.label}</Badge>
                  </TableCell>
                  <TableCell muted>{c.deal.product}</TableCell>
                  <TableCell align="right">{formatMoney(c.deal.requestedAmount)}</TableCell>
                  <TableCell
                    align="right"
                    className={c.stuck ? 'font-medium text-danger' : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.stuck && <Timer size={13} strokeWidth={2} />}
                      {c.daysInStage} / {c.slaDays} d
                    </span>
                  </TableCell>
                  <TableCell align="right" className="text-text-tertiary">
                    {Math.round(stage.probability * 100)}%
                  </TableCell>
                  <TableCell align="right">{formatMoney(c.weighted)}</TableCell>
                  {showOwner && (
                    <TableCell muted>
                      <Truncate>{c.owner?.name ?? '—'}</Truncate>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <EmptyState
                variant="inline"
                icon={<SearchX size={24} strokeWidth={1.75} />}
                title="No deals match the filters"
                actions={
                  <Button size="md" onClick={onReset}>
                    Reset filters
                  </Button>
                }
              />
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
