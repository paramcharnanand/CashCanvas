import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { LoadingScreen } from "../components/ui/LoadingScreen.jsx";

/**
 * Redirects to /login?redirect=<attempted-path> when unauthenticated,
 * preserving the destination — see phase-8-component-architecture.md's
 * "Protected routes" section. LoginPage reads that redirect param and
 * navigates there after a successful login instead of always landing on
 * /dashboard (see LandingPage.jsx/LoginPage.jsx's identical pattern).
 */
export function ProtectedRoute({ children }) {
  const { authChecked, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!authChecked) return <LoadingScreen />;

  if (!isAuthenticated) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  return children;
}
