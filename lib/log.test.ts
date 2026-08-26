import { describe, expect, it, vi, afterEach } from "vitest";
import { log, logError } from "@/lib/log";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("log", () => {
  it("writes a single JSON line to stdout with level, event, and timestamp", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log("sign_in_attempt", { identifier: "abc123", outcome: "sent" });

    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed).toMatchObject({
      level: "info",
      event: "sign_in_attempt",
      identifier: "abc123",
      outcome: "sent",
    });
    expect(new Date(parsed.timestamp).toString()).not.toBe("Invalid Date");
  });

  it("omits fields entirely when none are given", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log("health_check");
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.event).toBe("health_check");
  });
});

describe("logError", () => {
  it("writes to stderr with level 'error'", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("dependency_degraded", { dependency: "database", reason: "timeout" });

    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed).toMatchObject({
      level: "error",
      event: "dependency_degraded",
      dependency: "database",
      reason: "timeout",
    });
  });
});
