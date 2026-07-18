import { useState } from "react";
import { MailCheck } from "lucide-react";
import { apiFetch } from "../../../api.js";
import { OtpInput } from "../../../components/ui/OtpInput.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { Spinner } from "../../../components/ui/Spinner.jsx";

/**
 * Login/signup OTP verification — shown by LoginPage/SignupPage in place of
 * the credentials form once the API responds `otpRequired: true`. Restyled
 * from AuthScreen.jsx's OtpScreen, same behavior: auto-submits on the 6th
 * digit, resend with a 60s cooldown, wrong/expired code clears and
 * refocuses (via bumping `attempt`, remounting OtpInput).
 */
export function OtpScreen({ email, onVerified, onBack }) {
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resendMsg, setResendMsg] = useState("");

  const handleVerify = async (code) => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        onVerified(data.user);
      } else {
        setError(data.error || "Incorrect code. Please try again.");
        setAttempt((a) => a + 1);
      }
    } catch {
      setError("Cannot connect to server.");
      setAttempt((a) => a + 1);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendMsg("");
    setError("");
    try {
      const res = await apiFetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResendMsg(data.error || "Failed to resend. Try again.");
        return;
      }
      setResendMsg("New code sent!");
      setCooldown(60);
      const t = setInterval(() => setCooldown((c) => { if (c <= 1) { clearInterval(t); return 0; } return c - 1; }), 1000);
      setAttempt((a) => a + 1);
    } catch {
      setResendMsg("Failed to resend. Try again.");
    }
  };

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
        We sent a 6-digit code to
      </p>
      <p style={{ font: "600 14px var(--font-numeral)", color: "var(--text)", margin: "0 0 var(--space-6)" }}>
        {email}
      </p>

      <div style={{ marginBottom: "var(--space-5)" }}>
        <OtpInput key={attempt} onComplete={handleVerify} error={!!error} disabled={loading} />
      </div>

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

      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)", marginBottom: "var(--space-4)", color: "var(--text-subtle)", font: "var(--text-body-sm)" }}>
          <Spinner size={14} /> Verifying…
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginTop: 4 }}>
        <Button variant="secondary" disabled={cooldown > 0 || loading} onClick={handleResend} style={{ width: "100%" }}>
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </Button>
        <Button variant="ghost" onClick={onBack} style={{ width: "100%" }}>
          Back to Sign In
        </Button>
      </div>

      {resendMsg && (
        <div
          style={{
            marginTop: "var(--space-4)", padding: "9px 14px", borderRadius: "var(--radius-sm)",
            background: resendMsg.includes("sent") ? "var(--positive-soft)" : "var(--negative-soft)",
            border: `1px solid ${resendMsg.includes("sent") ? "var(--primary)" : "var(--negative)"}`,
            font: "var(--text-body-sm)", color: resendMsg.includes("sent") ? "var(--primary)" : "var(--negative)",
          }}
        >
          {resendMsg}
        </div>
      )}
    </div>
  );
}
