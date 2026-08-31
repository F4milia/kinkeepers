"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ConsentDocumentType } from "@/lib/consent/data";

export type RecordConsentResult = { success: true } | { success: false; reason: "unauthenticated" };

/**
 * member_id is never a parameter here - it's read from the caller's own
 * session, never trusted from the client, per CLAUDE.md invariant #9.
 * RLS (member_consents_insert_own: `member_id = auth.uid()`) would block
 * a mismatch anyway, but resolving it server-side means there's nothing
 * for a client to even attempt to spoof.
 */
export async function recordConsent(
  documentType: ConsentDocumentType,
  version: number,
): Promise<RecordConsentResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, reason: "unauthenticated" };

  const { error } = await supabase.from("member_consents").insert({
    member_id: user.id,
    document_type: documentType,
    document_version: version,
  });
  if (error) throw error;

  revalidatePath("/consent");
  return { success: true };
}
