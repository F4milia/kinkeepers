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

  // 2026-09-08 A5 acceptance audit: these three real audit_action values
  // (facilitator_certified, applicant_withdrawn added the same day as
  // their own migrations; session_log_submitted, X4's real
  // attendance-write action) had no label at all until this pass, always
  // falling back to a raw de-slugged name instead of plain English.
  it("has a real label for every non-dead audit_action value added since the original list", () => {
    expect(labelForAction("facilitator_certified")).toBe("Facilitator certified");
    expect(labelForAction("applicant_withdrawn")).toBe("Applicant withdrawn");
    expect(labelForAction("session_log_submitted")).toBe("Session log submitted");
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

  // 2026-09-08 A5 acceptance audit: metadata was never selected at all
  // before this pass - an attendance correction's before/after values
  // were provably written (X4's submit_session_log()) but structurally
  // unreachable by this function, so the admin UI could never show them.
  it("returns the row's own metadata", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const entries = await listAuditLog({}, adminClient);

    const found = entries.find((e) => e.subjectId === orgId);
    expect(found?.metadata).toEqual({ name: "Audit Log Test Org" });
  });

  it("filters by actorEmail, a partial case-insensitive match", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const needle = adminUser.email!.slice(0, 10).toUpperCase();

    const matching = await listAuditLog({ actorEmail: needle }, adminClient);
    const nonMatching = await listAuditLog({ actorEmail: "definitely-nobody-real" }, adminClient);

    expect(matching.some((e) => e.subjectId === orgId)).toBe(true);
    expect(nonMatching).toEqual([]);
  });

  it("filters by a startDate/endDate range", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

    const withinRange = await listAuditLog({ startDate: yesterday, endDate: tomorrow }, adminClient);
    const beforeToday = await listAuditLog({ startDate: yesterday, endDate: yesterday }, adminClient);
    const afterToday = await listAuditLog({ startDate: tomorrow, endDate: tomorrow }, adminClient);

    expect(withinRange.some((e) => e.subjectId === orgId)).toBe(true);
    expect(beforeToday.some((e) => e.subjectId === orgId)).toBe(false);
    expect(afterToday.some((e) => e.subjectId === orgId)).toBe(false);
  });
});
