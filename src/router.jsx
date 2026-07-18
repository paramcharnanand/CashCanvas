import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "./layouts/AppShell.jsx";
import { ProtectedRoute } from "./layouts/ProtectedRoute.jsx";
import PublicHomePage from "./pages/PublicHomePage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";

/**
 * Route table — see docs/frontend/phase-8-component-architecture.md
 * "Routing architecture" for the full target table. Only "/" and
 * "/dashboard" are real in Phase 8.1; every other route from that doc lands
 * with its own phase (tracked in src/layouts/navigation.js).
 */
export const router = createBrowserRouter([
  { path: "/", element: <PublicHomePage /> },
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [{ index: true, element: <DashboardPage /> }],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
