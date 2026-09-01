import { afterEach, describe, expect, it } from "vitest";
import { sendEmail } from "@/lib/messaging/send-email";

afterEach(() => {
  delete process.env.APP_ENV;
  delete process.env.STAGING_MESSAGE_ALLOWLIST;
});

describe("sendEmail", () => {
  it("blocks a non-allowlisted recipient outside production - the staging guard runs first", async () => {
    await expect(
      sendEmail({ to: "caregiver@example.com", subject: "x", html: "<p>x</p>", logContext: {} }),
    ).rejects.toThrow(/Blocked outbound message/);
  });

  it("named edge case: no RESEND_API_KEY configured (vitest.config.mts's isolated test env never sets it) logs and no-ops rather than throwing, returning false", async () => {
    process.env.STAGING_MESSAGE_ALLOWLIST = "team@example.com";
    // Resolves false, does not throw - the credential-gap path inside
    // sendEmail catches the Resend SDK's synchronous constructor throw.
    await expect(
      sendEmail({ to: "team@example.com", subject: "x", html: "<p>x</p>", logContext: { applicant_id: "abc" } }),
    ).resolves.toBe(false);
  });

  it("allows any recipient in production, regardless of the allowlist (still returns false here - no RESEND_API_KEY in the test env)", async () => {
    process.env.APP_ENV = "production";
    await expect(
      sendEmail({ to: "anyone@example.com", subject: "x", html: "<p>x</p>", logContext: {} }),
    ).resolves.toBe(false);
  });
});
