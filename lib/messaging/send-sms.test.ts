import { afterEach, describe, expect, it } from "vitest";
import { sendSms } from "@/lib/messaging/send-sms";

afterEach(() => {
  delete process.env.APP_ENV;
  delete process.env.STAGING_MESSAGE_ALLOWLIST;
});

describe("sendSms", () => {
  it("blocks a non-allowlisted recipient outside production - the staging guard runs first", async () => {
    await expect(sendSms({ to: "+15551234567", body: "x", logContext: {} })).rejects.toThrow(
      /Blocked outbound message/,
    );
  });

  it("named edge case: no Twilio credentials configured (true in every environment as of this writing - not even the account SID/token are set, and A2P 10DLC registration is a separate pending compliance step) logs and no-ops rather than throwing, returning false", async () => {
    process.env.STAGING_MESSAGE_ALLOWLIST = "+15551234567";
    await expect(
      sendSms({ to: "+15551234567", body: "x", logContext: { applicant_id: "abc" } }),
    ).resolves.toBe(false);
  });

  it("allows any recipient in production, regardless of the allowlist (still returns false - no Twilio credentials anywhere yet)", async () => {
    process.env.APP_ENV = "production";
    await expect(sendSms({ to: "+15559876543", body: "x", logContext: {} })).resolves.toBe(false);
  });
});
