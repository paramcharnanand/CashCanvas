import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { LoadingScreen } from "../components/ui/LoadingScreen.jsx";
import { AuthShell } from "../features/auth/components/AuthShell.jsx";
import { SignupForm } from "../features/auth/components/SignupForm.jsx";
import { OtpScreen } from "../features/auth/components/OtpScreen.jsx";

/**
 * Mounted at "/signup" (see router.jsx) — mirrors LoginPage.jsx exactly,
 * just composing SignupForm instead. Restyled onto design-system
 * primitives as of Phase 8.3.
 */
export default function SignupPage() {
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
        : <SignupForm onAuth={login} onOtpRequired={setOtpEmail} />}
    </AuthShell>
  );
}
