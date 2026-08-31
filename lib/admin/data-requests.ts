"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/roles";

async function resolveEmails(admin: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  // No pagination handling yet - fine at this scale, same tradeoff
  // already accepted in lib/admin/cohorts.ts's own facilitatorEmails.
  const { data } = await admin.auth.admin.listUsers();
  const wanted = new Set(ids);
  for (const user of data.users) {
    if (wanted.has(user.id) && user.email) map.set(user.id, user.email);
  }
  return map;
}

export interface DataRequestListItem {
  id: string;
  memberEmail: string | null;
  requestType: "deletion" | "export";
  status: "pending" | "fulfilled";
  requestedAt: string;
  fulfilledAt: string | null;
  fulfillmentNote: string | null;
}

/**
 * member_data_requests has no admin-facing RLS policy at all (P6's own
 * comment: "A5's future admin queue reads via service_role, same
 * pattern as every other admin-facing table so far") - the coarse
 * requireRole check here IS the access control, not a layer on top of a
 * policy that doesn't exist.
 */
export async function listDataRequests(callerClient?: SupabaseClient): Promise<DataRequestListItem[]> {
  const supabase = callerClient ?? (await createClient());
  await requireRole(["admin"], supabase);
  const admin = createAdminClient();

  const { data: requests, error } = await admin
    .from("member_data_requests")
    .select("id, member_id, request_type, status, requested_at, fulfilled_at, fulfillment_note")
    .order("requested_at", { ascending: false });
  if (error) throw error;

  const emails = await resolveEmails(
    admin,
    [...new Set(requests.map((r) => r.member_id))],
  );

  return requests.map((r) => ({
    id: r.id,
    memberEmail: emails.get(r.member_id) ?? null,
    requestType: r.request_type,
    status: r.status,
    requestedAt: r.requested_at,
    fulfilledAt: r.fulfilled_at,
    fulfillmentNote: r.fulfillment_note,
  }));
}

export type DataRequestMutationResult = { success: true } | { success: false; error: string };

export async function markDataRequestFulfilledAction(
  requestId: string,
  note: string,
  callerClient?: SupabaseClient,
): Promise<DataRequestMutationResult> {
  const { userId } = await requireRole(["admin"], callerClient);
  const admin = createAdminClient();

  const { error } = await admin.rpc("mark_data_request_fulfilled", {
    actor_id: userId,
    target_request_id: requestId,
    note,
  });
  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/data-requests");
  return { success: true };
}
