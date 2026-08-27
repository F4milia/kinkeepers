import { createHmac } from "node:crypto";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

// Local-only demo secret, identical on every `supabase start` - see
// vitest.config.mts's note on why these aren't sensitive here.
const LOCAL_JWT_SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";

function base64url(input: object): string {
  return Buffer.from(JSON.stringify(input)).toString("base64url");
}

// Mints a JWT GoTrue/PostgREST will accept as a real user session, without
// going through the network OTP round-trip. Any HS256 JWT signed with the
// project's JWT secret and shaped like GoTrue's own tokens is
// indistinguishable from a "real" one to either service - this is exactly
// what makes the shared secret meaningful, and it's the same principle
// pgTAP's `set local role authenticated` leans on at the SQL layer.
export function mintAccessToken(userId: string): string {
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

// A real, usable Supabase client authenticated as the given user - for
// exercising RLS-dependent and requireRole()-guarded code paths from
// tests without a Next.js cookie/request context.
export async function clientForUser(userId: string): Promise<SupabaseClient> {
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
