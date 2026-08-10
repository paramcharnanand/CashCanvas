import { Home, Upload, List, BarChart3, Tag, Store, Target, Settings } from "lucide-react";

/**
 * Single source of truth for primary (bottom) navigation — read by
 * `BottomNav` only (the Command Palette, `features/command-palette/
 * commands.js`, maintains its own independent registry and does not import
 * this file, so disabling an item here does not affect the palette).
 *
 * `mobileLabel` (optional): a shorter label for the compact bottom-nav bar
 * specifically, where equal-width items leave no room for a label as long
 * as "Merchant Rules" without wrapping to a second line. Falls back to
 * `label`.
 *
 * `enabled: false` removes an item from the bottom nav (`SIDEBAR_ITEMS`)
 * while its route stays fully live — used both for planned-but-unbuilt
 * destinations and, as of the Categories/Settings IA rework, for
 * Transactions and Merchant Rules: both are fully functional, reachable via
 * "View All Transactions" on Categories and the Merchant Rules entry on
 * Settings respectively, just intentionally out of the primary nav.
 */
export const NAV_ITEMS = [
  { id: "overview", to: "/dashboard", label: "Overview", icon: Home, enabled: true, phase: null },
  { id: "upload", to: "/upload", label: "Upload", icon: Upload, enabled: true, phase: null },
  { id: "transactions", to: "/transactions", label: "Transactions", icon: List, enabled: false, phase: null },
  { id: "analytics", to: "/analytics", label: "Analytics", icon: BarChart3, enabled: true, phase: null },
  { id: "categories", to: "/categories", label: "Categories", icon: Tag, enabled: true, phase: null },
  { id: "merchant-rules", to: "/merchant-rules", label: "Merchant Rules", mobileLabel: "Rules", icon: Store, enabled: false, phase: null },
  { id: "savings", to: "/savings", label: "Savings", icon: Target, enabled: true, phase: null },
  { id: "settings", to: "/settings", label: "Settings", icon: Settings, enabled: true, phase: null },
];

export const SIDEBAR_ITEMS = NAV_ITEMS.filter((item) => item.enabled);
