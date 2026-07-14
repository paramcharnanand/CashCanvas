# Checkpoint

Session handoff doc — read this first, then `ROADMAP.md` for full phase history/ADRs/tech
debt. Update this file at the end of every session so the next one can start here instead of
re-deriving context from the repo.

## Current status

**Phase 4 (Security hardening) + Phase 5 (Dependency maintenance): done.** 5 of 9 phases
complete (56%). Full writeup: `docs/security/threat-model.md`. Full phase/ADR history:
`ROADMAP.md`.

## What was completed this session

1. **Endpoint-specific rate limiting** — every route in `api/data.js` (files/categories/
   merchant-rules) and `/api/categorize` now rate-limited, keyed per-user (not per-IP, not
   global) with per-route values documented inline. See ADR-010.
2. **Centralized input validation** — `api/lib/validation.js` expanded with transaction
   date/amount/desc, fileName, statementType, category/merchant name validators; wired into
   `api/data.js` and `api/ai.js`, removing duplicated ad hoc checks.
3. **CSV/upload hardening** — formula-injection sanitization (`sanitizeCsvField`) applied at
   ingestion (ADR-011), SHA-256 content-hash duplicate-upload detection (ADR-012), and a
   `%PDF` magic-number check on `/api/parse-pdf` against MIME-type/renamed-file confusion.
4. **Logging audit** — found and fixed `api/lib/mailer.js` logging raw OTP codes and
   password-reset tokens in its "email not configured" fallback (unreachable in normal
   operation today, but fixed regardless — see `docs/security/threat-model.md`). Added
   `api/lib/logger.js` (structured JSON in production, readable text in dev) and migrated
   every `console.error`/`console.warn` call site in `api/` to it.
5. **Dependency audit** — `npm audit` clean (0 vulnerabilities, was 7). 6 fixed via
   `npm audit fix` (no breaking changes); `nodemailer` 6→9 major bump evaluated and taken
   after confirming the app's minimal API surface is unaffected (ADR-013). All 12 direct deps
   confirmed in active use — none removed.
6. **Security regression tests** — `tests/validation.test.js` (41), `tests/security.test.js`
   (12: rate limiting, input validation, CSV injection, duplicate uploads, PDF magic-number
   check, unauthorized access), `tests/logging.test.js` (2), `tests/logger.test.js` (4).
7. **Threat model** — `docs/security/threat-model.md`: assets, threats/mitigations (auth +
   new Phase 4 endpoint/input/logging/dependency work), accepted remaining risks with
   ratings, future improvements.
8. **ROADMAP.md** — Phase 4/5 marked done, ADR-010 through ADR-013 added, technical-debt
   section updated (fixed items struck through/removed, new Phase 4-surfaced debt added).

## Test suite

`npm test` — **82/82 passing** (was 23 at session start: 18 auth + 5 data). New this session:
41 validation + 12 security + 2 logging + 4 logger tests.

## Files changed this session

New: `api/lib/logger.js`, `docs/security/threat-model.md`, `tests/validation.test.js`,
`tests/security.test.js`, `tests/logging.test.js`, `tests/logger.test.js`, this file.

Modified: `api/data.js` (rate limiting + validation + dedup), `api/ai.js` (categorize rate
limit + validation, parse-pdf magic-number check), `api/lib/validation.js` (expanded),
`api/lib/db.js` (contentHash index), `api/lib/mailer.js` (secret-logging fix + logger),
`api/auth.js` (migrated to logger), `api/lib/http.js` (migrated to logger), `package.json` /
`package-lock.json` (dependency bumps), `ROADMAP.md`.

## Remaining technical debt

Full list with rationale lives in `ROADMAP.md`'s "Known technical debt" section — not
duplicated here to avoid drift. Headline items: global (cross-instance) rate limiting still
needs Upstash Redis when traffic justifies it; CSP `style-src` `'unsafe-inline'` blocked on
Phase 8; pagination/search validators deliberately not built (no route uses them yet).

## Next recommended step

Per the standing instruction for this effort: **stop here for approval before continuing.**
When resumed, `ROADMAP.md`'s dependency-ordered recommendation is **Phase 7 (CI/CD)** next —
enforces Phases 4/5's work (tests, `npm audit`) automatically going forward, and should exist
before the higher-risk Phase 8 frontend rewrite lands.

## Blockers / assumptions

- None blocking. One judgment call made without re-confirming: pulled Phase 5 (dependency
  maintenance) forward into this session alongside Phase 4, since the threat-model deliverable
  needed the resulting dependency posture anyway — see ROADMAP's Phase 4 completion note.
- `nodemailer` major-version upgrade was verified via API-compatibility checks + full test
  suite + build, **not** a live send through real Gmail SMTP (no credentials in this
  environment) — low risk given the unchanged core API, but worth a real send test before
  the next production deploy if that hasn't happened yet.
