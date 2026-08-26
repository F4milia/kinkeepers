import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";

// Integration test against the local Supabase stack, exercising the real
// audit_log table and record_audit_event() SQL function, not a mock - the
// thing worth verifying is that the RPC call actually reaches the
// service-role-only function and writes a real row.
const admin = createAdminClient();
let actorId: string;

beforeAll(async () => {
  // A unique email per run, not a fixed one - avoids colliding with a
  // leftover user from a prior run that didn't reach afterAll (e.g. an
  // interrupted local run; CI always starts from a fresh database).
  const { data, error } = await admin.auth.admin.createUser({
    email: `audit-writer-test-${crypto.randomUUID()}@example.com`,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("failed to create test user");
  actorId = data.user.id;
});

afterAll(async () => {
  if (actorId) await admin.auth.admin.deleteUser(actorId);
});

describe("recordAuditEvent", () => {
  // audit_log is genuinely append-only - this test suite cannot delete its
  // own rows between runs (not even via the admin client; see the
  // migration's revoke). Every subject_id below is unique per run so
  // `.single()` always resolves to exactly the row this run wrote,
  // regardless of how many prior local runs left rows behind.
  it("writes a row reachable only via the admin client", async () => {
    const subjectId = `s-test-${crypto.randomUUID()}`;
    await recordAuditEvent({
      actorId,
      action: "attendance_edit",
      subjectType: "session",
      subjectId,
      reason: "corrected a double-marked absence",
    });

    const { data, error } = await admin
      .from("audit_log")
      .select("actor_id, action, subject_type, subject_id, reason")
      .eq("subject_id", subjectId)
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({
      actor_id: actorId,
      action: "attendance_edit",
      subject_type: "session",
      subject_id: subjectId,
      reason: "corrected a double-marked absence",
    });
  });

  it("accepts optional metadata and omits reason when not given", async () => {
    const subjectId = `m-test-${crypto.randomUUID()}`;
    await recordAuditEvent({
      actorId,
      action: "cohort_assignment",
      subjectType: "member",
      subjectId,
      metadata: { cohortId: "c-test-1" },
    });

    const { data } = await admin
      .from("audit_log")
      .select("reason, metadata")
      .eq("subject_id", subjectId)
      .single();

    expect(data?.reason).toBeNull();
    expect(data?.metadata).toEqual({ cohortId: "c-test-1" });
  });

  it("throws rather than swallowing the error when the write fails", async () => {
    await expect(
      recordAuditEvent({
        actorId: "00000000-0000-0000-0000-000000000000", // no matching profiles row
        action: "role_change",
        subjectType: "profile",
        subjectId: "p-test-1",
      }),
    ).rejects.toThrow(/Failed to record audit event/);
  });
});
