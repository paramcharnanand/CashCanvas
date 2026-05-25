import { useState } from "react";

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
};

// Route a server error message to the field it belongs to.
function routeError(msg) {
  if (!msg) return { name: "", email: "", password: "", form: "" };
  const l = msg.toLowerCase();
  if (
    l.includes("email") ||
    l.includes("registered") ||
    l.includes("sign up first") ||
    l.includes("account found")
  ) return { name: "", email: msg, password: "", form: "" };
  if (
    l.includes("password") ||
    l.includes("incorrect password")
  ) return { name: "", email: "", password: msg, form: "" };
  if (l.includes("name")) return { name: msg, email: "", password: "", form: "" };
  return { name: "", email: "", password: "", form: msg };
}

function Field({ label, type, value, onChange, placeholder, error, autoComplete, showToggle, onToggle, passwordVisible }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: "block", fontSize: 11, fontFamily: fontMono, fontWeight: 600,
        textTransform: "uppercase", letterSpacing: "0.08em",
        color: theme.textSubtle, marginBottom: 6,
      }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={showToggle ? (passwordVisible ? "text" : "password") : type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          style={{
            width: "100%", padding: showToggle ? "11px 40px 11px 14px" : "11px 14px",
            boxSizing: "border-box",
            background: theme.surfaceContainerLow,
            border: `1px solid ${error ? theme.accent : theme.border}`,
            borderRadius: 6, color: theme.text,
            fontFamily: font, fontSize: 14, outline: "none",
            transition: "border-color 0.15s",
          }}
          onFocus={e => { e.target.style.borderColor = error ? theme.accent : theme.primary; }}
          onBlur={e => { e.target.style.borderColor = error ? theme.accent : theme.border; }}
        />
        {showToggle && (
          <button
            type="button"
            onClick={onToggle}
            tabIndex={-1}
            style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer", padding: 2,
              color: theme.textSubtle, display: "flex", alignItems: "center",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 18, fontVariationSettings: "'FILL' 0, 'wght' 300" }}
            >
              {passwordVisible ? "visibility_off" : "visibility"}
            </span>
          </button>
        )}
      </div>
      {error && (
        <div style={{ fontSize: 12, color: theme.accent, marginTop: 5, fontFamily: font }}>{error}</div>
      )}
    </div>
  );
}

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ name: "", email: "", password: "", form: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const clearErrors = () => setFieldErrors({ name: "", email: "", password: "", form: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearErrors();

    // Client-side validation
    if (mode === "signup" && !name.trim()) {
      setFieldErrors(prev => ({ ...prev, name: "Please enter your name." }));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldErrors(prev => ({ ...prev, email: "Please enter a valid email address." }));
      return;
    }
    if (mode === "signup" && password.length < 8) {
      setFieldErrors(prev => ({ ...prev, password: "Password must be at least 8 characters." }));
      return;
    }

    setLoading(true);
    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
    const body = mode === "login" ? { email, password } : { name, email, password };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setFieldErrors(routeError(data.error || "Something went wrong."));
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
          {/* Tab toggle */}
          <div style={{
            display: "flex", background: theme.surfaceContainerLow,
            borderRadius: 8, padding: 4, marginBottom: 28,
          }}>
            {["login", "signup"].map(m => (
              <button key={m} onClick={() => { setMode(m); clearErrors(); setShowPassword(false); }} style={{
                flex: 1, padding: "8px", border: "none",
                borderRadius: 6,
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
              <Field
                label="Full Name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                error={fieldErrors.name}
              />
            )}
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete={mode === "login" ? "username" : "email"}
              error={fieldErrors.email}
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              error={fieldErrors.password}
              showToggle
              passwordVisible={showPassword}
              onToggle={() => setShowPassword(v => !v)}
            />

            {/* Form-level error (connection issues, server errors) */}
            {fieldErrors.form && (
              <div style={{
                padding: "10px 14px", borderRadius: 6, marginBottom: 14,
                background: "rgba(176,45,33,0.06)", border: "1px solid rgba(176,45,33,0.18)",
                fontSize: 13, color: theme.accent, fontFamily: font,
              }}>
                {fieldErrors.form}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: "12px",
                background: loading
                  ? theme.textSubtle
                  : `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryContainer} 100%)`,
                border: "none", borderRadius: 8,
                color: "#fff", fontFamily: font, fontSize: 14, fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "opacity 0.2s", marginTop: 4,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = "0.9"; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
            >
              {loading && (
                <span style={{
                  width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)",
                  borderTopColor: "#fff", borderRadius: "50%",
                  animation: "spin 0.7s linear infinite", flexShrink: 0,
                }} />
              )}
              {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: theme.textSubtle, marginTop: 20, fontFamily: fontMono }}>
          Your data stays private — no selling, no sharing.
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
