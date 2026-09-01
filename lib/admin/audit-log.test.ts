import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { ForbiddenError } from "@/lib/auth/roles";
import { clientForUser } from "@/test/helpers/local-auth";
import { listAuditLog } from "@/lib/admin/audit-log";
import { labelForAction } from "@/lib/admin/audit-action-labels";

const admin = createAdminClient();

describe("labelForAction", () => {
  it("returns a known plain-English label", () => {
    expect(labelForAction("session_rescheduled")).toBe("Session rescheduled");
  });

  it("falls back to a de-slugged version of an unrecognized action, never the raw enum string alone", () => {
    expect(labelForAction("some_future_action")).toBe("some future action");
  });
});

describe("listAuditLog", () => {
  let adminUser: { id: string; email?: string };
  let memberUser: { id: string; email?: string };
  let orgId: string;
  const auditIds: number[] = [];

  beforeAll(async () => {
    const { data: adminData, error: adminError } = await admin.auth.admin.createUser({
      email: `audit-log-admin-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (adminError || !adminData.user) throw adminError ?? new Error("createUser failed");
    adminUser = adminData.user;
    await admin.from("profiles").update({ role: "admin" }).eq("id", adminUser.id);

    const { data: memberData, error: memberError } = await admin.auth.admin.createUser({
      email: `audit-log-member-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (memberError || !memberData.user) throw memberError ?? new Error("createUser failed");
    memberUser = memberData.user;

    const { data: org, error: orgError } = await admin
      .from("partner_organizations")
      .insert({ name: "Audit Log Test Org", referral_link_slug: `audit-log-org-${Date.now()}` })
      .select("id")
      .single();
    if (orgError || !org) throw orgError ?? new Error("failed to create org");
    orgId = org.id;

    const { data: row, error: auditError } = await admin
      .from("audit_log")
      .insert({
        actor_id: adminUser.id,
        action: "partner_organization_created",
        subject_type: "partner_organization",
        subject_id: orgId,
        metadata: { name: "Audit Log Test Org" },
      })
      .select("id")
      .single();
    if (auditError || !row) throw auditError ?? new Error("failed to create audit row");
    auditIds.push(row.id);
  });

  afterAll(async () => {
    await admin.from("audit_log").delete().in("id", auditIds);
    await admin.from("partner_organizations").delete().eq("id", orgId);
    await admin.auth.admin.deleteUser(memberUser.id);
    await admin.auth.admin.deleteUser(adminUser.id);
  });

  it("rejects a non-admin caller", async () => {
    const memberClient = await clientForUser(memberUser.id);
    await expect(listAuditLog({}, memberClient)).rejects.toThrow(ForbiddenError);
  });

  it("resolves the actor's email and a plain-English action label", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const entries = await listAuditLog({}, adminClient);

    const found = entries.find((e) => e.subjectId === orgId);
    expect(found).toBeTruthy();
    expect(found?.actorEmail).toBe(adminUser.email);
    expect(found?.actionLabel).toBe("Partner organization created");
  });

  it("filters by subjectType", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const matching = await listAuditLog({ subjectType: "partner_organization" }, adminClient);
    const nonMatching = await listAuditLog({ subjectType: "session" }, adminClient);

    expect(matching.some((e) => e.subjectId === orgId)).toBe(true);
    expect(nonMatching.some((e) => e.subjectId === orgId)).toBe(false);
  });

  it("filters by action", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const matching = await listAuditLog({ action: "partner_organization_created" }, adminClient);
    const nonMatching = await listAuditLog({ action: "cohort_created" }, adminClient);

    expect(matching.some((e) => e.subjectId === orgId)).toBe(true);
    expect(nonMatching.some((e) => e.subjectId === orgId)).toBe(false);
  });
});
