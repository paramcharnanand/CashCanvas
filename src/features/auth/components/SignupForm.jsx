import { Link } from "react-router-dom";
import { Field } from "../../../components/ui/Field.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { useCredentialsForm } from "../hooks/useCredentialsForm.js";

/**
 * Mounted inside SignupPage.jsx (see router.jsx's /signup route). Mirrors
 * LoginForm.jsx — same restyle, same shared useCredentialsForm logic,
 * differing only in the fields/copy signup itself always had (name field,
 * password hint, captcha via useCredentialsForm's mode="signup" branch).
 */
export function SignupForm({ onAuth, onOtpRequired }) {
  const { name, setName, email, setEmail, password, setPassword, fieldErrors, loading, handleSubmit } =
    useCredentialsForm({ mode: "signup", onAuth, onOtpRequired });

  return (
    <div>
      <div style={{ display: "flex", background: "var(--surface-alt)", borderRadius: "var(--radius-md)", padding: 4, marginBottom: "var(--space-8)" }}>
        <Link
          to="/login"
          style={{
            flex: 1, padding: "var(--space-2)", borderRadius: "var(--radius-sm)",
            color: "var(--text-subtle)", font: "var(--text-body-sm)",
            textAlign: "center", textDecoration: "none",
          }}
        >
          Sign In
        </Link>
        <div
          style={{
            flex: 1, padding: "var(--space-2)", borderRadius: "var(--radius-sm)",
            background: "var(--surface)", color: "var(--primary)",
            font: "var(--text-body-sm)", fontWeight: 600, textAlign: "center",
            boxShadow: "var(--elevation-1)",
          }}
        >
          Create Account
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <Field
          label="Full Name" type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Your name" autoComplete="name" error={fieldErrors.name}
        />
        <Field
          label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com" autoComplete="email" error={fieldErrors.email}
        />
        <Field
          label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters" autoComplete="new-password" error={fieldErrors.password}
          showToggle
        />

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
          {loading ? "Please wait…" : "Create Account"}
        </Button>
      </form>
    </div>
  );
}
