import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LockKeyhole, ShieldAlert } from "lucide-react";
import { Field } from "../../../components/ui/Field.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { useCredentialsForm } from "../hooks/useCredentialsForm.js";
import { useCountdown } from "../hooks/useCountdown.js";

/**
 * Mounted inside LoginPage.jsx (see router.jsx's /login route). Restyled
 * onto design-system primitives — same fields/copy/behavior as
 * AuthScreen.jsx's login mode, including both "Forgot password?" entry
 * points (inline link and the "Need help signing in?" panel), preserved
 * exactly rather than simplified, per the migration plan's "no structural
 * changes" constraint for this phase.
 *
 * Lockout UX (api/_lib/loginLockout.js drives the actual policy — this only
 * renders whatever state the server reports): a 15-minute cooldown after
 * the 4th consecutive wrong password disables Sign In with a live
 * countdown; a second 4-strike cycle (or a frozen account) replaces the
 * form with a "reset your password" panel, since the server won't accept
 * any password at that tier regardless of what's typed.
 */
export function LoginForm({ onAuth, onOtpRequired }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const { email, setEmail, password, setPassword, fieldErrors, setFieldErrors, loading, lockout, setLockout, handleSubmit } =
    useCredentialsForm({ mode: "login", onAuth, onOtpRequired });

  const cooldown = useCountdown(lockout?.type === "cooldown" ? lockout.until : null);
  const cooldownActive = lockout?.type === "cooldown" && !cooldown.expired;

  // The server is the source of truth for whether the cooldown is actually
  // over — this just stops disabling the button once the client's own clock
  // agrees, so the next real submit can go through immediately.
  useEffect(() => {
    if (lockout?.type === "cooldown" && cooldown.expired) {
      setLockout(null);
      setFieldErrors((p) => ({ ...p, form: "" }));
    }
  }, [lockout, cooldown.expired, setLockout, setFieldErrors]);

  const backToSignIn = () => {
    setLockout(null);
    setFieldErrors((p) => ({ ...p, form: "" }));
  };

  if (lockout?.type === "resetRequired" || lockout?.type === "frozen") {
    return (
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 56, height: 56, borderRadius: "50%", background: "var(--negative-soft)",
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto var(--space-5)",
          }}
        >
          <ShieldAlert size={28} strokeWidth={1.75} color="var(--negative)" aria-hidden="true" />
        </div>
        <h2 style={{ font: "var(--text-heading-lg)", color: "var(--text)", margin: "0 0 var(--space-2)" }}>
          {lockout.type === "frozen" ? "Account temporarily frozen" : "Password reset required"}
        </h2>
        <p style={{ font: "var(--text-body-sm)", color: "var(--text-subtle)", margin: "0 0 var(--space-8)", lineHeight: 1.6 }}>
          {lockout.type === "frozen"
            ? "For your security, this account is temporarily frozen. Please reset your password to continue."
            : "For your security, please reset your password before trying again."}
        </p>
        <Link
          to="/forgot-password"
          style={{
            width: "100%", height: 40, boxSizing: "border-box",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            borderRadius: "var(--radius-md)",
            background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)",
            color: "var(--on-primary)", font: "var(--text-body-sm)", fontWeight: 600, textDecoration: "none",
          }}
        >
          <LockKeyhole size={16} strokeWidth={1.75} aria-hidden="true" />
          Reset password
        </Link>
        <div style={{ marginTop: "var(--space-4)" }}>
          <button
            type="button"
            onClick={backToSignIn}
            style={{
              background: "none", border: "none", color: "var(--text-subtle)",
              font: "var(--text-body-sm)", cursor: "pointer",
              textDecoration: "underline", textUnderlineOffset: 3, padding: 0,
            }}
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

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
            {cooldownActive && (
              <div style={{ marginTop: 4, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                Time remaining: {cooldown.label}
              </div>
            )}
          </div>
        )}

        <Button
          type="submit" variant="primary" loading={loading} disabled={cooldownActive}
          style={{ width: "100%", marginTop: 4 }}
        >
          {cooldownActive ? `Try again in ${cooldown.label}` : loading ? "Please wait…" : "Sign In"}
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
