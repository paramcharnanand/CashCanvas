import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { LoadingScreen } from "../components/ui/LoadingScreen.jsx";
import { AuthShell } from "../features/auth/components/AuthShell.jsx";
import { ResetPasswordForm } from "../features/auth/components/ResetPasswordForm.jsx";

/**
 * Mounted at "/reset-password" (see router.jsx). Reads `?token=` via
 * useSearchParams, replacing AuthScreen.jsx's old manual
 * `window.location.search` sniff — the exact change the migration plan's
 * Phase 2 called for. Was previously a reused PublicHomePage.jsx render
 * (ADR-023); now its own real page, restyled onto design-system primitives.
 */
export default function ResetPasswordPage() {
  const { authChecked, isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();

  if (!authChecked) return <LoadingScreen />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <AuthShell>
      <ResetPasswordForm token={searchParams.get("token") || ""} />
    </AuthShell>
  );
}
