import { useState } from "react";
import { Link } from "react-router-dom";
import { MailCheck, KeyRound, ArrowLeft } from "lucide-react";
import { apiFetch } from "../../../api.js";
import { Field } from "../../../components/ui/Field.jsx";
import { Button } from "../../../components/ui/Button.jsx";

/**
 * Mounted inside ForgotPasswordPage.jsx (see router.jsx's /forgot-password
 * route). Restyled from AuthScreen.jsx's ForgotPasswordScreen — same
 * request-reset-link flow, same real-failure-vs-fake-success distinction
 * (the regression this screen already has a dedicated test for, see
 * ROADMAP.md's Phase 6 notes: a non-ok response is a real failure, not an
 * account-enumeration leak, since the backend answers 200 either way).
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setError("Please enter your email."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Please enter a valid email address."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase() }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to send reset email. Please try again.");
      }
    } catch {
      setError("Cannot connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 56, height: 56, borderRadius: "50%", background: "var(--positive-soft)",
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto var(--space-5)",
          }}
        >
          <MailCheck size={28} strokeWidth={1.75} color="var(--primary)" aria-hidden="true" />
        </div>
        <h2 style={{ font: "var(--text-heading-lg)", color: "var(--text)", margin: "0 0 var(--space-2)" }}>
          Check your email
        </h2>
        <p style={{ font: "var(--text-body-sm)", color: "var(--text-subtle)", margin: "0 0 4px" }}>
          If an account exists for
        </p>
        <p style={{ font: "600 14px var(--font-numeral)", color: "var(--text)", margin: "0 0 var(--space-4)" }}>
          {email}
        </p>
        <p style={{ font: "var(--text-body-sm)", color: "var(--text-muted)", margin: "0 0 var(--space-8)", lineHeight: 1.6 }}>
          we&rsquo;ve sent a reset link and a 6-digit code. Click the link in the email, then enter the code to set your new password.
        </p>
        <Link
          to="/login"
          style={{
            width: "100%", height: 40, padding: "0 var(--space-5)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            borderRadius: "var(--radius-md)", border: "1px solid var(--border-strong)",
            background: "transparent", color: "var(--text-muted)",
            fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 13,
            textDecoration: "none", boxSizing: "border-box",
          }}
        >
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link
        to="/login"
        style={{
          background: "none", border: "none", color: "var(--text-subtle)",
          font: "var(--text-body-sm)", textDecoration: "none",
          padding: "0 0 var(--space-5)", display: "flex", alignItems: "center", gap: 4,
        }}
      >
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
        Back to Sign In
      </Link>

      <div
        style={{
          width: 48, height: 48, borderRadius: "50%", background: "var(--positive-soft)",
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "var(--space-4)",
        }}
      >
        <KeyRound size={24} strokeWidth={1.75} color="var(--primary)" aria-hidden="true" />
      </div>

      <h2 style={{ font: "var(--text-display-md)", color: "var(--text)", margin: "0 0 var(--space-2)" }}>
        Reset password
      </h2>
      <p style={{ font: "var(--text-body-sm)", color: "var(--text-subtle)", margin: "0 0 var(--space-6)", lineHeight: 1.6 }}>
        Enter your email and we&rsquo;ll send you a reset link and a one-time code.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <Field
          label="Email" type="email" value={email}
          onChange={(e) => { setEmail(e.target.value); setError(""); }}
          placeholder="you@example.com" autoComplete="email" error={error}
        />
        <Button type="submit" variant="primary" loading={loading} style={{ width: "100%" }}>
          {loading ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </div>
  );
}
