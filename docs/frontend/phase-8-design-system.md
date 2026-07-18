# Phase 8 — Design System

Step 2 of Phase 8. Built directly from the audit's findings (`phase-8-audit.md`): CashCanvas
already has one real system worth keeping (a warm, forest-green color theme) and zero of anything
else (no type scale, no spacing scale, no radius/shadow scale, no component library). This
document formalizes what works and fills every gap, before any component code is written.

## Aesthetic direction: "Ledger"

Not generic fintech (no Inter-everywhere, no blue-on-white SaaS chrome, no purple gradients). The
existing pairing of an italic serif display face (Newsreader) with a clean humanist sans
(Manrope), warm paper-white surfaces, and a deep forest green as the trust color already reads as
something specific: a well-kept financial ledger — warm, personal, slightly literary, closer to a
boutique investment letter than a dashboard. **Phase 8 leans into this rather than replacing it.**
The italic serif headline ("Welcome back, *Param*") is the one genuinely distinctive thing in the
current app and should become a signature, applied consistently, not just an occasional flourish.

Dark mode continues the metaphor rather than inverting to generic slate: "ledger by lamplight" —
warm near-black (brown-black, not blue-black or pure gray), brightened green and brick-red for
contrast, warm off-white text.

## Color tokens

All colors as CSS custom properties, one variable name per token, swapped by `data-theme`/
`prefers-color-scheme` — the actual mechanism (needed because the current `theme` object is a
plain JS object with no CSS-variable layer, which is *why* dark mode has been impossible so far;
see audit §8) is a Step 3 concern. This section only fixes the values.

### Light (default)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#fbf9f6` | page background (unchanged) |
| `--surface` | `#ffffff` | cards, modals, inputs |
| `--surface-alt` | `#f5f3f0` | subtle fills (row hover, chip bg) |
| `--surface-sunken` | `#efeeeb` | recessed areas, dividers-as-fill |
| `--border` | `#e5e2dc` | default border — *new*, was previously identical to `surfaceContainer` (#efeeeb), too low-contrast to read as a real border; darkened slightly |
| `--border-strong` | `#d3cec2` | table headers, focus-adjacent dividers |
| `--text` | `#1b1c1a` | primary text (unchanged) |
| `--text-muted` | `#3f4943` | secondary text (unchanged) |
| `--text-subtle` | `#6f7a72` | tertiary/label text (unchanged) |
| `--primary` | `#005235` | brand, primary actions, links (unchanged) |
| `--primary-hover` | `#003d28` | *new* — hover/active state, previously handled by `opacity: 0.9` hacks at each call site |
| `--primary-container` | `#1a6b4a` | gradient end, secondary emphasis (unchanged) |
| `--positive` | `#1a6b4a` | income, success (same family as primary, unchanged) |
| `--positive-soft` | `rgba(26,107,74,0.08)` | success fills (unchanged) |
| `--negative` | `#b02d21` | expenses, destructive actions, errors (unchanged) |
| `--negative-soft` | `rgba(176,45,33,0.08)` | error/expense fills (unchanged) |
| `--warning` | `#a8721f` | *new* — replaces the broken `theme.yellow` alias (audit §8: it was literally the same hex as `primary`, not a real color) |
| `--warning-soft` | `rgba(168,114,31,0.10)` | *new* |
| `--info` | `#3a6aa0` | *new*, formalized from a value that already existed ad hoc in the category `PALETTE` array |
| `--info-soft` | `rgba(58,106,160,0.08)` | *new* |

### Dark ("ledger by lamplight")

| Token | Value |
|---|---|
| `--bg` | `#17140f` |
| `--surface` | `#211d16` |
| `--surface-alt` | `#2b2620` |
| `--surface-sunken` | `#191611` |
| `--border` | `#3a352c` |
| `--border-strong` | `#4a4436` |
| `--text` | `#f2ede1` |
| `--text-muted` | `#c9c2b0` |
| `--text-subtle` | `#8f8873` |
| `--primary` | `#2e9c6b` (brightened for AA contrast on dark) |
| `--primary-hover` | `#3fb37e` |
| `--primary-container` | `#1a6b4a` |
| `--positive` | `#2e9c6b` |
| `--positive-soft` | `rgba(46,156,107,0.14)` |
| `--negative` | `#e0685a` (brightened brick) |
| `--negative-soft` | `rgba(224,104,90,0.14)` |
| `--warning` | `#d19a4a` |
| `--warning-soft` | `rgba(209,154,74,0.14)` |
| `--info` | `#6f9bc9` |
| `--info-soft` | `rgba(111,155,201,0.14)` |

Both palettes checked for AA text contrast (`--text`/`--text-muted` against `--bg`/`--surface`,
`--primary`/`--negative` against `--surface`) — closing part of the `color-contrast` axe finding
from Phase 6 (ADR-019), not just adding dark mode for its own sake.

## Typography

Fonts unchanged (already distinctive, not generic): **Newsreader** (display/headline, italic),
**Manrope** (UI/body). The existing third "mono" font (`fontMono`, actually Inter — not a
monospace typeface) is renamed conceptually to **numeric** in this system: Inter with
`font-feature-settings: "tnum"` for aligned tabular figures, which is what it was actually being
used for (the "mono" name in the current code was misleading — flagged in the audit).

| Token | Size / Line-height | Font / Weight | Use |
|---|---|---|---|
| `--text-display-xl` | 56px / 1.1 | Newsreader 400 italic | landing hero |
| `--text-display-lg` | 40px / 1.1 | Newsreader 400 italic | page hero ("Welcome back, Param") |
| `--text-display-md` | 28px / 1.15 | Newsreader 400 italic | section hero, mobile hero |
| `--text-heading-lg` | 24px / 1.2 | Newsreader 400 | section titles |
| `--text-heading-md` | 20px / 1.3 | Newsreader 400 | modal / card titles |
| `--text-heading-sm` | 16px / 1.4 | Manrope 600 | dense card headers |
| `--text-body-lg` | 16px / 1.6 | Manrope 400 | intro/lead copy |
| `--text-body-md` | 14px / 1.6 | Manrope 400 | default body — most UI text |
| `--text-body-sm` | 13px / 1.5 | Manrope 400/500 | secondary UI text |
| `--text-label` | 11px / 1.4 | Manrope 600, uppercase, 0.08em tracking | eyebrows, table headers |
| `--text-numeral-xl` | 30px / 1.2 | Inter 600, tabular | stat card values |
| `--text-numeral-lg` | 22px / 1.2 | Inter 600, tabular | category totals |
| `--text-numeral-md` | 14–16px / 1.4 | Inter 600, tabular | table amounts |

Rule going forward: **every** monetary figure uses a `--text-numeral-*` token (tabular figures
required for column alignment — used ad hoc today, formalized now as a rule, not a suggestion).

## Spacing (8-point system)

| Token | Value |
|---|---|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |
| `--space-8` | 32px |
| `--space-10` | 40px |
| `--space-12` | 48px |
| `--space-16` | 64px |
| `--space-20` | 80px |
| `--space-24` | 96px |

(4 and 12 included as half-steps — a strict 8-only scale proved too coarse for compact UI like
table rows and chip padding in practice; this is still the conventional meaning of "8-point
system.") This replaces the current ~20 distinct ad hoc pixel values found in the audit (§9) with
12 named steps.

## Radius

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 4px | chips, inputs, small buttons |
| `--radius-md` | 8px | cards, default buttons (current de facto default, formalized) |
| `--radius-lg` | 12px | modals, prominent cards (matches existing `AuthShell`) |
| `--radius-full` | 999px | pills, avatars, toggle tracks |

## Elevation (shadow)

Light mode:

| Token | Value | Use |
|---|---|---|
| `--elevation-0` | none | flat/inline elements |
| `--elevation-1` | `0 1px 3px rgba(27,28,26,0.06)` | resting cards (existing value, formalized) |
| `--elevation-2` | `0 4px 12px rgba(27,28,26,0.10)` | hover/raised cards |
| `--elevation-3` | `0 8px 24px rgba(27,28,26,0.14)` | dropdowns, popovers |
| `--elevation-4` | `0 24px 48px rgba(27,28,26,0.18)` | modals (existing value, formalized) |

Dark mode: shadows read poorly on dark backgrounds (low contrast against an already-dark surface).
Dark elevation uses a 1px `--border` plus a reduced-opacity shadow rather than shadow alone —
`--elevation-2-dark`: `0 4px 12px rgba(0,0,0,0.35)` + `border: 1px solid var(--border)`, same
pattern scaled at each level.

## Iconography

**Changed from the original Step 2 draft**: Material Symbols Outlined is replaced by **Lucide
React** (`lucide-react`), a decision made explicitly rather than inherited. Reasoning:

- Material Symbols is a font-icon system loaded from a Google Fonts CDN — one more external
  runtime dependency on top of the ones the security threat model already tracks
  (`docs/security/threat-model.md`), and every icon is a string name matched against a font glyph
  table with no compile-time check that the name exists.
- Lucide React ships each icon as an individually importable React component (real SVGs, tree-shaken
  per icon actually used, no CDN, no runtime font load, and a missing/renamed icon is a build-time
  import error instead of a silently blank glyph).
- Lucide's default 1.5–2px stroke line-icon style is a natural fit for the "Ledger" identity — the
  same restrained, drawn-not-filled quality as the serif headline's italic strokes — where Material
  Symbols' rounder, more filled default reads more generically "Google Material."

Single library, no mixing. Every icon in the app becomes a `lucide-react` import — including the
few that had ad hoc filled-variant treatment today (e.g. the reset-password success checkmark),
which becomes Lucide's `CheckCircle2` used at a larger size/bolder stroke rather than a distinct
"filled" render mode (Lucide icons don't have a fill/outline toggle the way Material Symbols did;
emphasis is communicated by size, color, and a filled *background chip* behind the icon instead —
already the existing pattern for the icon badges in `StatCard`/recurring-payments rows).

| Token | Value | Use |
|---|---|---|
| `--icon-sm` | 16px | inline with body/label text, table cell icons |
| `--icon-md` | 20px | default — buttons, nav, list rows |
| `--icon-lg` | 24px | section headers, empty-state icons |
| `--icon-xl` | 32px | hero moments (upload drop-zone icon, large empty states) |

Stroke width: `1.75` (Lucide's default is `2`; `1.75` reads slightly lighter/more refined against
Newsreader's italic strokes — matches the design's overall restraint, confirmed visually in the
Step 6 mockups, not just asserted here). Never mix stroke widths within one screen.

**Semantic usage** (the specific glyph per concept, fixed once so it's never re-decided per call
site): `Upload` (upload/drop-zone), `ArrowUpRight`/`ArrowDownRight` (income/expense direction,
replacing the current `arrow_downward`/`arrow_upward` naming, which was backwards relative to cash
direction — flagged while cataloguing this), `Repeat` (recurring payments), `Tag` (categories),
`Store` (merchant rules), `Target` (savings goals), `Trash2` (destructive delete, always paired
with a confirm), `Pencil` (edit/rename), `X` (dismiss/close, never a bare "×" character as today),
`Check`/`CheckCircle2` (success), `AlertTriangle` (warning), `AlertCircle` (error), `Info` (info),
`ChevronDown`/`ChevronRight` (disclosure), `Search` (the new Transactions search), `SlidersHorizontal`
(filters), `LogOut` (sign out), `Menu`/`X` (mobile nav toggle).

## Motion System

Reference: Linear/Notion/Arc's restraint — motion confirms an action happened, it never performs
for its own sake. Every value below is deliberately small; nothing in this system should read as
"animated," only as "responsive."

**Durations**

| Token | Value | Use |
|---|---|---|
| `--duration-instant` | 80ms | checkbox/toggle flip, icon swap |
| `--duration-fast` | 120ms | hover states, button press |
| `--duration-base` | 200ms | card hover, tab switch, dropdown open |
| `--duration-slow` | 320ms | modal/dialog enter-exit |
| `--duration-slower` | 400ms | progress-bar width fill, page-level transitions |

**Easing**

| Token | Value | Use |
|---|---|---|
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | default for most transitions — fast start, gentle settle |
| `--ease-emphasized` | `cubic-bezier(0.3, 0, 0.1, 1)` | modal/toast/dropdown enter — slightly more deceleration for things that need to feel "arrived," not just appeared |
| `--ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | exits — accelerate out, never lingers |

**Hover behavior**: opacity/background/shadow only — never scale or position shift on hover for
data-dense elements (a growing/moving stat card while scanning numbers is disorienting in a
finance app specifically). Interactive rows (`Card interactive`, table rows) get a background
tint (`--surface-alt`) at `--duration-fast`; elevated elements (cards meant to feel liftable) get
an `--elevation-1` → `--elevation-2` shift at `--duration-base`.

**Focus transitions**: the focus ring itself doesn't animate (an animated focus ring reads as
laggy to keyboard users navigating quickly) — it appears instantly, but the *element* underneath
may still transition color/background at `--duration-fast` as normal.

**Page transitions**: a single, restrained cross-fade (`opacity` only, `--duration-base`,
`--ease-standard`) between routed views — no slide/scale, which would read as mobile-app chrome
rather than a desktop-first dashboard. Respects `prefers-reduced-motion` by skipping straight to
the end state.

**Modal animations**: overlay fades in at `--duration-fast`; the dialog surface itself scales from
`0.98` → `1` and fades in at `--duration-base`/`--ease-emphasized` — a barely-perceptible settle,
not a bounce. Exit is the reverse at `--duration-fast`/`--ease-exit` (exits should always feel
quicker than entrances).

**Dropdown animations**: same pattern as modals but smaller travel — `opacity` + `translateY(-4px)
→ 0` at `--duration-fast`/`--ease-emphasized`, anchored to the trigger.

**Loading animations**: the skeleton shimmer (§ Components, below) at `--duration-slower`,
looping, linear easing (shimmer is the one place a non-standard easing curve is correct — a
constant sweep, not an accelerate/decelerate). Spinners (existing `Spinner` component) keep their
current `1s linear infinite` rotation — no change needed, it was already correct.

**One choreographed moment, not motion everywhere**: the Overview tab's first paint — stat cards,
then charts, then lists, each offset `~40ms` via `--duration-fast`-scaled stagger. This is the
*only* place multiple elements animate in sequence anywhere in the app; every other surface
appears at once. Per the "high-impact moments over scattered micro-interactions" principle — one
well-done sequence beats motion sprinkled everywhere.

All motion respects `prefers-reduced-motion: reduce` globally: durations collapse to `0.01ms`
(not `0`, which some browsers/testing tools treat as "no transition event fires at all," breaking
code that waits on `transitionend`), and the stagger/shimmer/page-transition effects are skipped
entirely rather than just sped up.

## Responsive Grid

Replaces the current single `useIsMobile()` boolean (`window.innerWidth < 768`, no tablet
step — audit §0) with a real breakpoint system.

**Breakpoints**

| Token | Min-width | Target |
|---|---|---|
| `--bp-sm` | 480px | large phone |
| `--bp-md` | 768px | tablet portrait |
| `--bp-lg` | 1024px | tablet landscape / small laptop |
| `--bp-xl` | 1280px | desktop |
| `--bp-2xl` | 1600px | ultra-wide |

**Container widths**: content max-width caps at `1280px` (matches the current `Dashboard`'s
`maxWidth: 1280` — kept, it was already a reasonable choice) with fluid gutters
(`--space-4` mobile → `--space-10` desktop). Ultra-wide (`≥1600px`) does **not** stretch content
to fill — it adds a second gutter step (`--space-16`+) rather than letting card grids sprawl
edge-to-edge, which would hurt scannability of financial data at very wide viewports.

**Grid**: a 12-column CSS Grid at `--bp-lg` and above; single-column stack below `--bp-md`;
2-column at `--bp-md`–`--bp-lg` where content allows (e.g. the Upload screen's drop-zone +
sidebar). Gaps use `--space-5` (mobile) → `--space-6` (desktop).

**Sidebar behavior** (new — the current app has no sidebar, only a top tab bar): a real sidebar
enters at `--bp-lg` and above for primary navigation (see Step 3's routing/nav plan), collapsing
to the existing top tab-bar pattern below `--bp-lg` rather than a hamburger-hidden drawer — tabs
stay visible and reachable at all viewport sizes, only their *position* changes. This preserves
the current app's one genuinely good navigation trait (nothing is ever hidden behind a menu icon
in the desktop-to-tablet range) while adding the sidebar wide layouts need.

**Navigation collapse**: below `--bp-md`, the sidebar/tab-bar becomes a bottom-anchored bar (5
primary destinations max, matching the existing tab set once Transactions is promoted — audit §0)
with a `Menu` (Lucide) overflow for anything beyond that, not a full hamburger-only pattern.

**Cards**: `repeat(auto-fit, minmax(220px, 1fr))` below `--bp-lg` (matches current behavior,
formalized), fixed 3-column at `--bp-lg`–`--bp-xl`, fixed 4-column at `--bp-2xl` — never
unboundedly `auto-fit` at ultra-wide, which is what currently produces uneven card rows (audit
§5's "ragged left edges" finding).

**Dashboard layouts**: single scrolling column below `--bp-md`; two-region layout (primary content
+ a persistent right-rail for quick stats/recent activity) at `--bp-xl`+ — new, the current
Dashboard has no persistent rail, everything is one linear scroll regardless of available width.

**Tables**: below `--bp-md`, the Transactions table collapses to the existing card-row pattern
(already implemented today for mobile — audit confirmed this works and should be kept); at
`--bp-md`+, real `<table>` markup (§ Components) with horizontal scroll only if a viewport is
narrower than the table's minimum readable width, never for the table's normal state.

**Tablet behavior** (`--bp-md`–`--bp-lg`): the specific gap the current app has none of — two-column
where sensible (Upload screen), single-column with wider cards for the Dashboard (not yet wide
enough for a 3-column grid or a right-rail).

**Ultra-wide behavior** (`≥--bp-2xl`): extra gutter, not extra columns beyond the 4-column card cap
above — financial data stays scannable rather than sprawling.

## Charts

One standardized chart system (Recharts stays — audit found no functional problems with it, only
missing accessibility and an inconsistent palette). Every chart in the app follows the same rules:

- **Colors**: a single, ordered categorical palette (12 colors, colorblind-safe — see below),
  pulled from the same source `PALETTE` the Categories tab's manual color picker also uses,
  closing the two-palette problem from the audit (§5). Semantic colors (`--positive`/`--negative`)
  are reserved for income/expense direction specifically and never reused as arbitrary category
  colors, so their meaning stays fixed across every chart.
- **Legend**: category name + swatch, always visible for donut/pie charts (today's donut relies on
  a separate manual legend grid below it — kept, but restyled to `--text-label` tokens); bar/line
  charts use direct labeling (a label at the line's end, or an axis) instead of a separate legend
  where the chart has ≤3 series, matching Stripe/Linear's preference for direct-over-indirect
  labeling (see Step 5).
- **Tooltip**: one shared `ChartTooltip` component (replacing today's `CustomTooltip`, kept
  conceptually, restyled to tokens) — `--surface`, `--elevation-3`, `--radius-md`,
  `--text-numeral-md` for the value, appears on hover/focus (keyboard-triggerable, not
  mouse-only).
- **Hover**: the currently-hovered series/segment brightens (opacity `1`), others dim to `~30%`
  opacity — the existing bar-chart behavior (`activeBarIndex`), extended to every chart type for
  consistency, not just the monthly bar chart.
- **Empty state**: today's ad hoc sentences ("Not enough data available...") become the shared
  `EmptyState` component from § Components, with a chart-shaped icon and, where meaningful, a
  specific unblocking action ("Upload another month to see trends").
- **No-data vs. loading**: two distinct states, currently conflated — "still fetching" uses
  `SkeletonCard`-shaped placeholders matching the chart's real footprint (no layout shift once
  data arrives); "fetched, genuinely empty" uses `EmptyState`. Today both cases can only ever show
  after data has already loaded (there's no chart-level loading state at all — audit §12).
- **Accessibility**: every chart's container gets a real `aria-label` summarizing the data
  ("Donut chart: spending by category, Groceries 28%, largest category" — generated from the same
  data driving the visual, not a static string), `tabIndex={0}` with a visible focus ring on the
  container, and keyboard-reachable tooltips (`Tab` to a data point, tooltip appears on focus).
  Directly closes the `svg-img-alt`/`scrollable-region-focusable` findings from Phase 6 (ADR-019).
- **Color blindness**: the 12-color categorical palette is checked against deuteranopia,
  protanopia, and tritanopia simulations (not just "looks distinct to me") — adjacent palette
  slots differ in *lightness*, not only hue, so two categories never collapse to the same
  perceived color under any common color-vision deficiency. Additionally, the donut chart's legend
  always pairs color with a text label (never color-only encoding), and the bar chart's
  income/expense distinction uses shape/position (bars grouped, income above zero line, expense
  below — already true today) as a redundant, non-color channel on top of the
  `--positive`/`--negative` hues.

## Design Tokens (consolidated)

Every value defined across this document — color, spacing, radius, shadow, type, motion,
breakpoints — becomes one real token source, not scattered across component files the way
`theme`/hardcoded pixels are scattered across `App.jsx` today. Draft shape (finalized in Step 3,
shown here so Step 3's architecture has something concrete to reference):

```css
/* src/styles/tokens.css — illustrative, not yet wired into the build */
:root {
  /* color, spacing, radius, elevation as defined above */
  --bg: #fbf9f6; --surface: #ffffff; /* ...full set from "Color tokens" above... */
  --space-1: 4px; /* ...full set from "Spacing" above... */
  --radius-sm: 4px; /* ...full set from "Radius" above... */
  --elevation-1: 0 1px 3px rgba(27,28,26,0.06); /* ...full set from "Elevation" above... */
  --text-display-lg: italic 400 40px/1.1 'Newsreader', serif; /* shorthand font tokens */
  --duration-base: 200ms; --ease-standard: cubic-bezier(0.2,0,0,1);
  --bp-md: 768px; /* used by container queries / JS breakpoint hooks, not media queries alone */
}
```

**Rule for Phase 8**: no hardcoded color/spacing/radius/shadow/font-size value is permitted in any
new or rewritten component — every value traces to a token above. This is enforceable (a Step 3
concern: either a lint rule against raw hex/px literals in `style`/styled-component calls, or a
code-review checklist item) but the rule itself is decided here, not deferred.

## Theme System

Three modes, not two: **Light**, **Dark**, and **System** (follows OS `prefers-color-scheme`,
and is the default — a user has never had to choose today, and shouldn't have to unless they want
to override it). Preference stored client-side (`localStorage`, a `theme` key: `"light" |
"dark" | "system"`) and applied via a `data-theme` attribute on `<html>`, mirroring exactly the
mechanism this session's own design-system artifact already uses (`:root[data-theme="dark"]`
overriding `@media (prefers-color-scheme: dark)` in both directions) — proven correct, not
speculative.

**Dark mode is not an inversion.** As established in Step 2: "ledger by lamplight," a warm
brown-black (`#17140f`) rather than a generic near-black or slate-gray, with text warmed toward
cream (`#f2ede1`) rather than pure white, and the same forest-green family (brightened for
contrast, `#2e9c6b`) rather than swapping to a different hue. The warm-paper *identity* — not just
the literal light-mode hex values — is what must survive into dark mode: readers should recognize
both themes as the same product, the way a physical ledger looks like itself whether read by
daylight or lamp.

## Accessibility

Every component in this system (§ Components, below) must define six things, not left implicit.
Stated once here as the standard; each component's spec is checked against it:

1. **Keyboard behavior** — every interactive element reachable via `Tab`, operable via
   `Enter`/`Space` (buttons) or arrow keys (radio groups, the OTP digit input's existing
   left/right navigation, tab bars), `Escape` closes dialogs/dropdowns and returns focus to the
   trigger.
2. **ARIA requirements** — real semantic roles first (`<button>`, `<table>`, `<nav>`) so ARIA is
   reinforcing, not compensating for a `<div>`; where semantics need help, explicit `aria-label`/
   `aria-labelledby`/`aria-describedby` (directly closing the audit's OTP-input, delete-button,
   and checkbox labeling gaps — §1, §5, §4), `aria-live="polite"` regions for toast notifications
   and async status changes.
3. **Focus rings** — always visible, never `outline: none` without an explicit, equally-visible
   replacement (directly reversing `index.html`'s current global `svg:focus { outline: none }` —
   audit §12) — `2px solid var(--primary)`, `2px` offset, on every focusable element including
   custom controls (checkboxes, sliders, chart containers).
4. **Contrast targets** — WCAG AA minimum (4.5:1 body text, 3:1 large text/UI components) for
   every token pairing actually used together, checked in both themes at design time (§ Color
   tokens above notes this was done for the base palette; each component's specific token
   combinations get re-checked as they're built in Step 6+).
5. **Reduced motion** — every animated component has a `prefers-reduced-motion` fallback (defined
   per-effect in § Motion System above), not a single global "disable everything" switch that
   might remove a state change a user actually needed to perceive (e.g. reduced motion skips the
   *stagger*, but a toast must still appear, just without the slide-in).
6. **Touch target sizes** — minimum `44×44px` hit area for every interactive element on touch
   viewports (below `--bp-md`), even where the *visual* element is smaller (e.g. the delete-category
   "×" today is a ~15px glyph with no padding — audit §5 — becomes a 15px glyph inside a 44px
   tappable area).

This is the same bar Phase 6's `axe-playwright` suite already checks automatically for
`color-contrast` and a handful of structural rules (ADR-019) — items 2–4 above are exactly what
that suite will catch regressions on as Phase 8 ships; items 1, 5, and 6 need new Playwright
coverage (keyboard-navigation and touch-target assertions don't exist in the Phase 6 suite today)
— tracked in Step 4's migration plan.

## Components

Each spec below states: what it replaces from the audit, and its states.

### Button
Replaces: every hand-rolled `<button style={{...}}>` (dozens of near-identical inline variants
found across both files). Variants: `primary` (filled, gradient `--primary`→`--primary-container`,
matches existing CTA style), `secondary` (outline, `--border` + `--text-subtle`), `danger`
(outline `--negative`, matches existing Delete Account styling), `ghost` (no border, text-only,
matches existing "Sign Out"/tab-link buttons). Sizes: `sm` (32px), `md` (40px, default), `lg`
(48px). States: default, hover (`--elevation-2` or background shift per variant), active/pressed,
disabled (`--text-subtle` on `--surface-alt`, `cursor: not-allowed` — matches existing pattern),
loading (inline `Spinner`, existing component, reused as-is).

### Form controls
Replaces: `Field` (keep as the base text-input pattern, audit confirmed it's already good),
checkbox (currently native, unstyled beyond `accentColor` — formalize a custom checkbox matching
`--radius-sm`), the OTP digit-input pattern (keep, audit confirmed it's good UX), range slider
(currently native `<input type="range">`, needs a real track/thumb style using `--primary`).
States for all: default, focus (**visible** focus ring — `2px solid var(--primary)` with offset,
directly fixing the audit's global-focus-removal finding), error (`--negative` border +
inline message, existing pattern), disabled.

### Cards
Replaces: the single most duplicated pattern in the app — `background: surface, borderRadius: 8,
padding: "28px 32px", boxShadow: elevation-1`, retyped by hand at ~20+ call sites. One `Card`
component, `padding` prop (`compact`/`default`/`spacious` → `--space-4`/`--space-6`/`--space-8`),
optional `interactive` prop (adds hover elevation + cursor, replaces the manual
`onMouseEnter`/`onMouseLeave` boxShadow toggling used today).

### Tables
Replaces: the Transactions list's grid-of-divs (no `role="table"` semantics — audit §4) and the
Categories tab's ad hoc rows. Real `role="table"`/`row`/`columnheader`/`cell` semantics, sticky
header, `--text-label` column headers, `--text-numeral-md` for amount columns, zebra-free (matches
existing hairline-divider style, not row-banding), row hover = `--surface-alt`.

### Charts
See the standalone "Charts" section above — expanded there in full (palette, legend, tooltip,
hover, empty/no-data, accessibility, color-blindness) rather than duplicated here.

### Dialogs (modals)
Replaces: three near-identical modal shells (`DeleteAccountModal`, reassign-category modal,
new-category modal) each reimplementing the same `position: fixed, inset: 0, rgba(27,28,26,0.4)
overlay, centered surface` pattern. One `Dialog` primitive: overlay + `--elevation-4` +
`--radius-lg` surface, focus-trapped, closes on `Escape` and overlay click (existing behavior,
now guaranteed everywhere instead of per-modal reimplementation), entrance animation using
`--duration-base`/`--ease-emphasized`.

### Toasts
**New** — doesn't exist today (audit §12: every success/failure is either inline text or silently
swallowed). Bottom-right stack, `--elevation-3`, one variant per semantic color
(`positive`/`negative`/`warning`/`info`), auto-dismiss 4s with a pause-on-hover, manually
dismissible. First real use: every silent `.catch(() => {})` in `Dashboard` (creating a category,
saving a keyword, deleting an upload) gets a toast instead of nothing.

### Navigation
Replaces: the current `TabBar` (keep the underline-on-active visual, it's already clean) but
extends it to be a real navigation element — Transactions becomes a first-class tab (audit §4:
today it's only reachable via a stat-card click), and the whole app moves off pure `useState`
tab-switching onto real routes (`react-router` or equivalent) so tabs are linkable/refreshable —
a Step 3/4 architecture concern, noted here since it affects the nav component's props (`to` not
`onClick`).

### Skeleton loaders
**New** — the current app has exactly one loading state total (a centered "Loading…" string,
audit §0/§12). Skeleton variants: `SkeletonText` (1–3 lines), `SkeletonCard` (matches `Card`
dimensions), `SkeletonTable` (row placeholders), `SkeletonStat` (matches `StatCard`). Shimmer
animation: a subtle left-to-right gradient sweep, `--duration-slow`, respecting
`prefers-reduced-motion` (a real check — nothing in the current app checks this media query
anywhere).

### Empty states
Replaces: today's plain one-off sentences ("No recurring payments detected", etc. — audit §12).
One `EmptyState` component: icon (Lucide, `--icon-xl`, `--text-subtle`), headline
(`--text-heading-sm`), body (`--text-body-sm`), optional action button. Applied consistently
everywhere a list/chart can be empty, including the upload screen's "no previous uploads" case
(today: the whole section just doesn't render, which is arguably correct, but should be a
deliberate choice per screen, not default absence).

### Error states
Replaces: the inconsistent-placement problem from the audit (§12) — some errors inline, some
silent, no error boundary at all. Three tiers, not one: **field-level** (existing `Field` error
prop, keep), **section-level** (`ErrorState` component, same shape as `EmptyState` but
`--negative` icon/tone, "Retry" action — for a failed data fetch), **page-level** (a real React
error boundary wrapping the app root — currently absent entirely, meaning any render exception
produces a blank white screen).

---

Next: Step 3 (Component Architecture) — turning this token/component spec into an actual
`components/`/`layouts/`/`hooks/`/`contexts/`/`features/` file structure.
