/**
 * Design-system EmptyState primitive — see docs/frontend/
 * phase-8-design-system.md § Components > Empty states. Replaces today's
 * one-off plain sentences ("No recurring payments detected", "No
 * transactions yet") with a consistent icon/headline/body/action shape,
 * applied deliberately per screen rather than left as default absence.
 */
export function EmptyState({ icon: Icon, headline, body, action }) {
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
        <div style={{ font: "var(--text-heading-sm)", color: "var(--text)", marginBottom: "var(--space-1)" }}>
          {headline}
        </div>
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
