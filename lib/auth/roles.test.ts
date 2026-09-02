import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserAndRole, ForbiddenError, roleHomePath } from "@/lib/auth/roles";
import { clientForUser } from "@/test/helpers/local-auth";

describe("resolveUserAndRole", () => {
  const admin = createAdminClient();
  let userId: string;

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: `roles-test-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (error || !data.user) throw error ?? new Error("createUser returned no user");
    userId = data.user.id;
  });

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("returns the caller's own id and role (default: member, from the handle_new_user trigger)", async () => {
    const client = await clientForUser(userId);
    const result = await resolveUserAndRole(client);
    expect(result).toEqual({ userId, role: "member" });
  });

  it("returns null for an unauthenticated client", async () => {
    const anonClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const result = await resolveUserAndRole(anonClient);
    expect(result).toBeNull();
  });

  it("cannot resolve a role for a different user's id (RLS: own row only)", async () => {
    // Sanity check that this helper rides on the same RLS boundary the
    // pgTAP suite already proves, not a separate, weaker path.
    const { data: other, error } = await admin.auth.admin.createUser({
      email: `roles-test-other-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (error || !other.user) throw error ?? new Error("createUser returned no user");

    try {
      const clientA = await clientForUser(userId);
      // Directly querying another user's row (bypassing resolveUserAndRole's
      // own auth.uid()-scoped query) should come back empty under RLS.
      const { data } = await clientA
        .from("profiles")
        .select("role")
        .eq("id", other.user.id);
      expect(data).toEqual([]);
    } finally {
      await admin.auth.admin.deleteUser(other.user.id);
    }
  });
});

describe("roleHomePath", () => {
  it("sends a facilitator to /facilitator, not / (which 404s - no applicant row)", () => {
    expect(roleHomePath("facilitator")).toBe("/facilitator");
  });

  it("sends admin and partner_staff to /admin", () => {
    expect(roleHomePath("admin")).toBe("/admin");
    expect(roleHomePath("partner_staff")).toBe("/admin");
  });

  it("sends a member, and a null (unresolved) role, to /", () => {
    expect(roleHomePath("member")).toBe("/");
    expect(roleHomePath(null)).toBe("/");
  });
});

describe("ForbiddenError", () => {
  it("names the actual role and the allowed set in its message", () => {
    const err = new ForbiddenError("member", ["admin", "facilitator"]);
    expect(err.message).toContain("member");
    expect(err.message).toContain("admin");
    expect(err.message).toContain("facilitator");
  });
});
