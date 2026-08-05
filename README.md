# CashCanvas

Your personal finance intelligence platform — upload a bank statement and instantly see where your money goes, with AI-powered categorization, savings goals, and persistent history across sessions.

## Live Demo

**[cash-canvas-sigma.vercel.app](https://cash-canvas-sigma.vercel.app)**

## What It Does

Drop a CSV or PDF bank statement and CashCanvas will:

- **Auto-categorize every transaction** — 11 categories, 300+ merchant keywords, plus Claude AI fallback for anything the keyword engine misses
- **Learn from your corrections** — reassign a transaction's category once and CashCanvas remembers that merchant forever (stored per-user in MongoDB)
- **Resume previous sessions** — a "Previous Uploads" panel on the home screen lists past statements; click any card to reload it instantly
- **Custom personal categories** — create your own categories with emoji icons and colors; add merchant keywords to train them
- **Visual breakdowns** — pie charts, bar charts, and trend lines across every tab
- **Detect recurring charges** — find subscriptions and fixed payments
- **Savings planner** — set a goal, choose categories to cut, generate a weekly budget
- **Export your report** — download your full transaction list or a category/monthly summary as CSV

## Authentication

CashCanvas requires an account so your data, learned merchant rules, and custom categories persist across sessions.

| What's stored | Where |
|---|---|
| User credentials | MongoDB `users` collection |
| Upload history | MongoDB `uploaded_files` collection |
| Learned merchant→category rules | MongoDB `merchant_category_rules` collection |
| Custom categories + keywords | MongoDB `custom_categories` collection |

Passwords are hashed with bcrypt. Sessions use JWT (7-day expiry).

## Categorization System

Transactions are categorized in priority order:

1. **User-learned rules** — if you've ever reassigned a merchant, that mapping is applied first (matched by exact cleaned description, merchant prefix, or partial key)
2. **Keyword engine (two-pass)** — first matched against the full cleaned description, then against the extracted core merchant name (first 1–2 meaningful words) to reduce noise
3. **Claude AI fallback** — remaining "Other" transactions are sent to Claude Haiku in batches of 100; the AI is prompted to make a best guess rather than default to "Other"

The description cleaner strips bank boilerplate (POS/ACH prefixes, Visa/Checkcard labels), POS terminal prefixes (SQ\*, TST\*), store numbers, transaction IDs, and US state abbreviations before matching.

## Supported File Formats

| Format | Details |
|--------|---------|
| CSV / TSV | Auto-detects date, description, and amount columns from most banks |
| PDF | Extracts transactions from text-based bank statement PDFs (Chase, Bank of America, Wells Fargo, and most others) |

## Running Locally

### Prerequisites
- Node.js 18+
- A MongoDB instance (local or [MongoDB Atlas](https://www.mongodb.com/atlas) — manageable via [Studio 3T](https://studio3t.com/))
- (Optional) A Google Gemini API key for AI categorization (free at [aistudio.google.com](https://aistudio.google.com))

### Setup

```bash
git clone https://github.com/Param-1210/CashCanvas.git
cd CashCanvas
npm install

# Copy the example env file and fill in your values
cp .env.example .env
```

Edit `.env`:
```
MONGODB_URI=mongodb://localhost:27017        # or your Atlas connection string
JWT_SECRET=your-random-secret-here
GEMINI_API_KEY=your-gemini-key-here        # optional — enables AI categorization
```

### Development

```bash
# Start both the Vite frontend (port 5173) and the API server (port 3001)
npm run dev:full
```

Or run them separately:
```bash
npm run dev       # Vite frontend only
npm run dev:api   # Express API server only
```

Open [http://localhost:5173](http://localhost:5173).

### Deployment (Vercel)

The project is configured for Vercel. The `/api` directory contains serverless functions that mirror the Express dev server. A `vercel.json` rewrite rule routes all `/api/*` requests to the correct handlers.

Set these environment variables in your Vercel project:
- `MONGODB_URI`
- `JWT_SECRET`
- `GEMINI_API_KEY` (optional — enables AI categorization via Gemini 1.5 Flash)
- Transactional email (optional — enables OTP sign-in/sign-up codes and password reset; omit entirely to skip OTP in dev mode). `EMAIL_PROVIDER` selects `gmail` (default) or `resend`:
  - `gmail`: `GMAIL_USER`, `GMAIL_APP_PASSWORD`
  - `resend`: `RESEND_API_KEY`, `EMAIL_FROM` (an address on a domain verified with Resend)
  - either provider: `EMAIL_FROM_NAME` (optional, defaults to "CashCanvas"), `APP_URL`

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/login` | Authenticate, get JWT |
| GET | `/api/auth/profile` | Get current user |
| GET | `/api/categories` | List custom categories |
| POST | `/api/categories` | Create custom category |
| PUT | `/api/categories/:id` | Update category (name, icon, color, keywords) |
| DELETE | `/api/categories/:id` | Delete custom category |
| GET | `/api/merchant-rules` | Get learned merchant→category rules |
| POST | `/api/merchant-rules` | Save/update a merchant rule |
| GET | `/api/files` | List uploaded file history (metadata only) |
| POST | `/api/files` | Save an uploaded file |
| GET | `/api/files/:id` | Get a file with full transaction data |
| DELETE | `/api/files/:id` | Delete a file from history |
| POST | `/api/categorize` | AI-categorize a batch of transactions |

## MongoDB Collections (Studio 3T)

Connect Studio 3T to your `MONGODB_URI` and open the `cashcanvas` database:

| Collection | Schema |
|---|---|
| `users` | `{ _id, name, email, passwordHash, createdAt }` |
| `merchant_category_rules` | `{ userId, merchantName, category, createdAt, updatedAt }` |
| `custom_categories` | `{ userId, categoryName, icon, color, keywords[], createdAt }` |
| `uploaded_files` | `{ userId, fileName, statementType, transactionCount, uploadedAt, transactions[] }` |

## Languages & Tools

| Layer | Technology |
|---|---|
| **Language** | JavaScript (ES2022 modules throughout) |
| **Frontend** | React 18, JSX |
| **Build tool** | Vite 6 |
| **Charts** | Recharts |
| **CSV parsing** | PapaParse |
| **PDF parsing** | PDF.js (via CDN) |
| **Styling** | Inline styles + Google Material Symbols icon font |
| **Backend (dev)** | Node.js, Express 4 |
| **Backend (prod)** | Vercel Serverless Functions |
| **Database** | MongoDB 6 (Atlas) |
| **Auth** | JWT (`jsonwebtoken`), bcrypt (`bcryptjs`) |
| **AI** | Google Gemini API (gemini-1.5-flash, free tier) |
| **Utility** | Lodash |
| **Dev tooling** | concurrently, `@vitejs/plugin-react` |
