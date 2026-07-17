# Phase 6 Engineering Lessons: Testing, Explained From Zero

This document assumes you've never worked on a professional software team and have never
heard most of these terms used precisely. Every concept below is tied to something real in
this repository — nothing here is hypothetical.

## Unit tests

A unit test checks **one small, isolated piece of logic** — usually a single function — with
no database, no network, no other moving parts.

**In this repo:** `tests/validation.test.js` is almost entirely unit tests. Take one:

```js
it("rejects a calendar date that doesn't exist", () => {
  expect(isValidTransactionDate("2025-02-30")).toBe(false);
});
```

`isValidTransactionDate()` is a pure function — same input, same output, every time, nothing
external involved. That's what makes it a *unit* test: it tests one unit, in isolation.

## Integration tests

An integration test checks that **multiple pieces work correctly together** — usually
including a real database or a real HTTP request, not fakes standing in for them.

**In this repo:** `tests/auth.test.js` and `tests/data.test.js` are integration tests. When
`signupUser()` (in `tests/helpers.js`) calls `POST /api/auth/signup`, that request travels
through the *real* Express routing, the *real* `api/auth.js` handler, `bcrypt` *really* hashes
the password, and a *real* (if temporary, in-memory) MongoDB actually stores the document. The
only thing "fake" is that the MongoDB instance is ephemeral (`mongodb-memory-server`) instead of
a shared production database — everything else is the genuine code path.

Integration tests catch bugs unit tests structurally cannot: e.g., ADR-014's flaky-test bug (a
stale cached database connection across test files) was only ever visible at the integration
level, because it involved the interaction between the test runner, Node's module system, and a
real database connection — no single function was "wrong."

## End-to-end tests (E2E)

An E2E test drives the app **the way a real user would** — through an actual browser, clicking
real buttons, typing into real input fields, watching real pages load — rather than calling an
API directly.

**In this repo:** before Phase 6, this category didn't exist at all. Every test up to this
point, including the "integration" tests above, talks to the API directly via Supertest — none
of them have ever opened a browser, rendered `App.jsx`, or clicked a button. That's the entire
reason Phase 6 exists: an integration test proves `POST /api/auth/login` works; only an E2E
test proves a person can actually type their email and password into the real login form and
land on their real dashboard.

## Smoke tests

A smoke test is a **fast, shallow check that the absolute basics work** — not a thorough test
of any one feature, just "did the whole thing catch fire the moment we turned it on." The name
comes from electronics: plug it in, see if it smokes.

**In this repo:** `tests/e2e/performance.spec.js` (Phase 6.6 — homepage loads, dashboard loads,
four core API endpoints respond) are smoke tests — they don't verify the dashboard's numbers are
*correct*, just that it *loads*, and how long that takes. Thresholds are deliberately generous
(5s for a page to become interactive, 2s per API call) because this runs on a local dev machine
against a freshly-built server, not production infrastructure — the point is catching a 10x
regression, not chasing a tight performance budget that would just be flaky here.
`.github/workflows/deploy-verify.yml` (Phase 7) is also a smoke test in spirit: it doesn't re-run
the whole test suite against production, it just checks "is the homepage 200, do the three
functions respond" — the minimum signal that a deploy didn't completely break.

## Regression tests

A regression test exists **specifically because a real bug happened once**, and its entire job
is proving that exact bug can never silently come back.

**In this repo, three concrete examples:**
- `tests/transaction-cleaner.test.js` exists because `api/_lib/transaction-cleaner.js` had a
  duplicate `AMZN` dictionary key (found by ESLint in Phase 7).
- `tests/logging.test.js` exists because `api/_lib/mailer.js` once logged raw OTP codes and
  password-reset tokens to the console (found during the Phase 4 security audit).
- `tests/data.test.js`'s "concurrent signups, same email" test exists because two simultaneous
  signup requests could both slip past the app-level duplicate-email check before a database
  index made it impossible (Phase 3).

The pattern every time: something broke, a test was written that fails against the *old*,
broken code and passes against the fix, and now that specific way of breaking is permanently
guarded. This is different from a regular test written alongside new code — a regression test's
whole reason to exist is a real, past incident.

## Snapshot tests

A snapshot test saves **the exact output of something** (usually rendered HTML, or in this
project's case, a screenshot) the first time it runs, then on every future run compares the new
output against that saved copy and fails if anything changed.

**In this repo (Phase 6.5, `tests/e2e/visual.spec.js`):** visual regression tests are a kind of
snapshot test — Playwright takes a screenshot of the sign-in screen, the create-account screen,
and the authenticated app shell (before any data is loaded), saves them, and future runs diff
new screenshots against the saved ones pixel-by-pixel. A snapshot test doesn't know whether a
change is *good* or *bad* — it only knows something's *different*, and a human has to look and
decide whether to accept the new snapshot or treat it as a bug.

These snapshots run on the `chromium` Playwright project only, not all five — different
rendering engines anti-alias fonts and subpixels differently, so a cross-engine pixel diff would
flag rendering-engine noise as a "regression" on every single run, not real change. For the same
reason, the CI workflow (`.github/workflows/ci.yml`) excludes this describe block entirely
(`--grep-invert "visual regression"`): the baseline PNGs committed to this repo were generated on
a macOS dev machine, and Playwright names them accordingly
(`auth-sign-in-chromium-darwin.png`) — a Linux CI runner would fail every comparison on font
rendering differences alone, not a real UI change. See ADR-020 in `ROADMAP.md`.

## Accessibility tests

An accessibility test checks whether the app can actually be used by people who rely on
assistive technology — screen readers, keyboard-only navigation, sufficient color contrast for
low vision — not just whether it looks right to someone using a mouse and full color vision.

**In this repo:** this is a genuinely important gap to be honest about. `ROADMAP.md`'s tech
debt has said since Phase 1: "zero accessibility attributes (`aria-*`, `alt=`) across the
frontend." Phase 6.4's `axe-playwright` scan (`tests/e2e/a11y.spec.js`) found exactly that —
real, existing violations, not a test-writing failure: `color-contrast` (WCAG AA contrast on the
auth screens and dashboard), `landmark-one-main`/`region` (no `<main>` landmark anywhere in the
app), `page-has-heading-one` (no `<h1>`), and, on the dashboard specifically, `svg-img-alt` and
`scrollable-region-focusable` from the Recharts pie chart's default markup. None are
`critical`-impact.

Rather than fail CI on a known, Phase-8-scoped backlog (the same reasoning ADR-016 already used
when it kept ESLint's stricter React-Compiler rule set out of Phase 7, instead of retroactively
rewriting a large working file to satisfy a linter's *opinion*), the gate in `a11y.spec.js` works
in two tiers: any `critical`-impact violation fails the suite outright — there are none today,
but a genuine new one would be the kind of bug worth blocking on — and every other violation is
checked against a fixed per-page allowlist of the rule IDs above. A *new* violation beyond that
allowlist still fails the test, so this remains a real regression guard, not a rubber stamp; it
just doesn't demand Phase 8's whole redesign land before Phase 6 can close. See ADR-019 in
`ROADMAP.md`.

## Visual regression

Covered above under snapshot tests — visual regression *is* snapshot testing applied
specifically to what a page looks like. Worth calling out separately because of what it's
deliberately **not** used for in this project: transaction lists, dashboard numbers, anything
with real dates/amounts in it. Those change by definition (new test data every run), so
snapshotting them would fail constantly for no real reason. Visual regression here is scoped to
structurally stable pages (homepage, dashboard shell, auth screens) — see Phase 6.5.

## Mocking

A mock is a **fake stand-in for something real** — usually because the real thing is slow,
costs money, is unpredictable, or isn't safe to actually trigger in a test.

**In this repo, the philosophy is deliberately "avoid mocks where possible."** Nothing here
fakes MongoDB, bcrypt, or JWT signing — the tests use the real thing, just pointed at a
temporary/in-memory instance instead of production. The *few* places where full realism isn't
practical (Gmail SMTP, Google reCAPTCHA, the Gemini API) aren't mocked either — they're
*disabled*, by deleting their environment variables, which makes the app's own real code take
its own real "not configured" fallback path (see `docs/backend/authentication.md`, "Dev mode
without email configured"). That's a subtly different, and often better, technique than mocking:
you're still running real application code, just steering it down a branch that doesn't need a
live external service, instead of substituting a fake object standing in for one.

The one place this project *does* mock something is tiny and deliberate:
`vi.spyOn(console, "warn")` in `tests/logging.test.js`, just to capture what got logged without
actually printing it — not to fake any real behavior.

## Fixtures

A fixture is **reusable test data or setup**, written once and shared across many tests instead
of rebuilt from scratch every time.

**In this repo before Phase 6:** `tests/helpers.js`'s `signupUser()` and `uniqueEmail()` are
fixtures — every test that needs a logged-in user calls `signupUser()` rather than
re-implementing the signup HTTP call itself. Phase 6 adds a proper `tests/fixtures/` directory
with sample CSV/PDF files and transaction data, because E2E tests need actual file bytes to
upload through a real file input — something the API-level tests never needed, since they could
just send JSON directly.

## Playwright architecture (how this project's E2E tests actually run)

Playwright drives a *real* browser engine (Chromium, Firefox, or WebKit) and controls it
programmatically — clicking, typing, waiting for network requests, reading the rendered DOM —
the same browser engines real users' browsers are built on, not a simulation of one.

The tricky part specific to this project: CashCanvas's authentication is built entirely on
HttpOnly cookies (see `docs/backend/authentication.md`), and cookie behavior differs
meaningfully between same-origin and cross-origin requests. In local dev, the frontend
(`localhost:5173`, Vite) and backend (`localhost:3001`, Express) run on different ports —
different "origins" as far as a browser's cookie rules are concerned. Rather than fight that
complexity in E2E tests, this project's Playwright harness (`tests/e2e/`) runs the frontend's
**production build** and the backend **on the same origin**, using the exact same route
handlers (`api/auth.js`/`api/data.js`/`api/ai.js`) `server.js` and Vercel both use — this is
both simpler to reason about *and* more accurate, since real production also serves everything
from one origin (`cash-canvas-sigma.vercel.app`).

## Why flaky tests happen

A flaky test is one that **sometimes passes and sometimes fails with no code change in
between** — the scariest kind of test, because a failure might mean a real bug, or might mean
nothing, and you can't tell which just from the test failing.

**This project has a real, fully-diagnosed example: ADR-014.** `api/_lib/db.js` caches its
MongoDB connection on `global._mongoClientPromise` (a convenience for local dev hot-reloading).
The real Node `global` object survives across test *files* within the same worker process, even
though each file gets its own fresh module registry. When the test runner happened to reuse one
process for multiple files, a later file's database calls would silently reuse an *earlier*
file's already-shut-down database connection — producing wrong results roughly 1 time in 6 to 1
time in 10, and *never* when a single file was run in isolation (which is exactly what made it
so hard to find: "it works when I test just this file" was true and also completely misleading).

The general lesson: flaky tests are almost never "the test is bad" — they're usually a real bug
in shared state, timing, or environment setup that a deterministic test happens to expose only
sometimes. Chasing down *why* it's flaky, rather than just re-running until it passes, is what
actually finds bugs like this one.

**Phase 6 found its own example, and it's worth separating from the real bugs it also found
(below):** running all five Playwright browser projects in parallel produced one occasional
failure in the double-click login test — gone every time it was re-run in isolation with
`--workers=1`. That's the same class of finding as ADR-014: not a bug in the app or the test,
just five real browser engines competing for CPU on one machine. It's called out here
specifically so it isn't confused with the three genuine, deterministic bugs Phase 6 *did* find
(WebKit's HSTS/CSP handling, the JWT rotation collision, and the `authenticatedPage` fixture
race) — those reproduced 100% of the time in isolation, which is precisely what marked them as
real rather than environmental. Telling the two apart is the actual skill; "it failed once" is
not enough signal on its own either way.

## How CI runs tests

Every push and pull request triggers `.github/workflows/ci.yml` (see
`docs/engineering-lessons/phase-7-ci-cd.md` for the full CI/CD picture), which runs the entire
Vitest suite — freshly, from a clean `npm ci` install, with no leftover state from any previous
run — and fails the whole check if even one test fails. Phase 6 adds a Playwright step to that
same pipeline, after `npm run test:coverage` and before the production build: it installs the
browser binaries fresh (`npx playwright install --with-deps`, needed every run since CI never
keeps a runner around) and then runs `npx playwright test --grep-invert "visual regression"` —
every e2e test except the visual-snapshot ones, which need a Linux-native baseline CI doesn't
have yet (see "Visual regression" above and ADR-020). The point of running tests in CI, not just
locally, is that it removes "did you remember to run the tests before pushing" as a step anyone
can accidentally skip — the check runs regardless of what any individual person did or forgot to
do.

## Why testing saves money

Every bug this project's regression tests protect against was **found once, by a person,
spending real time investigating it** — the duplicate `AMZN` key, the OTP-logging bug, the
concurrent-signup race, the MongoDB connection flake, and now four more from Phase 6 itself:
`ForgotPasswordScreen` showing a fake "check your email" success screen on a real server error
(found by testing the actual failure path, not just the happy path), Helmet sending
HTTPS-enforcement headers over plain HTTP and silently breaking WebKit, an access-token rotation
that could mint a byte-identical "new" token within the same wall-clock second, and a test
fixture race that could report a valid, freshly-authenticated session as logged out. None of the
four were hypothetical — every one reproduced deterministically once isolated, and three of them
would affect real users (Safari/WebKit visitors, and anyone whose password-reset request failed
silently), not just the test suite. Each one, if it had shipped instead of
being caught, would have cost more to fix in production than it cost to fix in development: a
security incident (leaked OTP codes) is vastly more expensive than a failed test in CI, both in
direct cost and in trust. A regression test converts "we spent an afternoon finding and fixing
this" into "this can never happen again, checked automatically, forever, for free." That
trade — real but bounded cost now, versus unbounded and unpredictable cost later — is the entire
economic case for testing.

The same logic applies to *not* testing everything, though: `docs/security/threat-model.md`
rates risks, and this document should too. A thin wrapper function around a live Google API
(`api/_lib/recaptcha.js`, 26% covered) is a bad use of testing effort chasing higher numbers —
the actual risk there is "does Google's service respond," which no unit test can verify anyway.
Testing effort is well spent on business logic with real consequences (validation, auth,
money-adjacent data) and poorly spent chasing 100% coverage on thin integration glue.

## Examples from this repository, one more time, all in one place

| Concept | Real example in this repo |
|---|---|
| Unit test | `isValidTransactionDate("2025-02-30")` → `false` (`tests/validation.test.js`) |
| Integration test | `POST /api/auth/signup` through real Express + real bcrypt + in-memory Mongo (`tests/auth.test.js`) |
| E2E test | A Playwright browser filling in the real signup form and landing on the real dashboard (`tests/e2e/`, Phase 6) |
| Smoke test | `deploy-verify.yml` checking the homepage returns 200 after a deploy |
| Regression test | `tests/transaction-cleaner.test.js`, guarding the duplicate `AMZN` key bug forever |
| Snapshot/visual regression | Screenshot comparison of the homepage/dashboard/auth pages (Phase 6.5) |
| Accessibility test | `axe-playwright` scanning for missing `aria-*`/`alt` attributes (Phase 6.4) |
| Mocking (rare, deliberate) | `vi.spyOn(console, "warn")` in `tests/logging.test.js` |
| Fixture | `signupUser()` in `tests/helpers.js` |
| Flaky test, diagnosed | ADR-014's stale MongoDB connection cache |
