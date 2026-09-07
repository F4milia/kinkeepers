import { describe, expect, it, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyMember, type MemberContact } from "@/lib/messaging/notify-member";
import { sendEmail } from "@/lib/messaging/send-email";
import { sendSms } from "@/lib/messaging/send-sms";

vi.mock("@/lib/messaging/send-email", () => ({ sendEmail: vi.fn().mockResolvedValue({ sent: true }) }));
vi.mock("@/lib/messaging/send-sms", () => ({ sendSms: vi.fn().mockResolvedValue({ sent: true }) }));

beforeEach(() => {
  vi.clearAllMocks();
});

const admin = createAdminClient();

const baseParams = {
  admin,
  applicantId: "",
  notificationType: "test_notification",
  subject: "Subject",
  emailHtml: "<p>Body</p>",
  smsBody: "Body",
  logContext: {},
};

function contact(overrides: Partial<MemberContact> = {}): MemberContact {
  return { email: "member@example.com", phone: "+15551234567", preferredContactChannel: null, ...overrides };
}

describe("notifyMember", () => {
  let orgId: string;
  const applicantIds: string[] = [];

  beforeAll(async () => {
    const { data: org, error: orgError } = await admin
      .from("partner_organizations")
      .insert({ name: "Notify Member Test Org", referral_link_slug: `notify-member-org-${Date.now()}` })
      .select("id")
      .single();
    if (orgError || !org) throw orgError ?? new Error("failed to create org");
    orgId = org.id;
  });

  afterAll(async () => {
    await admin.from("notification_log").delete().in("applicant_id", applicantIds);
    await admin.from("applicants").delete().in("id", applicantIds);
    await admin.from("partner_organizations").delete().eq("id", orgId);
  });

  async function insertApplicant() {
    const { data, error } = await admin
      .from("applicants")
      .insert({ partner_organization_id: orgId, referral_source: "partner_link", status: "enrolled" })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("failed to create applicant");
    applicantIds.push(data.id);
    return data.id;
  }

  // 2026-09-05 P4-pre acceptance audit: this used to assert "email only"
  // for a null preference, matching notifyMember's own then-comment - but
  // that directly contradicted P4-pre's own spec ("Channel: email, SMS,
  // or both. Default both.") and P4's own body text ("Default to both
  // for the first cohort"). The DB column is now `not null default
  // 'both'` (20260905140000_default_contact_channel_both.sql), so null
  // shouldn't occur in practice - this test exercises the defensive
  // fallback directly and confirms it now matches the documented default
  // instead of silently diverging from it.
  it("defaults to both channels when no preference was ever recorded", async () => {
    const applicantId = await insertApplicant();
    await notifyMember({
      ...baseParams,
      applicantId,
      dedupKey: `dedup-${applicantId}-1`,
      contact: contact({ preferredContactChannel: null }),
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendSms).toHaveBeenCalledTimes(1);
  });

  it("sends both when the preference is 'both', recording one notification_log row per channel", async () => {
    const applicantId = await insertApplicant();
    const dedupKey = `dedup-${applicantId}-both`;
    await notifyMember({ ...baseParams, applicantId, dedupKey, contact: contact({ preferredContactChannel: "both" }) });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendSms).toHaveBeenCalledTimes(1);

    const { data: rows } = await admin.from("notification_log").select("channel, status").eq("dedup_key", dedupKey);
    expect(rows).toHaveLength(2);
    expect(rows?.map((r) => r.channel).sort()).toEqual(["email", "sms"]);
    expect(rows?.every((r) => r.status === "sent")).toBe(true);
  });

  it("named edge case: preference is 'sms' but no phone is on file - degrades to nothing sent, no log row written", async () => {
    const applicantId = await insertApplicant();
    const dedupKey = `dedup-${applicantId}-no-phone`;
    await notifyMember({
      ...baseParams,
      applicantId,
      dedupKey,
      contact: contact({ preferredContactChannel: "sms", phone: null }),
    });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();

    const { data: rows } = await admin.from("notification_log").select("id").eq("dedup_key", dedupKey);
    expect(rows).toEqual([]);
  });

  it("records a failed send as status 'failed', not 'sent'", async () => {
    vi.mocked(sendEmail).mockResolvedValueOnce({ sent: false, error: "Resend rejected the request" });
    const applicantId = await insertApplicant();
    const dedupKey = `dedup-${applicantId}-failed`;
    await notifyMember({ ...baseParams, applicantId, dedupKey, contact: contact({ preferredContactChannel: "email" }) });

    const { data: row } = await admin
      .from("notification_log")
      .select("status")
      .eq("dedup_key", dedupKey)
      .single();
    expect(row?.status).toBe("failed");
  });

  // 2026-09-08 A5 acceptance audit: error_message existed as a real
  // column since P4's own migration but was never populated - sendEmail/
  // sendSms discarded the real failure reason right after logging it.
  it("records the real failure reason in error_message, not just a status", async () => {
    vi.mocked(sendEmail).mockResolvedValueOnce({ sent: false, error: "Resend rejected the request" });
    const applicantId = await insertApplicant();
    const dedupKey = `dedup-${applicantId}-error-message`;
    await notifyMember({ ...baseParams, applicantId, dedupKey, contact: contact({ preferredContactChannel: "email" }) });

    const { data: row } = await admin
      .from("notification_log")
      .select("error_message")
      .eq("dedup_key", dedupKey)
      .single();
    expect(row?.error_message).toBe("Resend rejected the request");
  });

  it("a successful send leaves error_message null", async () => {
    const applicantId = await insertApplicant();
    const dedupKey = `dedup-${applicantId}-no-error`;
    await notifyMember({ ...baseParams, applicantId, dedupKey, contact: contact({ preferredContactChannel: "email" }) });

    const { data: row } = await admin
      .from("notification_log")
      .select("error_message")
      .eq("dedup_key", dedupKey)
      .single();
    expect(row?.error_message).toBeNull();
  });

  // 2026-09-08 A5 acceptance audit: session_id (20260908100000) - a
  // per-applicant lifecycle notification (X3's own messages, this file's
  // own baseParams shape) has no session to attach, and must leave the
  // column null rather than guessing one - see session-reminders.test.ts
  // for the positive case, where a REAL session id flows all the way
  // through from a real session-scoped call.
  it("leaves session_id null when the caller has no session to attach (a per-applicant lifecycle notification)", async () => {
    const applicantId = await insertApplicant();
    const dedupKey = `dedup-${applicantId}-no-session`;
    await notifyMember({
      ...baseParams,
      applicantId,
      dedupKey,
      contact: contact({ preferredContactChannel: "email" }),
    });

    const { data: row } = await admin
      .from("notification_log")
      .select("session_id")
      .eq("dedup_key", dedupKey)
      .single();
    expect(row?.session_id).toBeNull();
  });

  it("a second call with the same dedupKey does not send again - the unique index rejects the duplicate claim", async () => {
    const applicantId = await insertApplicant();
    const dedupKey = `dedup-${applicantId}-duplicate`;
    const params = { ...baseParams, applicantId, dedupKey, contact: contact({ preferredContactChannel: "email" as const }) };

    await notifyMember(params);
    await notifyMember(params);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const { data: rows } = await admin.from("notification_log").select("id").eq("dedup_key", dedupKey);
    expect(rows).toHaveLength(1);
  });
});
