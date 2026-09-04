import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { sendResumeEmail } from "@/lib/referral/send-resume-email";

// L2 audit finding (2026-09-05): sendResumeEmail() called Resend directly
// with no staging-guard check at all - the same gap already found and
// fixed in lib/auth/actions.ts. Mocking the "resend" package itself
// (rather than relying on the missing-RESEND_API_KEY credential-gap path,
// which fires the same log line regardless of whether the guard ran)
// lets this suite prove the real send is never attempted for a blocked
// recipient - not just that the function resolves without throwing.
// Variable is prefixed `mock` deliberately - vi.mock's factory is hoisted
// above regular variable declarations, and only `mock`-prefixed names are
// safely referenceable inside it.
const mockSend = vi.fn().mockResolvedValue({ error: null });
vi.mock("resend", () => ({
  // A real `class`, not an arrow function passed to mockImplementation -
  // arrow functions have no [[Construct]] internal slot at all in JS, so
  // `new Resend(...)` (real source code) would throw a native TypeError
  // against an arrow-function mock, silently swallowed by the source
  // file's own try/catch and never surfacing as a test failure reason.
  Resend: class {
    emails = { send: mockSend };
  },
}));

beforeEach(() => {
  mockSend.mockClear();
  process.env.NEXT_PUBLIC_SITE_URL = "https://kinkeepers.vercel.app";
});

afterEach(() => {
  delete process.env.APP_ENV;
  delete process.env.STAGING_MESSAGE_ALLOWLIST;
});

describe("sendResumeEmail staging guard", () => {
  it("blocks a non-allowlisted recipient outside production before Resend is ever called", async () => {
    process.env.STAGING_MESSAGE_ALLOWLIST = "team@brandlamb.com";

    await sendResumeEmail("real-caregiver@example.com", "token-1", "applicant-1");

    expect(mockSend).not.toHaveBeenCalled();
  });

  it("allows an allowlisted recipient through to the real send call", async () => {
    process.env.STAGING_MESSAGE_ALLOWLIST = "team@brandlamb.com";

    await sendResumeEmail("team@brandlamb.com", "token-1", "applicant-1");

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "team@brandlamb.com", subject: "Continue your KinKeepers application" }),
    );
  });

  it("allows any recipient through in production, regardless of the allowlist", async () => {
    process.env.APP_ENV = "production";

    await sendResumeEmail("real-caregiver@example.com", "token-1", "applicant-1");

    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ to: "real-caregiver@example.com" }));
  });

  it("never throws for a blocked recipient - the caller (saveIntakeProgress) must not fail", async () => {
    process.env.STAGING_MESSAGE_ALLOWLIST = "team@brandlamb.com";

    await expect(
      sendResumeEmail("real-caregiver@example.com", "token-1", "applicant-1"),
    ).resolves.toBeUndefined();
  });
});
