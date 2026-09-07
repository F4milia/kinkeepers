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

  it("named edge case: no RESEND_API_KEY configured (vitest.config.mts's isolated test env never sets it) logs and no-ops rather than throwing, returning the real failure reason", async () => {
    process.env.STAGING_MESSAGE_ALLOWLIST = "team@example.com";
    // Resolves { sent: false, error }, does not throw - the
    // credential-gap path inside sendEmail catches the Resend SDK's
    // synchronous constructor throw. error is asserted as a non-empty
    // string, not an exact message - the Resend SDK's own constructor
    // error text isn't this test's concern, only that a real reason is
    // returned at all (2026-09-08 A5 acceptance audit: this used to be
    // discarded entirely, returning a bare boolean).
    const result = await sendEmail({
      to: "team@example.com",
      subject: "x",
      html: "<p>x</p>",
      logContext: { applicant_id: "abc" },
    });
    expect(result.sent).toBe(false);
    expect((result as { error: string }).error).toEqual(expect.any(String));
  });

  it("allows any recipient in production, regardless of the allowlist (still fails here - no RESEND_API_KEY in the test env)", async () => {
    process.env.APP_ENV = "production";
    const result = await sendEmail({ to: "anyone@example.com", subject: "x", html: "<p>x</p>", logContext: {} });
    expect(result.sent).toBe(false);
  });
});
