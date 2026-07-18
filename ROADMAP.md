# CashCanvas Engineering Roadmap

Living document, updated at the end of every phase. Tracks what's done, what's next, what
technical debt exists, and *why* past decisions were made — so re-prioritizing later doesn't
require re-deriving context that already existed once.

## Progress

**7 of 9 phases complete (78%); Phase 8 in progress (8.1–8.4 of ~8.9 sub-steps done).**

| # | Phase | Status | Docs |
|---|---|---|---|
| 1 | Backend architecture cleanup | ✅ Done | `docs/backend/authentication.md` |
| 2 | Secure authentication (HttpOnly cookies + refresh tokens) | ✅ Done | `docs/backend/authentication.md` |
| 3 | Database optimization & indexing | ✅ Done | `docs/backend/database.md` |
| 4 | Security hardening | ✅ Done | `docs/security/threat-model.md` |
| 5 | Dependency maintenance (`npm audit`, upgrades) | ✅ Done | `docs/security/threat-model.md` (Dependency posture) |
| 6 | Testing infrastructure | ✅ Done | `docs/engineering-lessons/phase-6-testing.md` |
| 7 | CI/CD (GitHub Actions) | ✅ Done | `docs/engineering-lessons/phase-7-ci-cd.md` |
| 8 | Frontend redesign (design system, routing, navigation shell, a11y) | 🟨 In progress (8.1–8.4 done) | `docs/frontend/phase-8-*.md` |
| 9 | Advanced AI features & product enhancements | ⬜ Not started | — |

### Phase 8.1 completion note (routing, navigation shell, design foundation)

Delivered, per `docs/frontend/phase-8-migration-plan.md`'s Phase 0/1/3 (this codebase's own
Phase 8.1 = that plan's foundation + routing + nav-shell steps, shipped as one commit rather than
three): `react-router-dom` (`src/router.jsx`, currently `/` and `/dashboard`, everything else
still to come per-page); `AppShell.jsx`/`Sidebar.jsx`/`MobileNav.jsx`/`Header.jsx` (responsive
shell — sidebar ≥`--bp-lg`, bottom nav below it); `ThemeContext`/design tokens
(`src/styles/tokens.css`, `globals.css`); self-hosted Newsreader/Manrope/Inter (one fewer external
font-CDN dependency; Material Symbols Outlined stays CDN-hosted until the last old screen using it
migrates); a command palette (⌘K) and keyboard-shortcuts system
(`src/features/command-palette/`). The old `AuthScreen`/`Dashboard`/`UploadScreen` are unchanged
and still render exactly as before — `PublicHomePage.jsx` and `DashboardPage.jsx` just mount them
at real routes instead of `App.jsx`'s old `useState`-driven conditionals. Visual baselines
regenerated for the new shell/font rendering.

Verification gate, run in full before commit: `npm run lint` (0 errors, 46 pre-existing warnings),
`npm test` (88/88), `npx playwright test` (168 passed / 12 skipped [visual regression, excluded
from this run by design, ADR-020] / 0 failed across all 5 browser projects), `npm run build`
(succeeds).

One real regression found and fixed by that gate, not present at the start of the session — see
ADR-022: the new nav shell introduced two accessibility violations
(`region` from `Header.jsx`'s unlabeled wrapper `<div>`; `landmark-unique` from `Sidebar.jsx`/
`MobileNav.jsx`'s unlabeled `<nav>` colliding with the legacy Dashboard's own unlabeled `<nav>`).
Fixed by labeling both new `<nav>` landmarks (`aria-label="Primary navigation"`) and giving
`Header.jsx`'s wrapper `role="region"` + a label instead of a real `<header>` (a real `<header>`
was tried first and reverted — it passed `region` but failed
`landmark-no-duplicate-banner` against the still-unmigrated pages' own `<header>` elements).
No new test file was added; `tests/e2e/a11y.spec.js`'s existing per-page allowlist already catches
this class of regression (that's its designed purpose per ADR-019) and wasn't itself changed.

### Phase 8.2 completion note (Landing page + real /login, /signup routes)

Delivered: a real marketing Landing page (`src/pages/LandingPage.jsx` +
`src/features/landing/components/{Hero,ProductPreview,FeatureGrid}.jsx`) at `/`, replacing
`AuthScreen.jsx` shown directly — the first genuinely new unauthenticated screen this project has
had (`docs/frontend/phase-8-audit.md` §13/14 flagged this exact gap). Landing claiming "/" meant
`/login` and `/signup` had to become real routes in this same phase, not a later one (per
`docs/frontend/phase-8-component-architecture.md`'s route table) — `src/pages/{Login,Signup}Page.jsx`
are thin wrappers around the same, unchanged `AuthScreen` (now accepting an additive `initialMode`
prop), and `ProtectedRoute.jsx` now redirects unauthenticated visitors to `/login?redirect=...`
instead of `/`. `/forgot-password`/`/reset-password` are unaffected — they kept reusing
`PublicHomePage.jsx`, which never rendered Landing content in the first place.

Verification gate, run in full and re-run after each fix below: `npm run lint` (0 errors, 46
pre-existing warnings), `npm test` (88/88), `npx playwright test` (199 passed / 16 skipped
[visual regression except chromium, by design] / 0 failed across all 5 browser projects),
`npm run build` (succeeds).

**Real bugs found and fixed along the way, all in code written this phase, none pre-existing:**
1. **Stale "/" assumption in four test files**: several tests (`auth.spec.js`'s two "protected
   routes" tests, `auth-resilience.spec.js`'s invalid-refresh-token test, `performance.spec.js`'s
   homepage-timing test, plus `homepage.spec.js`/`a11y.spec.js`/`visual.spec.js` directly) still
   asserted that visiting `/` shows the login form — true before this phase, no longer true now
   that Landing owns `/`. Fixed each to assert what it actually means to test: the "protected
   routes" tests now visit `/dashboard` (the real protected route) and assert the redirect to
   `/login`; the rest visit `/login`/`/signup` directly or assert Landing's own content.
2. **A11y-scan/render race**: `LandingPage`/`LoginPage`/`SignupPage` all gate on an async
   `authChecked` fetch before rendering real content, briefly showing `LoadingScreen`'s unlabeled
   `<div>Loading…</div>` — axe's scan could run while that was still on screen, flagging the
   transient loading state's own lack of a landmark (a `region` violation no real user ever
   perceives). Fixed by waiting for real content before scanning, matching the pattern
   `homepage.spec.js`'s own assertions already used.
3. **`color-contrast` token bug, app-wide, not Landing-specific** — see ADR-024. `--text-subtle`
   measured 4.46:1 against white/`--surface`, under WCAG AA's 4.5:1 for normal-size text, first
   surfaced by Landing's a11y test (which — unlike every other page's allowlist — carries zero
   tracked violations, so it was the first assertion strict enough to catch it). Fixed at the
   token source in `tokens.css` (light mode only; dark mode's separate value wasn't evidenced as
   broken and wasn't touched), computed via the WCAG relative-luminance formula directly rather
   than trial-and-error: new value measures 5.06:1.
4. **`heading-order` violation**: `FeatureGrid.jsx` used `<h3>` for its four card titles with no
   `<h2>` anywhere on the page, skipping a level right after Hero's `<h1>`. Fixed to `<h2>`.

Net result: `tests/e2e/a11y.spec.js`'s new "landing page" test runs with an **empty** allowlist —
the only page in the app with zero tracked accessibility violations, a genuinely higher bar than
the "known debt" allowlists every other page still carries (ADR-019).

Next: Phase 8.3, restyling `AuthScreen.jsx` onto `components/ui/*` design-system primitives
(replacing its inline styles — the actual visual rewrite, not just route plumbing), per
`docs/frontend/phase-8-migration-plan.md`'s Phase 2. Then Dashboard → Upload → Transactions →
Analytics → Settings → Profile → mobile layouts, each phase gated on the same full verification
run before moving to the next.

### Phase 8.4 completion note (Dashboard Overview restyle onto design-system primitives)

Delivered: the legacy `Dashboard` component's (`App.jsx`) Overview tab — hero, four stat cards,
recurring payments, recent transactions (the old 1721–1743/1832–1926 line range, per
`phase-8-component-architecture.md`'s mapping table) — restyled onto three new
`components/ui/*` primitives (`Card`, `EmptyState`, `StatCard`) and two new
`features/dashboard/components/*` (`OverviewHeader.jsx`, `RecentActivity.jsx`). The Recharts
donut/bar/line charts row between them (1744–1831) is untouched — that's Analytics, Phase 8.7,
not this phase.

**Scope deviation from the original migration plan, decided with the user before writing any
code (see ADR-025)**: the plan's own Phase 4 describes `/dashboard` becoming the real
authenticated landing, replacing the `UploadScreen`-as-gate pattern outright, with a matching
"largest mechanical test-update" pass across `auth.spec.js`/`auth-resilience.spec.js`. Scoping
this out before implementation surfaced a real gap the plan didn't address: Categories, Savings,
Transactions, and the upload gate itself aren't scheduled for their own routes until Phases
8.6–8.9, so a literal reading of Phase 4 would have made all of them unreachable for two-plus
phases — a real, if temporary, product regression. Presented to the user as an explicit
architectural choice rather than assumed; resolved in favor of zero regressions over strict
adherence to the plan's original phase boundary — see ADR-025 for the resulting design and its
follow-on consequences for Phase 8.5+.

**Verification gate**, run in full: `npm run lint` (0 errors, 44 pre-existing warnings,
unchanged), `npm test` (88/88, unchanged — no `api/**` code touched), `npx playwright test` (199
passed / 16 skipped [visual regression except chromium, by design, ADR-020] / 0 failed across all
5 browser projects — including the "dashboard (with data loaded)" a11y scan, which exercises the
new components directly and introduced no violation beyond the existing tracked allowlist), `npm
run build` (succeeds). No new bugs found. Not independently verified in a live browser this
session (no browser-automation tool was available) — verification rests on the Playwright suite's
real, headless, 5-engine rendering rather than a manual check, flagged explicitly rather than
assumed equivalent.

Next: Phase 8.5, the Upload workflow (`pages/UploadPage.jsx` + `features/upload/`, a real
`/upload` route, keyboard-accessible drop zone) — see CHECKPOINT.md's "Next recommended step" for
the specific consequence ADR-025 has on this phase (Upload gets an additional real route
alongside the still-unchanged gate, not a replacement of it yet).

### ADR-025 — Phase 8.4 re-hosts the legacy tab bar instead of cutting `/dashboard` over to the new Overview outright

**Context**: `docs/frontend/phase-8-migration-plan.md`'s Phase 4 describes `/dashboard` becoming
the real authenticated landing in this phase, with `UploadScreen`'s gate role removed and a
matching mechanical test-suite update. Scoping the actual implementation surfaced a sequencing
problem the plan didn't call out: Categories, Savings, Transactions, and Upload itself are each
scheduled for their *own* real route in a *later* phase (8.6–8.9). A literal Phase 4 cutover would
have needed to either (a) delete access to all four before their replacements exist, or (b) build
all four ahead of schedule inside what's meant to be a single-page phase — neither of which the
plan actually specifies how to do. **Decision**: keep the legacy `Dashboard` component (`App.jsx`)
exactly as it is — same tab bar, same Categories/Savings/Transactions tabs, same header, same
`UploadScreen` gate for the no-data case — and change only what its Overview tab renders,
delegating to the two new `features/dashboard/components/*` (passing the exact figures `Dashboard`
already computed, nothing recomputed). `pages/DashboardPage.jsx` is unchanged (still delegates to
`LegacyWorkspace`). **Rationale**: presented to the user as an explicit choice among three options
(re-host everything unchanged / accept a temporary regression / pull all four later phases forward
now) rather than silently picked — the user chose full parity, matching this project's standing
"never hide or ignore defects" and "no half-finished implementations" rules; a mid-migration dead
link or vanished settings page is exactly the kind of defect those rules are written to prevent.
**Consequence for later phases**: each of 8.6–8.9 shrinks the legacy `Dashboard` component by one
tab as it lands (delegating that tab's content to its own new page/route the same way Overview
now delegates to `OverviewHeader`/`RecentActivity`), until `Dashboard` and `App.jsx`'s
`LegacyWorkspace` have nothing left to render and are deleted outright in Phase 10, per the
migration plan's own final-cleanup step — this ADR doesn't change that end state, only the path
there. **Status**: stable; revisit only if a later phase's own scoping finds this sequencing no
longer holds.

### Phase 8.3 completion note (Authentication restyle onto design-system primitives)

Delivered, per `docs/frontend/phase-8-migration-plan.md`'s Phase 2: `AuthScreen.jsx` (931 lines,
inline-styled, doing double duty for login/signup/OTP/forgot/reset) retired outright, replaced by
`src/features/auth/components/{AuthShell,LoginForm,SignupForm,OtpScreen,ForgotPasswordForm,
ResetPasswordForm}.jsx` built on `components/ui/*` primitives and design tokens.
`hooks/useCredentialsForm.js` factors out the ~80%-identical login/signup submit logic (field
state, error routing, the otp-required/onAuth branch) now that they're two separate components
for two separate routes rather than one component with internal mode-toggle state;
`hooks/useRecaptcha.js` is the reCAPTCHA-v3 loader, ported unchanged (signup only).
`pages/{Login,Signup,ForgotPassword,ResetPassword}Page.jsx` are now thin compositions over these
instead of wrapping the shared `AuthScreen` with an `initialMode` prop; `ResetPasswordPage` reads
`?token=` via `useSearchParams()` at the page level, replacing `AuthScreen.jsx:666–668`'s manual
`window.location.search` sniff — the exact change the migration plan called for.
`PublicHomePage.jsx` (the forgot/reset reuse shim from ADR-023) is also deleted, since
`/forgot-password`/`/reset-password` now have their own real pages.

Three new `components/ui/*` primitives: `Field` (label/error/optional password-visibility toggle,
a real focus-visible ring instead of a manual `onFocus`/`onBlur` border-color swap), `OtpInput`
(the six-box auto-advance/backspace/arrow-nav/paste-fills-all pattern `AuthScreen.jsx` had
implemented twice — in its login/signup OTP screen and its reset-password screen — now one
component used by both `OtpScreen.jsx` and `ResetPasswordForm.jsx`), and `Spinner` (`currentColor`
so it matches whatever button/context it's in; wired into `Button.jsx`'s existing `loading` prop,
which previously only disabled the button and swapped its color, with no spinner at all).

**Verification gate**, run in full: `npm run lint` (0 errors, 44 pre-existing warnings — down from
46, since deleting `AuthScreen.jsx` removed 2 of its own unescaped-entity warnings along with the
file, nothing newly suppressed), `npm test` (88/88, unchanged — this phase touched no `api/**`
code), `npx playwright test` (199 passed / 16 skipped [visual regression except chromium, by
design, ADR-020] / 0 failed across all 5 browser projects), `npm run build` (succeeds).

**No new bugs found this phase** — unlike 8.1 and 8.2, the restyle preserved every field's/
button's existing accessible name and every screen's behavior exactly (verified, not assumed):
`auth.spec.js`'s role/placeholder-based selectors needed no structural updates except one
deliberate, called-out-in-advance change — "Forgot password?" moved from a `button` role (it used
to toggle `AuthScreen`'s internal screen state) to a real `link` role pointing at
`/forgot-password` (now a bookmarkable, refreshable route) — a UX improvement per the migration
plan, not a regression. Confirmed via `grep` that nothing in `src/` or `tests/` still imports
either deleted file before removing them.

### Phase 6 completion note

Delivered: Playwright (`playwright.config.js` — chromium, firefox, webkit, mobile-chrome,
mobile-safari, running against a same-origin production-build server, see
`tests/e2e/e2e-server.mjs`), five e2e spec files (`homepage`, `auth`, `auth-resilience`, `a11y`,
`performance`, plus `visual` — 6 total) covering signup/login/logout, CSRF, session
persistence/refresh rotation, multi-tab logout, offline resilience, account deletion, and the
forgot-password error path; `axe-playwright` accessibility scans on four page states with a
critical-impact hard gate plus a tracked per-page violation allowlist (ADR-019); chromium-only
visual regression snapshots of the three structurally-stable screens (ADR-020); performance
smoke tests; a Vitest coverage floor (`vitest.config.js` thresholds — ADR-021); and a Playwright
step in `.github/workflows/ci.yml` (minus the visual-regression tests, which need a Linux-native
baseline CI doesn't have yet — see ADR-020). `npm test`: **88/88** (84 carried forward + 4 new
login-lockout/rate-limit tests, closing a real coverage gap in `api/auth.js`). Playwright:
**165/165** functional/a11y/performance tests across all 5 browser projects, plus **3/3** visual
snapshots (chromium only, by design).

Four real, deterministic bugs were found and fixed along the way, none hypothetical — see
`docs/engineering-lessons/phase-6-testing.md`'s "Why testing saves money" for the summary and
ADR-019/020/021 below plus the CHECKPOINT.md session log for full detail:
1. `ForgotPasswordScreen` (`src/AuthScreen.jsx`) never checked the response status, so a real
   failure (rate-limited, or the email service not being configured) was silently shown as a fake
   "check your email" success screen. Fixed to match `ResetPasswordScreen`'s existing pattern.
2. Helmet was sending `Strict-Transport-Security` and CSP's `upgrade-insecure-requests`
   unconditionally, even over the plain-HTTP local dev/e2e server — WebKit honored the upgrade
   for a subresource fetch and broke outright (blank page, real Safari users on local dev would
   see the same thing). Fixed in `api/_lib/security-headers.js` to gate HSTS on `req.secure` and
   drop `upgrade-insecure-requests` entirely (restores CSP parity with `vercel.json`, which never
   had it).
3. `api/_lib/jwt.js` signed access tokens with only `{userId, email, name}` and
   `jsonwebtoken`'s one-second-resolution `iat` — a refresh completing within the same
   wall-clock second as the token it replaced produced a byte-identical "new" token. Fixed with a
   random `jti` claim.
4. The `authenticatedPage` Playwright fixture (`tests/e2e/fixtures/index.mjs`) returned control
   right after `page.goto("/")`, before `App.jsx`'s own mount-time session check had resolved —
   racy on a slower device profile, and the app's own offline fail-safe (already fixed earlier
   this session) then correctly-but-unluckily rendered a valid session as logged out. Fixed by
   waiting for a definitively-authenticated element before the fixture hands back control.

### Phase 7 completion note

Delivered: ESLint (flat config, scoped rules — see ADR-016), Vitest coverage reporting,
`.github/workflows/ci.yml` (lint + test + build on every push/PR), `.github/workflows/security.yml`
(npm audit, dependency review, secret scanning), `.github/workflows/deploy-verify.yml`
(post-deploy smoke test + the 3-function-count guard — see ADR-018), `.github/dependabot.yml`
(ADR-017), `CONTRIBUTING.md`, `docs/release-process.md`, `docs/github-branch-protection.md`
(recommendations only — no GitHub settings were changed), and
`docs/engineering-lessons/phase-7-ci-cd.md`. One real bug found and fixed along the way: a
duplicate `AMZN` key in `api/_lib/transaction-cleaner.js`'s abbreviation dictionary, caught by
ESLint's `no-dupe-keys` the moment linting was introduced (harmless — both values were
identical — but genuinely dead code; see the regression test in
`tests/transaction-cleaner.test.js`). No Playwright/e2e suite was added — that's explicitly
Phase 6 scope, not built speculatively ahead of it.

### Phase 4 completion note

Helmet, CSP, and the security-headers audit already shipped in Phase 2, so this phase was
scoped to what was actually still open (tracked as gaps in `authentication.md`/`database.md`):
endpoint-specific rate limiting on `api/data.js` and `/api/categorize`, a centralized input
validation layer, CSV/upload/formula-injection hardening, a logging audit, a dependency audit,
security regression tests, and a consolidated threat model. All seven landed — see
`docs/security/threat-model.md` for the full writeup and ADR-010 through ADR-013 below for the
specific design decisions. Dependency maintenance (originally Phase 5) was pulled forward and
finished alongside it since the threat model needed the resulting dependency posture anyway.

### Re-prioritization note

- **Phase 6 (Testing infrastructure)**: done — see the completion note above. Vitest + supertest
  + `mongodb-memory-server` (unit/integration) and Playwright (e2e, a11y, visual, performance)
  now cover both the API and the real browser-rendered app, with a coverage floor enforced in CI.

Recommended order for what's left: **8 (frontend) → 9 (AI features)**. Frontend redesign is
deliberately next, now that Phase 6's e2e/a11y/visual suite exists to catch regressions the
rewrite might introduce — that's exactly the safety net a frontend rewrite needs under it before
it lands. Two of Phase 8's own prerequisites are now measurably tracked rather than just written
down: the current a11y baseline (`tests/e2e/a11y.spec.js`'s allowlist) becomes the thing Phase 8
should shrink, not just "zero accessibility attributes" as a general note; and CSP's
`style-src: 'unsafe-inline'` dependency on inline `style={{}}` (see `authentication.md`'s known
technical debt) is still open and still Phase 8's to close.

## Architecture Decision Records

Newest first.

### ADR-024 — `--text-subtle` darkened app-wide (design token, not a per-component fix)

**Context**: Phase 8.2's Landing page a11y test (`tests/e2e/a11y.spec.js`) is the only page-level
scan in the app that runs with an empty violation allowlist — every other page's allowlist already
carries `color-contrast` as tracked, pre-Phase-8 debt (ADR-019), so this exact failure mode was
already latent everywhere `--text-subtle` renders normal-size text on `--surface`/`--bg`, just
never asserted against with zero tolerance until Landing's scan existed. axe measured 4.46:1 for
`--text-subtle` (`#6f7a72`) against white — under WCAG AA's required 4.5:1 for text below the
"large text" threshold (18pt regular / 14pt bold). **Decision**: darken the *token itself* in
`tokens.css` (light mode only — `#6f7a72` → `#67716a`, computed via the WCAG relative-luminance
formula directly, not trial-and-error, landing at 5.06:1) rather than patch the one component that
happened to surface it (`ProductPreview.jsx`). **Rationale**: this is a shared design-system value
used pervasively across every already-shipped Phase 8.1 surface (`Header.jsx`, `Sidebar.jsx`,
`MobileNav.jsx`, etc.) — fixing it at the source closes the gap everywhere at once, consistent with
the token system's own stated rule ("no new component should hardcode a color value outside this
file"); patching only the one call site that happened to get caught would have left the identical
defect live everywhere else, findable again the next time a page gets a strict a11y scan. Dark
mode's separate `--text-subtle` value (`#8f8873`) wasn't evidenced as broken by any scan and wasn't
touched. **Status**: the color shift is small enough (Δ ~8/255 per channel) that it stayed within
Playwright's visual-regression diff tolerance — the three pre-existing chromium baselines
(`auth-sign-in`, `auth-create-account`, `app-shell-empty`) didn't need regenerating; only the new
`landing.png` baseline was added.

### ADR-023 — `/forgot-password` and `/reset-password` are real routes, added as a hotfix ahead of Phase 8.2, not folded into a later phase

**Context**: found while scoping Phase 8.2 (Landing page), not during Phase 8.1 itself. Phase
8.1's `router.jsx` only defined `/` and `/dashboard`, with a wildcard `*` that
`<Navigate to="/" replace>`-ed for everything else — including `/reset-password?token=...`, the
exact URL a real password-reset email sends. `AuthScreen.jsx`'s own reset-token detection
(`window.location.pathname.includes("reset")`) never got a chance to run, because the router
redirected away before `AuthScreen` ever mounted under that path. This was a live, silent
regression in already-pushed code (`5d42cf8`): password reset was unreachable for any real user
who clicked the link in their email, and nothing in the Playwright suite caught it, because the
full token-consumption path has never had automated coverage (the same pre-existing gap ADR-021
already tracks for `api/auth.js`'s OTP/reset branches — this is its frontend-routing counterpart).
**Decision**: added `/forgot-password` and `/reset-password` as real routes rendering the same,
unchanged `PublicHomePage`/`AuthScreen` (matching the already-designed target route table in
`docs/frontend/phase-8-component-architecture.md`), extended `AuthScreen`'s existing
pathname-detection effect to also recognize `/forgot-password` (previously only reachable via an
in-app link click, never a direct URL), and replaced the wildcard's silent redirect with a real
`NotFoundPage` (also already in the target route table, and an explicit product requirement:
unknown routes must show a custom 404, not bounce silently). **Regression tests added**:
`tests/e2e/auth.spec.js` — visiting `/reset-password?token=...` and `/forgot-password` directly
(not via in-app navigation) reach the right screen; visiting an unknown path shows the 404 page
with a working "Go home" link. **Status**: shipped as its own commit, ahead of Phase 8.2's actual
Landing page work, once the user confirmed hotfix-then-continue as the right sequencing.

### ADR-022 — App-shell topbar uses `role="region"`, not a real `<header>`, until the legacy pages it wraps are gone

**Context**: Phase 8.1's new `AppShell`/`Header.jsx` needed its topbar (logo + command-palette
trigger + theme toggle) contained in *some* landmark — axe's `region` rule otherwise flags the
logo link (visible on mobile, where `Header` renders it) as page content outside any landmark.
The obvious fix, a real `<header>` element, was tried first and reverted: the not-yet-migrated
`UploadScreen`/`Dashboard` (still mounted inside `AppShell`'s `<Outlet>` until their own Phase 8.x
migrations) each already render their own unconditional `<header>`, and axe's
`landmark-no-duplicate-banner` rule fails on **any** second banner landmark regardless of naming —
unlike `landmark-unique` (the sibling rule for `<nav>`, satisfied by a distinguishing
`aria-label`), a second `<header>` is never allowed no matter how it's labeled. **Decision**: the
new topbar wrapper uses `<div role="region" aria-label="Application header">` instead — a
landmark type that permits multiple, uniquely-named instances, satisfying `region` without
colliding with the legacy pages' `<header>`. Same reasoning applied to `Sidebar.jsx`'s and
`MobileNav.jsx`'s new `<nav>` landmarks, which got `aria-label="Primary navigation"` to stay
distinguishable from the legacy Dashboard's own unlabeled `<nav>` (`src/App.jsx`, its old TabBar).
**Status**: revisit once the last old-header page (`UploadScreen`/`Dashboard`, Phase 8.4/8.5) is
migrated and its own `<header>` is deleted — at that point `AppShell`'s topbar can become a real
`<header>` with nothing left to collide with. Tracked here rather than left as a comment-only
decision because it's the kind of "why is this a div and not a header" question that outlives the
person who wrote it.

### ADR-021 — Vitest coverage thresholds set as a floor under today's real numbers, not an aspirational target
**Context**: Phase 6 (and ROADMAP's own re-prioritization note, previously) called out "a
coverage target" as one of the explicitly open items testing infrastructure still needed.
**Decision**: `vitest.config.js`'s `coverage.thresholds` is set to statements 50 / branches 42 /
functions 70 / lines 52 — a few points under this session's actual measured numbers
(52.2/46/75/54.9), not a round or aspirational number. **Rationale**: a threshold above real
coverage just fails the very next build; a threshold with no teeth (e.g. 0%) isn't a target at
all. Setting it just under today's real number makes it a genuine regression gate — a future PR
that deletes tests or adds untested code fails CI — without demanding contributors chase 100% on
code this project has repeatedly, deliberately left untested on purpose (see `mailer.js`,
`otp.js`, and `auth.js`'s OTP branches below, ADR-019's sibling reasoning). Coverage on
`api/auth.js` specifically improved from 29.65%/29.92% (statements/branches) to
31.75%/33.46% this phase by adding real tests for the login rate-limiter, lockout-after-5-failed-
attempts logic, and the nonexistent-account path — all real, previously-untested security logic
that needed no email/SMTP to test. The much larger remaining gap (`verifyOtp`, `resendOtp`,
`forgotPassword`'s real branch, `verifyLink`, `resendVerification`) is structurally unreachable
in this test suite by design: `tests/vitest.setup.js` deletes `GMAIL_USER`/`GMAIL_APP_PASSWORD`
so `isEmailVerificationEnabled()` is always `false`, the same "disable, don't mock" pattern
`phase-6-testing.md`'s "Mocking" section already documents — closing it for real needs actual
Gmail SMTP test credentials, not more test-writing effort. **Status**: stable; raise the
thresholds deliberately as real coverage grows, not to make this number look bigger.

### ADR-020 — Visual regression runs on the chromium Playwright project only, and is excluded from CI
**Context**: Phase 6.5 needed snapshot tests for CashCanvas's structurally stable screens
(sign-in, create-account, the authenticated app shell before data loads).
**Decision**: `tests/e2e/visual.spec.js` skips itself (via a `beforeEach` checking
`testInfo.project.name`) on every Playwright project except `chromium`, and
`.github/workflows/ci.yml`'s Playwright step explicitly excludes this file
(`--grep-invert "visual regression"`). **Rationale**: two separate problems, one fix each.
First, running the same pixel snapshot across all 5 configured browser projects would multiply
baseline images 5x for a check whose entire value is "did *our* markup/CSS change" — different
rendering engines (chromium/firefox/webkit) anti-alias fonts and subpixels differently by design,
which would fail the comparison on every single run regardless of any real change. Second, the
baseline PNGs committed here were generated on this project's macOS development machine —
Playwright names them by platform (`auth-sign-in-chromium-darwin.png`) — and
`.github/workflows/ci.yml` runs on `ubuntu-latest`; a Linux runner's font rendering would fail
every comparison the same way, for the same non-reason. The first problem is permanently fixed
by scoping to one project; the second is a real, currently-open gap, not silently worked around —
CI simply doesn't run these tests yet, same as ADR-018 documented `deploy-verify.yml`'s
unexercised-by-a-real-run status rather than pretending it was covered. **Status**: visual
regression is real and passing locally (3/3, chromium, verified stable across repeated runs);
follow-up (not blocking): generate a Linux-native baseline from an actual CI run and re-enable
the step there.

### ADR-019 — Accessibility gate fails only on `critical`-impact violations, checks everything else against a tracked per-page allowlist
**Context**: Phase 6.4 needed `axe-playwright` scans of the app's key screens.
`ROADMAP.md`'s tech debt has said since the original Phase 1 audit: "zero accessibility
attributes (`aria-*`, `alt=`) across the frontend" — scoped to Phase 8's frontend redesign, not
this phase. Running `axe-playwright` for real, as expected, found exactly that: `color-contrast`,
`landmark-one-main`, `page-has-heading-one`, `region` on the auth screens, plus `svg-img-alt` and
`scrollable-region-focusable` (from Recharts' default pie-chart markup) on the dashboard. None
`critical`-impact. **Decision**: `tests/e2e/a11y.spec.js`'s `checkA11yAgainstBaseline()` helper
hard-fails on any `critical`-impact violation (there are none today, but a real one would be
worth blocking on), and separately fails on any violation whose rule ID isn't in that page's
fixed allowlist — so a *new* violation beyond today's known set still fails the test; the
existing, known set doesn't. **Rationale**: this is the same reasoning ADR-016 already used for
ESLint's stricter React-Compiler rule set — retroactively rewriting a large, working,
already-shipped frontend (`App.jsx`, `AuthScreen.jsx`) to satisfy a scanner's full opinion is
Phase 8's job, not a one-line-fix-along-the-way inside Phase 6, and failing the whole CI/CD
pipeline on Phase 8's own backlog would just get the check disabled or ignored — the actual
failure mode ADR-016 was written to avoid. A pure `skipFailures: true` (log-only) alternative was
considered and rejected: it would never fail on anything, including a genuine new regression,
which defeats the point of adding the scan at all. **Status**: stable; this baseline is exactly
what Phase 8 should be shrinking, not a permanent allowance — see the Phase 6 re-prioritization
note above.

### ADR-018 — Deployment verification triggers on Vercel's `deployment_status` event, not a custom deploy step
**Context**: Phase 7.9 required a workflow that verifies a deployment after it succeeds,
including the exact-3-functions check that would have caught the Hobby-plan function-count
regression before it reached real users. **Decision**: `.github/workflows/deploy-verify.yml`
listens for GitHub's `deployment_status` event (which Vercel's native GitHub integration
already posts on every deploy) rather than adding a custom deploy step that calls Vercel from
within a workflow. **Rationale**: Vercel's GitHub App already deploys on every push to `main` —
duplicating that in a workflow would mean two deployment paths that could drift, and there's no
reason to rebuild something that already works. Reacting to the *result* of that existing
deployment is strictly additive: four HTTP-level checks (homepage, `/api/auth`, `/api/data`,
`/api/ai`) need no secret and always run; the function-count check needs a `VERCEL_TOKEN`
repository secret (documented in `docs/release-process.md`, not something this project can set
itself) and fails loudly with an explanation if that secret is missing, rather than silently
skipping. **Status**: verified against the live production deployment during Phase 7 (the exact
`curl`/`vercel inspect`/`grep` logic in the workflow was run manually against
`cash-canvas-sigma.vercel.app` and confirmed to detect all three functions correctly) — not yet
exercised by an actual GitHub Actions run, since that requires the `VERCEL_TOKEN` secret to be
added by the repository owner first.

### ADR-017 — Dependabot ignores major-version bumps globally, not via a hand-picked package list
**Context**: Phase 7.7 required Dependabot configured with "packages that should not
auto-upgrade" excluded. **Decision**: `.github/dependabot.yml` ignores
`version-update:semver-major` for every dependency (`dependency-name: "*"`), rather than naming
specific packages like `mongodb` or `express`. **Rationale**: this project already has a real
precedent for why major bumps need a human, not a bot — ADR-013's `nodemailer` 6→9 upgrade
required checking exactly which APIs this app uses and verifying none of the breaking changes
touched them, a judgment call no automated tool can make safely. That reasoning applies to
*any* direct dependency's major bump, not a pre-guessable subset — a hand-picked ignore list
would work today and silently stop protecting the project the day a dependency not on the list
ships a breaking major version. Minor/patch bumps (semver-safe by convention) are still
auto-grouped weekly. **Status**: stable.

### ADR-016 — ESLint adopts only `rules-of-hooks` + `exhaustive-deps` from eslint-plugin-react-hooks, not its full "recommended" set
**Context**: Phase 7.1/7.2 required introducing ESLint into a codebase that had never been
linted. `eslint-plugin-react-hooks` v7's `recommended` config turned out to be a new,
much stricter rule family oriented around the React Compiler (`set-state-in-effect`,
`immutability`, `purity`, `set-state-in-render`, etc.) — adopting it wholesale produced 46
errors, nearly all in `App.jsx`, flagging long-standing, working, already-shipped patterns
(e.g. calling `setState` inside a `useEffect` that parses a URL param) that this codebase was
never written against. **Decision**: keep only the two classic, universally-accepted rules —
`rules-of-hooks` (a real correctness rule: catches hooks called conditionally or out of order,
which causes actual runtime bugs) as `error`, and `exhaustive-deps` (a best-practice hint) as
`warn`. Also downgraded `react/no-unescaped-entities` and `no-useless-escape` to `warn` (real,
but purely cosmetic findings — ~40 occurrences across `App.jsx`, unrelated to standing up CI).
**Rationale**: per this phase's explicit instruction not to modify completed frontend/backend
work without a critical issue discovered, retroactively rewriting a large, working file to
satisfy a linter's *opinion* (not a correctness bug) is out of scope — the same reasoning that
kept `no-dupe-keys` (a genuine correctness rule already in ESLint's base `recommended` config)
as a hard error, since that one *did* catch a real, if harmless, bug (see the `AMZN` duplicate
key fix this phase). **Status**: `npm run lint` is genuinely green (0 errors) against the
current codebase — see `eslint.config.js` for the specific rule-by-rule reasoning. Revisit the
full React Compiler rule set if this project ever adopts the compiler itself.

### ADR-015 — CI installs with `npm ci` and pins Node to the version production actually runs
**Context**: during the Phase 4/5 release checkpoint (before Phase 7 started), a real
local/committed drift was found: the local dev machine had `vite@6.4.1` installed while
`package-lock.json` — what Vercel installs fresh on every deploy — locked `vite@6.4.3`. Local
and deployed builds produced slightly different bundle hashes because of it. **Decision**:
`.github/workflows/ci.yml` uses `npm ci` (never `npm install`) and pins Node to `24.x` via
`actions/setup-node`, matching the Vercel project's actual configured Node version (confirmed
via `vercel project ls` during the prior deployment session), not whatever a CI runner's
default happens to be. `package.json` also gained an `engines.node: ">=22"` field — deliberately
a permissive *floor*, not a `24.x` exact-match: this local dev machine runs Node 22.20.0 and had
run every command in this project successfully all session, so pinning `engines` to `>=24` would
immediately produce an `EBADENGINE` warning on a machine that has nothing actually wrong with
it (caught during this same phase's own final verification pass — `npm ci` surfaced the
warning immediately after `>=24` was first tried). **Rationale**: `npm ci` fails outright on any
lockfile/`package.json` disagreement instead of silently re-resolving, which is exactly the
property that would have caught the `vite` drift in CI before it ever caused a confusing "why
don't my local and deployed builds match" investigation. CI/production stay pinned to an exact
`24.x` for true parity (that's the comparison that actually matters — CI vs. Vercel, not one
contributor's laptop vs. another's); `engines` only needs to rule out genuinely incompatible old
versions, not enforce lockstep with production. **Status**: stable
— see `docs/engineering-lessons/phase-7-ci-cd.md` for the full story, written up for onboarding.

### ADR-014 — Reset `global._mongoClientPromise` per test file; run test files sequentially
**Context**: discovered during the Phase 4 release checkpoint, not something this phase's
feature work introduced. `api/_lib/db.js` caches its `MongoClient` on `global._mongoClientPromise`
when `NODE_ENV !== "production"` — a dev-hot-reload optimization. `tests/vitest.setup.js` sets
`NODE_ENV="test"`, which takes that same branch. The real Node `global` object is a
process-level singleton that outlives any one test file's isolated module registry; when
Vitest reuses a worker process across multiple test files (which its pool scheduler does,
depending on file count vs. available workers), a later file's `getDb()` would silently reuse
an *earlier* file's already-stopped `mongodb-memory-server` connection instead of its own,
fresh one — producing intermittent, low-frequency (~1-in-6 to 1-in-10 full-suite runs),
non-reproducible-in-isolation cross-test corruption (wrong/missing users, stale sessions,
garbled status codes on completely unrelated assertions). Confirmed via 20+ clean isolated
single-file runs vs. repeated full-suite runs until the specific failure was captured and
traced to this. **Decision**: (1) `tests/vitest.setup.js` now closes and deletes any cached
`global._mongoClientPromise` both before creating its own `MongoMemoryServer` and in an
`afterAll` teardown, so no file can observe another's connection as still cached; (2)
`vitest.config.js` sets `fileParallelism: false` as defense-in-depth, since these test files
each spin up a real `mongod` process plus bcrypt hashing — sequential execution removes an
entire class of resource-contention flakiness for a few seconds of added wall time.
**Rationale**: fixing the cache-reset bug is the actual root-cause fix (verified: 25
consecutive full-suite runs, zero failures); the parallelism setting is a low-cost belt-and-
suspenders addition given how heavy each file's setup is. **Status**: stable — this was a
pre-existing latent bug in the test harness added across Phases 2–3, not a regression.

### ADR-013 — Accept the `nodemailer` major version bump (6 → 9) to clear a high-severity `npm audit` finding
**Context**: Phase 4 dependency audit found `nodemailer@6.10.1` (a direct runtime dependency,
actively used for OTP/verification/password-reset email) flagged high-severity for several
SMTP/CRLF-injection and TLS-validation issues. No non-breaking fix existed — only a major
version bump (`isSemVerMajor: true`). **Decision**: take the bump. **Rationale**: this app's
entire `nodemailer` surface is two calls — `createTransport({service, auth})` and
`transporter.sendMail({from,to,subject,html,text})` — core APIs stable since early versions;
none of the vulnerable features (SES/direct transports, OAuth2 token handling, user-controlled
`envelope`/header options) are used here. Verified with a live `createTransport()` call, the
full test suite, and `npm run build` post-upgrade — zero code changes required. **Status**:
`npm audit` clean (0 vulnerabilities). See `docs/security/threat-model.md` for the full
before/after audit.

### ADR-012 — Duplicate-upload detection via content hash, not filename
**Context**: Phase 4 CSV/upload hardening asked for duplicate-upload protection.
**Decision**: SHA-256 hash of the sanitized `transactions[]` array (not the filename) stored as
`uploaded_files.contentHash`, backed by a unique `(userId, contentHash)` sparse index.
**Rationale**: filename-based dedup is trivially bypassed (rename the file, same data) and
would false-positive on legitimately differently-named exports of the same statement; hashing
the actual transaction content catches real duplicates regardless of filename and is
race-safe via the same app-check-then-DB-constraint pattern already used for category names.
Sparse so pre-migration documents without the field aren't treated as a duplicate collision.
**Status**: stable.

### ADR-011 — CSV/formula-injection defense at ingestion, not at export
**Context**: transaction descriptions, category names, and merchant names are all persisted
strings that later get written verbatim into the app's own CSV export (`downloadCsv` in
`App.jsx`) — a classic formula-injection vector if a description like `=cmd|'/c calc'!A1` ever
reaches a spreadsheet. **Decision**: sanitize (`sanitizeCsvField()` in `api/_lib/validation.js`)
at the point of ingestion (`POST /api/files`, `POST /api/categories`, `POST /api/merchant-rules`),
not at export time. **Rationale**: sanitizing once at the single entry point every mutating
route already funnels through is simpler and more robust than remembering to sanitize at every
current *and future* export/display call site; a leading `'` is stripped by Excel/Sheets on
display (their own "force text" convention), so legitimate values round-trip unchanged.
**Status**: stable — see `docs/security/threat-model.md` for the full threat writeup.

### ADR-010 — Rate limits on `api/data.js`/`api/ai.js` keyed per-user, not per-IP
**Context**: Phase 4 required endpoint-specific rate limiting on every route in `api/data.js`
plus `/api/categorize`, explicitly not a single global limiter. **Decision**: every limit is
keyed `${action}:${userId}` (data.js) or `${action}:${userId}:${ip}` (categorize/parse-pdf,
matching the pre-existing pattern), with per-route values sized to realistic worst-case
legitimate usage rather than one blanket number. **Rationale**: these are all authenticated,
CSRF-protected routes — the threat model is a compromised or scripted *account*, not anonymous
traffic, so per-user keying is both the correct threat model and avoids one heavy user on a
shared IP (e.g. university/office NAT) throttling unrelated accounts. `/api/categorize` keeps
IP in its key (like the existing `/api/parse-pdf` limiter) since it's also bounding literal
dollar spend against a paid external API, where an extra IP dimension adds defense-in-depth.
Specific values and rationale live as inline comments at each call site in `api/data.js`/`api/ai.js`
and in `docs/security/threat-model.md`. **Status**: stable.

### ADR-009 — No soft deletes
**Context**: Phase 3 considered `deleted`/`deletedAt`/`deletedBy` fields per the original
database-optimization prompt. **Decision**: not implemented. **Rationale**: every delete path
today (file delete, category delete, account delete) is user-initiated, low-stakes, and
cheaply reversible in practice (re-upload, re-create) or already an intentional irreversible
action (`delete-account`, explicitly labeled "cannot be undone"). Soft deletes would require
every read query in the app to filter `deleted: false` forever, for a recovery feature nothing
currently needs. **Status**: revisit if a compliance-driven grace period on account deletion
becomes a real requirement.

### ADR-008 — No MongoDB `$jsonSchema` validation
**Context**: Phase 3 data-integrity review. **Decision**: rely on application-level validation
(`api/_lib/validation.js` + route handlers) plus the new unique indexes, not database-level
schema validators. **Rationale**: exactly one trusted writer (the Node API) touches this
database; schema validators add real ongoing maintenance cost (every field change needs the
validator updated too) for a benefit that only matters with an untrusted or second writer.
**Status**: revisit if that changes (e.g. a separate admin tool or data pipeline writes
directly to Mongo).

### ADR-007 — Skip Budgets / Savings Goals persistence
**Context**: the original Phase 3 prompt assumed `Budgets` and `Savings Goals` collections
existed and asked for indexes on them. Neither exists — "savings goal" is unsaved client-side
React state today. **Decision**: don't build persistence for either as part of a database
*optimization* phase. **Rationale**: designing and shipping new persisted collections + API
routes is a feature-scope decision, not an indexing task; confirmed directly with the user
before proceeding. **Status**: open product decision — build when/if prioritized as a feature.

### ADR-006 — Transactions stay embedded in `uploaded_files`, not normalized
**Context**: the app caps uploads at 10,000 transactions/file, clearly already guarding
MongoDB's 16MB document limit. **Decision**: don't normalize transactions into their own
collection yet. **Rationale**: this is a full data-model migration (touches upload, dashboard
queries, CSV export, categorization) — an order of magnitude bigger than "add indexes," and
not yet justified by real data volume. **Status**: the real scaling trigger, per
`database.md`'s Future Scaling section — revisit at the ~1M-user tier, or sooner if any single
file's transaction count/document size is observed approaching the practical ceiling.

### ADR-005 — Refresh-token rotation without "family" reuse detection
**Context**: Phase 2 refresh-token design. **Decision**: atomic compare-and-swap rotation
(rejects reuse of an already-rotated token) without revoking every session descended from the
same original login on detected reuse. **Rationale**: simpler, and rejects reuse just as
reliably for the single-session case; full lineage-revocation adds a parent/child session
graph for a marginal benefit at current traffic/threat level. **Status**: documented limitation
in `authentication.md` — revisit if real abuse patterns ever justify the added complexity.

### ADR-004 — CSRF via double-submit cookie, not a server-side token store
**Context**: moving auth to cookies (Phase 2) reopened CSRF as an attack surface.
**Decision**: non-HttpOnly `cc_csrf` cookie + required `X-CSRF-Token` header, compared with
`crypto.timingSafeEqual`, layered on top of `SameSite=Lax`. **Rationale**: no server-side
token storage/lookup needed; simpler than a session-bound CSRF-token table, and sufficient
given `SameSite=Lax` already blocks most cross-site non-GET requests in modern browsers.
**Status**: stable, no known issues.

### ADR-003 — HttpOnly cookies over `localStorage` for session tokens
**Context**: the original design stored a JWT in `localStorage`, readable by any script on the
page. **Decision**: move to HttpOnly cookies (`cc_at`/`cc_rt`), never exposed to JS.
**Rationale**: closes the JS-exfiltration/XSS-token-theft path entirely; the trade-off (CSRF
exposure) is handled by ADR-004. **Status**: stable, verified live in a real browser (see
Phase 2 completion notes) — zero `localStorage` usage confirmed.

### ADR-002 — Opaque refresh tokens (not JWT), stored only as a SHA-256 hash
**Context**: needed a way to revoke sessions instantly. **Decision**: refresh tokens are
`crypto.randomBytes(48)` random values, looked up server-side by hash — not self-validating
JWTs. **Rationale**: a JWT refresh token can only be revoked via a blocklist (since JWTs are
valid by signature alone); an opaque token requires a DB lookup on every use, which is exactly
what makes instant revocation (logout, logout-all) possible with no blocklist to maintain.
**Status**: stable.

### ADR-001 — `server.js` delegates to the same handlers Vercel uses, never reimplements them
**Context**: `server.js` (dev) and `api/*.js` (prod) had drifted — different OTP generation
(`Math.random()` vs `crypto.randomInt()`), different mailer/reCAPTCHA copies, and `server.js`
was missing routes (`forgot-password`, `reset-password`) that existed in prod. **Decision**:
`server.js` is a thin Express bootstrap that mounts `api/auth.js`/`api/data.js`/`api/ai.js`
directly via `app.all(path, handler)`, rather than maintaining parallel implementations.
**Rationale**: eliminates an entire class of dev/prod drift bugs by construction — there is
exactly one copy of every route, every time. **Status**: stable; this is why Phases 2–3's
route/index/behavior changes never needed a second implementation for the dev server.

## Known technical debt (consolidated across all phases)

From `authentication.md`:
- Rate limiting is per-instance (in-memory), not global — fine today, needs Upstash Redis (or
  similar) once traffic/abuse justifies it. (Endpoint-specific limits now exist everywhere
  they were missing — see Phase 4 — this is specifically about the *global-across-instances*
  gap, which is still open.)
- CSP `style-src` requires `'unsafe-inline'` until the frontend moves off inline `style={{}}`
  attributes onto real stylesheets — a Phase 8 (frontend redesign) dependency.
- No device-management UI (the `sessions` data needed for one already exists).

From `database.md`:
- Transactions embedded in `uploaded_files` will hit MongoDB's document-size ceiling before a
  normal collection-scan problem — see ADR-006.
- No cursor pagination on `/api/files` beyond the fixed `.limit(20)` (no UI to consume it yet).
- `passwordResetExpiry`/`verificationTokenExpiry`/`pendingOtpExpiry` on `users` can't be
  TTL-cleaned (would delete whole accounts) — inert-but-harmless field bloat if unused.
- No MongoDB-level schema validation — see ADR-008.
- Budgets / Savings Goals have no persistence layer — see ADR-007.

From Phase 7 (CI/CD):
- `.github/workflows/deploy-verify.yml`'s Serverless Function count check needs a `VERCEL_TOKEN`
  repository secret this project cannot add itself — documented in `docs/release-process.md`,
  not yet exercised by an actual GitHub Actions run (see ADR-018).
- `docs/github-branch-protection.md`'s recommendations are unapplied — branch protection is a
  GitHub repository *setting*, deliberately out of scope for this project's own files (Phase
  7.8 explicitly says not to modify GitHub settings). CI checks exist and pass; nothing yet
  requires them to pass before a merge is possible.
- ~45 pre-existing ESLint warnings (unescaped JSX apostrophes, unnecessary regex escapes,
  mostly in `App.jsx`) are visible but not blocking — see ADR-016 for why they weren't
  retroactively fixed as part of introducing linting. Clean up incrementally.
- No Codecov (or similar) integration — coverage reports are generated and uploaded as CI
  artifacts (lcov/html/json-summary), ready for that the day it's wired up, per Phase 7.4's
  explicit "don't add unnecessary external services" instruction.

From Phase 6 (Testing infrastructure):
- Visual regression (`tests/e2e/visual.spec.js`) doesn't run in CI yet — its baselines were
  generated on macOS and would fail every comparison on font-rendering differences against
  `ci.yml`'s `ubuntu-latest` runner, not a real UI regression. See ADR-020. Follow-up: generate a
  Linux-native baseline from an actual CI run, then remove the `--grep-invert` exclusion.
- `tests/e2e/a11y.spec.js`'s per-page violation allowlist (`color-contrast`,
  `landmark-one-main`, `page-has-heading-one`, `region`, `svg-img-alt`,
  `scrollable-region-focusable`) is real, current debt, not a permanent allowance — see ADR-019.
  This is the same "zero accessibility attributes" gap the original Phase 1 audit already
  tracked below, now measurable and regression-guarded instead of just written down.
- `api/auth.js`'s OTP-based signup/login, `forgotPassword`'s real branch, `resetPassword`,
  `verifyLink`, and `resendVerification` have no automated test coverage anywhere (Vitest or
  Playwright) — both suites deliberately run with `GMAIL_USER`/`GMAIL_APP_PASSWORD` unset (see
  ADR-021), so `isEmailVerificationEnabled()` is always `false` and these branches are never
  reached. Closing this needs real Gmail SMTP test credentials, the same open item ADR-013
  already flagged for verifying `nodemailer`'s live send — not more test-writing effort against
  the same disabled path.
- `logoutAllDevices()` (`src/api.js`) has no UI caller anywhere in `App.jsx`/`AuthScreen.jsx` —
  confirmed while scoping Phase 6's auth e2e coverage. Same underlying gap
  `authentication.md`'s "No device-management UI" bullet already tracks; noted here as the
  specific function it applies to.

From Phase 8.1 (routing, navigation shell, design foundation):
- `Header.jsx`'s topbar is `role="region"`, not a real `<header>`, until the last unmigrated page
  using its own `<header>` (`UploadScreen`/`Dashboard`, Phase 8.5+) is gone — see ADR-022.
- Material Symbols Outlined icon font stays on Google Fonts' CDN (not self-hosted like
  Newsreader/Manrope/Inter) until every old screen still calling `<span class="material-symbols-
  outlined">` (`App.jsx`) is migrated to `lucide-react` — removing it earlier would blank out
  every icon those screens render. Tracked to close alongside Phase 8.8. (`AuthScreen.jsx` no
  longer applies here — retired in full as of Phase 8.3.)

From Phase 8.4 (Dashboard Overview restyle, ADR-025):
- The legacy `Dashboard` component (`App.jsx`) still owns Categories, Savings, Transactions, the
  tab bar, and the header — only its Overview tab's content was migrated this phase, by deliberate
  choice (ADR-025), not oversight. Each of Phases 8.6–8.9 shrinks it by one more tab; it and
  `LegacyWorkspace` are deleted outright in Phase 10 once nothing is left inside them.
- The migration plan's original Phase 4 called for `/dashboard` replacing `UploadScreen`'s gate
  role outright, with a matching test-suite update across `auth.spec.js`/`auth-resilience.spec.js`
  ("try with sample data" → a `/dashboard`-specific signal). That cutover didn't happen this
  phase (ADR-025) — the gate is untouched and those tests are still valid as originally written.
  Whichever later phase actually removes the gate needs to pick this up explicitly, not assume
  it was already done in 8.4.

From `docs/security/threat-model.md` (Phase 4):
- Pagination and search validators were explicitly requested by the Phase 4 spec but not
  built: no route in the app currently accepts a `page`/`pageSize`/`search` parameter
  (`GET /api/files` uses a fixed `.limit(20)`, no search endpoint exists at all) — adding
  validators with no caller would be dead code. Build them when a real paginated/searchable
  endpoint is built, not speculatively ahead of it.
- `api/_lib/logger.js`'s structured production JSON output isn't shipped anywhere yet — it
  writes to stdout, same as before, just now parseable. Wiring a real log drain/aggregator is
  future work, not blocking.

From the original Phase 1 audit:
- Zero accessibility attributes (`aria-*`, `alt=`) across the frontend, no dark mode — scoped
  to Phase 8. As of Phase 6, this is measured and regression-guarded rather than just written
  down — see `tests/e2e/a11y.spec.js` and ADR-019's tracked allowlist above.
- ~~`npm audit`: 2 high-severity runtime deps (`lodash`, `nodemailer`) plus several
  devDependency-only vulnerabilities in the Vite toolchain~~ — **resolved in Phase 4**:
  `npm audit` is now clean (0 vulnerabilities). See ADR-013 for the `nodemailer` major-bump
  rationale.
