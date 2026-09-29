---
name: review-screen
description: Compare an implemented CRM screen with its design reference and the project
  rules, and list differences by priority. Use after building or changing any screen,
  or when asked to audit, review or polish UI.
---

# Review a screen

1. Start the app if not running, run `node scripts/shoot-app.mjs <screen>` to get PNGs into
   docs/design/_actual/ (same viewport and states as the references).
2. Open reference and actual PNG side by side and list differences in:
   layout and grid, spacing and density, typography, colors and badge tones, icons,
   row/table heights, alignment, truncation of long text, hover/focus/active states.
3. Check rules in code (grep, do not guess):
   - raw hex/px colors or font sizes outside tokens.css
   - role filtering inside components
   - business logic outside src/domain/rules/
   - `any`, unused code, magic numbers
4. Check consistency across screens: same names for stages/statuses, same badge colors,
   same date and currency formats, same button texts.
5. Output a table: Priority (High/Med/Low) | Where | Difference | Proposed fix.
   Do NOT fix anything until I confirm, except trivial token violations.