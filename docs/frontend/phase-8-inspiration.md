# Phase 8 — UX Inspiration

Step 5 of Phase 8. UX patterns, not visual style — nothing here should make CashCanvas look like
any of these products; the "Ledger" identity (Step 2) stays fixed. The question asked of each
product is narrower than "what does it look like": *what specific interaction decision makes it
feel fast/trustworthy/considered*, and does that decision solve a real, already-identified
CashCanvas problem.

## Per-product analysis

**Stripe Dashboard** — feels polished because detail never costs you your place in a list.
Clicking a row (a charge, a customer) opens a slide-over panel over the current view, not a
navigation away from it — you can compare three rows without losing your scroll position or
filters. Status is always encoded redundantly (a colored dot *and* a text label, never color
alone — directly matches the design system's colorblindness rule, independently arrived at by
Stripe for the same reason: real users, not just an accessibility checkbox).

**Mercury** — feels polished because it trusts typography to carry weight instead of chrome. Very
little visual noise around a balance number; the number itself is large, tabular, confident.
Mercury doesn't decorate trust, it removes distractions from it.

**Ramp** — feels polished because automation shows its work. Every auto-categorized expense
displays *why* (a rule, a merchant match) with one click to override — the system earns
confidence by being inspectable, not just "correct most of the time" silently. Necessary but
tedious tasks (missing receipts, uncategorized spend) are framed as a completion count, not a
guilt-inducing red badge.

**Linear** — feels polished because every action responds before the network does. State updates
optimistically (a status change, a priority edit) and only reconciles with the server after —
nothing in Linear's UI ever visibly "waits." Color is otherwise almost entirely absent — used
only for priority/status, never decoration — so the few colored things always mean something.

**Raycast** — feels polished because the entire product is one interaction model (a searchable
command list) applied consistently, not a different pattern per screen. Keyboard-first isn't a
mode you opt into, it's simply how the product works, with the mouse as the secondary path.

**Notion** — feels polished because complexity is opt-in. The default surface is simple (a
document, a list); power (databases, formulas, slash commands) is discoverable exactly when
you reach for it, never front-loaded. Editing happens in place — click text, it becomes an input,
no separate "edit mode."

**Vercel** — feels polished because it shows value before asking for commitment (a deploy preview
exists before you've configured anything real), and status is a clear timeline
(queued → building → ready) rather than a spinner with no information.

**Framer** — feels polished because the editing surface *is* the output — no separate
preview/build step to trust. Motion is used deliberately to demonstrate capability, never as
ambient decoration.

## Patterns applied to CashCanvas (specific, not generic)

| Pattern | Source | Applied to |
|---|---|---|
| **Slide-over detail, not navigate-away** | Stripe | Clicking a transaction row opens a detail panel (full description, matched merchant rule, one-click recategorize) over the Transactions list — replacing today's small reassign-only modal, without losing the current search/filter state (Phase 6 of the migration plan). |
| **Redundant status encoding (color + label/shape), never color-alone** | Stripe, Linear | Already a design-system rule (Charts § color blindness) — reinforced here as a UI-wide principle: category pills always show text, not just a color swatch; income/expense direction uses an icon (`ArrowUpRight`/`ArrowDownRight`) *and* color, never color alone. |
| **Typography-led numbers, minimal chrome around them** | Mercury | Dashboard's stat cards and hero already lean this way (audit confirmed it's one of the app's stronger moments) — Step 6's mockups push further: less card decoration, more reliance on the `--text-numeral-*` scale itself to carry weight. |
| **Automation shows its work** | Ramp | Directly informs the new Merchant Rules screen's actual value: not just a list to delete from, but *why* a transaction was auto-categorized ("Matched rule: Whole Foods → Groceries") shown inline in the Transactions detail panel above — closes a real trust gap the audit didn't originally name but is the same root cause as the audit's "merchant rules are invisible" finding (§0). |
| **Completion framing, not guilt framing** | Ramp | The existing "Categorized 82%" bar (audit confirmed this pattern already exists and works) extends to a first-run checklist on the new Dashboard empty state ("Upload a statement", "Review 3 uncategorized transactions", "Set a savings goal") — progress, not nagging. |
| **Optimistic UI** | Linear | Every mutating action that's currently fire-and-forget with a silent `.catch(() => {})` (creating a category, saving a keyword, reassigning a transaction) updates the UI immediately and reconciles after — paired with the new Toast system for the rare failure case, instead of either a loading spinner or silence. |
| **Command palette (Cmd/Ctrl+K)** | Linear, Raycast, Vercel, Notion | New, and directly useful now that real routing exists (Step 3): jump to any section (Transactions, Categories, Settings), or run a quick action ("Upload a statement", "Create category"). Scoped as a genuine but secondary affordance — CashCanvas is not a keyboard-first power tool the way Linear/Raycast are, so this supplements the sidebar/tab navigation, it doesn't replace it. |
| **Inline editing in place** | Notion, Ramp | Category rename and keyword editing already work this way (audit confirmed) — extended to the new Settings/Profile fields and the Savings goal form, replacing any remaining separate "edit mode" toggles. |
| **Progressive disclosure** | Notion | The Transactions page's new filters (search, category, date range — Phase 6 of the migration plan) stay collapsed/simple by default, expanding only when a user actually filters — never a permanently-visible dense filter bar for an app whose default use case (scan recent spending) doesn't need one. |
| **Show value before commitment** | Vercel | "Try with sample data" already exists and is a good instinct (audit confirmed) — Step 6's Landing/onboarding mockups make it the primary path for a new, uncertain visitor, ahead of "Create Account," matching Vercel's instinct to demonstrate before asking. |
| **Status as a timeline, not a bare spinner** | Vercel | The Upload flow's `loadingMsg` string swap (audit §2: "no percentage, no real progress signal") becomes a short real sequence (Reading file → Detecting columns → Categorizing → Done) — still lightweight, but legible instead of an opaque wait. |

## What's deliberately *not* borrowed

- **Monochrome-only UI** (Linear's near-total absence of color): CashCanvas's warm palette is the
  point (Step 2's explicit direction) — color is more present here than in Linear by design, just
  disciplined (reserved for data/semantics, never decoration), not eliminated.
- **Command-palette-as-primary-navigation** (Raycast's full keyboard-first model): CashCanvas
  keeps a visible sidebar/tab bar as the primary path — the command palette is a secondary
  accelerator, not the only way to move around, since this is a personal finance app used
  occasionally, not a daily power tool its users will memorize shortcuts for.
- **Block-based flexible composition** (Notion's core editing model): irrelevant here — CashCanvas
  has fixed, purposeful screens, not user-authored documents.

---

Next: Step 6 (Mockups) — applying every decision from Steps 2–5 to real screens, before any
production component is written.
