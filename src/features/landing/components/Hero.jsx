import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

/**
 * Landing's hero — the one place `--text-display-xl` (56px Newsreader
 * italic) is actually used per its own token comment in tokens.css
 * ("landing hero"). No entrance animation here: the design system reserves
 * its one staggered-reveal moment for the Dashboard's first paint
 * (design-system.md § Motion System) — Landing stays as calm as every other
 * non-Dashboard surface, not a second competing "moment."
 */
export function Hero() {
  return (
    <section
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "var(--space-24) var(--space-4) var(--space-16)",
        textAlign: "center",
      }}
    >
      <span
        style={{
          font: "var(--text-label)",
          color: "var(--primary)",
          background: "var(--positive-soft)",
          padding: "6px 14px",
          borderRadius: "var(--radius-full)",
          display: "inline-block",
          marginBottom: "var(--space-6)",
        }}
      >
        Private by default
      </span>

      <h1
        style={{
          font: "var(--text-display-xl)",
          color: "var(--text)",
          margin: "0 0 var(--space-5)",
        }}
      >
        See where your money <span style={{ color: "var(--primary)" }}>actually</span> goes.
      </h1>

      <p
        style={{
          font: "var(--text-body-lg)",
          color: "var(--text-subtle)",
          maxWidth: 520,
          margin: "0 auto var(--space-8)",
        }}
      >
        Upload a bank or credit-card statement — CSV or PDF — and CashCanvas categorizes every
        transaction automatically. No spreadsheets, no manual sorting.
      </p>

      <div
        style={{
          display: "flex",
          gap: "var(--space-3)",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <Link
          to="/signup"
          style={{
            height: 48,
            padding: "0 var(--space-6)",
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-2)",
            borderRadius: "var(--radius-md)",
            background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)",
            color: "var(--on-primary)",
            font: "var(--text-body-md)",
            fontWeight: 600,
            textDecoration: "none",
            transition: "opacity var(--duration-fast) var(--ease-standard)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.92"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
        >
          Get started
          <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
        </Link>

        <Link
          to="/login"
          style={{
            height: 48,
            padding: "0 var(--space-6)",
            display: "inline-flex",
            alignItems: "center",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-strong)",
            color: "var(--text)",
            font: "var(--text-body-md)",
            fontWeight: 600,
            textDecoration: "none",
            background: "transparent",
            transition: "background var(--duration-fast) var(--ease-standard)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          Sign in
        </Link>
      </div>
    </section>
  );
}
