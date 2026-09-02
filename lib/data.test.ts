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
  getSessionPrepRoster,
  getSessionPrepMaterials,
  getFacilitatorSessionsNeedingLog,
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

describe("getSessionPrepRoster / getSessionPrepMaterials (F3)", () => {
  const partnerOrgId = "11111111-0000-0000-0000-0000000f3101";
  const programId = "77777777-0000-0000-0000-0000000f3101";
  const cohortId = "99999999-0000-0000-0000-0000000f3101";
  const pastSessionId = "55555555-0000-0000-0000-0000000f3101";
  const prepSessionId = "55555555-0000-0000-0000-0000000f3102";
  const attendedApplicantId = "88888888-0000-0000-0000-0000000f3101";
  const absentApplicantId = "88888888-0000-0000-0000-0000000f3102";
  const materialId = "22222222-0000-0000-0000-0000000f3101";
  let facilitatorUserId: string;
  let unrelatedFacilitatorUserId: string;

  beforeAll(async () => {
    await admin.from("partner_organizations").insert({
      id: partnerOrgId,
      name: "F3 Data Test Org",
      referral_link_slug: "f3-data-test-org",
    });

    await admin.from("programs").insert({
      id: programId,
      name: "F3 Data Test Program",
      developer: "Test Developer",
      session_count: 2,
      session_duration_minutes: 90,
      delivery_formats: ["video"],
      languages: ["English"],
      facilitator_qualification: "Lay leader",
      license_status: "licensed",
    });
    await admin.from("program_sessions").insert([
      { program_id: programId, session_number: 1 },
      { program_id: programId, session_number: 2 },
    ]);

    const { data: facilitatorUser, error: facilitatorError } = await admin.auth.admin.createUser({
      email: `f3-data-test-facilitator-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (facilitatorError || !facilitatorUser.user) throw facilitatorError ?? new Error("createUser failed");
    facilitatorUserId = facilitatorUser.user.id;
    await admin.from("profiles").update({ role: "facilitator" }).eq("id", facilitatorUserId);

    const { data: unrelatedUser, error: unrelatedError } = await admin.auth.admin.createUser({
      email: `f3-data-test-unrelated-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (unrelatedError || !unrelatedUser.user) throw unrelatedError ?? new Error("createUser failed");
    unrelatedFacilitatorUserId = unrelatedUser.user.id;
    await admin.from("profiles").update({ role: "facilitator" }).eq("id", unrelatedFacilitatorUserId);

    // Certified at insert time so A4-cert's cohort-assignment trigger
    // allows the cohort insert below, exactly like the pgTAP fixture.
    await admin.from("facilitator_certifications").insert({
      facilitator_id: facilitatorUserId,
      program_id: programId,
      certified_on: new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10),
      expires_on: new Date(Date.now() + 300 * 86_400_000).toISOString().slice(0, 10),
      certifying_body: "F3 Data Test Certifying Body",
    });

    await admin.from("cohorts").insert({
      id: cohortId,
      name: "F3 Data Test Cohort",
      grouping_description: "Test grouping",
      capacity: 8,
      cadence: "weekly",
      meeting_day_of_week: 2,
      meeting_time: "18:30",
      time_zone: "America/New_York",
      program_id: programId,
      facilitator_id: facilitatorUserId,
      status: "active",
    });

    await admin.from("applicants").insert([
      {
        id: attendedApplicantId,
        partner_organization_id: partnerOrgId,
        referral_source: "partner_link",
        first_name: "Devon",
        status: "enrolled",
        cohort_id: cohortId,
      },
      {
        id: absentApplicantId,
        partner_organization_id: partnerOrgId,
        referral_source: "partner_link",
        first_name: "Sam",
        status: "enrolled",
        cohort_id: cohortId,
      },
    ]);

    await admin.from("sessions").insert([
      { id: pastSessionId, cohort_id: cohortId, session_number: 1, scheduled_at: new Date(Date.now() - 7 * 86_400_000).toISOString(), status: "completed" },
      { id: prepSessionId, cohort_id: cohortId, session_number: 2, scheduled_at: new Date(Date.now() + 7 * 86_400_000).toISOString(), status: "scheduled" },
    ]);

    await admin.from("session_attendance").insert([
      { session_id: pastSessionId, applicant_id: attendedApplicantId, status: "present", marked_by: facilitatorUserId },
      { session_id: pastSessionId, applicant_id: absentApplicantId, status: "absent", marked_by: facilitatorUserId },
    ]);

    const { data: programSessionTwo } = await admin
      .from("program_sessions")
      .select("id")
      .eq("program_id", programId)
      .eq("session_number", 2)
      .single();
    await admin.from("session_materials").insert({
      id: materialId,
      program_session_id: programSessionTwo!.id,
      title: "F3 data test slides",
      storage_path: "placeholder/f3-data-test-slides.pdf",
    });
  });

  afterAll(async () => {
    await admin.from("session_materials").delete().eq("id", materialId);
    await admin.from("session_attendance").delete().in("session_id", [pastSessionId, prepSessionId]);
    await admin.from("sessions").delete().in("id", [pastSessionId, prepSessionId]);
    await admin.from("applicants").delete().in("id", [attendedApplicantId, absentApplicantId]);
    await admin.from("cohorts").delete().eq("id", cohortId);
    await admin.from("program_sessions").delete().eq("program_id", programId);
    await admin.from("programs").delete().eq("id", programId);
    await admin.from("partner_organizations").delete().eq("id", partnerOrgId);
    await admin.auth.admin.deleteUser(unrelatedFacilitatorUserId);
    await admin.auth.admin.deleteUser(facilitatorUserId);
  });

  it("getSessionPrepRoster returns the real roster with a real per-member attendance count, never a notes field", async () => {
    const client = await clientForUser(facilitatorUserId);
    const roster = await getSessionPrepRoster(prepSessionId, client);

    expect(roster).toHaveLength(2);
    const attended = roster.find((r) => r.applicantId === attendedApplicantId);
    const absent = roster.find((r) => r.applicantId === absentApplicantId);
    expect(attended).toMatchObject({ firstName: "Devon", sessionsAttended: 1 });
    expect(absent).toMatchObject({ firstName: "Sam", sessionsAttended: 0 });
    expect(Object.keys(attended!)).toEqual(["applicantId", "firstName", "sessionsAttended"]);
  });

  it("getSessionPrepRoster rejects a facilitator who does not own this session", async () => {
    const client = await clientForUser(unrelatedFacilitatorUserId);
    await expect(getSessionPrepRoster(prepSessionId, client)).rejects.toThrow();
  });

  it("getSessionPrepMaterials returns real materials for a currently-certified owning facilitator", async () => {
    const client = await clientForUser(facilitatorUserId);
    const materials = await getSessionPrepMaterials(prepSessionId, client);
    expect(materials).toEqual([{ id: materialId, title: "F3 data test slides" }]);
  });

  it("getSessionPrepMaterials rejects an owning facilitator whose certification has lapsed", async () => {
    await admin
      .from("facilitator_certifications")
      .update({ expires_on: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10) })
      .eq("facilitator_id", facilitatorUserId)
      .eq("program_id", programId);

    const client = await clientForUser(facilitatorUserId);
    await expect(getSessionPrepMaterials(prepSessionId, client)).rejects.toThrow();
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

describe("mapSessionStatus real-world regression - a 'scheduled' row whose time has already passed", () => {
  // Nothing in this codebase ever transitions sessions.status to
  // 'completed' (confirmed by grep) - every real session sits at
  // 'scheduled' forever. The OTHER tests in this file seed a past
  // session with `status: "completed"` directly, which is a condition
  // that has never once occurred in production and silently hid a real
  // bug: every session mapped to "upcoming" regardless of scheduled_at,
  // because the old mapSessionStatus only looked at the enum. This
  // fixture deliberately uses the ONLY shape a real row ever has -
  // status: "scheduled" on both a past and a future session - to prove
  // "past" is now derived from scheduled_at, not trusted from status.
  let programId: string;
  let cohortId: string;
  let partnerOrgId: string;
  let applicantId: string;
  let memberUserId: string;
  let genuinelyPastSessionId: string;
  let genuinelyUpcomingSessionId: string;

  beforeAll(async () => {
    const { data: program, error: programError } = await admin
      .from("programs")
      .insert({
        name: "Status Regression Test Program",
        developer: "Test Developer",
        session_count: 2,
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
        name: "Status Regression Test Cohort",
        grouping_description: "x",
        capacity: 8,
        cadence: "weekly",
        meeting_day_of_week: 2,
        meeting_time: "18:30",
        time_zone: "America/New_York",
        program_id: programId,
        delivery_format: "video",
        status: "active",
      })
      .select("id")
      .single();
    if (cohortError || !cohort) throw cohortError ?? new Error("failed to create cohort");
    cohortId = cohort.id;

    const { data: org, error: orgError } = await admin
      .from("partner_organizations")
      .insert({ name: "Status Regression Test Org", referral_link_slug: `status-regression-${Date.now()}` })
      .select("id")
      .single();
    if (orgError || !org) throw orgError ?? new Error("failed to create org");
    partnerOrgId = org.id;

    const { data: sessions, error: sessionsError } = await admin
      .from("sessions")
      .insert([
        {
          cohort_id: cohortId,
          session_number: 1,
          // A real row: status stays 'scheduled' even though this time
          // already passed - nothing ever flips it to 'completed'.
          scheduled_at: new Date(Date.now() - 7 * 86_400_000).toISOString(),
          status: "scheduled",
        },
        {
          cohort_id: cohortId,
          session_number: 2,
          scheduled_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
          status: "scheduled",
        },
      ])
      .select("id, session_number");
    if (sessionsError || !sessions) throw sessionsError ?? new Error("failed to create sessions");
    genuinelyPastSessionId = sessions.find((s) => s.session_number === 1)!.id;
    genuinelyUpcomingSessionId = sessions.find((s) => s.session_number === 2)!.id;

    const { data: memberUser, error: memberError } = await admin.auth.admin.createUser({
      email: `status-regression-member-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (memberError || !memberUser.user) throw memberError ?? new Error("createUser failed");
    memberUserId = memberUser.user.id;

    const { data: applicant, error: applicantError } = await admin
      .from("applicants")
      .insert({
        partner_organization_id: partnerOrgId,
        referral_source: "partner_link",
        first_name: "Regression",
        last_name: "Member",
        email: memberUser.user.email,
        status: "enrolled",
        cohort_id: cohortId,
      })
      .select("id")
      .single();
    if (applicantError || !applicant) throw applicantError ?? new Error("failed to create applicant");
    applicantId = applicant.id;
  });

  afterAll(async () => {
    await admin.from("applicants").delete().eq("id", applicantId);
    await admin.from("sessions").delete().in("id", [genuinelyPastSessionId, genuinelyUpcomingSessionId]);
    await admin.from("cohorts").delete().eq("id", cohortId);
    await admin.from("programs").delete().eq("id", programId);
    await admin.from("partner_organizations").delete().eq("id", partnerOrgId);
    await admin.auth.admin.deleteUser(memberUserId);
  });

  it("maps a 'scheduled' row whose scheduled_at has already passed to 'past', not 'upcoming'", async () => {
    const client = await clientForUser(memberUserId);
    await getViewer(client); // claims the applicant row by email match, same as the sibling describe block above
    const sessions = await getSessions(cohortId, client);
    const past = sessions.find((s) => s.id === genuinelyPastSessionId);
    const upcoming = sessions.find((s) => s.id === genuinelyUpcomingSessionId);
    expect(past?.status).toBe("past");
    expect(upcoming?.status).toBe("upcoming");
  });

  it("getUpcomingSession skips the genuinely-past 'scheduled' session and returns the real next one", async () => {
    const client = await clientForUser(memberUserId);
    await getViewer(client);
    const next = await getUpcomingSession(cohortId, client);
    expect(next?.id).toBe(genuinelyUpcomingSessionId);
  });
});

describe("getFacilitatorSessionsNeedingLog", () => {
  // Real bug found alongside the mapSessionStatus one above: this filter
  // used to be `status === "past"` alone, so a session that had ALREADY
  // been logged would still show up here forever, since nothing checked
  // deliveryConfirmed. No prior test file covered this function at all.
  let programId: string;
  let cohortId: string;
  let facilitatorId: string;
  let loggedPastSessionId: string;
  let unloggedPastSessionId: string;
  let futureSessionId: string;

  beforeAll(async () => {
    const { data: facilitatorUser, error: facilitatorError } = await admin.auth.admin.createUser({
      email: `needs-log-facilitator-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (facilitatorError || !facilitatorUser.user) throw facilitatorError ?? new Error("createUser failed");
    facilitatorId = facilitatorUser.user.id;
    await admin.from("profiles").update({ role: "facilitator" }).eq("id", facilitatorId);

    const { data: program, error: programError } = await admin
      .from("programs")
      .insert({
        name: "Needs Log Test Program",
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

    // A4-cert's enforce_cohort_program_and_facilitator() trigger blocks
    // an uncertified facilitator from being assigned to a cohort.
    await admin
      .from("facilitator_certifications")
      .insert({
        facilitator_id: facilitatorId,
        program_id: programId,
        certified_on: new Date(Date.now() - 30 * 86_400_000).toISOString(),
        expires_on: new Date(Date.now() + 300 * 86_400_000).toISOString(),
        certifying_body: "Test Body",
      });

    const { data: cohort, error: cohortError } = await admin
      .from("cohorts")
      .insert({
        name: "Needs Log Test Cohort",
        grouping_description: "x",
        capacity: 8,
        cadence: "weekly",
        meeting_day_of_week: 2,
        meeting_time: "18:30",
        time_zone: "America/New_York",
        program_id: programId,
        status: "active",
        facilitator_id: facilitatorId,
      })
      .select("id")
      .single();
    if (cohortError || !cohort) throw cohortError ?? new Error("failed to create cohort");
    cohortId = cohort.id;

    const { data: sessions, error: sessionsError } = await admin
      .from("sessions")
      .insert([
        { cohort_id: cohortId, session_number: 1, scheduled_at: new Date(Date.now() - 14 * 86_400_000).toISOString(), status: "scheduled" },
        { cohort_id: cohortId, session_number: 2, scheduled_at: new Date(Date.now() - 7 * 86_400_000).toISOString(), status: "scheduled" },
        { cohort_id: cohortId, session_number: 3, scheduled_at: new Date(Date.now() + 7 * 86_400_000).toISOString(), status: "scheduled" },
      ])
      .select("id, session_number");
    if (sessionsError || !sessions) throw sessionsError ?? new Error("failed to create sessions");
    loggedPastSessionId = sessions.find((s) => s.session_number === 1)!.id;
    unloggedPastSessionId = sessions.find((s) => s.session_number === 2)!.id;
    futureSessionId = sessions.find((s) => s.session_number === 3)!.id;

    await admin.from("session_logs").insert({
      session_id: loggedPastSessionId,
      delivery_confirmed: true,
      logged_by: facilitatorId,
    });
  });

  afterAll(async () => {
    await admin.from("session_logs").delete().eq("session_id", loggedPastSessionId);
    await admin.from("sessions").delete().in("id", [loggedPastSessionId, unloggedPastSessionId, futureSessionId]);
    await admin.from("cohorts").delete().eq("id", cohortId);
    await admin.from("facilitator_certifications").delete().eq("facilitator_id", facilitatorId);
    await admin.from("programs").delete().eq("id", programId);
    await admin.auth.admin.deleteUser(facilitatorId);
  });

  it("surfaces only the genuinely-past session with no log yet - not the logged one, not the future one", async () => {
    const client = await clientForUser(facilitatorId);
    const needingLog = await getFacilitatorSessionsNeedingLog(client);
    const ids = needingLog.map((s) => s.id);
    expect(ids).toContain(unloggedPastSessionId);
    expect(ids).not.toContain(loggedPastSessionId);
    expect(ids).not.toContain(futureSessionId);
  });
});
