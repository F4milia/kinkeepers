import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleSessionReminders } from "@/lib/inngest/functions/session-reminders";
import { sendEmail } from "@/lib/messaging/send-email";

// Real integration test, not mocked notify functions - this is
// specifically proving the WIRING (RPC -> notify function -> real
// dedup log row), which session-notifications.test.ts's own mocked
// notifyMember tests can't exercise. Only the actual outbound send is
// mocked, same as notify-member.test.ts's own established pattern -
// never a real Resend/Twilio call from a test.
vi.mock("@/lib/messaging/send-email", () => ({ sendEmail: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/messaging/send-sms", () => ({ sendSms: vi.fn().mockResolvedValue(true) }));

const admin = createAdminClient();

describe("handleSessionReminders", () => {
  let orgId: string;
  let programId: string;
  let facilitatorId: string;
  let cohortId: string;
  const applicantIds: string[] = [];
  const sessionIds: string[] = [];

  beforeAll(async () => {
    const { data: org, error: orgError } = await admin
      .from("partner_organizations")
      .insert({ name: "Session Reminders Test Org", referral_link_slug: `session-reminders-org-${Date.now()}` })
      .select("id")
      .single();
    if (orgError || !org) throw orgError ?? new Error("failed to create org");
    orgId = org.id;

    const { data: program, error: programError } = await admin
      .from("programs")
      .insert({
        name: "Session Reminders Test Program",
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

    const { data: facilitatorUser, error: facilitatorError } = await admin.auth.admin.createUser({
      email: `session-reminders-facilitator-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (facilitatorError || !facilitatorUser.user) throw facilitatorError ?? new Error("failed to create facilitator");
    facilitatorId = facilitatorUser.user.id;
    await admin.from("profiles").update({ role: "facilitator" }).eq("id", facilitatorId);
    await admin.from("facilitator_certifications").insert({
      facilitator_id: facilitatorId,
      program_id: programId,
      certified_on: new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10),
      expires_on: new Date(Date.now() + 300 * 86_400_000).toISOString().slice(0, 10),
      certifying_body: "Vitest Certifying Body",
    });

    const { data: cohort, error: cohortError } = await admin
      .from("cohorts")
      .insert({
        name: "Session Reminders Test Cohort",
        grouping_description: "x",
        capacity: 8,
        cadence: "weekly",
        meeting_day_of_week: 2,
        meeting_time: "18:30",
        time_zone: "America/New_York",
        program_id: programId,
        facilitator_id: facilitatorId,
      })
      .select("id")
      .single();
    if (cohortError || !cohort) throw cohortError ?? new Error("failed to create cohort");
    cohortId = cohort.id;

    async function insertApplicant(email: string, status: string) {
      const { data, error } = await admin
        .from("applicants")
        .insert({
          partner_organization_id: orgId,
          referral_source: "partner_link",
          status,
          cohort_id: cohortId,
          email,
          preferred_contact_channel: "email",
        })
        .select("id")
        .single();
      if (error || !data) throw error ?? new Error("failed to create applicant");
      applicantIds.push(data.id);
      return data.id;
    }

    await insertApplicant("reminders-enrolled@example.com", "enrolled");
    const missedApplicantId = await insertApplicant("reminders-missed@example.com", "enrolled");

    async function insertSession(scheduledAt: Date) {
      const { data, error } = await admin
        .from("sessions")
        .insert({ cohort_id: cohortId, session_number: sessionIds.length + 1, scheduled_at: scheduledAt.toISOString() })
        .select("id")
        .single();
      if (error || !data) throw error ?? new Error("failed to create session");
      sessionIds.push(data.id);
      return data.id;
    }

    // Real relative offsets from the real now() - fully deterministic,
    // no mocking needed for these two (unlike the missed-session case
    // below, which needs a controlled "now" against a fixed past date).
    await insertSession(new Date(Date.now() + 23 * 60 * 60 * 1000));

    // Fixed date, paired with handleSessionReminders' own missedSessionNow
    // override below - March 2027 predates that year's US DST change,
    // matching the same reasoning already used in the pgTAP suite for
    // this function.
    const missedSessionId = await insertSession(new Date("2027-03-09T18:30:00-05:00"));
    await admin.from("session_attendance").insert({
      session_id: missedSessionId,
      applicant_id: missedApplicantId,
      status: "absent",
      marked_by: facilitatorId,
    });
  });

  afterAll(async () => {
    await admin.from("session_attendance").delete().in("session_id", sessionIds);
    await admin.from("sessions").delete().in("id", sessionIds);
    await admin.from("applicants").delete().in("id", applicantIds);
    await admin.from("cohorts").delete().eq("id", cohortId);
    await admin.from("facilitator_certifications").delete().eq("facilitator_id", facilitatorId);
    await admin.from("programs").delete().eq("id", programId);
    await admin.auth.admin.deleteUser(facilitatorId);
    await admin.from("partner_organizations").delete().eq("id", orgId);
  });

  it("finds the due 24h reminder and missed-session follow-up, and actually writes real notification_log rows", async () => {
    const result = await handleSessionReminders(admin, new Date("2027-03-10T09:00:00-05:00"));

    expect(result.reminder24h).toBeGreaterThanOrEqual(1);
    expect(result.missedSession).toBeGreaterThanOrEqual(1);
    expect(sendEmail).toHaveBeenCalled();

    const { data: reminderLog } = await admin
      .from("notification_log")
      .select("id, status")
      .eq("applicant_id", applicantIds[0])
      .eq("notification_type", "session_reminder_24h")
      .maybeSingle();
    expect(reminderLog?.status).toBe("sent");

    const { data: missedLog } = await admin
      .from("notification_log")
      .select("id, status")
      .eq("applicant_id", applicantIds[1])
      .eq("notification_type", "missed_session_followup")
      .maybeSingle();
    expect(missedLog?.status).toBe("sent");
  });

  it("a second tick with the same due sessions doesn't send a second time - the real dedup index blocks it", async () => {
    vi.clearAllMocks();
    await handleSessionReminders(admin, new Date("2027-03-10T09:00:00-05:00"));

    expect(sendEmail).not.toHaveBeenCalled();

    const { data: reminderLogRows } = await admin
      .from("notification_log")
      .select("id")
      .eq("applicant_id", applicantIds[0])
      .eq("notification_type", "session_reminder_24h");
    expect(reminderLogRows).toHaveLength(1);
  });
});
