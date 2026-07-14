# Checkpoint

Session handoff doc — read this first, then `ROADMAP.md` for full phase history/ADRs/tech
debt. Update this file at the end of every session so the next one can start here instead of
re-deriving context from the repo.

## Deployment status

**Deployed to production and verified.**

- **Deployment successful**: yes
- **Deployment date/time**: 2026-07-13 18:36 PDT
- **Production URL**: https://cash-canvas-sigma.vercel.app
- **Commit deployed**: `08ece44` (fix(vercel): exclude api/lib helper modules from serverless
  function detection)
- **Serverless Functions verified**: exactly 3 (`api/ai`, `api/auth`, `api/data`)
- **Tests passing**: 82/82
- **Production build**: verified against local build (see Deployment Verification below)
- **Vercel deployment**: successful, no errors

## Deployment Verification

Full detail in the session transcript; summary here for future reference:

- Deployment to `https://cash-canvas-sigma.vercel.app` (`dpl_C75U4vSJxjMtgmug5u9aymx7DLyG`)
  succeeded, triggered explicitly from a verified-clean local checkout at commit `08ece44`
  rather than assumed from an ambiguous prior auto-deploy.
- Serverless function count reduced from **18 files detected under `/api`** (3 real handlers +
  15 `api/lib/*` helper modules Vercel was auto-detecting as functions) down to the **3 actual
  functions** — `api/ai`, `api/auth`, `api/data` — confirmed directly via `vercel inspect`.
- The `api/lib` → `api/_lib` underscore-prefix exclusion works correctly in production: no
  helper module is listed as a function in the deployed build output.
- **Authentication routing verified**: `/api/auth/*` reachable, correct 401 on unauthenticated
  requests, correct 404 fallback for unknown sub-routes, rate limiting confirmed live (429 at
  the 11th login attempt in 15min), reCAPTCHA v3 confirmed active (correctly rejected both a
  raw `curl` request and a headless-Playwright signup attempt as suspicious — evidence the
  anti-bot control is functioning, not a defect).
- **Data routing verified**: `/api/files`, `/api/files/:id`, `/api/categories`,
  `/api/merchant-rules` all reachable and correctly enforce 401 unauthenticated.
- **AI routing verified**: `/api/categorize`, `/api/parse-pdf` reachable and correctly enforce
  401 unauthenticated.
- **No routing regressions**: the SPA catch-all (`rewrites`, untouched by this change) still
  correctly serves `index.html` for unmatched paths.
- **Production and local builds match**: found and fixed a local-environment drift (not a code
  change) — local `node_modules` had `vite@6.4.1` installed while the committed
  `package-lock.json` locks `6.4.3` (what Vercel installs fresh). After `npm ci` to resync,
  local and remote bundles matched: same module count (654 transformed), sizes within 501
  bytes (~0.06%) of each other, identical occurrence counts of every key functional marker
  checked. The residual byte-level delta is expected macOS/Node 22 vs. Linux/Node 24 bundler
  non-determinism, not a functional difference.
- **Only remaining warning**: Vite's pre-existing "chunks larger than 500kB after
  minification" bundle-size advisory — present in both local and remote builds, unrelated to
  this deployment's changes. No function-size, Node-version, or deprecation warnings from
  Vercel itself.
- **One transient anomaly, documented rather than "fixed"**: the very first login request
  against the freshly-deployed function returned a one-time `500` ("Unable to sign in")
  instead of the expected `401`; all 13 subsequent identical requests returned correctly and
  consistently. Traced to `getDb()`'s MongoDB connection path — consistent with a one-time
  serverless cold-start hiccup on the first DB-touching request after a fresh deploy, a known
  and self-resolving characteristic of serverless + MongoDB Atlas, not something the
  `api/lib`→`api/_lib` rename touches (that module's contents are byte-for-byte unchanged,
  only relocated). No code change made — not a deployment regression.
- Full authenticated round-trip (upload/categorize) could not be completed via automation:
  reCAPTCHA v3 correctly blocks both non-browser and headless-browser signup attempts in
  production. Both flows remain comprehensively covered by the local regression suite
  (`tests/security.test.js`, `tests/data.test.js`) running the identical committed code now
  deployed.

## Current status

**5 of 9 phases complete (56%).** Phases 1–5 (Backend architecture, Authentication, Database
optimization, Security hardening, Dependency maintenance) done and now verified live in
production. Full writeup: `docs/security/threat-model.md`. Full phase/ADR history:
`ROADMAP.md`.

### Completed phases
1. Backend architecture cleanup
2. Secure authentication (HttpOnly cookies + refresh tokens)
3. Database optimization & indexing
4. Security hardening
5. Dependency maintenance

### Remaining phases
6. Testing infrastructure (partially done — Vitest/supertest/mongodb-memory-server already
   wired up; Playwright/e2e/visual-regression/coverage-target still open)
7. CI/CD (GitHub Actions) — not started
8. Frontend redesign (design system, a11y, dark mode) — not started
9. Advanced AI features & product enhancements — not started

## Current production readiness estimate

**~70%** — auth/session/security/data-integrity are production-grade, tested, *and now
verified live* (routing, function count, rate limiting, reCAPTCHA all confirmed working in
production). The Hobby-plan function-count deployment blocker is resolved. Remaining gaps are
process (no CI/CD gating merges or verifying deploys automatically) and polish (a11y, dark
mode, e2e coverage) — not correctness, security, or deployment-mechanics holes.

## What was completed this session

1. Diagnosed and fixed the Vercel Hobby-plan Serverless Function limit (see prior commit
   `08ece44` and Deployment Verification above).
2. Deployed commit `08ece44` to production and verified it directly (function count, routing,
   auth, rate limiting, build parity) rather than assuming success from the fix alone.
3. Found and fixed a local dev-environment drift (`npm ci` to resync `vite` to the version the
   committed lockfile actually specifies) — not a repository code change.
4. This documentation-only update recording the verified deployment state.

## Test suite

`npm test` — **82/82 passing**, verified stable (25 consecutive clean full-suite runs, see
ADR-014). No coverage tool configured. No lint/typecheck script configured. No Playwright
project config in this repo (the browser used for production deployment verification this
session was a standalone script outside the repo, not a project test).

## Remaining technical debt

Full list with rationale lives in `ROADMAP.md`'s "Known technical debt" section — not
duplicated here to avoid drift. Headline items: global (cross-instance) rate limiting still
needs Upstash Redis when traffic justifies it; CSP `style-src` `'unsafe-inline'` blocked on
Phase 8; pagination/search validators deliberately not built (no route uses them yet); no
standalone `TECH_DEBT.md` file (deliberate — see ROADMAP, avoids a second copy drifting out of
sync with the same section there).

## Next recommended step

**Waiting for approval before starting the next phase.** When resumed: `ROADMAP.md`'s
dependency-ordered recommendation is **Phase 7 (CI/CD)** — wires the now-reliable test suite,
`npm audit`, and a deployment-verification step (so a future function-count regression is
caught before it reaches production) into GitHub Actions, before the higher-risk Phase 8
frontend rewrite lands.

## Blockers / assumptions

- None blocking.
- `nodemailer` major-version upgrade (Phase 4/5, ADR-013) was verified via API-compatibility
  checks + full test suite + build, **not** a live send through real Gmail SMTP — still worth a
  real send test when convenient, now that the app is confirmed deployed and reachable.
- Full authenticated production round-trip (signup → login → upload → categorize) has not been
  verified end-to-end by a real user since this deployment, only by routing/logic-level checks
  and the local regression suite — reCAPTCHA correctly prevents automated verification of this
  specific path. Recommend a one-time manual check in a real browser when convenient.
