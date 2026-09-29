@AGENTS.md
@docs/design/DESIGN.md

## Design source of truth
- Approved design: docs/design/handoff/FundPath CRM EN.dc.html (Claude Design component file).
  Read-only. It is a visual and logic REFERENCE, not code. support.js next to it is only its
  runtime: ignore it. Never copy its markup, `<sc-*>` tags or inline styles into src/.
  Rebuild every screen in our stack (Next.js, TypeScript, Tailwind).
- PNG references live in docs/design/screens/, named `<screen>-<state>-<role>.png`.
  Before building or changing a screen, open its PNG and the matching part of the .dc.html
  and match layout, spacing, density and hierarchy.
- Take colors, fonts, spacing, stage and status maps from the reference ONCE, into
  src/styles/tokens.css and src/lib/constants.ts. After that, never hardcode colors, radii
  or font sizes: use those tokens.

## Precedence
- Visuals (layout, colors, fonts, icons, spacing, component look): the design wins.
- Business logic, data model, rules, roles, seed data volume: AGENTS.md wins.
- The design's demo data is sample data only. Do not copy it into src/. Seed data follows
  AGENTS.md (40 clients, 60 deals, ...), and all dashboard numbers are computed, never hardcoded.
- Known gaps in the design that AGENTS.md requires (e.g. the "Team" screen for the head):
  build them in the same visual style and tell me what you invented.
- Any other conflict: