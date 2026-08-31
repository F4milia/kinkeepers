import type { ReactElement } from "react";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRoleOrRefuse } from "@/lib/admin/require-role-or-refuse";
import { AccessRefused } from "@/components/admin/access-refused";
import { clientForUser } from "@/test/helpers/local-auth";

function refusalReason(refusal: ReactElement): string {
  return (refusal as ReactElement<{ reason: string }>).props.reason;
}

// requireRoleOrRefuse is the actual mechanism behind A1's acceptance
// criterion ("direct URL access to an unpermitted route returns a
// refusal, not a blank page") for every /admin/* page whose allowed set
// is narrower than app/admin/layout.tsx's - /admin/reports,
// /admin/data-requests, /admin/partners, /admin/partners/new,
// /admin/partners/[id]/edit. This
// had zero direct test coverage before this PR, even though every page
// using it did. requireRole() itself (the underlying role resolution) is
// already covered by lib/auth/roles.test.ts; this suite is specifically
// about the catch-and-refuse composition on top of it, and about which
// concrete refusal (signed_out vs wrong_role) each real failure mode
// produces.
describe("requireRoleOrRefuse", () => {
  const admin = createAdminClient();
  let adminUser: { id: string };
  let memberUser: { id: string };

  beforeAll(async () => {
    const { data: adminData, error: adminError } = await admin.auth.admin.createUser({
      email: `access-refuse-admin-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (adminError || !adminData.user) throw adminError ?? new Error("createUser failed");
    adminUser = adminData.user;
    await admin.from("profiles").update({ role: "admin" }).eq("id", adminUser.id);

    const { data: memberData, error: memberError } = await admin.auth.admin.createUser({
      email: `access-refuse-member-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (memberError || !memberData.user) throw memberError ?? new Error("createUser failed");
    memberUser = memberData.user;
  });

  afterAll(async () => {
    await admin.auth.admin.deleteUser(memberUser.id);
    await admin.auth.admin.deleteUser(adminUser.id);
  });

  it("resolves the role for a caller within the allowed set - no refusal", async () => {
    const adminClient = await clientForUser(adminUser.id);
    const result = await requireRoleOrRefuse(["admin"], adminClient);
    expect("role" in result && result.role).toBe("admin");
  });

  it("returns a wrong_role refusal for a signed-in caller outside the allowed set", async () => {
    const memberClient = await clientForUser(memberUser.id);
    const result = await requireRoleOrRefuse(["admin"], memberClient);
    if (!("refusal" in result)) throw new Error("expected a refusal");
    expect(result.refusal.type).toBe(AccessRefused);
    expect(refusalReason(result.refusal)).toBe("wrong_role");
  });

  it("returns a signed_out refusal for an unauthenticated caller", async () => {
    const anonClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const result = await requireRoleOrRefuse(["admin"], anonClient);
    if (!("refusal" in result)) throw new Error("expected a refusal");
    expect(result.refusal.type).toBe(AccessRefused);
    expect(refusalReason(result.refusal)).toBe("signed_out");
  });

  it("a facilitator is refused on an admin-only route but would be admitted on a wider one", async () => {
    const { error } = await admin.from("profiles").update({ role: "facilitator" }).eq("id", memberUser.id);
    if (error) throw error;
    const facilitatorClient = await clientForUser(memberUser.id);

    const narrow = await requireRoleOrRefuse(["admin"], facilitatorClient);
    if (!("refusal" in narrow)) throw new Error("expected a refusal");
    expect(refusalReason(narrow.refusal)).toBe("wrong_role");

    const wide = await requireRoleOrRefuse(["admin", "facilitator", "partner_staff"], facilitatorClient);
    expect("role" in wide && wide.role).toBe("facilitator");
  });
});
