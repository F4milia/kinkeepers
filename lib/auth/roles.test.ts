import { createHmac } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserAndRole, ForbiddenError } from "@/lib/auth/roles";

// Local-only demo secret, identical on every `supabase start` - see
// vitest.config.mts's note on why these aren't sensitive here.
const LOCAL_JWT_SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";

function base64url(input: object | Buffer): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(JSON.stringify(input));
  return buf.toString("base64url");
}

// Mints a JWT GoTrue/PostgREST will accept as a real user session, without
// going through the network OTP round-trip. Any HS256 JWT signed with the
// project's JWT secret and shaped like GoTrue's own tokens is
// indistinguishable from a "real" one to either service - this is exactly
// what makes the shared secret meaningful, and it's the same principle
// pgTAP's `set local role authenticated` leans on at the SQL layer.
function mintAccessToken(userId: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: userId,
    role: "authenticated",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const unsigned = `${base64url(header)}.${base64url(payload)}`;
  const signature = createHmac("sha256", LOCAL_JWT_SECRET)
    .update(unsigned)
    .digest("base64url");
  return `${unsigned}.${signature}`;
}

async function clientForUser(userId: string) {
  const client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  await client.auth.setSession({
    access_token: mintAccessToken(userId),
    refresh_token: "unused-in-tests",
  });

  return client;
}

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

describe("ForbiddenError", () => {
  it("names the actual role and the allowed set in its message", () => {
    const err = new ForbiddenError("member", ["admin", "facilitator"]);
    expect(err.message).toContain("member");
    expect(err.message).toContain("admin");
    expect(err.message).toContain("facilitator");
  });
});
