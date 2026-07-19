import { useEffect, useRef, useState } from "react";

/**
 * Design-system OTP digit-input primitive — see docs/frontend/
 * phase-8-design-system.md § Form controls ("keep, audit confirmed it's
 * good UX"). Used by both the login/signup verification screen and the
 * password-reset screen (src/features/auth/components/{OtpScreen,
 * ResetPasswordForm}.jsx) — the same six-box, auto-advance, backspace/
 * arrow-nav, paste-fills-all pattern AuthScreen.jsx had implemented twice,
 * now one component.
 *
 * To clear and refocus after a wrong/expired code, pass a changing `key`
 * prop from the parent (a plain remount) rather than an imperative
 * ref/handle — this already reproduces the exact old behavior (fresh
 * empty boxes, box 0 focused) since box 0 auto-focuses on mount.
 *
 * Two independent callbacks, because the two callers want different
 * things: OtpScreen auto-submits the instant the 6th digit lands
 * (`onComplete`, fires once); ResetPasswordForm never auto-submitted in
 * the original — its own "Reset password" button validates the code
 * together with both password fields — so it only needs the running
 * value (`onChange`, fires on every keystroke, complete or not).
 *
 * Each digit box carries its own `aria-label` ("Verification code digit N
 * of 6") — a real, critical-impact a11y gap (axe's `label` rule: no
 * accessible name at all) found in Phase 10's full a11y re-scan of every
 * route, the first time `/reset-password` was ever actually scanned. Fixed
 * here rather than allowlisted since critical-impact violations are this
 * suite's hard gate, not something a per-page allowlist can accept.
 */
export function OtpInput({ onChange, onComplete, error = false, disabled = false }) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef([]);
  const submittedRef = useRef(false);

  useEffect(() => {
    onChange?.(digits.join(""));
    if (onComplete && !submittedRef.current && digits.every((d) => d !== "")) {
      submittedRef.current = true;
      onComplete(digits.join(""));
    }
  }, [digits]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (index, value) => {
    const cleaned = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);
    if (cleaned && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const next = [...digits];
        next[index] = "";
        setDigits(next);
      } else if (index > 0) {
        const next = [...digits];
        next[index - 1] = "";
        setDigits(next);
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
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "center" }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (inputRefs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          disabled={disabled}
          aria-label={`Verification code digit ${i + 1} of 6`}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          autoFocus={i === 0}
          style={{
            width: 44,
            height: 52,
            textAlign: "center",
            font: "600 22px/1.2 var(--font-numeral)",
            background: "var(--surface-alt)",
            border: `1.5px solid ${error ? "var(--negative)" : d ? "var(--primary)" : "var(--border)"}`,
            borderRadius: "var(--radius-md)",
            color: "var(--text)",
            outline: "none",
            transition: `border-color ${"var(--duration-fast)"} var(--ease-standard)`,
          }}
          onFocus={(e) => { e.target.style.borderColor = error ? "var(--negative)" : "var(--primary)"; }}
          onBlur={(e) => { e.target.style.borderColor = error ? "var(--negative)" : d ? "var(--primary)" : "var(--border)"; }}
        />
      ))}
    </div>
  );
}
