import { useState } from "react";
import { LogOut } from "lucide-react";
import { Card } from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useBreakpoint } from "../hooks/useBreakpoint.js";
import { ProfileSection } from "../features/settings/components/ProfileSection.jsx";
import { ThemeToggle } from "../features/settings/components/ThemeToggle.jsx";
import { MerchantRulesSection } from "../features/settings/components/MerchantRulesSection.jsx";
import { DeleteAccountDialog } from "../features/settings/components/DeleteAccountDialog.jsx";

/**
 * Mounted at "/settings". Widened from a single 640px column to an 840px,
 * two-column-on-desktop layout (Account/Appearance | Merchant Rules/Session)
 * as of the Categories/Settings IA rework — the previous single-column width
 * left large unused margins on desktop viewports. Delete Account stays
 * full-width and visually separated as a destructive action.
 */
export default function SettingsPage() {
  const { auth, logout } = useAuth();
  const { atLeast } = useBreakpoint();
  const twoColumn = atLeast("md");
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div style={{ maxWidth: 840, margin: "0 auto", padding: "var(--space-8) var(--space-6)" }}>
      <h1 style={{ font: "var(--text-display-lg)", color: "var(--text)", margin: "0 0 var(--space-6)" }}>
        Settings
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: twoColumn ? "1fr 1fr" : "1fr", gap: "0 var(--space-5)" }}>
        <div>
          <ProfileSection user={auth?.user} />
          <ThemeToggle />
        </div>
        <div>
          <MerchantRulesSection />
          <Card style={{ marginBottom: "var(--space-5)" }}>
            <h2 style={{ font: "var(--text-heading-sm)", color: "var(--text)", margin: "0 0 var(--space-4)" }}>Session</h2>
            <Button variant="secondary" onClick={logout}>
              <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
              Sign Out
            </Button>
          </Card>
        </div>
      </div>

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
