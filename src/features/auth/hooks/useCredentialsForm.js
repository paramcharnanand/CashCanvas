import { useState } from "react";
import { apiFetch } from "../../../api.js";
import { useRecaptcha } from "./useRecaptcha.js";

/** Ported unchanged from AuthScreen.jsx's routeError. */
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

/**
 * Shared login/signup submit logic — factored out because LoginForm and
 * SignupForm (src/features/auth/components/) are ~80% identical (field
 * state, error routing, the otpRequired/onAuth branch) now that they're
 * two separate components for two separate routes, not one component with
 * internal mode-toggle state. Only what actually differs per mode (the name
 * field, captcha, endpoint, submit label) stays in the components themselves.
 */
export function useCredentialsForm({ mode, onAuth, onOtpRequired }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ name: "", email: "", password: "", form: "" });
  const [loading, setLoading] = useState(false);
  const getCaptchaToken = useRecaptcha();

  const clearErrors = () => setFieldErrors({ name: "", email: "", password: "", form: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearErrors();

    if (mode === "signup" && !name.trim()) {
      setFieldErrors((p) => ({ ...p, name: "Please enter your name." }));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldErrors((p) => ({ ...p, email: "Please enter a valid email address." }));
      return;
    }
    if (mode === "signup" && password.length < 8) {
      setFieldErrors((p) => ({ ...p, password: "Password must be at least 8 characters." }));
      return;
    }

    setLoading(true);
    const captchaToken = mode === "signup" ? await getCaptchaToken("signup") : undefined;

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
    const body = mode === "login" ? { email, password } : { name, email, password, captchaToken };

    try {
      const res = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setFieldErrors(routeError(data.error || "Something went wrong."));
      } else if (data.otpRequired) {
        onOtpRequired(data.email || email);
      } else if (data.user) {
        onAuth(data.user);
      }
    } catch {
      setFieldErrors({ name: "", email: "", password: "", form: "Cannot connect to the server. Make sure the API is running." });
    } finally {
      setLoading(false);
    }
  };

  return { name, setName, email, setEmail, password, setPassword, fieldErrors, setFieldErrors, loading, handleSubmit };
}
