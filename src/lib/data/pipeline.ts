// Pipeline view model. Input is a role-scoped dataset, so managers only get their own deals.

import { STAGES, type OpenStageKey, type Product } from '../constants';
import { calendarDaysBetween } from '../dates';
import { weightedCommission } from '../rules/commission';
import { documentDisplayStatus } from '../rules/documents';
import { calcDaysInStage, getStage, isClosedStage, isStuck } from '../rules/stages';
import { suggestStage, type StageSuggestion } from '../rules/transitions';
import type { Client, Deal, Id, User } from '../types';
import type { Dataset } from './dataset';

export interface DocAlert {
  kind: 'expiring' | 'expired';
  text: string;
}

export interface DealCard {
  deal: Deal;
  client: Client | undefined;
  owner: User | undefined;
  daysInStage: number;
  slaDays: number;
  stuck: boolean;
  /** Bank applications on this deal (any status). */
  applications: number;
  docAlert: DocAlert | null;
  /** Stage the applications point to, if different (AGENTS.md rule 1). */
  suggestion: StageSuggestion | null;
  weighted: number;
}

function docAlert(data: Dataset, dealId: Id, now: Date): DocAlert | null {
  for (const doc of data.documents.filter((d) => d.dealId === dealId)) {
    const status = documentDisplayStatus(doc, now);
    if (status === 'expired') return { kind: 'expired', text: `${doc.type} expired` };
    if (status === 'expiring' && doc.validUntil) {
      const days = calendarDaysBetween(now, new Date(doc.validUntil));
      const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
      return { kind: 'expiring', text: `${doc.type} expires ${when}` };
    }
  }
  return null;
}

function card(data: Dataset, deal: Deal, now: Date): DealCard {
  const apps = data.applications.filter((a) => a.dealId === deal.id);
  return {
    deal,
    client: data.clients.find((c) => c.id === deal.clientId),
    owner: data.users.find((u) => u.id === deal.ownerId),
    daysInStage: calcDaysInStage(deal, now),
    slaDays: getStage(deal.stage).slaDays,
    stuck: isStuck(deal, now),
    applications: apps.length,
    docAlert: docAlert(data, deal.id, now),
    suggestion: suggestStage(deal, apps),
    weighted: weightedCommission(deal, apps),
  };
}

/** Cards for every open deal. */
export function pipelineCards(data: Dataset, now: Date): DealCard[] {
  return data.deals.filter((d) => !isClosedStage(d.stage)).map((d) => card(data, d, now));
}

// ── Filters ──────────────────────────────────────────────────

export type AmountRange = 'any' | 'lt1' | '1to5' | '5to10' | 'gt10';

const M = 1_000_000;

export const AMOUNT_RANGES: { id: AmountRange; label: string; min: number; max: number }[] = [
  { id: 'any', label: 'Any amount', min: 0, max: Infinity },
  { id: 'lt1', label: 'Under 1M ₴', min: 0, max: M },
  { id: '1to5', label: '1–5M ₴', min: M, max: 5 * M },
  { id: '5to10', label: '5–10M ₴', min: 5 * M, max: 10 * M },
  { id: 'gt10', label: '10M ₴ and more', min: 10 * M, max: Infinity },
];

export interface PipelineFilters {
  /** Head only; ignored (null) for managers. */
  ownerId: Id | null;
  product: Product | null;
  amount: AmountRange;
  onlyStuck: boolean;
}

export const NO_FILTERS: PipelineFilters = {
  ownerId: null,
  product: null,
  amount: 'any',
  onlyStuck: false,
};

export function isFiltered(f: PipelineFilters): boolean {
  return f.ownerId !== null || f.product !== null || f.amount !== 'any' || f.onlyStuck;
}

export function filterCards(cards: readonly DealCard[], f: PipelineFilters): DealCard[] {
  const range = AMOUNT_RANGES.find((r) => r.id === f.amount) ?? AMOUNT_RANGES[0]!;
  return cards.filter(
    (c) =>
      (!f.ownerId || c.deal.ownerId === f.ownerId) &&
      (!f.product || c.deal.product === f.product) &&
      c.deal.requestedAmount >= range.min &&
      c.deal.requestedAmount < range.max &&
      (!f.onlyStuck || c.stuck),
  );
}

// ── Columns, closed deals, summary ───────────────────────────

export interface PipelineColumn {
  stage: OpenStageKey;
  cards: DealCard[];
  sum: number;
}

/** One column per open stage; stuck deals first, then the longest in stage. */
export function pipelineColumns(cards: readonly DealCard[]): PipelineColumn[] {
  return STAGES.map((s) => {
    const inStage = cards
      .filter((c) => c.deal.stage === s.key)
      .sort((a, b) => Number(b.stuck) - Number(a.stuck) || b.daysInStage - a.daysInStage);
    return {
      stage: s.key as OpenStageKey,
      cards: inStage,
      sum: inStage.reduce((sum, c) => sum + c.deal.requestedAmount, 0),
    };
  });
}

export interface ClosedDeal {
  deal: Deal;
  client: Client | undefined;
}

/** Won and Lost deals, most recently closed first. Owner, product and amount filters apply. */
export function closedDeals(
  data: Dataset,
  f: PipelineFilters,
): { won: ClosedDeal[]; lost: ClosedDeal[] } {
  const range = AMOUNT_RANGES.find((r) => r.id === f.amount) ?? AMOUNT_RANGES[0]!;
  const list = data.deals
    .filter(
      (d) =>
        isClosedStage(d.stage) &&
        (!f.ownerId || d.ownerId === f.ownerId) &&
        (!f.product || d.product === f.product) &&
        d.requestedAmount >= range.min &&
        d.requestedAmount < range.max,
    )
    .sort((a, b) => b.stageEnteredAt.localeCompare(a.stageEnteredAt))
    .map((deal) => ({ deal, client: data.clients.find((c) => c.id === deal.clientId) }));
  return {
    won: list.filter((c) => c.deal.stage === 'won'),
    lost: list.filter((c) => c.deal.stage === 'lost'),
  };
}

export function pipelineSummary(cards: readonly DealCard[]) {
  return {
    count: cards.length,
    amount: cards.reduce((sum, c) => sum + c.deal.requestedAmount, 0),
    weighted: cards.reduce((sum, c) => sum + c.weighted, 0),
  };
}
