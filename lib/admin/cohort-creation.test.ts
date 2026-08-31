import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { ForbiddenError } from "@/lib/auth/roles";
import { clientForUser } from "@/test/helpers/local-auth";
import { createCohortAction, type CreateCohortInput } from "@/lib/admin/cohort-creation";

// revalidatePath only works inside a real Next.js request - see
// lib/admin/partner-organizations.test.ts for the full reasoning.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// No real Zoom credentials exist anywhere in this project (see
// lib/zoom/client.test.ts's own header) - fetch is injected, matching
// that same established pattern, never a real network call.
let credentialCounter = 0;
function freshZoomCredentials() {
  credentialCounter += 1;
  return { accountId: `acct-${credentialCounter}`, clientId: `client-${credentialCounter}`, clientSecret: `secret-${credentialCounter}` };
}

function mockSuccessfulZoomFetch() {
  return vi
    .fn()
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "tok", expires_in: 3600 }) })
    .mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        id: 123456789,
        join_url: "https://zoom.us/j/123456789",
        password: "aB3xY9",
        settings: { global_dial_in_numbers: [{ number: "+1 555 000 1111", type: "toll", country: "US" }] },
      }),
    });
}

function mockFailingZoomFetch() {
  return vi
    .fn()
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "tok", expires_in: 3600 }) })
    .mockResolvedValueOnce({ ok: false, status: 503, text: async () => "Zoom is down" });
}

const admin = createAdminClient();

describe("createCohortAction", () => {
  let adminUser: { id: string };
  let memberUser: { id: string };
  let facilitatorUser: { id: string };
  let licensedProgramId: string;
  let notLicensedProgramId: string;
  const createdCohortIds: string[] = [];

  const baseInput: Omit<CreateCohortInput, "programId" | "facilitatorId"> = {
    name: "Test Cohort",
    groupingDescription: "Spouses, early stage",
    cadence: "weekly",
    meetingDayOfWeek: 2,
    meetingTime: "18:30",
    timeZone: "America/New_York",
    firstSessionDate: "2027-03-09",
    capacity: 8,
    deliveryFormat: "video",
  };

  beforeAll(async () => {
    const { data: adminData, error: adminError } = await admin.auth.admin.createUser({
      email: `cohort-creation-admin-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (adminError || !adminData.user) throw adminError ?? new Error("createUser failed");
    adminUser = adminData.user;
    await admin.from("profiles").update({ role: "admin" }).eq("id", adminUser.id);

    const { data: memberData, error: memberError } = await admin.auth.admin.createUser({
      email: `cohort-creation-member-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (memberError || !memberData.user) throw memberError ?? new Error("createUser failed");
    memberUser = memberData.user;

    const { data: facilitatorData, error: facilitatorError } = await admin.auth.admin.createUser({
      email: `cohort-creation-facilitator-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (facilitatorError || !facilitatorData.user) throw facilitatorError ?? new Error("createUser failed");
    facilitatorUser = facilitatorData.user;
    await admin.from("profiles").update({ role: "facilitator" }).eq("id", facilitatorUser.id);

    const { data: licensedProgram, error: licensedError } = await admin
      .from("programs")
      .insert({
        name: "Cohort Creation Test Program",
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
    if (licensedError || !licensedProgram) throw licensedError ?? new Error("failed to create program");
    licensedProgramId = licensedProgram.id;

    const { data: notLicensedProgram, error: notLicensedError } = await admin
      .from("programs")
      .insert({
        name: "Cohort Creation Test Program (Not Licensed)",
        developer: "Test Developer",
        session_count: 3,
        session_duration_minutes: 90,
        delivery_formats: ["video"],
        languages: ["English"],
        facilitator_qualification: "Lay leader",
        license_status: "not_licensed",
      })
      .select("id")
      .single();
    if (notLicensedError || !notLicensedProgram) throw notLicensedError ?? new Error("failed to create program");
    notLicensedProgramId = notLicensedProgram.id;
  });

  afterAll(async () => {
    await admin.from("sessions").delete().in("cohort_id", createdCohortIds);
    await admin.from("cohorts").delete().in("id", createdCohortIds);
    await admin.from("programs").delete().in("id", [licensedProgramId, notLicensedProgramId]);
    await admin.auth.admin.deleteUser(memberUser.id);
    await admin.auth.admin.deleteUser(facilitatorUser.id);
    await admin.auth.admin.deleteUser(adminUser.id);
  });

  it("rejects a non-admin caller", async () => {
    const memberClient = await clientForUser(memberUser.id);
    await expect(
      createCohortAction(
        { ...baseInput, programId: licensedProgramId, facilitatorId: facilitatorUser.id },
        memberClient,
      ),
    ).rejects.toThrow(ForbiddenError);
  });

  it("fails cleanly when the program doesn't exist", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const result = await createCohortAction(
      { ...baseInput, programId: "00000000-0000-0000-0000-000000000000", facilitatorId: facilitatorUser.id },
      adminClient,
    );
    expect(result).toEqual({ success: false, error: "Program not found." });
  });

  it("fails with the trigger's own message when the program isn't licensed", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const result = await createCohortAction(
      { ...baseInput, programId: notLicensedProgramId, facilitatorId: facilitatorUser.id },
      adminClient,
    );
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error).toContain("is not licensed");
  });

  it("fails with the trigger's own message when the facilitator isn't actually a facilitator", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const result = await createCohortAction(
      { ...baseInput, programId: licensedProgramId, facilitatorId: memberUser.id },
      adminClient,
    );
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error).toContain("is not a facilitator");
  });

  it("creates an active cohort with the program's own session count when Zoom succeeds", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const zoomCredentials = freshZoomCredentials();
    const zoomFetch = mockSuccessfulZoomFetch();

    const result = await createCohortAction(
      { ...baseInput, programId: licensedProgramId, facilitatorId: facilitatorUser.id },
      adminClient,
      zoomCredentials,
      zoomFetch as unknown as typeof fetch,
    );

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.status).toBe("active");
    createdCohortIds.push(result.cohortId);

    const { data: cohort } = await admin.from("cohorts").select("status").eq("id", result.cohortId).single();
    expect(cohort?.status).toBe("active");

    const { data: sessions } = await admin
      .from("sessions")
      .select("session_number, video_join_url")
      .eq("cohort_id", result.cohortId)
      .order("session_number");
    // The program has session_count = 3, never hardcoded.
    expect(sessions).toHaveLength(3);
    expect(sessions?.every((s) => s.video_join_url === "https://zoom.us/j/123456789")).toBe(true);

    const { data: auditRows } = await admin
      .from("audit_log")
      .select("*")
      .eq("subject_id", result.cohortId)
      .eq("action", "cohort_created");
    expect(auditRows).toHaveLength(1);
    expect(auditRows![0].actor_id).toBe(adminUser.id);
  });

  it("named edge case: Zoom failing mid-creation leaves the cohort in draft, names the error, and creates zero sessions", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const zoomCredentials = freshZoomCredentials();
    const zoomFetch = mockFailingZoomFetch();

    const result = await createCohortAction(
      { ...baseInput, programId: licensedProgramId, facilitatorId: facilitatorUser.id },
      adminClient,
      zoomCredentials,
      zoomFetch as unknown as typeof fetch,
    );

    if (!result.success || result.status !== "draft") throw new Error("expected a draft result");
    expect(result.zoomError).toBeTruthy();
    createdCohortIds.push(result.cohortId);

    const { data: cohort } = await admin
      .from("cohorts")
      .select("status, zoom_setup_error")
      .eq("id", result.cohortId)
      .single();
    expect(cohort?.status).toBe("draft");
    expect(cohort?.zoom_setup_error).toBeTruthy();

    const { data: sessions } = await admin.from("sessions").select("id").eq("cohort_id", result.cohortId);
    expect(sessions).toEqual([]);

    const { data: auditRows } = await admin
      .from("audit_log")
      .select("*")
      .eq("subject_id", result.cohortId)
      .eq("action", "cohort_creation_failed");
    expect(auditRows).toHaveLength(1);
  });
});
