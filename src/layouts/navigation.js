import { Home, Upload, List, BarChart3, Tag, Store, Target, Settings } from "lucide-react";

/**
 * Single source of truth for primary navigation — read by Sidebar,
 * MobileNav, and the Command Palette, so they can never drift out of sync
 * with each other or with which pages actually exist yet.
 *
 * `enabled: false` items are real, planned destinations (already specified
 * in docs/frontend/phase-8-migration-plan.md) that don't have a route yet —
 * shown as disabled/"coming soon" in the Command Palette rather than
 * omitted outright (so the palette reflects the product's real shape), but
 * deliberately left OUT of the Sidebar/MobileNav entirely until their phase
 * ships a real page — a nav link with nowhere real to go is worse than an
 * absent one.
 */
export const NAV_ITEMS = [
  { id: "overview", to: "/dashboard", label: "Overview", icon: Home, enabled: true, phase: null },
  { id: "upload", to: "/upload", label: "Upload", icon: Upload, enabled: true, phase: null },
  { id: "transactions", to: "/transactions", label: "Transactions", icon: List, enabled: true, phase: null },
  { id: "analytics", to: "/analytics", label: "Analytics", icon: BarChart3, enabled: true, phase: null },
  { id: "categories", to: "/categories", label: "Categories", icon: Tag, enabled: false, phase: "8.8" },
  { id: "merchant-rules", to: "/merchant-rules", label: "Merchant Rules", icon: Store, enabled: false, phase: "8.8" },
  { id: "savings", to: "/savings", label: "Savings", icon: Target, enabled: false, phase: "8.9" },
  { id: "settings", to: "/settings", label: "Settings", icon: Settings, enabled: false, phase: "8.9" },
];

export const SIDEBAR_ITEMS = NAV_ITEMS.filter((item) => item.enabled);
