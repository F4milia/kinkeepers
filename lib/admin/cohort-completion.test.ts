import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { ForbiddenError } from "@/lib/auth/roles";
import { clientForUser } from "@/test/helpers/local-auth";
import { markCohortCompletedAction } from "@/lib/admin/cohort-completion";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const admin = createAdminClient();

describe("markCohortCompletedAction", () => {
  let adminUser: { id: string };
  let memberUser: { id: string };
  let programId: string;
  const cohortIds: string[] = [];

  beforeAll(async () => {
    const { data: adminData, error: adminError } = await admin.auth.admin.createUser({
      email: `cohort-completion-admin-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (adminError || !adminData.user) throw adminError ?? new Error("createUser failed");
    adminUser = adminData.user;
    await admin.from("profiles").update({ role: "admin" }).eq("id", adminUser.id);

    const { data: memberData, error: memberError } = await admin.auth.admin.createUser({
      email: `cohort-completion-member-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (memberError || !memberData.user) throw memberError ?? new Error("createUser failed");
    memberUser = memberData.user;

    const { data: program, error: programError } = await admin
      .from("programs")
      .insert({
        name: "Cohort Completion Test Program",
        developer: "Test Developer",
        session_count: 3,
        session_duration_minutes: 90,
        delivery_formats: ["video"],
        languages: ["English"],
        facilitator_qualification: "Lay leader",
        license_status: "licensed",
      })
      .select("id")
      .single();
    if (programError || !program) throw programError ?? new Error("failed to create program");
    programId = program.id;
  });

  afterAll(async () => {
    await admin.from("cohorts").delete().in("id", cohortIds);
    await admin.from("programs").delete().in("id", [programId]);
    await admin.auth.admin.deleteUser(memberUser.id);
    await admin.auth.admin.deleteUser(adminUser.id);
  });

  async function insertCohort(status: "draft" | "active") {
    const { data, error } = await admin
      .from("cohorts")
      .insert({
        name: "Completion Test Cohort",
        grouping_description: "x",
        capacity: 8,
        cadence: "weekly",
        meeting_day_of_week: 2,
        meeting_time: "18:30",
        time_zone: "America/New_York",
        program_id: programId,
        status,
      })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("failed to create cohort");
    cohortIds.push(data.id);
    return data.id;
  }

  it("rejects a non-admin caller", async () => {
    const cohortId = await insertCohort("active");
    const memberClient = await clientForUser(memberUser.id);
    await expect(markCohortCompletedAction(cohortId, memberClient)).rejects.toThrow(ForbiddenError);
  });

  it("marks an active cohort completed", async () => {
    const cohortId = await insertCohort("active");
    const adminClient = await clientForUser(adminUser.id);

    const result = await markCohortCompletedAction(cohortId, adminClient);

    expect(result).toEqual({ success: true });
    const { data: cohort } = await admin.from("cohorts").select("status").eq("id", cohortId).single();
    expect(cohort?.status).toBe("completed");

    const { data: auditRows } = await admin
      .from("audit_log")
      .select("*")
      .eq("subject_id", cohortId)
      .eq("action", "cohort_completed");
    expect(auditRows).toHaveLength(1);
    expect(auditRows![0].actor_id).toBe(adminUser.id);
  });

  it("fails cleanly for a draft cohort rather than completing it", async () => {
    const cohortId = await insertCohort("draft");
    const adminClient = await clientForUser(adminUser.id);

    const result = await markCohortCompletedAction(cohortId, adminClient);

    expect(result.success).toBe(false);
    const { data: cohort } = await admin.from("cohorts").select("status").eq("id", cohortId).single();
    expect(cohort?.status).toBe("draft");
  });
});
