import "server-only";
import { logError } from "@/lib/log";

/**
 * A notification failure must never fail the mutation it's attached to -
 * same reasoning and same shape as lib/admin/session-management.ts's own
 * private copy of this wrapper (P4). Kept as a small shared helper here
 * rather than duplicated a third time, since X3 needs it in three
 * separate action files; session-management.ts's own copy is left
 * untouched rather than refactored to import this one, to avoid an
 * unrelated edit to another session's already-shipped file.
 */
export async function notifyBestEffort(
  sendNotification: () => Promise<void>,
  logContext: Record<string, string>,
): Promise<void> {
  try {
    await sendNotification();
  } catch {
    logError("applicant_notification_failed", logContext);
  }
}
