import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "../api/_lib/logger.js";

describe("logger — development format", () => {
  let errorSpy;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "development";
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    errorSpy.mockRestore();
  });

  it("logs a readable [tag] message line, not JSON", () => {
    logger.error("login", "OTP send failed");
    expect(errorSpy).toHaveBeenCalledWith("[login]", "OTP send failed", "");
  });

  it("extracts .message from an Error instance rather than dumping the stack", () => {
    logger.error("login", new Error("boom"));
    const [, loggedMessage] = errorSpy.mock.calls[0];
    expect(loggedMessage).toBe("boom");
  });
});

describe("logger — production format", () => {
  let errorSpy;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "production";
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    errorSpy.mockRestore();
  });

  it("emits a single parseable JSON line with level/tag/message/time", () => {
    logger.error("login", "OTP send failed", { userId: "abc123" });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const raw = errorSpy.mock.calls[0][0];
    const parsed = JSON.parse(raw);
    expect(parsed).toMatchObject({ level: "error", tag: "login", message: "OTP send failed", userId: "abc123" });
    expect(typeof parsed.time).toBe("string");
  });

  it("never emits a raw stack trace for an Error instance", () => {
    logger.error("login", new Error("boom"));
    const parsed = JSON.parse(errorSpy.mock.calls[0][0]);
    expect(parsed.message).toBe("boom");
    expect(JSON.stringify(parsed)).not.toContain(".js:");
  });
});
