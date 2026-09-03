import { describe, expect, it, vi } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";

vi.mock("@/lib/auth/ip-hash", () => ({
  hashRequestIp: vi.fn().mockResolvedValue("fake-ip-hash-for-testing"),
}));

const { logSignInEvent } = await import("@/lib/auth/log-sign-in-event");

describe("logSignInEvent", () => {
  it("writes a real row with the given identifier, method, outcome, and the hashed IP", async () => {
    const admin = createAdminClient();
    const identifier = `log-sign-in-test-${Date.now()}@example.com`;

    await logSignInEvent(identifier, "email_link", "sent");

    const { data, error } = await admin
      .from("sign_in_events")
      .select("identifier, method, outcome, ip_hash")
      .eq("identifier", identifier)
      .single();
    if (error) throw error;

    expect(data).toEqual({
      identifier,
      method: "email_link",
      outcome: "sent",
      ip_hash: "fake-ip-hash-for-testing",
    });
  });

  it("writes one row per call, even for the same identifier with different outcomes - a full audit trail, not an upsert", async () => {
    const admin = createAdminClient();
    const identifier = `log-sign-in-test-${Date.now()}@example.com`;

    await logSignInEvent(identifier, "sms_code", "sent");
    await logSignInEvent(identifier, "sms_code", "verified");

    const { data, error } = await admin.from("sign_in_events").select("outcome").eq("identifier", identifier);
    if (error) throw error;

    expect(data).toHaveLength(2);
    expect(data.map((row) => row.outcome).sort()).toEqual(["sent", "verified"]);
  });

  it("does not throw when the write fails - a logging gap must never break the sign-in flow itself", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      // An outcome value the DB enum doesn't accept - forces the real
      // insert inside logSignInEvent to fail, without breaking the
      // client/connection itself.
      await expect(logSignInEvent("irrelevant", "email_link", "not_a_real_outcome" as never)).resolves.toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to write sign_in_events row", expect.anything());
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
