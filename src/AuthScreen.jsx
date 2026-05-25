import { useState, useEffect, useRef } from "react";

const font = `'Manrope', sans-serif`;
const fontMono = `'Inter', monospace`;
const fontHeadline = `'Newsreader', serif`;

const theme = {
  bg: "#fbf9f6",
  surface: "#ffffff",
  surfaceContainerLow: "#f5f3f0",
  border: "#efeeeb",
  text: "#1b1c1a",
  textMuted: "#3f4943",
  textSubtle: "#6f7a72",
  primary: "#005235",
  primaryContainer: "#1a6b4a",
  accent: "#b02d21",
  greenSoft: "rgba(26,107,74,0.08)",
};

// ── reCAPTCHA v3 ─────────────────────────────────────────────────────────────
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
    // Hide the default badge — we show our own attribution
    const style = document.createElement("style");
    style.textContent = ".grecaptcha-badge { visibility: hidden !important; }";
    document.head.appendChild(style);
    return () => {
      try { document.head.removeChild(script); } catch {}
      try { document.head.removeChild(style); } catch {}
    };
  }, []);

  const execute = async (action = "auth") => {
    if (!RECAPTCHA_SITE_KEY || !window.grecaptcha) return null;
    return new Promise((resolve) => {
      window.grecaptcha.ready(() => {
        window.grecaptcha
          .execute(RECAPTCHA_SITE_KEY, { action })
          .then(resolve)
          .catch(() => resolve(null));
      });
    });
  };

  return execute;
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

// ── Field component ───────────────────────────────────────────────────────────
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
          onFocus={e => { e.target.style.borderColor = error ? theme.accent : theme.primary; }}
          onBlur={e => { e.target.style.borderColor = error ? theme.accent : theme.border; }}
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

// ── "Check your email" screen ─────────────────────────────────────────────────
function VerifyPendingScreen({ email, onResend, onBackToLogin }) {
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg]         = useState("");
  const [cooldown, setCooldown]           = useState(0);

  const handleResend = async () => {
    setResendLoading(true);
    setResendMsg("");
    try {
      const res  = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setResendMsg(data.ok ? "New link sent! Check your inbox." : (data.error || "Failed to resend."));
      if (data.ok) {
        setCooldown(60);
        const t = setInterval(() => setCooldown(c => { if (c <= 1) { clearInterval(t); return 0; } return c - 1; }), 1000);
      }
    } catch {
      setResendMsg("Cannot connect to server.");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        width: 64, height: 64, borderRadius: "50%",
        background: theme.greenSoft,
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 24px",
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 32, color: theme.primary, fontVariationSettings: "'FILL' 0, 'wght' 300" }}>mark_email_unread</span>
      </div>
      <h2 style={{ fontFamily: fontHeadline, fontWeight: 400, fontSize: 22, color: theme.text, margin: "0 0 12px" }}>
        Check your email
      </h2>
      <p style={{ fontSize: 14, color: theme.textSubtle, margin: "0 0 8px", lineHeight: 1.6 }}>
        We sent a verification link to
      </p>
      <p style={{ fontSize: 14, fontWeight: 600, color: theme.text, margin: "0 0 28px", fontFamily: fontMono }}>
        {email}
      </p>
      <p style={{ fontSize: 13, color: theme.textSubtle, margin: "0 0 24px", lineHeight: 1.6 }}>
        Click the link in the email to activate your account. The link expires in 24 hours.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          onClick={handleResend}
          disabled={resendLoading || cooldown > 0}
          style={{
            padding: "11px", borderRadius: 8,
            background: cooldown > 0 ? theme.surfaceContainerLow : theme.primary,
            border: "none", color: cooldown > 0 ? theme.textSubtle : "#fff",
            fontFamily: font, fontSize: 14, fontWeight: 600, cursor: cooldown > 0 || resendLoading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "all 0.2s",
          }}
        >
          {resendLoading && <Spinner color={theme.primary} />}
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend verification email"}
        </button>

        <button onClick={onBackToLogin} style={{
          padding: "11px", borderRadius: 8, background: "none",
          border: `1px solid ${theme.border}`, color: theme.textSubtle,
          fontFamily: font, fontSize: 14, cursor: "pointer",
        }}>
          Back to Sign In
        </button>
      </div>

      {resendMsg && (
        <div style={{
          marginTop: 16, padding: "10px 14px", borderRadius: 6,
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

// ── "Verifying…" / result screen ─────────────────────────────────────────────
function VerifyingScreen({ state, message, email, onRetry, onBack }) {
  if (state === "verifying") {
    return (
      <div style={{ textAlign: "center", padding: "16px 0" }}>
        <Spinner color={theme.primary} />
        <p style={{ fontSize: 14, color: theme.textSubtle, marginTop: 16, fontFamily: font }}>Verifying your email…</p>
      </div>
    );
  }
  if (state === "verified") {
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: theme.greenSoft, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 32, color: theme.primary, fontVariationSettings: "'FILL' 1, 'wght' 300" }}>check_circle</span>
        </div>
        <h2 style={{ fontFamily: fontHeadline, fontWeight: 400, fontSize: 22, color: theme.text, margin: "0 0 12px" }}>Email verified!</h2>
        <p style={{ fontSize: 14, color: theme.textSubtle, margin: 0, lineHeight: 1.6 }}>Signing you in…</p>
      </div>
    );
  }
  // expired or error
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(176,45,33,0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
        <span className="material-symbols-outlined" style={{ fontSize: 32, color: theme.accent, fontVariationSettings: "'FILL' 0, 'wght' 300" }}>error</span>
      </div>
      <h2 style={{ fontFamily: fontHeadline, fontWeight: 400, fontSize: 22, color: theme.text, margin: "0 0 12px" }}>Link {state === "expired" ? "expired" : "invalid"}</h2>
      <p style={{ fontSize: 14, color: theme.textSubtle, margin: "0 0 24px", lineHeight: 1.6 }}>{message}</p>
      {state === "expired" && email && (
        <button onClick={onRetry} style={{
          width: "100%", padding: "11px", borderRadius: 8, background: theme.primary, border: "none",
          color: "#fff", fontFamily: font, fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 10,
        }}>
          Send a new verification email
        </button>
      )}
      <button onClick={onBack} style={{
        width: "100%", padding: "11px", borderRadius: 8, background: "none",
        border: `1px solid ${theme.border}`, color: theme.textSubtle,
        fontFamily: font, fontSize: 14, cursor: "pointer",
      }}>
        Back to Sign In
      </button>
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

  // Email verification states
  const [verifyState, setVerifyState]   = useState(null); // null | "pending" | "verifying" | "verified" | "expired" | "error"
  const [verifyMessage, setVerifyMessage] = useState("");
  const [pendingEmail, setPendingEmail]   = useState("");

  const getCaptchaToken = useRecaptcha();
  const clearErrors = () => setFieldErrors({ name: "", email: "", password: "", form: "" });

  // ── Deep-link email verification (e.g. /verify?token=xxx) ──────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get("token");
    if (!token) return;

    setVerifyState("verifying");
    window.history.replaceState({}, "", "/"); // clean the URL

    fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.token) {
          setVerifyState("verified");
          localStorage.setItem("cc_auth", JSON.stringify({ token: data.token, user: data.user }));
          setTimeout(() => onAuth({ token: data.token, user: data.user }), 800);
        } else {
          setVerifyState(data.expired ? "expired" : "error");
          setVerifyMessage(data.error || "Verification failed.");
          setPendingEmail(data.email || "");
        }
      })
      .catch(() => {
        setVerifyState("error");
        setVerifyMessage("Cannot connect to the server. Please try again.");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Form submission ──────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    clearErrors();

    // Client-side validation
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
    const captchaToken = await getCaptchaToken(mode);

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
    const body     = mode === "login"
      ? { email, password, captchaToken }
      : { name, email, password, captchaToken };

    try {
      const res  = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        // emailNotVerified from login → show resend screen
        if (data.emailNotVerified) {
          setPendingEmail(data.email || email);
          setVerifyState("pending");
          return;
        }
        setFieldErrors(routeError(data.error || "Something went wrong."));
      } else if (data.verificationRequired) {
        // Signup: email verification required
        setPendingEmail(email);
        setVerifyState("pending");
      } else {
        localStorage.setItem("cc_auth", JSON.stringify({ token: data.token, user: data.user }));
        onAuth({ token: data.token, user: data.user });
      }
    } catch {
      setFieldErrors({ name: "", email: "", password: "", form: "Cannot connect to the server. Make sure the API is running." });
    } finally {
      setLoading(false);
    }
  };

  // ── Render states ─────────────────────────────────────────────────────────
  if (verifyState === "verifying" || verifyState === "verified" || verifyState === "expired" || verifyState === "error") {
    return (
      <AuthShell>
        <VerifyingScreen
          state={verifyState}
          message={verifyMessage}
          email={pendingEmail}
          onRetry={() => { setVerifyState("pending"); }}
          onBack={() => { setVerifyState(null); clearErrors(); }}
        />
      </AuthShell>
    );
  }

  if (verifyState === "pending") {
    return (
      <AuthShell>
        <VerifyPendingScreen
          email={pendingEmail}
          onBackToLogin={() => { setVerifyState(null); setMode("login"); clearErrors(); }}
        />
      </AuthShell>
    );
  }

  // ── Sign in / Create account form ─────────────────────────────────────────
  return (
    <AuthShell>
      {/* Tab toggle */}
      <div style={{ display: "flex", background: theme.surfaceContainerLow, borderRadius: 8, padding: 4, marginBottom: 28 }}>
        {["login", "signup"].map(m => (
          <button key={m} onClick={() => { setMode(m); clearErrors(); setShowPassword(false); }} style={{
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
      </form>

      {/* reCAPTCHA attribution (required by Google's terms when badge is hidden) */}
      {RECAPTCHA_SITE_KEY && (
        <p style={{ fontSize: 11, color: theme.textSubtle, marginTop: 18, textAlign: "center", fontFamily: fontMono, lineHeight: 1.5 }}>
          Protected by reCAPTCHA —&nbsp;
          <a href="https://policies.google.com/privacy" style={{ color: theme.textSubtle }}>Privacy</a>
          &nbsp;&amp;&nbsp;
          <a href="https://policies.google.com/terms" style={{ color: theme.textSubtle }}>Terms</a>
        </p>
      )}
    </AuthShell>
  );
}

// ── Layout shell (shared across all auth screens) ─────────────────────────────
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
