import "server-only";
import { logError } from "@/lib/log";

/**
 * A notification failure must never fail the mutation it's attached to.
 * `logEvent` is explicit at every call site (not hardcoded here) because
 * this wrapper is shared across genuinely different notification
 * categories with their own established structured-log event names -
 * e.g. "applicant_notification_failed" for X3's applicant-lifecycle
 * messages, "session_notification_failed" for P4's reschedule/cancel
 * notices (formerly a separate, byte-for-byte identical private copy in
 * lib/admin/session-management.ts, consolidated here since nothing about
 * the duplication was actually session-management-specific).
 */
export async function notifyBestEffort(
  sendNotification: () => Promise<void>,
  logEvent: string,
  logContext: Record<string, string>,
): Promise<void> {
  try {
    await sendNotification();
  } catch {
    logError(logEvent, logContext);
  }
}
