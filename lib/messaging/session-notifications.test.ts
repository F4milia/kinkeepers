import { describe, expect, it, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  notifySessionRescheduled,
  notifySessionCancelled,
  notifySessionReminder,
  notifyMissedSession,
} from "@/lib/messaging/session-notifications";
import { notifyMember } from "@/lib/messaging/notify-member";

// getApplicantContact (used by the new notifyMissedSession, below) is
// kept as its REAL implementation via importOriginal - only notifyMember
// itself is mocked, same reasoning as applicant-notifications.test.ts.
vi.mock("@/lib/messaging/notify-member", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/messaging/notify-member")>();
  return { ...actual, notifyMember: vi.fn().mockResolvedValue(undefined) };
});

beforeEach(() => {
  vi.clearAllMocks();
});

const admin = createAdminClient();

describe("session notifications", () => {
  let orgId: string;
  let programId: string;
  let cohortId: string;
  let missedSessionApplicantId: string;
  let missedSessionOptedOutId: string;
  const applicantIds: string[] = [];

  beforeAll(async () => {
    const { data: org, error: orgError } = await admin
      .from("partner_organizations")
      .insert({ name: "Session Notifications Test Org", referral_link_slug: `session-notify-org-${Date.now()}` })
      .select("id")
      .single();
    if (orgError || !org) throw orgError ?? new Error("failed to create org");
    orgId = org.id;

    const { data: program, error: programError } = await admin
      .from("programs")
      .insert({
        name: "Session Notifications Test Program",
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
        name: "Session Notifications Test Cohort",
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

    async function insertApplicant(
      status: string,
      email: string,
      timeZone: string | null = null,
      optedOut = false,
    ) {
      const { data, error } = await admin
        .from("applicants")
        .insert({
          partner_organization_id: orgId,
          referral_source: "partner_link",
          status,
          cohort_id: status === "enrolled" || status === "attending" ? cohortId : null,
          email,
          preferred_contact_channel: "email",
          time_zone: timeZone,
          notifications_opted_out: optedOut,
        })
        .select("id")
        .single();
      if (error || !data) throw error ?? new Error("failed to create applicant");
      applicantIds.push(data.id);
      return data.id;
    }

    await insertApplicant("enrolled", "enrolled-member@example.com", "Pacific/Honolulu");
    await insertApplicant("attending", "attending-member@example.com", null);
    await insertApplicant("declined", "declined-member@example.com");
    await insertApplicant("pending_review", "pending-member@example.com");
    await insertApplicant("enrolled", "opted-out-member@example.com", null, true);

    // notifyMissedSession looks up exactly one known applicant directly -
    // it doesn't query by cohort_id, so these are deliberately NOT
    // associated with cohortId (unlike every fixture above), or they'd
    // also get swept into listEnrolledMembers(cohortId) and inflate the
    // reschedule/cancelled/reminder tests' expected counts above.
    const { data: missedRow, error: missedError } = await admin
      .from("applicants")
      .insert({
        partner_organization_id: orgId,
        referral_source: "partner_link",
        status: "completed",
        email: "missed-session-member@example.com",
        preferred_contact_channel: "email",
      })
      .select("id")
      .single();
    if (missedError || !missedRow) throw missedError ?? new Error("failed to create applicant");
    missedSessionApplicantId = missedRow.id;
    applicantIds.push(missedSessionApplicantId);

    const { data: optedOutRow, error: optedOutError } = await admin
      .from("applicants")
      .insert({
        partner_organization_id: orgId,
        referral_source: "partner_link",
        status: "completed",
        email: "missed-session-opted-out@example.com",
        preferred_contact_channel: "email",
        notifications_opted_out: true,
      })
      .select("id")
      .single();
    if (optedOutError || !optedOutRow) throw optedOutError ?? new Error("failed to create applicant");
    missedSessionOptedOutId = optedOutRow.id;
    applicantIds.push(missedSessionOptedOutId);
  });

  afterAll(async () => {
    await admin.from("applicants").delete().in("id", applicantIds);
    await admin.from("cohorts").delete().eq("id", cohortId);
    await admin.from("programs").delete().eq("id", programId);
    await admin.from("partner_organizations").delete().eq("id", orgId);
  });

  const sessionId = "55555555-0000-0000-0000-00000000f001";

  it("notifySessionRescheduled only notifies enrolled/attending members, not declined, pending, or opted-out ones", async () => {
    await notifySessionRescheduled(
      admin,
      cohortId,
      sessionId,
      new Date("2027-03-09T18:30:00Z"),
      "America/New_York",
      "https://zoom.us/j/1",
    );

    expect(notifyMember).toHaveBeenCalledTimes(2);
    const notifiedEmails = vi.mocked(notifyMember).mock.calls.map((call) => call[0].contact.email);
    expect(notifiedEmails).toContain("enrolled-member@example.com");
    expect(notifiedEmails).toContain("attending-member@example.com");
    expect(notifiedEmails).not.toContain("declined-member@example.com");
    expect(notifiedEmails).not.toContain("pending-member@example.com");
    expect(notifiedEmails).not.toContain("opted-out-member@example.com");
  });

  it("notifySessionRescheduled includes the new time, join link, and an unsubscribe link, never health information", async () => {
    await notifySessionRescheduled(
      admin,
      cohortId,
      sessionId,
      new Date("2027-03-09T18:30:00Z"),
      "America/New_York",
      "https://zoom.us/j/1",
    );

    const [call] = vi.mocked(notifyMember).mock.calls;
    expect(call[0].emailHtml).toContain("https://zoom.us/j/1");
    expect(call[0].emailHtml).toContain("/unsubscribe/");
    expect(call[0].dedupKey).toContain(sessionId);
    expect(call[0].subject.toLowerCase()).not.toMatch(/dementia|caregiv|support group/);
    expect(call[0].emailHtml.toLowerCase()).not.toMatch(/dementia|caregiv|support group/);
    expect(call[0].smsBody.toLowerCase()).not.toMatch(/dementia|caregiv|support group/);
  });

  it("a reschedule to a different time produces a different dedupKey than a previous reschedule of the same session", async () => {
    await notifySessionRescheduled(
      admin,
      cohortId,
      sessionId,
      new Date("2027-03-09T18:30:00Z"),
      "America/New_York",
      null,
    );
    const firstKey = vi.mocked(notifyMember).mock.calls[0][0].dedupKey;

    vi.clearAllMocks();
    await notifySessionRescheduled(
      admin,
      cohortId,
      sessionId,
      new Date("2027-03-16T18:30:00Z"),
      "America/New_York",
      null,
    );
    const secondKey = vi.mocked(notifyMember).mock.calls[0][0].dedupKey;

    expect(firstKey).not.toBe(secondKey);
  });

  it("named edge case: a member in Honolulu, cohort in Eastern, gets both zones - not just the cohort's", async () => {
    // Mid-March, before the US DST change - matches the winter case
    // already named in cohort-meeting-time.test.ts's own edge case.
    await notifySessionRescheduled(
      admin,
      cohortId,
      sessionId,
      new Date("2027-03-09T18:30:00Z"),
      "America/New_York",
      null,
    );

    const calls = vi.mocked(notifyMember).mock.calls;
    const honoluluCall = calls.find((call) => call[0].contact.email === "enrolled-member@example.com")!;
    expect(honoluluCall[0].emailHtml).toContain("HST");
    expect(honoluluCall[0].emailHtml).toContain("EST");
    expect(honoluluCall[0].emailHtml).toMatch(/your time.*for the group/);

    const noZoneCall = calls.find((call) => call[0].contact.email === "attending-member@example.com")!;
    expect(noZoneCall[0].emailHtml).toContain("EST");
    expect(noZoneCall[0].emailHtml).not.toContain("HST");
    expect(noZoneCall[0].emailHtml).not.toMatch(/your time/);
  });

  it("notifySessionCancelled only notifies enrolled/attending members and never mentions dementia/caregiving", async () => {
    await notifySessionCancelled(admin, cohortId, sessionId, new Date("2027-03-09T18:30:00Z"), "America/New_York");

    expect(notifyMember).toHaveBeenCalledTimes(2);
    const [call] = vi.mocked(notifyMember).mock.calls;
    expect(call[0].dedupKey).toContain(sessionId);
    expect(call[0].subject.toLowerCase()).not.toMatch(/dementia|caregiv|support group/);
    expect(call[0].emailHtml.toLowerCase()).not.toMatch(/dementia|caregiv|support group/);
  });

  it("notifySessionReminder (24h) only notifies enrolled/attending members and states the run doc's own hours label", async () => {
    await notifySessionReminder(
      admin,
      cohortId,
      sessionId,
      new Date("2027-03-09T18:30:00Z"),
      "America/New_York",
      "https://zoom.us/j/2",
      "24h",
    );

    expect(notifyMember).toHaveBeenCalledTimes(2);
    const notifiedEmails = vi.mocked(notifyMember).mock.calls.map((call) => call[0].contact.email);
    expect(notifiedEmails).toContain("enrolled-member@example.com");
    expect(notifiedEmails).toContain("attending-member@example.com");
    expect(notifiedEmails).not.toContain("opted-out-member@example.com");

    const [call] = vi.mocked(notifyMember).mock.calls;
    expect(call[0].emailHtml).toContain("24 hours");
    expect(call[0].emailHtml).toContain("https://zoom.us/j/2");
    expect(call[0].emailHtml).toContain("/unsubscribe/");
    expect(call[0].subject.toLowerCase()).not.toMatch(/dementia|caregiv|support group/);
    expect(call[0].emailHtml.toLowerCase()).not.toMatch(/dementia|caregiv|support group/);
  });

  it("notifySessionReminder (1h) uses the run doc's own sample wording", async () => {
    await notifySessionReminder(
      admin,
      cohortId,
      sessionId,
      new Date("2027-03-09T18:30:00Z"),
      "America/New_York",
      "https://zoom.us/j/2",
      "1h",
    );

    const [call] = vi.mocked(notifyMember).mock.calls;
    expect(call[0].emailHtml).toContain("starts in 1 hour");
    expect(call[0].smsBody).toContain("starts in 1 hour");
  });

  it("24h and 1h reminders for the same session use different dedup keys, so both can independently fire", async () => {
    await notifySessionReminder(admin, cohortId, sessionId, new Date("2027-03-09T18:30:00Z"), "America/New_York", null, "24h");
    const key24h = vi.mocked(notifyMember).mock.calls[0][0].dedupKey;

    vi.clearAllMocks();
    await notifySessionReminder(admin, cohortId, sessionId, new Date("2027-03-09T18:30:00Z"), "America/New_York", null, "1h");
    const key1h = vi.mocked(notifyMember).mock.calls[0][0].dedupKey;

    expect(key24h).not.toBe(key1h);
  });

  it("a reminder for a rescheduled session's new time produces a different dedupKey than the old time", async () => {
    await notifySessionReminder(admin, cohortId, sessionId, new Date("2027-03-09T18:30:00Z"), "America/New_York", null, "24h");
    const originalKey = vi.mocked(notifyMember).mock.calls[0][0].dedupKey;

    vi.clearAllMocks();
    await notifySessionReminder(admin, cohortId, sessionId, new Date("2027-03-16T18:30:00Z"), "America/New_York", null, "24h");
    const rescheduledKey = vi.mocked(notifyMember).mock.calls[0][0].dedupKey;

    expect(originalKey).not.toBe(rescheduledKey);
  });

  it("notifyMissedSession sends only to the one given applicant, with the run doc's own exact wording and no guilt/urgency", async () => {
    await notifyMissedSession(
      admin,
      missedSessionApplicantId,
      sessionId,
      cohortId,
      new Date("2027-03-09T18:30:00Z"), // a Tuesday
      "America/New_York",
    );

    expect(notifyMember).toHaveBeenCalledTimes(1);
    const [call] = vi.mocked(notifyMember).mock.calls;
    expect(call[0].contact.email).toBe("missed-session-member@example.com");
    expect(call[0].emailHtml).toContain("We missed you Tuesday");
    expect(call[0].emailHtml).toContain("The group meets again next week at the same time");
    expect(call[0].dedupKey).toContain(sessionId);
    expect(call[0].dedupKey).toContain(missedSessionApplicantId);
    expect(call[0].emailHtml.toLowerCase()).not.toMatch(/dementia|caregiv|support group|streak|engag/);
    expect(call[0].emailHtml).not.toMatch(/\?/); // no question demanding a reply
  });

  it("notifyMissedSession does not send to an opted-out applicant", async () => {
    await notifyMissedSession(
      admin,
      missedSessionOptedOutId,
      sessionId,
      cohortId,
      new Date("2027-03-09T18:30:00Z"),
      "America/New_York",
    );

    expect(notifyMember).not.toHaveBeenCalled();
  });
});
