import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientForUser } from "@/test/helpers/local-auth";
import { listCohorts, getCohortDetail, listLicensedPrograms, listFacilitators } from "@/lib/admin/cohorts";

const admin = createAdminClient();

describe("cohorts admin data layer", () => {
  let adminUser: { id: string; email?: string };
  let facilitatorAUser: { id: string; email?: string };
  let facilitatorBUser: { id: string; email?: string };
  let licensedProgramId: string;
  let notLicensedProgramId: string;
  let ownCohortId: string;
  let otherCohortId: string;

  beforeAll(async () => {
    const { data: adminData, error: adminError } = await admin.auth.admin.createUser({
      email: `cohorts-list-admin-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (adminError || !adminData.user) throw adminError ?? new Error("createUser failed");
    adminUser = adminData.user;
    await admin.from("profiles").update({ role: "admin" }).eq("id", adminUser.id);

    const { data: facA, error: facAError } = await admin.auth.admin.createUser({
      email: `cohorts-list-facilitator-a-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (facAError || !facA.user) throw facAError ?? new Error("createUser failed");
    facilitatorAUser = facA.user;
    await admin.from("profiles").update({ role: "facilitator" }).eq("id", facilitatorAUser.id);

    const { data: facB, error: facBError } = await admin.auth.admin.createUser({
      email: `cohorts-list-facilitator-b-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (facBError || !facB.user) throw facBError ?? new Error("createUser failed");
    facilitatorBUser = facB.user;
    await admin.from("profiles").update({ role: "facilitator" }).eq("id", facilitatorBUser.id);

    const { data: licensedProgram, error: licensedError } = await admin
      .from("programs")
      .insert({
        name: "Cohorts List Test Program",
        developer: "Test Developer",
        session_count: 6,
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
        name: "Cohorts List Test Program (Not Licensed)",
        developer: "Test Developer",
        session_count: 6,
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

    const cohortFields = {
      grouping_description: "Test group",
      capacity: 8,
      cadence: "weekly",
      meeting_day_of_week: 2,
      meeting_time: "18:30",
      time_zone: "America/New_York",
      program_id: licensedProgramId,
    };
    const { data: ownCohort, error: ownError } = await admin
      .from("cohorts")
      .insert({ name: "Facilitator A's Cohort", facilitator_id: facilitatorAUser.id, ...cohortFields })
      .select("id")
      .single();
    if (ownError || !ownCohort) throw ownError ?? new Error("failed to create cohort");
    ownCohortId = ownCohort.id;

    const { data: otherCohort, error: otherError } = await admin
      .from("cohorts")
      .insert({ name: "Facilitator B's Cohort", facilitator_id: facilitatorBUser.id, ...cohortFields })
      .select("id")
      .single();
    if (otherError || !otherCohort) throw otherError ?? new Error("failed to create cohort");
    otherCohortId = otherCohort.id;

    const { error: sessionError } = await admin.from("sessions").insert({
      cohort_id: ownCohortId,
      session_number: 1,
      scheduled_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      substitute_facilitator_id: facilitatorBUser.id,
    });
    if (sessionError) throw sessionError;
  });

  afterAll(async () => {
    await admin.from("sessions").delete().in("cohort_id", [ownCohortId, otherCohortId]);
    await admin.from("cohorts").delete().in("id", [ownCohortId, otherCohortId]);
    await admin.from("programs").delete().in("id", [licensedProgramId, notLicensedProgramId]);
    await admin.auth.admin.deleteUser(facilitatorAUser.id);
    await admin.auth.admin.deleteUser(facilitatorBUser.id);
    await admin.auth.admin.deleteUser(adminUser.id);
  });

  it("listCohorts: admin sees every cohort, with the program name resolved", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const cohorts = await listCohorts(adminClient);
    const ids = cohorts.map((c) => c.id);
    expect(ids).toContain(ownCohortId);
    expect(ids).toContain(otherCohortId);

    const own = cohorts.find((c) => c.id === ownCohortId)!;
    expect(own.programName).toBe("Cohorts List Test Program");
    expect(own.facilitatorEmail).toBe(facilitatorAUser.email);
  });

  it("listCohorts: a facilitator sees only their own cohort, via RLS", async () => {
    const facilitatorClient = await clientForUser(facilitatorAUser.id);
    const cohorts = await listCohorts(facilitatorClient);
    const ids = cohorts.map((c) => c.id);
    expect(ids).toContain(ownCohortId);
    expect(ids).not.toContain(otherCohortId);
  });

  it("getCohortDetail: returns the cohort's sessions with the substitute facilitator's email resolved", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const detail = await getCohortDetail(ownCohortId, adminClient);
    expect(detail?.sessions).toHaveLength(1);
    expect(detail?.sessions[0].substituteFacilitatorEmail).toBe(facilitatorBUser.email);
  });

  it("getCohortDetail: a facilitator cannot read a cohort that isn't theirs (RLS returns null, not an error)", async () => {
    const facilitatorClient = await clientForUser(facilitatorAUser.id);
    const detail = await getCohortDetail(otherCohortId, facilitatorClient);
    expect(detail).toBeNull();
  });

  it("listLicensedPrograms: only returns licensed programs", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const programs = await listLicensedPrograms(adminClient);
    const ids = programs.map((p) => p.id);
    expect(ids).toContain(licensedProgramId);
    expect(ids).not.toContain(notLicensedProgramId);
  });

  it("listFacilitators: returns every facilitator-role profile with a resolved email", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const facilitators = await listFacilitators(adminClient);
    const emails = facilitators.map((f) => f.email);
    expect(emails).toContain(facilitatorAUser.email);
    expect(emails).toContain(facilitatorBUser.email);
  });
});
