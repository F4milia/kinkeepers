"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ContactChannel } from "@/lib/account/data";

export type AccountActionResult = { success: true } | { success: false; reason: "unauthenticated" };

/**
 * member_id/applicant id are never parameters here - resolved from the
 * caller's own session server-side, same reasoning lib/consent/actions.ts's
 * recordConsent already documents for CLAUDE.md invariant #9. RLS
 * (applicants_update_own_member: profile_id = auth.uid()) would block a
 * mismatch anyway; this just means there's nothing for a client to even
 * attempt to spoof.
 */
async function getMyApplicantId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: applicantId, error } = await supabase.rpc("claim_applicant_for_current_user");
  if (error) throw error;
  return applicantId;
}

export interface AccountInfoUpdate {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  timeZone: string;
}

export async function updateAccountInfo(fields: AccountInfoUpdate): Promise<AccountActionResult> {
  const supabase = await createClient();
  const applicantId = await getMyApplicantId(supabase);
  if (!applicantId) return { success: false, reason: "unauthenticated" };

  const { error } = await supabase
    .from("applicants")
    .update({
      first_name: fields.firstName,
      last_name: fields.lastName,
      email: fields.email,
      phone: fields.phone,
      time_zone: fields.timeZone,
    })
    .eq("id", applicantId);
  if (error) throw error;

  revalidatePath("/account");
  return { success: true };
}

/**
 * "Preference changes take effect on the next reminder" (L3's own
 * acceptance line) needs no extra plumbing here - P4's notification
 * pipeline (lib/messaging/session-notifications.ts's listEnrolledMembers,
 * lib/messaging/applicant-notifications.ts's getApplicantContact) already
 * reads applicants.preferred_contact_channel fresh at send time, not a
 * cached copy, so persisting the new value is the whole job.
 */
export async function updateNotificationPreferences(channel: ContactChannel): Promise<AccountActionResult> {
  const supabase = await createClient();
  const applicantId = await getMyApplicantId(supabase);
  if (!applicantId) return { success: false, reason: "unauthenticated" };

  const { error } = await supabase
    .from("applicants")
    .update({ preferred_contact_channel: channel })
    .eq("id", applicantId);
  if (error) throw error;

  revalidatePath("/account");
  return { success: true };
}

/**
 * The two data-request actions the L3 prompt names directly: "Request a
 * copy of my information" and "Delete my account," both creating a
 * member_data_requests row (P6's table, already RLS-scoped to
 * member_id = auth.uid() via member_data_requests_insert_own - see
 * 20260828141442_consent_and_data_requests.sql). member_data_requests
 * keys on profiles.id directly, not applicants.id, so this doesn't need
 * the claim RPC at all - a member's identity for this table is just
 * auth.uid().
 */
export async function requestDataExport(): Promise<AccountActionResult> {
  return createDataRequest("export");
}

export async function requestAccountDeletion(): Promise<AccountActionResult> {
  return createDataRequest("deletion");
}

async function createDataRequest(requestType: "export" | "deletion"): Promise<AccountActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, reason: "unauthenticated" };

  const { error } = await supabase
    .from("member_data_requests")
    .insert({ member_id: user.id, request_type: requestType });
  if (error) throw error;

  revalidatePath("/account");
  return { success: true };
}

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
