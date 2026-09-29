# AGENTS.md

## Project
FundPath is a CRM prototype for a small-business financing broker. It is a take-home
assignment: evaluators judge product thinking and UI detail, not architecture. The prototype
must still look and behave like a real product.

The broker helps sole proprietors (ФОП) and companies (ТОВ) get credit, overdraft, leasing or
factoring. One deal fans out into 2-4 parallel applications to different banks.
Revenue = 1-3% commission on the amount the bank actually PAID OUT.
**A deal is not won until money is disbursed.**

## Stack
- Next.js (App Router), TypeScript (strict), Tailwind
- lucide-react (icons), recharts (charts), dnd-kit (kanban), Zustand (state)
- No backend. In-memory state persisted to localStorage. "Reset demo data" lives in the profile menu.

## Language and formats
- UI language: English. Code, comments, commit messages: English.
- Company and people names in seed data stay Ukrainian.
- Currency: `1 250 000 ₴`. Dates as in the design: `Sep 18`, `today`, `3 days ago`.
  Use the formatters in `src/lib/format.ts`.
- No translation layer: UI strings live directly in components. Stage and status labels
  come from `src/lib/constants.ts`.

## Domain model
- **User**: name, role (`manager` | `head`), monthly target
- **Client**: name, EDRPOU/IPN, legal form, industry, region, annual turnover, business age,
  contacts, lead source, owner (manager), tags, status
- **Deal**: client, product, requested amount, purpose, stage, probability, expected commission,
  owner, createdAt, stageEnteredAt
- **BankApplication** (1:N per deal): bank, status, amount, rate, term, submittedAt, decidedAt, rejectionReason
- **DocumentItem** (checklist per deal): type, status (`not_requested` | `requested` | `received` | `expired`), validUntil
- **Interaction**: type (call, email, meeting, messenger, document, stage_change, note), date, author, summary, auto flag
- **Task**: title, type, client, deal, assignee, dueAt, status, priority, source (`manual` | `auto`)

### Deal stages (SLA in days)
New lead (1) → Qualification (3) → Document collection (7) → Bank selection (2) →
Applications submitted (3) → Bank decisions (10) → Signing & disbursement (7) → Won | Lost.
- Lost requires a reason: client changed mind, all banks declined, documents not provided,
  went to competitor, unresponsive, does not fit criteria.
- A deal is "stuck" when days in stage exceed its SLA.

### Bank application statuses
Preparation → Submitted → Under review → Additional documents requested →
Approved / Rejected → Client accepted → Disbursed.

### Core business rules
1. Deal stage is driven by application states, not by hand. When all applications have a
   decision, propose a stage change and ask the user to confirm.
2. Stage transitions are validated (e.g. cannot enter "Applications submitted" with zero applications).
   Show why a move is blocked.
3. "Won" only after at least one application is `Disbursed`.
4. Duplicate clients are detected by EDRPOU, both on create and in the list ("Merge" action).
5. Expected commission = amount × commission %, weighted by stage probability in dashboards.

### Auto-task rules
| Event | Task created |
|---|---|
| New lead | Call tomorrow 10:00 |
| Enter "Document collection" | One task per missing document, client reminder after 3 days |
| Application submitted | Check status with bank in 3 working days |
| Bank requests extra documents | Urgent task, due in 24h |
| Document expires in 5 days | Renew document |
| Deal exceeds stage SLA | Highlight + warn head |
| Bank rejection | Analyze reason, suggest a bank not yet tried |
| Disbursement | Issue commission invoice |
Every auto-creation shows a toast ("2 tasks created") with an Undo action.

## Roles and access
| | Manager | Head of department |
|---|---|---|
| Clients / deals / tasks | Own only | All |
| Reassign owner | No | Yes |
| Dashboard | Personal (target, tasks, at-risk deals) | Team (funnel, banks, workload, loss reasons) |
| Extra nav | - | "Team" |
- Manager opening someone else's client sees an access screen: "Owned by: <name>".
- Role switcher in the top bar. In the demo the user can pick which manager to log in as.
- All data access goes through selectors that apply role scoping. Never filter in components ad hoc.

## Screens
1. **Dashboard**: role-specific. Every card has a caption "which decision this helps make".
   All numbers computed from data, never hardcoded. Clicking a metric opens a filtered list.
2. **Clients**: table with instant search (name, EDRPOU, contact, phone), filters shown as
   removable chips, saved filters, sorting, duplicate warning. Keyboard: `/` focuses search,
   arrows + Enter open a client.
3. **Client card** (`/clients/[id]`): header with quick actions, interaction timeline grouped
   by day with inline "add note", auto-entries visually distinct from manual, right column
   with requisites (inline edit), contacts, open deals, open tasks, LTV, "Next step" block.
4. **Pipeline**: kanban with dnd-kit, column count and sum, SLA highlight (red border + ⏱),
   expiring-document badge, Kanban/Table toggle, Lost modal with required reason.
5. **Deal card**: stage stepper, bank applications table + comparison of approved offers
   (best rate highlighted), document checklist with progress, commission calculator,
   deal timeline, tasks. Flow "bank rejected → suggest task + untried banks".
6. **Tasks**: groups Overdue / Today / Tomorrow / This week / Later / No date.
   Quick-add parses natural language ("Call Agro-Skhid tomorrow 15:00"), snooze, reassign (head only).
   Reminder banner and bell in the top bar.

## Seed data
Realistic Ukrainian company names, no placeholders ("Test Company", "Lorem ipsum").
Volume: 6 users (5 managers + 1 head), 40 clients, 60 deals, ~90 applications,
~200 interactions over 3 months, ~60 tasks (some overdue).
Fictional banks: Dniprobank, Karpatskyi, Universal Capital, FinTrust, Sitibud.
Data must be internally consistent (logical dates, plausible amounts, deal stage matches its applications).

Required "story" records:
1. Agro-Skhid LLC: rejected by two banks, third approved, awaiting disbursement
2. Coffee-shop sole proprietor: tax certificate expires in 4 days
3. Construction company, 12M ₴: 20 days in "Bank decisions" (stuck)
4. Duplicate client: two records, same EDRPOU, different sources
5. Manager Olena: 18 open deals, 9 overdue tasks (overloaded)
6. Repeat client: loan a year ago, now leasing

## UX standards
- Dense, professional SaaS look (Linear / Attio). Neutral palette, one accent color,
  colored status badges, no gradients. Light theme only.
- Every screen needs loading, empty and error states, and role-dependent behavior.
- Destructive or automatic actions get a toast with Undo.
- Consistent naming for stages/statuses, badge colors, date/amount formats, button labels.
- Must work at 1280 and 1920 px widths. Handle long names with truncation + tooltip.

## Code conventions
- One source of truth for stages, statuses, colors and labels (`src/lib/constants.ts`).
- Helpers: `calcDaysInStage`, `expectedCommission`, `isStuck`, plus role-scoped selectors.
- Small components, no `any`, no dead code, no inline magic numbers (SLA, thresholds in constants).
- Business logic (stage validation, auto-tasks) lives in `src/lib/rules/`, not in UI components.

## Working agreement for agents
- Work step by step. Do not start the next module until the user confirms.
- If something is ambiguous, ask instead of guessing.
- After each module, provide a short manual test checklist.
- When fixing a reported issue, change only what was mentioned, then explain what changed
  and any side effects.
- Do not add libraries beyond the stack above without asking.
- Run `npm run lint` and `npm run build` before declaring a step done.

## Code quality
- No comments in code. Names, types and small functions must make the code self-explanatory.
  Do not write JSDoc, section dividers, or explanatory comments.
- Exceptions: directives that tools require (`eslint-disable-next-line` with a reason,
  `@ts-expect-error` with a reason). Nothing else.
- If something is truly non-obvious, put the explanation in docs/, not in the code.