# Categories/Settings Navigation & IA Rework

Status: approved design, pending implementation + visual approval before commit.
Date: 2026-08-09

## Goal

Reorganize CashCanvas's information architecture without redesigning its visual
language:

- Bottom navigation focuses on frequently-used destinations only.
- Merchant Rules moves out of the bottom nav into Settings.
- Transactions moves out of the bottom nav; the Categories page becomes the
  primary entry point for category-based transaction management, with a
  "View All Transactions" link as the path to the full transaction view.
- Categories page gains a real bulk-categorization workflow for uncategorized
  transactions.
- Settings page better uses available width and gains a Merchant Rules entry.

This is an information-architecture and interaction change, not a visual
redesign. Existing tokens (`--space-*`, `--text-*`, `--surface*`, `--border`,
`--radius-*`), the `Card`/`Button`/`Dialog`/`Field`/`EmptyState`/`StatCard`/
`Table` primitives in `src/components/ui/`, and the inline-style convention
(no Tailwind) are preserved throughout.

**No commit, push, or production change happens until the user has reviewed
local desktop + mobile screenshots of the implemented layout and explicitly
approved it.**

## Non-goals

- No change to authentication/session behavior.
- No change to the dashboard, analytics, savings, or upload pages.
- No change to the color system or typography scale.
- No new backend persistence for transaction categories — the existing
  merchant-rule-based persistence (`POST /api/merchant-rules`, upsert by
  cleaned merchant name) remains the only categorization-write mechanism.
- No removal of the `/transactions` or `/merchant-rules` routes — only their
  presence in the bottom nav changes.
- No large-scale redesign of the Transactions page. It keeps its existing
  search/date-filter/sort/bulk-select-and-reassign behavior; the only
  structural change is grouping the results by category instead of a flat
  list.

## 1. Navigation

- `src/layouts/navigation.js`: flip `enabled: false` for the Transactions and
  Merchant Rules entries in `NAV_ITEMS`. `BottomNav` and `CommandPalette` both
  derive from `SIDEBAR_ITEMS = NAV_ITEMS.filter(i => i.enabled)` (or read
  `NAV_ITEMS` directly for the palette — confirm at implementation time), so
  both surfaces update from this single source of truth.
- Resulting bottom nav order: **Overview → Upload → Analytics → Categories →
  Savings → Settings**.
- Routes `/transactions` and `/merchant-rules` stay registered in
  `router.jsx` — unaffected by the nav change. Deep links continue to work.
- If Command Palette currently renders disabled items (needs confirming
  against current behavior for other `enabled: false` entries), match
  whatever precedent already exists rather than inventing new palette
  behavior.

## 2. Categories page (`src/pages/CategoriesPage.jsx`)

Order stays: Category breakdown → Uncategorized Transactions → View All
Transactions.

- **Uncategorized Transactions** (`UncategorizedPanel.jsx`, already exists in
  the right position): upgrade from single-row "quick fix" chips to true
  multi-select:
  - Row checkboxes + "select all" for the uncategorized set.
  - A selection toolbar shown when ≥1 row is selected: "N selected",
    "Move to category ▾" (existing categories), "Create new category"
    (create-then-assign in one step, reusing the pattern already implemented
    in `ReassignDialog.jsx`), "Clear". Toolbar is absent/disabled with 0
    selected.
  - Existing single-click quick-fix chips can remain for the 1-transaction
    case, or be superseded by the new multi-select toolbar — implementation
    detail to resolve in favor of the least duplication.
  - Persistence mechanism unchanged: bulk assign writes one
    `POST /api/merchant-rules` per distinct cleaned merchant name among the
    selected transactions (same approach as `useTransactionsData.reassign`).
    No new API endpoint.
- **View All Transactions**: a link/button directly below the Uncategorized
  Transactions section, routing to `/transactions`. Must not appear above the
  Uncategorized section.
- General layout: keep the existing `maxWidth: 1080` container; improve
  spacing/section rhythm so the page doesn't read as sparse, without
  inflating card sizes artificially.

## 3. Settings page (`src/pages/SettingsPage.jsx`)

- Widen container from `maxWidth: 640` to `maxWidth: 840`. (Not the full 1080
  used by data-heavy pages — settings content is form-like and shouldn't
  stretch that wide.)
- Keep the existing `Card`-per-section convention. Group sections logically,
  e.g.:
  - **Account**: `ProfileSection` (name/email, unchanged).
  - **Appearance**: `ThemeToggle` (unchanged).
  - **Preferences / Tools**: new "Merchant Rules" card — short description +
    link/button to `/merchant-rules`. Reuses the existing Merchant Rules page
    as-is; does not inline its CRUD UI.
  - **Session**: Sign Out (unchanged).
  - **Delete Account**: unchanged, stays visually separated (destructive
    action).
- Where it reads better on wide viewports, sections may sit two-up rather
  than a single long column — comfortable margins, not edge-to-edge cards.
- Fully responsive: single column on mobile, same as today.

## 4. Transactions page (`src/pages/TransactionsPage.jsx`)

Minimal, targeted change — this page is not being redesigned:

- Add an opt-in "Flat / By Category" toggle (`?view=flat|category` in the
  URL, default `flat`). Default behavior is pixel-for-pixel identical to
  today — same single sorted table, same sort/select-all/reassign semantics
  — so no existing test or assumption about "first row" ordering breaks.
  (Decision superseded an earlier "always grouped" direction after concrete
  evidence it would break the existing sort-persistence test and select-all
  semantics, which assume one flat, globally-ordered list; see the
  implementation plan's Task 10 for the resolved design.)
- `?view=category` groups the same filtered/sorted rows into per-category
  sections, built dynamically from the user's real categories — never
  hardcoded category names.
- "Uncategorized" (the `"Other"` sentinel) is always its own group, pinned
  last regardless of total.
- Other groups ordered by descending total spend within the currently
  filtered/sorted set. Not collapsible in this first version — always fully
  expanded, matching YAGNI (collapse/expand wasn't an explicit requirement).
- Existing search, date-range filter, sort control, and
  `ReassignDialog`-based bulk reassignment continue to work in both views;
  each group gets its own "select all in this group" checkbox in category
  view rather than one global header checkbox.
- Reuse the existing `Table`/row-rendering approach per group rather than
  introducing a new visual pattern — this is a structural regrouping of
  existing rows, not a new component system.

## 5. AI-guess precedence tier on Categories & Transactions

Confirmed decision: extend the documented precedence (merchant rule > cached
AI guess > keyword `categorize()` > `"Other"`) to Categories and Transactions,
which today only run `categorize()` (no AI-guess tier) — only
`useDashboardData` currently exercises `resolveCategory` with a live
`override`.

- Extract the AI-override fetching logic currently embedded in
  `useDashboardData` (`txnOverrides` state, batched `POST /api/categorize`
  calls, `aiDone` flag) into a shared hook, e.g.
  `useAiCategoryOverrides(transactions, customCats, merchantRules)`.
- To avoid tripling AI API calls (one independent fetch per page each time
  the user visits Dashboard, Categories, or Transactions for the same
  uploaded file), lift the override state one level up: a context provider
  scoped at `AppShell`, keyed to the currently-loaded file, fetched once and
  shared by whichever pages consume it. `useDashboardData`,
  `useCategoriesData`, and `useTransactionsData` all read from this shared
  source instead of each independently calling `categorize()`.
- All three hooks compute category via
  `resolveCategory(desc, { customCats, merchantRules, override })` instead of
  raw `categorize()`.
- Behavior change to flag: because AI guesses can resolve transactions that
  keyword-matching alone left as `"Other"`, the uncategorized count/set on
  Categories and Transactions may shift (typically shrink) once this ships.
  This is intended, not a bug.

## Testing

- `tests/e2e/categories.spec.js`: multi-select bulk assign to existing
  category, create-new-category-and-assign, persistence after reload,
  updated totals/uncategorized count, View All Transactions link position
  and destination.
- `tests/e2e/transactions.spec.js`: category-grouped rendering, dynamic
  group names from real categories, Uncategorized group pinned last, existing
  search/filter/sort/bulk-reassign still function within/across groups.
- Nav coverage (`tests/e2e/responsive.spec.js` and/or a new spec): Transactions
  and Merchant Rules absent from the bottom nav; nav order matches Overview →
  Upload → Analytics → Categories → Savings → Settings; Merchant Rules
  reachable from Settings; `/transactions` and `/merchant-rules` routes still
  resolve directly.
- `tests/e2e/settings.spec.js`: Merchant Rules entry present and functional,
  widened layout.
- `tests/e2e/merchant-rules.spec.js`: unchanged CRUD behavior still passes
  (page itself isn't modified).
- Unit tests: extend `tests/categorization.test.js` coverage if the shared
  AI-override hook introduces any new pure logic worth isolating; otherwise
  cover it via existing hook-level tests if present.
- Run lint, unit tests, relevant E2E specs, and build before considering
  implementation done.

## Rollout checkpoint

Per explicit user instruction: implement locally, run the dev server, take
desktop and mobile screenshots of Categories, Settings, Transactions, and the
bottom nav, and present them for approval. **No git commit or push happens
until that approval is given.**
