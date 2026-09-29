# FundPath: design system summary

Source of truth: `docs/design/handoff/FundPath CRM EN.dc.html` (reference only) and
screenshots in `docs/design/screens/`. Tokens live in `src/styles/tokens.css` (`--fp-*`),
domain labels and colors in `src/lib/constants.ts`. Tailwind utilities map to tokens via
`tailwind.config.ts`. Components must not use raw hex.

## Tokens

### Color
| Role | Token | Value | Tailwind |
|---|---|---|---|
| App background | `--fp-bg` | `#f7f6f3` | `bg-bg` |
| Surface (cards, top bar) | `--fp-surface` | `#ffffff` | `bg-surface` |
| Sidebar / table header / inputs | `--fp-surface-subtle` | `#fbfaf8` | `bg-surface-subtle` |
| Segment track, avatars, progress track | `--fp-surface-muted` | `#f0efeb` | `bg-surface-muted` |
| Kanban column | `--fp-surface-sunken` | `#f3f2ee` | `bg-surface-sunken` |
| Row hover | `--fp-surface-hover` | `#faf9f7` | `bg-surface-hover` |
| Border (cards) | `--fp-border` | `#e8e6e1` | `border-border` |
| Border (controls) | `--fp-border-strong` | `#e1dfd9` | `border-border-strong` |
| Card header divider | `--fp-border-subtle` | `#efede9` | `border-border-subtle` |
| Row divider | `--fp-border-row` | `#f4f2ee` | `border-border-row` |
| Text primary / secondary / tertiary | `--fp-text*` | `#1d1c1a` / `#55524c` / `#6f6c67` | `text-text`, `text-text-secondary`, `text-text-tertiary` |
| Text muted / faint / disabled | | `#8a867f` / `#9a968f` / `#b3afa7` | `text-text-muted`, `-faint`, `-disabled` |
| Accent (single brand color) | `--fp-accent` | `#3b54d1` (hover `#2a3fa8`) | `bg-accent`, `text-accent` |
| Accent text on soft bg | `--fp-accent-strong` | `#2f47b0` | `text-accent-strong` |
| Accent soft / softer | | `#eef1fc` / `#f1f3fd` | `bg-accent-soft`, `bg-accent-softer` |
| Success | `--fp-success` | `#1d7a3e` (bg `#e2f3e7`, fg `#1c6f39`) | `*-success*` |
| Warning | `--fp-warning` | `#8a5a06` (bg `#fcf1db`) | `*-warning*` |
| Danger | `--fp-danger` | `#b3261e` (bg `#fce8e5`, dot `#c4413a`) | `*-danger*` |

Badge tones (bg / fg): gray `#f0efeb/#55524c`, blue `#e8edfc/#2f47b0`, amber `#fcf1db/#8a5a06`,
green `#e2f3e7/#1c6f39`, red `#fce8e5/#b3261e`, violet `#efe9fb/#5f3db0`, teal `#dff2f0/#0f6a64`.
Use `bg-tone-{name}-bg text-tone-{name}-fg`.

Stage colors: New lead `#8a867f`, Qualification `#7c5cd6`, Document collection `#c98a12`,
Bank selection `#3b54d1`, Applications submitted `#2d7fc1`, Bank decisions `#15857d`,
Signing & disbursement `#1d7a3e`. Use `bg-stage-{key}`.

### Typography
- Families: IBM Plex Sans (400/500/600) for UI; IBM Plex Mono for EDRPOU / tax IDs, kbd hints,
  the `auto` tag and error codes.
- Base: 13px / 1.4. Numbers in tables and KPIs use `tabular-nums`.
- Scale: 10.5 micro · 11 caption · 11.5 meta · 12 sm · 12.5 control · 13 base · 14 logo ·
  15 heading · 16 stat · 18 amount · 19 title (−0.015em) · 23 KPI (−0.02em) · 24 display.
- Section overlines: 11–11.5px, 600, uppercase, 0.04em tracking.

### Radii
2 bar · 3 track · 4 badge · 5 small control · 6 button · 7 input / kanban card · 8 card ·
9 toast · 10 modal · 13 chip pill · 50% avatar.

### Spacing & layout
- Scale: 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32.
- Page padding `20px 24px 32px` (detail pages `16px 24px 32px`); vertical gap between blocks 12–14px.
- Sidebar 228px, top bar 52px, app min width 1280px, content max 1640px,
  right column on detail pages 340px, kanban column min 212px, modal 440px.
- Control heights: 24 xs · 26 sm · 28 md · 30 default · 34 lg.
- Table rows: 44px clients, 40px pipeline table, 42px tasks (min), 38px documents (min);
  header row 34px, task group header 36px.

### Elevation
Flat by default: cards use border only. Shadows only for: kanban card (`0 1px 1px` / hover
`0 2px 8px`), active segment, menus (`0 8px 24px`), toast (`0 10px 30px`), modal (`0 20px 50px`),
input focus ring (`0 0 0 3px accent-ring`).

## Component rules

**Badges.** 11.5px, weight 500, padding `2px 7px`, radius 4, tone bg/fg pair, no border,
`nowrap`. Compact variant in dense lists is 11px, padding `1px 6px`. The tone always comes from
`constants.ts` (stage, application status, document status, client status). Count pills (e.g.
"Deals at risk 3") are rounded 9px, padding `1px 7px`.

**Buttons.** Height 30, padding `0 12px` (icon buttons `0 10px`), radius 6, 12.5px, icon 16px, gap 6.
- Primary: accent bg + accent border, white text, weight 500.
- Secondary: white bg, `border-strong`, primary text.
- Destructive secondary: secondary with danger text ("Mark as lost").
- Solid semantic: success ("Confirm disbursement"), warning ("Request merge", "Renew"),
  danger (modal confirm).
- Disabled primary uses the lighter tint (`accent-disabled`, `danger-disabled`), not opacity.
- Small 26/28px (12px text) in banners and card headers; xs 24px (11.5px) for inline row actions.
- Text links: no border / background, 12px accent, arrow suffix ("Full pipeline →").
- Segmented control: track `surface-muted` with 2px padding and radius 7; active item white + segment shadow.

**Table density.** Header row 34px, 11.5px `text-muted` on `surface-subtle`. Body rows 40–44px,
horizontal padding 14px, column gap 10–12px, row divider `border-row`, hover `surface-hover`,
keyboard-selected row `accent-softer`. Names truncate with ellipsis and a `title` tooltip.
Numbers are right-aligned and tabular. IDs use the mono font at 12px.

**Cards.** White, 1px `border`, radius 8, no shadow. Header `12px 14px` (side cards `10px 14px`)
with a bottom divider `border-subtle`; title 13px/600 plus an optional 11.5px muted caption.
Dashboard cards carry a "Helps decide: …" caption; KPI cards end with a dashed divider and a `help`
icon line. KPI value is 23px/600; red when the metric is bad.

**Banners.** Full width, radius 8, padding `9px 12px`, 18px icon, text plus right-aligned
26px buttons. Warning (duplicate): `warning-soft` / `warning-border` / `warning-text`.
Danger (overdue tasks): `danger-soft` / `danger-border` / `danger-text`. Success (awaiting
disbursement, won): `success-soft` / `success-border`.

**Toasts.** Dark (`toast-bg`), bottom-center 22px from the edge, radius 9, max 640px, padding
`9px 10px 9px 14px`, 12.5px. Leading icon: `check_circle` green-ish for success, `block` red-ish
for blocked actions. Optional ghost "Cancel" button (undo) and a close ×. Auto-dismiss after 6s.
Blocked moves use the same toast with the reason as text.

**Empty / loading / error states.**
- Full-screen empty: centered, max 420px, 72px top margin, 44px icon tile (radius 10,
  `surface-muted`), 15px/600 title, `text-tertiary` body, one primary CTA.
- Error: same layout with a `danger-bg` tile and `cloud_off` icon, title "Couldn’t load data",
  primary "Try again" + secondary "Report a problem", then a mono 11px error code line.
- Loading: skeleton blocks in `surface-skeleton` (4 KPI tiles of 96px, then a card with
  rows: a 22px square plus a 10px bar of varying width). No spinners.
- Inline empty inside a card: centered muted 12.5–13px text, optionally with a 22–24px
  `text-disabled` icon and a secondary button ("Clear search and filters").
- Empty kanban column: dashed `border-dashed` box, "No deals", 11.5px `text-disabled`.

**Other patterns.**
- Auto-generated items: tasks show a `bolt` icon or an `auto` tag; timeline auto entries are
  compact grey single lines with a dashed icon ring, while manual entries are bordered bubbles
  with an accent-soft icon.
- Stuck (over SLA): red text + `timer` icon; kanban card gets `danger-border-stuck` border and
  `danger-softer` bg.
- Filter chips: 26px pill, `accent-soft` / `accent-strong`, remove ×; "+ Filter" is a dashed pill.
- Modal: 440px, radius 10, overlay `rgba(28,27,26,.32)`, footer with a top divider and right-aligned buttons.
