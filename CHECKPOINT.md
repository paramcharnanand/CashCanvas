# Checkpoint

Session handoff doc — read this first, then `ROADMAP.md` for full phase history/ADRs/tech
debt. Update this file at the end of every session so the next one can start here instead of
re-deriving context from the repo.

## Release status

**Committed and pushed to `origin/main`.**

- **Commit hash**: `a8040a33c9aad276ff891f8cca1528b87507c226`
- **Push date**: 2026-07-13 18:17 PDT
- **Repository state**: working tree clean, local `main` == `origin/main`, no divergence

## Current status

**5 of 9 phases complete (56%).** Phases 1–5 (Backend architecture, Authentication, Database
optimization, Security hardening, Dependency maintenance) done. Full writeup:
`docs/security/threat-model.md`. Full phase/ADR history: `ROADMAP.md`.

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

## What was completed this session (release checkpoint)

This session was a verification/release pass on top of the prior session's Phase 4/5 work, not
new feature work:

1. **Found and fixed a pre-existing test-infrastructure bug** (ADR-014): `api/lib/db.js`
   caches its MongoClient on `global._mongoClientPromise` in non-production mode; since
   `tests/vitest.setup.js` sets `NODE_ENV="test"`, test files could silently reuse an *earlier*
   file's already-stopped in-memory MongoDB connection when Vitest reused a worker process
   across files — causing rare (~1-in-6 to 1-in-10), non-reproducible-in-isolation cross-test
   corruption. Root-caused via 20+ isolated single-file runs (always clean) vs. repeated
   full-suite runs until the specific failure was captured. Fixed by resetting/closing the
   cached client in `vitest.setup.js` before each file and in an `afterAll` teardown; also set
   `fileParallelism: false` in `vitest.config.js` as defense-in-depth. Verified stable across
   **25 consecutive full-suite runs, zero failures**.
2. Ran the full release-checklist: repo-state audit (no secrets/build artifacts/temp files),
   `npm install`, full test suite, production build, dependency/doc verification.
3. Added ADR-014 to `ROADMAP.md`.
4. Single atomic commit created and pushed to `origin/main` (see hash above).

## Test suite

`npm test` — **82/82 passing**, verified stable (25 consecutive clean full-suite runs after
the ADR-014 fix, vs. intermittent pre-fix). No coverage tool configured. No lint/typecheck
script configured. No Playwright config present (Phase 6 gap, tracked above).

## Files changed this session

`tests/vitest.setup.js` (MongoClient cache reset + teardown), `vitest.config.js`
(`fileParallelism: false`), `ROADMAP.md` (ADR-014 + this checkpoint's context). Everything
else committed this session was carried over from the prior Phase 4/5 session (see git log for
the full list — 40 files in commit `a8040a3`).

## Remaining technical debt

Full list with rationale lives in `ROADMAP.md`'s "Known technical debt" section — not
duplicated here to avoid drift. Headline items: global (cross-instance) rate limiting still
needs Upstash Redis when traffic justifies it; CSP `style-src` `'unsafe-inline'` blocked on
Phase 8; pagination/search validators deliberately not built (no route uses them yet); no
standalone `TECH_DEBT.md` file (deliberate — see ROADMAP, avoids a second copy drifting out of
sync with the same section there).

## Next recommended step

**Waiting for approval before starting the next phase**, per this session's explicit
instruction. When resumed: `ROADMAP.md`'s dependency-ordered recommendation is **Phase 7
(CI/CD)** — wires the now-reliable test suite and `npm audit` into GitHub Actions so Phases
4–6's work is enforced automatically going forward, before the higher-risk Phase 8 frontend
rewrite lands.

## Blockers / assumptions

- None blocking.
- `nodemailer` major-version upgrade (Phase 4/5, ADR-013) was verified via API-compatibility
  checks + full test suite + build, **not** a live send through real Gmail SMTP (no
  credentials in this environment) — low risk given the unchanged core API, but worth a real
  send test before the next production deploy if that hasn't happened yet.
