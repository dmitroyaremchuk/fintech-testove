import {
  DOCUMENT_EXPIRY_WARNING_DAYS,
  type DocumentDisplayStatus,
  type LegalForm,
  type Product,
} from '../constants';
import { calendarDaysBetween } from '../dates';
import type { DocumentItem } from '../types';

type Doc = Pick<DocumentItem, 'status' | 'validUntil'>;

/**
 * Status to show and act on. A received document whose validUntil has passed counts as expired
 * even if nobody updated its status; one valid for ≤ 5 more days is "expiring".
 */
export function documentDisplayStatus(doc: Doc, now: Date): DocumentDisplayStatus {
  if (doc.status !== 'received' || !doc.validUntil) return doc.status;
  const daysLeft = calendarDaysBetween(now, new Date(doc.validUntil));
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= DOCUMENT_EXPIRY_WARNING_DAYS) return 'expiring';
  return 'received';
}

/** Still needed from the client: never requested, requested but not received, or expired. */
export function isMissing(doc: Doc, now: Date): boolean {
  const status = documentDisplayStatus(doc, now);
  return status === 'not_requested' || status === 'requested' || status === 'expired';
}

export function expiringDocuments<T extends Doc>(docs: readonly T[], now: Date): T[] {
  return docs.filter((d) => documentDisplayStatus(d, now) === 'expiring');
}

const EXTRA_DOCS: Record<Product, string[]> = {
  Loan: ['Collateral documents'],
  Leasing: ['Leased asset specification and invoice'],
  Overdraft: [],
  Factoring: ['Supply contracts with debtors'],
};

/**
 * Checklist generated when a deal enters Document collection: the base set for the legal form
 * (names as in the design) plus what the product needs.
 */
export function documentChecklist(form: LegalForm, product: Product, year: number): string[] {
  const base =
    form === 'LLC'
      ? [
          'State register extract',
          `Financial statements F1, F2 for ${year - 1}`,
          `Financial statements H1 ${year}`,
          'Tax clearance certificate',
          'Bank statements, 12 mo.',
          'Director’s passport and tax ID',
        ]
      : [
          'Passport and tax ID',
          'Single tax payer register extract',
          `Sole prop. tax return ${year - 1}`,
          'Tax clearance certificate',
          'Sole prop. bank statement, 6 mo.',
        ];
  return [...base, ...EXTRA_DOCS[product]];
}
