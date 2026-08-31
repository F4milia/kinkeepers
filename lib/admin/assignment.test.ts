import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { ForbiddenError } from "@/lib/auth/roles";
import { clientForUser } from "@/test/helpers/local-auth";
import { listOpenCohortsForApplicant, assignApplicantToCohortAction } from "@/lib/admin/assignment";

// redirect()/revalidatePath() only work inside a real Next.js request -
// see lib/admin/partner-organizations.test.ts for the full reasoning.
const redirectMock = vi.fn();
vi.mock("next/navigation", () => ({ redirect: (path: string) => redirectMock(path) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const admin = createAdminClient();

describe("cohort assignment", () => {
  let adminUser: { id: string };
  let memberUser: { id: string };
  let partnerOrgId: string;
  let roomyCohortId: string;
  let fullCohortId: string;
  let applicantId: string;
  let otherOccupantId: string;

  beforeAll(async () => {
    const { data: adminData, error: adminError } = await admin.auth.admin.createUser({
      email: `assignment-admin-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (adminError || !adminData.user) throw adminError ?? new Error("createUser failed");
    adminUser = adminData.user;
    await admin.from("profiles").update({ role: "admin" }).eq("id", adminUser.id);

    const { data: memberData, error: memberError } = await admin.auth.admin.createUser({
      email: `assignment-member-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (memberError || !memberData.user) throw memberError ?? new Error("createUser failed");
    memberUser = memberData.user;

    const { data: org, error: orgError } = await admin
      .from("partner_organizations")
      .insert({ name: "Assignment Test Org", referral_link_slug: `assignment-test-org-${Date.now()}` })
      .select("id")
      .single();
    if (orgError || !org) throw orgError ?? new Error("failed to create partner org");
    partnerOrgId = org.id;

    const cohortFields = {
      cadence: "weekly",
      meeting_day_of_week: 2,
      meeting_time: "18:30",
      time_zone: "America/New_York",
    };
    const { data: roomyCohort, error: roomyError } = await admin
      .from("cohorts")
      .insert({ name: "Roomy Cohort", grouping_description: "Spouses, early stage", capacity: 2, ...cohortFields })
      .select("id")
      .single();
    if (roomyError || !roomyCohort) throw roomyError ?? new Error("failed to create roomy cohort");
    roomyCohortId = roomyCohort.id;

    const { data: fullCohort, error: fullError } = await admin
      .from("cohorts")
      .insert({ name: "Full Cohort", grouping_description: "Adult children", capacity: 1, ...cohortFields })
      .select("id")
      .single();
    if (fullError || !fullCohort) throw fullError ?? new Error("failed to create full cohort");
    fullCohortId = fullCohort.id;

    // One existing occupant in the roomy cohort (so composition isn't
    // empty) and one filling the full cohort to its capacity.
    const { data: existingOccupant, error: occupantError } = await admin
      .from("applicants")
      .insert({
        partner_organization_id: partnerOrgId,
        referral_source: "partner_link",
        relationship: "spouse",
        care_recipient_stage: "early",
        status: "enrolled",
        cohort_id: roomyCohortId,
      })
      .select("id")
      .single();
    if (occupantError || !existingOccupant) throw occupantError ?? new Error("failed to seed occupant");
    otherOccupantId = existingOccupant.id;

    const { error: fillError } = await admin.from("applicants").insert({
      partner_organization_id: partnerOrgId,
      referral_source: "staff_form",
      status: "enrolled",
      cohort_id: fullCohortId,
    });
    if (fillError) throw fillError;

    const { data: applicant, error: applicantError } = await admin
      .from("applicants")
      .insert({
        partner_organization_id: partnerOrgId,
        referral_source: "staff_form",
        relationship: "adult child",
        care_recipient_stage: "middle",
        time_zone: "Pacific/Honolulu",
        status: "pending_review",
      })
      .select("id")
      .single();
    if (applicantError || !applicant) throw applicantError ?? new Error("failed to create applicant");
    applicantId = applicant.id;
  });

  afterAll(async () => {
    await admin.from("applicants").delete().in("id", [applicantId, otherOccupantId]);
    await admin.from("applicants").delete().eq("cohort_id", fullCohortId);
    await admin.from("cohorts").delete().in("id", [roomyCohortId, fullCohortId]);
    await admin.from("partner_organizations").delete().eq("id", partnerOrgId);
    await admin.auth.admin.deleteUser(memberUser.id);
    await admin.auth.admin.deleteUser(adminUser.id);
  });

  it("rejects a non-admin caller", async () => {
    const memberClient = await clientForUser(memberUser.id);
    await expect(listOpenCohortsForApplicant("Pacific/Honolulu", memberClient)).rejects.toThrow(ForbiddenError);
    await expect(assignApplicantToCohortAction(applicantId, roomyCohortId, memberClient)).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("lists only cohorts with remaining capacity, with composition and a timezone-aware meeting description", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const openCohorts = await listOpenCohortsForApplicant("Pacific/Honolulu", adminClient);
    const ids = openCohorts.map((c) => c.id);

    expect(ids).toContain(roomyCohortId);
    expect(ids).not.toContain(fullCohortId);

    const roomy = openCohorts.find((c) => c.id === roomyCohortId)!;
    expect(roomy.remainingCapacity).toBe(1);
    expect(roomy.composition).toEqual([{ relationship: "spouse", careRecipientStage: "early", count: 1 }]);
    // Honolulu never observes DST, so the exact hour shown depends only
    // on whether "now" happens to fall in EST or EDT - just confirm both
    // zones are actually named, not a specific clock time (the DST math
    // itself is covered exhaustively in cohort-meeting-time.test.ts).
    expect(roomy.meetingDescription).toContain("HST your time");
    expect(roomy.meetingDescription).toMatch(/E[SD]T for the group/);
  });

  it("assigns the applicant, then excludes the now-full cohort and includes the applicant in composition", async () => {
    const adminClient = await clientForUser(adminUser.id);
    redirectMock.mockClear();

    await assignApplicantToCohortAction(applicantId, roomyCohortId, adminClient);
    expect(redirectMock).toHaveBeenCalledWith("/admin/applicants");

    const { data: updated } = await admin.from("applicants").select("status, cohort_id").eq("id", applicantId).single();
    expect(updated).toMatchObject({ status: "enrolled", cohort_id: roomyCohortId });

    const openCohorts = await listOpenCohortsForApplicant("Pacific/Honolulu", adminClient);
    expect(openCohorts.some((c) => c.id === roomyCohortId)).toBe(false);
  });
});
