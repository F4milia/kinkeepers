import { describe, expect, it, vi, beforeEach } from "vitest";
import { requestEmailLink } from "@/lib/auth/actions";

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
