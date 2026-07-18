import { Link } from "react-router-dom";

/**
 * Mounted at "*" (see router.jsx) — any path that doesn't match a real
 * route. Previously this silently `<Navigate to="/" replace>`-ed, which
 * is also how a genuine deep link like /reset-password?token=... got lost
 * (see ROADMAP.md's Phase 8.2 hotfix note); a real page tells a visitor
 * what happened instead of bouncing them with no explanation.
 */
export default function NotFoundPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-4)",
        fontFamily: "var(--font-body)",
        color: "var(--text)",
        textAlign: "center",
        padding: "var(--space-6)",
      }}
    >
      <div style={{ font: "var(--text-display-xl)", color: "var(--text-subtle)" }}>
        404
      </div>
      <h1 style={{ font: "var(--text-heading-md)", margin: 0 }}>Page not found</h1>
      <p style={{ color: "var(--text-subtle)", fontSize: 14, maxWidth: 360 }}>
        The page you&rsquo;re looking for doesn&rsquo;t exist or may have moved.
      </p>
      <Link
        to="/"
        style={{
          marginTop: "var(--space-2)",
          height: 40,
          padding: "0 var(--space-5)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "var(--radius-md)",
          background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)",
          color: "var(--on-primary)",
          fontFamily: "var(--font-body)",
          fontWeight: 600,
          fontSize: 13,
          textDecoration: "none",
        }}
      >
        Go home
      </Link>
    </div>
  );
}
