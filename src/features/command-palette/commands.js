import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Home,
  Upload,
  List,
  BarChart3,
  Tag,
  Store,
  Settings,
  Sun,
  Moon,
  Monitor,
  FileText,
  HelpCircle,
  LogOut,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useTheme } from "../../contexts/ThemeContext.jsx";

const THEME_ICON = { light: Sun, dark: Moon, system: Monitor };

/**
 * Command Palette registry. Every entry the product will eventually have is
 * listed now (matches what was asked for and approved in the mockups) —
 * entries without a real destination yet are `enabled: false` with a
 * `comingIn` phase tag, shown disabled in the palette rather than omitted,
 * so what the product is builds toward stays visible. Wiring a real command
 * in later phases means flipping `enabled: true` and adding its `action`
 * here — nothing about the palette component itself needs to change.
 */
export function useCommands({ onShowShortcuts }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { preference, cyclePreference } = useTheme();
  const ThemeIcon = THEME_ICON[preference];

  return useMemo(
    () => [
      {
        id: "go-dashboard",
        label: "Go to Dashboard",
        icon: Home,
        keywords: "home overview",
        enabled: true,
        action: () => navigate("/dashboard"),
      },
      {
        id: "upload",
        label: "Upload a statement",
        icon: Upload,
        keywords: "csv pdf import upload bank statement",
        enabled: true,
        action: () => navigate("/dashboard"),
      },
      {
        id: "toggle-theme",
        label: `Theme: ${preference[0].toUpperCase()}${preference.slice(1)} (click to change)`,
        icon: ThemeIcon,
        keywords: "dark mode light system theme appearance",
        enabled: true,
        action: cyclePreference,
      },
      {
        id: "shortcuts",
        label: "Keyboard shortcuts",
        icon: HelpCircle,
        keywords: "help shortcuts keyboard ?",
        enabled: true,
        action: onShowShortcuts,
      },
      {
        id: "sign-out",
        label: "Sign out",
        icon: LogOut,
        keywords: "logout sign out",
        enabled: true,
        action: logout,
      },
      {
        id: "transactions",
        label: "Search transactions",
        icon: List,
        keywords: "transactions search filter merchant",
        enabled: false,
        comingIn: "8.6",
      },
      {
        id: "jump-month",
        label: "Jump to month",
        icon: List,
        keywords: "transactions month date jump",
        enabled: false,
        comingIn: "8.6",
      },
      {
        id: "create-category",
        label: "Create category",
        icon: Tag,
        keywords: "category new create tag",
        enabled: false,
        comingIn: "8.6",
      },
      {
        id: "merchant-rules",
        label: "Merchant rules",
        icon: Store,
        keywords: "merchant rules categorize",
        enabled: false,
        comingIn: "8.6",
      },
      {
        id: "analytics",
        label: "Go to Analytics",
        icon: BarChart3,
        keywords: "analytics charts spending",
        enabled: false,
        comingIn: "8.7",
      },
      {
        id: "import-pdf",
        label: "Import PDF statement",
        icon: FileText,
        keywords: "pdf import parse statement",
        enabled: false,
        comingIn: "8.5",
      },
      {
        id: "settings",
        label: "Go to Settings",
        icon: Settings,
        keywords: "settings preferences profile account",
        enabled: false,
        comingIn: "8.8",
      },
    ],
    [navigate, logout, preference, cyclePreference, ThemeIcon, onShowShortcuts]
  );
}
