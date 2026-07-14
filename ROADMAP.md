# CashCanvas Engineering Roadmap

Living document, updated at the end of every phase. Tracks what's done, what's next, what
technical debt exists, and *why* past decisions were made — so re-prioritizing later doesn't
require re-deriving context that already existed once.

## Progress

**5 of 9 phases complete (56%).**

| # | Phase | Status | Docs |
|---|---|---|---|
| 1 | Backend architecture cleanup | ✅ Done | `docs/backend/authentication.md` |
| 2 | Secure authentication (HttpOnly cookies + refresh tokens) | ✅ Done | `docs/backend/authentication.md` |
| 3 | Database optimization & indexing | ✅ Done | `docs/backend/database.md` |
| 4 | Security hardening | ✅ Done | `docs/security/threat-model.md` |
| 5 | Dependency maintenance (`npm audit`, upgrades) | ✅ Done | `docs/security/threat-model.md` (Dependency posture) |
| 6 | Testing infrastructure | 🔄 Partially done already — see note below | — |
| 7 | CI/CD (GitHub Actions) | ⬜ Not started | — |
| 8 | Frontend redesign (design system, shadcn/ui, Tailwind, Framer Motion, a11y) | ⬜ Not started | — |
| 9 | Advanced AI features & product enhancements | ⬜ Not started | — |

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

- **Phase 6 (Testing infrastructure)**: Vitest + supertest + `mongodb-memory-server` are
  already wired up and running 82 passing tests (Phase 2's auth suite, Phase 3's data suite,
  and Phase 4's validation/security/logging/logger suites). What's actually left: Playwright
  for true end-to-end/browser tests, visual regression, and a coverage target — the harness and
  CI-safety pattern (never touch the real Atlas cluster) are already established and should be
  reused, not rebuilt.

Recommended order for what's left, driven by dependency: **7 (CI/CD, so Phases 4/5's work is
enforced automatically going forward) → 6 (finish testing) → 8 (frontend) → 9 (AI features)**.
Frontend redesign is deliberately last — no value in polishing UI on top of a backend whose
test/CI story isn't finished, and CI/CD should exist *before* the biggest, highest-risk diff
(the frontend rewrite) lands.

## Architecture Decision Records

Newest first.

### ADR-014 — Reset `global._mongoClientPromise` per test file; run test files sequentially
**Context**: discovered during the Phase 4 release checkpoint, not something this phase's
feature work introduced. `api/lib/db.js` caches its `MongoClient` on `global._mongoClientPromise`
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
reaches a spreadsheet. **Decision**: sanitize (`sanitizeCsvField()` in `api/lib/validation.js`)
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
(`api/lib/validation.js` + route handlers) plus the new unique indexes, not database-level
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

From `docs/security/threat-model.md` (Phase 4):
- Pagination and search validators were explicitly requested by the Phase 4 spec but not
  built: no route in the app currently accepts a `page`/`pageSize`/`search` parameter
  (`GET /api/files` uses a fixed `.limit(20)`, no search endpoint exists at all) — adding
  validators with no caller would be dead code. Build them when a real paginated/searchable
  endpoint is built, not speculatively ahead of it.
- `api/lib/logger.js`'s structured production JSON output isn't shipped anywhere yet — it
  writes to stdout, same as before, just now parseable. Wiring a real log drain/aggregator is
  future work, not blocking.

From the original Phase 1 audit:
- Zero accessibility attributes (`aria-*`, `alt=`) across the frontend, no dark mode — scoped
  to Phase 8.
- ~~`npm audit`: 2 high-severity runtime deps (`lodash`, `nodemailer`) plus several
  devDependency-only vulnerabilities in the Vite toolchain~~ — **resolved in Phase 4**:
  `npm audit` is now clean (0 vulnerabilities). See ADR-013 for the `nodemailer` major-bump
  rationale.
