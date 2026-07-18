import { createContext, useContext, useCallback, useEffect, useState } from "react";

const ThemeContext = createContext(null);

const STORAGE_KEY = "cc-theme";

function readStoredPreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // localStorage unavailable (private browsing, etc.) — fall through to default.
  }
  return "system";
}

/**
 * Three modes, not two: light / dark / system (default). "System" follows
 * prefers-color-scheme and needs no stored preference at all — most users
 * should never have to think about this. See
 * docs/frontend/phase-8-design-system.md § Theme System.
 */
export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(readStoredPreference);

  useEffect(() => {
    const root = document.documentElement;
    if (preference === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", preference);
    }
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Non-fatal — preference just won't persist across sessions.
    }
  }, [preference]);

  const cyclePreference = useCallback(() => {
    setPreference((p) => (p === "system" ? "light" : p === "light" ? "dark" : "system"));
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, setPreference, cyclePreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
