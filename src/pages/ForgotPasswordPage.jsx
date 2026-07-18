import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { LoadingScreen } from "../components/ui/LoadingScreen.jsx";
import { AuthShell } from "../features/auth/components/AuthShell.jsx";
import { ForgotPasswordForm } from "../features/auth/components/ForgotPasswordForm.jsx";

/**
 * Mounted at "/forgot-password" (see router.jsx). Was previously a reused
 * PublicHomePage.jsx render (a route existing since the Phase 8.2 hotfix,
 * ADR-023); now its own real page as of Phase 8.3, restyled onto
 * design-system primitives.
 */
export default function ForgotPasswordPage() {
  const { authChecked, isAuthenticated } = useAuth();

  if (!authChecked) return <LoadingScreen />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <AuthShell>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
