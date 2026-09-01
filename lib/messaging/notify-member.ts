import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { log, logError } from "@/lib/log";
import { sendEmail } from "@/lib/messaging/send-email";
import { sendSms } from "@/lib/messaging/send-sms";

export interface MemberContact {
  email: string | null;
  phone: string | null;
  /** Null means intake never captured a preference - see the default below. */
  preferredContactChannel: "email" | "sms" | "both" | null;
}

export interface NotifyMemberParams {
  admin: SupabaseClient;
  applicantId: string;
  notificationType: string;
  /**
   * Identifies THIS specific notification attempt, shared across both
   * channels for one logical event - see notification_log's own
   * migration comment for the exact shape per notification type. A
   * second call with the same (dedupKey, channel) is a no-op, not a
   * duplicate send - enforced by a real unique index, not just this
   * function's own logic.
   */
  dedupKey: string;
  contact: MemberContact;
  subject: string;
  emailHtml: string;
  smsBody: string;
  /** Structured-logging fields only - see send-email.ts's SendEmailParams. */
  logContext: Record<string, string | number | boolean | null>;
}

/**
 * Atomically claims the (dedupKey, channel) slot via notification_log's
 * unique index - returns the new row's id on success, or null when a
 * prior attempt already claimed it (23505 = unique_violation). This is
 * the actual dedup enforcement point; everything else here is bookkeeping.
 */
async function claimNotificationSlot(
  admin: SupabaseClient,
  dedupKey: string,
  channel: "email" | "sms",
  applicantId: string,
  notificationType: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("notification_log")
    .insert({ applicant_id: applicantId, notification_type: notificationType, channel, dedup_key: dedupKey })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return null;
    throw error;
  }
  return data.id;
}

async function markNotificationResult(admin: SupabaseClient, logId: string, sent: boolean): Promise<void> {
  const { error } = await admin
    .from("notification_log")
    .update({ status: sent ? "sent" : "failed" })
    .eq("id", logId);
  if (error) logError("notification_log_update_failed", { log_id: logId });
}

async function sendOneChannel(params: {
  admin: SupabaseClient;
  dedupKey: string;
  channel: "email" | "sms";
  applicantId: string;
  notificationType: string;
  logContext: Record<string, string | number | boolean | null>;
  send: () => Promise<boolean>;
}): Promise<void> {
  const logId = await claimNotificationSlot(
    params.admin,
    params.dedupKey,
    params.channel,
    params.applicantId,
    params.notificationType,
  );
  if (!logId) {
    log("notification_deduped", { ...params.logContext, channel: params.channel });
    return;
  }
  const sent = await params.send();
  await markNotificationResult(params.admin, logId, sent);
}

/**
 * Sends via whichever channel(s) the member actually asked for -
 * CLAUDE.md invariant #2 (no health information in the message itself)
 * is the caller's responsibility via the subject/emailHtml/smsBody it
 * supplies; this function only handles channel selection, dedup, and
 * recording the outcome in notification_log (A5's failed-notifications
 * queue reads that table directly).
 *
 * A null preference (intake never asked, or the caregiver skipped it)
 * defaults to email only, not sms - this project's own established
 * default reach channel elsewhere (magic-link auth, the intake-resume
 * link) is always email, never sms, so this stays consistent rather
 * than inventing a new default here.
 */
export async function notifyMember({
  admin,
  applicantId,
  notificationType,
  dedupKey,
  contact,
  subject,
  emailHtml,
  smsBody,
  logContext,
}: NotifyMemberParams): Promise<void> {
  const wantsEmail = contact.preferredContactChannel !== "sms";
  const wantsSms = contact.preferredContactChannel === "sms" || contact.preferredContactChannel === "both";

  const sends: Promise<void>[] = [];
  if (wantsEmail && contact.email) {
    const email = contact.email;
    sends.push(
      sendOneChannel({
        admin,
        dedupKey,
        channel: "email",
        applicantId,
        notificationType,
        logContext,
        send: () => sendEmail({ to: email, subject, html: emailHtml, logContext }),
      }),
    );
  }
  if (wantsSms && contact.phone) {
    const phone = contact.phone;
    sends.push(
      sendOneChannel({
        admin,
        dedupKey,
        channel: "sms",
        applicantId,
        notificationType,
        logContext,
        send: () => sendSms({ to: phone, body: smsBody, logContext }),
      }),
    );
  }

  if (sends.length === 0) {
    // Neither the preferred channel(s) nor any fallback had a reachable
    // address/number on file - send-email.ts/send-sms.ts already log
    // their own failures, but a request that never even attempted a
    // send needs its own log line so this doesn't look identical to a
    // successful no-op.
    logError("notify_member_no_reachable_channel", logContext);
    return;
  }

  await Promise.all(sends);
}
