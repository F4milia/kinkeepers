import { describe, expect, it, vi, beforeEach } from "vitest";
import { requestEmailLink, requestSmsCode } from "@/lib/auth/actions";

// Mocked rather than run against the real local stack (this codebase's
// usual preference) because the bug being fixed is specifically about
// which emailRedirectTo string gets constructed and handed to
// signInWithOtp - a pure request-derivation question, not something
// that needs a real GoTrue round-trip to verify. next/headers is mocked
// because headers() throws outside a real Next.js request context, same
// as cookies()/revalidatePath() elsewhere in this codebase.
const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
const headersGet = vi.fn();

vi.mock("next/headers", () => ({
  headers: async () => ({ get: headersGet }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signInWithOtp } }),
}));

vi.mock("@/lib/auth/rate-limit", () => ({
  checkSignInRateLimit: async () => ({ allowed: true }),
}));

vi.mock("@/lib/auth/log-sign-in-event", () => ({
  logSignInEvent: async () => {},
}));

describe("requestEmailLink", () => {
  beforeEach(() => {
    signInWithOtp.mockClear();
    headersGet.mockReset();
    // Both pre-existing tests below exercise production behavior (they
    // already set NODE_ENV=production for URL derivation) - APP_ENV must
    // say the same, or the new staging-guard check added below would
    // block them against an empty local allowlist and break both tests.
    vi.stubEnv("APP_ENV", "production");
  });

  it("builds emailRedirectTo from the actual request's host, not a fixed env var", async () => {
    headersGet.mockImplementation((name: string) =>
      name === "host" ? "kinkeepers-git-main-developer-4044s-projects.vercel.app" : null,
    );
    const originalEnv = process.env.NODE_ENV;
    // @ts-expect-error - test-only override of a normally-readonly value
    process.env.NODE_ENV = "production";

    await requestEmailLink("caregiver@example.com");

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "caregiver@example.com",
      options: {
        emailRedirectTo: "https://kinkeepers-git-main-developer-4044s-projects.vercel.app/auth/callback",
      },
    });

    // @ts-expect-error - restoring the test-only override above
    process.env.NODE_ENV = originalEnv;
  });

  it("uses a different host correctly - the redirect always matches whatever deployment made the request", async () => {
    headersGet.mockImplementation((name: string) => (name === "host" ? "kinkeepers.vercel.app" : null));
    const originalEnv = process.env.NODE_ENV;
    // @ts-expect-error - test-only override of a normally-readonly value
    process.env.NODE_ENV = "production";

    await requestEmailLink("caregiver@example.com");

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "caregiver@example.com",
      options: { emailRedirectTo: "https://kinkeepers.vercel.app/auth/callback" },
    });

    // @ts-expect-error - restoring the test-only override above
    process.env.NODE_ENV = originalEnv;
  });
});

// X1 audit finding (2026-09-04): signInWithOtp() triggers a real,
// automatic GoTrue email/SMS send with no involvement from
// lib/messaging/send-email.ts at all, so that module's own staging-guard
// call did nothing to protect this path - a real caregiver's email typed
// into a staging/preview sign-in form would have reached them for real.
// This suite proves the fix: the real Supabase call is never reached at
// all for a blocked recipient, not just that the function returns
// failure (a mocked signInWithOtp resolving `{error: null}` unconditionally
// would make a "did it fail correctly" assertion pass even if the guard
// were never called - only "was signInWithOtp invoked" proves the block
// actually happened before the real send).
describe("requestEmailLink / requestSmsCode staging guard", () => {
  beforeEach(() => {
    signInWithOtp.mockClear();
    headersGet.mockImplementation((name: string) => (name === "host" ? "kinkeepers.vercel.app" : null));
  });

  it("blocks a non-allowlisted email in a non-production environment before signInWithOtp is ever called", async () => {
    vi.stubEnv("APP_ENV", "");
    vi.stubEnv("STAGING_MESSAGE_ALLOWLIST", "team@brandlamb.com");

    const result = await requestEmailLink("real-caregiver@example.com");

    expect(result).toEqual({ success: false, reason: "send_failed" });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("allows an allowlisted email through in a non-production environment", async () => {
    vi.stubEnv("APP_ENV", "");
    vi.stubEnv("STAGING_MESSAGE_ALLOWLIST", "team@brandlamb.com");

    const result = await requestEmailLink("team@brandlamb.com");

    expect(result).toEqual({ success: true });
    expect(signInWithOtp).toHaveBeenCalled();
  });

  it("allows any email through in production, regardless of the allowlist", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("STAGING_MESSAGE_ALLOWLIST", "team@brandlamb.com");

    const result = await requestEmailLink("real-caregiver@example.com");

    expect(result).toEqual({ success: true });
    expect(signInWithOtp).toHaveBeenCalled();
  });

  it("requestSmsCode has the same guard, blocking a non-allowlisted phone before signInWithOtp is called", async () => {
    vi.stubEnv("APP_ENV", "");
    vi.stubEnv("STAGING_MESSAGE_ALLOWLIST", "+15550100001");

    const result = await requestSmsCode("+15550199999");

    expect(result).toEqual({ success: false, reason: "send_failed" });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });
});
