import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type ResolvePartnerResult =
  | { found: true; id: string; name: string }
  | { found: false };

// Public, unauthenticated lookup - what resolves "Referred by [name]" on
// the referral landing page (L2, Wave 3). Uses the plain server client,
// not the admin client: partner_organizations.name/referral_link_slug
// are deliberately anon-readable by RLS (see that migration's comment -
// these slugs are shared publicly, on printed clinic cards), so this
// stays consistent with that boundary instead of routing public reads
// through a privileged client for no reason.
//
// `client` is optional and exists for testability (same reasoning as
// requireRole() in lib/auth/roles.ts) - real callers never pass it and
// get the cookie-bound request client.
export async function resolvePartnerBySlug(
  slug: string,
  client?: SupabaseClient,
): Promise<ResolvePartnerResult> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("partner_organizations")
    .select("id, name")
    .eq("referral_link_slug", slug)
    .maybeSingle();

  if (error || !data) return { found: false };
  return { found: true, id: data.id, name: data.name };
}
