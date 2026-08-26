import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type AuditAction =
  | "admin_sign_in_link_issued"
  | "cohort_assignment"
  | "attendance_edit"
  | "deletion_fulfillment"
  | "role_change";

export interface RecordAuditEventInput {
  actorId: string;
  action: AuditAction;
  subjectType: string;
  subjectId: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Standalone audit write - NOT transactional with anything else. Use this
 * only when the privileged action has no dedicated Postgres function of its
 * own to compose into. Unlike lib/auth/log-sign-in-event.ts, this throws
 * rather than swallowing the error: a privileged action whose audit trail
 * silently failed to write is the compliance gap P7a exists to prevent, so
 * callers must handle (and likely fail) the mutation rather than proceed
 * unaudited.
 *
 * If the mutation and its audit entry must succeed or fail together, don't
 * use this - call the record_audit_event(...) SQL function directly from
 * within a Postgres function that also performs the mutation, in one
 * transaction. See the audit_log migration's comments for why a separate
 * network round-trip (which this function makes) can't provide that
 * guarantee.
 */
export async function recordAuditEvent(input: RecordAuditEventInput): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("record_audit_event", {
    actor_id: input.actorId,
    action: input.action,
    subject_type: input.subjectType,
    subject_id: input.subjectId,
    reason: input.reason ?? null,
    metadata: input.metadata ?? null,
  });
  if (error) {
    throw new Error(`Failed to record audit event: ${error.message}`);
  }
}
