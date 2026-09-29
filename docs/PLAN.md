# Frontend plan

Workflow per screen: "Use the build-screen skill for <screen>" → check → review-screen → fixes.
Rule: next screen only after my confirmation. Update checkboxes here.

## Phase 0. Foundation
- [ ] tokens.css, constants.ts, DESIGN.md, tailwind wiring
- [x] ESLint, Prettier, Vitest, `npm run check`
- [ ] Shared UI kit in src/components/ui: Button, Badge, Chip, Table, Avatar, Toast, Modal,
      EmptyState, Skeleton, Tooltip (each with a small story page at /_kit)
- [x] formatters (money, dates)

## Phase 1. Data layer (in-memory, localStorage)
- [ ] types.ts, seed (40 clients, 60 deals, ~90 applications, ~200 interactions, ~60 tasks, 6 stories)
- [ ] domain rules with unit tests: isStuck, expectedCommission, stage validation,
      auto-task generation, suggested stage from applications
- [ ] repository interface + in-memory implementation, role-scoped selectors
- [ ] ?state= switch and simulated latency

## Phase 2. Shell
- [ ] Sidebar, top bar, global search, role + user switcher, quick action, reset demo data,
      toast host, notification bell

## Phase 3. Clients
- [ ] Clients list  (build-screen: clients)
- [ ] Client card   (build-screen: client)

## Phase 4. Pipeline
- [ ] Kanban + table view  (build-screen: pipeline)
- [ ] Deal card            (build-screen: deal)

## Phase 5. Tasks
- [ ] Tasks (build-screen: tasks)

## Phase 6. Dashboards
- [ ] Manager and Head dashboards computed from data (build-screen: dashboard)
- [ ] Team screen, Head only (no reference: invent in the same style, list decisions)

## Phase 7. Polish
- [ ] review-screen on every screen, fix High and Med
- [ ] 1280 and 1920 px, long names, keyboard navigation
- [ ] README, screenshots, description, hours