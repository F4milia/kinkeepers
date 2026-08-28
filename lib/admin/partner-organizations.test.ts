import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { ForbiddenError } from "@/lib/auth/roles";
import { clientForUser } from "@/test/helpers/local-auth";
import {
  listPartnerOrganizations,
  getPartnerOrganization,
  createPartnerOrganizationAction,
  updatePartnerOrganizationAction,
  type PartnerOrganizationFormState,
} from "@/lib/admin/partner-organizations";

// redirect()/revalidatePath() are only meaningful inside a real Next.js
// App Router request - outside it (here, calling the action directly)
// revalidatePath throws its own "static generation store missing"
// invariant before redirect is ever reached. Mocked so the action's real
// logic (the RPC call, the DB write) runs to completion and can be
// asserted on directly, same as any other Next.js Server Action test.
const redirectMock = vi.fn();
vi.mock("next/navigation", () => ({ redirect: (path: string) => redirectMock(path) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const admin = createAdminClient();
const IDLE_STATE: PartnerOrganizationFormState = { status: "idle", fieldErrors: {} };
const TEST_SLUG = `pgtest-crud-org-${Date.now()}`;

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("admin partner organization CRUD", () => {
  let adminUser: { id: string };
  let memberUser: { id: string };
  const createdIds: string[] = [];

  beforeAll(async () => {
    const { data: adminData, error: adminError } = await admin.auth.admin.createUser({
      email: `partner-org-admin-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (adminError || !adminData.user) throw adminError ?? new Error("createUser failed");
    adminUser = adminData.user;
    await admin.from("profiles").update({ role: "admin" }).eq("id", adminUser.id);

    const { data: memberData, error: memberError } = await admin.auth.admin.createUser({
      email: `partner-org-member-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (memberError || !memberData.user) throw memberError ?? new Error("createUser failed");
    memberUser = memberData.user;
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await admin.from("partner_organizations").delete().in("id", createdIds);
    }
    await admin.auth.admin.deleteUser(memberUser.id);
    // adminUser is NOT deleted - same reasoning as
    // admin-issue-sign-in-link.test.ts: this suite makes adminUser a
    // real audit_log actor, and audit_log.actor_id -> profiles(id) has
    // no ON DELETE behavior (RESTRICT), so that profile can never be
    // hard-deleted once it's acted as an actor.
  });

  it("rejects a non-admin caller before touching anything", async () => {
    const memberClient = await clientForUser(memberUser.id);
    await expect(listPartnerOrganizations(memberClient)).rejects.toThrow(ForbiddenError);
    await expect(getPartnerOrganization("00000000-0000-0000-0000-000000000000", memberClient)).rejects.toThrow(
      ForbiddenError,
    );
    await expect(
      createPartnerOrganizationAction(
        IDLE_STATE,
        formData({ name: "Nope", referralLinkSlug: "nope-org", status: "active" }),
        memberClient,
      ),
    ).rejects.toThrow(ForbiddenError);
  });

  it("rejects a slug that doesn't match the allowed character set", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const result = await createPartnerOrganizationAction(
      IDLE_STATE,
      formData({ name: "Bad Slug Org", referralLinkSlug: "Not Valid!", status: "active" }),
      adminClient,
    );
    expect(result.fieldErrors.referralLinkSlug).toBeTruthy();

    const { data } = await admin.from("partner_organizations").select("id").eq("name", "Bad Slug Org");
    expect(data).toEqual([]);
  });

  it("creates a partner organization, writes a matching audit_log row, and redirects", async () => {
    const adminClient = await clientForUser(adminUser.id);
    redirectMock.mockClear();

    await createPartnerOrganizationAction(
      IDLE_STATE,
      formData({
        name: "pgTAP Vitest Org",
        referralLinkSlug: TEST_SLUG,
        status: "active",
        contractStart: "2026-01-01",
      }),
      adminClient,
    );
    expect(redirectMock).toHaveBeenCalledWith("/admin/partners");

    const { data: created } = await admin
      .from("partner_organizations")
      .select("*")
      .eq("referral_link_slug", TEST_SLUG)
      .single();
    expect(created).toMatchObject({ name: "pgTAP Vitest Org", status: "active" });
    createdIds.push(created!.id);

    const { data: auditRows } = await admin
      .from("audit_log")
      .select("*")
      .eq("subject_id", created!.id)
      .eq("action", "partner_organization_created");
    expect(auditRows).toHaveLength(1);
    expect(auditRows![0].actor_id).toBe(adminUser.id);
  });

  it("updates a partner organization via getPartnerOrganization + updatePartnerOrganizationAction, and writes its own audit row", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const { data: existing } = await admin
      .from("partner_organizations")
      .select("id")
      .eq("referral_link_slug", TEST_SLUG)
      .single();

    const fetched = await getPartnerOrganization(existing!.id, adminClient);
    expect(fetched?.name).toBe("pgTAP Vitest Org");

    redirectMock.mockClear();
    await updatePartnerOrganizationAction(
      existing!.id,
      IDLE_STATE,
      formData({
        name: "pgTAP Vitest Org (renamed)",
        referralLinkSlug: TEST_SLUG,
        status: "inactive",
      }),
      adminClient,
    );
    expect(redirectMock).toHaveBeenCalledWith("/admin/partners");

    const { data: updated } = await admin
      .from("partner_organizations")
      .select("*")
      .eq("id", existing!.id)
      .single();
    expect(updated).toMatchObject({ name: "pgTAP Vitest Org (renamed)", status: "inactive" });

    const { data: auditRows } = await admin
      .from("audit_log")
      .select("*")
      .eq("subject_id", existing!.id)
      .eq("action", "partner_organization_updated");
    expect(auditRows).toHaveLength(1);
  });

  it("surfaces a duplicate referral link slug as a field error instead of a 500", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const result = await createPartnerOrganizationAction(
      IDLE_STATE,
      formData({ name: "Duplicate Slug Org", referralLinkSlug: TEST_SLUG, status: "active" }),
      adminClient,
    );
    expect(result.status).toBe("error");
    expect(result.fieldErrors.referralLinkSlug).toContain("already in use");

    const { data } = await admin.from("partner_organizations").select("id").eq("name", "Duplicate Slug Org");
    expect(data).toEqual([]);
  });

  it("getPartnerOrganization returns null for a nonexistent id rather than throwing", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const result = await getPartnerOrganization("00000000-0000-0000-0000-000000000000", adminClient);
    expect(result).toBeNull();
  });
});
