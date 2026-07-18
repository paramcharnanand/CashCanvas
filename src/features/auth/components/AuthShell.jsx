import { Link } from "react-router-dom";

/**
 * Layout shell shared by every auth screen (login, signup, otp, forgot-
 * password, reset-password) — the wordmark + card + privacy footer, ported
 * from the pre-Phase-8 AuthScreen.jsx's own `AuthShell` onto design tokens.
 * The wordmark is a real `<Link to="/">`, not static text — "logo always
 * navigates home" applies here too, not just the authenticated shell.
 */
export function AuthShell({ children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-body)",
        padding: "var(--space-6)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: "var(--space-10)" }}>
          <Link
            to="/"
            style={{
              display: "inline-block",
              font: "var(--text-display-md)",
              color: "var(--text)",
              textDecoration: "none",
              lineHeight: 1,
            }}
          >
            Cash<span style={{ color: "var(--primary)" }}>Canvas</span>
          </Link>
          <p style={{ font: "var(--text-body-sm)", color: "var(--text-subtle)", margin: "var(--space-3) 0 0" }}>
            Your personal finance dashboard
          </p>
        </div>

        <div
          style={{
            background: "var(--surface)",
            borderRadius: "var(--radius-lg)",
            padding: "var(--space-8) clamp(20px, 6vw, 40px)",
            boxShadow: "var(--elevation-3)",
            border: "var(--card-border, none)",
          }}
        >
          {children}
        </div>

        <p style={{ textAlign: "center", font: "var(--text-body-sm)", color: "var(--text-subtle)", marginTop: "var(--space-5)" }}>
          Your data stays private — no selling, no sharing.
        </p>
      </div>
    </div>
  );
}
