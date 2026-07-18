# Phase 8 — Rewrite Migration Plan

Step 4 of Phase 8. Never a big-bang rewrite — each phase below ships independently, verified
against the Phase 6 Playwright suite before the old implementation it replaces is removed.

## What "keep the existing suite passing" actually means here

Read literally, "never touch a test file" would be impossible: this plan (with your approval from
the audit stage) adds a real landing page ahead of the login form, promotes Transactions to a
first-class nav route, and changes what an authenticated user lands on after login — all
deliberate UX changes, not implementation details. Several existing assertions
(`tests/e2e/homepage.spec.js`'s "loads and shows the auth screen when signed out",
`auth.spec.js`'s post-login landing check) encode the *old* behavior by design and will need
updating to match the *new*, approved behavior.

The real, honest commitment for this plan is:

1. The full suite is **green at the end of every phase**, no exceptions.
2. Every test change is because a specific, already-approved behavior changed — never a silent
   "test broke, so I changed it to pass."
3. Each phase below states up front exactly which existing tests are expected to need updating
   and why, and what new tests get added for the new behavior. Nothing is a surprise mid-phase.
4. The old implementation for a given screen is deleted only after its replacement's tests (old,
   updated, and new) are green — the two implementations coexist for the span of one phase, not
   swapped instantaneously.

## Phase ordering

Your requested order (Landing → Auth → Navigation → Dashboard → Upload → Transactions → Analytics
→ Categories → Settings → remaining) is followed, with one technical adjustment made explicit
here rather than silently: **routing itself has to be introduced alongside Landing**, not as a
separate step afterward, because Landing is a wholly new page with no existing route to attach
to — there is nothing to "navigate to" it without a router already in place. "Navigation" (Step 3
below) is therefore where the *shell* (Sidebar/AppShell, `NavLink`-driven active states, the
logo-`Link`) gets formalized once enough real routes exist to navigate between, not where routing
is first introduced. This is called out once here so the phase list below isn't confusing about
why Phase 1 already mentions `react-router-dom`.

---

### Phase 0 — Foundation (prerequisite, no visible change)

**Build**: `styles/tokens.css`, `styles/globals.css` (self-hosted fonts, focus-visible defaults),
`components/ui/*` primitives (Button, Field, Card, Dialog, Toast, Skeleton*, EmptyState,
ErrorState, ChartTooltip, StatCard, OtpInput, Spinner), install `react-router-dom` and
`lucide-react`.

**Playwright**: no existing test touches anything new here — the running app is byte-for-byte
unchanged (new files exist, nothing imports them yet). Full suite green trivially. No new tests
yet (primitives get tested implicitly once features use them, per Phase 6's own philosophy of not
testing UI with no real caller).

---

### Phase 1 — Landing + Routing foundation

**Build**: `router.jsx` with the full route table from `phase-8-component-architecture.md`, but
every protected route still renders the *old* `Dashboard`/`UploadScreen` components unchanged
(only wired up to a route instead of `useState`) — this phase's actual new surface is just
`/` → `LandingPage` (new) and `/login`, `/signup` → the *existing* `AuthScreen` component,
unchanged internally, just mounted at a route instead of conditionally in `App.jsx`.

**Expected test changes** (flagged now, not discovered mid-phase):
- `homepage.spec.js`: "loads and shows the auth screen when signed out" — updated. `/` now shows
  `LandingPage` content; a new assertion covers the previous test's actual intent (an
  unauthenticated visitor can reach the sign-in form) via clicking Landing's "Sign In" CTA and
  landing on `/login`.
- `homepage.spec.js`: "shows the upload screen instead of the auth screen for an authenticated
  session" — unaffected in this phase specifically (still redirects to the old `UploadScreen`
  path internally), revisited in Phase 4 when Dashboard becomes the real authenticated landing.

**New tests**: `Link`-based logo navigation (`/` ↔ `/dashboard` depending on auth), `/login`
deep-link works directly (no bounce through `/`), browser Back from `/login` returns to `/`
(not out of the app) — the first real coverage of the requested browser-history behavior.

**Old implementation removed**: none yet — `AuthScreen.jsx` is reused as-is, just remounted.

---

### Phase 2 — Authentication (real pages, restyled)

**Build**: `features/auth/components/*` (LoginForm, SignupForm, OtpScreen, ForgotPasswordForm,
ResetPasswordForm) rebuilt on `components/ui/*` primitives and design tokens, replacing
`AuthScreen.jsx`'s inline styles. `pages/{Login,Signup,ForgotPassword,ResetPassword}Page.jsx`
each a thin composition. `/reset-password` now reads `?token=` via `useSearchParams()`, replacing
the manual `window.location.search` sniff (`AuthScreen.jsx:666–668`).

**Expected test changes**: none structural — `auth.spec.js`'s selectors are role/placeholder-based
(`getByRole("button", {name: "Sign In"})`, `getByPlaceholder("you@example.com")`), which is
exactly the kind of selector that survives a full visual rewrite as long as the same accessible
names are preserved (a deliberate design-system requirement, not luck). Every field/button in the
new components keeps its existing accessible name.

**New tests**: keyboard-only signup/login (Tab through every field, submit via Enter — new
Accessibility requirement from the design system, no existing coverage of this).

**Old implementation removed**: `AuthScreen.jsx` deleted once the above is green.

---

### Phase 3 — Navigation shell

**Build**: `layouts/AppShell.jsx`, `Sidebar.jsx` (≥`--bp-lg`), `MobileNav.jsx` (<`--bp-md`),
`TabBar` rebuilt on `NavLink`. Protected routes now render inside `AppShell` instead of each
screen building its own header from scratch (today: `UploadScreen` and `Dashboard` each
hand-roll an identical header — audit didn't call this out explicitly but it's the same
duplication pattern as the card/shadow problem).

**Expected test changes**: none — no protected page's *content* changes in this phase, only what
wraps it.

**New tests**: the full navigation-history suite requested — logo click always returns home,
Back/Forward work across every route pair, refresh preserves the current route, deep links to
every protected route work when already authenticated, no full-page reload occurs on any in-app
navigation (asserted via watching for a new top-level `document` load event, which `<Link>`
navigation never triggers and `window.location.href` always would).

**Old implementation removed**: the duplicated inline headers in `UploadScreen`/`Dashboard`
(still otherwise unchanged, still rendering their old content inside the new shell).

---

### Phase 4 — Dashboard (new authenticated landing)

**Build**: `pages/DashboardPage.jsx` + `features/dashboard/` — the *lightweight* summary view
(stat cards, recent activity, recurring payments), deliberately **not** the full chart set, which
moves to Analytics (Phase 6 below) — the architectural split decided in Step 3. `/dashboard`
becomes the real authenticated landing route; a user with no uploaded data sees `DashboardPage`
render `EmptyState` with an upload CTA, replacing today's separate `UploadScreen`-as-gate pattern.

**Expected test changes**:
- `homepage.spec.js`'s "shows the upload screen instead of the auth screen for an authenticated
  session" — now updated for real: an authenticated session lands on `/dashboard`, and the
  assertion changes from "the upload button is visible" to "the dashboard's empty state with an
  upload CTA is visible" for a no-data account, or real stats for a seeded account.
- Every `auth.spec.js`/`auth-resilience.spec.js` test that currently asserts on
  `getByRole("button", {name: /try with sample data/i})` as the "successfully authenticated"
  signal — updated to assert on a `/dashboard`-specific signal instead (its heading or the
  presence of the empty-state CTA). This is the single largest, most mechanical test update in
  the whole plan — same assertion *shape*, new target element, done once here rather than
  piecemeal.

**New tests**: dashboard empty state (no data) vs. populated state, both real user journeys now.

**Old implementation removed**: `UploadScreen`'s role as the default authenticated landing (the
component itself survives, relocated — see Phase 5).

---

### Phase 5 — Upload workflow

**Build**: `pages/UploadPage.jsx` + `features/upload/` at its own real `/upload` route (no longer
a gate — reachable anytime via Dashboard's empty-state CTA or Settings). `DropZone` rebuilt with
real keyboard/focus support (a `<button>`-based drop target, audit §2's accessibility fix) and the
hardcoded fake "Recent transactions" preview panel removed (audit §2 — it was never real data).

**Expected test changes**: `homepage.spec.js`/`auth.spec.js` tests that drive an upload
(`UploadPage.mjs`'s `loadSampleData()`) still work — the "Try with sample data" action moves from
being the *default* authenticated screen to living at `/upload`, reached via a CTA click first
(one extra navigation step in the test, not a behavior loss).

**New tests**: keyboard-only file selection (Tab to drop zone, Enter/Space to open the file
picker — was previously impossible, audit §2).

**Old implementation removed**: the fake preview panel deleted outright (nothing replaces it —
it was never real).

---

### Phase 6 — Transactions (real search/filter/sort — approved scope addition)

**Build**: `pages/TransactionsPage.jsx` + `features/transactions/` at `/transactions`, now a
first-class `Sidebar`/`TabBar` destination (today: only reachable via a stat-card click). Real
`Table` primitive (`role="table"` semantics, closing the axe finding from ADR-019), search
(`useDebounce`-backed), category/date-range filters, sort. This is the one phase in the plan that
is genuinely new functionality, not a restyle — flagged as such per the earlier scope decision.

**Backend note**: needs `api/data.js` to accept `search`/`category`/`dateFrom`/`dateTo` query
params it doesn't today (ROADMAP.md's Phase 4 tech debt: "no route currently accepts page/search
params" — this is that caller, finally). Small, additive API change — no existing route's
behavior changes, only new optional params on an existing endpoint. Vitest integration coverage
added alongside the API change, matching the existing `tests/data.test.js` pattern.

**Expected test changes**: the reassign-category flow (`auth-resilience.spec.js`'s CSRF test
drives a real upload via `UploadPage.mjs`) is unaffected; any test that clicked a stat card to
*reach* Transactions now clicks a real nav item instead — same destination, different path to it.

**New tests**: search filters results correctly, category filter + search compose correctly,
clearing filters restores the full list, sort persists across a page refresh (now possible — it's
a real query param, e.g. `?sort=date-desc`, not component state).

**Old implementation removed**: the grid-of-divs Transactions view inside `Dashboard`.

---

### Phase 7 — Analytics (split out of the old Overview tab)

**Build**: `pages/AnalyticsPage.jsx` + `features/analytics/` — the donut, monthly bar chart, and
cash-flow line, all rebuilt on the standardized Chart system (design system § Charts: reconciled
palette, real `aria-label`s, keyboard-reachable tooltips, colorblind-checked palette).

**Expected test changes**: none currently assert on chart internals (Phase 6's a11y suite scans
the Overview tab's charts today — those assertions move to scan `/analytics` instead, same
allowlist-based approach from ADR-019, revalidated against the rebuilt markup).

**New tests**: chart keyboard navigation (Tab to a data point, tooltip appears on focus — new
capability, audit found charts were mouse-only before).

**Old implementation removed**: the donut/bar/line block inside `Dashboard`'s Overview tab.

---

### Phase 8 — Categories + Merchant Rules (approved scope addition)

**Build**: `pages/CategoriesPage.jsx` + `features/categories/` (category cards, keyword editing,
uncategorized quick-fix — same logic, rebuilt on tokens) at `/categories`; new
`pages/MerchantRulesPage.jsx` + `features/merchant-rules/` at `/merchant-rules` (list + delete —
the management screen approved earlier). Two-palette problem (audit §5) resolved: the New
Category modal's color picker now pulls from the same reconciled `PALETTE` the charts use.

**Backend note**: merchant-rules currently has `GET`/`POST` on `/api/merchant-rules`
(`api/data.js`) but needs confirming whether `DELETE` exists — if not, a small additive route,
following the same pattern as `DELETE /api/categories/:id`, which already exists.

**Expected test changes**: none for Categories (selectors are role/text-based, survive the
rewrite). None for existing merchant-rule creation (still happens as a side effect of
reassignment, unchanged) — only additive tests for the new management screen.

**New tests**: Merchant Rules list shows a rule created via reassignment (cross-feature
integration test — reassign in Transactions, verify it's listed at `/merchant-rules`), delete a
rule, empty state when no rules exist yet.

**Old implementation removed**: the Categories tab inside `Dashboard`.

---

### Phase 9 — Settings (Savings persistence + Profile — approved scope additions)

**Build**: `pages/SettingsPage.jsx` + `features/settings/` — consolidates what the audit found
completely missing (no Settings, no Profile screen existed at all): account info (name, email —
read-only for now, matching current backend capability), theme toggle (Light/Dark/System, the new
Theme System), delete account (rebuilt `Dialog`, same logic). `pages/SavingsPage.jsx` +
`features/savings/` at `/savings` — same goal-form/cut-planner logic (audit confirmed it's the
app's best client-side logic, kept), now actually persisted, closing ADR-007.

**Backend note**: savings persistence needs a new collection + small route
(`api/data.js`, following the existing pattern for categories/merchant-rules) — the one place in
this plan with genuinely new backend surface, not just new query params on an existing route.
Vitest integration tests added for the new route before the frontend consumes it (test-driven,
matching this project's established `superpowers:test-driven-development` convention from earlier
phases).

**Expected test changes**: none — Delete Account's existing e2e test
(`auth.spec.js`'s "account deletion" test) asserts on the confirm dialog's text and the resulting
redirect to the sign-in screen, both preserved.

**New tests**: savings goal persists across a reload (directly testing the fix — previously
would have failed, since the goal was never saved), profile page keyboard navigation.

**Old implementation removed**: the Savings tab inside `Dashboard`; the header's bare
Delete-Account/Sign-Out buttons (moved into Settings + a user menu in `AppShell`).

---

### Phase 10 — Remaining cleanup

`App.jsx` reduced to its final ~30-line shape (providers + `<RouterProvider>`), `Dashboard`
component deleted entirely (every tab has migrated out), full lint pass for the new
no-hardcoded-values rule (`phase-8-component-architecture.md`'s ESLint addition), full a11y
re-scan of every route (not just the 4 states Phase 6 originally covered — now 13+ real routes
exist), visual-regression baselines regenerated for the new screens (chromium-only, per ADR-020 —
this phase is also when a Linux-native baseline finally gets generated in CI, closing that
tracked gap).

---

## Summary: test-suite discipline across all 10 phases

| Phase | Existing tests updated | New tests added | Old code deleted |
|---|---|---|---|
| 0 | 0 | 0 | none |
| 1 | 1 (homepage landing assertion) | 3 (logo nav, deep-link, back-button) | none |
| 2 | 0 | 1 (keyboard auth) | `AuthScreen.jsx` |
| 3 | 0 | ~6 (full nav-history suite) | duplicated headers |
| 4 | ~6 (post-login landing signal, mechanical) | 2 (empty/populated dashboard) | `UploadScreen` as gate |
| 5 | 0 | 1 (keyboard upload) | fake preview panel |
| 6 | 0 | 4 (search/filter/sort) | old Transactions view |
| 7 | 0 (a11y scan target moves) | 1 (chart keyboard nav) | old chart block |
| 8 | 0 | 3 (merchant rules CRUD) | old Categories tab |
| 9 | 0 | 2 (savings persistence, profile) | old Savings tab, header buttons |
| 10 | re-scan only | 0 | `Dashboard`, old `App.jsx` |

Every "existing tests updated" count above was named specifically in its phase, not left vague —
this table is the one place to check, at any point during implementation, whether the plan is on
track.

---

Next: Step 5 (UX Inspiration) — before writing a single mockup, what specifically makes the
reference products feel polished, applied to CashCanvas's actual screens.
