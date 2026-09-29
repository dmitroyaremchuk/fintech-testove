// Single source of truth for domain enums, labels and their visual mapping.
// Labels are copied verbatim from docs/design/handoff/FundPath CRM EN.dc.html.
// Colors reference CSS variables from src/styles/tokens.css — never raw hex.

// ── Badge tones ──────────────────────────────────────────────
export const TONES = {
  gray: { bg: 'var(--fp-tone-gray-bg)', fg: 'var(--fp-tone-gray-fg)' },
  blue: { bg: 'var(--fp-tone-blue-bg)', fg: 'var(--fp-tone-blue-fg)' },
  amber: { bg: 'var(--fp-tone-amber-bg)', fg: 'var(--fp-tone-amber-fg)' },
  green: { bg: 'var(--fp-tone-green-bg)', fg: 'var(--fp-tone-green-fg)' },
  red: { bg: 'var(--fp-tone-red-bg)', fg: 'var(--fp-tone-red-fg)' },
  violet: { bg: 'var(--fp-tone-violet-bg)', fg: 'var(--fp-tone-violet-fg)' },
  teal: { bg: 'var(--fp-tone-teal-bg)', fg: 'var(--fp-tone-teal-fg)' },
} as const;

export type Tone = keyof typeof TONES;

// ── Deal stages ──────────────────────────────────────────────
export type OpenStageKey = 'new' | 'qual' | 'docs' | 'banks' | 'submitted' | 'decision' | 'signing';
export type ClosedStageKey = 'won' | 'lost';
export type StageKey = OpenStageKey | ClosedStageKey;

export interface Stage {
  key: StageKey;
  label: string;
  /** Max days in stage before the deal counts as stuck. 0 = no SLA. */
  slaDays: number;
  /** Probability used to weight expected commission. */
  probability: number;
  /** Dot / funnel bar color. */
  color: string;
  /** Badge tone for the stage pill. */
  tone: Tone;
}

export const STAGES: readonly Stage[] = [
  {
    key: 'new',
    label: 'New lead',
    slaDays: 1,
    probability: 0.05,
    color: 'var(--fp-stage-new)',
    tone: 'gray',
  },
  {
    key: 'qual',
    label: 'Qualification',
    slaDays: 3,
    probability: 0.1,
    color: 'var(--fp-stage-qual)',
    tone: 'violet',
  },
  {
    key: 'docs',
    label: 'Document collection',
    slaDays: 7,
    probability: 0.25,
    color: 'var(--fp-stage-docs)',
    tone: 'amber',
  },
  {
    key: 'banks',
    label: 'Bank selection',
    slaDays: 2,
    probability: 0.35,
    color: 'var(--fp-stage-banks)',
    tone: 'blue',
  },
  {
    key: 'submitted',
    label: 'Applications submitted',
    slaDays: 3,
    probability: 0.5,
    color: 'var(--fp-stage-submitted)',
    tone: 'blue',
  },
  {
    key: 'decision',
    label: 'Bank decisions',
    slaDays: 10,
    probability: 0.65,
    color: 'var(--fp-stage-decision)',
    tone: 'teal',
  },
  {
    key: 'signing',
    label: 'Signing & disbursement',
    slaDays: 7,
    probability: 0.85,
    color: 'var(--fp-stage-signing)',
    tone: 'green',
  },
];

export const CLOSED_STAGES: readonly Stage[] = [
  {
    key: 'won',
    label: 'Won',
    slaDays: 0,
    probability: 1,
    color: 'var(--fp-stage-won)',
    tone: 'green',
  },
  {
    key: 'lost',
    label: 'Lost',
    slaDays: 0,
    probability: 0,
    color: 'var(--fp-stage-lost)',
    tone: 'red',
  },
];

// ── Bank application statuses ────────────────────────────────
export type ApplicationStatus =
  'prep' | 'submitted' | 'review' | 'extra' | 'approved' | 'rejected' | 'accepted' | 'disbursed';

export const APPLICATION_STATUSES: Record<ApplicationStatus, { label: string; tone: Tone }> = {
  prep: { label: 'Preparation', tone: 'gray' },
  submitted: { label: 'Submitted', tone: 'blue' },
  review: { label: 'Under review', tone: 'violet' },
  extra: { label: 'Extra docs requested', tone: 'amber' },
  approved: { label: 'Approved', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' },
  accepted: { label: 'Client accepted', tone: 'teal' },
  disbursed: { label: 'Disbursed', tone: 'green' },
};

// ── Document checklist statuses ──────────────────────────────
// "expiring" is a display state the design derives for received documents close to validUntil.
export type DocumentStatus = 'not_requested' | 'requested' | 'received' | 'expired';
export type DocumentDisplayStatus = DocumentStatus | 'expiring';

export const DOCUMENT_STATUSES: Record<
  DocumentDisplayStatus,
  { label: string; tone: Tone; icon: string }
> = {
  received: { label: 'Received', tone: 'green', icon: 'check_circle' },
  requested: { label: 'Requested', tone: 'blue', icon: 'schedule' },
  not_requested: { label: 'Not requested', tone: 'gray', icon: 'radio_button_unchecked' },
  expired: { label: 'Overdue', tone: 'red', icon: 'error' },
  expiring: { label: 'Expiring', tone: 'amber', icon: 'warning' },
};

// ── Loss reasons ─────────────────────────────────────────────
export const LOSS_REASONS = [
  'Client changed mind',
  'All banks declined',
  'Documents not provided',
  'Went to competitor',
  'Unresponsive',
  'Does not fit criteria',
] as const;

export type LossReason = (typeof LOSS_REASONS)[number];

// ── Task groups ──────────────────────────────────────────────
export type TaskGroupKey = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'none';

export interface TaskGroup {
  key: TaskGroupKey;
  label: string;
  /** Design appends the date to the group header: "Today · Sep 29", "Tomorrow · Sep 30". */
  showDate: boolean;
}

export const TASK_GROUPS: readonly TaskGroup[] = [
  { key: 'overdue', label: 'Overdue', showDate: false },
  { key: 'today', label: 'Today', showDate: true },
  { key: 'tomorrow', label: 'Tomorrow', showDate: true },
  { key: 'week', label: 'This week', showDate: false },
  { key: 'later', label: 'Later', showDate: false },
  { key: 'none', label: 'No date', showDate: false },
];

export type TaskPriority = 'high' | 'med' | 'low';

export const TASK_PRIORITIES: Record<TaskPriority, { label: string; color: string }> = {
  high: { label: 'High priority', color: 'var(--fp-priority-high)' },
  med: { label: 'Medium priority', color: 'var(--fp-priority-med)' },
  low: { label: 'Low priority', color: 'var(--fp-priority-low)' },
};

// ── Interaction types ────────────────────────────────────────
// `icon` is the Material Symbols name used in the design; icon library is pending a decision.
export type InteractionType =
  'call' | 'email' | 'meeting' | 'messenger' | 'document' | 'stage_change' | 'note' | 'task';

export const INTERACTION_TYPES: Record<InteractionType, { label: string; icon: string }> = {
  call: { label: 'Call', icon: 'call' },
  email: { label: 'Email', icon: 'mail' },
  meeting: { label: 'Meeting', icon: 'groups' },
  messenger: { label: 'Messenger', icon: 'chat' },
  document: { label: 'Document', icon: 'description' },
  stage_change: { label: 'Stage change', icon: 'swap_horiz' },
  note: { label: 'Note', icon: 'edit_note' },
  task: { label: 'Auto task', icon: 'bolt' },
};

// ── Clients ──────────────────────────────────────────────────
export type ClientStatus = 'Active' | 'New' | 'Inactive';

export const CLIENT_STATUSES: Record<ClientStatus, { label: string; tone: Tone }> = {
  Active: { label: 'Active', tone: 'green' },
  New: { label: 'New', tone: 'blue' },
  Inactive: { label: 'Inactive', tone: 'gray' },
};

export const LEGAL_FORMS = ['LLC', 'Sole prop.'] as const;
export type LegalForm = (typeof LEGAL_FORMS)[number];

export const PRODUCTS = ['Loan', 'Overdraft', 'Leasing', 'Factoring'] as const;
export type Product = (typeof PRODUCTS)[number];

// ── Commission ───────────────────────────────────────────────
/** Default commission rate used for expected / weighted commission. */
export const COMMISSION_RATE = 0.02;
/** Range of the commission slider on the deal card, in percent. */
export const COMMISSION_PCT_RANGE = { min: 1, max: 3, step: 0.1, default: 2 } as const;

// ── Banks ────────────────────────────────────────────────────
export const BANKS = [
  'Dniprobank',
  'Karpatskyi',
  'Universal Capital',
  'FinTrust',
  'Sitibud',
] as const;
export type Bank = (typeof BANKS)[number];

// ── Thresholds used by the design ────────────────────────────
/** Client is "No contact 14+ days" at or above this many days since last interaction. */
export const STALE_CONTACT_DAYS = 14;

/** Where clients come from (seed data and the New client form). */
export const LEAD_SOURCES = [
  'Website',
  'Partner',
  'Referral',
  'Cold call',
  'Trade show',
  'Instagram',
  'Repeat request',
] as const;
/** Manager is flagged "Overloaded" at or above either threshold. */
export const OVERLOAD_OPEN_DEALS = 15;
export const OVERLOAD_OVERDUE_TASKS = 5;
/** Auto-dismiss delay for toasts. */
export const TOAST_DURATION_MS = 6000;

// ── Auto-task timing (AGENTS.md → Auto-task rules) ──────────
/** Hour (local) of the first call to a new lead, the next day. */
export const FIRST_CALL_HOUR = 10;
/** "By end of day" deadline hour used for same-day auto tasks. */
export const END_OF_DAY_HOUR = 18;
/** Client reminder after documents were requested. */
export const DOCUMENT_REMINDER_DAYS = 3;
/** Follow up with the bank this many working days after submission. */
export const STATUS_CHECK_WORKING_DAYS = 3;
/** Bank asked for extra documents: task due within this many hours. */
export const EXTRA_DOCS_DUE_HOURS = 24;
/** A received document is "expiring" when it is valid for this many days or fewer. */
export const DOCUMENT_EXPIRY_WARNING_DAYS = 5;

// ── Demo data layer ──────────────────────────────────────────
/** Fake network latency for every load, so loading states are visible. */
export const SIMULATED_LATENCY_MS = 450;
