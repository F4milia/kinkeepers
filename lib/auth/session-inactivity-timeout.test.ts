import { Client } from "pg";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";

// Verifies the actual configured behavior behind the P1 acceptance
// criterion "session survives a 30-day gap" - not just that
// sessions_inactivity_timeout is set to 90 days (confirmed separately via
// the Management API when P1 PR3 configured it), but that GoTrue actually
// honors it: a session inactive for 30 days still refreshes, and one
// inactive past 90 days does not.
//
// auth.sessions isn't reachable through PostgREST at all (by design - the
// Data API only exposes the public schema), so this is the one test in
// the repo that connects to Postgres directly rather than through a
// Supabase client.
const admin = createAdminClient();

describe("session inactivity timeout (90 days, configured in P1 PR3)", () => {
  let userId: string;
  let userEmail: string;
  let refreshToken: string;
  let sessionId: string;
  let db: Client;

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: `session-gap-test-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (error || !data.user) throw error ?? new Error("createUser returned no user");
    userId = data.user.id;
    userEmail = data.user.email!;

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: userEmail,
    });
    if (linkError || !linkData) throw linkError ?? new Error("generateLink failed");

    const anonClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { data: verifyData, error: verifyError } = await anonClient.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "magiclink",
    });
    if (verifyError || !verifyData.session) {
      throw verifyError ?? new Error("verifyOtp returned no session");
    }
    refreshToken = verifyData.session.refresh_token;

    db = new Client({ connectionString: process.env.LOCAL_DATABASE_URL });
    await db.connect();

    const { rows } = await db.query(
      "select id from auth.sessions where user_id = $1 order by created_at desc limit 1",
      [userId],
    );
    if (!rows[0]) throw new Error("no auth.sessions row found for the new session");
    sessionId = rows[0].id;
  });

  afterAll(async () => {
    await db?.end();
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("refreshes successfully after a 30-day gap (inside the 90-day window)", async () => {
    await db.query(
      "update auth.sessions set refreshed_at = now() - interval '30 days' where id = $1",
      [sessionId],
    );

    const client = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });

    expect(error).toBeNull();
    expect(data.session).not.toBeNull();
    expect(data.user?.id).toBe(userId);

    // refreshSession() rotates the token - later tests in this file need
    // the new one, not the one that was just spent.
    refreshToken = data.session!.refresh_token;
  });

  it("is refused after inactivity beyond the 90-day window", async () => {
    await db.query(
      "update auth.sessions set refreshed_at = now() - interval '91 days' where id = $1",
      [sessionId],
    );

    const client = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });

    expect(error).not.toBeNull();
    expect(data.session).toBeNull();
  });
});
