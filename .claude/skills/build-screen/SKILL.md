---
name: build-screen
description: Build or rebuild one screen of the FundPath CRM frontend from its design
  reference. Use whenever the task is to implement, redo or extend a screen (dashboard,
  clients, client card, pipeline, deal card, tasks, team).
---

# Build a screen from the design reference

Input: screen name (e.g. `pipeline`). If missing, ask.

## Steps
1. Read tokens first: src/styles/tokens.css, src/lib/constants.ts, docs/design/DESIGN.md.
   If they are missing, stop and say so.
2. Open the references: docs/design/screens/<screen>-*.png and the matching section of
   "docs/design/handoff/FundPath CRM EN.dc.html". The .dc.html is a reference, never copy
   its markup or `<sc-*>` tags.
3. Write a short plan before coding (max 15 lines): route, component tree, which shared
   components are reused, which need to be created, data selectors needed.
4. Reuse before creating. Check src/components/ui/ (Badge, Button, Table, Chip, Toast,
   EmptyState, Modal, Avatar) and add to it only if something is truly missing.
5. Implement:
   - styling only via tokens/Tailwind theme, no raw hex, no arbitrary px for colors/fonts;
   - all labels/colors of stages and statuses from constants.ts;
   - data only through role-scoped selectors, never filter by role inside components;
   - business logic (stage validation, auto-tasks, isStuck) only via src/domain/rules/.
6. Apply the `screen-states` skill: loading, empty, error, and role-dependent behavior.
7. Run `npm run check`. Fix everything it reports.
8. Apply the `review-screen` skill on your own result and fix what it finds.
9. Finish with: what was built, what you invented because the design had no reference
   (list explicitly), and a manual test checklist of 8-10 items.

## Rules
- One screen per run. Do not touch other screens except shared components, and say so if you do.
- Do not add libraries beyond AGENTS.md without asking.
- If the design and AGENTS.md conflict, ask.