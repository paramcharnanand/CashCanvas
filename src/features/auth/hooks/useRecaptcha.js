import { useCallback, useEffect, useRef } from "react";

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "";

/** reCAPTCHA v3 (used on signup only) — ported unchanged from AuthScreen.jsx. */
export function useRecaptcha() {
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
