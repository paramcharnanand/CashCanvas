# Checkpoint

Session handoff doc — read this first, then `ROADMAP.md` for full phase history/ADRs/tech
debt. Update this file at the end of every session so the next one can start here instead of
re-deriving context from the repo.

## Release status

**Phase 8.1 (routing, navigation shell, design foundation) verified and committed this session**
(see `git log` for the exact hash — commit message
"feat(frontend): implement routing, navigation shell and design foundation"). Phase 6 (Testing
infrastructure, six logical commits) and Phase 7 (CI/CD, `64a1280`) were the last things pushed
before this session.

## Current status

**7 of 9 phases complete (78%); Phase 8 in progress (8.1 of ~8.9 sub-steps done).** Phases 1–5 and
7 verified/landed in prior sessions; Phase 6 (testing infrastructure) completed two sessions ago;
Phase 8.1 completed this session. Full writeup: `docs/engineering-lessons/phase-6-testing.md`
(testing concepts), `docs/frontend/phase-8-*.md` (design system, component architecture,
migration plan), `ROADMAP.md` ADR-019/020/021/022. Full phase/ADR history: `ROADMAP.md`.

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
- **8.1 done** (this session): `react-router-dom` routing (`/`, `/dashboard` real so far),
  `AppShell`/`Sidebar`/`MobileNav`/`Header` responsive navigation shell, theme system + design
  tokens, self-hosted fonts, command palette. Old `AuthScreen`/`Dashboard`/`UploadScreen` unchanged,
  just mounted at real routes instead of `App.jsx`'s old conditionals — see ROADMAP.md's
  "Phase 8.1 completion note" for the full list and the one bug found/fixed (ADR-022).
- **8.2–8.9 not started**: page-by-page migration (Landing → Auth → Dashboard → Upload →
  Transactions → Analytics → Settings → Profile → mobile layouts), per
  `docs/frontend/phase-8-migration-plan.md` and the user's requested order. One page per phase,
  full verification gate (lint/test/e2e/build) green before moving to the next — see that file's
  "keep the existing suite passing" section for the exact discipline.

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

`npm test` — **88/88 passing** (unchanged this session — Phase 8.1 touched no `api/**` code).
`npx playwright test` (all 5 browser projects) — **168 passed, 0 failed, 12 skipped** (visual
regression, excluded from this grep by design — see ADR-020; regenerated and reviewed separately
this session for the new shell/font rendering). `npm run lint` — 0 errors, 46 pre-existing
warnings, unchanged. `npm run build` — succeeds.

One real regression surfaced by this session's full-suite run and fixed before commit: the new
nav shell introduced two accessibility violations (`region`, `landmark-unique`) not present at
session start. Root cause, fix, and the reverted first-attempt fix (a real `<header>`, which
traded one violation for a worse one) are in ROADMAP.md's ADR-022 and "Phase 8.1 completion note".

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
8.4/8.5 (ADR-022); Material Symbols Outlined icon font stays CDN-hosted, not self-hosted like the
new typefaces, until every old screen using it migrates off (tracked to close alongside Phase 8.8).
Carried forward, unchanged: visual regression doesn't run in CI yet (ADR-020); the a11y allowlist
in `tests/e2e/a11y.spec.js` is real, current, Phase-8-scoped debt (ADR-019); `api/auth.js`'s
OTP/email-verification branches remain untestable without real Gmail SMTP credentials (ADR-021);
`logoutAllDevices()` has no UI caller; `deploy-verify.yml` needs its `VERCEL_TOKEN` secret; branch
protection recommendations are unapplied; ~45 pre-existing ESLint warnings remain (unchanged count
this session).

## Next recommended step

**Phase 8.2: migrate the Landing page next** (first in the user's requested page-by-page order:
Landing → Auth → Dashboard → Upload → Transactions → Analytics → Settings → Profile → mobile
layouts). `PublicHomePage.jsx` currently still renders the old `AuthScreen` unchanged at `/` —
Phase 8.2 replaces the unauthenticated `/` experience with a real landing page ahead of the login
form, per `docs/frontend/phase-8-migration-plan.md`'s Phase 1 ("Landing + Routing foundation" in
that doc's own numbering). Same discipline as 8.1: full verification gate green before moving to
8.3, any bug found gets root-caused and fixed (with a regression test) before continuing, not
deferred.

## Blockers / assumptions

- None blocking Phase 6 itself — the verification gate is green (see "Test suite" above).
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
