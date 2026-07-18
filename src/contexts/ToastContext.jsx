import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

const ICONS = { positive: CheckCircle2, negative: AlertCircle, warning: AlertTriangle, info: Info };
const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (message, { variant = "info", title } = {}) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, variant, title }]);
      const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: "fixed",
          bottom: "var(--space-6)",
          right: "var(--space-6)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
          maxWidth: 320,
          zIndex: 1000,
        }}
      >
        {toasts.map((t) => {
          const Icon = ICONS[t.variant] || Info;
          return (
            <div
              key={t.id}
              role="status"
              onMouseEnter={() => {
                const timer = timers.current.get(t.id);
                if (timer) clearTimeout(timer);
              }}
              onMouseLeave={() => {
                const timer = setTimeout(() => dismiss(t.id), AUTO_DISMISS_MS);
                timers.current.set(t.id, timer);
              }}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "var(--space-3)",
                background: "var(--surface)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--elevation-3)",
                border: "var(--card-border)",
                padding: "var(--space-4)",
                fontSize: 13,
                fontFamily: "var(--font-body)",
                color: "var(--text)",
              }}
            >
              <Icon
                size={18}
                strokeWidth={1.75}
                style={{
                  flexShrink: 0,
                  marginTop: 1,
                  color: `var(--${t.variant === "positive" ? "positive" : t.variant === "negative" ? "negative" : t.variant === "warning" ? "warning" : "info"})`,
                }}
              />
              <div style={{ flex: 1 }}>
                {t.title && <div style={{ fontWeight: 700, marginBottom: 2 }}>{t.title}</div>}
                <div style={{ color: "var(--text-subtle)", fontSize: 12 }}>{t.message}</div>
              </div>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-subtle)",
                  cursor: "pointer",
                  padding: 2,
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                <X size={14} strokeWidth={1.75} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
