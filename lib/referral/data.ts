import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
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

// The intake fields it's safe to hand back to whoever holds a
// resume_token - i.e. the applicant themselves. Deliberately excludes
// partner_reference_id (never shown to the applicant/member, per the
// P2 spec), partner_organization_id, and created_at/pending_review_since
// (internal bookkeeping). Includes status, since a resume flow
// reasonably needs to know "is this still in progress" - the actual
// per-status copy is L4's job (Wave 6), this is just the raw fact.
export interface SafeApplicantFields {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  timeZone: string | null;
  relationship: string | null;
  careRecipientStage: string | null;
  availabilityWindows: unknown;
  preferredContactChannel: string | null;
  status: string;
}

export type ResolveApplicantResult =
  | { found: true; fields: SafeApplicantFields }
  | { found: false };

// resume_token isn't reachable via anon/authenticated RLS at all
// (applicants has no such grant - see the referral_intake_schema
// migration), so this always uses the admin client rather than the
// request-scoped one, unlike resolvePartnerBySlug above. The token
// itself, not a session, is what authorizes this read.
export async function resolveApplicantByResumeToken(
  resumeToken: string,
): Promise<ResolveApplicantResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("applicants")
    .select(
      "first_name, last_name, email, phone, time_zone, relationship, care_recipient_stage, availability_windows, preferred_contact_channel, status",
    )
    .eq("resume_token", resumeToken)
    .maybeSingle();

  if (error || !data) return { found: false };

  return {
    found: true,
    fields: {
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
      phone: data.phone,
      timeZone: data.time_zone,
      relationship: data.relationship,
      careRecipientStage: data.care_recipient_stage,
      availabilityWindows: data.availability_windows,
      preferredContactChannel: data.preferred_contact_channel,
      status: data.status,
    },
  };
}
