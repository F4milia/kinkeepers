import { describe, expect, it, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  notifyApplicationReceived,
  notifyCohortAssigned,
  notifyProgramComplete,
} from "@/lib/messaging/applicant-notifications";
import { notifyMember } from "@/lib/messaging/notify-member";

vi.mock("@/lib/messaging/notify-member", () => ({ notifyMember: vi.fn().mockResolvedValue(undefined) }));

beforeEach(() => {
  vi.clearAllMocks();
});

const admin = createAdminClient();

describe("applicant notifications (X3)", () => {
  let orgId: string;
  let programId: string;
  let cohortId: string;
  const applicantIds: string[] = [];

  beforeAll(async () => {
    const { data: org, error: orgError } = await admin
      .from("partner_organizations")
      .insert({ name: "X3 Test Org", referral_link_slug: `x3-test-org-${Date.now()}` })
      .select("id")
      .single();
    if (orgError || !org) throw orgError ?? new Error("failed to create org");
    orgId = org.id;

    const { data: program, error: programError } = await admin
      .from("programs")
      .insert({
        name: "X3 Test Program",
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
        name: "X3 Test Cohort",
        grouping_description: "x",
        capacity: 8,
        cadence: "weekly",
        meeting_day_of_week: 2,
        meeting_time: "18:30",
        time_zone: "America/New_York",
        program_id: programId,
      })
      .select("id")
      .single();
    if (cohortError || !cohort) throw cohortError ?? new Error("failed to create cohort");
    cohortId = cohort.id;

    await admin.from("sessions").insert({
      cohort_id: cohortId,
      session_number: 1,
      scheduled_at: "2027-03-09T18:30:00Z",
      video_join_url: "https://zoom.us/j/x3test",
      video_dial_in_number: "1-800-555-0199",
      video_dial_in_pin: "123456",
    });
  });

  afterAll(async () => {
    await admin.from("sessions").delete().eq("cohort_id", cohortId);
    await admin.from("applicants").delete().in("id", applicantIds);
    await admin.from("cohorts").delete().eq("id", cohortId);
    await admin.from("programs").delete().eq("id", programId);
    await admin.from("partner_organizations").delete().eq("id", orgId);
  });

  async function insertApplicant(status: string, email: string, optedOut = false): Promise<string> {
    const { data, error } = await admin
      .from("applicants")
      .insert({
        partner_organization_id: orgId,
        referral_source: "partner_link",
        status,
        cohort_id: status !== "intake_complete" ? cohortId : null,
        email,
        preferred_contact_channel: "email",
        time_zone: "Pacific/Honolulu",
        notifications_opted_out: optedOut,
      })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("failed to create applicant");
    applicantIds.push(data.id);
    return data.id;
  }

  it("notifyApplicationReceived uses the run doc's exact quoted text and never mentions dementia/caregiving", async () => {
    const applicantId = await insertApplicant("intake_complete", "application-received@example.com");
    await notifyApplicationReceived(admin, applicantId);

    expect(notifyMember).toHaveBeenCalledTimes(1);
    const [call] = vi.mocked(notifyMember).mock.calls;
    expect(call[0].emailHtml).toContain("We'll be in touch within three business days.");
    expect(call[0].dedupKey).toBe(`${applicantId}:application_received`);
    expect(call[0].subject.toLowerCase()).not.toMatch(/dementia|caregiv|support group/);
    expect(call[0].emailHtml.toLowerCase()).not.toMatch(/dementia|caregiv|support group/);
    expect(call[0].smsBody.toLowerCase()).not.toMatch(/dementia|caregiv|support group/);
  });

  it("notifyApplicationReceived sends nothing for an opted-out applicant", async () => {
    const applicantId = await insertApplicant("intake_complete", "opted-out-received@example.com", true);
    await notifyApplicationReceived(admin, applicantId);
    expect(notifyMember).not.toHaveBeenCalled();
  });

  it("notifyCohortAssigned includes the session time in the member's own zone, the join link, and dial-in, no facilitator name, no health information", async () => {
    const applicantId = await insertApplicant("enrolled", "cohort-assigned@example.com");
    await notifyCohortAssigned(admin, applicantId, cohortId);

    expect(notifyMember).toHaveBeenCalledTimes(1);
    const [call] = vi.mocked(notifyMember).mock.calls;
    expect(call[0].emailHtml).toContain("https://zoom.us/j/x3test");
    expect(call[0].emailHtml).toContain("1-800-555-0199");
    expect(call[0].emailHtml).toContain("HST");
    expect(call[0].emailHtml).toMatch(/your time.*for the group/);
    // No facilitator-name placeholder or label leaks through - the gap
    // is real (no name column exists), so this checks the message
    // simply never claims to have a name to give.
    expect(call[0].emailHtml).not.toMatch(/facilitator/i);
    expect(call[0].subject.toLowerCase()).not.toMatch(/dementia|caregiv|support group/);
    expect(call[0].emailHtml.toLowerCase()).not.toMatch(/dementia|caregiv|support group/);
  });

  it("notifyProgramComplete only notifies members whose status is completed, reusing L4's exact on-screen copy", async () => {
    const completedId = await insertApplicant("completed", "program-complete@example.com");
    const stillEnrolledId = await insertApplicant("enrolled", "still-enrolled@example.com");

    await notifyProgramComplete(admin, cohortId, "X3 Test Program");

    expect(notifyMember).toHaveBeenCalledTimes(1);
    const [call] = vi.mocked(notifyMember).mock.calls;
    expect(call[0].applicantId).toBe(completedId);
    expect(call[0].applicantId).not.toBe(stillEnrolledId);
    expect(call[0].emailHtml).toContain("You've completed X3 Test Program.");
    expect(call[0].emailHtml).toContain("There's no other program open for you right now. If that changes, we'll reach out.");
    expect(call[0].emailHtml.toLowerCase()).not.toMatch(/dementia|caregiv|support group/);
  });
});
