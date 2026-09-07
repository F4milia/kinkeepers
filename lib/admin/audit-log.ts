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
  /**
   * Raw jsonb, shape varies by action - e.g. submit_session_log's own
   * { delivery_confirmed, is_correction, attendance_changes: [...] }.
   * No generated Supabase types exist in this codebase, so this stays
   * loosely typed; a renderer narrows it for the specific action/shape
   * it knows how to display (see app/admin/audit-log/page.tsx).
   */
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogFilters {
  action?: string;
  subjectType?: string;
  /** Partial, case-insensitive match against the actor's email. */
  actorEmail?: string;
  /** Inclusive, "YYYY-MM-DD" - matched against created_at's own date. */
  startDate?: string;
  /** Inclusive, "YYYY-MM-DD". */
  endDate?: string;
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

  // Fetched once up front, not just to decorate results afterward -
  // an actorEmail filter needs to resolve to actor ids BEFORE the main
  // query runs. audit_log.actor_id is a bare uuid (profiles(id), which
  // has no email column of its own - email lives on auth.users), so
  // there is no way to filter by email at the DB query level directly;
  // resolving via listUsers() first, same primitive this function
  // already used for decoration, is what makes the filter possible at
  // all without a schema change.
  const { data: usersPage } = await admin.auth.admin.listUsers();
  const emailByActorId = new Map<string, string>();
  for (const user of usersPage.users) {
    if (user.email) emailByActorId.set(user.id, user.email);
  }

  let query = admin
    .from("audit_log")
    .select("id, actor_id, action, subject_type, subject_id, reason, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.subjectType) query = query.eq("subject_type", filters.subjectType);
  if (filters.actorEmail) {
    const needle = filters.actorEmail.toLowerCase();
    const matchingIds = usersPage.users
      .filter((user) => user.email?.toLowerCase().includes(needle))
      .map((user) => user.id);
    // An empty array here is deliberate, not a bug - no matching actor
    // means the filter should return zero rows, not fall through to
    // "no filter applied" by skipping the .in() call.
    query = query.in("actor_id", matchingIds);
  }
  if (filters.startDate) query = query.gte("created_at", filters.startDate);
  if (filters.endDate) query = query.lte("created_at", `${filters.endDate}T23:59:59.999Z`);

  const { data, error } = await query;
  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    actorEmail: emailByActorId.get(row.actor_id) ?? null,
    action: row.action,
    actionLabel: labelForAction(row.action),
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    reason: row.reason,
    metadata: row.metadata,
    createdAt: row.created_at,
  }));
}
