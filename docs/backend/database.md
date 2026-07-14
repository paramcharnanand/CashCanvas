# Database

MongoDB Atlas, one database (`cashcanvas`), accessed through a single shared connection
(`api/_lib/db.js`) — see `docs/backend/authentication.md` for how that connection is reused
across serverless invocations and the local Express dev server.

**This document only describes collections that actually exist and are queried somewhere in
the codebase.** An earlier version of the Phase 3 plan for this project assumed `Transactions`,
`Budgets`, and `Savings Goals` collections — none of those exist. Transactions live embedded
inside `uploaded_files` documents; budgets aren't persisted anywhere; "savings goal" is
client-only React state in `Dashboard` that's lost on refresh. Those are noted as future
product/architecture work below, not indexed here, because you can't productively index a
query that doesn't exist.

## Collections

| Collection | Purpose |
|---|---|
| `users` | One document per account: credentials, verification/lockout state, in-flight OTP/reset fields |
| `pending_signups` | Signup attempts awaiting OTP confirmation. Deliberately temporary — a `users` document is only created once the code is verified, so there's never a half-registered account |
| `sessions` | One document per logged-in device (refresh-token session) — see `authentication.md` |
| `uploaded_files` | One document per uploaded bank/credit-card statement, **including its full `transactions[]` array embedded inline** |
| `custom_categories` | User-defined spending categories (name, icon, color, keyword list) |
| `merchant_category_rules` | Learned merchant → category mappings, one per (user, merchant) — this is what the AI categorizer checks before ever calling Gemini |

## Relationships

Every collection except `users` itself carries a `userId` field that is the *string* form of
a `users._id` (not an `ObjectId` reference) — this matches how `getUser(req)` returns the JWT
payload's `userId` as a string, and avoids an `ObjectId`/string mismatch bug at every query
site. There are no foreign-key constraints (MongoDB doesn't have them); referential integrity
is maintained entirely at the application layer — e.g. `deleteAccount` explicitly deletes the
matching rows in `uploaded_files`, `custom_categories`, `merchant_category_rules`, `sessions`,
and `pending_signups` in one `Promise.all` rather than relying on a cascade.

```
users (1) ──< uploaded_files (many)              [userId]
users (1) ──< custom_categories (many)           [userId]
users (1) ──< merchant_category_rules (many)     [userId]
users (1) ──< sessions (many)                    [userId]
uploaded_files.transactions[]                     — embedded, not a separate collection
```

## Query audit (Step 1)

Every database call in the app, before this phase:

| Collection | Query | Filter | Sort / Project / Limit | Index before this phase |
|---|---|---|---|---|
| `users` | `findOne` (login, signup dup-check, resend-otp, forgot-password) | `{email}` | — | **none — full collection scan** |
| `users` | `findOne` (legacy email-verify link) | `{verificationToken}` | — | none |
| `users` | `findOne` (password reset) | `{passwordResetToken}` | — | none |
| `users` | `updateOne` / `insertOne` | `{_id}` | — | default `_id` index |
| `uploaded_files` | `find` (file history) | `{userId}` | `.project({transactions:0}).sort({uploadedAt:-1}).limit(20)` | none |
| `uploaded_files` | `findOne` / `deleteOne` | `{_id, userId}` | — | default `_id` only |
| `custom_categories` | `find` | `{userId}` | `.sort({createdAt:1})` | none |
| `custom_categories` | `findOne` (dup-name check) | `{userId, categoryName}` (was an unescaped regex) | — | none |
| `merchant_category_rules` | `find` / `updateOne` (upsert) | `{userId}` / `{userId, merchantName}` | — | none |
| `sessions`, `pending_signups` | (see `authentication.md`) | — | — | already indexed (Phases 1–2) |

No `aggregate()`, `countDocuments()`, or `distinct()` calls exist anywhere in the codebase, so
there is no aggregation-pipeline review to do (Step 7 of the original plan is genuinely N/A —
noted rather than invented).

At 1K rows every one of these is sub-millisecond regardless of indexes. The `users.email`
lookup — hit on *every* login, signup, resend, and password-reset request — is the one that
actually matters: it's O(n) against the whole collection without an index, meaning it gets
linearly slower as the user base grows, on the single hottest path in the app.

## Existing index audit (Step 2)

Before this phase, exactly four indexes existed in the entire database, all from Phases 1–2:
`pending_signups.otpExpiry` (TTL), `sessions.refreshTokenHash` (unique), `sessions.userId`,
`sessions.expiresAt` (TTL). No unused, duplicate, or conflicting indexes were found — there
simply weren't enough indexes yet for any of those problems to exist.

## Indexes added this phase

All defined in `api/_lib/db.js`'s `ensureIndexes()`, created idempotently on every `getDb()` call.

| Collection | Index | Type | Query it supports | Why |
|---|---|---|---|---|
| `users` | `{email: 1}` | unique | login/signup/resend/forgot-password lookups | The hottest query in the app; also closes a real race — previously two concurrent signups with the same email could both pass the app-level pre-check and both insert, since nothing but application logic prevented it |
| `users` | `{verificationToken: 1}` | unique, sparse | legacy email-verify link | Sparse because most users never have this field set (only mid-verification); unique because a token collision would let one link verify a different account |
| `users` | `{passwordResetToken: 1}` | unique, sparse | password-reset lookup | Same reasoning as above |
| `uploaded_files` | `{userId: 1, uploadedAt: -1}` | compound | file-history list (`find({userId}).sort({uploadedAt:-1})`) | Covers the filter *and* the sort in one index — no separate in-memory sort stage |
| `custom_categories` | `{userId: 1, categoryName: 1}` | unique, collation `{locale:"en", strength:2}` | duplicate-name check | Case-insensitive uniqueness enforced by MongoDB itself, not just app logic — see Query Optimization below |
| `custom_categories` | `{userId: 1, createdAt: 1}` | compound | category list (`find({userId}).sort({createdAt:1})`) | Matches the list query exactly |
| `merchant_category_rules` | `{userId: 1, merchantName: 1}` | unique | rule list + the upsert's implicit "one rule per merchant per user" invariant | Turns an assumption the upsert logic already relied on into an enforced constraint |

**Why compound field order matters** (Step 5): in `{userId: 1, uploadedAt: -1}`, `userId`
must come first because every query filters on it with an *equality* match, while `uploadedAt`
is a *range/sort* — MongoDB compound indexes are only useful as a prefix match, so an
equality field must precede a sort/range field for the index to serve both purposes in one
pass. Reversing the order (`{uploadedAt: -1, userId: 1}`) would only let MongoDB use the
`uploadedAt` prefix, forcing it to still scan every user's documents to filter by `userId`
within each date bucket — no better than not having the index for this query's purpose. This
is also why a single compound index here is strictly better than two separate single-field
indexes on `userId` and `uploadedAt`: with two separate indexes, MongoDB can use at most one
of them directly and would still need to intersect or fall back to scanning/sorting in memory
for the other condition.

**Indexes not added, and why** (Step 3's suggestions that don't apply here): `users.createdAt`
and `users.emailVerified` were suggested in the original plan, but no query anywhere filters
or sorts by either field — adding them now would be exactly the "index blindly" anti-pattern
the plan itself warns against. If an admin/analytics view is ever built that queries by
signup date or verification status, add them then, driven by that real query.

## TTL strategy (Step 4)

| Field | Collection | TTL? | Why |
|---|---|---|---|
| `pending_signups.otpExpiry` | `pending_signups` | **Yes** (already existed) | Every document in this collection is inherently temporary — it holds nothing that should ever outlive the signup attempt. |
| `sessions.expiresAt` | `sessions` | **Yes** (already existed) | Same reasoning — a session document has no purpose once expired. |
| `users.passwordResetExpiry` | `users` | **No — and this is deliberate, not an oversight** | A MongoDB TTL index deletes the **entire document** once the indexed date field is in the past, not just that field. `passwordResetExpiry` lives on a `users` document that also holds the account's name, email, and password hash. A TTL index here would silently delete real user accounts the moment an unused password-reset link expired. |
| `users.verificationTokenExpiry` | `users` | **No**, same reason | Same document-vs-field problem. |
| `users.pendingOtpExpiry` | `users` | **No**, same reason | Same problem — this field lives on the permanent user document during a login-OTP challenge. |

For the fields that can't be TTL'd, the app already treats them as logically expired at read
time (`isOtpExpired()` / manual date comparisons before trusting the field), so there's no
functional gap — just some inert fields that linger on a `users` document if someone requests
a reset/OTP and never completes it. That's cosmetic storage bloat, not a bug, and doesn't
justify a scheduled cleanup job at current data volumes. If it ever does, a queued
`$unset`-expired-fields job (not TTL) is the correct tool, run against a real filter
(`passwordResetExpiry: {$lt: new Date()}`) rather than an index.

There are no temporary uploads or cache entries anywhere in the app, so those two TTL
categories from the original plan don't apply.

## Query optimization (Step 6)

1. **`custom_categories` duplicate-name check** — was
   `categoryName: { $regex: new RegExp("^" + name + "$", "i") }` with the user's raw input
   spliced directly into a `RegExp` constructor. Two problems: (a) a category name containing
   regex metacharacters (`.`, `+`, `(`, etc. — plausible for something like "Kids & Pets")
   could produce false-positive or false-negative duplicate matches, and (b) a regex can't use
   a normal index. Replaced with an exact-match query using the collection's collation
   (`{locale:"en", strength:2}`), which is both correct and index-backed.
2. **Signup / OTP-verification duplicate-email races** — both `insertOne` calls that create a
   `users` document now catch MongoDB error code `11000` (duplicate key) explicitly and return
   a clean `409` instead of falling through to a generic `500`. This is what actually makes the
   new unique index useful in the concurrent case the app-level pre-check can't catch — see the
   new regression test ("two concurrent signups, same email, exactly one succeeds").
3. **`/api/categorize` was skipping the DB entirely and sending every transaction to Gemini** —
   discovered during this audit, not something this phase introduced. The old dev-only
   `server.js` (before Phase 1 consolidated it to delegate to `api/ai.js`) used to fuzzy-match
   against the user's `merchant_category_rules` first and only send *unmatched* transactions to
   Gemini; production's `api/ai.js` never had that step. Restored it: `categorize()` now loads
   the user's rules with one indexed `find({userId})`, fuzzy-matches locally, and only calls the
   (slow, costly, rate-limited) external Gemini API for what's left. For a user who has already
   corrected a merchant's category once, every future statement containing that merchant now
   resolves for free with zero external calls.

No other N+1 patterns, unnecessary full-document reads, or unbatched loops were found —
`deleteAccount`'s six deletes across five collections were already parallelized via
`Promise.all`, and `uploaded_files`'s file-history query already projects out the (potentially
large) `transactions` field and caps at 20 results.

## Pagination (Step 8)

`GET /api/files` already returns at most 20 documents (`.limit(20)`) — no endpoint in the app
returns an unbounded result set. That said, a user with more than 20 historical uploads has no
way to reach the older ones today; there's no "load more" affordance in the UI and no
cursor/offset parameter on the endpoint. Cursor-based pagination is the right fix *when that
becomes a real need* — the new `{userId, uploadedAt}` compound index already supports it
directly (`find({userId, uploadedAt: {$lt: cursor}}).sort({uploadedAt:-1}).limit(20)`, no
`skip()` needed). Not building it now: there's no frontend "load more" UI to drive it yet, and
adding a server-side cursor parameter nothing consumes would be a half-finished feature. Noted
as ready-to-implement future work rather than built speculatively.

## Data integrity (Step 9)

Required fields, string trimming, enum-like category validation, and duplicate prevention are
all already enforced at the application layer (see `api/_lib/validation.js` and the route
handlers). This phase adds real *database-level* backing for the two invariants that
previously relied on app logic alone: unique emails (`users`) and unique
(user, category-name)/(user, merchant-name) pairs. Full MongoDB `$jsonSchema` validators
(enforcing types/enums at the database level, independent of application code) were considered
and deliberately not added — this app has exactly one writer (the Node API), app-level
validation already covers every field, and schema validators would add real maintenance
overhead (every field change requires updating the validator too) for a benefit that only
matters if a second, less-trusted writer ever touches this database directly. Worth
reconsidering if that ever changes.

## Soft deletes (Step 10)

Not implemented, deliberately. Every delete path in the app (`delete-account`, file delete,
category delete) is a direct, low-stakes, user-initiated action: deleting an uploaded
statement or a custom category is immediately and cheaply reversible in practice — re-upload
the CSV, re-create the category. Adding `deleted`/`deletedAt`/`deletedBy` fields would mean
every single read query in the app needs an extra filter forever, for a recovery feature
nothing currently asks for. `delete-account` remains a genuine hard delete across five
collections, consistent with how the feature is presented to the user today ("This cannot be
undone"). If a real requirement emerges (e.g. a compliance-driven grace period before account
deletion becomes permanent), that's worth a dedicated design pass rather than a blanket
`deleted` flag bolted on everywhere.

## Performance benchmarks (Step 11)

Measured with `tests/benchmark-indexes.mjs` — seeds an isolated in-memory MongoDB instance
(never the real Atlas cluster) with synthetic data at a meaningful scale and runs
`explain("executionStats")` on the app's actual query shapes before and after each index
exists. Run it yourself with `node tests/benchmark-indexes.mjs`.

| Query | Rows | Before | After |
|---|---|---|---|
| `users.findOne({email})` | 200,000 | `COLLSCAN`, 200,000 docs examined, 29ms | `EXPRESS_IXSCAN`, 1 doc examined, 2ms |
| `uploaded_files.find({userId}).sort({uploadedAt:-1}).limit(20)` | 50,000 (5,000 users × 10 files) | `COLLSCAN` + in-memory `SORT`, 50,000 docs examined, 8ms | `LIMIT` off the index directly, 10 docs examined, 0ms |
| `merchant_category_rules.find({userId})` | 100,000 (10,000 users × 10 rules) | `COLLSCAN`, 100,000 docs examined, 12ms | index `FETCH`, 10 docs examined, 0ms |

The number that matters for scaling isn't the millisecond timings above (trivial either way at
these sizes) — it's `docsExamined`. **Before** the index, that number equals the total
collection size and grows linearly forever. **After**, it equals the result size and stays
flat regardless of how large the collection gets — the same `users.findOne({email})` query
would still examine exactly 1 document whether the collection holds 200,000 rows or 200
million.

## Regression testing (Step 12)

`npm test` — 23 tests across `tests/auth.test.js` (18, unchanged from Phase 2) and the new
`tests/data.test.js` (5): duplicate category name rejected regardless of case, the same name
allowed for two different users, two concurrent signups with the same email resolving to
exactly one `201` and one clean `409`, and the categorizer resolving a taught merchant with
zero reliance on `GEMINI_API_KEY` vs. falling back to the warning only for genuinely unmatched
transactions. All pass; none of the new unique indexes broke an existing flow.

## Future scaling

Grounded in this app's actual shape (personal finance dashboard, per-user-scoped queries,
statement upload + AI categorization) rather than generic advice:

**~10K users** — current architecture needs nothing. A single Atlas cluster with the indexes
above handles this comfortably; don't add operational complexity ahead of an actual need.

**~100K users** — two real considerations, both already flagged in `authentication.md`:
(1) the in-memory rate limiter is per-instance on Vercel, not global — worth moving to
Upstash Redis once abuse patterns actually show up; (2) each warm serverless instance holds
its own MongoDB connection pool (`api/_lib/db.js` reuses one client per instance, which is
correct, but doesn't coordinate across *many* concurrent instances) — at enough concurrent
traffic this can approach an Atlas tier's max-connections ceiling, at which point either a
larger Atlas tier or a serverless-aware pooling layer (e.g. Atlas's Data API, or a proxy like
MongoDB's own serverless instance type) is the fix, not sharding.

**~1M users** — this is where the embedded-transactions-in-`uploaded_files` model (not an
indexing problem — a document-size-ceiling problem, see the audit above) becomes worth
revisiting: normalizing transactions into their own collection with a
`{userId: 1, date: -1}` compound index is the natural next step, and only justified once
document sizes or per-file transaction counts are actually approaching the practical ceiling
the code already guards against (`transactions.length > 10000` in `api/data.js`). Also the
point where category/merchant-rule lookups (small, read-heavy, rarely-changing per user)
become worth caching (Redis, short TTL) to cut two DB round trips off every dashboard load,
and where AI categorization should move from "block the HTTP request on a Gemini call" to a
background job with polling/webhook completion.

**~10M users** — sharding becomes a real conversation, but only for a normalized
`transactions` collection (if built) — shard key `userId` (or a hashed variant), since nearly
every query in this app is already scoped to one user, which is the ideal sharding access
pattern. Dedicated read replicas for any future analytics/reporting workload, separated from
the transactional write path. A real job queue (not an in-process batch loop) for statement
processing and categorization. None of this is worth building before the data or traffic that
justifies it exists.

## Deliverables

**Indexes added**: 7 — `users.email` (unique), `users.verificationToken` (unique, sparse),
`users.passwordResetToken` (unique, sparse), `uploaded_files.{userId,uploadedAt}`,
`custom_categories.{userId,categoryName}` (unique, collation), `custom_categories.{userId,createdAt}`,
`merchant_category_rules.{userId,merchantName}` (unique).

**Indexes removed**: none — the existing 4 (from Phases 1–2) were all justified and used; see
Existing Index Audit above.

**Queries optimized**: 3 — category duplicate-check (regex → collation exact-match),
signup/OTP-verification duplicate-key handling (silent 500 → clean 409), `/api/categorize`
merchant-rule fuzzy-match restoration (skips Gemini entirely for already-taught merchants).

**Benchmark summary**: see table above — `docsExamined` drops from full-collection-size to
result-size on every indexed query; this is what keeps these queries fast independent of how
large the collections grow, not the (already-fast) millisecond timings at today's scale.

**Remaining database technical debt**:
1. Transactions embedded in `uploaded_files` will hit MongoDB's 16MB document limit before it
   hits a normal collection-scan problem — a real migration, not an indexing task, and not yet
   justified by actual data volume.
2. No cursor-based pagination on `/api/files` beyond the existing fixed `.limit(20)` — fine
   today, needs a "load more" UI + cursor param together when it isn't.
3. `passwordResetExpiry` / `verificationTokenExpiry` / `pendingOtpExpiry` fields on `users`
   can't be TTL-cleaned (see TTL Strategy) — they're logically inert once expired but linger in
   storage. Not worth a cleanup job at current volume.
4. No MongoDB-level `$jsonSchema` validation — acceptable with a single trusted writer, worth
   revisiting if that ever changes.
5. Budgets and Savings Goals have no persistence layer at all today — `savingsGoal` in
   `Dashboard` is client-only state lost on every refresh. This is a product feature gap, not a
   database optimization gap; flagged here so it doesn't get lost, not addressed in this phase.
