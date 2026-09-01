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

    const { data: rows, error: logError } = await admin
      .from("notification_log")
      .insert([
        { applicant_id: applicantId, notification_type: "session_rescheduled", channel: "email", status: "failed", dedup_key: `fail-${Date.now()}-1` },
        { applicant_id: applicantId, notification_type: "session_cancelled", channel: "sms", status: "sent", dedup_key: `fail-${Date.now()}-2` },
      ])
      .select("id");
    if (logError || !rows) throw logError ?? new Error("failed to create notification_log rows");
    logIds.push(...rows.map((r) => r.id));
  });

  afterAll(async () => {
    await admin.from("notification_log").delete().in("id", logIds);
    await admin.from("applicants").delete().eq("id", applicantId);
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
});
