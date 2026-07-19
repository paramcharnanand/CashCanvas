# Checkpoint

Session handoff doc — read this first, then `ROADMAP.md` for full phase history/ADRs/tech
debt. Update this file at the end of every session so the next one can start here instead of
re-deriving context from the repo.

## Release status

**Phase 8.1 through 8.6 verified and committed this session**, plus two CI hotfixes along the
way (see `git log` — `5d42cf8` Phase 8.1, `bd9241c` router hotfix, `bebb653` CI stability hotfix,
the Phase 8.2–8.6 commits). GitHub Actions CI is green on `main` as of the CI stability hotfix —
it was red (webkit-only, deterministic) since before this session started; see "CI stability"
below. Phase 6 (Testing infrastructure, six logical commits) and Phase 7 (CI/CD, `64a1280`) were
the last things pushed before this session.

**Phase 8.6 scoped down from this file's own earlier "Transactions + Categories/Merchant Rules"
note**: built Transactions only (a real `/transactions` route, search/filter/sort, per the
migration plan's own Phase 6) — Categories/Merchant Rules is deferred to its own phase, matching
the migration plan's actual Phase 8, not squeezed into one oversized step. See the Phase 8.6
completion note below for the two scope decisions made along the way (client-side filtering
instead of new backend query params; no reassign-category action on the new page) and the test-
timing bug found and fixed.

**Phase 8.5 found a real, pre-existing production data-loss bug, not something this session
introduced** (see the Phase 8.5 completion note below and ROADMAP.md's ADR-026 for full detail):
every real (non-sample) statement upload — via the legacy gate, the only path that has existed
until this phase — silently failed to persist to the database, for as long as this validation
rule has existed. The upload *looked* successful (client-side rendering doesn't depend on the
save) but the file was never actually saved, and vanished on the next login/reload. Root cause: a
date-format mismatch (`Date.toISOString()`'s full datetime vs. the backend's bare-`YYYY-MM-DD`
validation) combined with the save request's failure being silently swallowed
(`.catch(() => {})`, no `res.ok` check). Verified via a harness-independent `curl` reproduction
against the real API handler (not inferred from a test failure) before touching any code. Fixed
at the root (a timezone-safe `toDateOnlyString` helper, applied to both the legacy path and the
new `/upload` page), with real error surfacing added to the previously-silent legacy save, and a
new regression test that specifically proves persistence (reload after upload), not just
client-side rendering — the gap that let this go undetected.

Phase 8.3 itself picked up mid-flight: a prior pass in this same session had already written the
full restyle (`src/features/auth/*`, `components/ui/{Field,OtpInput,Spinner}.jsx`, the four
`pages/*Page.jsx` wrappers, `AuthScreen.jsx`/`PublicHomePage.jsx` deleted) but left it uncommitted
and `CHECKPOINT.md`/`ROADMAP.md` un-updated. This continuation's job was exactly the verification
checkpoint the engineering rules require — read every changed/new file for correctness and
design-system consistency before trusting it, then run the full gate for real — not re-deriving
the implementation from scratch. Both passed clean: no bugs found, nothing to fix.

Phase 8.4 (Dashboard Overview) surfaced a real sequencing gap in the migration plan before any
code was written: the plan only migrates the Overview tab in this phase, but the legacy
`Dashboard` component's Categories/Savings/Transactions tabs and the `UploadScreen` gate aren't
scheduled for their own routes until Phases 8.6–8.9, and naively replacing `DashboardPage`'s
render would have made them unreachable in the interim — a real product regression, not a
hypothetical one. Flagged to the user as an architectural decision rather than guessed; resolved
as "re-host the existing tab bar, migrate only Overview's content, zero regressions" (see the
Phase 8.4 completion note below for the resulting design).

## Current status

**7 of 9 phases complete (78%); Phase 8 in progress (8.1–8.6 of ~8.9 sub-steps done).** Phases 1–5
and 7 verified/landed in prior sessions; Phase 6 (testing infrastructure) completed two sessions
ago; Phase 8.1 through 8.6 completed this session. Full writeup: `docs/engineering-lessons/
phase-6-testing.md` (testing concepts), `docs/frontend/phase-8-*.md` (design system, component
architecture, migration plan), `ROADMAP.md` ADR-019 through ADR-026. Full phase/ADR history:
`ROADMAP.md`.

## CI stability (fixed this session, unrelated to Phase 8's own code)

Found while investigating why `main`'s GitHub Actions run was red: it had been failing
**since before this session started** (confirmed on the commit immediately prior,
`676293a`) — not something Phase 8 introduced. Two distinct problems, both fixed in commit
`bebb653`:
1. **Real, deterministic bug** (100% reproducible on webkit + mobile-safari, every run):
   `auth.spec.js`'s account-deletion test asserted a cleared cookie is *absent* from Playwright's
   `cookies()` snapshot; on WebKit it can still appear with an empty `value` instead. The sibling
   `logout` test already had the correct fix (check value emptiness, not presence) — account
   deletion's test just never got the same treatment. Applied the same pattern to both `cc_at`
   and `cc_rt`.
2. **CI-only resource contention** (firefox `page.reload()` timeouts, one mobile-chrome
   double-click race) — `ubuntu-latest`'s 2-core runner under 2 Playwright workers × 5 browser
   engines, same category already documented as ADR-014. Reduced CI workers 2→1 and raised the
   per-test timeout 30s→60s (`playwright.config.js`, CI-only — local is unaffected).

Verified via `gh run view` on the actual failed runs before touching anything (not guessed) —
GitHub Actions run for `bebb653` completed successfully in 10m56s.

### Completed phases
1. Backend architecture cleanup
2. Secure authentication (HttpOnly cookies + refresh tokens)
3. Database optimization & indexing
4. Security hardening
5. Dependency maintenance
6. Testing infrastructure (Vitest/supertest/mongodb-memory-server + Playwright e2e/a11y/visual/
   performance, all wired into CI except visual regression — see below)
7. CI/CD (GitHub Actions)

### Phase 8 — in progress
- **8.1 done**: `react-router-dom` routing, `AppShell`/`Sidebar`/`MobileNav`/`Header` responsive
  navigation shell, theme system + design tokens, self-hosted fonts, command palette. Old
  `AuthScreen`/`Dashboard`/`UploadScreen` unchanged, just mounted at real routes instead of
  `App.jsx`'s old conditionals — see ROADMAP.md's "Phase 8.1 completion note" for the full list
  and the bug found/fixed (ADR-022). A same-session hotfix (`bd9241c`) then added
  `/forgot-password`/`/reset-password` as real routes plus a custom 404 page — Phase 8.1 had
  missed them, silently breaking real password-reset email links (ADR-023).
- **8.2 done** (this session): a real marketing Landing page at `/`
  (`src/pages/LandingPage.jsx` + `src/features/landing/`), plus `/login`/`/signup` as real routes
  (thin wrappers around the same, unchanged `AuthScreen`) since Landing claiming "/" required it.
  Four real bugs found and fixed along the way — stale "/" assumptions across 4 test files, an
  a11y-scan/render race, an app-wide `color-contrast` token bug (ADR-024), and a heading-order
  bug in `FeatureGrid.jsx` — see ROADMAP.md's "Phase 8.2 completion note" for full detail. Landing
  is the only page in the app whose a11y test runs with a genuinely empty violation allowlist.
- **8.3 done** (this session): `AuthScreen.jsx`'s actual visual restyle onto design-system
  primitives — the migration plan's own "Phase 2 — Authentication". Built
  `src/features/auth/components/{AuthShell,LoginForm,SignupForm,OtpScreen,ForgotPasswordForm,
  ResetPasswordForm}.jsx` plus `hooks/{useCredentialsForm,useRecaptcha}.js` (the shared
  login/signup submit logic and reCAPTCHA-v3 loader, factored out since the two forms are ~80%
  identical field/error/otp-branch logic); three new `components/ui/*` primitives (`Field`,
  `OtpInput` — the six-box auto-advance/paste/backspace pattern `AuthScreen.jsx` had implemented
  twice, now one component — and `Spinner`, wired into `Button`'s own `loading` state).
  `pages/{Login,Signup,ForgotPassword,ResetPassword}Page.jsx` are now thin compositions over
  these instead of one shared `AuthScreen` with an `initialMode` prop; `/reset-password` reads
  `?token=` via `useSearchParams()` at the page level instead of `AuthScreen.jsx`'s old manual
  `window.location.search` sniff. `AuthScreen.jsx` (931 lines) and `PublicHomePage.jsx` (the
  forgot/reset reuse shim from ADR-023) are both deleted — nothing imports either anymore
  (verified by grep). Every field/button kept its existing accessible name, so `auth.spec.js`'s
  role/placeholder-based selectors needed no structural changes; the one real selector update was
  "Forgot password?" moving from a `button` role (toggled internal `AuthScreen` state) to a real
  `link` role (`/forgot-password`, bookmarkable/refreshable) — a deliberate improvement per the
  migration plan, not a regression, and `auth.spec.js` was updated to match. Visual baselines
  (`auth-sign-in`/`auth-create-account`, chromium-only per ADR-020) regenerated for the new
  markup.

  Verification gate, run in full: `npm run lint` (0 errors, 44 pre-existing warnings — same count
  as 8.1/8.2, nothing new), `npm test` (88/88, unchanged — this phase touched no `api/**` code),
  `npx playwright test` (199 passed / 16 skipped [visual regression except chromium, by design] /
  0 failed across all 5 browser projects), `npm run build` (succeeds). No bugs found this phase —
  the restyle preserved behavior exactly as designed, verified rather than assumed.

- **8.4 done** (this session): the Dashboard's Overview tab (hero, stat cards, recurring
  payments, recent transactions — App.jsx's old 1721–1743/1832–1926 range per
  `phase-8-component-architecture.md`'s mapping table) restyled onto design-system primitives.
  Three new `components/ui/*` primitives: `Card` (the single most duplicated pre-Phase-8 pattern,
  ~20+ hand-typed call sites), `EmptyState` (icon/headline/body/optional action, replacing one-off
  plain sentences like "No recurring payments detected"), and `StatCard` (same left-accent-bar/
  label/value/sub shape as the original, but a real `<button>` when `onClick` is passed instead of
  a `<div onClick>` with no keyboard path at all — a genuine a11y improvement, not just a
  restyle). Two new `features/dashboard/components/*`: `OverviewHeader.jsx` (hero + stat row) and
  `RecentActivity.jsx` (recurring payments + recent transactions, two-panel layout).

  **Scope decision, flagged to the user before writing code, not guessed**: the migration plan
  only migrates Overview in this phase; Categories/Savings/Transactions/Upload don't get their
  own routes until Phases 8.6–8.9. Naively replacing what `DashboardPage` renders would have made
  those tabs unreachable in the interim — asked the user how to handle it (`AskUserQuestion`), who
  chose full feature parity: the legacy `Dashboard` component (`App.jsx`) is untouched except that
  its Overview tab's JSX now delegates to the two new components above, passing the exact same
  already-computed props (`totalIncome`, `recurring`, etc.) it always computed. The tab bar,
  Categories tab, Savings tab, Transactions view, header (download/delete-account/sign-out/new-
  upload), and the no-data `UploadScreen` gate are all byte-identical to before this phase — zero
  regression risk by construction, not just by testing. `pages/DashboardPage.jsx` itself is
  unchanged (still delegates to `LegacyWorkspace`); the "new DashboardPage" work the migration
  plan describes is the Overview content it now hosts, not a route-level rewrite — that full
  extraction happens naturally as each of Categories/Savings/Transactions/Upload gets its own real
  route in 8.6–8.9 and the legacy tab bar shrinks accordingly.

  Verification gate, run in full: `npm run lint` (0 errors, 44 pre-existing warnings, unchanged),
  `npm test` (88/88, unchanged — no `api/**` code touched), `npx playwright test` (199 passed / 16
  skipped [visual regression except chromium, by design] / 0 failed across all 5 browser
  projects, including the "dashboard (with data loaded)" a11y scan and the dashboard-load
  performance test — both exercise the new components directly and introduced no new violations
  beyond the existing tracked allowlist), `npm run build` (succeeds). No bugs found. Not
  independently verified in a live browser this session (no browser-automation tool was available
  this session) — the Playwright suite's real, headless-browser rendering across 5 engines is the
  verification basis instead, not just unit/lint/build.

- **8.5 done** (this session): `pages/UploadPage.jsx` + `features/upload/` at a real, always-
  reachable `/upload` route (added to `Sidebar`/`MobileNav` via `navigation.js`'s `NAV_ITEMS`,
  matching `phase-8-component-architecture.md`'s stated end state: "`/upload` becomes a normal,
  always-reachable route... not a gate"). New `DropZone.jsx` is a real `<button>` (Tab-focusable,
  Enter/Space opens the file picker natively) replacing the legacy `UploadScreen`'s `<div onClick>`
  drop target — the one real behavior fix this phase makes, verified via an actual filechooser-
  driven keyboard test, not just `setInputFiles`. `PreviousUploads.jsx` restyles the real file-
  history list onto `Card`/`EmptyState` (the fake "Recent transactions" panel is dropped per the
  migration plan — it was never real data). `useFileUpload.js` ports the legacy CSV/PDF parsing
  logic via named exports from `App.jsx` (`detectColumns`/`parseAmount`/`parseDate`/`parsePDF`) —
  the full `utils/csv.js`/`utils/pdf/*` extraction the target architecture describes is explicitly
  Phase 10 (final cleanup) scope, not this phase's.

  **Additive, not a replacement**: per Phase 8.4's ADR-025, the legacy `UploadScreen`-as-gate is
  untouched — `/upload` is a second, independent entry point. "Try with sample data" is
  deliberately not offered on the new page (sample data is never persisted, so this page has no
  way to hand it to `/dashboard` without restructuring `LegacyWorkspace`, out of scope); Previous
  Uploads here is view+delete only, not click-to-reactivate (same reasoning — see
  `PreviousUploads.jsx`'s docblock). Both are still fully available on the unchanged legacy gate.

  **Found and fixed a real, pre-existing production bug, not a Phase 8.5 regression** — see
  ROADMAP.md's ADR-026 for full detail. Summary: every real (non-sample) upload has silently
  failed to persist since this validation rule was introduced (predates this entire session), due
  to `Date.toISOString()` vs. the backend's bare-`YYYY-MM-DD` requirement, compounded by the save
  request's failure being silently swallowed. Verified via a harness-independent `curl`
  reproduction against the real API handler before concluding it was a real bug, not a test/harness
  artifact (a healthy server was confirmed running throughout). Fixed via a new `toDateOnlyString`
  helper (timezone-safe — uses local getters, not UTC, matching how every other consumer of these
  `Date` objects already reads them) applied to both the legacy path and the new page, plus real
  error surfacing on the previously-silent legacy save. New regression test specifically proves
  persistence (upload → reload → data still there), the exact gap that let this go undetected.

  **Also found and fixed a real, evidenced test-timing bug** in `auth.spec.js`'s pre-existing
  forgot-password test (not introduced this phase, but investigated and fixed here): `LoginForm`
  and `ForgotPasswordForm` share the identical `"you@example.com"` placeholder, and the test
  clicked a client-side-routed `<Link>` then immediately called `.fill()` on that placeholder with
  no wait for the new route to actually mount — under CPU contention, `.fill()` could grab the
  about-to-unmount `LoginForm`'s field instead of the new page's, submitting an empty field a
  moment later. Root-caused via 5x isolated repro (100% clean) vs. reproducible-under-full-suite-
  load failure, confirming it was contention-dependent timing, not test logic — fixed with a
  deterministic wait for content unique to the new page before filling, not a timeout increase.

  Verification gate: `npm run lint` (0 errors, 44 warnings, unchanged), `npm test` (88/88), full
  `npx playwright test` — genuinely noisy locally this phase (see below), stabilized to the
  expected 231 passed / 16 skipped / 0 failed after both fixes above, `npm run build` (succeeds).
  One visual baseline regenerated (`app-shell-empty`, chromium-only) — expected, since `Sidebar`/
  `MobileNav` now render an additional "Upload" nav item.

  **A note on this phase's noisy local verification, for the next session**: several *additional*
  test failures appeared across repeated full-suite runs this phase (a11y create-account timing,
  reload-heavy timeouts, several mobile-chrome timing failures) that did **not** reproduce
  consistently and were **not** caused by this phase's code — traced to two runaway, unrelated VS
  Code helper processes (a Docker/Dockerfile language server) consuming >500% combined CPU
  continuously on this specific machine (confirmed via `ps`/`top`/`uptime`, load average 13–20 on
  a 10-core machine). Not something this session fixed or should fix (outside this task's scope,
  not this codebase's problem) — noted here so a future local run's noise isn't mistaken for a
  regression. CI (GitHub Actions' dedicated runners) is unaffected and is this phase's real gate;
  see its status below.

- **8.6 done** (this session): `pages/TransactionsPage.jsx` + `features/transactions/` at a real,
  bookmarkable `/transactions` route (added to `Sidebar`/`MobileNav`), replacing the pre-Phase-8
  "only reachable via a stat-card click, lost on refresh" pattern. New `components/ui/Table.jsx`
  (real `<table>`/`<thead>`/`<tbody>`, closing the ADR-019-tracked `role="table"` gap) and
  `hooks/useDebounce.js`. Search/category/date-range filters and sort all live in the URL
  (`useSearchParams`), so a filtered/sorted view is a real, shareable link and survives a refresh
  — the migration plan's own stated goal for this phase.

  **Two scope decisions, evidence-based, not guessed**: (1) filtering/sorting is client-side, not
  the `api/data.js` query-param round trip the migration plan's "backend note" suggested — the
  whole active file's transactions are already fetched in full today (≤10,000/file, already in
  memory), so server-side search would be real backend surface with no functional need yet, the
  same reasoning `ROADMAP.md`'s Phase 4 tech debt note already applied to pagination. (2) the new
  page is read-only — no reassign-category action — matching the migration plan's own stated
  Phase 6 scope exactly (reassignment isn't listed in it) and avoiding a real state-consistency
  risk: the legacy `Dashboard`'s per-transaction overrides are local component state, never
  persisted server-side, so duplicating that state on a second, independent page could let a
  reassignment silently diverge between the two. The existing reassign flow stays on the legacy
  `Dashboard`, fully functional, unchanged.

  **Found and fixed a genuine test-timing bug**, not an application bug: a new test asserted on
  filtered-table row count immediately after `selectOption()`, which only waits for the `<select>`
  element's own change event, not React's resulting re-render — capturing a stale count. Fixed
  with a real, auto-retrying wait (`expect(rows).not.toHaveCount(...)`) before reading the settled
  count, not a timeout increase.

  **Verification gate**: `npm run lint` (0 errors, 44 warnings, unchanged), `npm test` (88/88,
  unchanged — this phase touched no `api/**` code, by design, per scope decision (1) above), `npx
  playwright test` — 278 passed / 16 skipped / 0 failed after the fix above (9 new tests in
  `tests/e2e/transactions.spec.js`), `npm run build` (succeeds). One visual baseline regenerated
  (`app-shell-empty`, chromium-only) — expected, another new nav item. Local runs this phase again
  showed occasional firefox `page.reload()` timeouts — same external, already-diagnosed cause as
  Phase 8.5 (the runaway VS Code helper processes, reconfirmed still active via `ps`/`uptime`);
  5/5 clean on isolated repro each time. CI is the real gate; see its status below.

- **8.7–8.9 not started**: Analytics → Categories/Merchant Rules → Settings/Savings → remaining
  cleanup, per `docs/frontend/phase-8-migration-plan.md` and the user's requested order. One page
  per phase, full verification gate (lint/test/e2e/build) green before moving to the next — see
  that file's "keep the existing suite passing" section for the exact discipline.

### Remaining phases
9. Advanced AI features & product enhancements — not started

## Phase 6 (Testing infrastructure) — what was completed this session

This session picked up mid-flight: `playwright.config.js`, `tests/e2e/` (homepage/auth/
auth-resilience specs, page objects, fixtures), and a draft `docs/engineering-lessons/
phase-6-testing.md` already existed in the working tree, uncommitted, from earlier work not yet
reflected in `ROADMAP.md`/`CHECKPOINT.md`. This session's first job was a **verification
checkpoint**, not new work: run the existing suite for real before trusting or building on it.
That surfaced a real, blocking problem immediately — see below — before any of the newer Phase
6 work (a11y, visual, performance, coverage) started.

1. **Fixed a Vitest/Playwright collision** (`vitest.config.js`): Vitest's default test-file glob
   had no exclusion for `tests/e2e/`, so it was importing Playwright's own spec files and
   crashing trying to run `test.describe()` outside the Playwright runner — `npm test` exited 1
   even though all 84 real Vitest tests and all 24 real Playwright (chromium) tests separately
   passed. Fixed by extending Vitest's own `configDefaults.exclude` with `tests/e2e/**`.

2. **Found and fixed three more real, deterministic bugs while running the full 5-browser
   Playwright suite** (chromium/firefox/webkit/mobile-chrome/mobile-safari) — none hypothetical,
   all reproduced 100% of the time once isolated:
   - **WebKit/mobile-safari were failing almost entirely** (39/120) with a blank page. Root
     cause: `api/_lib/security-headers.js`'s Helmet config sent `Strict-Transport-Security` and
     a CSP with `upgrade-insecure-requests` unconditionally, even over the plain-HTTP local
     dev/e2e server. WebKit honored the upgrade for the app's own `<script type="module">`
     bundle and the request died with a TLS error — this would affect real Safari users on local
     dev too, not just tests. Fixed: HSTS now gated on `req.secure`/`x-forwarded-proto`;
     `upgrade-insecure-requests` dropped entirely (restores exact CSP parity with `vercel.json`,
     which never had it — a real dev/prod header drift, not just a test artifact).
   - **JWT access-token rotation collision**: `api/_lib/jwt.js` signed tokens with only
     `{userId, email, name}` and `jsonwebtoken`'s one-second-resolution `iat` — a refresh
     completing within the same wall-clock second as the token it replaced produced a
     byte-identical "new" token. WebKit's faster round-trip in this harness hit it
     deterministically; fixed with a random `jti` claim.
   - **`authenticatedPage` fixture race** (`tests/e2e/fixtures/index.mjs`): the fixture returned
     control right after `page.goto("/")`, before `App.jsx`'s own mount-time session check had
     resolved. On the `mobile-chrome` device profile specifically, a test that went offline
     immediately raced that in-flight check, and the app's own offline fail-safe (added earlier
     this session, `.catch(() => {})` in `App.jsx`'s auth-check effect) correctly-but-unluckily
     rendered a perfectly valid session as logged out. Fixed by waiting for a
     definitively-authenticated element before the fixture hands back control.
   - One additional failure (a double-click login test, `mobile-chrome`) turned out to be
     ordinary resource contention from running all 5 browser engines in parallel on one
     machine — 5/5 clean in isolation with `--workers=1`, same category as ADR-014. Not a bug,
     not touched.

3. **Found and fixed a fourth real bug while scoping remaining auth e2e coverage** (not a
   cross-browser issue — found by reading the code): `ForgotPasswordScreen`
   (`src/AuthScreen.jsx`) called `apiFetch` and unconditionally showed "check your email" without
   ever checking `res.ok` — so a real failure (rate-limited, or the email service not being
   configured, which this test environment deliberately runs without) was silently reported as
   success. Its sibling `ResetPasswordScreen` already handled this correctly; fixed
   `ForgotPasswordScreen` to match, added a regression test.

4. **Closed remaining authentication e2e coverage**: added tests for the forgot-password error
   path (above) and full account-deletion flow (delete → session cleared → same email is
   signup-able again, proving the row itself is gone, not just the session). Audited every route
   in `api/auth.js` against existing coverage; `logoutAllDevices()` has no UI caller anywhere in
   the frontend (noted as tracked debt, not built speculatively ahead of a real caller).

5. **Accessibility testing** (`axe-playwright`, `tests/e2e/a11y.spec.js`): real scans on 4 page
   states (sign-in, create-account, authenticated shell, dashboard with data). Found real,
   expected violations (`color-contrast`, `landmark-one-main`, `page-has-heading-one`, `region`,
   plus `svg-img-alt`/`scrollable-region-focusable` from Recharts on the dashboard) — none
   critical. Gate: any `critical`-impact violation fails outright; everything else is checked
   against a tracked per-page allowlist, so a *new* violation still fails the test without
   demanding Phase 8's full redesign land inside Phase 6. See ADR-019.

6. **Visual regression** (`tests/e2e/visual.spec.js`): chromium-only snapshots of the 3
   structurally stable screens (sign-in, create-account, authenticated shell before data loads) —
   deliberately never transaction lists/dashboard numbers/the animated pie chart. Chromium-only
   because cross-engine font rendering would fail every comparison on rendering noise, not real
   change. See ADR-020.

7. **Performance smoke tests** (`tests/e2e/performance.spec.js`): homepage/dashboard load time
   and 4 core API endpoints, generous thresholds (5s page, 2s API) — this is "did it catch fire,"
   not a tight performance budget.

8. **Coverage improvements**: added 4 real Vitest tests for previously-untested, real security
   logic in `api/auth.js` — the login rate-limiter, account lockout after `MAX_FAILED` (5) wrong
   passwords, and the nonexistent-account path. `api/auth.js` coverage: 29.65%→31.75% statements,
   29.92%→33.46% branches. The much larger remaining gap (OTP/email-verification branches) is
   structurally unreachable in either test suite by design (`GMAIL_USER`/`GMAIL_APP_PASSWORD`
   deleted in `tests/vitest.setup.js`, same "disable, don't mock" pattern used throughout) — not
   chased further. Added `vitest.config.js` coverage thresholds (a floor just under today's real
   numbers: 50/42/70/52 stmts/branch/funcs/lines) as the "coverage target" `ROADMAP.md` had
   tracked as open. See ADR-021.

9. **Wired Playwright into CI** (`.github/workflows/ci.yml`): installs browsers
   (`--with-deps`), runs `npx playwright test --grep-invert "visual regression"` after
   `test:coverage` and before `npm run build`, uploads the HTML report as an artifact. Visual
   regression is deliberately excluded — its macOS-generated baselines would fail every
   comparison against the Linux CI runner on font rendering alone, not a real regression. See
   ADR-020; this is an honest, documented gap (matching ADR-018's precedent), not silently
   skipped.

10. **Documentation reconciliation**: `ROADMAP.md` (progress table, Phase 6 completion note,
    re-prioritization note, ADR-019/020/021, tech debt section), this file, and
    `docs/engineering-lessons/phase-6-testing.md` (fixed several passages that described
    a11y/visual/performance work in the present/future tense as if aspirational — they now
    describe what was actually built and found, with real numbers).

## Test suite

`npm test` — **88/88 passing** (unchanged this session — Phase 8 touched no `api/**` code).
`npx playwright test` (all 5 browser projects) — **278 passed, 0 failed, 16 skipped** (visual
regression except chromium, by design — see ADR-020; two new spec files, `upload.spec.js` and
`transactions.spec.js`, 16 new tests combined). `npm run lint` — 0 errors, **44** pre-existing
warnings (down from 46: deleting `AuthScreen.jsx` removed its own 2 unescaped-entity warnings
along with the file). `npm run build` — succeeds. GitHub Actions CI on `main` — green (confirmed
via `gh run view`, not assumed; see each phase's commit for its own run); the separate
"Deployment Verification" check has been failing since 2026-07-14 on a per-deployment preview URL
requiring Vercel SSO (pre-existing, unrelated to any frontend work, tracked below).

Real regressions found and fixed this session, all before commit, none left for a future session
to discover: Phase 8.1's nav shell introduced 2 accessibility violations (ADR-022); a router gap
broke password-reset links (ADR-023); Phase 8.2's Landing page introduced a color-contrast token
bug (ADR-024) and a heading-order bug; CI itself had a pre-existing (not Phase-8-caused) webkit
test bug plus resource-contention flakiness, both fixed in `bebb653`. Phases 8.3 and 8.4
introduced no new bugs. Phase 8.5 found the session's most serious defect — a real, pre-existing
production data-loss bug in real (non-sample) statement uploads, present since before this session
started, plus a genuine test-timing bug in an existing forgot-password test — both root-caused via
actual evidence (a harness-independent `curl` reproduction for the former, 5x isolated-vs-
full-suite repro for the latter) and fixed, not just patched around. See ADR-026 and the Phase 8.5
completion note for full detail.

## Deployment status (carried forward, unchanged this session)

No new deployment happened this session — Phase 6 is test infrastructure only, no runtime
application behavior changed except the four bug fixes listed above (all of which are real fixes
to shipped code paths: `src/AuthScreen.jsx`, `api/_lib/security-headers.js`, `api/_lib/jwt.js`).
Those three application-code fixes **will** reach production on the next deploy once this
session's commits are pushed, and are worth a quick manual smoke check afterward given they
touch security headers and token issuance directly, even though the local Playwright/Vitest
suites already re-verified all of them post-fix.

- **Production URL**: https://cash-canvas-sigma.vercel.app
- **Commit deployed (last verified)**: `08ece44` (see prior checkpoint history for full detail,
  not duplicated here)
- **Serverless Functions verified**: exactly 3 (`api/ai`, `api/auth`, `api/data`) as of the last
  verified deployment

## Current production readiness estimate

**~83%.** Up from ~82%, but the honest story is more nuanced than a number: Phase 8.5 found and
fixed a real, previously-undetected **data-loss bug in already-shipped, currently-in-production
code** (ADR-026) — real statement uploads have never actually persisted since this validation
rule existed, only rendering correctly for the remainder of the session that uploaded them. This
is exactly the kind of gap Phase 6/8's real-browser, real-persistence testing exists to catch, and
finding + fixing it is a genuine readiness improvement — but it's also a reminder that "looks
correct in the UI" and "actually works" are different claims, and this bug shipped for some
number of prior phases/sessions before anything caught it. Auth/session/security/data-integrity
remain production-grade with real browser-level regression coverage across 5 browser engines,
plus accessibility and visual regression baselines. Remaining gaps: the same ones Phase 7 already
named (`VERCEL_TOKEN` secret, branch protection); visual regression not yet running in CI (Linux
baseline gap, ADR-020); product-facing polish (a11y fixes themselves, dark mode) — Phase 8 scope,
tracked via `tests/e2e/a11y.spec.js`'s allowlist; and the upload-persistence fix itself hasn't yet
reached production (see "Blockers/assumptions" below) — real users are still affected until the
next deploy.

## Remaining technical debt

Full list with rationale lives in `ROADMAP.md`'s "Known technical debt" section — not duplicated
here to avoid drift. New this session: `Header.jsx`'s topbar is `role="region"`, not a real
`<header>`, until the last old-header page (`UploadScreen`/`Dashboard`) is migrated away in Phase
8.5+ (ADR-022); Material Symbols Outlined icon font stays CDN-hosted, not self-hosted like the
new typefaces, until every old screen using it migrates off (tracked to close alongside Phase
8.8) — the legacy `Dashboard`'s Categories/Savings/Transactions tabs and header still use it;
only the new Overview components use `lucide-react`. `AuthScreen.jsx` is fully retired as of
Phase 8.3 — no remaining debt there. The legacy `Dashboard` component (`App.jsx`) still owns
Categories/Savings/Transactions/the tab bar/the header — Phase 8.4 deliberately left these
untouched (see the 8.4 completion note above); each shrinks the legacy component further as its
own phase (8.6–8.9) lands, until `Dashboard`/`App.jsx`'s `LegacyWorkspace` can be deleted entirely
in Phase 10 per the migration plan. Carried forward, unchanged: visual regression doesn't run in
CI yet (ADR-020); the a11y allowlist in
`tests/e2e/a11y.spec.js` is real, current, Phase-8-scoped debt for every page except Landing now
(ADR-019); `api/auth.js`'s OTP/email-verification branches remain untestable without real Gmail
SMTP credentials (ADR-021); `logoutAllDevices()` has no UI caller; `deploy-verify.yml` needs its
`VERCEL_TOKEN` secret; branch protection recommendations are unapplied; ~45 pre-existing ESLint
warnings remain (44, down from 46 — see "Test suite" above).

## Next recommended step

**Phase 8.7: Analytics** — `pages/AnalyticsPage.jsx` + `features/analytics/`, splitting the
Recharts donut/monthly-bar/cash-flow-line block out of the legacy `Dashboard`'s Overview tab
(untouched by Phase 8.4, which only migrated the hero/stats/recurring/recent-activity content
around it — see ADR-025) onto the standardized Chart system, per `docs/frontend/
phase-8-migration-plan.md`'s Phase 7: reconciled palette, real `aria-label`s, keyboard-reachable
tooltips. New test: chart keyboard navigation (Tab to a data point, tooltip on focus — charts are
mouse-only today). The `tests/e2e/a11y.spec.js` "dashboard (with data loaded)" scan's two
chart-specific allowlist entries (`svg-img-alt`, `scrollable-region-focusable`) should move to
scan `/analytics` instead once this lands, same allowlist-based approach (ADR-019), revalidated
against the rebuilt markup — flag explicitly if a new violation appears rather than widening the
allowlist to make it pass. Then Phase 8.8, Categories + Merchant Rules (deferred out of this
session's Phase 8.6, which scoped down to Transactions only). Same discipline as 8.1–8.6: full
verification gate green before moving on, any bug found gets root-caused and fixed (with a
regression test) before continuing, not deferred — and per Phase 8.5/8.6's own lesson, prefer a
real reproduction (curl/direct API call, isolated-vs-full-suite repro) over inferring root cause
from a single test failure.

## Blockers / assumptions

- None blocking Phase 8 itself — the verification gate is green (see "Test suite" above).
- `deploy-verify.yml`'s function-count check is still unverified by an actual GitHub Actions run
  — needs `VERCEL_TOKEN` added as a repo secret first. Carried forward, unchanged.
- `nodemailer` major-version upgrade (Phase 4/5, ADR-013) still hasn't been verified via a live
  send through real Gmail SMTP — the same missing credentials also block real test coverage of
  `api/auth.js`'s OTP/email branches (ADR-021). Carried forward, now doubly relevant.
- Full authenticated production round-trip (signup → login → upload → categorize) still hasn't
  been verified end-to-end by a real user since deployment — reCAPTCHA correctly prevents
  automated verification of this specific path. Carried forward from prior sessions.
- The three application-code bug fixes from an earlier session (WebKit/HSTS headers, JWT `jti`,
  `ForgotPasswordScreen`) haven't been separately re-verified against the live production
  deployment yet — worth a quick manual check after the next deploy, per "Deployment status"
  above.
- **Phase 8.5's upload-persistence fix (ADR-026) is real user-impacting and not yet in
  production** — until the next deploy, real (non-sample) statement uploads on
  cash-canvas-sigma.vercel.app continue to silently fail to persist, exactly as they have since
  this validation rule existed. Worth prioritizing this deploy over waiting for more Phase 8
  phases to batch up, and worth a manual smoke check (upload a real file, reload, confirm it's
  still there) against production specifically once deployed, not just the e2e suite's coverage
  of it.
