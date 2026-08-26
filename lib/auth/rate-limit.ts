import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const HOURLY_LIMIT = 5;
const DAILY_LIMIT = 15;

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryReason: "hourly" | "daily" };

// Per-identifier limit, per the P1 spec ("Max 5 code requests per
// identifier per hour, 15 per day"). This is deliberately separate from
// (and stricter/differently-scoped than) Supabase Auth's own built-in
// rate limits, which are IP-based on a 5-minute window - that stays on as
// defense in depth, this is the actual product requirement.
//
// Only "sent" outcomes count toward the cap; a request that was itself
// refused for being rate-limited doesn't count again, or the 6th request
// would never be distinguishable from the 5th.
export async function checkSignInRateLimit(
  identifier: string,
): Promise<RateLimitResult> {
  const admin = createAdminClient();
  const now = Date.now();

  const { count: hourCount, error: hourError } = await admin
    .from("sign_in_events")
    .select("*", { count: "exact", head: true })
    .eq("identifier", identifier)
    .eq("outcome", "sent")
    .gte("created_at", new Date(now - HOUR_MS).toISOString());

  if (hourError) throw hourError;
  if ((hourCount ?? 0) >= HOURLY_LIMIT) {
    return { allowed: false, retryReason: "hourly" };
  }

  const { count: dayCount, error: dayError } = await admin
    .from("sign_in_events")
    .select("*", { count: "exact", head: true })
    .eq("identifier", identifier)
    .eq("outcome", "sent")
    .gte("created_at", new Date(now - DAY_MS).toISOString());

  if (dayError) throw dayError;
  if ((dayCount ?? 0) >= DAILY_LIMIT) {
    return { allowed: false, retryReason: "daily" };
  }

  return { allowed: true };
}
