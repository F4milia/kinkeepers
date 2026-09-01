"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/roles";
import { labelForAction } from "@/lib/admin/audit-action-labels";

export interface AuditLogEntry {
  id: number;
  actorEmail: string | null;
  action: string;
  actionLabel: string;
  subjectType: string;
  subjectId: string;
  reason: string | null;
  createdAt: string;
}

export interface AuditLogFilters {
  action?: string;
  subjectType?: string;
}

/**
 * audit_log has no admin-facing RLS policy at all (its own migration
 * comment: "reading audit_log is server-side-only via the service-role
 * client... A5 owns the actual admin-facing screen and does its own
 * role check there before querying") - the coarse requireRole check
 * here IS the access control.
 *
 * Capped at 200 most-recent rows rather than paginated - matches this
 * project's current scale (same tradeoff already accepted for the
 * facilitator-email lookup helpers), revisit if this table grows large
 * enough for that to matter.
 */
export async function listAuditLog(filters: AuditLogFilters = {}, callerClient?: SupabaseClient): Promise<AuditLogEntry[]> {
  await requireRole(["admin"], callerClient);
  const admin = createAdminClient();

  let query = admin
    .from("audit_log")
    .select("id, actor_id, action, subject_type, subject_id, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.subjectType) query = query.eq("subject_type", filters.subjectType);

  const { data, error } = await query;
  if (error) throw error;

  const actorIds = [...new Set(data.map((row) => row.actor_id))];
  const emails = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: usersPage } = await admin.auth.admin.listUsers();
    const wanted = new Set(actorIds);
    for (const user of usersPage.users) {
      if (wanted.has(user.id) && user.email) emails.set(user.id, user.email);
    }
  }

  return data.map((row) => ({
    id: row.id,
    actorEmail: emails.get(row.actor_id) ?? null,
    action: row.action,
    actionLabel: labelForAction(row.action),
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    reason: row.reason,
    createdAt: row.created_at,
  }));
}
