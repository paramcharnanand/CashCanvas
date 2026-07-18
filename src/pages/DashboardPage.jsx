import { LegacyWorkspace } from "../App.jsx";

/**
 * Mounted at /dashboard, inside AppShell + ProtectedRoute (see router.jsx).
 * LegacyWorkspace is the pre-Phase-8 Upload/Dashboard state machine,
 * unchanged — split into its own real page (Overview) and Upload
 * (Phase 8.4/8.5) once each is rewritten.
 */
export default function DashboardPage() {
  return <LegacyWorkspace />;
}
