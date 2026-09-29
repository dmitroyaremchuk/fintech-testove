// Deal card view model. `scoped` decides what the session may see; `all` is used only for
// aggregate bank statistics.

import { COMMISSION_RATE, STAGES, type Bank, type DocumentDisplayStatus } from '../constants';
import { summarizeApplications, untriedBanks } from '../rules/applications';
import { commissionBase, expectedCommission, weightedCommission } from '../rules/commission';
import { documentDisplayStatus } from '../rules/documents';
import { compareOffers, type Offer } from '../rules/offers';
import {
  calcDaysInStage,
  getStage,
  isClosedStage,
  isStuck,
  stageProbability,
} from '../rules/stages';
import { suggestStage, type StageSuggestion } from '../rules/transitions';
import type {
  BankApplication,
  Client,
  Deal,
  DocumentItem,
  Id,
  Interaction,
  Task,
  User,
} from '../types';
import { bankStats, banksByApproval, type BankStat } from './banks';
import type { Dataset } from './dataset';

const STATUS_ORDER: Record<BankApplication['status'], number> = {
  disbursed: 0,
  accepted: 1,
  approved: 2,
  extra: 3,
  review: 4,
  submitted: 5,
  prep: 6,
  rejected: 7,
};

export interface DealDocument {
  doc: DocumentItem;
  status: DocumentDisplayStatus;
}

export interface DealCommission {
  rate: number;
  base: number;
  /** Where the base comes from. */
  baseSource: { kind: 'disbursed' | 'accepted' | 'requested'; bank?: Bank };
  /** Commission if the deal closes on this base. */
  expected: number;
  probability: number;
  weighted: number;
  /** Earned: only once money was actually paid out. */
  actual: number | null;
}

export interface DealView {
  deal: Deal;
  client: Client | undefined;
  owner: User | undefined;
  closed: boolean;
  daysInStage: number;
  stuck: boolean;
  applications: BankApplication[];
  offers: Offer[];
  /** Stage the applications point to (AGENTS.md rule 1), shown as a confirm prompt. */
  suggestion: StageSuggestion | null;
  rejectedCount: number;
  /** Banks without an application yet, best approval rate first. */
  untried: BankStat[];
  /** When there are no applications: the two banks approving most often. */
  recommended: BankStat[];
  stats: Map<Bank, BankStat>;
  /** Client accepted an offer and nothing is paid out yet. */
  awaitingDisbursement: BankApplication | null;
  documents: DealDocument[];
  docsReceived: number;
  commission: DealCommission;
  tasks: Task[];
  timeline: Interaction[];
}

export function dealView(scoped: Dataset, all: Dataset, dealId: Id, now: Date): DealView | null {
  const deal = scoped.deals.find((d) => d.id === dealId);
  if (!deal) return null;
  const applications = scoped.applications
    .filter((a) => a.dealId === dealId)
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  const summary = summarizeApplications(applications);
  const stats = bankStats(all);
  const disbursed = applications.find((a) => a.status === 'disbursed');
  const accepted = applications.find((a) => a.status === 'accepted');
  const rate = deal.commissionRate ?? COMMISSION_RATE;
  const base = commissionBase(deal, applications);

  const documents = scoped.documents
    .filter((d) => d.dealId === dealId)
    .map((doc) => ({ doc, status: documentDisplayStatus(doc, now) }));

  const dueTime = (t: Task) => (t.dueAt ? new Date(t.dueAt).getTime() : Infinity);

  return {
    deal,
    client: scoped.clients.find((c) => c.id === deal.clientId),
    owner: scoped.users.find((u) => u.id === deal.ownerId),
    closed: isClosedStage(deal.stage),
    daysInStage: calcDaysInStage(deal, now),
    stuck: isStuck(deal, now),
    applications,
    offers: compareOffers(applications),
    suggestion: suggestStage(deal, applications),
    rejectedCount: summary.rejected,
    untried: banksByApproval(stats, untriedBanks(applications)),
    recommended: applications.length ? [] : banksByApproval(stats).slice(0, 2),
    stats,
    awaitingDisbursement: accepted && !disbursed ? accepted : null,
    documents,
    docsReceived: documents.filter((d) => d.status === 'received' || d.status === 'expiring')
      .length,
    commission: {
      rate,
      base,
      baseSource: disbursed
        ? { kind: 'disbursed', bank: disbursed.bank }
        : accepted
          ? { kind: 'accepted', bank: accepted.bank }
          : { kind: 'requested' },
      expected: expectedCommission(deal, applications),
      probability: stageProbability(deal.stage),
      weighted: weightedCommission(deal, applications),
      actual: disbursed ? base * rate : null,
    },
    tasks: scoped.tasks
      .filter((t) => t.dealId === dealId && t.status === 'open')
      .sort((a, b) => dueTime(a) - dueTime(b)),
    timeline: scoped.interactions
      .filter((i) => i.dealId === dealId)
      .sort((a, b) => b.date.localeCompare(a.date)),
  };
}

/** Stepper state for each open stage. */
export function stepperSteps(deal: Deal, daysInStage: number) {
  const current = STAGES.findIndex((s) => s.key === deal.stage);
  const won = deal.stage === 'won';
  return STAGES.map((s, i) => ({
    stage: s,
    state:
      won || (current >= 0 && i < current)
        ? ('done' as const)
        : i === current
          ? ('current' as const)
          : ('todo' as const),
    daysInStage: i === current ? daysInStage : null,
    sla: getStage(s.key).slaDays,
  }));
}
