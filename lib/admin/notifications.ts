"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/roles";

export interface FailedNotification {
  id: string;
  applicantEmail: string | null;
  applicantPhone: string | null;
  notificationType: string;
  channel: string;
  createdAt: string;
}

/**
 * notification_log has no admin-facing RLS policy at all (same pattern
 * as audit_log/member_data_requests) - the coarse requireRole check here
 * IS the access control. This is the queue CLAUDE.md's acceptance
 * criteria names: "failed sends surface in an admin view (A5 renders
 * the queue)."
 */
export async function listFailedNotifications(callerClient?: SupabaseClient): Promise<FailedNotification[]> {
  await requireRole(["admin"], callerClient);
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("notification_log")
    .select("id, notification_type, channel, created_at, applicants(email, phone)")
    .eq("status", "failed")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return data.map((row) => {
    const applicant = row.applicants as unknown as { email: string | null; phone: string | null } | null;
    return {
      id: row.id,
      applicantEmail: applicant?.email ?? null,
      applicantPhone: applicant?.phone ?? null,
      notificationType: row.notification_type,
      channel: row.channel,
      createdAt: row.created_at,
    };
  });
}
