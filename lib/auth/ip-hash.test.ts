import { describe, expect, it, vi, beforeEach } from "vitest";
import { hashRequestIp } from "@/lib/auth/ip-hash";

const mockHeaders = vi.fn();
vi.mock("next/headers", () => ({
  headers: () => mockHeaders(),
}));

describe("hashRequestIp", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_IP_HASH_SECRET", "test-secret-not-real");
  });

  it("returns null when neither x-forwarded-for nor x-real-ip is present", async () => {
    mockHeaders.mockReturnValue(new Headers());
    expect(await hashRequestIp()).toBeNull();
  });

  it("uses the first address in a comma-separated x-forwarded-for (the original client, not intermediate proxies)", async () => {
    mockHeaders.mockReturnValue(new Headers({ "x-forwarded-for": "203.0.113.5, 70.41.3.18, 150.172.238.178" }));
    const hashA = await hashRequestIp();

    mockHeaders.mockReturnValue(new Headers({ "x-forwarded-for": "203.0.113.5" }));
    const hashB = await hashRequestIp();

    expect(hashA).toBe(hashB);
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", async () => {
    mockHeaders.mockReturnValue(new Headers({ "x-real-ip": "198.51.100.7" }));
    expect(await hashRequestIp()).not.toBeNull();
  });

  it("hashes the same IP identically (needed for abuse-review matching) but different IPs differently", async () => {
    mockHeaders.mockReturnValue(new Headers({ "x-real-ip": "198.51.100.7" }));
    const first = await hashRequestIp();
    const second = await hashRequestIp();
    expect(first).toBe(second);

    mockHeaders.mockReturnValue(new Headers({ "x-real-ip": "198.51.100.8" }));
    const different = await hashRequestIp();
    expect(different).not.toBe(first);
  });

  it("never returns the raw IP itself - output is a fixed-length hex digest", async () => {
    mockHeaders.mockReturnValue(new Headers({ "x-real-ip": "198.51.100.7" }));
    const hash = await hashRequestIp();
    expect(hash).not.toContain("198.51.100.7");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("throws if AUTH_IP_HASH_SECRET is not configured - never silently skips hashing", async () => {
    vi.stubEnv("AUTH_IP_HASH_SECRET", "");
    mockHeaders.mockReturnValue(new Headers({ "x-real-ip": "198.51.100.7" }));
    await expect(hashRequestIp()).rejects.toThrow("AUTH_IP_HASH_SECRET is not set");
  });
});
