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

function Field({ label, type, value, onChange, placeholder, error }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: "block", fontSize: 11, fontFamily: fontMono, fontWeight: 600,
        textTransform: "uppercase", letterSpacing: "0.08em",
        color: theme.textSubtle, marginBottom: 6,
      }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{
          width: "100%", padding: "11px 14px", boxSizing: "border-box",
          background: theme.surfaceContainerLow,
          border: `1px solid ${error ? theme.accent : theme.border}`,
          borderRadius: 6, color: theme.text,
          fontFamily: font, fontSize: 14, outline: "none",
          transition: "border-color 0.15s",
        }}
        onFocus={e => { e.target.style.borderColor = theme.primary; }}
        onBlur={e => { e.target.style.borderColor = error ? theme.accent : theme.border; }}
      />
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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
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
        setError(data.error || "Something went wrong");
      } else {
        localStorage.setItem("cc_auth", JSON.stringify({ token: data.token, user: data.user }));
        onAuth({ token: data.token, user: data.user });
      }
    } catch {
      setError("Cannot connect to server. Make sure the API server is running.");
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
            Expense intelligence, beautifully crafted
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: theme.surface, borderRadius: 12, padding: "36px 40px",
          boxShadow: "0 4px 24px rgba(27,28,26,0.08)",
        }}>
          {/* Tab toggle */}
          <div style={{
            display: "flex", background: theme.surfaceContainerLow,
            borderRadius: 8, padding: 4, marginBottom: 28,
          }}>
            {["login", "signup"].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); }} style={{
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

          <form onSubmit={handleSubmit}>
            {mode === "signup" && (
              <Field
                label="Full Name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
              />
            )}
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
              error={error}
            />

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
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = "0.9"; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
            >
              {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: theme.textSubtle, marginTop: 20, fontFamily: fontMono }}>
          Your data stays private — no selling, no sharing.
        </p>
      </div>
    </div>
  );
}
