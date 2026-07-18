import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { fetchCurrentUser, logout as apiLogout } from "../api.js";

const AuthContext = createContext(null);

/**
 * Same session-check behavior App.jsx has always had (moved here unchanged,
 * not rewritten): auth state comes from the server via the HttpOnly-cookie
 * session, never client storage. The .catch(() => {}) here is deliberate —
 * see the fix earlier this project made to this exact effect (a network
 * failure during the check must not become an unhandled rejection; every
 * other apiFetch call site already catches its own errors).
 */
export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    fetchCurrentUser()
      .then((user) => setAuth(user ? { user } : null))
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  const login = useCallback((user) => {
    setAuth(user ? { user } : null);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setAuth(null);
  }, []);

  return (
    <AuthContext.Provider value={{ auth, authChecked, isAuthenticated: !!auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
