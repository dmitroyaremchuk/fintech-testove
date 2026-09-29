// Builders for rule tests. Dates are local time so tests pass in any timezone.
import type { ApplicationStatus, Bank } from '../constants';
import type { BankApplication, Deal, DocumentItem } from '../types';

/** Local date-time as ISO (month is 1-based for readability). */
export function local(year: number, month: number, day: number, hours = 9, minutes = 0): string {
  return new Date(year, month - 1, day, hours, minutes).toISOString();
}

/** The design's "today": Tuesday, September 29, 2026, 10:14. */
export const NOW = new Date(2026, 8, 29, 10, 14);

export function makeDeal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: 'd1',
    clientId: 'c1',
    product: 'Loan',
    requestedAmount: 8_500_000,
    purpose: 'Working capital for winter sowing',
    stage: 'decision',
    ownerId: 'u1',
    createdAt: local(2026, 9, 2),
    stageEnteredAt: local(2026, 9, 25),
    commissionRate: null,
    lostReason: null,
    lostAtStage: null,
    ...overrides,
  };
}

let appSeq = 0;
export function makeApp(
  status: ApplicationStatus,
  bank: Bank = 'Dniprobank',
  overrides: Partial<BankApplication> = {},
): BankApplication {
  appSeq += 1;
  return {
    id: `a${appSeq}`,
    dealId: 'd1',
    bank,
    status,
    amount: 8_500_000,
    rate: null,
    termMonths: null,
    submittedAt: status === 'prep' ? null : local(2026, 9, 18),
    decidedAt: null,
    rejectionReason: null,
    ...overrides,
  };
}

export function makeDoc(overrides: Partial<DocumentItem> = {}): DocumentItem {
  return {
    id: 'doc1',
    dealId: 'd1',
    type: 'Tax clearance certificate',
    status: 'received',
    validUntil: null,
    ...overrides,
  };
}
