import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { LoadingScreen } from "../components/ui/LoadingScreen.jsx";

/**
 * Redirects to /login?redirect=<attempted-path> when unauthenticated,
 * preserving the destination — see phase-8-component-architecture.md's
 * "Protected routes" section. (The dedicated /login route lands in Phase
 * 8.3; until then this redirects to "/", which renders the sign-in form
 * directly — see router.jsx.)
 */
export function ProtectedRoute({ children }) {
  const { authChecked, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!authChecked) return <LoadingScreen />;

  if (!isAuthenticated) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/?redirect=${redirect}`} replace />;
  }

  return children;
}
