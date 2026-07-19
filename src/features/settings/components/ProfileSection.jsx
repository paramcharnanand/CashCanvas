import { Card } from "../../../components/ui/Card.jsx";

/**
 * Read-only account info — consolidates what the audit found completely
 * missing (no Settings, no Profile screen existed at all). Name/email are
 * read-only for now, matching current backend capability (no PUT
 * /api/auth/profile route exists yet) — not a scope cut made silently,
 * per docs/frontend/phase-8-migration-plan.md's Phase 9 wording itself
 * ("account info (name, email — read-only for now, matching current
 * backend capability)").
 */
export function ProfileSection({ user }) {
  return (
    <Card style={{ marginBottom: "var(--space-5)" }}>
      <h2 style={{ font: "var(--text-heading-sm)", color: "var(--text)", margin: "0 0 var(--space-4)" }}>Account</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div>
          <div style={{ font: "var(--text-label)", color: "var(--text-subtle)", marginBottom: 4 }}>Name</div>
          <div style={{ font: "var(--text-body-md)", color: "var(--text)" }}>{user?.name}</div>
        </div>
        <div>
          <div style={{ font: "var(--text-label)", color: "var(--text-subtle)", marginBottom: 4 }}>Email</div>
          <div style={{ font: "var(--text-body-md)", color: "var(--text)" }}>{user?.email}</div>
        </div>
      </div>
    </Card>
  );
}
