import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { ForbiddenError } from "@/lib/auth/roles";
import { clientForUser } from "@/test/helpers/local-auth";
import { submitSessionLogAction } from "@/lib/facilitator/session-log";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const admin = createAdminClient();

describe("submitSessionLogAction (X4 prerequisite)", () => {
  let facilitatorAId: string;
  let facilitatorBId: string;
  let cohortId: string;
  let sessionId: string;
  let applicantId: string;

  beforeAll(async () => {
    const { data: partnerOrg } = await admin
      .from("partner_organizations")
      .insert({ name: `Session Log Test Org ${Date.now()}`, referral_link_slug: `session-log-test-${Date.now()}` })
      .select("id")
      .single();

    const { data: program } = await admin
      .from("programs")
      .insert({
        name: "Session Log Test Program",
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

    const { data: facilitatorA } = await admin.auth.admin.createUser({
      email: `session-log-facilitator-a-${Date.now()}@example.com`,
      email_confirm: true,
    });
    const { data: facilitatorB } = await admin.auth.admin.createUser({
      email: `session-log-facilitator-b-${Date.now()}@example.com`,
      email_confirm: true,
    });
    facilitatorAId = facilitatorA!.user!.id;
    facilitatorBId = facilitatorB!.user!.id;
    await admin.from("profiles").update({ role: "facilitator" }).eq("id", facilitatorAId);
    await admin.from("profiles").update({ role: "facilitator" }).eq("id", facilitatorBId);

    await admin.from("facilitator_certifications").insert({
      facilitator_id: facilitatorAId,
      program_id: program!.id,
      certified_on: new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10),
      expires_on: new Date(Date.now() + 300 * 86_400_000).toISOString().slice(0, 10),
      certifying_body: "Test Body",
    });

    const { data: cohort } = await admin
      .from("cohorts")
      .insert({
        name: "Session Log Test Cohort",
        grouping_description: "x",
        capacity: 8,
        cadence: "weekly",
        meeting_day_of_week: 2,
        meeting_time: "18:30",
        time_zone: "America/New_York",
        program_id: program!.id,
        status: "active",
        facilitator_id: facilitatorAId,
      })
      .select("id")
      .single();
    cohortId = cohort!.id;

    const { data: session } = await admin
      .from("sessions")
      .insert({ cohort_id: cohortId, session_number: 1, scheduled_at: new Date(Date.now() - 86_400_000).toISOString(), status: "completed" })
      .select("id")
      .single();
    sessionId = session!.id;

    const { data: applicant } = await admin
      .from("applicants")
      .insert({
        partner_organization_id: partnerOrg!.id,
        referral_source: "partner_link",
        first_name: "Test",
        last_name: "Member",
        status: "enrolled",
        cohort_id: cohortId,
      })
      .select("id")
      .single();
    applicantId = applicant!.id;
  });

  afterAll(async () => {
    await admin.from("session_attendance").delete().eq("session_id", sessionId);
    await admin.from("session_logs").delete().eq("session_id", sessionId);
    await admin.from("applicants").delete().eq("id", applicantId);
    await admin.from("sessions").delete().eq("id", sessionId);
    await admin.from("cohorts").delete().eq("id", cohortId);
    await admin.auth.admin.deleteUser(facilitatorAId);
    await admin.auth.admin.deleteUser(facilitatorBId);
  });

  it("lets the cohort's own facilitator submit a real, persisted session log", async () => {
    const client = await clientForUser(facilitatorAId);
    const result = await submitSessionLogAction(
      sessionId,
      true,
      "Good session overall.",
      [{ applicantId, status: "present" }],
      client,
    );
    expect(result).toEqual({ success: true });

    const { data: log } = await admin.from("session_logs").select("delivery_confirmed, notes").eq("session_id", sessionId).single();
    expect(log?.delivery_confirmed).toBe(true);
    expect(log?.notes).toBe("Good session overall.");

    const { data: attendance } = await admin
      .from("session_attendance")
      .select("status")
      .eq("session_id", sessionId)
      .eq("applicant_id", applicantId)
      .single();
    expect(attendance?.status).toBe("present");
  });

  it("rejects a facilitator who does not own this session's cohort", async () => {
    const client = await clientForUser(facilitatorBId);
    await expect(
      submitSessionLogAction(sessionId, true, "", [{ applicantId, status: "present" }], client),
    ).rejects.toThrow(ForbiddenError);
  });

  it("rejects a signed-in member (wrong role entirely)", async () => {
    const { data: memberUser } = await admin.auth.admin.createUser({
      email: `session-log-member-${Date.now()}@example.com`,
      email_confirm: true,
    });
    const client = await clientForUser(memberUser!.user!.id);
    await expect(
      submitSessionLogAction(sessionId, true, "", [{ applicantId, status: "present" }], client),
    ).rejects.toThrow(ForbiddenError);
    await admin.auth.admin.deleteUser(memberUser!.user!.id);
  });
});
