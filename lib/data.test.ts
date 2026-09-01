import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientForUser } from "@/test/helpers/local-auth";
import {
  getViewer,
  getCohort,
  getCohortMembers,
  getSessions,
  getUpcomingSession,
  getSession,
  getPosts,
  getFacilitator,
  getApplicant,
  getMyCertifications,
} from "@/lib/data";

const admin = createAdminClient();

describe("lib/data.ts against real endpoints (L5)", () => {
  const partnerOrgId = "11111111-0000-0000-0000-0000000d0501";
  const programId = "77777777-0000-0000-0000-0000000d0501";
  const cohortId = "99999999-0000-0000-0000-0000000d0501";
  const pastSessionId = "55555555-0000-0000-0000-0000000d0501";
  const upcomingSessionId = "55555555-0000-0000-0000-0000000d0502";
  const applicantId = "88888888-0000-0000-0000-0000000d0501";
  let memberUserId: string;
  let unmatchedUserId: string;

  beforeAll(async () => {
    await admin.from("partner_organizations").insert({
      id: partnerOrgId,
      name: "L5 Data Test Org",
      referral_link_slug: "l5-data-test-org",
    });

    await admin.from("programs").insert({
      id: programId,
      name: "L5 Data Test Program",
      developer: "Test Developer",
      session_count: 2,
      session_duration_minutes: 90,
      delivery_formats: ["video"],
      languages: ["English"],
      facilitator_qualification: "Lay leader",
      license_status: "licensed",
    });

    await admin.from("cohorts").insert({
      id: cohortId,
      name: "L5 Data Test Cohort",
      grouping_description: "Test grouping",
      capacity: 8,
      cadence: "weekly",
      meeting_day_of_week: 2,
      meeting_time: "18:30",
      time_zone: "America/New_York",
      program_id: programId,
      delivery_format: "video",
      status: "active",
    });

    await admin.from("sessions").insert([
      {
        id: pastSessionId,
        cohort_id: cohortId,
        session_number: 1,
        scheduled_at: new Date(Date.now() - 7 * 86_400_000).toISOString(),
        status: "completed",
      },
      {
        id: upcomingSessionId,
        cohort_id: cohortId,
        session_number: 2,
        scheduled_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        status: "scheduled",
        video_join_url: "https://example.com/l5-data-test-join",
      },
    ]);

    const { data: memberUser, error: memberError } = await admin.auth.admin.createUser({
      email: `l5-data-test-member-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (memberError || !memberUser.user) throw memberError ?? new Error("createUser failed");
    memberUserId = memberUser.user.id;

    await admin.from("applicants").insert({
      id: applicantId,
      partner_organization_id: partnerOrgId,
      referral_source: "partner_link",
      first_name: "Devon",
      last_name: "Ashford",
      email: memberUser.user.email,
      status: "enrolled",
      cohort_id: cohortId,
    });

    const { data: unmatchedUser, error: unmatchedError } = await admin.auth.admin.createUser({
      email: `l5-data-test-unmatched-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (unmatchedError || !unmatchedUser.user) throw unmatchedError ?? new Error("createUser failed");
    unmatchedUserId = unmatchedUser.user.id;
  });

  afterAll(async () => {
    await admin.from("sessions").delete().in("id", [pastSessionId, upcomingSessionId]);
    await admin.from("applicants").delete().eq("id", applicantId);
    await admin.from("cohorts").delete().eq("id", cohortId);
    await admin.from("programs").delete().eq("id", programId);
    await admin.from("partner_organizations").delete().eq("id", partnerOrgId);
    await admin.auth.admin.deleteUser(memberUserId);
    await admin.auth.admin.deleteUser(unmatchedUserId);
  });

  it("getViewer claims and resolves the signed-in member's own enrollment", async () => {
    const client = await clientForUser(memberUserId);
    const viewer = await getViewer(client);
    expect(viewer.cohortId).toBe(cohortId);
    expect(viewer.firstName).toBe("Devon");
    expect(viewer.role).toBe("member");
  });

  it("getViewer throws (not-found) for a signed-in account with no matching enrollment", async () => {
    const client = await clientForUser(unmatchedUserId);
    await expect(getViewer(client)).rejects.toThrow();
  });

  it("getCohort returns real cohort fields, including the joined program name and computed session position", async () => {
    const client = await clientForUser(memberUserId);
    const cohort = await getCohort(cohortId, client);
    expect(cohort?.name).toBe("L5 Data Test Cohort");
    expect(cohort?.program).toBe("L5 Data Test Program");
    expect(cohort?.timeZoneLabel).toBe("Eastern");
    expect(cohort?.sessionTotal).toBe(2);
    // One session already in the past -> position 2 of 2.
    expect(cohort?.sessionNumber).toBe(2);
  });

  it("getCohortMembers includes the member's own real name via list_cohort_roster", async () => {
    const client = await clientForUser(memberUserId);
    await getViewer(client); // claims first, same as a real page render would
    const members = await getCohortMembers(cohortId, client);
    const self = members.find((m) => m.id === applicantId);
    expect(self?.firstName).toBe("Devon");
    expect(self?.role).toBe("member");
  });

  it("getSessions maps status to upcoming/past and getUpcomingSession picks the scheduled one", async () => {
    const client = await clientForUser(memberUserId);
    const sessions = await getSessions(cohortId, client);
    expect(sessions).toHaveLength(2);
    const past = sessions.find((s) => s.id === pastSessionId);
    const upcoming = sessions.find((s) => s.id === upcomingSessionId);
    expect(past?.status).toBe("past");
    expect(upcoming?.status).toBe("upcoming");
    expect(upcoming?.joinUrl).toBe("https://example.com/l5-data-test-join");
    // A completed session's join link is hidden - see toSession's own comment.
    expect(past?.joinUrl).toBeNull();

    const next = await getUpcomingSession(cohortId, client);
    expect(next?.id).toBe(upcomingSessionId);
  });

  it("getSession returns a single session by id, scoped by the same RLS as getSessions", async () => {
    const client = await clientForUser(memberUserId);
    const session = await getSession(upcomingSessionId, client);
    expect(session?.cohortId).toBe(cohortId);
  });

  it("getSession returns undefined for an id RLS hides from this caller", async () => {
    const client = await clientForUser(unmatchedUserId);
    const session = await getSession(upcomingSessionId, client);
    expect(session).toBeUndefined();
  });

  it("getPosts and getFacilitator are honest not-yet-available states, never fabricated data", async () => {
    await expect(getPosts(cohortId)).resolves.toEqual([]);
    await expect(getFacilitator(cohortId)).resolves.toBeUndefined();
  });
});

describe("getApplicant (L4, against the real seeded rows in supabase/seed.sql)", () => {
  // Regression coverage for a real shipped bug (caught by Stream B while
  // rebasing against this PR): app/(applicant)/status/[applicantId]/
  // page.tsx's ternary is `hasMatchingCohort ? WaitingForReview :
  // Waitlisted` - Waitlisted additionally needs waitlistGroupingLabel/
  // meetingTimeLabel (never set here) to render sensibly, so it's the
  // MORE specific state, not the generic one. This shipped as `false`
  // originally, silently routing every real pending_review applicant to
  // Waitlisted with both interpolations blank ("We're looking for ,
  // meeting ."). No test caught it because the only prior coverage was
  // an e2e smoke test asserting "no client-side error," which is true
  // for both branches - this test asserts the actual value instead.
  it("returns hasMatchingCohort: true for a pending_review applicant - the generic 'still finding' state, not the specific waitlist one", async () => {
    const applicant = await getApplicant("88888888-0000-0000-0000-000000000001", admin);
    expect(applicant?.status).toBe("pending_review");
    expect(applicant?.hasMatchingCohort).toBe(true);
  });

  it("returns a real assigned session for an enrolled applicant", async () => {
    const applicant = await getApplicant("88888888-0000-0000-0000-000000000502", admin);
    expect(applicant?.status).toBe("enrolled");
    expect(applicant?.assignedSession?.joinUrl).toBe("https://example.com/l5-demo-join");
  });

  it("returns completed status for a completed applicant", async () => {
    const applicant = await getApplicant("88888888-0000-0000-0000-000000000503", admin);
    expect(applicant?.status).toBe("completed");
  });
});

describe("getMyCertifications (F2) - a facilitator's own self-view, scoped by facilitator_certifications_select_own", () => {
  const programId = "77777777-0000-0000-0000-0000000f0201";
  const currentCertId = "33333333-0000-0000-0000-0000000f0201";
  const expiringSoonCertId = "33333333-0000-0000-0000-0000000f0202";
  const expiredCertId = "33333333-0000-0000-0000-0000000f0203";
  let facilitatorAId: string;
  let facilitatorBId: string;

  function daysFromNow(days: number): string {
    return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  }

  beforeAll(async () => {
    await admin.from("programs").insert({
      id: programId,
      name: "F2 Test Program",
      developer: "Test Developer",
      session_count: 6,
      session_duration_minutes: 90,
      delivery_formats: ["video"],
      languages: ["English"],
      facilitator_qualification: "Lay leader",
      license_status: "licensed",
    });

    const { data: facA, error: facAError } = await admin.auth.admin.createUser({
      email: `f2-facilitator-a-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (facAError || !facA.user) throw facAError ?? new Error("createUser failed");
    facilitatorAId = facA.user.id;
    await admin.from("profiles").update({ role: "facilitator" }).eq("id", facilitatorAId);

    const { data: facB, error: facBError } = await admin.auth.admin.createUser({
      email: `f2-facilitator-b-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (facBError || !facB.user) throw facBError ?? new Error("createUser failed");
    facilitatorBId = facB.user.id;
    await admin.from("profiles").update({ role: "facilitator" }).eq("id", facilitatorBId);

    await admin.from("facilitator_certifications").insert([
      {
        id: currentCertId,
        facilitator_id: facilitatorAId,
        program_id: programId,
        certified_on: daysFromNow(-300),
        expires_on: daysFromNow(200),
        certifying_body: "F2 Test Certifying Body",
      },
      {
        id: expiringSoonCertId,
        facilitator_id: facilitatorAId,
        program_id: programId,
        certified_on: daysFromNow(-300),
        expires_on: daysFromNow(30),
        certifying_body: "F2 Test Certifying Body",
      },
      {
        id: expiredCertId,
        facilitator_id: facilitatorAId,
        program_id: programId,
        certified_on: daysFromNow(-400),
        expires_on: daysFromNow(-1),
        certifying_body: "F2 Test Certifying Body",
      },
    ]);
  });

  afterAll(async () => {
    await admin
      .from("facilitator_certifications")
      .delete()
      .in("id", [currentCertId, expiringSoonCertId, expiredCertId]);
    await admin.from("programs").delete().eq("id", programId);
    await admin.auth.admin.deleteUser(facilitatorAId);
    await admin.auth.admin.deleteUser(facilitatorBId);
  });

  it("returns only the signed-in facilitator's own certifications, ordered by soonest-expiring first, with correct expiry flags", async () => {
    const client = await clientForUser(facilitatorAId);
    const certifications = await getMyCertifications(client);

    expect(certifications.map((c) => c.id)).toEqual([expiredCertId, expiringSoonCertId, currentCertId]);
    expect(certifications.find((c) => c.id === currentCertId)).toMatchObject({
      programName: "F2 Test Program",
      isExpired: false,
      isExpiringSoon: false,
    });
    expect(certifications.find((c) => c.id === expiringSoonCertId)).toMatchObject({
      isExpired: false,
      isExpiringSoon: true,
    });
    expect(certifications.find((c) => c.id === expiredCertId)).toMatchObject({
      isExpired: true,
      isExpiringSoon: false,
    });
  });

  it("returns none of facilitator A's certifications for facilitator B - RLS isolation, not an admin-only check", async () => {
    const client = await clientForUser(facilitatorBId);
    const certifications = await getMyCertifications(client);
    expect(certifications).toEqual([]);
  });
});
