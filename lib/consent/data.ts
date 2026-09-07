import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type ConsentDocumentType =
  | "terms_of_service"
  | "privacy_policy"
  | "participant_agreement"
  | "group_confidentiality";

// group_confidentiality last, deliberately - the L3 prompt: "gets its own
// screen and its own moment," presented as the final, more substantive
// step rather than one of four interchangeable checkboxes.
const DOCUMENT_ORDER: ConsentDocumentType[] = [
  "terms_of_service",
  "privacy_policy",
  "participant_agreement",
  "group_confidentiality",
];

export interface ConsentDocumentStatus {
  documentType: ConsentDocumentType;
  version: number;
  body: string;
  isPlaceholder: boolean;
  status: "pending" | "consented";
  agreedAt: string | null;
  // Set only when this is a re-consent (the member agreed to an OLDER
  // version of this same document) AND the new version actually carries
  // a change_summary - never shown on a member's first-ever consent to a
  // document, since there's nothing to have "changed" yet.
  changeSummary: string | null;
}

/**
 * All four documents at their current version, with this signed-in
 * member's own consent status against each - not just the pending ones,
 * since the Discussion screen's confidentiality line needs somewhere to
 * link that works whether or not the member has already agreed.
 *
 * "Pending" is derived directly from whether a member_consents row exists
 * for (document_type, current version) - equivalent to what P6's
 * needs_reconsent() computes, without a second round trip through it.
 * Empty array for a signed-out caller (shouldn't happen given the
 * (caregiver) layout's own auth gate, but this file has no reason to
 * assume that always holds).
 *
 * `callerClient` is optional and exists for testability (same reasoning
 * as requireRole() in lib/auth/roles.ts) - real callers never pass it
 * and get the cookie-bound request client.
 */
export async function getConsentStatus(callerClient?: SupabaseClient): Promise<ConsentDocumentStatus[]> {
  const supabase = callerClient ?? (await createClient());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: allDocs, error: docsError } = await supabase
    .from("consent_documents")
    .select("document_type, version, body, is_placeholder, change_summary")
    .order("version", { ascending: false });
  if (docsError) throw docsError;

  const currentByType = new Map<ConsentDocumentType, (typeof allDocs)[number]>();
  for (const doc of allDocs ?? []) {
    const type = doc.document_type as ConsentDocumentType;
    if (!currentByType.has(type)) currentByType.set(type, doc);
  }

  const { data: myConsents, error: consentsError } = await supabase
    .from("member_consents")
    .select("document_type, document_version, agreed_at")
    .eq("member_id", user.id);
  if (consentsError) throw consentsError;

  const agreedAtByKey = new Map(
    (myConsents ?? []).map((c) => [`${c.document_type}:${c.document_version}`, c.agreed_at as string]),
  );

  // A member who has agreed to ANY older version of this document type is
  // being re-consented, not consenting for the first time - only that
  // case ever shows a change summary. Reduces the same myConsents rows
  // already fetched above rather than a second query.
  const hasOlderConsentByType = new Set<ConsentDocumentType>();
  for (const c of myConsents ?? []) {
    const type = c.document_type as ConsentDocumentType;
    const currentVersion = currentByType.get(type)?.version;
    if (currentVersion !== undefined && c.document_version < currentVersion) {
      hasOlderConsentByType.add(type);
    }
  }

  return DOCUMENT_ORDER.filter((type) => currentByType.has(type)).map((type) => {
    const doc = currentByType.get(type)!;
    const agreedAt = agreedAtByKey.get(`${type}:${doc.version}`) ?? null;
    return {
      documentType: type,
      version: doc.version,
      body: doc.body,
      isPlaceholder: doc.is_placeholder,
      status: agreedAt ? "consented" : "pending",
      agreedAt,
      changeSummary: !agreedAt && hasOlderConsentByType.has(type) ? doc.change_summary : null,
    };
  });
}

/**
 * L3 audit gap-closure: whether the signed-in member has any outstanding
 * consent (never consented, or consented to an older version) - the
 * check the (caregiver) layout needs to route a newly-assigned member to
 * /consent before Home, per the run doc's own acceptance line ("Presented
 * at enrollment, after cohort assignment, before the first session").
 * Reuses P6's existing needs_reconsent() function rather than
 * reimplementing the same query - false for a signed-out caller, same as
 * getConsentStatus() above.
 */
export async function memberNeedsConsent(callerClient?: SupabaseClient): Promise<boolean> {
  const supabase = callerClient ?? (await createClient());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase.rpc("needs_reconsent", { check_member_id: user.id });
  if (error) throw error;
  return (data ?? []).length > 0;
}
