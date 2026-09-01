import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { unsubscribeFromNotifications } from "@/lib/referral/unsubscribe";

const admin = createAdminClient();

describe("unsubscribeFromNotifications", () => {
  let orgId: string;
  let applicantId: string;
  let token: string;

  beforeAll(async () => {
    const { data: org, error: orgError } = await admin
      .from("partner_organizations")
      .insert({ name: "Unsubscribe Test Org", referral_link_slug: `unsubscribe-org-${Date.now()}` })
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
        email: "unsubscribe-member@example.com",
      })
      .select("id, notification_unsubscribe_token")
      .single();
    if (applicantError || !applicant) throw applicantError ?? new Error("failed to create applicant");
    applicantId = applicant.id;
    token = applicant.notification_unsubscribe_token;
  });

  afterAll(async () => {
    await admin.from("applicants").delete().eq("id", applicantId);
    await admin.from("partner_organizations").delete().eq("id", orgId);
  });

  it("returns an error for an unknown token, without revealing whether any applicant exists", async () => {
    const result = await unsubscribeFromNotifications("00000000-0000-0000-0000-000000000000");
    expect(result).toEqual({ success: false, error: "This link isn't working." });
  });

  it("sets notifications_opted_out without touching status or cohort_id", async () => {
    const result = await unsubscribeFromNotifications(token);
    expect(result).toEqual({ success: true });

    const { data } = await admin
      .from("applicants")
      .select("notifications_opted_out, status, cohort_id")
      .eq("id", applicantId)
      .single();
    expect(data?.notifications_opted_out).toBe(true);
    expect(data?.status).toBe("enrolled");
    expect(data?.cohort_id).toBeNull();
  });

  it("is idempotent - unsubscribing an already-unsubscribed applicant still succeeds", async () => {
    const result = await unsubscribeFromNotifications(token);
    expect(result).toEqual({ success: true });
  });
});
