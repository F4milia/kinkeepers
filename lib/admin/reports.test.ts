import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { ForbiddenError } from "@/lib/auth/roles";
import { clientForUser } from "@/test/helpers/local-auth";
import { getCohortDeliverySummary, getPartnerReferralSummary } from "@/lib/admin/reports";

const admin = createAdminClient();

describe("getCohortDeliverySummary", () => {
  let adminUser: { id: string };
  let partnerStaffUser: { id: string };
  let programId: string;
  let cohortId: string;

  beforeAll(async () => {
    const { data: adminData, error: adminError } = await admin.auth.admin.createUser({
      email: `reports-admin-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (adminError || !adminData.user) throw adminError ?? new Error("createUser failed");
    adminUser = adminData.user;
    await admin.from("profiles").update({ role: "admin" }).eq("id", adminUser.id);

    const { data: partnerData, error: partnerError } = await admin.auth.admin.createUser({
      email: `reports-partner-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (partnerError || !partnerData.user) throw partnerError ?? new Error("createUser failed");
    partnerStaffUser = partnerData.user;

    const { data: program, error: programError } = await admin
      .from("programs")
      .insert({
        name: "Reports Test Program",
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

    const { data: cohort, error: cohortError } = await admin
      .from("cohorts")
      .insert({
        name: "Reports Test Cohort",
        grouping_description: "x",
        capacity: 8,
        cadence: "weekly",
        meeting_day_of_week: 2,
        meeting_time: "18:30",
        time_zone: "America/New_York",
        program_id: programId,
        status: "active",
      })
      .select("id")
      .single();
    if (cohortError || !cohort) throw cohortError ?? new Error("failed to create cohort");
    cohortId = cohort.id;

    await admin.from("sessions").insert([
      { cohort_id: cohortId, session_number: 1, scheduled_at: new Date().toISOString(), status: "completed" },
      { cohort_id: cohortId, session_number: 2, scheduled_at: new Date().toISOString(), status: "scheduled" },
      { cohort_id: cohortId, session_number: 3, scheduled_at: new Date().toISOString(), status: "cancelled" },
    ]);
  });

  afterAll(async () => {
    await admin.from("sessions").delete().eq("cohort_id", cohortId);
    await admin.from("cohorts").delete().eq("id", cohortId);
    await admin.from("programs").delete().eq("id", programId);
    await admin.auth.admin.deleteUser(partnerStaffUser.id);
    await admin.auth.admin.deleteUser(adminUser.id);
  });

  it("rejects a non-admin caller", async () => {
    const partnerClient = await clientForUser(partnerStaffUser.id);
    await expect(getCohortDeliverySummary(partnerClient)).rejects.toThrow(ForbiddenError);
  });

  it("summarizes session counts by status for a cohort", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const summary = await getCohortDeliverySummary(adminClient);
    const found = summary.find((c) => c.id === cohortId);
    expect(found).toEqual({
      id: cohortId,
      name: "Reports Test Cohort",
      status: "active",
      sessionsScheduled: 1,
      sessionsCompleted: 1,
      sessionsCancelled: 1,
    });
  });
});

describe("getPartnerReferralSummary", () => {
  let adminUser: { id: string };
  let partnerStaffAUser: { id: string };
  let partnerStaffBUser: { id: string };
  let orgAId: string;
  let orgBId: string;
  const applicantIds: string[] = [];

  beforeAll(async () => {
    const { data: adminData, error: adminError } = await admin.auth.admin.createUser({
      email: `reports-referral-admin-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (adminError || !adminData.user) throw adminError ?? new Error("createUser failed");
    adminUser = adminData.user;
    await admin.from("profiles").update({ role: "admin" }).eq("id", adminUser.id);

    const { data: orgA, error: orgAError } = await admin
      .from("partner_organizations")
      .insert({ name: "Reports Org A", referral_link_slug: `reports-org-a-${Date.now()}` })
      .select("id")
      .single();
    if (orgAError || !orgA) throw orgAError ?? new Error("failed to create org");
    orgAId = orgA.id;

    const { data: orgB, error: orgBError } = await admin
      .from("partner_organizations")
      .insert({ name: "Reports Org B", referral_link_slug: `reports-org-b-${Date.now()}` })
      .select("id")
      .single();
    if (orgBError || !orgB) throw orgBError ?? new Error("failed to create org");
    orgBId = orgB.id;

    const { data: staffA, error: staffAError } = await admin.auth.admin.createUser({
      email: `reports-partner-a-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (staffAError || !staffA.user) throw staffAError ?? new Error("createUser failed");
    partnerStaffAUser = staffA.user;
    await admin
      .from("profiles")
      .update({ role: "partner_staff", partner_organization_id: orgAId })
      .eq("id", partnerStaffAUser.id);

    const { data: staffB, error: staffBError } = await admin.auth.admin.createUser({
      email: `reports-partner-b-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (staffBError || !staffB.user) throw staffBError ?? new Error("createUser failed");
    partnerStaffBUser = staffB.user;
    await admin
      .from("profiles")
      .update({ role: "partner_staff", partner_organization_id: orgBId })
      .eq("id", partnerStaffBUser.id);

    const { data: applicantA, error: applicantAError } = await admin
      .from("applicants")
      .insert({
        partner_organization_id: orgAId,
        referral_source: "partner_link",
        partner_reference_id: "org-a-ref-001",
        first_name: "Ana",
        last_name: "Reyes",
        status: "pending_review",
      })
      .select("id")
      .single();
    if (applicantAError || !applicantA) throw applicantAError ?? new Error("failed to create applicant");
    applicantIds.push(applicantA.id);

    const { data: applicantB, error: applicantBError } = await admin
      .from("applicants")
      .insert({
        partner_organization_id: orgBId,
        referral_source: "partner_link",
        partner_reference_id: "org-b-ref-001",
        first_name: "Ben",
        last_name: "Ortiz",
        status: "pending_review",
      })
      .select("id")
      .single();
    if (applicantBError || !applicantB) throw applicantBError ?? new Error("failed to create applicant");
    applicantIds.push(applicantB.id);
  });

  afterAll(async () => {
    await admin.from("applicants").delete().in("id", applicantIds);
    await admin.from("partner_organizations").delete().in("id", [orgAId, orgBId]);
    await admin.auth.admin.deleteUser(partnerStaffAUser.id);
    await admin.auth.admin.deleteUser(partnerStaffBUser.id);
    await admin.auth.admin.deleteUser(adminUser.id);
  });

  it("rejects a non-partner_staff caller", async () => {
    const adminClient = await clientForUser(adminUser.id);
    await expect(getPartnerReferralSummary(adminClient)).rejects.toThrow(ForbiddenError);
  });

  it("returns only Org A's own referral, with its own partner_reference_id echoed back", async () => {
    const orgAClient = await clientForUser(partnerStaffAUser.id);
    const summary = await getPartnerReferralSummary(orgAClient);
    const ids = summary.map((r) => r.id);
    expect(ids).toContain(applicantIds[0]);
    expect(ids).not.toContain(applicantIds[1]);
    const found = summary.find((r) => r.id === applicantIds[0]);
    expect(found?.partnerReferenceId).toBe("org-a-ref-001");
    expect(found?.status).toBe("pending_review");
  });
});
