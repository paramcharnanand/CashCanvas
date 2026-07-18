# Checkpoint

Session handoff doc — read this first, then `ROADMAP.md` for full phase history/ADRs/tech
debt. Update this file at the end of every session so the next one can start here instead of
re-deriving context from the repo.

## Release status

**Phase 8.1 through 8.4 verified and committed this session**, plus two CI hotfixes along the
way (see `git log` — `5d42cf8` Phase 8.1, `bd9241c` router hotfix, `bebb653` CI stability hotfix,
the Phase 8.2 commit, the Phase 8.3 commit, and the Phase 8.4 commit). GitHub Actions CI is green
on `main` as of the CI stability hotfix — it was red (webkit-only, deterministic) since before
this session started; see "CI stability" below. Phase 6 (Testing infrastructure, six logical
commits) and Phase 7 (CI/CD, `64a1280`) were the last things pushed before this session.

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

**7 of 9 phases complete (78%); Phase 8 in progress (8.1–8.4 of ~8.9 sub-steps done).** Phases 1–5
and 7 verified/landed in prior sessions; Phase 6 (testing infrastructure) completed two sessions
ago; Phase 8.1 through 8.4 completed this session. Full writeup: `docs/engineering-lessons/
phase-6-testing.md` (testing concepts), `docs/frontend/phase-8-*.md` (design system, component
architecture, migration plan), `ROADMAP.md` ADR-019 through ADR-024. Full phase/ADR history:
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

- **8.5–8.9 not started**: Upload → Transactions → Analytics → Categories/Merchant Rules →
  Settings/Savings → remaining cleanup, per `docs/frontend/phase-8-migration-plan.md` and the
  user's requested order. One page per phase, full verification gate (lint/test/e2e/build) green
  before moving to the next — see that file's "keep the existing suite passing" section for the
  exact discipline.

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
`npx playwright test` (all 5 browser projects) — **199 passed, 0 failed, 16 skipped** (visual
regression except chromium, by design — see ADR-020). `npm run lint` — 0 errors, **44**
pre-existing warnings (down from 46: deleting `AuthScreen.jsx` removed its own 2 unescaped-entity
warnings along with the file, nothing newly suppressed). `npm run build` — succeeds. GitHub
Actions CI on `main` — green as of `07d918d` (confirmed via `gh run view`, not assumed); the
separate "Deployment Verification" check has been failing since 2026-07-14 on a per-deployment
preview URL requiring Vercel SSO (pre-existing, unrelated to any frontend work, tracked below).

Real regressions found and fixed in prior phases this session, all before commit, none left for a
future session to discover: Phase 8.1's nav shell introduced 2 accessibility violations
(ADR-022); a router gap broke password-reset links (ADR-023); Phase 8.2's Landing page introduced
a color-contrast token bug (ADR-024) and a heading-order bug; CI itself had a pre-existing (not
Phase-8-caused) webkit test bug plus resource-contention flakiness, both fixed in `bebb653`.
Phases 8.3 and 8.4 both introduced no new bugs — full gate green on first run in both cases. Full
detail in ROADMAP.md's "Phase 8.1/8.2/8.3/8.4 completion note"s and the CI stability section
above.

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

**~82%** (up from ~78% after Phase 7). Auth/session/security/data-integrity remain
production-grade and now have real browser-level (not just API-level) regression coverage across
5 browser engines, plus accessibility and visual regression baselines. The three application bugs
this phase found (WebKit/HSTS, JWT rotation collision, `ForgotPasswordScreen`'s silent failure)
were real correctness/security gaps in already-shipped code, now fixed and covered — exactly the
kind of thing Phase 6 was chartered to find. Remaining gaps are the same ones Phase 7 already
named (`VERCEL_TOKEN` secret, branch protection) plus Phase 6's own honest leftovers: visual
regression not yet running in CI (Linux baseline gap, ADR-020), and product-facing polish
(a11y fixes themselves, dark mode) — Phase 8 scope, now measurably tracked via
`tests/e2e/a11y.spec.js`'s allowlist instead of just a general note.

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

**Phase 8.5: Upload workflow** — `pages/UploadPage.jsx` + `features/upload/` at its own real
`/upload` route (no longer only a pre-Dashboard gate), per
`docs/frontend/phase-8-migration-plan.md`'s Phase 5. `DropZone` gets real keyboard/focus support
(a `<button>`-based drop target — the legacy `UploadScreen`'s drop zone has none today) and the
hardcoded fake "Recent transactions" preview panel is dropped (it was never real data). Per this
session's Phase 8.4 scope decision, the legacy `UploadScreen`-as-gate (no-data state) stays
exactly as it is for now — this phase gives Upload an *additional* real route/entry point
alongside the existing gate, it doesn't yet replace the gate itself (that full cutover, and the
associated `auth.spec.js`/`auth-resilience.spec.js` "try with sample data" test updates the
migration plan originally scoped to Phase 4, are now deferred to whichever later phase actually
removes the gate — flag this explicitly if/when that happens, don't silently assume it's already
covered). Same discipline as 8.1–8.4: full verification gate green before moving to 8.6
(Transactions), any bug found gets root-caused and fixed (with a regression test) before
continuing, not deferred.

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
- The three application-code bug fixes from this session (WebKit/HSTS headers, JWT `jti`,
  `ForgotPasswordScreen`) haven't been separately re-verified against the live production
  deployment yet — worth a quick manual check after the next deploy, per "Deployment status"
  above.
