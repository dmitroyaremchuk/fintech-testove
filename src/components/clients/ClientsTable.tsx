import type { ReactNode } from 'react';
import { SearchX } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Truncate,
} from '@/src/components/ui';
import { CLIENT_STATUSES } from '@/src/lib/constants';
import type { ClientRow } from '@/src/lib/data/clients';
import type { DuplicateMatch } from '@/src/lib/data/duplicates';
import { formatMoneyCompact, formatRelativeDay } from '@/src/lib/format';
import { cn } from '@/src/lib/cn';
import { codeLabel } from '@/src/lib/rules/duplicates';
import { DuplicateBadge } from './DuplicateBadge';

export const rowDomId = (clientId: string) => `client-row-${clientId}`;

type ColumnKey =
  'client' | 'code' | 'industry' | 'region' | 'turnover' | 'deals' | 'owner' | 'contact' | 'status';

interface Column {
  key: ColumnKey;
  label: string;
  /** grid-template-columns track; widths follow the design. */
  width: string;
  align?: 'right';
}

const COLUMNS: Column[] = [
  { key: 'client', label: 'Client', width: 'minmax(180px,2.2fr)' },
  { key: 'code', label: 'EDRPOU / Tax ID', width: '96px' },
  { key: 'industry', label: 'Industry', width: 'minmax(0,1.3fr)' },
  { key: 'region', label: 'Region', width: 'minmax(0,0.9fr)' },
  { key: 'turnover', label: 'Turnover', width: '92px', align: 'right' },
  { key: 'deals', label: 'Open deals', width: '118px', align: 'right' },
  { key: 'owner', label: 'Owner', width: '128px' },
  // Wider than the design's 88px so a full phone number fits without truncation.
  { key: 'contact', label: 'Contact', width: '112px' },
  { key: 'status', label: 'Status', width: '86px' },
];

export interface ClientsTableProps {
  rows: ClientRow[];
  now: Date;
  cursor: number;
  onCursor: (index: number) => void;
  onOpen: (row: ClientRow) => void;
  duplicates: Map<string, DuplicateMatch[]>;
  canMerge: boolean;
  onMerge: (row: ClientRow, other: DuplicateMatch) => void;
  onRequestMerge: (row: ClientRow, other: DuplicateMatch) => void;
  /** Owner column only for the head: a manager's list is all theirs. */
  showOwner: boolean;
  /** Dropped on narrow screens when the owner column is shown. */
  showContact: boolean;
  /** Shown when filters leave nothing. */
  query: string;
  onClear: () => void;
}

export function ClientsTable({
  rows,
  now,
  cursor,
  onCursor,
  onOpen,
  duplicates,
  canMerge,
  onMerge,
  onRequestMerge,
  showOwner,
  showContact,
  query,
  onClear,
}: ClientsTableProps) {
  const columns = COLUMNS.filter(
    (c) => (c.key !== 'owner' || showOwner) && (c.key !== 'contact' || showContact),
  );

  const cell = (key: ColumnKey, row: ClientRow): ReactNode => {
    const { client } = row;
    switch (key) {
      case 'client': {
        const dupes = duplicates.get(client.id);
        return (
          <TableCell key={key} className="flex items-center gap-2.25">
            <Avatar name={client.name} shape="square" />
            <span className="flex min-w-0 flex-col">
              <Truncate className="font-medium">{client.name}</Truncate>
              <span
                className={cn('text-meta', row.stale ? 'text-danger' : 'text-text-tertiary')}
                title={row.stale ? 'No contact for 14+ days' : undefined}
              >
                {row.lastContact ? formatRelativeDay(row.lastContact, now) : 'no contact yet'}
              </span>
            </span>
            {dupes && dupes.length > 0 && (
              <DuplicateBadge
                code={client.code}
                matches={dupes}
                canMerge={canMerge}
                onMerge={(other) => onMerge(row, other)}
                onRequestMerge={(other) => onRequestMerge(row, other)}
              />
            )}
          </TableCell>
        );
      }
      case 'code':
        return (
          <TableCell key={key} mono muted>
            <span title={codeLabel(client.legalForm)}>{client.code}</span>
          </TableCell>
        );
      case 'industry':
        return (
          <TableCell key={key} muted>
            <Truncate>{client.industry}</Truncate>
          </TableCell>
        );
      case 'region':
        return (
          <TableCell key={key} muted>
            <Truncate>{client.region}</Truncate>
          </TableCell>
        );
      case 'turnover':
        return (
          <TableCell key={key} align="right">
            {formatMoneyCompact(client.annualTurnover)}
          </TableCell>
        );
      case 'deals':
        return (
          <TableCell key={key} align="right" muted>
            {row.openDeals > 0 ? `${row.openDeals} · ${formatMoneyCompact(row.openAmount)}` : '—'}
          </TableCell>
        );
      case 'owner':
        return (
          <TableCell key={key} className="flex items-center gap-1.5">
            {row.owner && <Avatar name={row.owner.name} size="sm" tone="accent" />}
            <Truncate className="text-sm text-text-secondary">{row.owner?.name ?? '—'}</Truncate>
          </TableCell>
        );
      case 'contact':
        return (
          <TableCell key={key} className="text-meta text-text-tertiary">
            <Truncate>{client.contacts[0]?.phone ?? '—'}</Truncate>
          </TableCell>
        );
      case 'status':
        return (
          <TableCell key={key}>
            <Badge tone={CLIENT_STATUSES[client.status].tone}>
              {CLIENT_STATUSES[client.status].label}
            </Badge>
          </TableCell>
        );
    }
  };

  return (
    <Table columns={columns.map((c) => c.width).join(' ')} label="Clients">
      <TableHeader>
        {columns.map((c) => (
          <TableHead key={c.key} align={c.align}>
            {c.label}
          </TableHead>
        ))}
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow
            key={row.client.id}
            id={rowDomId(row.client.id)}
            selected={i === cursor}
            onMouseEnter={() => onCursor(i)}
            onClick={() => onOpen(row)}
          >
            {columns.map((c) => cell(c.key, row))}
          </TableRow>
        ))}
        {rows.length === 0 && (
          <EmptyState
            variant="inline"
            icon={<SearchX size={24} strokeWidth={1.75} />}
            title={
              query.trim() ? `Nothing found for “${query.trim()}”` : 'No clients match the filters'
            }
            description="Check the spelling or search by EDRPOU / phone number"
            actions={
              <Button size="md" onClick={onClear}>
                Clear search and filters
              </Button>
            }
          />
        )}
      </TableBody>
    </Table>
  );
}
