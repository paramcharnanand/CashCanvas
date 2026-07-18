import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./layouts/AppShell.jsx";
import { ProtectedRoute } from "./layouts/ProtectedRoute.jsx";
import PublicHomePage from "./pages/PublicHomePage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";

/**
 * Route table — see docs/frontend/phase-8-component-architecture.md
 * "Routing architecture" for the full target table. Only "/" and
 * "/dashboard" have real pages of their own so far; every other route from
 * that doc lands with its own phase (tracked in src/layouts/navigation.js).
 *
 * /forgot-password and /reset-password are real routes as of this commit,
 * not a later phase — they render the same (unchanged) PublicHomePage/
 * AuthScreen as "/" does, so nothing new to build, but they have to exist:
 * AuthScreen's own reset-token detection keys off `window.location.pathname`
 * containing "reset", which never ran when both paths fell through to the
 * catch-all `Navigate to="/"` below — silently breaking every real
 * password-reset email's link. See ROADMAP.md's Phase 8.2 hotfix note.
 */
export const router = createBrowserRouter([
  { path: "/", element: <PublicHomePage /> },
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
