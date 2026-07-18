import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { LoadingScreen } from "../components/ui/LoadingScreen.jsx";
import { AuthShell } from "../features/auth/components/AuthShell.jsx";
import { LoginForm } from "../features/auth/components/LoginForm.jsx";
import { OtpScreen } from "../features/auth/components/OtpScreen.jsx";

/**
 * Mounted at "/login" (see router.jsx). Landing (now "/") claims the
 * unauthenticated home, so the sign-in form needs its own real route —
 * this is also what ProtectedRoute redirects to. Restyled onto
 * design-system primitives as of Phase 8.3 (LoginForm/OtpScreen,
 * src/features/auth/) — AuthScreen.jsx is retired.
 */
export default function LoginPage() {
  const { authChecked, isAuthenticated, login } = useAuth();
  const [searchParams] = useSearchParams();
  const [otpEmail, setOtpEmail] = useState("");

  if (!authChecked) return <LoadingScreen />;

  if (isAuthenticated) {
    const redirect = searchParams.get("redirect");
    return <Navigate to={redirect || "/dashboard"} replace />;
  }

  return (
    <AuthShell>
      {otpEmail
        ? <OtpScreen email={otpEmail} onVerified={login} onBack={() => setOtpEmail("")} />
        : <LoginForm onAuth={login} onOtpRequired={setOtpEmail} />}
    </AuthShell>
  );
}
