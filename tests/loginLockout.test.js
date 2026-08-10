import { describe, it, expect } from "vitest";
import {
  checkLoginGate,
  recordLoginResult,
  CLEAR_LOCKOUT_FIELDS,
  MAX_ATTEMPTS_PER_CYCLE,
  COOLDOWN_MS,
  RESET_REQUIRED_REPEAT_LIMIT,
  FREEZE_MS,
} from "../api/_lib/loginLockout.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");
const freshUser = (overrides = {}) => ({
  failedLogins: 0,
  lockedUntil: null,
  lockoutCycles: 0,
  passwordResetRequired: false,
  resetRequiredAttempts: 0,
  freezeUntil: null,
  ...overrides,
});

/** Drive `count` consecutive wrong passwords through the real gate+record pipeline, starting from `user`. */
function failNTimes(user, count, now = NOW) {
  let current = user;
  let last;
  for (let i = 0; i < count; i++) {
    const gate = checkLoginGate(current, now);
    if (gate) {
      current = { ...current, ...gate.fields };
      last = gate;
      continue;
    }
    const result = recordLoginResult(current, now, false);
    current = { ...current, ...result.fields };
    last = result;
  }
  return { user: current, last };
}

describe("checkLoginGate — attempts 1-3 stay usable", () => {
  it("returns null (not gated) for a clean account", () => {
    expect(checkLoginGate(freshUser(), NOW)).toBeNull();
  });

  it.each([1, 2, 3])("wrong attempt #%i is a plain 401, no lock", (n) => {
    const { user, last } = failNTimes(freshUser(), n);
    expect(last.status).toBe(401);
    expect(last.body.error).toBe("Incorrect password. Please try again.");
    expect(user.lockedUntil).toBeNull();
    expect(user.passwordResetRequired).toBe(false);
  });
});

describe("4th consecutive wrong password starts a 15-minute cooldown", () => {
  it("the 4th failure itself returns 429 with the cooldown message and sets lockedUntil ~15min out", () => {
    const { user, last } = failNTimes(freshUser(), MAX_ATTEMPTS_PER_CYCLE);
    expect(last.status).toBe(429);
    expect(last.body.error).toBe("Too many incorrect attempts. Please try again in 15 minutes.");
    expect(user.lockedUntil).toBeTruthy();
    expect(new Date(user.lockedUntil).getTime() - NOW.getTime()).toBe(COOLDOWN_MS);
    expect(user.lockoutCycles).toBe(1);
  });
});

describe("cooldown is enforced server-side and cannot be extended/bypassed", () => {
  it("blocks a further attempt (even with fields unchanged) while still within the cooldown window", () => {
    const { user: locked } = failNTimes(freshUser(), MAX_ATTEMPTS_PER_CYCLE);
    const midCooldown = new Date(NOW.getTime() + COOLDOWN_MS / 2);

    const gate = checkLoginGate(locked, midCooldown);
    expect(gate).not.toBeNull();
    expect(gate.status).toBe(429);
    expect(gate.fields).toEqual({});
  });

  it("a correct password submitted mid-cooldown is still rejected (gate runs before any password check)", () => {
    const { user: locked } = failNTimes(freshUser(), MAX_ATTEMPTS_PER_CYCLE);
    const midCooldown = new Date(NOW.getTime() + 1000);
    const gate = checkLoginGate(locked, midCooldown);
    expect(gate.status).toBe(429);
  });

  it("repeated blocked attempts during cooldown never change lockedUntil or failedLogins", () => {
    const { user: locked } = failNTimes(freshUser(), MAX_ATTEMPTS_PER_CYCLE);
    const t1 = new Date(NOW.getTime() + 1000);
    const t2 = new Date(NOW.getTime() + 2000);

    const gate1 = checkLoginGate(locked, t1);
    const stateAfter1 = { ...locked, ...gate1.fields };
    const gate2 = checkLoginGate(stateAfter1, t2);

    expect(stateAfter1.lockedUntil).toBe(locked.lockedUntil);
    expect(stateAfter1.failedLogins).toBe(locked.failedLogins);
    expect(gate2.status).toBe(429);
    expect(gate2.body.error).toBe(gate1.body.error);
  });
});

describe("cooldown expiration permits another 4-attempt window", () => {
  it("checkLoginGate returns null once `now` is past lockedUntil", () => {
    const { user: locked } = failNTimes(freshUser(), MAX_ATTEMPTS_PER_CYCLE);
    const afterExpiry = new Date(new Date(locked.lockedUntil).getTime() + 1);
    expect(checkLoginGate(locked, afterExpiry)).toBeNull();
  });

  it("the first wrong password after expiry starts a fresh window (failedLogins resets to 1, not 5)", () => {
    const { user: locked } = failNTimes(freshUser(), MAX_ATTEMPTS_PER_CYCLE);
    const afterExpiry = new Date(new Date(locked.lockedUntil).getTime() + 1);
    const result = recordLoginResult(locked, afterExpiry, false);
    expect(result.status).toBe(401);
    expect(result.fields.failedLogins).toBe(1);
  });

  it("3 more wrong passwords after expiry still stay in the normal 401 tier", () => {
    const { user: locked } = failNTimes(freshUser(), MAX_ATTEMPTS_PER_CYCLE);
    const afterExpiry = new Date(new Date(locked.lockedUntil).getTime() + 1);
    const { last } = failNTimes(locked, 3, afterExpiry);
    expect(last.status).toBe(401);
  });
});

describe("a second 4-strike cycle requires a password reset, not a second cooldown", () => {
  it("the 4th failure of the 2nd cycle returns 403 resetRequired, with no new lockedUntil", () => {
    const { user: locked } = failNTimes(freshUser(), MAX_ATTEMPTS_PER_CYCLE);
    const afterExpiry = new Date(new Date(locked.lockedUntil).getTime() + 1);
    const { user, last } = failNTimes(locked, MAX_ATTEMPTS_PER_CYCLE, afterExpiry);

    expect(last.status).toBe(403);
    expect(last.body.error).toBe("For your security, please reset your password before trying again.");
    expect(last.body.resetRequired).toBe(true);
    expect(user.passwordResetRequired).toBe(true);
    expect(user.lockedUntil).toBeNull();
  });

  it("reaching reset-required for the first time does NOT freeze the account", () => {
    const { user: locked } = failNTimes(freshUser(), MAX_ATTEMPTS_PER_CYCLE);
    const afterExpiry = new Date(new Date(locked.lockedUntil).getTime() + 1);
    const { user } = failNTimes(locked, MAX_ATTEMPTS_PER_CYCLE, afterExpiry);
    expect(user.freezeUntil).toBeNull();
  });
});

describe("ignoring the reset requirement RESET_REQUIRED_REPEAT_LIMIT times escalates to a 1-week freeze", () => {
  function reachResetRequired() {
    const { user: locked } = failNTimes(freshUser(), MAX_ATTEMPTS_PER_CYCLE);
    const afterExpiry = new Date(new Date(locked.lockedUntil).getTime() + 1);
    const { user } = failNTimes(locked, MAX_ATTEMPTS_PER_CYCLE, afterExpiry);
    return user;
  }

  it("stays at 403 resetRequired for attempts short of the limit", () => {
    let user = reachResetRequired();
    for (let i = 0; i < RESET_REQUIRED_REPEAT_LIMIT - 1; i++) {
      const gate = checkLoginGate(user, NOW);
      expect(gate.status).toBe(403);
      expect(gate.body.frozen).toBeUndefined();
      user = { ...user, ...gate.fields };
    }
    expect(user.freezeUntil).toBeNull();
  });

  it("the RESET_REQUIRED_REPEAT_LIMIT-th ignored attempt freezes the account for exactly FREEZE_MS", () => {
    let user = reachResetRequired();
    let last;
    for (let i = 0; i < RESET_REQUIRED_REPEAT_LIMIT; i++) {
      const gate = checkLoginGate(user, NOW);
      user = { ...user, ...gate.fields };
      last = gate;
    }
    expect(last.status).toBe(423);
    expect(last.body.frozen).toBe(true);
    expect(user.freezeUntil).toBeTruthy();
    expect(new Date(user.freezeUntil).getTime() - NOW.getTime()).toBe(FREEZE_MS);
  });

  it("a correct password does not stop the reset-required wall — the gate blocks before any password is checked", () => {
    const user = reachResetRequired();
    const gate = checkLoginGate(user, NOW);
    expect(gate.status).toBe(403);
  });
});

describe("while frozen", () => {
  const frozenUser = freshUser({ freezeUntil: new Date(NOW.getTime() + FREEZE_MS) });

  it("every attempt is blocked with 423, regardless of password correctness", () => {
    const gate = checkLoginGate(frozenUser, NOW);
    expect(gate.status).toBe(423);
    expect(gate.body.frozen).toBe(true);
  });

  it("blocked attempts while frozen make no further field changes", () => {
    const gate = checkLoginGate(frozenUser, NOW);
    expect(gate.fields).toEqual({});
  });
});

describe("successful login clears the escalation state", () => {
  it("recordLoginResult(user, now, true) returns CLEAR_LOCKOUT_FIELDS regardless of prior failedLogins", () => {
    const result = recordLoginResult(freshUser({ failedLogins: 3 }), NOW, true);
    expect(result.status).toBe(200);
    expect(result.fields).toEqual(CLEAR_LOCKOUT_FIELDS);
  });
});

describe("CLEAR_LOCKOUT_FIELDS clears every escalation tier, including freeze", () => {
  it("has every field zeroed/nulled/false", () => {
    expect(CLEAR_LOCKOUT_FIELDS).toEqual({
      failedLogins: 0,
      lockedUntil: null,
      lockoutCycles: 0,
      passwordResetRequired: false,
      resetRequiredAttempts: 0,
      freezeUntil: null,
    });
  });
});
