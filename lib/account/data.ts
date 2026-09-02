import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ContactChannel = "email" | "sms" | "both";

export interface MyAccount {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  timeZone: string | null;
  preferredContactChannel: ContactChannel;
}

/**
 * Claims (idempotent - same RPC lib/data.ts's own getCurrentApplicantOrNotFound
 * calls) before reading, rather than assuming a prior screen already
 * claimed this session - the account screen has no guarantee it's reached
 * only after Home/Cohort have already run their own claim.
 *
 * null for a signed-out caller or an identity that doesn't resolve to a
 * real enrollment (mirrors lib/data.ts's own contract) - the account
 * screen's own not-found handling decides what to show for that, this
 * layer just reports it honestly rather than throwing.
 */
export async function getMyAccount(): Promise<MyAccount | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: applicantId, error: claimError } = await supabase.rpc("claim_applicant_for_current_user");
  if (claimError) throw claimError;
  if (!applicantId) return null;

  const { data, error } = await supabase
    .from("applicants")
    .select("first_name, last_name, email, phone, time_zone, preferred_contact_channel")
    .eq("id", applicantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    firstName: data.first_name ?? "",
    lastName: data.last_name ?? "",
    email: data.email,
    phone: data.phone,
    timeZone: data.time_zone,
    preferredContactChannel: data.preferred_contact_channel,
  };
}
