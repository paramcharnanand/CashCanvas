import { Navigate, useSearchParams } from "react-router-dom";
import AuthScreen from "../AuthScreen.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { LoadingScreen } from "../components/ui/LoadingScreen.jsx";

/**
 * Mounted at "/login" (see router.jsx). Landing (now "/") claims the
 * unauthenticated home, so the sign-in form needs its own real route —
 * this is also what ProtectedRoute redirects to. Still the same,
 * unchanged AuthScreen internally (restyling it onto design-system
 * primitives is Phase 8.3's job, not this one) — just told which tab to
 * open on first render.
 */
export default function LoginPage() {
  const { authChecked, isAuthenticated, login } = useAuth();
  const [searchParams] = useSearchParams();

  if (!authChecked) return <LoadingScreen />;

  if (isAuthenticated) {
    const redirect = searchParams.get("redirect");
    return <Navigate to={redirect || "/dashboard"} replace />;
  }

  return <AuthScreen onAuth={login} initialMode="login" />;
}
