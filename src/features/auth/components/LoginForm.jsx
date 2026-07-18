import { useState } from "react";
import { Link } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
import { Field } from "../../../components/ui/Field.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { useCredentialsForm } from "../hooks/useCredentialsForm.js";

/**
 * Mounted inside LoginPage.jsx (see router.jsx's /login route). Restyled
 * onto design-system primitives — same fields/copy/behavior as
 * AuthScreen.jsx's login mode, including both "Forgot password?" entry
 * points (inline link and the "Need help signing in?" panel), preserved
 * exactly rather than simplified, per the migration plan's "no structural
 * changes" constraint for this phase.
 */
export function LoginForm({ onAuth, onOtpRequired }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const { email, setEmail, password, setPassword, fieldErrors, loading, handleSubmit } =
    useCredentialsForm({ mode: "login", onAuth, onOtpRequired });

  return (
    <div>
      <div style={{ display: "flex", background: "var(--surface-alt)", borderRadius: "var(--radius-md)", padding: 4, marginBottom: "var(--space-8)" }}>
        <div
          style={{
            flex: 1, padding: "var(--space-2)", borderRadius: "var(--radius-sm)",
            background: "var(--surface)", color: "var(--primary)",
            font: "var(--text-body-sm)", fontWeight: 600, textAlign: "center",
            boxShadow: "var(--elevation-1)",
          }}
        >
          Sign In
        </div>
        <Link
          to="/signup"
          style={{
            flex: 1, padding: "var(--space-2)", borderRadius: "var(--radius-sm)",
            color: "var(--text-subtle)", font: "var(--text-body-sm)",
            textAlign: "center", textDecoration: "none",
          }}
        >
          Create Account
        </Link>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <Field
          label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com" autoComplete="username" error={fieldErrors.email}
        />
        <Field
          label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password" autoComplete="current-password" error={fieldErrors.password}
          showToggle
        />

        <div style={{ textAlign: "right", marginTop: -8, marginBottom: "var(--space-4)" }}>
          <Link
            to="/forgot-password"
            style={{ font: "var(--text-body-sm)", color: "var(--primary)", textDecoration: "underline", textUnderlineOffset: 2 }}
          >
            Forgot password?
          </Link>
        </div>

        {fieldErrors.form && (
          <div
            style={{
              padding: "10px 14px", borderRadius: "var(--radius-sm)", marginBottom: "var(--space-4)",
              background: "var(--negative-soft)", border: "1px solid var(--negative)",
              font: "var(--text-body-sm)", color: "var(--negative)",
            }}
          >
            {fieldErrors.form}
          </div>
        )}

        <Button type="submit" variant="primary" loading={loading} style={{ width: "100%", marginTop: 4 }}>
          {loading ? "Please wait…" : "Sign In"}
        </Button>

        <div style={{ marginTop: "var(--space-5)", textAlign: "center" }}>
          <button
            type="button"
            onClick={() => setHelpOpen((v) => !v)}
            style={{
              background: "none", border: "none", color: "var(--text-subtle)",
              font: "var(--text-body-sm)", cursor: "pointer",
              textDecoration: "underline", textUnderlineOffset: 3, padding: 0,
            }}
          >
            Need help signing in?
          </button>

          {helpOpen && (
            <div
              style={{
                marginTop: "var(--space-3)", padding: "var(--space-4)", borderRadius: "var(--radius-md)",
                background: "var(--surface-alt)", border: "1px solid var(--border)", textAlign: "left",
              }}
            >
              <div style={{ font: "var(--text-label)", color: "var(--text-subtle)", marginBottom: "var(--space-3)" }}>
                Help options
              </div>
              <Link
                to="/forgot-password"
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  color: "var(--primary)", font: "var(--text-body-sm)", fontWeight: 500, textDecoration: "none",
                }}
              >
                <LockKeyhole size={16} strokeWidth={1.75} aria-hidden="true" />
                Forgot your password? Get a reset link
              </Link>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
