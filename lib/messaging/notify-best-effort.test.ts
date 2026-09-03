import { describe, expect, it, vi } from "vitest";
import { logError } from "@/lib/log";
import { notifyBestEffort } from "@/lib/messaging/notify-best-effort";

vi.mock("@/lib/log", () => ({ logError: vi.fn() }));

describe("notifyBestEffort", () => {
  it("calls the send function and resolves normally on success, without logging anything", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    await notifyBestEffort(send, "applicant_notification_failed", { applicant_id: "app-1" });

    expect(send).toHaveBeenCalledOnce();
    expect(logError).not.toHaveBeenCalled();
  });

  it("swallows a send failure - it must never fail the mutation it's attached to - and logs the given event with the given context", async () => {
    const send = vi.fn().mockRejectedValue(new Error("Resend is down"));

    await expect(
      notifyBestEffort(send, "session_notification_failed", { session_id: "sess-1", cohort_id: "cohort-1" }),
    ).resolves.toBeUndefined();

    expect(logError).toHaveBeenCalledWith("session_notification_failed", { session_id: "sess-1", cohort_id: "cohort-1" });
  });

  it("logs under the caller's own event name - the two real call sites use genuinely different, established names", async () => {
    const send = vi.fn().mockRejectedValue(new Error("boom"));
    await notifyBestEffort(send, "applicant_notification_failed", { applicant_id: "app-2" });
    expect(logError).toHaveBeenCalledWith("applicant_notification_failed", { applicant_id: "app-2" });
  });
});
