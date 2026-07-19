import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./layouts/AppShell.jsx";
import { ProtectedRoute } from "./layouts/ProtectedRoute.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import SignupPage from "./pages/SignupPage.jsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.jsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import UploadPage from "./pages/UploadPage.jsx";
import TransactionsPage from "./pages/TransactionsPage.jsx";
import AnalyticsPage from "./pages/AnalyticsPage.jsx";
import CategoriesPage from "./pages/CategoriesPage.jsx";
import MerchantRulesPage from "./pages/MerchantRulesPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";

/**
 * Route table — see docs/frontend/phase-8-component-architecture.md
 * "Routing architecture" for the full target table.
 *
 * "/" is the real Landing page as of Phase 8.2, not AuthScreen directly —
 * which is *why* /login and /signup exist as their own routes too. As of
 * Phase 8.3, every public auth route (login/signup/forgot/reset) has its
 * own restyled page built on design-system primitives
 * (src/features/auth/) — AuthScreen.jsx and the PublicHomePage.jsx
 * reuse-for-forgot/reset pattern are both retired.
 */
export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/signup", element: <SignupPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  {
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/upload", element: <UploadPage /> },
      { path: "/transactions", element: <TransactionsPage /> },
      { path: "/analytics", element: <AnalyticsPage /> },
      { path: "/categories", element: <CategoriesPage /> },
      { path: "/merchant-rules", element: <MerchantRulesPage /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
