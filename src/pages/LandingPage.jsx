import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { LoadingScreen } from "../components/ui/LoadingScreen.jsx";
import { Hero } from "../features/landing/components/Hero.jsx";
import { ProductPreview } from "../features/landing/components/ProductPreview.jsx";
import { FeatureGrid } from "../features/landing/components/FeatureGrid.jsx";

/**
 * Mounted at "/" (see router.jsx). The real marketing landing page — see
 * docs/frontend/phase-8-audit.md §13/14: previously "/" *was* the login
 * card directly, with no distinct unauthenticated experience at all.
 * An authenticated visitor is redirected past this straight to /dashboard
 * (or wherever ProtectedRoute sent them here from, via ?redirect=) — same
 * behavior the old PublicHomePage had, just no longer paired with rendering
 * the auth form itself, since that now lives at /login and /signup.
 */
export default function LandingPage() {
  const { authChecked, isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();

  if (!authChecked) return <LoadingScreen />;

  if (isAuthenticated) {
    const redirect = searchParams.get("redirect");
    return <Navigate to={redirect || "/dashboard"} replace />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "var(--font-body)" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--space-5) var(--space-6)",
          maxWidth: 1080,
          margin: "0 auto",
        }}
      >
        <Link
          to="/"
          style={{
            font: "var(--text-heading-md)",
            fontStyle: "italic",
            color: "var(--text)",
            textDecoration: "none",
          }}
        >
          Cash<span style={{ color: "var(--primary)" }}>Canvas</span>
        </Link>

        <nav aria-label="Primary navigation" style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
          <Link
            to="/login"
            style={{ font: "var(--text-body-sm)", fontWeight: 600, color: "var(--text-subtle)", textDecoration: "none" }}
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            style={{
              height: 36,
              padding: "0 var(--space-4)",
              display: "inline-flex",
              alignItems: "center",
              borderRadius: "var(--radius-sm)",
              background: "var(--primary)",
              color: "var(--on-primary)",
              font: "var(--text-body-sm)",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Get started
          </Link>
        </nav>
      </header>

      <main>
        <Hero />
        <ProductPreview />
        <FeatureGrid />
      </main>

      <footer
        style={{
          textAlign: "center",
          padding: "var(--space-8) var(--space-4) var(--space-10)",
          color: "var(--text-subtle)",
          font: "var(--text-body-sm)",
        }}
      >
        Your data stays private — no selling, no sharing.
      </footer>
    </div>
  );
}
