# Phase 8 — Frontend Audit

Step 1 of Phase 8 (frontend redesign). Read in full: `src/App.jsx` (3,059 lines), `src/AuthScreen.jsx`
(927 lines), `src/api.js`, `index.html`. No CSS files exist anywhere in this project — every visual
rule in the app is an inline `style={{}}` object in one of those two `.jsx` files, plus one
`<style>` block in `index.html` for global resets. That single fact drives most of what's below.

## 0. What this app actually is, screen by screen

Several items on the requested audit list don't correspond to a real, distinct screen in this
codebase. Rather than force-fit an audit onto screens that don't exist, this section maps request
→ reality first, so the rest of the document is honest about what's actually there.

| Requested | Reality |
|---|---|
| Landing page | Doesn't exist separately. `AuthShell` (`AuthScreen.jsx`) *is* the entire signed-out experience — wordmark, one tagline, the login/signup card. No marketing content, no product screenshots, no pricing, nothing to convert a visitor before they're asked for a password. |
| Authentication | Real, and the most mature part of the frontend — 5 sub-screens (`AuthScreen` login/signup, `OtpScreen`, `ForgotPasswordScreen`, `ResetPasswordScreen`) in `AuthScreen.jsx`. |
| Dashboard | Real — `Dashboard()` in `App.jsx`, but it's one 1,500-line function containing three tabs (`Overview`, `Categories`, `Savings`) plus a fourth reachable-but-hidden view (`Transactions`) as internal `tab === "X"` conditionals, not separate routes or components. |
| Upload flow | Real — `UploadScreen()`. |
| Transactions | Real, but not a nav tab — only reachable by clicking a stat card or "View All Transactions" link from Overview. No direct URL, no way to land here on refresh. |
| Analytics | Doesn't exist as a separate concept — it's fused into the Overview tab (donut chart, bar chart, line chart, recurring payments, recent transactions all together). |
| Categories | Real — `tab === "Categories"`. Merchant-rule editing is folded into this tab (see below), not separate. |
| Merchant rules | No dedicated screen. A merchant→category mapping (`POST /api/merchant-rules`) is created silently as a side effect of reassigning any transaction's category (Transactions tab and Categories tab both do this). There is no screen to view, edit, or delete an existing rule once created. |
| Settings | Doesn't exist. |
| Profile | Doesn't exist. The only "profile" surface is the user's name printed in the header (desktop only) plus a "Delete Account" button. No edit-name, no change-password, no change-email, no notification prefs, nothing. |
| Mobile responsiveness | One hook, `useIsMobile()` (a single `window.innerWidth < 768` boolean), used throughout to swap between two hardcoded layouts. No tablet breakpoint — anything 768–∞ gets the desktop layout verbatim. |
| Navigation | No router. `App()` picks one of `AuthScreen` / `UploadScreen` / `Dashboard` by raw state, and `Dashboard` picks one of its 4 tabs by raw state. Zero URLs are meaningful — the whole app lives at `/`; refreshing always re-derives from scratch (auth check → auto-restore latest file → land on Overview). |
| Loading states | Exactly one, app-wide: a centered "Loading…" text string while the initial session check runs. No skeletons anywhere. |
| Error states | Present but inconsistent — see §5. |
| Empty states | Present but inconsistent — see §6. |
| Accessibility | Audited in Phase 6 already (`tests/e2e/a11y.spec.js`, ADR-019) — this section adds the specific *causes*, not just the axe rule IDs. |
| Typography | One `theme`-adjacent set of 3 hardcoded font-family strings, no scale — see §7. |
| Color system | One real, reasonably good `theme` object — see §8. |
| Spacing | No system at all — arbitrary pixel values everywhere — see §9. |
| Icons | Google's Material Symbols Outlined (via a `<link>` in `index.html`), used consistently by name string — see §10. |
| Animations | Almost none — see §11. |

## 1. Authentication (`AuthScreen.jsx`)

**What currently works:** genuinely solid. Real-time field validation, password visibility toggle,
OTP auto-submit on 6th digit with paste support, resend cooldown timer, tab-switch between
sign-in/create-account preserves nothing weird, reCAPTCHA v3 wired invisibly. This is by a wide
margin the most finished screen in the app, and Phase 6 gave it real e2e/a11y coverage.

**UX problems:** the "Forgot password?" and reset flows are real UI but structurally untestable
end-to-end in this environment (no SMTP creds — ADR-021) and, per Phase 6's finding, silently
failed until this session (`ForgotPasswordScreen` bug, now fixed). No "remember me" / persistent
session length choice. No visible password strength meter beyond a static "at least 8 characters"
hint.

**UI problems:** the entire auth "shell" (wordmark + tagline + card + privacy note, `AuthShell` in
`AuthScreen.jsx`) is also, structurally, the app's *only* landing page — a visitor with zero
context gets a login form and one sentence ("Your personal finance dashboard"), no explanation of
what the product does before being asked to create an account.

**Accessibility issues:** OTP's six single-digit `<input>`s have no `aria-label` distinguishing
them from each other for a screen reader (`"Code from email"` labels the group, not each cell).
Password visibility toggle button icon-only, no `aria-label` confirmed. Consistent with the
project-wide "zero `aria-*`" finding (ROADMAP.md, since Phase 1).

**Performance:** negligible — this is the lightest screen in the app.

**Technical debt:** `useRecaptcha()` and `routeError()` are ad hoc top-of-file helpers, fine as-is.

**Reuse:** `Field`, `Spinner`, `AuthShell` are clean, single-purpose, and directly portable into a
real design system with minimal change. `OtpScreen`'s digit-input pattern is genuinely good UX and
worth keeping as a reusable `OtpInput` component.

**Replace:** none of the *logic* — only the styling layer (inline styles → design-system
primitives).

## 2. Upload flow (`UploadScreen()`, `App.jsx:934–1299`)

**What currently works:** drag-and-drop plus click-to-browse, client-side 10MB guard, CSV/PDF
branching, per-year filtering of upload history, "try with sample data" as a zero-friction
first-run path, delete-from-history with a confirm.

**UX problems:** upload progress is a single swapped string ("Parsing your statement..." /
whatever `loadingMsg` says) with no percentage, no cancel. Errors from a bad file replace nothing
visually distinct from the drop zone's resting state except a red box below it — easy to miss on
a long page. The "Recent transactions" preview panel (right column, desktop only) is **hardcoded
fake data** (`Whole Foods`, `Netflix`, `Payroll deposit` — literal strings in the component), not
a real preview of anything — a new user has no way to know this isn't live.

**UI problems:** two-column desktop layout collapses to a single column on mobile by literally
hiding the entire right column (`display: isMobile ? "none" : "flex"`) — the feature badges and
fake-preview panel simply don't exist for mobile users, not reflowed, removed.

**Accessibility issues:** the drop zone is a `<div>` with `onClick`/`onDrop` handlers, not a
`<button>` or `role="button"` with `tabIndex` — unreachable and unusable by keyboard alone (the
hidden `<input type="file">` inside it isn't itself focusable via Tab in the same way a visible
control would be).

**Performance concerns:** none observed — PDF parsing runs client-side (`pdf.js`, loaded from an
external CDN per this session's earlier memory note) and CSV parsing is synchronous via PapaParse;
fine at current file-size limits.

**Technical debt:** `generateSampleData()` and the CSV/PDF parsing engine (`detectColumns`,
`parseAmount`, `parseDate`, the whole PDF strategy-pattern block) all live in the same file as the
UI — a real separation-of-concerns gap, not just a styling one.

**Reuse:** the drop-zone interaction model and the file-history card grid are good UX and worth
keeping; the fake preview panel should not survive into the redesign as-is (replace with real data
or remove).

**Replace:** the drop zone needs a real focusable/keyboard-operable implementation; the loading
state needs a real progress indicator, not a text swap.

## 3. Dashboard — Overview tab (`App.jsx:1721–1926`)

**What currently works:** four `StatCard`s, a donut (category composition), a bar chart (monthly
income/expense), a line chart (net cash flow), a recurring-payments list, and a recent-transactions
list — genuinely useful information density, and the data itself (via `useMemo`-derived
`monthlyData`/`catBreakdown`/`recurring`) looks correct.

**UX problems:** this is where "Analytics" actually lives — there is no way to filter by date
range, compare periods, or drill into a single category from a chart click (the donut/bar/line
charts are read-only, decorative in the interaction sense beyond the built-in Recharts tooltip).

**UI problems:** every card repeats the same `boxShadow: "0 1px 3px rgba(27,28,26,0.06)"` /
`borderRadius: 8` / `padding: "28px 32px"` triplet verbatim, by hand, at every call site — a
textbook case for a `Card` component that doesn't exist yet.

**Accessibility issues:** confirmed directly by Phase 6's real axe scan (ADR-019):
`landmark-one-main` / `region` (no `<main>` landmark anywhere in the app despite `UploadScreen`
having a literal `<main>` tag — `Dashboard` does not), `page-has-heading-one` (no real `<h1>` on
this screen), plus `svg-img-alt` and `scrollable-region-focusable` specifically from the Recharts
pie chart's default markup.

**Performance concerns:** every derived value (`monthlyData`, `catBreakdown`, `recurring`,
`recentTransactions`) is recomputed via `useMemo` off `rawTxns`/`customCats`/`txnOverrides`/
`merchantRules` — reasonable today; worth re-checking once the 10k-transaction upload ceiling
(ADR-006) is actually exercised, since none of this is virtualized.

**Technical debt:** none beyond the general inline-style debt.

**Reuse:** `StatCard`, `TabBar`, `SectionTitle`, `CustomTooltip` are already genuinely
component-ized (unusual for this file) and can move into a design system nearly as-is.

**Replace:** the raw `<div style={{...}}>` "card" wrapper pattern, repeated ~15 times across this
one tab alone.

## 4. Dashboard — Transactions view (`App.jsx:1929–2138`)

**What currently works:** bulk-select with a header checkbox, bulk reassign-category modal that
also creates new categories inline, mobile/desktop layouts that both work.

**UX problems:** the biggest single gap in the app — **no search, no filter (by category, date
range, or amount), no sort, no pagination.** Every transaction ever uploaded across every
statement renders into one `maxHeight: 600, overflowY: "auto"` scrolling `<div>`. This tab is also
not reachable from the tab bar at all (see §0) — only via a stat-card click or a "View All" link,
which most users won't discover without exploring.

**UI problems:** category is shown as a plain text pill with no color coding matching the category
system used elsewhere (Categories tab assigns each category a real color from `apiCat.color` /
`PALETTE`; this list ignores it entirely).

**Accessibility issues:** the "select all" checkbox and per-row checkboxes have no associated
`<label>`; the whole grid-of-divs table has no `role="table"`/`role="row"` semantics — a screen
reader hears an unstructured list, not a table.

**Performance concerns:** rendering every transaction unconditionally (no virtualization, no
pagination) is the one place in the app where a large upload (approaching the 10k-transaction
ceiling from ADR-006) would visibly matter — this is worth flagging for Phase 8/9, not just a
cosmetic note.

**Technical debt:** the "learn merchant→category mapping" side effect is duplicated verbatim
between this tab's reassign modal and the Categories tab's uncategorized-transaction quick-fix
buttons (§5) — same 6 lines of `setMerchantRules`/`authFetch("/api/merchant-rules", ...)` logic,
copy-pasted.

**Reuse:** the reassign-modal pattern (pick existing category or type a new one) is good and
should become a shared component, since it's already duplicated once.

**Replace:** the whole list needs real filtering/search/pagination — this is functionality work,
not just a visual rewrite, and should be scoped explicitly rather than silently dropped from Phase
8's plan.

## 5. Dashboard — Categories tab (`App.jsx:2141–2467`)

**What currently works:** a categorization-completeness summary bar, a per-category spending
breakdown with progress bars, category cards with inline keyword-editing, a "New Category" modal
with a small fixed color palette, and an "Uncategorized Transactions" quick-fix panel that lets a
user one-click-assign any `Other`-bucketed transaction to a category (which is also where the
undocumented merchant-rule creation happens).

**UX problems:** the fixed 8-color palette in the "New Category" modal is a separate, smaller
palette than the `PALETTE` array charts use elsewhere for auto-assigned categories — two different
color systems for the same concept (a category's color) depending on whether a human or the app
picked it.

**UI problems:** category cards are `flex: "1 1 220px"` wrapping items with no fixed grid — at
certain viewport widths this produces uneven row heights and ragged left edges, a classic
flex-wrap-without-a-grid artifact.

**Accessibility issues:** the delete-category "×" button has a `title` attribute (tooltip) but no
`aria-label`, so it announces as an unlabeled button, not "Delete category [name]," to a screen
reader.

**Performance concerns:** none observed at current data volumes.

**Technical debt:** this is where a dedicated "Merchant Rules" screen is conspicuously absent —
every rule created here or in Transactions is permanent and invisible; there's no way to see
"Whole Foods → Groceries" was ever learned, let alone undo it, short of re-reassigning every future
transaction from that merchant by hand.

**Reuse:** the category-card layout and the categorization-progress summary bar are strong UX and
should carry forward.

**Replace:** the two-color-system problem should be resolved (one palette, one source of truth)
as part of the design system work in Step 2.

## 6. Dashboard — Savings tab (`App.jsx:2470–2925`)

**What currently works:** goal-setting form, a derived monthly-target/feasibility calculation, and
a genuinely clever "interactive cut planner" (per-category cut sliders that recompute feasibility
live) — the most sophisticated single piece of client-side logic in the whole frontend.

**UX problems:** the goal itself is **never persisted** (ADR-007 — confirmed directly in code:
`savingsGoal` is plain `useState`, no `POST` anywhere near it) — refresh the page, or even just
switch tabs and back, and it's presumably retained only because `Dashboard` doesn't unmount
between tab switches (state survives) but is gone entirely on page reload or re-login. Nothing in
the UI discloses this — a user could reasonably believe they've "saved" a goal.

**UI problems:** consistent with the rest of the dashboard (card/shadow/radius repetition).

**Accessibility issues:** the cut-planner's `<input type="range">` sliders have no visible numeric
label tied to them via `aria-valuenow`/`aria-valuetext` beyond the adjacent plain-text percentage —
same class of gap as the rest of the app.

**Performance concerns:** none.

**Technical debt:** the single biggest deferred feature in the app — ADR-007 explicitly scoped
"Budgets/Savings Goals persistence" out of Phase 3 as a feature decision, not an oversight, and
it's still open. Phase 8 should decide, not silently inherit, whether persisting this is finally in
scope.

**Reuse:** the cut-planner's slider-driven feasibility recalculation is worth keeping conceptually
even if the visual layer is rebuilt.

**Replace:** needs either real persistence (`POST /api/savings-goal` or similar, a real backend
decision) or an explicit, visible "this isn't saved yet" affordance if Phase 8 keeps it
client-only.

## 7. Typography

Three hardcoded font-family strings (`font` = Manrope, `fontMono` = Inter, `fontHeadline` =
Newsreader — despite the variable name, `fontMono` is Inter, a humanist sans, not a monospace
font; it's used for numbers/labels needing tabular alignment, not code), loaded via Google Fonts
`<link>` tags in `index.html` with no `font-display` strategy specified beyond Google's own
default, no self-hosting, no fallback stack beyond the browser default if the CDN fails. Font
*sizes* are one-off pixel values chosen per call site (`fontSize: 11`, `13`, `14`, `16`, `18`,
`20`, `22`, `24`, `28`, `30`, `36`, `40`, `56` all appear somewhere) — no named scale (no
"heading-lg", "body-sm", etc.), so visual hierarchy is whatever each author happened to type at
that call site.

## 8. Color system

The one genuinely systemic thing in this codebase: a single `theme` object (`App.jsx:333–352`)
with semantic-ish names (`bg`, `surface`, `text`, `textMuted`, `textSubtle`, `primary`, `accent`,
`green`/`greenSoft`, etc.) reused consistently by reference across both files. This is a real
foundation to build on, not a gap. **What's missing:** no dark-mode variant (ROADMAP tech debt
since Phase 1), no exposure as CSS custom properties (it's a plain JS object, so it can't be
themed at the CSS layer, only by re-rendering with different inline `style` values — expensive and
un-idiomatic compared to `prefers-color-scheme` + CSS variables), and two colors
(`theme.yellow`/`theme.yellowSoft`) are literally aliased to the same hex values as `theme.primary`
— either dead/mistaken naming or an intentional-but-undocumented decision, worth resolving
explicitly rather than carrying the ambiguity forward.

## 9. Spacing

No system. `padding`/`margin`/`gap` values observed across both files include (non-exhaustive):
2, 4, 5, 6, 8, 9, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 60, 64 — effectively every
even number a developer reached for in the moment, not steps on a defined scale. An 8-point system
(the request for Step 2) would need to reconcile all of these into ~8/16/24/32/40/48/64, which will
visibly change density on nearly every screen — worth flagging now, not discovering mid-rewrite.

## 10. Icons

Consistent, at least: Google's Material Symbols Outlined font, referenced by string name
(`className="material-symbols-outlined"` + text content = icon name, e.g. `cloud_upload`,
`repeat`, `description`). All icons share one `font-variation-settings` rule set globally in
`index.html` (`'FILL' 0, 'wght' 300`), overridden ad hoc in a few places (e.g. the "Password
updated!" checkmark uses `'FILL' 1, 'wght' 400` for a filled variant). This is a workable icon
system already; Phase 8 doesn't need to replace it, only formalize the variant usage.

## 11. Animations

Almost none exist. The only actual CSS animation in the entire app is one `@keyframes spin` (for
`Spinner`, defined inline in `AuthShell`'s JSX via a literal `<style>` tag — the *only* non-inline
CSS rule in the whole codebase). Everything else that looks like motion is a CSS `transition` on
hover/state-change (box-shadow on card hover, border-color on inputs, width on progress bars) —
tasteful and cheap, but there's no shared animation-duration/easing scale (values seen: `0.1s`,
`0.12s`, `0.15s`, `0.2s`, `0.25s`, `0.4s` — again, ad hoc per call site, not a scale). No page
transitions, no skeleton shimmer, no toast enter/exit animation (there's no toast system at all —
see below).

## 12. Cross-cutting gaps (apply everywhere, not one screen)

- **No toast/notification system.** Every success/failure is either inline text (errors) or
  nothing at all (e.g. creating a category, saving a keyword, deleting an upload — all fire-and-forget
  `.catch(() => {})` with no visible confirmation of success).
- **No skeleton loaders anywhere** — the one loading state in the entire app is the app-root
  "Loading…" string (§0). Every other async operation (loading file history, loading
  categories/merchant-rules on Dashboard mount) has no loading indicator at all — content just pops
  in when the fetch resolves.
- **Empty states exist but are inconsistent**: plain, unstyled sentences ("No recurring payments
  detected", "No transactions yet", "Not enough data available for monthly analytics") — functional,
  but each is a one-off string with no shared `EmptyState` component, no illustration/icon, no
  suggested next action.
- **Error states are inconsistent in *placement*, not just style**: some errors render inline near
  the triggering control (Upload's drop zone, every Auth form), some are silently swallowed
  (`.catch(() => {})` throughout `Dashboard`), and there's no global error boundary — a render-time
  exception anywhere in this 3,000-line `App.jsx` would produce a blank white screen with no
  recovery UI.
- **Global focus-outline removal**: `index.html`'s global `<style>` block sets
  `svg:focus { outline: none }` and `.recharts-surface:focus { outline: none }` with no replacement
  focus style — keyboard users lose visible focus on every chart element. This is a specific,
  fixable root cause behind part of the axe `region`/keyboard-nav gap, not just "no aria attributes."
- **Three literal DOM `id`s exist purely for test hooks** (`id="tx3m4s"`, `id="unc7y2"`,
  `id="catx9q"` in `App.jsx`) — cryptic, non-semantic, clearly added to give something stable for
  automation to grab in the absence of `data-testid`/`aria-label` conventions. Worth replacing with
  real `data-testid` attributes (or better, `aria-label`s that serve both accessibility and testing)
  as part of the redesign, rather than accumulating more of these.
- **No component library, no CSS methodology, no design tokens** — every "component" that looks
  reusable (`StatCard`, `TabBar`, `Field`, `SectionTitle`) is a genuinely well-factored React
  function, but its *styling* is a one-off inline object with no connection to a shared scale for
  color, spacing, radius, shadow, or typography. This is the actual, root architectural problem
  Phase 8 exists to fix — everything above is a symptom of it.

## 13. What should be reused vs. replaced (summary)

**Reuse (logic + structure, restyle only):** `Field`, `Spinner`, `AuthShell`, `OtpScreen`'s digit
input pattern, `StatCard`, `TabBar`, `SectionTitle`, `CustomTooltip`, the reassign-category modal
pattern, the category-card layout, the cut-planner's slider/feasibility logic, the drop-zone
interaction model (once made keyboard-accessible).

**Replace outright:** the ad hoc inline-style "card" wrapper (repeated ~20+ times with the same 3
properties retyped by hand), the fixed 8-color category palette (reconcile with `PALETTE`), the
hardcoded fake "Recent transactions" preview in `UploadScreen`, the three test-only DOM `id`s, the
global focus-outline removal in `index.html`.

**Needs a product decision, not just a restyle:** whether Transactions gets real search/filter/
pagination, whether Savings Goals finally get persisted (ADR-007), whether Merchant Rules gets a
real management screen, and whether a true marketing landing page (distinct from the login form)
is in scope for Phase 8 or stays deferred.

## 14. Scope decisions (made after this audit, before Step 2)

Four open product questions from §13 were resolved before proceeding:

- **Transactions gets real search/filter/sort** — not just a restyle of the unfiltered list.
  `api/data.js` currently has no `page`/`search` query-param support (a Phase 4 tech-debt item
  ROADMAP.md already tracked as "no caller yet") — this is now that caller. Likely needs a small,
  additive API change (query params on `GET /api/files/:id`'s transaction list, or a new
  lightweight endpoint) — still "existing backend," not a new API surface, per this phase's
  instruction to avoid changing APIs unless necessary.
- **Savings goals get real persistence** — closes ADR-007. New collection
  (`savings_goals` or similar) + a small route, isolated from the rest of `api/data.js`.
- **Merchant rules get a simple management screen** — list + delete. `api/_lib` already has the
  `merchant_category_rules` collection and the routes exist (`GET`/`POST` on `/api/merchant-rules`
  per `api/auth.js`'s header comment listing routes, and `api/data.js` per ADR-010's mention of
  it) — this is UI-only work, no new backend surface expected, but a `DELETE` route may not exist
  yet and needs checking before Step 3.
- **A real landing page gets built** — distinct from the auth card, matches the requested rewrite
  order's "1. Landing page" step.

These three feature additions (search/filter, savings persistence, merchant-rules management) mean
Phase 8 is no longer purely a visual rewrite — it carries small, real backend work alongside the
frontend rewrite. Flagging this now since it affects Step 3 (component architecture needs
`features/` modules for these, not just presentational components) and Step 4 (rewrite order should
sequence backend-touching screens with enough buffer to verify the API changes don't regress
Playwright's e2e suite, per this phase's "keep all existing Playwright tests passing" instruction).

---

Next: Step 2 (Design System) — building the color/typography/spacing/component system this audit
shows is currently absent, informed directly by the "reuse vs. replace" list above.
