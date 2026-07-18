import { Navigate, useSearchParams } from "react-router-dom";
import AuthScreen from "../AuthScreen.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { LoadingScreen } from "../components/ui/LoadingScreen.jsx";

/**
 * Mounted at "/". Not yet the real Landing page (that's Phase 8.2) — for
 * now this preserves exactly the pre-Phase-8 unauthenticated experience
 * (the login/signup card, unchanged), just reached via a real route instead
 * of App.jsx's old `if (!auth) return <AuthScreen/>` branch. An
 * authenticated visitor is redirected to /dashboard (or wherever
 * ProtectedRoute sent them here from, via ?redirect=).
 */
export default function PublicHomePage() {
  const { authChecked, isAuthenticated, login } = useAuth();
  const [searchParams] = useSearchParams();

  if (!authChecked) return <LoadingScreen />;

  if (isAuthenticated) {
    const redirect = searchParams.get("redirect");
    return <Navigate to={redirect || "/dashboard"} replace />;
  }

  return <AuthScreen onAuth={login} />;
}
