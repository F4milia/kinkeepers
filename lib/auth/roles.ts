import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "facilitator" | "partner_staff" | "member";

export class UnauthenticatedError extends Error {
  constructor() {
    super("No signed-in user");
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends Error {
  constructor(role: AppRole, allowed: AppRole[]) {
    super(`Role "${role}" is not in the allowed set: ${allowed.join(", ")}`);
    this.name = "ForbiddenError";
  }
}

// Client-agnostic core, so this is testable against a real authenticated
// client without needing a Next.js cookie/request context (which
// lib/supabase/server.ts's createClient() requires and a plain test
// runner can't provide). The exported functions below are what routes
// actually call; this is exported only for lib/auth/roles.test.ts.
export async function resolveUserAndRole(
  supabase: SupabaseClient,
): Promise<{ userId: string; role: AppRole } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;

  return { userId: user.id, role: data.role as AppRole };
}

// The one place role is read from. Always the database, via a query that
// (per profiles' RLS policy) can only ever return the caller's own row -
// never a client-supplied claim. Returns null for a signed-out visitor;
// callers decide what to do about that (redirect, 401, etc.) since P1
// doesn't own any route's failure UX.
export async function getCurrentRole(): Promise<AppRole | null> {
  const supabase = await createClient();
  const result = await resolveUserAndRole(supabase);
  return result?.role ?? null;
}

// Guard for Server Components/Actions/Route Handlers. Throws rather than
// redirecting or rendering a fallback itself - a 403 page, a redirect to
// /sign-in, and a 404-to-avoid-leaking-existence are all legitimate
// choices depending on the route, and that decision belongs to whichever
// session builds that route (A1's admin shell, A2's review queue, etc.),
// not to this shared primitive.
//
// `client` is optional and exists for testability (same reasoning as
// resolveUserAndRole above) - real callers never pass it and get the
// cookie-bound request client.
export async function requireRole(
  allowed: AppRole[],
  client?: SupabaseClient,
): Promise<{
  userId: string;
  role: AppRole;
}> {
  const supabase = client ?? (await createClient());
  const result = await resolveUserAndRole(supabase);
  if (!result) throw new UnauthenticatedError();

  if (!allowed.includes(result.role)) {
    throw new ForbiddenError(result.role, allowed);
  }

  return result;
}
