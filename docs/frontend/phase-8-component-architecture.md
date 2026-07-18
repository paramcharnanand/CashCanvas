# Phase 8 — Component Architecture

Step 3 of Phase 8. Turns the design-system spec (`phase-8-design-system.md`) into a real file
structure, following Feature-Sliced Design as requested. Also specifies the routing/navigation
architecture, since the requested browser-history fixes are only possible once real routing
exists — today there is exactly **zero** routing in this app (confirmed: `App.jsx` picks one of
`AuthScreen`/`UploadScreen`/`Dashboard` from raw `useState`, `Dashboard` picks one of 4 tabs the
same way; the *only* URL-aware code anywhere is `AuthScreen.jsx:666–668`, which reads
`window.location.search`/`pathname` once on mount to sniff a password-reset link — not a route,
just a one-time check). "Fix the back button" is really "introduce the missing mechanism."

## Why Feature-Sliced Design fits here specifically

The audit's root finding was that `App.jsx` mixes at least four different concerns in one 3,059-line
file: UI (every screen), pure business logic (categorization, CSV/PDF parsing), API calls, and
state management — with no boundary between any of them. FSD's `features/*` slicing is the direct
fix: each feature owns its UI, its local state, and its API calls together, while `utils/`
carries the pure logic (parsing, categorization, formatting) that has no business being
feature- or UI-specific in the first place.

## File structure

```
src/
├── components/
│   └── ui/                    # Design-system primitives (Step 2) — feature-agnostic, no API calls
│       ├── Button.jsx
│       ├── Field.jsx          # kept from today, audit confirmed it's already good
│       ├── Checkbox.jsx
│       ├── Slider.jsx
│       ├── Card.jsx
│       ├── Table.jsx
│       ├── Dialog.jsx
│       ├── Toast.jsx / ToastStack.jsx
│       ├── Skeleton.jsx       # SkeletonText, SkeletonCard, SkeletonTable, SkeletonStat
│       ├── EmptyState.jsx
│       ├── ErrorState.jsx
│       ├── ChartTooltip.jsx
│       ├── StatCard.jsx       # kept from today, already well-factored
│       ├── OtpInput.jsx       # extracted from today's OtpScreen digit-input pattern (audit: good UX, worth generalizing)
│       └── Spinner.jsx        # kept from today as-is
│
├── layouts/
│   ├── AppShell.jsx           # authenticated shell: header (logo+Link, user menu), Sidebar (≥lg) / TabBar (<lg), content outlet
│   ├── AuthShell.jsx          # kept from today (wordmark + card + privacy line), now also wraps Landing's header
│   ├── Sidebar.jsx            # new — see Responsive Grid, design-system.md
│   └── MobileNav.jsx          # new — bottom bar (<md), see Responsive Grid
│
├── hooks/
│   ├── useAuth.js             # thin wrapper over AuthContext
│   ├── useTheme.js            # light/dark/system, localStorage-backed
│   ├── useBreakpoint.js       # replaces today's single useIsMobile() boolean with the real --bp-* scale
│   ├── useToast.js            # thin wrapper over ToastContext
│   ├── useFocusTrap.js        # for Dialog
│   ├── useMediaQuery.js       # underlies useBreakpoint + prefers-reduced-motion checks
│   └── useDebounce.js         # new — needed by Transactions' real search (Step 4 scope decision)
│
├── contexts/
│   ├── AuthContext.jsx        # replaces today's prop-drilled auth/onLogout threaded through every component
│   ├── ThemeContext.jsx
│   └── ToastContext.jsx
│
├── features/
│   ├── auth/
│   │   ├── components/        # LoginForm, SignupForm, OtpScreen, ForgotPasswordForm, ResetPasswordForm (kept, restyled)
│   │   ├── api.js              # signup/login/verify-otp/resend-otp/forgot/reset — thin wrappers over services/authApi.js
│   │   └── index.js
│   ├── landing/
│   │   └── components/        # Hero, ProductPreview, FeatureGrid — new, see Step 6 mockup
│   ├── dashboard/
│   │   └── components/        # StatsSummary, RecentActivity, RecurringPayments — the *lightweight* summary (see below)
│   ├── analytics/
│   │   └── components/        # SpendingDonut, MonthlyBarChart, CashFlowLine — pulled out of today's monolithic Overview tab
│   ├── transactions/
│   │   ├── components/        # TransactionTable, TransactionFilters, ReassignDialog
│   │   ├── hooks/              # useTransactionSearch (new — Step 4 scope decision)
│   │   └── api.js
│   ├── categories/
│   │   ├── components/        # CategoryGrid, CategoryCard, NewCategoryDialog, UncategorizedPanel
│   │   └── api.js
│   ├── merchant-rules/         # new — Step 4 scope decision
│   │   ├── components/        # RuleList, RuleRow
│   │   └── api.js
│   ├── upload/
│   │   ├── components/        # DropZone (real keyboard/focus support — audit §2 fix), FileHistory
│   │   └── api.js
│   ├── savings/
│   │   ├── components/        # GoalForm, CutPlanner (logic kept, audit confirmed it's the app's best client logic)
│   │   └── api.js              # new — Step 4 scope decision (persistence, closes ADR-007)
│   └── settings/
│       ├── components/        # ProfileSection, DeleteAccountDialog, ThemeToggle
│       └── api.js
│
├── pages/                      # thin route-level components — compose a layout + one feature, no logic of their own
│   ├── LandingPage.jsx
│   ├── LoginPage.jsx
│   ├── SignupPage.jsx
│   ├── ForgotPasswordPage.jsx
│   ├── ResetPasswordPage.jsx
│   ├── DashboardPage.jsx
│   ├── AnalyticsPage.jsx
│   ├── TransactionsPage.jsx
│   ├── CategoriesPage.jsx
│   ├── MerchantRulesPage.jsx
│   ├── UploadPage.jsx
│   ├── SavingsPage.jsx
│   ├── SettingsPage.jsx
│   └── NotFoundPage.jsx
│
├── services/                    # API layer — kept flat, matching the backend's own 3-route shape
│   ├── http.js                  # today's api.js (apiFetch, CSRF header, silent-refresh-on-401) — kept nearly as-is, it's already good
│   ├── authApi.js
│   ├── dataApi.js               # files/categories/merchant-rules/savings — mirrors api/data.js's route grouping
│   └── aiApi.js                 # categorize/parse-pdf — mirrors api/ai.js
│
├── utils/                        # pure logic extracted out of App.jsx — the audit's biggest non-visual finding
│   ├── categorization.js         # categorize, cleanDesc, diceCoefficient, extractMerchant
│   ├── csv.js                    # detectColumns, parseAmount, parseDate, CSV row parsing
│   ├── csvExport.js              # buildTransactionsCsv, buildSummaryCsv, downloadCsv
│   ├── format.js                 # fmt() and friends — the money/date formatting used everywhere
│   └── pdf/                      # the entire PDF parsing engine, big enough for its own folder
│       ├── loadPdfJs.js
│       ├── lineBuilder.js         # buildLines, yTolerance logic
│       ├── dateAmount.js          # findDate, findAmounts, inferYearFromLines
│       ├── statementType.js       # detectStatementType, isHeaderLine, isJunkLine
│       └── strategies.js          # strategySingleLine, strategyMultiLine, extractDescFromLine
│
├── styles/
│   ├── tokens.css                 # the consolidated token file drafted in phase-8-design-system.md
│   └── globals.css                 # resets, focus-visible defaults, font-face — replaces index.html's inline <style>
│
├── assets/
│   └── fonts/                      # self-hosted Newsreader/Manrope/Inter woff2 — see "Self-hosting fonts" below
│
├── router.jsx                      # route table (below)
└── App.jsx                          # now just <RouterProvider> + top-level providers — was 3,059 lines, becomes ~30
```

## Composition over inheritance

No class components, no HOC-wrapping chains. Two patterns cover everything in this app:

- **Compound components** for anything with internal coordinated state — `Dialog` (`Dialog.Root`,
  `Dialog.Trigger`, `Dialog.Content`) instead of the current three separately-hand-rolled modal
  shells; `Table` (`Table.Root`, `Table.Header`, `Table.Row`) so a feature can compose exactly the
  columns it needs without the primitive knowing about transactions or categories.
- **Hooks for shared behavior, components for shared UI** — `useTransactionSearch` is a hook (no
  UI opinion), `TransactionFilters` is a component that uses it. Never a hook that returns JSX,
  never a component that owns business logic it doesn't render.

**Primitives first**: Step 6's mockups and Step 4's actual rewrite both build `components/ui/`
completely before any `features/*` component — every feature-level component is composition of
primitives, never a new one-off styled element. This is the direct fix for the audit's most
common finding (the same card/shadow/radius/padding triplet hand-typed ~20+ times).

## Routing architecture

**React Router v6** (`react-router-dom`), `createBrowserRouter` (data-router API, not the legacy
`<BrowserRouter>`+`<Routes>` pairing — gives real loader/error-boundary integration per route,
useful for the skeleton-loading states § the design system defines).

### Route table

| Path | Page | Auth |
|---|---|---|
| `/` | `LandingPage` (unauthenticated) → redirects to `/dashboard` if already authenticated | public |
| `/login` | `LoginPage` | public, redirects to `/dashboard` if authenticated |
| `/signup` | `SignupPage` | public, redirects to `/dashboard` if authenticated |
| `/forgot-password` | `ForgotPasswordPage` | public |
| `/reset-password` | `ResetPasswordPage` — reads `?token=` via `useSearchParams()`, replacing today's manual `window.location.search` sniff | public |
| `/dashboard` | `DashboardPage` | protected |
| `/analytics` | `AnalyticsPage` | protected |
| `/transactions` | `TransactionsPage` | protected — **newly a real route**; today only reachable via a stat-card click, unbookmarkable, lost on refresh |
| `/categories` | `CategoriesPage` | protected |
| `/merchant-rules` | `MerchantRulesPage` | protected — new screen, Step 4 scope decision |
| `/upload` | `UploadPage` | protected |
| `/savings` | `SavingsPage` | protected |
| `/settings`, `/settings/profile` | `SettingsPage` | protected |
| `*` | `NotFoundPage` | — |

**Architectural decision made here, not silently inherited**: today, a signed-in user with no
uploaded data sees an entirely different screen (`UploadScreen`) instead of the dashboard —
there's no `/dashboard` route to even redirect *to*. Once routing is real, `/dashboard` always
exists; a user with no data sees `DashboardPage` render its `EmptyState` (design system §
Components) with an upload call-to-action, rather than being routed to a categorically different
page. `/upload` becomes a normal, always-reachable route (e.g. "upload another statement" from
Settings or the dashboard header), not a gate. This is a real UX change worth flagging, not just
a technical one — it matches the "surface the summary before the detail" dashboard pattern Step 5
identifies in Linear/Notion/Vercel.

### Protected routes

`<ProtectedRoute>` wraps every authenticated route: reads `AuthContext`, redirects to
`/login?redirect=<attempted-path>` if unauthenticated, and — critically — `LoginPage` reads that
`redirect` param and `navigate()`s there after a successful login instead of always landing on
`/dashboard`. This is what makes a deep link like `/transactions` actually useful when someone
isn't logged in yet, rather than losing the destination.

### Fixing the specific requests

- **Logo always clickable, never reloads**: the wordmark in `AppShell`/`AuthShell`'s header
  becomes `<Link to={isAuthenticated ? "/dashboard" : "/"}>Cash<em>Canvas</em></Link>` — client-side
  navigation, zero network request for the shell itself (only the new route's data, if any,
  fetches).
- **Browser Back/Forward work like a real SPA**: this falls out of using `<Link>`/`navigate()`
  everywhere instead of state — `BrowserRouter` uses the real History API, so every navigation is
  a real history entry, and Back/Forward move between them exactly as requested (`Settings →
  Transactions → Dashboard → Login → Landing`, then off-site only after that). Nothing extra
  needs to be built for this — it's what React Router does by construction, once it's the thing
  driving navigation instead of `useState`.
- **No `window.location`/`location.href`/`location.replace`**: audited the current codebase for
  existing usage (found: `AuthScreen.jsx:506` — `window.history.replaceState({}, "", "/")` after a
  successful password reset, and `:666–668`'s read-only sniffing). Both are replaced —
  `replaceState` becomes `navigate("/login", { replace: true })`, the sniff becomes
  `useSearchParams()` on the `/reset-password` route. No other call sites exist today, so this is
  a small, contained change, not a sweeping one.
- **Active navigation state**: `<NavLink>` (React Router's variant that applies an `active`
  class/style automatically based on the current URL) replaces today's manual
  `tab === "X" ? activeStyle : null` comparison in `TabBar` — same visual, driven by the URL. A
  direct side benefit: refreshing the page now preserves which section you're on, which today's
  `useState`-based `tab` cannot do (refresh always resets to Overview).
- **Breadcrumb**: for nested contexts only (e.g. `Settings → Profile`) — most of this app is
  flat (one level of navigation), so a full breadcrumb trail everywhere would be decorative, not
  informative (per the design-system's "structure encodes real information" principle). `NavLink`
  active-state highlighting is the primary "where am I" signal; a breadcrumb appears only where
  there's real hierarchy to show.

### Self-hosting fonts

Noted here since `assets/fonts/` depends on it: Phase 8 moves off the Google Fonts CDN `<link>`
tags in `index.html` (the same reasoning as dropping Material Symbols for Lucide — one fewer
external runtime dependency, and it removes the render-blocking font `<link>` round-trip). Fonts
self-hosted as `woff2`, loaded via `@font-face` in `styles/globals.css` with `font-display: swap`.
This session already has a working example of exactly this — the Step 2 design-system reference
artifact inlines the same three families as base64 `@font-face` data URIs — the actual app will
serve them as real static files instead (data-URI inlining was an artifact-specific constraint, not
the production approach).

## Where existing logic goes (migration map)

| Today (`App.jsx` line range) | Moves to |
|---|---|
| `theme` object, `font`/`fontMono`/`fontHeadline` (328–352) | `styles/tokens.css` |
| `useIsMobile` (356–364) | `hooks/useBreakpoint.js` (expanded) |
| `StatCard`, `TabBar`, `SectionTitle` (368–420) | `components/ui/` |
| `cleanDesc`, `diceCoefficient`, `extractMerchant`, `categorize` (170–280) | `utils/categorization.js` |
| `parseAmount`, `parseDate`, `detectColumns` (281–327) | `utils/csv.js` |
| PDF engine (427–869) | `utils/pdf/` |
| `DeleteAccountModal` (871–932) | `features/settings/components/DeleteAccountDialog.jsx`, rebuilt on `components/ui/Dialog` |
| `UploadScreen` (934–1299) | `pages/UploadPage.jsx` + `features/upload/` |
| `generateSampleData` (1301–1355) | `utils/sampleData.js` |
| `CustomTooltip` (1357–1375) | `components/ui/ChartTooltip.jsx` |
| `buildTransactionsCsv`/`buildSummaryCsv`/`downloadCsv` (1377–1422) | `utils/csvExport.js` |
| `Dashboard`'s Overview charts (1744–1831) | `pages/AnalyticsPage.jsx` + `features/analytics/` |
| `Dashboard`'s Overview stats/lists (1721–1743, 1832–1926) | `pages/DashboardPage.jsx` + `features/dashboard/` |
| `Dashboard`'s Transactions tab (1929–2138) | `pages/TransactionsPage.jsx` + `features/transactions/` |
| `Dashboard`'s Categories tab (2141–2467) | `pages/CategoriesPage.jsx` + `features/categories/` |
| *(merchant-rule creation, currently inline in the above two)* | `features/merchant-rules/api.js`, surfaced in a real `pages/MerchantRulesPage.jsx` |
| `Dashboard`'s Savings tab (2470–2925) | `pages/SavingsPage.jsx` + `features/savings/` |
| `App` root (2926–3059) | `router.jsx` (route table) + `contexts/AuthContext.jsx` (the auth-check/auto-restore effects) + a ~30-line `App.jsx` |
| `AuthScreen.jsx` in full | `features/auth/components/`, `pages/{Login,Signup,ForgotPassword,ResetPassword}Page.jsx` |

## No hardcoded values, enforced

Per the design system's "Design Tokens" rule: an ESLint rule (new, scoped to `src/**`) flags any
raw hex color (`/#[0-9a-f]{3,8}/i`) or bare pixel literal in a `style={{}}` object or styled
value outside `styles/tokens.css` itself. This is additive to Phase 7's existing lint config
(`eslint.config.js`), not a replacement — matches ADR-016's precedent of scoping new rules
narrowly rather than adopting a stricter ruleset wholesale.

---

Next: Step 4 (Rewrite Migration Plan) — the order screens actually get rebuilt in, and exactly
how each step keeps the Phase 6 Playwright suite green throughout.
