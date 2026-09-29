---
name: screen-states
description: Standard patterns for loading, empty, error and role-dependent states in the
  CRM frontend. Use when building or reviewing any screen or list.
---

# States and roles

Every screen and list must implement:

- **Loading**: skeletons matching the real layout (same row height and column widths),
  never a bare spinner. Simulated delay lives in the repository layer, not in components.
- **Empty (no data)**: short explanation + one primary action ("Add client").
- **Empty (filters)**: "No results for these filters" + Clear filters button.
- **Error**: message in plain language, Retry button, no stack traces.
- **Manager vs Head**: manager sees only own records; head sees all and gets extra
  controls (owner filter, Reassign). Access-denied screen for foreign records:
  "Owned by: <name>". Data scope is applied in selectors only.
- **Undo**: any automatic or destructive action shows a toast with Undo.

Reference for visuals: docs/design/screens/<screen>-loading|empty|error-*.png where they exist;
otherwise follow DESIGN.md and say what you invented.
Add a dev-only state switcher (ready / loading / empty / error) via query param `?state=`
so each state can be opened and screenshotted.