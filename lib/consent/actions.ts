"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hashRequestIp } from "@/lib/auth/ip-hash";
import type { ConsentDocumentType } from "@/lib/consent/data";

export type RecordConsentResult = { success: true } | { success: false; reason: "unauthenticated" };

/**
 * member_id is never a parameter here - it's read from the caller's own
 * session, never trusted from the client, per CLAUDE.md invariant #9.
 * RLS (member_consents_insert_own: `member_id = auth.uid()`) would block
 * a mismatch anyway, but resolving it server-side means there's nothing
 * for a client to even attempt to spoof.
 *
 * `callerClient` is optional and exists for testability - real callers
 * never pass it and get the cookie-bound request client.
 */
export async function recordConsent(
  documentType: ConsentDocumentType,
  version: number,
  callerClient?: SupabaseClient,
): Promise<RecordConsentResult> {
  const supabase = callerClient ?? (await createClient());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, reason: "unauthenticated" };

  // P6 audit finding (2026-09-05): member_consents.ip_hash is a real
  // column the run doc's own prompt explicitly requires ("agreed_at, and
  // from what IP hash"), but this insert never populated it - always
  // NULL on every real consent row. Reuses the same hashRequestIp()
  // helper lib/auth/log-sign-in-event.ts already uses for the identical
  // purpose (an HMAC'd, non-reversible IP, never the raw address), rather
  // than duplicating that logic here.
  const ipHash = await hashRequestIp();

  const { error } = await supabase.from("member_consents").insert({
    member_id: user.id,
    document_type: documentType,
    document_version: version,
    ip_hash: ipHash,
  });
  if (error) throw error;

  revalidatePath("/consent");
  return { success: true };
}
