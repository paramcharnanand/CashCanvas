# Threat Model

Phase 4 deliverable. This document is the single place that ties together the security
posture built across Phases 2–4 — it doesn't re-derive anything already documented in
`docs/backend/authentication.md` (auth/session/CSRF threat table) or `docs/backend/database.md`
(data-integrity, index-backed constraints); it references those and adds what's new this
phase: endpoint rate limiting, centralized input validation, upload/CSV hardening, logging
hygiene, and dependency posture.

## Assets

What an attacker would actually want, ranked by what a compromise costs the user:

| Asset | Where it lives | Why it matters |
|---|---|---|
| Password hashes | `users.passwordHash` (bcrypt, cost 12) | Account takeover if cracked; also credential-stuffing fuel against other sites if a user reused the password |
| Session / refresh tokens | HttpOnly `cc_at`/`cc_rt` cookies; `sessions.refreshTokenHash` (SHA-256) | Full account takeover without needing the password at all |
| Financial transaction data | `uploaded_files.transactions[]` (embedded) | The core product data — bank/credit-card statements, amounts, merchants; sensitive personal financial history |
| OTP codes / password-reset tokens | Ephemeral, on `users`/`pending_signups` | Short-lived account-takeover keys; 10min–1hr windows |
| Email addresses | `users.email` | PII; also the account identifier, so leaking which emails have accounts enables targeted phishing |
| Gemini API key / Gmail credentials | Server env vars only, never sent to client | Compromise = attacker can run up API/SMTP costs or send email as CashCanvas |

## Threats and mitigations

### Authentication & session (Phase 2 — see `authentication.md` for full detail)

| Threat | Mitigation |
|---|---|
| XSS reads the session token | HttpOnly cookies — inaccessible to any page JS |
| Stolen refresh token replayed after rotation | Atomic compare-and-swap rotation; reuse rejected |
| CSRF | `SameSite=Lax` + double-submit `X-CSRF-Token` header |
| Compromised DB dump | Only bcrypt hash + SHA-256 token hash stored, never raw |
| Credential stuffing / brute force | Per-IP rate limits + account lockout (5 failed → 15min) |
| Clickjacking | `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` |

### Endpoint abuse (Phase 4, new this phase)

Before this phase, `api/data.js` (all of `/api/files`, `/api/categories`, `/api/merchant-rules`)
and `/api/categorize` had **no rate limit at all** — flagged as a known gap in
`authentication.md` since Phase 1. Fixed in `api/data.js` / `api/ai.js`:

| Threat | Mitigation |
|---|---|
| Scripted account hammers the DB with reads/writes | Every route in `api/data.js` now calls `checkRateLimit()`, keyed per-user (not per-IP — these are all authenticated, CSRF-protected routes, so the threat is a compromised/scripted *account*, not anonymous traffic). Limits scaled to realistic worst-case legitimate use — see inline rationale comments at each call site in `api/data.js` |
| Runaway spend against the paid Gemini API via `/api/categorize` | 150 req/15min per user+IP — sized to the UI's own worst case (a 10,000-transaction statement auto-batches into ~100 calls of 100 transactions each on first load), with headroom, while still bounding worst-case per-user API spend |
| Same, via `/api/parse-pdf` (pre-existing) | 10 req/hour per user+IP — unchanged this phase, already covered |

### Malicious / malformed input (Phase 4, new this phase)

Before this phase, `api/data.js` accepted `fileName`, `statementType`, and the entire
`transactions[]` array with almost no server-side validation beyond "is it an array" and
"under 10,000 entries" — everything else (date format, amount type/bounds, string lengths)
relied entirely on the client-side CSV/PDF parser in `App.jsx` never sending anything bad. That
assumption doesn't hold against a client that talks to the API directly. `api/_lib/validation.js`
now centralizes every check, used by both `api/data.js` and `api/ai.js`:

| Threat | Mitigation |
|---|---|
| Malformed transaction (bad date, non-finite/huge amount, oversized description) reaching the DB or the categorizer | `validateTransactionsArray()` rejects the whole upload on the first invalid entry — date must be a real calendar date (`YYYY-MM-DD`, round-tripped through `Date` to reject e.g. `2025-02-30`), amount must be a finite number within ±$1B, description 1–500 chars |
| Oversized upload (resource exhaustion) | `MAX_TRANSACTIONS_PER_UPLOAD` (10,000, pre-existing) now enforced centrally; `fileName` capped at 255 chars; `pdfBase64` capped at ~9.5MB (pre-existing) |
| Garbage/unexpected `statementType` | Restricted to the known enum (`unknown`/`bank`/`credit_card`) |
| **CSV/formula injection** — a transaction description like `=cmd\|'/c calc'!A1` or `=HYPERLINK(...)`, persisted verbatim and later re-exported via the app's own CSV export (`downloadCsv` in `App.jsx`), executing as a formula when the exported file is opened in Excel/Sheets | `sanitizeCsvField()` prefixes any string starting with `=`, `+`, `-`, `@`, tab, or CR with a single quote before it's ever persisted (category names, merchant names, and transaction descriptions all pass through it). Excel/Sheets treat a leading `'` as "force text" and strip it on display — legitimate values round-trip unchanged, payloads are defused at the point of entry, not just at export |
| **Duplicate upload** — re-uploading the same statement (accidental double-click, or scripted spam) silently creating N copies of the same data | SHA-256 hash of the sanitized transaction set, stored as `uploaded_files.contentHash`; a unique `(userId, contentHash)` index (sparse, so pre-existing documents without the field are unaffected) rejects a repeat upload with `409`, checked at both the application level and the DB level (race-safe, same pattern as the existing category-duplicate check) |
| **PDF renamed as CSV / MIME-type confusion** at `/api/parse-pdf` — arbitrary bytes under a `.pdf`-labeled field reaching the paid Gemini API | The first bytes of the decoded base64 payload are checked against the `%PDF` magic number before any Gemini call; a mismatch is rejected with `400` regardless of what the client claims the file is |
| Malformed CSV / invalid encoding / unexpected MIME type in the *raw uploaded file* | **Architectural note, not a gap**: CSV parsing (`Papa.parse`) happens entirely client-side in `App.jsx` — the raw CSV file's bytes never reach the server at all, only the already-parsed `transactions[]` JSON array does (see ADR below). So server-side hardening for this class of threat is exactly the transaction-array validation above; there is no raw-CSV code path on the server to separately harden. Client-side validation exists for UX (clear error messages) but the transaction-array validation is what actually protects the server, consistent with "server-side validation first" |
| Index/response desync in `/api/categorize` from filtering invalid entries | Considered and avoided: the client maps `results[].idx` back to positions in the array *it* sent. An earlier draft of the validation fix filtered invalid transactions out of the batch before iterating, which would have shifted every later `idx` and silently mis-mapped categorization results to the wrong transaction. Fixed by validating inline inside the existing positional `forEach`, skipping (not compacting) invalid entries |

### Data confidentiality & integrity (Phases 2–3, referenced)

Covered in full in `authentication.md` (session/cookie model) and `database.md` (unique
indexes backing email/category/merchant uniqueness, no `$jsonSchema` validation since there's
exactly one trusted writer — see ADR-008). Nothing new this phase beyond the input-validation
work above, which is the application-layer half of that same data-integrity story.

### Logging (Phase 4, new this phase)

Audited every `console.*` call site in `api/` and `server.js`. Finding: `api/_lib/mailer.js`'s
"email not configured" fallback branches logged the raw OTP code and password-reset token to
stdout. In practice this branch is unreachable in normal operation — every call site
(`api/auth.js`) already checks `isEmailVerificationEnabled()` before calling into the mailer,
so `createTransporter()` never returns `null` when these functions are actually invoked — but
an unreachable secret-logging landmine is still a landmine for the next call site that forgets
the guard. Fixed: those branches now log only the recipient email, never the secret.

Also introduced `api/_lib/logger.js` (structured logging, used by every route/lib module that
previously called `console.error`/`console.warn` directly): development emits the same
human-readable `[tag] message` lines routes always had; production emits single-line JSON
(`{level, tag, message, ...meta, time}`), parseable by any log aggregator, with `Error`
instances reduced to `.message` rather than a full stack dump. `server.js`'s one-time
"API server → ..." boot banner is intentionally left as plain `console.log` — it's a dev-only
process that never runs in production and carries no sensitive data.

| Threat | Mitigation |
|---|---|
| Secret (OTP, reset token, password, session token) written to logs | Every mailer fallback branch fixed to log only non-secret context (recipient email). `sanitizeCsvField`/validation errors logged via `logger.error` never include raw request bodies. No route logs `req.body`, `req.headers.cookie`, or `req.headers['x-csrf-token']` anywhere in the codebase (verified by the same audit) |
| Inconsistent/unparseable logs across dev and prod | `api/_lib/logger.js` — JSON in production, readable text in development, checked at call time so `NODE_ENV` set by the runtime (Vercel) is always respected |

### Dependency posture (Phase 4, new this phase)

`npm audit` before this phase: 7 vulnerabilities (1 critical — `shell-quote`; 4 high — `lodash`,
`nodemailer`, `picomatch`, `vite`; 1 moderate — `postcss`; 1 low — `@babel/core`), all in
devDependency-only build tooling (`vite`/`vitest` transitive deps) except `lodash` and
`nodemailer`, both direct runtime dependencies.

- `npm audit fix` (no `--force`) resolved 6 of 7 without any breaking change — `shell-quote`,
  `lodash`, `picomatch`, `postcss`, `vite`, `@babel/core` all had non-major fixes available.
- `nodemailer` required a major bump (6.10.1 → 9.0.3, `isSemVerMajor: true`). Evaluated
  individually rather than blanket-applied: this app's usage is exactly two stable, unchanged
  core APIs (`createTransport({service, auth})` and `transporter.sendMail({from,to,subject,html,text})`)
  that have been stable since nodemailer's early versions — the major-version churn is in
  transports/defaults this app never touches (SES, OAuth2 token handling, direct transport).
  Verified: `npm run build`, the full test suite, and a live `createTransport()` call all pass
  post-upgrade with zero code changes required.
- Result: **0 vulnerabilities** (`npm audit` clean). All 12 direct dependencies confirmed
  actually imported somewhere in the codebase — none unused, nothing removed.

**Accepted-risk exceptions (this phase):** the Security workflow's `npm
audit` step runs `scripts/check-audit.js` instead of gating purely on
npm's own `--audit-level` exit code, so one specific, already-reviewed
advisory can be carved out without silencing the rest of the report. As of
this writing the only exception is `GHSA-qwww-vcr4-c8h2` (react-router RSC
CSRF bypass, ADR-028 in ROADMAP.md — this app never uses RSC mode, and the
only available fix is a breaking downgrade). Every other high/critical
finding still fails CI, including a *new* advisory against react-router
with a different GHSA ID — the allowlist in `scripts/check-audit.js`'s
`ACCEPTED_RISKS` map is keyed by exact advisory ID, never by package name.

- **To add an exception:** get the risk formally reviewed and documented
  as an ADR in ROADMAP.md first, then add an `ACCEPTED_RISKS` entry keyed
  by its GHSA ID in `scripts/check-audit.js`.
- **To remove one:** run `npm audit` (or `npm audit fix` without
  `--force`) to check whether a non-breaking fix now exists; if so, apply
  it and delete the corresponding `ACCEPTED_RISKS` entry.

## Remaining risks (accepted, not fixed this phase)

Carried forward from `authentication.md` / `database.md`, not re-litigated here — see those
docs for full rationale on each:

| Risk | Rating | Why accepted |
|---|---|---|
| Rate limiting is per-instance (in-memory), not global across Vercel serverless instances | Medium | Correct for current traffic; needs Upstash Redis once real abuse patterns justify the operational cost of a shared store |
| No refresh-token "family" reuse detection (only the reused token itself is rejected, not the whole session lineage) | Low | Simpler design rejects reuse just as reliably for the single-session case; full lineage revocation is marginal benefit at current threat level (ADR-005) |
| CSP `style-src` requires `'unsafe-inline'` | Low | Frontend is 300+ inline `style={{}}` attributes; fixing this is a Phase 8 (frontend redesign) dependency, not a backend gap |
| No MongoDB `$jsonSchema` validation | Low | One trusted writer (the Node API); app-level validation (this phase) already covers every field (ADR-008) |
| No device-management UI | Low | The `sessions` data already supports it; just no screen built yet |
| Transactions embedded in `uploaded_files`, not normalized | Low (today) → Medium (at scale) | Real migration, not justified until document size/transaction-count approaches MongoDB's 16MB ceiling (ADR-006) |

## Future improvements

1. **Global rate limiting** (Upstash Redis or similar) once traffic/abuse justifies the
   operational cost — the per-instance limiter added/extended this phase is the correct
   interim design, not a placeholder to be embarrassed about.
2. **CSP without `'unsafe-inline'`** — blocked on the Phase 8 frontend redesign moving off
   inline `style={{}}` attributes.
3. **Device-management UI** — surface the `sessions` collection's existing
   `userAgent`/`ip`/`createdAt`/`lastUsedAt` fields so users can review/revoke individual
   sessions, not just "log out everywhere."
4. **Structured-log shipping** — `api/_lib/logger.js`'s production JSON output is ready to ship
   to a real aggregator (Vercel's own log drains, Datadog, etc.); nothing currently consumes it
   beyond stdout.
5. **Refresh-token family reuse detection** — revisit if real abuse patterns ever show a reused
   token is part of a longer compromised chain, not an isolated incident.
