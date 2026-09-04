import { describe, expect, it, vi, beforeEach } from "vitest";
import { getRequestOrigin, requestEmailLink } from "@/lib/auth/actions";

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

    await requestEmailLink("caregiver@example.com");

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "caregiver@example.com",
      options: {
        emailRedirectTo: "https://kinkeepers-git-main-developer-4044s-projects.vercel.app/auth/callback",
      },
    });
  });

  it("uses a different host correctly - the redirect always matches whatever deployment made the request", async () => {
    headersGet.mockImplementation((name: string) => (name === "host" ? "kinkeepers.vercel.app" : null));

    await requestEmailLink("caregiver@example.com");

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "caregiver@example.com",
      options: { emailRedirectTo: "https://kinkeepers.vercel.app/auth/callback" },
    });
  });
});

// Direct coverage for the protocol-selection bug found during the
// 2026-09-04 acceptance-criteria audit (A1): a locally run PRODUCTION
// build (`next build && next start`, exactly what playwright.config.ts's
// e2e webServer runs) has NODE_ENV === "production" same as a real
// deployment, but no TLS - the previous NODE_ENV-only check produced
// `https` for it anyway, and GoTrue would redirect to a URL nothing was
// listening on. Real Vercel traffic always carries `x-forwarded-proto`;
// this is what a local server (dev OR a locally-run production build)
// never has, which is the actual distinguishing signal, not NODE_ENV.
describe("getRequestOrigin", () => {
  beforeEach(() => {
    headersGet.mockReset();
  });

  it("prefers x-forwarded-proto when present, regardless of host", async () => {
    headersGet.mockImplementation((name: string) => {
      if (name === "host") return "kinkeepers.vercel.app";
      if (name === "x-forwarded-proto") return "https";
      return null;
    });
    expect(await getRequestOrigin()).toBe("https://kinkeepers.vercel.app");
  });

  it("falls back to http for a local host with no forwarded-proto header - a locally run production build included", async () => {
    headersGet.mockImplementation((name: string) => (name === "host" ? "127.0.0.1:3000" : null));
    expect(await getRequestOrigin()).toBe("http://127.0.0.1:3000");
  });

  it("falls back to http for localhost specifically, not just 127.0.0.1", async () => {
    headersGet.mockImplementation((name: string) => (name === "host" ? "localhost:3000" : null));
    expect(await getRequestOrigin()).toBe("http://localhost:3000");
  });

  it("falls back to https for a real, non-local host with no forwarded-proto header", async () => {
    headersGet.mockImplementation((name: string) => (name === "host" ? "kinkeepers.vercel.app" : null));
    expect(await getRequestOrigin()).toBe("https://kinkeepers.vercel.app");
  });
});
