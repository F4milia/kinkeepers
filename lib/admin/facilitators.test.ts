import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { ForbiddenError } from "@/lib/auth/roles";
import { clientForUser } from "@/test/helpers/local-auth";
import {
  listFacilitatorsWithCertifications,
  getFacilitatorDetail,
  addFacilitatorCertificationAction,
  type AddCertificationFormState,
} from "@/lib/admin/facilitators";

// Same reasoning as lib/admin/partner-organizations.test.ts: outside a
// real Next.js request, revalidatePath throws its own invariant before
// the action's real logic (the RPC call, the DB write) ever runs.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const admin = createAdminClient();
const IDLE_STATE: AddCertificationFormState = { status: "idle", fieldErrors: {} };
const RUN_ID = Date.now();

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

describe("admin facilitator certification tracking", () => {
  let adminUser: { id: string };
  let memberUser: { id: string };
  let facilitatorUser: { id: string };
  let facilitatorEmail: string;
  let program: { id: string };
  let secondProgram: { id: string };
  let cohortId: string;
  const certificationIds: string[] = [];

  beforeAll(async () => {
    const { data: adminData, error: adminError } = await admin.auth.admin.createUser({
      email: `facilitators-admin-${RUN_ID}@example.com`,
      email_confirm: true,
    });
    if (adminError || !adminData.user) throw adminError ?? new Error("createUser failed");
    adminUser = adminData.user;
    await admin.from("profiles").update({ role: "admin" }).eq("id", adminUser.id);

    const { data: memberData, error: memberError } = await admin.auth.admin.createUser({
      email: `facilitators-member-${RUN_ID}@example.com`,
      email_confirm: true,
    });
    if (memberError || !memberData.user) throw memberError ?? new Error("createUser failed");
    memberUser = memberData.user;

    const { data: facilitatorData, error: facilitatorError } = await admin.auth.admin.createUser({
      email: `facilitators-fac-${RUN_ID}@example.com`,
      email_confirm: true,
    });
    if (facilitatorError || !facilitatorData.user) throw facilitatorError ?? new Error("createUser failed");
    facilitatorUser = facilitatorData.user;
    facilitatorEmail = facilitatorData.user.email!;
    await admin.from("profiles").update({ role: "facilitator" }).eq("id", facilitatorUser.id);

    const { data: programData, error: programError } = await admin
      .from("programs")
      .insert({
        name: `pgTest Program ${RUN_ID}`,
        developer: "Test Developer",
        session_count: 6,
        session_duration_minutes: 90,
        delivery_formats: ["zoom"],
        languages: ["en"],
        facilitator_qualification: "Certified facilitator",
        license_status: "licensed",
      })
      .select("id")
      .single();
    if (programError || !programData) throw programError ?? new Error("program insert failed");
    program = programData;

    const { data: secondProgramData, error: secondProgramError } = await admin
      .from("programs")
      .insert({
        name: `pgTest Program (unassigned) ${RUN_ID}`,
        developer: "Test Developer",
        session_count: 8,
        session_duration_minutes: 60,
        delivery_formats: ["zoom"],
        languages: ["en"],
        facilitator_qualification: "Certified facilitator",
        license_status: "licensed",
      })
      .select("id")
      .single();
    if (secondProgramError || !secondProgramData) throw secondProgramError ?? new Error("program insert failed");
    secondProgram = secondProgramData;

    // A currently-valid certification, required before the cohort trigger
    // (enforce_cohort_program_and_facilitator) allows facilitator_id and
    // program_id to be set together on the same cohort below.
    const { data: certData, error: certError } = await admin
      .from("facilitator_certifications")
      .insert({
        facilitator_id: facilitatorUser.id,
        program_id: program.id,
        certified_on: daysFromNow(-365),
        expires_on: daysFromNow(365),
        certifying_body: "Test Certifying Body",
      })
      .select("id")
      .single();
    if (certError || !certData) throw certError ?? new Error("certification insert failed");
    certificationIds.push(certData.id);

    const { data: cohortData, error: cohortError } = await admin
      .from("cohorts")
      .insert({
        name: `pgTest Cohort ${RUN_ID}`,
        grouping_description: "Test grouping",
        capacity: 8,
        cadence: "weekly",
        meeting_day_of_week: 2,
        meeting_time: "18:30",
        time_zone: "America/New_York",
        program_id: program.id,
        facilitator_id: facilitatorUser.id,
        status: "active",
      })
      .select("id")
      .single();
    if (cohortError || !cohortData) throw cohortError ?? new Error("cohort insert failed");
    cohortId = cohortData.id;

    const { error: sessionsError } = await admin.from("sessions").insert([
      { cohort_id: cohortId, session_number: 1, scheduled_at: new Date(Date.now() + 3 * 86_400_000).toISOString() },
      { cohort_id: cohortId, session_number: 2, scheduled_at: new Date(Date.now() + 21 * 86_400_000).toISOString() },
    ]);
    if (sessionsError) throw sessionsError;
  });

  afterAll(async () => {
    await admin.from("sessions").delete().eq("cohort_id", cohortId);
    await admin.from("cohorts").delete().eq("id", cohortId);
    await admin.from("facilitator_certifications").delete().in("id", certificationIds);
    await admin.from("programs").delete().in("id", [program.id, secondProgram.id]);
    await admin.auth.admin.deleteUser(memberUser.id);
    await admin.auth.admin.deleteUser(facilitatorUser.id);
    // adminUser is NOT deleted - same reasoning as
    // partner-organizations.test.ts: this suite makes adminUser a real
    // audit_log actor, and audit_log.actor_id -> profiles(id) has no ON
    // DELETE behavior (RESTRICT), so that profile can never be
    // hard-deleted once it's acted as an actor.
  });

  it("rejects a non-admin caller before touching anything", async () => {
    const memberClient = await clientForUser(memberUser.id);
    await expect(listFacilitatorsWithCertifications(memberClient)).rejects.toThrow(ForbiddenError);
    await expect(getFacilitatorDetail(facilitatorUser.id, memberClient)).rejects.toThrow(ForbiddenError);
    await expect(
      addFacilitatorCertificationAction(
        facilitatorUser.id,
        IDLE_STATE,
        formData({
          programId: program.id,
          certifiedOn: daysFromNow(-1),
          expiresOn: daysFromNow(365),
          certifyingBody: "Nope",
        }),
        memberClient,
      ),
    ).rejects.toThrow(ForbiddenError);
  });

  it("lists a facilitator with active cohort count, sessions in the next 7 days, and certification status", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const facilitators = await listFacilitatorsWithCertifications(adminClient);
    const found = facilitators.find((f) => f.id === facilitatorUser.id);

    expect(found).toBeDefined();
    expect(found!.email).toBe(facilitatorEmail);
    expect(found!.activeCohortCount).toBe(1);
    // Only the session 3 days out falls in the next-7-days window; the
    // one 21 days out must not be counted.
    expect(found!.sessionsNext7Days).toBe(1);

    const cert = found!.certifications.find((c) => c.id === certificationIds[0]);
    expect(cert).toMatchObject({
      programId: program.id,
      programName: `pgTest Program ${RUN_ID}`,
      certifyingBody: "Test Certifying Body",
      isExpired: false,
      isExpiringSoon: false,
    });
  });

  it("flags a certification expiring within 60 days as isExpiringSoon and a lapsed one as isExpired", async () => {
    const { data: expiringSoon, error: expiringSoonError } = await admin
      .from("facilitator_certifications")
      .insert({
        facilitator_id: facilitatorUser.id,
        program_id: secondProgram.id,
        certified_on: daysFromNow(-300),
        expires_on: daysFromNow(30),
        certifying_body: "Test Certifying Body",
      })
      .select("id")
      .single();
    if (expiringSoonError || !expiringSoon) throw expiringSoonError ?? new Error("insert failed");
    certificationIds.push(expiringSoon.id);

    const { data: expired, error: expiredError } = await admin
      .from("facilitator_certifications")
      .insert({
        facilitator_id: facilitatorUser.id,
        program_id: secondProgram.id,
        certified_on: daysFromNow(-400),
        expires_on: daysFromNow(-1),
        certifying_body: "Test Certifying Body",
      })
      .select("id")
      .single();
    if (expiredError || !expired) throw expiredError ?? new Error("insert failed");
    certificationIds.push(expired.id);

    const adminClient = await clientForUser(adminUser.id);
    const facilitators = await listFacilitatorsWithCertifications(adminClient);
    const found = facilitators.find((f) => f.id === facilitatorUser.id)!;

    expect(found.certifications.find((c) => c.id === expiringSoon.id)).toMatchObject({
      isExpired: false,
      isExpiringSoon: true,
    });
    expect(found.certifications.find((c) => c.id === expired.id)).toMatchObject({
      isExpired: true,
      isExpiringSoon: false,
    });
  });

  it("getFacilitatorDetail returns allPrograms limited to licensed programs, and null for a nonexistent id", async () => {
    const adminClient = await clientForUser(adminUser.id);

    const detail = await getFacilitatorDetail(facilitatorUser.id, adminClient);
    expect(detail).not.toBeNull();
    expect(detail!.allPrograms.map((p) => p.id)).toEqual(expect.arrayContaining([program.id, secondProgram.id]));

    const missing = await getFacilitatorDetail("00000000-0000-0000-0000-000000000000", adminClient);
    expect(missing).toBeNull();
  });

  it("addFacilitatorCertificationAction rejects missing fields and an expiration on or before the certification date", async () => {
    const adminClient = await clientForUser(adminUser.id);

    const missingFields = await addFacilitatorCertificationAction(
      facilitatorUser.id,
      IDLE_STATE,
      formData({}),
      adminClient,
    );
    expect(missingFields.fieldErrors.programId).toBeTruthy();
    expect(missingFields.fieldErrors.certifiedOn).toBeTruthy();
    expect(missingFields.fieldErrors.expiresOn).toBeTruthy();
    expect(missingFields.fieldErrors.certifyingBody).toBeTruthy();

    const badRange = await addFacilitatorCertificationAction(
      facilitatorUser.id,
      IDLE_STATE,
      formData({
        programId: secondProgram.id,
        certifiedOn: daysFromNow(0),
        expiresOn: daysFromNow(-10),
        certifyingBody: "Test Certifying Body",
      }),
      adminClient,
    );
    expect(badRange.fieldErrors.expiresOn).toBeTruthy();
  });

  it("addFacilitatorCertificationAction inserts a certification and writes exactly one matching audit row", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const expiresOn = daysFromNow(200);

    const result = await addFacilitatorCertificationAction(
      facilitatorUser.id,
      IDLE_STATE,
      formData({
        programId: secondProgram.id,
        certifiedOn: daysFromNow(-10),
        expiresOn,
        certifyingBody: "Recorded Via Action",
      }),
      adminClient,
    );
    expect(result).toEqual({ status: "idle", fieldErrors: {} });

    const { data: created } = await admin
      .from("facilitator_certifications")
      .select("id")
      .eq("facilitator_id", facilitatorUser.id)
      .eq("program_id", secondProgram.id)
      .eq("certifying_body", "Recorded Via Action")
      .single();
    expect(created).toBeTruthy();
    certificationIds.push(created!.id);

    const { data: auditRows } = await admin
      .from("audit_log")
      .select("*")
      .eq("subject_id", created!.id)
      .eq("action", "facilitator_certified");
    expect(auditRows).toHaveLength(1);
    expect(auditRows![0].actor_id).toBe(adminUser.id);
    expect(auditRows![0].metadata).toMatchObject({
      facilitator_id: facilitatorUser.id,
      program_id: secondProgram.id,
      expires_on: expiresOn,
    });
  });
});
