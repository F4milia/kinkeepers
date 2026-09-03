import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientForUser } from "@/test/helpers/local-auth";
import { ForbiddenError } from "@/lib/auth/roles";
import { getSessionAttendancePreFillAction } from "@/lib/facilitator/attendance-prefill";

const admin = createAdminClient();

// Same pattern as lib/zoom/meeting.test.ts: injected mock fetch (not a
// global stub, avoids cross-file pollution), fresh credentials per test
// so each gets its own OAuth token-cache key.
let credentialCounter = 0;
function freshCredentials() {
  credentialCounter += 1;
  return { accountId: `acct-${credentialCounter}`, clientId: `client-${credentialCounter}`, clientSecret: `secret-${credentialCounter}` };
}

function mockZoomParticipants(participants: Array<{ id: string; name: string; user_email?: string }>) {
  return vi
    .fn()
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "tok", expires_in: 3600 }) })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        participants: participants.map((p) => ({ ...p, join_time: "2026-06-01T18:30:00Z", leave_time: "2026-06-01T19:30:00Z", duration: 3600 })),
      }),
    });
}

describe("getSessionAttendancePreFillAction", () => {
  let programId: string;
  let cohortId: string;
  let sessionId: string;
  let facilitatorAId: string;
  let facilitatorBId: string;
  let substituteFacilitatorId: string;
  let adminUserId: string;
  let memberUserId: string;
  let videoApplicantId: string;
  let phoneApplicantId: string;

  beforeAll(async () => {
    const makeUser = async (email: string) => {
      const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
      if (error || !data.user) throw error ?? new Error("createUser failed");
      return data.user.id;
    };
    facilitatorAId = await makeUser(`prefill-facilitator-a-${Date.now()}@example.com`);
    facilitatorBId = await makeUser(`prefill-facilitator-b-${Date.now()}@example.com`);
    substituteFacilitatorId = await makeUser(`prefill-substitute-${Date.now()}@example.com`);
    adminUserId = await makeUser(`prefill-admin-${Date.now()}@example.com`);
    memberUserId = await makeUser(`prefill-member-${Date.now()}@example.com`);
    await admin.from("profiles").update({ role: "facilitator" }).in("id", [facilitatorAId, facilitatorBId, substituteFacilitatorId]);
    await admin.from("profiles").update({ role: "admin" }).eq("id", adminUserId);

    const { data: program, error: programError } = await admin
      .from("programs")
      .insert({
        name: "Attendance Prefill Test Program",
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

    await admin.from("facilitator_certifications").insert([
      { facilitator_id: facilitatorAId, program_id: programId, certified_on: new Date(Date.now() - 30 * 86_400_000).toISOString(), expires_on: new Date(Date.now() + 300 * 86_400_000).toISOString(), certifying_body: "Test Body" },
      { facilitator_id: facilitatorBId, program_id: programId, certified_on: new Date(Date.now() - 30 * 86_400_000).toISOString(), expires_on: new Date(Date.now() + 300 * 86_400_000).toISOString(), certifying_body: "Test Body" },
      { facilitator_id: substituteFacilitatorId, program_id: programId, certified_on: new Date(Date.now() - 30 * 86_400_000).toISOString(), expires_on: new Date(Date.now() + 300 * 86_400_000).toISOString(), certifying_body: "Test Body" },
    ]);

    const { data: cohort, error: cohortError } = await admin
      .from("cohorts")
      .insert({
        name: "Attendance Prefill Test Cohort",
        grouping_description: "x",
        capacity: 8,
        cadence: "weekly",
        meeting_day_of_week: 2,
        meeting_time: "18:30",
        time_zone: "America/New_York",
        program_id: programId,
        status: "active",
        facilitator_id: facilitatorAId,
      })
      .select("id")
      .single();
    if (cohortError || !cohort) throw cohortError ?? new Error("failed to create cohort");
    cohortId = cohort.id;

    const { data: session, error: sessionError } = await admin
      .from("sessions")
      .insert({
        cohort_id: cohortId,
        session_number: 1,
        scheduled_at: new Date(Date.now() - 86_400_000).toISOString(),
        status: "scheduled",
        video_occurrence_id: "occurrence-12345",
        substitute_facilitator_id: substituteFacilitatorId,
      })
      .select("id")
      .single();
    if (sessionError || !session) throw sessionError ?? new Error("failed to create session");
    sessionId = session.id;

    const { data: orgForApplicants, error: orgError } = await admin
      .from("partner_organizations")
      .insert({ name: "Attendance Prefill Test Org", referral_link_slug: `attendance-prefill-org-${Date.now()}` })
      .select("id")
      .single();
    if (orgError || !orgForApplicants) throw orgError ?? new Error("failed to create org");

    const { data: applicants, error: applicantsError } = await admin
      .from("applicants")
      .insert([
        { partner_organization_id: orgForApplicants.id, referral_source: "partner_link", first_name: "Video", last_name: "Joiner", email: "alice@example.com", status: "enrolled", cohort_id: cohortId },
        { partner_organization_id: orgForApplicants.id, referral_source: "partner_link", first_name: "Phone", last_name: "Joiner", phone: "+15551234567", status: "enrolled", cohort_id: cohortId },
      ])
      .select("id, email, phone");
    if (applicantsError || !applicants) throw applicantsError ?? new Error("failed to create applicants");
    videoApplicantId = applicants.find((a) => a.email === "alice@example.com")!.id;
    phoneApplicantId = applicants.find((a) => a.phone === "+15551234567")!.id;
  });

  afterAll(async () => {
    await admin.from("applicants").delete().eq("cohort_id", cohortId);
    await admin.from("sessions").delete().eq("cohort_id", cohortId);
    await admin.from("cohorts").delete().eq("id", cohortId);
    await admin.from("facilitator_certifications").delete().eq("program_id", programId);
    await admin.from("programs").delete().eq("id", programId);
    await admin.auth.admin.deleteUser(facilitatorAId);
    await admin.auth.admin.deleteUser(facilitatorBId);
    await admin.auth.admin.deleteUser(substituteFacilitatorId);
    await admin.auth.admin.deleteUser(adminUserId);
    await admin.auth.admin.deleteUser(memberUserId);
  });

  it("rejects a caller who is neither facilitator nor admin", async () => {
    const client = await clientForUser(memberUserId);
    await expect(getSessionAttendancePreFillAction(sessionId, client)).rejects.toThrow(ForbiddenError);
  });

  it("rejects a facilitator who neither runs this cohort nor is its substitute", async () => {
    const client = await clientForUser(facilitatorBId);
    await expect(getSessionAttendancePreFillAction(sessionId, client)).rejects.toThrow(ForbiddenError);
  });

  it("returns available: false with a clear reason when the session has no video_occurrence_id", async () => {
    const { data: noOccurrenceSession, error } = await admin
      .from("sessions")
      .insert({ cohort_id: cohortId, session_number: 2, scheduled_at: new Date().toISOString(), status: "scheduled" })
      .select("id")
      .single();
    if (error || !noOccurrenceSession) throw error ?? new Error("failed to create session");

    try {
      const client = await clientForUser(facilitatorAId);
      const result = await getSessionAttendancePreFillAction(noOccurrenceSession.id, client);
      expect(result).toEqual({ available: false, reason: "No Zoom occurrence recorded for this session." });
    } finally {
      await admin.from("sessions").delete().eq("id", noOccurrenceSession.id);
    }
  });

  it("returns available: false when the Zoom fetch fails", async () => {
    const credentials = freshCredentials();
    const failingFetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    const client = await clientForUser(facilitatorAId);

    const result = await getSessionAttendancePreFillAction(sessionId, client, credentials, failingFetch as unknown as typeof fetch);
    expect(result).toEqual({ available: false, reason: "Could not reach Zoom for this session's participant report." });
  });

  it("matches a video joiner by email, a phone joiner by E.164 number, and surfaces an unmatched caller as unidentified", async () => {
    const credentials = freshCredentials();
    const fetchMock = mockZoomParticipants([
      { id: "p-video", name: "Alice Smith", user_email: "alice@example.com" },
      { id: "p-phone-matched", name: "+15551234567" },
      { id: "p-phone-unmatched", name: "+15559999999" },
    ]);
    const client = await clientForUser(facilitatorAId);

    const result = await getSessionAttendancePreFillAction(sessionId, client, credentials, fetchMock as unknown as typeof fetch);
    if (!result.available) throw new Error(`expected available: true, got reason: ${result.reason}`);

    expect(result.suggestions).toContainEqual({ applicantId: videoApplicantId, method: "video" });
    expect(result.suggestions).toContainEqual({ applicantId: phoneApplicantId, method: "phone" });
    expect(result.unidentifiedCallers).toEqual([{ participantId: "p-phone-unmatched", last4: "9999" }]);
  });

  it("allows the substitute facilitator recorded on this specific session, not just the cohort's own facilitator", async () => {
    const credentials = freshCredentials();
    const fetchMock = mockZoomParticipants([]);
    const client = await clientForUser(substituteFacilitatorId);

    const result = await getSessionAttendancePreFillAction(sessionId, client, credentials, fetchMock as unknown as typeof fetch);
    expect(result.available).toBe(true);
  });

  it("allows admin regardless of cohort ownership", async () => {
    const credentials = freshCredentials();
    const fetchMock = mockZoomParticipants([]);
    const client = await clientForUser(adminUserId);

    const result = await getSessionAttendancePreFillAction(sessionId, client, credentials, fetchMock as unknown as typeof fetch);
    expect(result.available).toBe(true);
  });
});
