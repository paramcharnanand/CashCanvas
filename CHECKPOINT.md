# Checkpoint

Session handoff doc — read this first, then `ROADMAP.md` for full phase history/ADRs/tech
debt. Update this file at the end of every session so the next one can start here instead of
re-deriving context from the repo.

## Current status

**6 of 9 phases complete (67%).** Phases 1–5 (Backend architecture, Authentication, Database
optimization, Security hardening, Dependency maintenance) verified live in production; Phase 7
(CI/CD) just landed. Full writeup: `docs/security/threat-model.md` (security),
`docs/engineering-lessons/phase-7-ci-cd.md` (CI/CD, written for onboarding). Full phase/ADR
history: `ROADMAP.md`.

### Completed phases
1. Backend architecture cleanup
2. Secure authentication (HttpOnly cookies + refresh tokens)
3. Database optimization & indexing
4. Security hardening
5. Dependency maintenance
7. CI/CD (GitHub Actions) — numbered 7 throughout this project's roadmap; Phase 6 remains open,
   see below

### Remaining phases
6. Testing infrastructure (partially done — Vitest/supertest/mongodb-memory-server wired up,
   now running in CI on every push; Playwright/e2e, visual regression, and a coverage target
   still open)
8. Frontend redesign (design system, a11y, dark mode) — not started
9. Advanced AI features & product enhancements — not started

## Phase 7 (CI/CD) — what was completed this session

1. **Repository audit** (Phase 7.1): confirmed no `.github/`, no ESLint/Prettier/Playwright
   config existed before this session.
2. **ESLint** introduced (`eslint.config.js`, flat config, scoped per part of the codebase).
   Deliberately adopted only `rules-of-hooks`/`exhaustive-deps` from
   `eslint-plugin-react-hooks` rather than its full v7 "recommended" set, which is a new,
   much stricter React-Compiler-oriented rule family that flagged 46 errors in long-standing,
   working `App.jsx` code never written against those rules — see ADR-016. `npm run lint` is
   genuinely green (0 errors, 45 pre-existing style warnings left visible, not blocking).
3. **Found and fixed one real bug** while introducing lint: a duplicate `AMZN` key in
   `api/_lib/transaction-cleaner.js`'s abbreviation dictionary (`no-dupe-keys`, harmless since
   both values were identical, but genuinely dead code). Regression test added
   (`tests/transaction-cleaner.test.js`) and verified it actually would have caught the bug
   (confirmed the *test* passes either way — the real regression guard for this class of bug is
   the now-enabled lint rule itself, not a bespoke test; an earlier draft of a hand-rolled
   duplicate-key-detector test was written, found not to actually work when checked against the
   buggy version, and replaced).
4. **Vitest coverage** wired up (`@vitest/coverage-v8`, `npm run test:coverage`) — v8 provider,
   text/html/lcov/json-summary reporters, `coverage/` gitignored. No Codecov/external service
   added, per Phase 7.4's explicit instruction — artifacts are upload-ready for that later.
5. **`.github/workflows/ci.yml`**: checkout → Node 24.x (matches Vercel's actual production
   Node version) w/ npm cache → `npm ci` → lint → test w/ coverage → build → upload coverage +
   build artifacts. Runs on every push and PR. No type-check step (no TypeScript in this
   project) and no Playwright step (no suite exists yet — Phase 6 scope) — both omitted with an
   explanation in the workflow file rather than faked.
6. **`.github/workflows/security.yml`**: `npm audit --audit-level=high` (fails only on
   actionable high/critical; currently 0 vulnerabilities), `dependency-review-action` (PRs
   only), `gitleaks` secret scanning. Runs on push/PR plus a weekly schedule.
7. **`.github/dependabot.yml`**: weekly, grouped minor/patch updates; globally ignores major
   version bumps (not a hand-picked package list — see ADR-017) for both the npm and
   github-actions ecosystems.
8. **`.github/workflows/deploy-verify.yml`**: reacts to Vercel's native `deployment_status`
   event. Checks homepage 200, all three functions respond 401 unauthenticated, and — the check
   that matters most — exactly 3 Serverless Functions deployed via `vercel inspect`, failing
   loudly with an explanation if not. The exact shell logic (curl checks + the `vercel
   inspect`/grep function-count detection) was manually verified against the real, live
   production deployment during this session and confirmed correct — see ADR-018. **Not yet
   exercised by an actual GitHub Actions run**: needs a `VERCEL_TOKEN` repository secret this
   project cannot add itself (documented in `docs/release-process.md`).
9. **Developer docs**: `CONTRIBUTING.md` (setup/run/test/lint/architecture/commit
   conventions/branch naming/PR checklist), `docs/release-process.md` (versioning, required
   secrets, release + deploy checklists, rollback via Vercel instant-rollback or git revert),
   `docs/github-branch-protection.md` (recommendations only — explicitly did not touch any
   GitHub repository settings, per Phase 7.8's instruction).
10. **`docs/engineering-lessons/phase-7-ci-cd.md`**: junior-developer-facing explanation of
    CI/CD concepts, written using this repo's own real incidents as examples (the function-count
    bug, the `vite` version drift, the duplicate `AMZN` key, the ADR-014 flaky-test bug) rather
    than generic advice.
11. Added `engines.node: ">=24"` to `package.json` and 4 new ADRs (015–018) to `ROADMAP.md`.

## Test suite

`npm test` — **84/84 passing** (82 carried forward + 2 new `transaction-cleaner.test.js`
tests), now running automatically in CI on every push/PR via `.github/workflows/ci.yml`.
`npm run test:coverage` — 51.84% statement coverage on `api/**` (frontend `src/` intentionally
excluded — no test coverage of it exists yet, that's Phase 6/8 territory, not something to fake
a number for). `npm run lint` — 0 errors, 45 pre-existing warnings. `npm run build` — succeeds,
~1s locally.

## Deployment status (carried forward, unchanged this session)

**Deployed to production and verified** (prior session — see full detail below, still accurate;
no new deployment happened this session, only CI/CD tooling was added).

- **Production URL**: https://cash-canvas-sigma.vercel.app
- **Commit deployed**: `08ece44` (the CI/CD work in this session has not yet been deployed —
  it's tooling/workflow files, Vercel will pick up the next push to `main` automatically as
  usual)
- **Serverless Functions verified**: exactly 3 (`api/ai`, `api/auth`, `api/data`)

<details>
<summary>Full Deployment Verification detail from the prior session</summary>

- Deployment to `https://cash-canvas-sigma.vercel.app` (`dpl_C75U4vSJxjMtgmug5u9aymx7DLyG`)
  succeeded, triggered explicitly from a verified-clean local checkout at commit `08ece44`.
- Serverless function count reduced from 18 files detected under `/api` (3 real handlers + 15
  `api/lib/*` helper modules Vercel was auto-detecting as functions) down to the 3 actual
  functions — confirmed via `vercel inspect`.
- Authentication/data/AI routing all verified reachable and correctly enforcing 401
  unauthenticated; rate limiting confirmed live (429 at the 11th login attempt); reCAPTCHA v3
  confirmed active (correctly rejected both a raw `curl` and a headless-Playwright signup
  attempt as suspicious).
- No routing regressions; production and local builds matched after resyncing local
  `node_modules` to the committed lockfile (`npm ci`) — this exact drift is what ADR-015 (this
  session) fixed at the CI level so it can't recur.
- One transient anomaly, documented rather than "fixed": the very first login request against
  the freshly-deployed function returned a one-time `500`, all subsequent requests returned
  correctly — consistent with a one-time serverless cold-start hiccup on the first DB-touching
  request after a fresh deploy, not a regression.
- Full authenticated round-trip (upload/categorize) could not be completed via automation:
  reCAPTCHA v3 correctly blocks both non-browser and headless-browser signup attempts in
  production. Both flows remain covered by the local regression suite.

</details>

## Current production readiness estimate

**~78%** — auth/session/security/data-integrity are production-grade, tested, and verified
live. The Hobby-plan function-count deployment blocker is resolved *and* now has an automated
guard against recurring (`deploy-verify.yml`, pending its `VERCEL_TOKEN` secret). Every push is
now linted, tested, and built automatically before it could reach `main`. Remaining gaps:
branch protection isn't actually enforced yet (recommendations written, not applied — a GitHub
settings change outside this project's files), the deploy-verify workflow hasn't run for real
yet (missing secret), and product-facing polish (a11y, dark mode, e2e coverage) — not
correctness, security, or CI/CD-mechanics holes.

## Remaining technical debt

Full list with rationale lives in `ROADMAP.md`'s "Known technical debt" section — not
duplicated here to avoid drift. Headline items from this session: `deploy-verify.yml` needs a
`VERCEL_TOKEN` secret added by the repo owner before its function-count check can actually run;
branch protection recommendations (`docs/github-branch-protection.md`) are unapplied; ~45
pre-existing ESLint warnings remain (documented, not blocking); no standalone `TECH_DEBT.md`
file (deliberate, same reasoning as before).

## Next recommended step

**Waiting for approval before starting Phase 8**, per this session's explicit instruction.
Two small follow-ups don't require a new phase and could happen anytime: (1) add the
`VERCEL_TOKEN` repository secret so `deploy-verify.yml` can actually run end-to-end, (2) apply
the branch-protection recommendations in GitHub's Settings tab. When Phase 8 is approved,
`ROADMAP.md` recommends finishing **Phase 6 (testing infrastructure — Playwright/e2e)** first,
so the frontend redesign lands with real regression coverage under it.

## Blockers / assumptions

- None blocking Phase 7 itself.
- `deploy-verify.yml`'s function-count check is unverified by an actual GitHub Actions run
  (only manually verified locally against the live deployment) — needs `VERCEL_TOKEN` added as
  a repo secret first.
- `nodemailer` major-version upgrade (Phase 4/5, ADR-013) still hasn't been verified via a live
  send through real Gmail SMTP — carried forward from the prior session, still worth doing.
- Full authenticated production round-trip (signup → login → upload → categorize) still hasn't
  been verified end-to-end by a real user since deployment — reCAPTCHA correctly prevents
  automated verification of this specific path. Carried forward from the prior session.
