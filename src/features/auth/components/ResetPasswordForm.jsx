import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { apiFetch } from "../../../api.js";
import { Field } from "../../../components/ui/Field.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { OtpInput } from "../../../components/ui/OtpInput.jsx";

/**
 * Mounted inside ResetPasswordPage.jsx (see router.jsx's /reset-password
 * route). Restyled from AuthScreen.jsx's ResetPasswordScreen — reads
 * `?token=` via useSearchParams at the page level (ResetPasswordPage.jsx),
 * passed down as a prop, replacing the old manual
 * `window.location.search` sniff per the migration plan's stated Phase 2
 * scope. Same single-submit validation (code + both password fields
 * together, no auto-submit-on-code-complete — that's OtpScreen's behavior,
 * not this screen's) and expired-code handling as the original.
 */
export function ResetPasswordForm({ token }) {
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(0);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) { setError("Please enter the 6-digit code from your email."); return; }
    if (newPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords don't match."); return; }

    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, otp, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setDone(true);
      } else {
        setError(data.error || "Failed to reset password. Please try again.");
        if (data.expired) setAttempt((a) => a + 1);
      }
    } catch {
      setError("Cannot connect to server.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 56, height: 56, borderRadius: "50%", background: "var(--positive-soft)",
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto var(--space-5)",
          }}
        >
          <CheckCircle2 size={28} strokeWidth={1.75} color="var(--primary)" aria-hidden="true" />
        </div>
        <h2 style={{ font: "var(--text-heading-lg)", color: "var(--text)", margin: "0 0 var(--space-2)" }}>
          Password updated!
        </h2>
        <p style={{ font: "var(--text-body-sm)", color: "var(--text-subtle)", margin: "0 0 var(--space-8)", lineHeight: 1.6 }}>
          Your password has been reset. Sign in with your new password.
        </p>
        <Button variant="primary" style={{ width: "100%" }} onClick={() => navigate("/login")}>
          Sign In
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ font: "var(--text-display-md)", color: "var(--text)", margin: "0 0 var(--space-2)" }}>
        Set new password
      </h2>
      <p style={{ font: "var(--text-body-sm)", color: "var(--text-subtle)", margin: "0 0 var(--space-6)", lineHeight: 1.6 }}>
        Enter the 6-digit code from your email, then choose a new password.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <div style={{ marginBottom: "var(--space-5)" }}>
          <label style={{ display: "block", font: "var(--text-label)", color: "var(--text-subtle)", marginBottom: "var(--space-3)", textAlign: "center" }}>
            Code from email
          </label>
          <OtpInput key={attempt} error={!!error} disabled={loading} onChange={setOtp} />
        </div>

        <Field
          label="New Password" type="password" value={newPassword}
          onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
          placeholder="At least 8 characters" autoComplete="new-password"
          showToggle
        />
        <Field
          label="Confirm Password" type="password" value={confirmPassword}
          onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
          placeholder="Repeat your new password" autoComplete="new-password"
          showToggle
        />

        {error && (
          <div
            style={{
              padding: "9px 14px", borderRadius: "var(--radius-sm)", marginBottom: "var(--space-4)",
              background: "var(--negative-soft)", border: "1px solid var(--negative)",
              font: "var(--text-body-sm)", color: "var(--negative)",
            }}
          >
            {error}
          </div>
        )}

        <Button type="submit" variant="primary" loading={loading} style={{ width: "100%", marginBottom: "var(--space-3)" }}>
          {loading ? "Resetting…" : "Reset password"}
        </Button>

        <Link
          to="/login"
          style={{
            width: "100%", height: 40, boxSizing: "border-box",
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: "var(--radius-md)", border: "1px solid var(--border)",
            color: "var(--text-subtle)", font: "var(--text-body-sm)", textDecoration: "none",
          }}
        >
          Back to Sign In
        </Link>
      </form>
    </div>
  );
}
