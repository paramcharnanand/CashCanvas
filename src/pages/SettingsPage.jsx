import { useState } from "react";
import { LogOut } from "lucide-react";
import { Card } from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { ProfileSection } from "../features/settings/components/ProfileSection.jsx";
import { ThemeToggle } from "../features/settings/components/ThemeToggle.jsx";
import { DeleteAccountDialog } from "../features/settings/components/DeleteAccountDialog.jsx";

/**
 * Mounted at "/settings" (see router.jsx) — a genuinely new screen (audit
 * finding: no Settings, no Profile screen existed at all), per docs/frontend/
 * phase-8-migration-plan.md's Phase 9. Consolidates account info, the theme
 * toggle, sign out, and delete account — the last two moving off the legacy
 * `Dashboard`/`UploadScreen` header's bare buttons, per that phase's "Old
 * implementation removed" note.
 */
export default function SettingsPage() {
  const { auth, logout } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "var(--space-8) var(--space-6)" }}>
      <h1 style={{ font: "var(--text-display-lg)", color: "var(--text)", margin: "0 0 var(--space-6)" }}>
        Settings
      </h1>

      <ProfileSection user={auth?.user} />
      <ThemeToggle />

      <Card style={{ marginBottom: "var(--space-5)" }}>
        <h2 style={{ font: "var(--text-heading-sm)", color: "var(--text)", margin: "0 0 var(--space-4)" }}>Session</h2>
        <Button variant="secondary" onClick={logout}>
          <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
          Sign Out
        </Button>
      </Card>

      <Card>
        <h2 style={{ font: "var(--text-heading-sm)", color: "var(--text)", margin: "0 0 var(--space-2)" }}>Delete Account</h2>
        <p style={{ font: "var(--text-body-sm)", color: "var(--text-subtle)", margin: "0 0 var(--space-4)" }}>
          Permanently delete your account and all associated data.
        </p>
        <Button variant="danger" onClick={() => setDeleteOpen(true)}>Delete Account</Button>
      </Card>

      <DeleteAccountDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onLogout={logout} />
    </div>
  );
}
