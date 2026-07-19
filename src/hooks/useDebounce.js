import { useEffect, useState } from "react";

/** Returns `value`, delayed by `delayMs` — resets the timer on every change. */
export function useDebounce(value, delayMs = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}
