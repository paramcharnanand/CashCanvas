import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch } from "./api.js";

const font         = `'Manrope', sans-serif`;
const fontMono     = `'Inter', monospace`;
const fontHeadline = `'Newsreader', serif`;

const theme = {
  bg:                   "#fbf9f6",
  surface:              "#ffffff",
  surfaceContainerLow:  "#f5f3f0",
  border:               "#efeeeb",
  text:                 "#1b1c1a",
  textMuted:            "#3f4943",
  textSubtle:           "#6f7a72",
  primary:              "#005235",
  primaryContainer:     "#1a6b4a",
  accent:               "#b02d21",
  greenSoft:            "rgba(26,107,74,0.08)",
};

// ── reCAPTCHA v3 (used on signup only) ───────────────────────────────────────
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "";

function useRecaptcha() {
  const loaded = useRef(false);

  useEffect(() => {
    if (!RECAPTCHA_SITE_KEY || loaded.current) return;
    loaded.current = true;
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    document.head.appendChild(script);
    const style = document.createElement("style");
    style.textContent = ".grecaptcha-badge { visibility: hidden !important; }";
    document.head.appendChild(style);
  }, []);

  return useCallback(async (action = "signup") => {
    if (!RECAPTCHA_SITE_KEY || !window.grecaptcha) return null;
    return new Promise((resolve) => {
      window.grecaptcha.ready(() => {
        window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action }).then(resolve).catch(() => resolve(null));
      });
    });
  }, []);
}

// ── Error routing ─────────────────────────────────────────────────────────────
function routeError(msg) {
  if (!msg) return { name: "", email: "", password: "", form: "" };
  const l = msg.toLowerCase();
  if (l.includes("email") || l.includes("registered") || l.includes("sign up first") || l.includes("account found"))
    return { name: "", email: msg, password: "", form: "" };
  if (l.includes("password") || l.includes("incorrect"))
    return { name: "", email: "", password: msg, form: "" };
  if (l.includes("name"))
    return { name: msg, email: "", password: "", form: "" };
  return { name: "", email: "", password: "", form: msg };
}

// ── Field ─────────────────────────────────────────────────────────────────────
function Field({ label, type, value, onChange, placeholder, error, autoComplete, showToggle, passwordVisible, onToggle }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: "block", fontSize: 11, fontFamily: fontMono, fontWeight: 600,
        textTransform: "uppercase", letterSpacing: "0.08em", color: theme.textSubtle, marginBottom: 6,
      }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={showToggle ? (passwordVisible ? "text" : "password") : type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          style={{
            width: "100%",
            padding: showToggle ? "11px 40px 11px 14px" : "11px 14px",
            boxSizing: "border-box",
            background: theme.surfaceContainerLow,
            border: `1px solid ${error ? theme.accent : theme.border}`,
            borderRadius: 6, color: theme.text, fontFamily: font, fontSize: 14, outline: "none",
            transition: "border-color 0.15s",
          }}
          onFocus={e  => { e.target.style.borderColor = error ? theme.accent : theme.primary; }}
          onBlur={e   => { e.target.style.borderColor = error ? theme.accent : theme.border; }}
        />
        {showToggle && (
          <button type="button" onClick={onToggle} tabIndex={-1} style={{
            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer", padding: 2,
            color: theme.textSubtle, display: "flex", alignItems: "center",
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 0, 'wght' 300" }}>
              {passwordVisible ? "visibility_off" : "visibility"}
            </span>
          </button>
        )}
      </div>
      {error && <div style={{ fontSize: 12, color: theme.accent, marginTop: 5, fontFamily: font }}>{error}</div>}
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner({ color = "#fff" }) {
  return (
    <span style={{
      display: "inline-block", width: 14, height: 14,
      border: `2px solid ${color}33`, borderTopColor: color,
      borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0,
    }} />
  );
}

// ── OTP Entry Screen ──────────────────────────────────────────────────────────
function OtpScreen({ email, onVerified, onBack }) {
  const [digits, setDigits]     = useState(["", "", "", "", "", ""]);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resendMsg, setResendMsg] = useState("");
  const inputRefs               = useRef([]);

  // Auto-submit when all 6 digits filled
  useEffect(() => {
    if (digits.every(d => d !== "")) handleVerify(digits.join(""));
  }, [digits]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDigitChange = (index, value) => {
    const cleaned = value.replace(/\D/g, "").slice(-1);
    const next    = [...digits];
    next[index]   = cleaned;
    setDigits(next);
    setError("");
    if (cleaned && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const next = [...digits]; next[index] = ""; setDigits(next);
      } else if (index > 0) {
        const next = [...digits]; next[index - 1] = ""; setDigits(next);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = [...digits];
    for (let i = 0; i < 6; i++) next[i] = pasted[i] || "";
    setDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleVerify = async (code) => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res  = await apiFetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        onVerified(data.user);
      } else {
        setError(data.error || "Incorrect code. Please try again.");
        setDigits(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError("Cannot connect to server.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendMsg("");
    setError("");
    try {
      const res  = await apiFetch("/api/auth/resend-otp", {
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
      const t = setInterval(() => setCooldown(c => { if (c <= 1) { clearInterval(t); return 0; } return c - 1; }), 1000);
      setDigits(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } catch {
      setResendMsg("Failed to resend. Try again.");
    }
  };

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        width: 56, height: 56, borderRadius: "50%", background: theme.greenSoft,
        display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px",
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 28, color: theme.primary, fontVariationSettings: "'FILL' 0, 'wght' 300" }}>
          mark_email_read
        </span>
      </div>

      <h2 style={{ fontFamily: fontHeadline, fontWeight: 400, fontSize: 22, color: theme.text, margin: "0 0 8px" }}>
        Check your email
      </h2>
      <p style={{ fontSize: 13, color: theme.textSubtle, margin: "0 0 4px", lineHeight: 1.6 }}>
        We sent a 6-digit code to
      </p>
      <p style={{ fontSize: 14, fontWeight: 600, color: theme.text, margin: "0 0 24px", fontFamily: fontMono }}>
        {email}
      </p>

      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={el => (inputRefs.current[i] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={e => handleDigitChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            onPaste={i === 0 ? handlePaste : undefined}
            autoFocus={i === 0}
            style={{
              width: 44, height: 52, textAlign: "center",
              fontSize: 22, fontWeight: 700, fontFamily: fontMono,
              background: theme.surfaceContainerLow,
              border: `1.5px solid ${error ? theme.accent : d ? theme.primary : theme.border}`,
              borderRadius: 8, color: theme.text, outline: "none",
              transition: "border-color 0.15s",
            }}
            onFocus={e  => { e.target.style.borderColor = error ? theme.accent : theme.primary; }}
            onBlur={e   => { e.target.style.borderColor = error ? theme.accent : d ? theme.primary : theme.border; }}
          />
        ))}
      </div>

      {error && (
        <div style={{
          padding: "9px 14px", borderRadius: 6, marginBottom: 14,
          background: "rgba(176,45,33,0.06)", border: "1px solid rgba(176,45,33,0.18)",
          fontSize: 13, color: theme.accent, fontFamily: font,
        }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16, color: theme.textSubtle, fontSize: 13 }}>
          <Spinner color={theme.primary} /> Verifying…
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
        <button
          onClick={handleResend}
          disabled={cooldown > 0 || loading}
          style={{
            padding: "10px", borderRadius: 8, border: `1px solid ${theme.border}`,
            background: "none", color: cooldown > 0 ? theme.textSubtle : theme.primary,
            fontFamily: font, fontSize: 13, fontWeight: 600,
            cursor: cooldown > 0 || loading ? "not-allowed" : "pointer",
          }}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
        <button
          onClick={onBack}
          style={{
            padding: "10px", borderRadius: 8, border: `1px solid ${theme.border}`,
            background: "none", color: theme.textSubtle,
            fontFamily: font, fontSize: 13, cursor: "pointer",
          }}
        >
          Back to Sign In
        </button>
      </div>

      {resendMsg && (
        <div style={{
          marginTop: 14, padding: "9px 14px", borderRadius: 6,
          background: resendMsg.includes("sent") ? theme.greenSoft : "rgba(176,45,33,0.06)",
          border: `1px solid ${resendMsg.includes("sent") ? theme.primary + "33" : "rgba(176,45,33,0.2)"}`,
          fontSize: 13, color: resendMsg.includes("sent") ? theme.primary : theme.accent, fontFamily: font,
        }}>
          {resendMsg}
        </div>
      )}
    </div>
  );
}

// ── Forgot Password Screen ────────────────────────────────────────────────────
function ForgotPasswordScreen({ onBack }) {
  const [email, setEmail]     = useState("");
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setError("Please enter your email."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Please enter a valid email address."); return; }
    setLoading(true);
    setError("");
    try {
      await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase() }),
      });
      setSent(true);
    } catch {
      setError("Cannot connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%", background: theme.greenSoft,
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px",
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 28, color: theme.primary, fontVariationSettings: "'FILL' 0, 'wght' 300" }}>
            mark_email_read
          </span>
        </div>
        <h2 style={{ fontFamily: fontHeadline, fontWeight: 400, fontStyle: "italic", fontSize: 22, color: theme.text, margin: "0 0 8px" }}>
          Check your email
        </h2>
        <p style={{ fontSize: 13, color: theme.textSubtle, margin: "0 0 4px", lineHeight: 1.6 }}>
          If an account exists for
        </p>
        <p style={{ fontSize: 14, fontWeight: 600, color: theme.text, margin: "0 0 16px", fontFamily: fontMono }}>
          {email}
        </p>
        <p style={{ fontSize: 13, color: theme.textMuted, margin: "0 0 28px", lineHeight: 1.6 }}>
          we've sent a reset link and a 6-digit code. Click the link in the email, then enter the code to set your new password.
        </p>
        <button onClick={onBack} style={{
          width: "100%", padding: "12px", borderRadius: 8,
          border: `1px solid ${theme.border}`, background: "none",
          color: theme.textSubtle, fontFamily: font, fontSize: 13, cursor: "pointer",
        }}>
          Back to Sign In
        </button>
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={onBack} style={{
        background: "none", border: "none", color: theme.textSubtle, fontFamily: font,
        fontSize: 12, cursor: "pointer", padding: "0 0 20px",
        display: "flex", alignItems: "center", gap: 4,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 0, 'wght' 300" }}>
          arrow_back
        </span>
        Back to Sign In
      </button>

      <div style={{
        width: 48, height: 48, borderRadius: "50%", background: theme.greenSoft,
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 24, color: theme.primary, fontVariationSettings: "'FILL' 0, 'wght' 300" }}>
          lock_reset
        </span>
      </div>

      <h2 style={{ fontFamily: fontHeadline, fontWeight: 400, fontStyle: "italic", fontSize: 22, color: theme.text, margin: "0 0 8px" }}>
        Reset password
      </h2>
      <p style={{ fontSize: 13, color: theme.textSubtle, margin: "0 0 24px", lineHeight: 1.6 }}>
        Enter your email and we'll send you a reset link and a one-time code.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <Field
          label="Email" type="email" value={email}
          onChange={e => { setEmail(e.target.value); setError(""); }}
          placeholder="you@example.com" autoComplete="email" error={error}
        />
        <button type="submit" disabled={loading} style={{
          width: "100%", padding: "12px",
          background: loading ? theme.textSubtle
            : `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryContainer} 100%)`,
          border: "none", borderRadius: 8, color: "#fff",
          fontFamily: font, fontSize: 14, fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
        onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = "0.9"; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
        >
          {loading && <Spinner />}
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>
    </div>
  );
}

// ── Reset Password Screen ─────────────────────────────────────────────────────
function ResetPasswordScreen({ token, onBack }) {
  const [digits, setDigits]               = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass]           = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState("");
  const [done, setDone]                   = useState(false);
  const inputRefs                         = useRef([]);

  const handleDigitChange = (index, value) => {
    const cleaned = value.replace(/\D/g, "").slice(-1);
    const next    = [...digits];
    next[index]   = cleaned;
    setDigits(next);
    setError("");
    if (cleaned && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const next = [...digits]; next[index] = ""; setDigits(next);
      } else if (index > 0) {
        const next = [...digits]; next[index - 1] = ""; setDigits(next);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft"  && index > 0) inputRefs.current[index - 1]?.focus();
    else if   (e.key === "ArrowRight" && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = [...digits];
    for (let i = 0; i < 6; i++) next[i] = pasted[i] || "";
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const otp = digits.join("");
    if (otp.length !== 6)               { setError("Please enter the 6-digit code from your email."); return; }
    if (newPassword.length < 8)         { setError("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords don't match."); return; }

    setLoading(true);
    setError("");
    try {
      const res  = await apiFetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, otp, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setDone(true);
        window.history.replaceState({}, "", "/");
      } else {
        setError(data.error || "Failed to reset password. Please try again.");
        if (data.expired) { setDigits(["", "", "", "", "", ""]); setTimeout(() => inputRefs.current[0]?.focus(), 50); }
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
        <div style={{
          width: 56, height: 56, borderRadius: "50%", background: theme.greenSoft,
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px",
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 28, color: theme.primary, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>
            check_circle
          </span>
        </div>
        <h2 style={{ fontFamily: fontHeadline, fontWeight: 400, fontStyle: "italic", fontSize: 22, color: theme.text, margin: "0 0 8px" }}>
          Password updated!
        </h2>
        <p style={{ fontSize: 13, color: theme.textSubtle, margin: "0 0 28px", lineHeight: 1.6 }}>
          Your password has been reset. Sign in with your new password.
        </p>
        <button onClick={onBack} style={{
          width: "100%", padding: "12px", border: "none", borderRadius: 8,
          background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryContainer} 100%)`,
          color: "#fff", fontFamily: font, fontSize: 14, fontWeight: 600, cursor: "pointer",
        }}>
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontFamily: fontHeadline, fontWeight: 400, fontStyle: "italic", fontSize: 22, color: theme.text, margin: "0 0 6px" }}>
        Set new password
      </h2>
      <p style={{ fontSize: 13, color: theme.textSubtle, margin: "0 0 24px", lineHeight: 1.6 }}>
        Enter the 6-digit code from your email, then choose a new password.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        {/* OTP inputs */}
        <div style={{ marginBottom: 20 }}>
          <label style={{
            display: "block", fontSize: 11, fontFamily: fontMono, fontWeight: 600,
            textTransform: "uppercase", letterSpacing: "0.08em", color: theme.textSubtle, marginBottom: 10,
          }}>
            Code from email
          </label>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => (inputRefs.current[i] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={e => handleDigitChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                onPaste={i === 0 ? handlePaste : undefined}
                autoFocus={i === 0}
                style={{
                  width: 44, height: 52, textAlign: "center",
                  fontSize: 22, fontWeight: 700, fontFamily: fontMono,
                  background: theme.surfaceContainerLow,
                  border: `1.5px solid ${error ? theme.accent : d ? theme.primary : theme.border}`,
                  borderRadius: 8, color: theme.text, outline: "none",
                  transition: "border-color 0.15s",
                }}
                onFocus={e => { e.target.style.borderColor = error ? theme.accent : theme.primary; }}
                onBlur={e  => { e.target.style.borderColor = error ? theme.accent : d ? theme.primary : theme.border; }}
              />
            ))}
          </div>
        </div>

        <Field
          label="New Password" type="password" value={newPassword}
          onChange={e => { setNewPassword(e.target.value); setError(""); }}
          placeholder="At least 8 characters" autoComplete="new-password"
          showToggle passwordVisible={showPass} onToggle={() => setShowPass(v => !v)}
        />
        <Field
          label="Confirm Password" type="password" value={confirmPassword}
          onChange={e => { setConfirmPassword(e.target.value); setError(""); }}
          placeholder="Repeat your new password" autoComplete="new-password"
          showToggle passwordVisible={showConfirm} onToggle={() => setShowConfirm(v => !v)}
        />

        {error && (
          <div style={{
            padding: "9px 14px", borderRadius: 6, marginBottom: 14,
            background: "rgba(176,45,33,0.06)", border: "1px solid rgba(176,45,33,0.18)",
            fontSize: 13, color: theme.accent, fontFamily: font,
          }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} style={{
          width: "100%", padding: "12px",
          background: loading ? theme.textSubtle
            : `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryContainer} 100%)`,
          border: "none", borderRadius: 8, color: "#fff",
          fontFamily: font, fontSize: 14, fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          marginBottom: 10,
        }}
        onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = "0.9"; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
        >
          {loading && <Spinner />}
          {loading ? "Resetting…" : "Reset password"}
        </button>

        <button type="button" onClick={onBack} style={{
          width: "100%", padding: "10px", borderRadius: 8,
          border: `1px solid ${theme.border}`, background: "none",
          color: theme.textSubtle, fontFamily: font, fontSize: 13, cursor: "pointer",
        }}>
          Back to Sign In
        </button>
      </form>
    </div>
  );
}

// ── Main AuthScreen ───────────────────────────────────────────────────────────
export default function AuthScreen({ onAuth }) {
  const [mode, setMode]               = useState("login");
  const [name, setName]               = useState("");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [fieldErrors, setFieldErrors] = useState({ name: "", email: "", password: "", form: "" });
  const [loading, setLoading]         = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // OTP step (login/signup verification)
  const [otpEmail, setOtpEmail]       = useState("");

  // Screen routing: "main" | "forgot" | "reset"
  const [screen, setScreen]           = useState("main");
  const [resetToken, setResetToken]   = useState("");
  const [helpOpen, setHelpOpen]       = useState(false);

  const getCaptchaToken = useRecaptcha();

  // Detect password-reset link (?token=... on /reset-password path)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get("token");
    if (token && window.location.pathname.includes("reset")) {
      setResetToken(token);
      setScreen("reset");
    }
  }, []);

  const clearErrors = () => {
    setFieldErrors({ name: "", email: "", password: "", form: "" });
    setHelpOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearErrors();

    if (mode === "signup" && !name.trim()) {
      setFieldErrors(p => ({ ...p, name: "Please enter your name." })); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldErrors(p => ({ ...p, email: "Please enter a valid email address." })); return;
    }
    if (mode === "signup" && password.length < 8) {
      setFieldErrors(p => ({ ...p, password: "Password must be at least 8 characters." })); return;
    }

    setLoading(true);
    const captchaToken = mode === "signup" ? await getCaptchaToken("signup") : undefined;

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
    const body     = mode === "login"
      ? { email, password }
      : { name, email, password, captchaToken };

    try {
      const res  = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setFieldErrors(routeError(data.error || "Something went wrong."));
      } else if (data.otpRequired) {
        setOtpEmail(data.email || email);
      } else if (data.user) {
        onAuth(data.user);
      }
    } catch {
      setFieldErrors({ name: "", email: "", password: "", form: "Cannot connect to the server. Make sure the API is running." });
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setScreen("main");
    setResetToken("");
    clearErrors();
  };

  // ── Screen: Forgot Password ────────────────────────────────────────────────
  if (screen === "forgot") {
    return (
      <AuthShell>
        <ForgotPasswordScreen onBack={goBack} />
      </AuthShell>
    );
  }

  // ── Screen: Reset Password (from email link) ───────────────────────────────
  if (screen === "reset") {
    return (
      <AuthShell>
        <ResetPasswordScreen token={resetToken} onBack={goBack} />
      </AuthShell>
    );
  }

  // ── Screen: OTP verification (login / signup) ──────────────────────────────
  if (otpEmail) {
    return (
      <AuthShell>
        <OtpScreen
          email={otpEmail}
          onVerified={onAuth}
          onBack={() => { setOtpEmail(""); clearErrors(); }}
        />
      </AuthShell>
    );
  }

  // ── Screen: Credentials form ───────────────────────────────────────────────
  return (
    <AuthShell>
      {/* Tab toggle */}
      <div style={{ display: "flex", background: theme.surfaceContainerLow, borderRadius: 8, padding: 4, marginBottom: 28 }}>
        {["login", "signup"].map(m => (
          <button key={m} onClick={() => { setMode(m); clearErrors(); setShowPassword(false); setScreen("main"); }} style={{
            flex: 1, padding: "8px", border: "none", borderRadius: 6,
            background: mode === m ? theme.surface : "transparent",
            color: mode === m ? theme.primary : theme.textSubtle,
            fontFamily: font, fontSize: 13, fontWeight: mode === m ? 600 : 400,
            cursor: "pointer",
            boxShadow: mode === m ? "0 1px 3px rgba(27,28,26,0.08)" : "none",
            transition: "all 0.2s",
          }}>
            {m === "login" ? "Sign In" : "Create Account"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {mode === "signup" && (
          <Field label="Full Name" type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="Your name" autoComplete="name" error={fieldErrors.name} />
        )}
        <Field label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete={mode === "login" ? "username" : "email"}
          error={fieldErrors.email} />
        <Field label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          error={fieldErrors.password}
          showToggle passwordVisible={showPassword} onToggle={() => setShowPassword(v => !v)} />

        {/* Forgot password link — login only */}
        {mode === "login" && (
          <div style={{ textAlign: "right", marginTop: -8, marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setScreen("forgot")}
              style={{
                background: "none", border: "none", color: theme.primary,
                fontSize: 12, cursor: "pointer", fontFamily: font,
                fontWeight: 500, padding: 0,
                textDecoration: "underline", textUnderlineOffset: 2,
              }}
            >
              Forgot password?
            </button>
          </div>
        )}

        {fieldErrors.form && (
          <div style={{
            padding: "10px 14px", borderRadius: 6, marginBottom: 14,
            background: "rgba(176,45,33,0.06)", border: "1px solid rgba(176,45,33,0.18)",
            fontSize: 13, color: theme.accent, fontFamily: font,
          }}>
            {fieldErrors.form}
          </div>
        )}

        <button type="submit" disabled={loading} style={{
          width: "100%", padding: "12px",
          background: loading ? theme.textSubtle
            : `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryContainer} 100%)`,
          border: "none", borderRadius: 8, color: "#fff",
          fontFamily: font, fontSize: 14, fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer",
          transition: "opacity 0.2s", marginTop: 4,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
        onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = "0.9"; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
        >
          {loading && <Spinner />}
          {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
        </button>

        {/* Need help signing in */}
        {mode === "login" && (
          <div style={{ marginTop: 18, textAlign: "center" }}>
            <button
              type="button"
              onClick={() => setHelpOpen(v => !v)}
              style={{
                background: "none", border: "none", color: theme.textSubtle,
                fontSize: 12, cursor: "pointer", fontFamily: font,
                textDecoration: "underline", textUnderlineOffset: 3, padding: 0,
              }}
            >
              Need help signing in?
            </button>

            {helpOpen && (
              <div style={{
                marginTop: 12, padding: "14px 16px", borderRadius: 8,
                background: theme.surfaceContainerLow, border: `1px solid ${theme.border}`,
                textAlign: "left",
              }}>
                <div style={{
                  fontSize: 10, fontFamily: fontMono, fontWeight: 600,
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  color: theme.textSubtle, marginBottom: 10,
                }}>
                  Help options
                </div>
                <button
                  type="button"
                  onClick={() => setScreen("forgot")}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: "none", border: "none", color: theme.primary,
                    fontFamily: font, fontSize: 13, fontWeight: 500,
                    cursor: "pointer", padding: 0,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 0, 'wght' 300" }}>
                    lock_reset
                  </span>
                  Forgot your password? Get a reset link
                </button>
              </div>
            )}
          </div>
        )}
      </form>
    </AuthShell>
  );
}

// ── Layout shell ──────────────────────────────────────────────────────────────
function AuthShell({ children }) {
  return (
    <div style={{
      minHeight: "100vh", background: theme.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: font, padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Wordmark */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 36, fontFamily: fontHeadline, fontStyle: "italic", color: theme.text, lineHeight: 1 }}>
            Cash<span style={{ color: theme.primary }}>Canvas</span>
          </div>
          <p style={{ fontSize: 13, color: theme.textSubtle, margin: "10px 0 0", fontFamily: fontMono }}>
            Your personal finance dashboard
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: theme.surface, borderRadius: 12, padding: "32px clamp(20px, 6vw, 40px)",
          boxShadow: "0 4px 24px rgba(27,28,26,0.08)",
        }}>
          {children}
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: theme.textSubtle, marginTop: 20, fontFamily: fontMono }}>
          Your data stays private — no selling, no sharing.
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
