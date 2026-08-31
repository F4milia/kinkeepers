import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { ForbiddenError } from "@/lib/auth/roles";
import { clientForUser } from "@/test/helpers/local-auth";
import {
  rescheduleSessionAction,
  cancelSessionAction,
  recordSessionSubstituteAction,
} from "@/lib/admin/session-management";

// revalidatePath only works inside a real Next.js request - see
// lib/admin/partner-organizations.test.ts for the full reasoning.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

function mockSuccessfulZoomActionFetch() {
  return vi
    .fn()
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "tok", expires_in: 3600 }) })
    .mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) });
}

function mockFailingZoomActionFetch() {
  return vi
    .fn()
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "tok", expires_in: 3600 }) })
    .mockResolvedValueOnce({ ok: false, status: 503, text: async () => "Zoom is down" });
}

const admin = createAdminClient();
let credentialCounter = 0;
function freshZoomCredentials() {
  credentialCounter += 1;
  return { accountId: `acct-${credentialCounter}`, clientId: `client-${credentialCounter}`, clientSecret: `secret-${credentialCounter}` };
}

describe("session management actions", () => {
  let adminUser: { id: string };
  let memberUser: { id: string };
  let facilitatorUser: { id: string };
  let otherFacilitatorUser: { id: string };
  let programId: string;
  let cohortId: string;
  const sessionIds: string[] = [];

  beforeAll(async () => {
    const { data: adminData, error: adminError } = await admin.auth.admin.createUser({
      email: `session-mgmt-admin-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (adminError || !adminData.user) throw adminError ?? new Error("createUser failed");
    adminUser = adminData.user;
    await admin.from("profiles").update({ role: "admin" }).eq("id", adminUser.id);

    const { data: memberData, error: memberError } = await admin.auth.admin.createUser({
      email: `session-mgmt-member-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (memberError || !memberData.user) throw memberError ?? new Error("createUser failed");
    memberUser = memberData.user;

    const { data: facData, error: facError } = await admin.auth.admin.createUser({
      email: `session-mgmt-facilitator-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (facError || !facData.user) throw facError ?? new Error("createUser failed");
    facilitatorUser = facData.user;
    await admin.from("profiles").update({ role: "facilitator" }).eq("id", facilitatorUser.id);

    const { data: otherFacData, error: otherFacError } = await admin.auth.admin.createUser({
      email: `session-mgmt-other-facilitator-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (otherFacError || !otherFacData.user) throw otherFacError ?? new Error("createUser failed");
    otherFacilitatorUser = otherFacData.user;
    await admin.from("profiles").update({ role: "facilitator" }).eq("id", otherFacilitatorUser.id);

    const { data: program, error: programError } = await admin
      .from("programs")
      .insert({
        name: "Session Mgmt Test Program",
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
        name: "Session Mgmt Test Cohort",
        grouping_description: "x",
        capacity: 8,
        cadence: "weekly",
        meeting_day_of_week: 2,
        meeting_time: "18:30",
        time_zone: "America/New_York",
        program_id: programId,
        facilitator_id: facilitatorUser.id,
      })
      .select("id")
      .single();
    if (cohortError || !cohort) throw cohortError ?? new Error("failed to create cohort");
    cohortId = cohort.id;
  });

  afterAll(async () => {
    await admin.from("sessions").delete().in("cohort_id", [cohortId]);
    await admin.from("cohorts").delete().in("id", [cohortId]);
    await admin.from("programs").delete().in("id", [programId]);
    await admin.auth.admin.deleteUser(memberUser.id);
    await admin.auth.admin.deleteUser(facilitatorUser.id);
    await admin.auth.admin.deleteUser(otherFacilitatorUser.id);
    await admin.auth.admin.deleteUser(adminUser.id);
  });

  async function insertSession(overrides: Record<string, unknown> = {}) {
    const { data, error } = await admin
      .from("sessions")
      .insert({
        cohort_id: cohortId,
        session_number: sessionIds.length + 1,
        scheduled_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        video_meeting_id: "zm-1",
        video_occurrence_id: "occ-1",
        ...overrides,
      })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("failed to create session");
    sessionIds.push(data.id);
    return data.id;
  }

  it("rejects a non-admin caller for all three actions", async () => {
    const sessionId = await insertSession();
    const memberClient = await clientForUser(memberUser.id);
    await expect(rescheduleSessionAction(sessionId, new Date().toISOString(), memberClient)).rejects.toThrow(
      ForbiddenError,
    );
    await expect(cancelSessionAction(sessionId, "reason", memberClient)).rejects.toThrow(ForbiddenError);
    await expect(recordSessionSubstituteAction(sessionId, facilitatorUser.id, memberClient)).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("reschedules a session and updates the Zoom occurrence when one exists", async () => {
    const sessionId = await insertSession();
    const adminClient = await clientForUser(adminUser.id);
    const newTime = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const zoomFetch = mockSuccessfulZoomActionFetch();

    const result = await rescheduleSessionAction(
      sessionId,
      newTime,
      adminClient,
      freshZoomCredentials(),
      zoomFetch as unknown as typeof fetch,
    );

    expect(result).toEqual({ success: true });
    const { data: session } = await admin.from("sessions").select("scheduled_at").eq("id", sessionId).single();
    // Postgres renders timestamptz as "+00:00", not "Z" - compare as instants.
    expect(new Date(session!.scheduled_at).getTime()).toBe(new Date(newTime).getTime());

    const [url, init] = zoomFetch.mock.calls[1];
    expect(url).toContain("/meetings/zm-1/occurrences/occ-1");
    expect(init.method).toBe("PATCH");
  });

  it("named edge case: rescheduling a session with no video_occurrence_id updates the DB but surfaces a Zoom warning, not a dead end", async () => {
    const sessionId = await insertSession({ video_meeting_id: null, video_occurrence_id: null });
    const adminClient = await clientForUser(adminUser.id);
    const newTime = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();

    const result = await rescheduleSessionAction(sessionId, newTime, adminClient);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect((result as { zoomWarning?: string }).zoomWarning).toBeTruthy();

    const { data: session } = await admin.from("sessions").select("scheduled_at").eq("id", sessionId).single();
    expect(new Date(session!.scheduled_at).getTime()).toBe(new Date(newTime).getTime());
  });

  it("does not reschedule the DB row when the Zoom call fails", async () => {
    const sessionId = await insertSession();
    const adminClient = await clientForUser(adminUser.id);
    const { data: before } = await admin.from("sessions").select("scheduled_at").eq("id", sessionId).single();
    const zoomFetch = mockFailingZoomActionFetch();

    const result = await rescheduleSessionAction(
      sessionId,
      new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
      adminClient,
      freshZoomCredentials(),
      zoomFetch as unknown as typeof fetch,
    );

    expect(result.success).toBe(false);
    const { data: after } = await admin.from("sessions").select("scheduled_at").eq("id", sessionId).single();
    expect(after?.scheduled_at).toBe(before?.scheduled_at);
  });

  it("cancels a session with a reason and removes the Zoom occurrence", async () => {
    const sessionId = await insertSession();
    const adminClient = await clientForUser(adminUser.id);
    const zoomFetch = mockSuccessfulZoomActionFetch();

    const result = await cancelSessionAction(
      sessionId,
      "facilitator unavailable",
      adminClient,
      freshZoomCredentials(),
      zoomFetch as unknown as typeof fetch,
    );

    expect(result).toEqual({ success: true });
    const { data: session } = await admin
      .from("sessions")
      .select("status, cancellation_reason")
      .eq("id", sessionId)
      .single();
    expect(session?.status).toBe("cancelled");
    expect(session?.cancellation_reason).toBe("facilitator unavailable");

    const [url, init] = zoomFetch.mock.calls[1];
    expect(url).toContain("/meetings/zm-1?occurrence_id=occ-1");
    expect(init.method).toBe("DELETE");
  });

  it("records a substitute facilitator without calling Zoom, leaving the cohort's own facilitator untouched", async () => {
    const sessionId = await insertSession();
    const adminClient = await clientForUser(adminUser.id);

    const result = await recordSessionSubstituteAction(sessionId, otherFacilitatorUser.id, adminClient);

    expect(result).toEqual({ success: true });
    const { data: session } = await admin
      .from("sessions")
      .select("substitute_facilitator_id")
      .eq("id", sessionId)
      .single();
    expect(session?.substitute_facilitator_id).toBe(otherFacilitatorUser.id);

    const { data: cohort } = await admin.from("cohorts").select("facilitator_id").eq("id", cohortId).single();
    expect(cohort?.facilitator_id).toBe(facilitatorUser.id);
  });
});
