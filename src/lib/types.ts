// Domain types (AGENTS.md → Domain model).
// Dates are ISO 8601 strings so state serializes to localStorage as-is.
// Derived values (stage probability, expected commission, days in stage) are not stored;
// compute them with the functions in src/lib/rules/.

import type {
  ApplicationStatus,
  Bank,
  ClientStatus,
  DocumentStatus,
  InteractionType,
  LegalForm,
  LossReason,
  OpenStageKey,
  Product,
  StageKey,
  TaskPriority,
} from './constants';

export type Id = string;
/** ISO 8601 date-time, e.g. "2026-09-29T10:14:00.000Z". */
export type IsoDate = string;

export type Role = 'manager' | 'head';

export interface User {
  id: Id;
  name: string;
  role: Role;
  /** Monthly commission target, ₴. */
  monthlyTarget: number;
}

export interface Contact {
  name: string;
  /** Position at the client, e.g. "Director", "Chief accountant". */
  position: string;
  phone: string;
  email: string | null;
}

export interface Client {
  id: Id;
  name: string;
  /** EDRPOU (8 digits, companies) or IPN (10 digits, sole proprietors). Duplicate key. */
  code: string;
  legalForm: LegalForm;
  industry: string;
  region: string;
  /** ₴ per year. */
  annualTurnover: number;
  businessAgeYears: number;
  contacts: Contact[];
  leadSource: string;
  ownerId: Id;
  tags: string[];
  status: ClientStatus;
}

export interface Deal {
  id: Id;
  clientId: Id;
  product: Product;
  /** ₴ requested by the client. */
  requestedAmount: number;
  purpose: string;
  stage: StageKey;
  ownerId: Id;
  createdAt: IsoDate;
  stageEnteredAt: IsoDate;
  /** Commission as a fraction (0.01–0.03). Falls back to COMMISSION_RATE when null. */
  commissionRate: number | null;
  /** Required when stage is "lost". */
  lostReason: LossReason | null;
  /** The open stage a Lost deal was in when it was lost (for funnel conversion). */
  lostAtStage: OpenStageKey | null;
}

export interface BankApplication {
  id: Id;
  dealId: Id;
  bank: Bank;
  status: ApplicationStatus;
  /** ₴ requested from this bank, or the approved amount once approved. */
  amount: number;
  /** Annual rate in percent, known after approval. */
  rate: number | null;
  termMonths: number | null;
  submittedAt: IsoDate | null;
  decidedAt: IsoDate | null;
  rejectionReason: string | null;
}

export interface DocumentItem {
  id: Id;
  dealId: Id;
  /** Document name, e.g. "Tax clearance certificate". */
  type: string;
  status: DocumentStatus;
  validUntil: IsoDate | null;
}

export interface Interaction {
  id: Id;
  clientId: Id;
  dealId: Id | null;
  type: InteractionType;
  date: IsoDate;
  /** null = created by the system. */
  authorId: Id | null;
  summary: string;
  auto: boolean;
}

export type TaskType =
  'call' | 'email' | 'meeting' | 'document' | 'follow_up' | 'invoice' | 'other';
export type TaskStatus = 'open' | 'done';
export type TaskSource = 'manual' | 'auto';

export interface Task {
  id: Id;
  title: string;
  type: TaskType;
  clientId: Id | null;
  dealId: Id | null;
  assigneeId: Id;
  dueAt: IsoDate | null;
  status: TaskStatus;
  priority: TaskPriority;
  source: TaskSource;
  /**
   * Identity of the rule firing that created an auto task, e.g. "sla:d3:decision".
   * Used to avoid creating the same auto task twice. null for manual tasks.
   */
  autoKey: string | null;
}

/** A task produced by a rule, before the store assigns an id. */
export type NewTask = Omit<Task, 'id'>;
