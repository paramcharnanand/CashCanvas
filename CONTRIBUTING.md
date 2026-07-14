# Contributing to CashCanvas

This document is the fast path from "cloned the repo" to "opened a PR that passes CI." For the
*why* behind major architectural decisions, see `ROADMAP.md` (Architecture Decision Records)
and `docs/backend/authentication.md` / `docs/backend/database.md` / `docs/security/threat-model.md`.

## Local setup

**Requirements:** Node 22+ (`package.json`'s `engines` field — the actual floor this codebase
needs), npm, a MongoDB connection (Atlas or local — the app needs `MONGODB_URI`; the test suite
does **not**, it spins up its own in-memory instance). CI and production both run Node 24.x
specifically (see `.github/workflows/ci.yml` and ROADMAP.md's ADR-015) for exact parity with
Vercel — using 24.x locally too is a good idea if convenient, but 22+ works fine day to day.

```bash
git clone <repo-url>
cd CashCanvas
npm ci                  # not `npm install` — see "Why npm ci" in
                         # docs/engineering-lessons/phase-7-ci-cd.md
cp .env.example .env    # fill in MONGODB_URI at minimum; everything else has a safe dev fallback
```

Everything in `.env.example` is documented inline — most integrations (Gmail SMTP for OTP
emails, Gemini for AI categorization, reCAPTCHA) are optional in development and the app
degrades gracefully without them (see `docs/backend/authentication.md`, "Dev mode without
email configured").

## Running the app

```bash
npm run dev        # Vite dev server (frontend only) — http://localhost:5173
npm run dev:api     # Express dev server (backend only) — http://localhost:3001
npm run dev:full    # both, concurrently — this is what you want most of the time
```

`server.js` is a thin bootstrap that mounts the exact same route handlers
(`api/auth.js`/`api/data.js`/`api/ai.js`) Vercel runs in production — there is no separate dev
implementation to keep in sync (see ROADMAP.md ADR-001).

## Testing

```bash
npm test              # run the full suite once (Vitest + Supertest)
npm run test:coverage # same, plus a coverage report in coverage/ (gitignored, local-only)
```

The suite never touches a real database — `tests/vitest.setup.js` spins up a fresh
`mongodb-memory-server` instance per test file. Test files run sequentially, not in parallel
(`vitest.config.js`'s `fileParallelism: false`) — see ROADMAP.md ADR-014 for why (a real,
previously-intermittent test-infrastructure bug, not a style preference).

**Every bug fix needs a regression test.** Write the test first, watch it fail against the old
code, then fix it — see any recent commit touching `api/_lib/validation.js` or
`tests/security.test.js` for the pattern this project follows.

## Linting

```bash
npm run lint
```

ESLint (`eslint.config.js`) is scoped per part of the codebase — Node/ESM rules for
`api/`/`server.js`, React rules for `src/`, both share a base ruleset. It currently reports ~45
pre-existing style warnings (unescaped JSX apostrophes, unnecessary regex escapes) that were
present when linting was first introduced — those don't fail CI, but **please don't add new
ones**, and feel free to clean up a few incidentally if you're already editing a file that has
some. Real errors (unused variables, duplicate object keys, hook-rule violations) fail the
build.

## Architecture overview

```
api/
  auth.js       ─┐
  data.js        ├─ the only 3 real Vercel Serverless Functions — everything else under
  ai.js         ─┘  api/ imports into these, none of it is independently routable
  _lib/            shared backend modules (db, jwt, sessions, cookies, csrf, validation,
                   rate limiting, logging, mailer, ...) — underscore-prefixed so Vercel's
                   builder doesn't treat each one as its own function (see ROADMAP.md's
                   ADR on this — it's what keeps deploys under the Hobby plan's 12-function cap)
server.js          local dev bootstrap — mounts api/*.js directly, never reimplements them
src/               React 18 frontend (Vite), single-page, no router library
tests/             Vitest + Supertest + mongodb-memory-server
docs/              architecture docs, threat model, release process (this file's siblings)
```

Auth is HttpOnly-cookie + CSRF-double-submit + rotating opaque refresh tokens — full detail in
`docs/backend/authentication.md`. Every mutating `api/data.js`/`api/ai.js` route is rate-limited
and centrally validated — full detail in `docs/security/threat-model.md`.

## Commit conventions

`type(scope): short, plain-language summary` — matches this repo's actual history:

```
feat(auth): add refresh token rotation
fix(vercel): exclude api/lib helper modules from serverless function detection
docs(checkpoint): record successful production deployment
refactor: consolidate API into auth/ai/data
chore: bump vite to clear npm audit finding
```

Common types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`. Scope is optional — use it
when the change is clearly localized (`auth`, `vercel`, `checkpoint`); omit it for
broader/cross-cutting changes. Write the *why* in the body when it isn't obvious from the
diff — see `git log` for real examples throughout this project.

## Branch naming

`type/short-description`, matching the commit-type prefixes above:

```
feat/device-management-ui
fix/rate-limit-off-by-one
docs/release-process
chore/dependabot-config
```

## Pull request checklist

Before opening a PR:

- [ ] `npm run lint` passes (no new errors; pre-existing warnings are fine)
- [ ] `npm test` passes
- [ ] `npm run build` succeeds
- [ ] New behavior has a test; bug fixes have a regression test that fails against the old code
- [ ] No secrets, `.env` files, or real credentials in the diff
- [ ] Docs updated if you changed behavior `docs/backend/`, `docs/security/threat-model.md`, or
      `ROADMAP.md` document — a stale doc is worse than no doc
- [ ] If the change is a deliberate architectural decision (not just an implementation detail),
      add an ADR entry to `ROADMAP.md` — see the existing ADRs there for the expected format
      (Context / Decision / Rationale / Status)

CI (`.github/workflows/ci.yml`) runs lint, tests with coverage, and a production build on every
push and PR — all three must pass before merge. See `docs/github-branch-protection.md` for the
repository's recommended (not yet enforced — that requires a GitHub settings change outside
this repo's own files) branch protection rules.
