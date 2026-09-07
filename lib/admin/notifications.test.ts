import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { ForbiddenError } from "@/lib/auth/roles";
import { clientForUser } from "@/test/helpers/local-auth";
import { listFailedNotifications } from "@/lib/admin/notifications";

const admin = createAdminClient();

describe("listFailedNotifications", () => {
  let adminUser: { id: string };
  let memberUser: { id: string };
  let orgId: string;
  let applicantId: string;
  let programId: string;
  let cohortId: string;
  let sessionId: string;
  const logIds: string[] = [];

  beforeAll(async () => {
    const { data: adminData, error: adminError } = await admin.auth.admin.createUser({
      email: `notifications-admin-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (adminError || !adminData.user) throw adminError ?? new Error("createUser failed");
    adminUser = adminData.user;
    await admin.from("profiles").update({ role: "admin" }).eq("id", adminUser.id);

    const { data: memberData, error: memberError } = await admin.auth.admin.createUser({
      email: `notifications-member-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (memberError || !memberData.user) throw memberError ?? new Error("createUser failed");
    memberUser = memberData.user;

    const { data: org, error: orgError } = await admin
      .from("partner_organizations")
      .insert({ name: "Notifications Admin Test Org", referral_link_slug: `notifications-admin-org-${Date.now()}` })
      .select("id")
      .single();
    if (orgError || !org) throw orgError ?? new Error("failed to create org");
    orgId = org.id;

    const { data: applicant, error: applicantError } = await admin
      .from("applicants")
      .insert({
        partner_organization_id: orgId,
        referral_source: "partner_link",
        status: "enrolled",
        email: "failed-notify-member@example.com",
      })
      .select("id")
      .single();
    if (applicantError || !applicant) throw applicantError ?? new Error("failed to create applicant");
    applicantId = applicant.id;

    const { data: program, error: programError } = await admin
      .from("programs")
      .insert({
        name: "Notifications Admin Test Program", developer: "Test Developer", session_count: 1, session_duration_minutes: 90,
        delivery_formats: ["video"], languages: ["English"], facilitator_qualification: "Lay leader", license_status: "licensed",
      })
      .select("id")
      .single();
    if (programError || !program) throw programError ?? new Error("failed to create program");
    programId = program.id;

    const { data: cohort, error: cohortError } = await admin
      .from("cohorts")
      .insert({
        name: "Notifications Admin Test Cohort", grouping_description: "x", capacity: 8, cadence: "weekly",
        meeting_day_of_week: 2, meeting_time: "18:30", time_zone: "America/New_York", program_id: programId,
      })
      .select("id")
      .single();
    if (cohortError || !cohort) throw cohortError ?? new Error("failed to create cohort");
    cohortId = cohort.id;

    const { data: session, error: sessionError } = await admin
      .from("sessions")
      .insert({ cohort_id: cohortId, session_number: 1, scheduled_at: new Date().toISOString() })
      .select("id")
      .single();
    if (sessionError || !session) throw sessionError ?? new Error("failed to create session");
    sessionId = session.id;

    const { data: rows, error: logError } = await admin
      .from("notification_log")
      .insert([
        {
          applicant_id: applicantId, notification_type: "session_rescheduled", channel: "email", status: "failed",
          dedup_key: `fail-${Date.now()}-1`, session_id: sessionId, error_message: "Resend rejected the request",
        },
        { applicant_id: applicantId, notification_type: "session_cancelled", channel: "sms", status: "sent", dedup_key: `fail-${Date.now()}-2` },
      ])
      .select("id");
    if (logError || !rows) throw logError ?? new Error("failed to create notification_log rows");
    logIds.push(...rows.map((r) => r.id));
  });

  afterAll(async () => {
    await admin.from("notification_log").delete().in("id", logIds);
    await admin.from("applicants").delete().eq("id", applicantId);
    await admin.from("sessions").delete().eq("id", sessionId);
    await admin.from("cohorts").delete().eq("id", cohortId);
    await admin.from("programs").delete().eq("id", programId);
    await admin.from("partner_organizations").delete().eq("id", orgId);
    await admin.auth.admin.deleteUser(memberUser.id);
    await admin.auth.admin.deleteUser(adminUser.id);
  });

  it("rejects a non-admin caller", async () => {
    const memberClient = await clientForUser(memberUser.id);
    await expect(listFailedNotifications(memberClient)).rejects.toThrow(ForbiddenError);
  });

  it("returns only failed rows, with the applicant's contact info resolved, not sent ones", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const failures = await listFailedNotifications(adminClient);

    const ours = failures.filter((f) => logIds.includes(f.id));
    expect(ours).toHaveLength(1);
    expect(ours[0].notificationType).toBe("session_rescheduled");
    expect(ours[0].channel).toBe("email");
    expect(ours[0].applicantEmail).toBe("failed-notify-member@example.com");
  });

  // 2026-09-08 A5 acceptance audit: A5's own prompt text requires
  // "member, session, channel, error" - session and error were
  // structurally unreachable before this pass (no session_id column at
  // all, and error_message was never populated by any real send path).
  it("resolves a real session label and the real error message", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const failures = await listFailedNotifications(adminClient);

    const ours = failures.find((f) => logIds.includes(f.id) && f.notificationType === "session_rescheduled");
    expect(ours?.sessionLabel).toBe("Notifications Admin Test Cohort - Session 1");
    expect(ours?.errorMessage).toBe("Resend rejected the request");
  });

  it("leaves sessionLabel null for a notification with no session attached", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const { data: row } = await admin
      .from("notification_log")
      .insert({
        applicant_id: applicantId, notification_type: "application_received", channel: "email", status: "failed",
        dedup_key: `fail-no-session-${Date.now()}`,
      })
      .select("id")
      .single();
    logIds.push(row!.id);

    const failures = await listFailedNotifications(adminClient);
    const ours = failures.find((f) => f.id === row!.id);
    expect(ours?.sessionLabel).toBeNull();
  });
});
