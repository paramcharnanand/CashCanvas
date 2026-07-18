import { Navigate, useSearchParams } from "react-router-dom";
import AuthScreen from "../AuthScreen.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { LoadingScreen } from "../components/ui/LoadingScreen.jsx";

/**
 * Mounted at "/signup" (see router.jsx) — mirrors LoginPage.jsx exactly,
 * just opening AuthScreen on its "Create Account" tab instead.
 */
export default function SignupPage() {
  const { authChecked, isAuthenticated, login } = useAuth();
  const [searchParams] = useSearchParams();

  if (!authChecked) return <LoadingScreen />;

  if (isAuthenticated) {
    const redirect = searchParams.get("redirect");
    return <Navigate to={redirect || "/dashboard"} replace />;
  }

  return <AuthScreen onAuth={login} initialMode="signup" />;
}
