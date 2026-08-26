import { describe, expect, it, vi, afterEach } from "vitest";
import { checkHealth } from "@/lib/health/check-health";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("checkHealth", () => {
  it("reports healthy when database and auth are reachable", async () => {
    const result = await checkHealth();
    expect(result.status).toBe("healthy");
    expect(result.checks.database.status).toBe("healthy");
    expect(result.checks.auth.status).toBe("healthy");
  });

  it("reports zoom as not_configured (P3 hasn't landed)", async () => {
    const result = await checkHealth();
    expect(result.checks.zoom.status).toBe("not_configured");
  });

  it("correctly reports a degraded dependency - real unreachable database, not a mock", async () => {
    // A syntactically valid but unreachable host, so this is a genuine
    // network failure, not a simulated one.
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:1");

    const result = await checkHealth();

    expect(result.status).toBe("degraded");
    expect(result.checks.database.status).toBe("unhealthy");
    expect(result.checks.database.error).toBeTruthy();
  });

  it("logs the degraded case as a single structured line containing only status identifiers", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:1");

    await checkHealth();

    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.event).toBe("health_check");
    expect(parsed.status).toBe("degraded");
    expect(parsed.database).toBe("unhealthy");
    // Every field is a short status string, never an error message, a
    // stack trace, or anything resembling content - that's the point.
    for (const [key, value] of Object.entries(parsed)) {
      if (key === "timestamp") continue;
      expect(typeof value === "string" && value.length < 40).toBe(true);
    }
  });

  it("logs the healthy case to stdout, not stderr", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await checkHealth();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
  });
});
