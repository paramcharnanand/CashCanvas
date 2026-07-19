/**
 * Design-system EmptyState primitive — see docs/frontend/
 * phase-8-design-system.md § Components > Empty states. Replaces today's
 * one-off plain sentences ("No recurring payments detected", "No
 * transactions yet") with a consistent icon/headline/body/action shape,
 * applied deliberately per screen rather than left as default absence.
 *
 * `headingLevel` (e.g. "h1"): a page whose empty state is an early return
 * (no separate page-level `<h1>` reached in that branch — Dashboard/
 * Savings/Transactions/Categories/Analytics all do this) passes this so
 * `headline` renders as a real heading instead of a plain `<div>` — found
 * as a real, systemic `page-has-heading-one` a11y gap in Phase 10 (final
 * cleanup), not assumed. Left unset (default) for in-panel usages
 * (`CategoryGrid`, `UncategorizedPanel`, `RecentActivity`) where the page
 * already has its own `<h1>` elsewhere and promoting this text to a heading
 * would be a level jump, not a fix.
 */
export function EmptyState({ icon: Icon, headline, body, action, headingLevel }) {
  const Headline = headingLevel || "div";
  return (
    <div style={{ textAlign: "center", padding: "var(--space-6) var(--space-4)" }}>
      {Icon && (
        <Icon
          size={32}
          strokeWidth={1.5}
          color="var(--text-subtle)"
          aria-hidden="true"
          style={{ marginBottom: "var(--space-3)" }}
        />
      )}
      {headline && (
        <Headline style={{ font: "var(--text-heading-sm)", color: "var(--text)", marginBottom: "var(--space-1)" }}>
          {headline}
        </Headline>
      )}
      {body && (
        <p style={{ font: "var(--text-body-sm)", color: "var(--text-subtle)", margin: 0 }}>
          {body}
        </p>
      )}
      {action && <div style={{ marginTop: "var(--space-4)" }}>{action}</div>}
    </div>
  );
}
