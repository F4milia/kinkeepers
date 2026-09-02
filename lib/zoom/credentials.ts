import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDefaultZoomCredentials, type ZoomCredentials } from "@/lib/zoom/client";

export type ZoomProvider = "kinkeepers" | "partner";

export interface ResolvedZoomCredentials {
  credentials: ZoomCredentials;
  provider: ZoomProvider;
}

/**
 * P3: "a cohort may carry its own Zoom credentials" - resolved by the
 * cohort's partner_organization_id, not its own id (see the migration's
 * own comment on why: a cohort's id doesn't exist yet at the point these
 * credentials are needed, but its partner does). Falls back to the
 * default (KinKeepers-owned) account when the cohort has no partner, or
 * that partner has never had credentials provisioned - the common case
 * today, since no real partner needs their own instance yet.
 *
 * partner_zoom_credentials is service_role-only (no grant to
 * anon/authenticated at all), so `admin` here must be the admin client -
 * never the caller's own RLS-scoped client, which would get a permission
 * error attempting this select.
 */
export async function resolveZoomCredentialsForPartner(
  admin: SupabaseClient,
  partnerOrganizationId: string | null | undefined,
): Promise<ResolvedZoomCredentials> {
  if (!partnerOrganizationId) {
    return { credentials: getDefaultZoomCredentials(), provider: "kinkeepers" };
  }

  const { data, error } = await admin
    .from("partner_zoom_credentials")
    .select("account_id, client_id, client_secret")
    .eq("partner_organization_id", partnerOrganizationId)
    .maybeSingle();
  if (error) throw error;

  if (!data) {
    return { credentials: getDefaultZoomCredentials(), provider: "kinkeepers" };
  }

  return {
    credentials: { accountId: data.account_id, clientId: data.client_id, clientSecret: data.client_secret },
    provider: "partner",
  };
}
