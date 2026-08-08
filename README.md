# CashCanvas

Your personal finance intelligence platform — upload a bank statement and instantly see where
your money goes, with hybrid keyword/AI categorization, merchant learning, savings planning, and
persistent history across sessions.

## Live

**[cashcanvas.dev](https://cashcanvas.dev)**

## What It Does

Drop a CSV or PDF bank statement and CashCanvas will:

- **Auto-categorize every transaction** — 11 categories, a keyword/merchant-name engine, plus a
  Gemini AI fallback for anything left uncategorized
- **Learn from your corrections** — reassign a transaction's category once and CashCanvas
  remembers that merchant forever (persisted per-user in MongoDB, and generalizes to merchant
  name variants, not just an exact string match)
- **Resume previous sessions** — your most recent upload reloads automatically on `/dashboard`;
  `/upload` also lists file history to review or delete
- **Custom personal categories** — create your own categories with emoji icons and colors; add
  merchant keywords to train them
- **Visual, keyboard-navigable breakdowns** — donut, bar, and line charts on `/analytics`
- **Detect recurring charges** — find subscriptions and fixed payments
- **Savings planner** — set a goal, choose categories to cut, generate a weekly budget (persisted
  server-side)
- **Export your report** — download your full transaction list as CSV

## Authentication & Security

CashCanvas requires an account so your data, learned merchant rules, and custom categories
persist across sessions. Highlights (full detail in `docs/backend/authentication.md` and
`docs/security/threat-model.md`):

- **HttpOnly cookies, not `localStorage`** — a short-lived (15 min) JWT access token and a
  rotating opaque refresh token (30 days) are never readable by page JavaScript
- **CSRF protection** via double-submit cookie (`SameSite=Lax` + an `X-CSRF-Token` header) on
  every mutating authenticated request
- **Passwords** hashed with bcrypt (cost factor 12)
- **Email OTP** for signup/login verification and a token+OTP password-reset flow, when an email
  provider is configured (Gmail SMTP or Resend)
- **reCAPTCHA v3** on signup, **rate limiting** on every route (auth endpoints, and every
  `api/data.js`/`api/ai.js` mutation), and **account lockout** after 5 failed logins
- **Security headers** (CSP, HSTS, frame-ancestors, etc.) via Helmet in dev and a matching static
  `vercel.json` config in production

| What's stored | Where |
|---|---|
| User credentials, OTP/reset state | MongoDB `users` collection |
| Signed-in devices (refresh-token sessions) | MongoDB `sessions` collection |
| Upload history + embedded transactions | MongoDB `uploaded_files` collection |
| Learned merchant→category rules | MongoDB `merchant_category_rules` collection |
| Custom categories + keywords | MongoDB `custom_categories` collection |
| Savings goals | MongoDB `savings_goals` collection |

## Categorization System

Two related pipelines share the same merchant-normalization logic (`src/utils/merchantNormalization.js`,
also used server-side via `api/_lib/transaction-cleaner.js`):

**What decides the category shown in the app** (`resolveCategory()`, `src/utils/categorization.js`),
in priority order:

1. **An explicit, persisted merchant rule** — if you've ever reassigned this merchant (or a close
   variant of it — matching is exact-string, prefix, and fuzzy/Dice-coefficient, not just an exact
   match), that mapping always wins
2. **A cached AI guess** for this session, if the transaction was sent to Gemini after upload and
   came back with a confident, non-"Other" category
3. **The keyword engine** — checks merchant rules again, then two keyword passes (full cleaned
   description, then the extracted core merchant name), then falls back to **"Other"**

**What happens on upload**: any transaction still "Other" after the keyword engine is batched
(100 at a time) to `POST /api/categorize`, which itself checks your merchant rules first and only
sends the remainder to Gemini (`gemini-1.5-flash`) for a best-guess category. This AI pass is
ephemeral per session — the only thing that persists is a real merchant rule, created when you
explicitly reassign a transaction's category.

The description cleaner strips bank boilerplate (POS/ACH prefixes, Visa/Checkcard labels), POS
terminal prefixes (`SQ*`, `TST*`), store numbers, transaction IDs, and US state abbreviations
before any matching happens.

## Supported File Formats

| Format | Details |
|--------|---------|
| CSV / TSV | Auto-detects date, description, and amount columns from most banks |
| PDF | Extracts transactions from text-based bank statement PDFs (Chase, Bank of America, Wells Fargo, and most others) |

## Technology Stack

| Layer | Technology |
|---|---|
| **Language** | JavaScript (ES2022 modules throughout, no TypeScript) |
| **Frontend** | React 18, Vite 6, `react-router-dom` |
| **Charts** | Recharts |
| **CSV parsing** | PapaParse |
| **PDF parsing** | PDF.js (via CDN) |
| **Backend (dev)** | Node.js 22+, Express 4 (`server.js`, mounts the same handlers Vercel runs) |
| **Backend (prod)** | Vercel Serverless Functions — exactly 3: `api/auth`, `api/data`, `api/ai` |
| **Database** | MongoDB (Atlas), accessed via the official `mongodb` driver |
| **Auth** | JWT access token + opaque rotating refresh token (`jsonwebtoken`), bcrypt (`bcryptjs`), both in HttpOnly cookies |
| **AI** | Google Gemini API (`gemini-1.5-flash`) |
| **Email** | Nodemailer (Gmail SMTP, default) or Resend (HTTP API) — selected via `EMAIL_PROVIDER` |
| **Security** | Helmet, Google reCAPTCHA v3, a custom in-memory rate limiter |
| **Testing** | Vitest + Supertest + `mongodb-memory-server` (unit/integration), Playwright (e2e, a11y, visual) |

## High-Level Architecture

```
api/
  auth.js       ─┐
  data.js        ├─ the only 3 real Vercel Serverless Functions
  ai.js         ─┘  (everything under api/_lib/ is a shared module they import, not its own function)
  _lib/            db, jwt, session, cookies, csrf, validation, rate limiting,
                   logging, mailer, recaptcha, security headers, otp, password
server.js          local dev bootstrap — mounts api/*.js directly, never reimplements them
src/               React 18 frontend (Vite), routed via react-router-dom
tests/             Vitest + Supertest + mongodb-memory-server, plus tests/e2e (Playwright)
docs/              architecture docs, threat model, release process
```

`server.js` and Vercel's serverless functions run the exact same route-handler modules — there is
no separate dev implementation to keep in sync.

## Running Locally

### Prerequisites
- Node.js 22+ (see `package.json`'s `engines` field; CI and production run Node 24.x)
- A MongoDB instance (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- (Optional) A Google Gemini API key for AI categorization (free at [aistudio.google.com](https://aistudio.google.com))

### Setup

```bash
git clone https://github.com/Param-1210/CashCanvas.git
cd CashCanvas
npm ci

# Copy the example env file and fill in your values
cp .env.example .env
```

At minimum, set `MONGODB_URI` in `.env`. Everything else (Gemini, reCAPTCHA, email) is optional
in development — the app degrades gracefully without it (e.g. OTP is skipped entirely if no email
provider is configured).

### Development

```bash
npm run dev:full   # Vite frontend (5173) + Express API server (3001), concurrently
```

Or run them separately:
```bash
npm run dev        # Vite frontend only
npm run dev:api    # Express API server only
```

Open [http://localhost:5173](http://localhost:5173).

### Environment Variables

Every variable is documented inline in `.env.example`. Summary:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string (required) |
| `JWT_SECRET` | Signs the access token (required in production; a dev fallback is used otherwise) |
| `GEMINI_API_KEY` | Enables AI categorization (`/api/categorize`) and PDF parsing (`/api/parse-pdf`) |
| `RECAPTCHA_SECRET_KEY`, `VITE_RECAPTCHA_SITE_KEY`, `RECAPTCHA_MIN_SCORE` | reCAPTCHA v3 on signup; skipped entirely if unset |
| `EMAIL_PROVIDER` | `gmail` (default) or `resend` — selects the OTP/reset email transport |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Required when `EMAIL_PROVIDER=gmail` |
| `RESEND_API_KEY` | Required when `EMAIL_PROVIDER=resend` |
| `EMAIL_FROM`, `EMAIL_FROM_NAME` | Sender address/name for outgoing email |
| `APP_URL` | Base URL used to build verification/reset links in emails |
| `ALLOWED_ORIGINS` | CORS allow-list for the local Express dev server |

If no email provider is configured, signup/login skip the OTP step entirely and establish a
session immediately — this is also the mode the automated test suite runs in.

### Deployment (Vercel)

The project deploys continuously: Vercel's GitHub integration builds and deploys every push to
`main`. The `/api` directory contains the 3 serverless functions; `vercel.json` rewrites `/api/*`
requests to them and sets the production security headers. Set the environment variables above in
the Vercel project's settings. See `docs/release-process.md` for the full release/rollback
process.

## Testing

```bash
npm test              # Vitest unit/integration suite (mongodb-memory-server, no real DB)
npm run test:coverage # same, plus a coverage report
npm run test:e2e      # Playwright end-to-end suite (chromium/firefox/webkit/mobile-chrome/mobile-safari)
npm run lint          # ESLint
npm run build         # production build
```

The Playwright suite also includes accessibility scans (`axe-playwright`) on every real route and
a chromium-only visual-regression pass. See `docs/engineering-lessons/phase-6-testing.md` for the
testing philosophy and `CONTRIBUTING.md` for the full local workflow.

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/signup` | Create account (rate-limited, reCAPTCHA-gated) |
| POST | `/api/auth/login` | Authenticate, sets session cookies |
| POST | `/api/auth/verify-otp` | Confirm signup/login OTP |
| POST | `/api/auth/resend-otp` | Resend an OTP code |
| POST | `/api/auth/refresh` | Rotate the access/refresh token pair |
| POST | `/api/auth/logout` | Revoke the current session |
| POST | `/api/auth/logout-all` | Revoke every session for the account |
| GET | `/api/auth/profile` | Get the current user |
| POST | `/api/auth/forgot-password` | Request a password-reset email |
| POST | `/api/auth/reset-password` | Complete a password reset (token + OTP + new password) |
| DELETE | `/api/auth/delete-account` | Permanently delete the account and its data |
| GET / POST | `/api/files` | List / save an uploaded statement |
| GET / DELETE | `/api/files/:id` | Get full transaction data / delete a statement |
| GET / POST | `/api/categories` | List / create a custom category |
| PUT / DELETE | `/api/categories/:id` | Update / delete a custom category |
| GET / POST | `/api/merchant-rules` | List / save a learned merchant→category rule |
| PUT / DELETE | `/api/merchant-rules/:id` | Update / delete a merchant rule |
| GET / PUT / DELETE | `/api/savings` | Get / set / clear the user's savings goal |
| POST | `/api/categorize` | AI-categorize a batch of transactions |
| POST | `/api/parse-pdf` | Extract transactions from an uploaded PDF statement |

## MongoDB Collections

| Collection | Purpose |
|---|---|
| `users` | One document per account: credentials, verification/lockout/OTP/reset state |
| `pending_signups` | Signup attempts awaiting OTP confirmation (TTL-expired automatically) |
| `sessions` | One document per logged-in device (refresh-token session) |
| `uploaded_files` | One document per uploaded statement, transactions embedded inline |
| `custom_categories` | User-defined spending categories (name, icon, color, keywords) |
| `merchant_category_rules` | Learned merchant → category mappings, checked before any AI call |
| `savings_goals` | Persisted per-user savings goal and cut-plan selections |

## Security Considerations

See `docs/security/threat-model.md` for the full threat model, `docs/backend/authentication.md`
for the auth/session/CSRF design, and `docs/backend/database.md` for indexing and data-integrity
decisions. Notable, documented trade-offs: rate limiting is per-serverless-instance, not globally
shared; there is no refresh-token "family" reuse detection; and one `npm audit` advisory
(react-router, `GHSA-qwww-vcr4-c8h2`) is a formally accepted, documented risk (ADR-028 in
`ROADMAP.md`) rather than a forced breaking downgrade — the CI security workflow still fails on
any other actionable high/critical finding.

## Further Reading

- `CONTRIBUTING.md` — local setup, commit/branch conventions, PR checklist
- `ROADMAP.md` — full phase history and Architecture Decision Records
- `CHECKPOINT.md` — latest session handoff / current status
- `docs/` — architecture, security, release-process, and engineering-lessons documentation
