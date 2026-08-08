# Authentication

CashCanvas has one authentication implementation, shared by both runtimes:

- **Production** — Vercel serverless functions (`api/auth.js`, `api/data.js`, `api/ai.js`)
- **Local dev** — `server.js`, a thin Express bootstrap that mounts the exact same handler modules

`server.js` does not re-implement any auth logic. It imports the default-exported
`handler(req, res)` function from `api/auth.js`, `api/data.js`, and `api/ai.js` and mounts
each with `app.all(path, handler)`. This is why dev and prod can never drift: there is
exactly one copy of every route.

**As of this phase, no JWT or refresh token ever reaches browser JavaScript.** Auth state
lives entirely in HttpOnly cookies; the frontend (`src/api.js`) never reads, stores, or
decodes a token.

## Module responsibilities

| Module | Responsibility |
|---|---|
| `api/_lib/jwt.js` | `generateAccessToken()`, `verifyAccessToken()`, `getUser(req)` — signs/verifies the short-lived access token, read from its cookie |
| `api/_lib/session.js` | `generateRefreshToken()`, `createSession()`, `findActiveSessionByToken()`, `rotateSession()`, `revokeSessionByToken()`, `revokeAllSessionsForUser()` — the `sessions` collection is the only place refresh-token state lives |
| `api/_lib/cookies.js` | `parseCookies()`, `getCookie()`, `setAuthCookies()`, `clearAuthCookies()` — the only place any route reads `req.headers.cookie` or builds a `Set-Cookie` header |
| `api/_lib/csrf.js` | `generateCsrfToken()`, `verifyCsrfToken()`, `requireCsrf()` — double-submit-cookie CSRF check |
| `api/_lib/security-headers.js` | Helmet + CSP config for the Express dev server (Vercel mirrors this in `vercel.json`, which can't import JS) |
| `api/_lib/otp.js` | `generateOtp()`, `otpExpiry()`, `isOtpExpired()`, `MAX_OTP_ATTEMPTS` — the only place OTPs are generated |
| `api/_lib/password.js` | `hashPassword()`, `comparePassword()` — the only place bcrypt is called |
| `api/_lib/validation.js` | `isValidEmail()`, `isValidPassword()`, `isValidOtpFormat()` — shared input checks |
| `api/_lib/mailer.js` | `sendOtpEmail()`, `sendVerificationEmail()`, `sendPasswordResetEmail()`, `generateVerificationToken()`, `isEmailVerificationEnabled()` — the only place Nodemailer is configured |
| `api/_lib/recaptcha.js` | `verifyRecaptcha(token)` — the only place reCAPTCHA is verified |
| `api/_lib/db.js` | `getDb()` — the only Mongo connection, shared by every route |
| `api/auth.js` | Route handlers: signup, login, OTP verify/resend, **refresh, logout, logout-all**, profile, legacy email-link verify, delete-account, forgot/reset password |
| `src/api.js` | The frontend's only fetch wrapper — `credentials: "include"` on every request, CSRF header attached automatically, one silent refresh-and-retry on a 401 |

## Why HttpOnly cookies instead of localStorage

The previous design put the JWT in `localStorage` and sent it back as an `Authorization:
Bearer` header. Any script that runs on the page — including a third-party script pulled in
by a future dependency, or an XSS bug anywhere in the ~3,000-line `App.jsx` — could read
`localStorage.getItem("cc_auth")` and exfiltrate the token. There is no way to make
`localStorage` inaccessible to page JavaScript; that's what it's for.

An `HttpOnly` cookie is invisible to `document.cookie` and to any JS running on the page. The
browser attaches it automatically on same-origin requests and the server is the only thing
that ever reads its value. This closes the JS-exfiltration path entirely — the trade-off is
that cookies open a *different* attack (CSRF), which is why this phase also adds CSRF
protection (below) and `SameSite=Lax`.

## Cookie lifecycle

Three cookies are set together (`setAuthCookies()`) whenever a session is established, and
cleared together (`clearAuthCookies()`) on logout or when refresh fails:

| Cookie | Contents | HttpOnly | Path | Lifetime |
|---|---|---|---|---|
| `cc_at` (access token) | Signed JWT `{userId, email, name}` | Yes | `/api` | 15 minutes |
| `cc_rt` (refresh token) | Opaque random hex string | Yes | `/api/auth` | 30 days, sliding |
| `cc_csrf` | Opaque random hex string | **No** | `/` | 30 days |

All three: `Secure` in production only (disabled in dev since local HTTP has no TLS —
browsers silently drop `Secure` cookies over plain HTTP, which would break local dev
entirely), `SameSite=Lax`, no explicit `Domain` (defaults to the exact host, the narrowest
possible scope).

`cc_rt`'s `Path=/api/auth` means it is *never sent* on `/api/files`, `/api/categories`,
`/api/categorize`, etc. — only the handful of auth endpoints that actually need it
(`refresh`, `logout`, `logout-all`) ever see it. This limits the blast radius if a bug in an
unrelated route ever logged raw cookies.

`cc_csrf` is deliberately **not** HttpOnly — the frontend must be able to read it via
`document.cookie` to echo it back as a header (see CSRF section below).

## Session lifecycle

Each login/signup/OTP-verification creates one document in the `sessions` collection:

```
{
  _id,
  userId,
  refreshTokenHash,   // SHA-256 of the raw token — the raw token is never stored
  userAgent,
  ip,
  createdAt,
  lastUsedAt,
  expiresAt,          // 30 days out; slides forward on every refresh
  revoked,            // false until logout / logout-all / reuse detection
  revokedAt,
}
```

The refresh token is an **opaque random value** (`crypto.randomBytes(48)`), not a JWT. This
is deliberate: a JWT refresh token can only be invalidated by maintaining a blocklist,
because JWTs are self-validating by signature alone. An opaque token requires a database
lookup on every use — which is exactly what lets a session be revoked instantly (logout,
logout-all, or an admin action) by flipping one flag, with no blocklist to maintain.

If the database were ever compromised, only SHA-256 hashes are exposed — not usable tokens.
(SHA-256 is safe here, with no per-record salt, because the input has 384 bits of entropy;
this is not a password hash, brute-forcing a specific token by trying inputs is infeasible.)

### Sequence: login

```
Browser                          Server                              MongoDB
   │  POST /api/auth/login          │                                    │
   │  {email, password}             │                                    │
   ├────────────────────────────────►                                    │
   │                                 │  bcrypt.compare(password, hash)   │
   │                                 ├───────────────────────────────────►│
   │                                 │  generateAccessToken()  (JWT, 15m) │
   │                                 │  generateRefreshToken() (opaque)   │
   │                                 │  createSession({ userId, hash })   │
   │                                 ├───────────────────────────────────►│
   │                                 │  generateCsrfToken()               │
   │  Set-Cookie: cc_at, cc_rt,      │                                    │
   │              cc_csrf            │                                    │
   │  200 { user: {name, email} }   │                                    │
   ◄─────────────────────────────────┤                                    │
```

No token ever appears in the JSON body — only in `Set-Cookie` headers, which browser JS
cannot read on an HttpOnly cookie.

### Sequence: silent refresh (mid-session, access token expired)

```
Browser (src/api.js)              Server                              MongoDB
   │  GET /api/files                 │                                    │
   │  Cookie: cc_at=<expired>         │                                    │
   ├────────────────────────────────►│  verifyAccessToken() throws        │
   │  401                            │                                    │
   ◄─────────────────────────────────┤                                    │
   │  POST /api/auth/refresh         │                                    │
   │  Cookie: cc_rt=<token>           │                                    │
   │  X-CSRF-Token: <from cc_csrf>   │                                    │
   ├────────────────────────────────►│  findActiveSessionByToken(hash)    │
   │                                 ├───────────────────────────────────►│
   │                                 │  generateRefreshToken() (new)      │
   │                                 │  rotateSession() — atomic CAS      │
   │                                 │  update on {_id, oldHash}          │
   │                                 ├───────────────────────────────────►│
   │  Set-Cookie: cc_at, cc_rt (new) │                                    │
   │  200 { ok: true }               │                                    │
   ◄─────────────────────────────────┤                                    │
   │  GET /api/files (retried)       │                                    │
   │  Cookie: cc_at=<new>             │                                    │
   ├────────────────────────────────►│  200 { ...files }                  │
   ◄─────────────────────────────────┤                                    │
```

`apiFetch()` in `src/api.js` does this transparently: any 401 from a route that needs an
access token triggers exactly one refresh-and-retry, so a 15-minute access token never
interrupts an active session.

### Sequence: logout

```
Browser                          Server                              MongoDB
   │  POST /api/auth/logout          │                                    │
   │  Cookie: cc_rt=<token>          │                                    │
   │  X-CSRF-Token: ...              │                                    │
   ├────────────────────────────────►│  revokeSessionByToken(hash)        │
   │                                 ├───────────────────────────────────►│
   │  Set-Cookie: cc_at=; cc_rt=;    │  (revoked: true)                   │
   │              cc_csrf=; Max-Age=0│                                    │
   │  200 { ok: true }               │                                    │
   ◄─────────────────────────────────┤                                    │
```

Note the one real caveat of access/refresh architectures: the *current* access-token JWT
remains cryptographically valid until its own 15-minute expiry even after logout, since
there's no access-token blocklist (that's the point of making it short-lived). What logout
actually guarantees is that **no new access token can be minted** for that session — the
refresh token is revoked, and the cookies telling a well-behaved client to keep sending the
old access token are cleared. `logout-all` does the same for every session belonging to the
user (`revokeAllSessionsForUser`), so a stolen device can be fully cut off.

### Token rotation & reuse detection

`rotateSession()` uses an atomic MongoDB compare-and-swap: the update filter includes the
session's *current* refresh-token hash, so it only succeeds if that hash hasn't already been
replaced. This single primitive handles three requirements from the spec at once:

- **Rotation**: every successful refresh immediately invalidates the token that was just used.
- **Reuse rejection**: presenting an old (already-rotated) token can never match the filter —
  it 404s the CAS update, and the route treats that as "invalid session, log in again."
- **Concurrent refresh races**: if two requests race with the same refresh token, only the
  first CAS update matches; the second gets nothing back and fails the same way a reused
  token would.

This is a simpler design than full "refresh token family" reuse-detection (where a detected
reuse revokes every token descended from the same login) — see Remaining Limitations.

## CSRF protection

**Chosen approach: double-submit cookie**, not a server-side CSRF token store.

At login, the server sets `cc_csrf` in a cookie the frontend *can* read (not HttpOnly). Every
mutating request (`POST`/`PUT`/`DELETE`) must echo that value back as an `X-CSRF-Token`
header. `requireCsrf()` compares the two with `crypto.timingSafeEqual`.

Why this works: a cross-site attacker's page can make the victim's browser *send* the cookie
automatically, but the attacker's JavaScript cannot *read* the cookie's value (it's on our
origin) to also set the matching header — same-origin policy blocks that. A request missing
or mismatching the header is rejected with `403`.

This is layered on top of `SameSite=Lax`, which already stops modern browsers from attaching
our cookies to most cross-site non-GET requests in the first place. Double-submit is
defense-in-depth for older browsers and edge cases, as explicitly requested for this phase.

Applied to: all authenticated mutating routes (`refresh`, `logout`, `logout-all`,
`delete-account`, and every mutating route in `api/data.js` / `api/ai.js`). **Not** applied
to `signup`/`login`/`verify-otp`/`resend-otp`/`forgot-password`/`reset-password` — those
happen before a session exists, so there's no CSRF-protectable state yet; they're protected
by rate limiting (+ reCAPTCHA on signup) instead.

The CSRF token does **not** rotate on refresh (only `cc_at`/`cc_rt` do) — it's not a
capability token, just an anti-forgery nonce, and rotating it would risk a race between a
background refresh and an in-flight form submission using the old value.

## Security headers

`api/_lib/security-headers.js` configures Helmet for the Express dev server; `vercel.json` has
the equivalent static header config for production (Vercel can't import a JS module for its
header config, so the two are kept in sync by hand). Includes a `Content-Security-Policy`:

- `script-src`: `'self'` + Google (reCAPTCHA) + cdnjs (PDF.js) — no `'unsafe-inline'` needed,
  since nothing injects an inline `<script>` block.
- `style-src`: **requires `'unsafe-inline'`** — the frontend renders 300+ `style={{...}}`
  attributes directly; a strict CSP would break the entire UI. This is a known trade-off
  logged in Remaining Limitations, not an oversight.
- `frame-ancestors 'none'` + `X-Frame-Options: DENY` — the app can't be framed at all.

## OTP lifecycle

Two flows share the same OTP mechanics (`api/_lib/otp.js`) but different storage:

- **Signup**: an OTP is generated and stored on a `pending_signups` document (upserted by
  email). The `users` document is only created once the OTP is verified — there's no
  half-registered account sitting in `users` if someone never confirms.
- **Login** (only when email verification is enabled — see below): an OTP is generated and
  stored directly on the existing `users` document (`pendingOtp`, `pendingOtpExpiry`,
  `pendingOtpAttempts`).

Both flows: 10-minute expiry (`OTP_TTL_MS`), 3 incorrect attempts before the OTP is discarded
(`MAX_OTP_ATTEMPTS`), and a resend endpoint that's separately rate-limited (3/hour).

OTPs are generated with `crypto.randomInt(100000, 999999)` — cryptographically secure, not
`Math.random()`.

### Dev mode without email configured

If the active provider's required vars aren't set (`isEmailVerificationEnabled()` returns
`false` — no `GMAIL_USER`/`GMAIL_APP_PASSWORD` under the default `gmail` provider, or no
`RESEND_API_KEY` under `EMAIL_PROVIDER=resend`), signup and login skip the OTP step entirely
and establish a session immediately. This lets you develop locally without setting up an email
provider, and is exactly the mode the automated test suite runs in (see Testing, below).

## Email flow

`api/_lib/mailer.js` owns transport selection and three send functions: OTP codes, the legacy
email-verification link, and password-reset (link + OTP). `EMAIL_PROVIDER` selects Gmail SMTP
(via Nodemailer, the default) or Resend (via its plain HTTP API, no SDK dependency) — both are
constructed lazily behind the same `sendMail({from, to, subject, html, text})` shape, so the
three send functions and every caller in `api/auth.js` are provider-agnostic; adding a future
provider only means one more branch in `createTransporter()`. All email sends from
`api/auth.js` are wrapped in try/catch — a failed send returns a `502` to the client rather
than silently succeeding with no code ever delivered.

Gmail's own account (a personal address, not a dedicated transactional domain) has weaker
inbox-placement/deliverability than a real transactional provider — Resend is the recommended
production choice once a sending domain is verified there; see ROADMAP.md's migration ADR.

## reCAPTCHA flow

`verifyRecaptcha(token)` in `api/_lib/recaptcha.js` calls Google's `siteverify` endpoint,
checks the v3 score against `RECAPTCHA_MIN_SCORE` (default `0.5`), and fails open (`{ok:
true, skipped: true}`) if `RECAPTCHA_SECRET_KEY` isn't configured or Google is unreachable —
so a misconfigured or down reCAPTCHA never blocks real signups. Called once, from signup only.

## Threat model summary

| Threat | Mitigation |
|---|---|
| XSS reads the session token | Token lives in an HttpOnly cookie — inaccessible to any page JS, even from a compromised dependency |
| Stolen refresh token replayed after the real user refreshes | Atomic rotation invalidates the old hash; replay fails the same way an expired token does |
| CSRF (forged cross-site mutating request) | `SameSite=Lax` + double-submit `X-CSRF-Token` header the attacker's origin can't read |
| Compromised database dump | Only `passwordHash` (bcrypt) and `refreshTokenHash` (SHA-256) are stored — no raw passwords or tokens |
| Credential stuffing / brute force | Per-IP rate limits on login/signup/OTP + account lockout after 5 failed logins |
| Stolen device / "log out everywhere" | `logout-all` revokes every session row for the user in one call |
| Clickjacking | `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` |

## Security considerations

- Passwords: bcrypt, cost factor 12 (`api/_lib/password.js`).
- Account lockout: 5 failed logins → 15-minute lock (`api/auth.js`, `MAX_FAILED`/`LOCKOUT_MS`).
- Rate limiting: every auth route calls `checkRateLimit()` (`api/_lib/ratelimit.js`) — an
  in-memory, per-process store. On Vercel this is per-instance, not global; see Remaining
  Limitations.
- All Mongo queries use parameterized filters (no string concatenation into queries).
- `ObjectId.isValid()` is checked before every `new ObjectId(id)` construction from user input.
- Sessions collection has indexes on `refreshTokenHash` (unique), `userId`, and a TTL index
  on `expiresAt` so expired sessions are auto-removed by MongoDB.

## Testing

`tests/auth.test.js` (Vitest + supertest + `mongodb-memory-server`) covers: login/signup
issuing cookies with no token in the body, wrong-password rejection, authenticated requests
with valid/missing/invalid cookies, CSRF accept/reject (missing header, wrong header,
correct header), refresh rotation, refresh rejection on missing/expired/revoked/reused
tokens, concurrent refresh races, logout revoking the session and clearing cookies, and
logout-all revoking every session across two simulated devices. Run with `npm test`.

The suite always runs against an in-memory MongoDB instance spun up by
`mongodb-memory-server` (`tests/vitest.setup.js` sets `MONGODB_URI` to it before any app
module is imported) — **never** the real Atlas cluster — and disables Gmail/reCAPTCHA so
tests exercise the direct login/signup → session path deterministically.

## Remaining limitations / future improvements

1. **Rate limiting is per-instance, not global** (`api/_lib/ratelimit.js`'s own doc comment
   flags this) — on Vercel, concurrent serverless instances don't share the in-memory store,
   so the "5 signups per 15 min" limit is really "5 per instance." Would need Upstash Redis
   (or similar) to be a real global limiter.
2. **CSP `style-src` requires `'unsafe-inline'`** because the frontend renders `style={{...}}`
   attributes directly. A stricter CSP requires moving to real stylesheets/CSS modules first —
   tracked as frontend work, not a backend gap.
3. **No refresh-token "family" reuse detection.** A reused (already-rotated) token is
   rejected, but only that one session is affected — a more aggressive design would revoke
   every session descended from the same original login the moment reuse is detected, on the
   theory that reuse implies the whole chain may be compromised. Not implemented: it adds a
   parent/child session graph for a marginal benefit at this app's current threat level and
   traffic size.
4. **No device-management UI.** Sessions store `userAgent`/`ip`/`createdAt`/`lastUsedAt`, but
   there's no "your active devices" screen for users to review or revoke individual sessions
   themselves (only "log out this device" and "log out everywhere" exist). The data needed
   for that UI already exists in the `sessions` collection.

**Resolved since this section was first written** (kept here so the history isn't lost, per this
project's "don't silently drop tracked debt" convention): rate limiting on `/api/categorize` and
every route in `api/data.js` — every one is now covered (`checkRateLimit()`, keyed per-user; see
`docs/security/threat-model.md`'s "Endpoint abuse" section for the full table). Indexes on
`users.email` (unique) and the `userId` fields on `uploaded_files`, `custom_categories`, and
`merchant_category_rules` — all added, plus one on `savings_goals.userId`; see
`docs/backend/database.md`'s "Indexes added this phase" table. Neither is a full collection scan
today.
