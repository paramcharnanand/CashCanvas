import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./layouts/AppShell.jsx";
import { ProtectedRoute } from "./layouts/ProtectedRoute.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import SignupPage from "./pages/SignupPage.jsx";
import PublicHomePage from "./pages/PublicHomePage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";

/**
 * Route table — see docs/frontend/phase-8-component-architecture.md
 * "Routing architecture" for the full target table.
 *
 * "/" is the real Landing page as of Phase 8.2, not AuthScreen directly —
 * which is *why* /login and /signup exist as their own routes now too,
 * not a later phase: once Landing claims "/", the sign-in/sign-up form
 * needs somewhere else to live (also what ProtectedRoute redirects
 * unauthenticated visitors to). /forgot-password and /reset-password keep
 * reusing PublicHomePage unchanged (it never rendered Landing content, just
 * AuthScreen-or-redirect) — nothing about the account-recovery flow needed
 * to change to give Landing its new home at "/".
 */
export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/signup", element: <SignupPage /> },
  { path: "/forgot-password", element: <PublicHomePage /> },
  { path: "/reset-password", element: <PublicHomePage /> },
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [{ index: true, element: <DashboardPage /> }],
  },
  { path: "*", element: <NotFoundPage /> },
]);
