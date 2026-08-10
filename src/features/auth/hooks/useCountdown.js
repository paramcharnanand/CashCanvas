import { useEffect, useState } from "react";

/**
 * Ticks down to `targetDate` once a second, purely for display — the server
 * is what actually enforces the cooldown (see api/_lib/loginLockout.js), so
 * a fast/slow client clock only affects when this UI re-enables the form,
 * never whether the next real login attempt is accepted.
 *
 * `msLeft`/`expired` are derived fresh from `targetDate` on every render,
 * not stored in state — `targetDate` typically flips from null to a real
 * future Date the moment a cooldown starts, and state seeded from a stale
 * "no target yet" render would read as already-expired for one render
 * until an effect caught up, which was enough for a consumer's own
 * expiry-driven effect to fire on that stale value. `tick` state exists
 * solely to force a re-render once a second; it plays no part in the
 * expired/label calculation.
 */
export function useCountdown(targetDate) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!targetDate) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  const msLeft = targetDate ? Math.max(0, targetDate.getTime() - Date.now()) : 0;
  const totalSeconds = Math.ceil(msLeft / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return { expired: !targetDate || msLeft <= 0, label: `${minutes}:${String(seconds).padStart(2, "0")}` };
}
