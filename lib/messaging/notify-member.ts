import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { log, logError } from "@/lib/log";
import { sendEmail } from "@/lib/messaging/send-email";
import { sendSms } from "@/lib/messaging/send-sms";

export interface MemberContact {
  email: string | null;
  phone: string | null;
  /**
   * Shouldn't be null in practice (the DB column is `not null default
   * 'both'`) - kept nullable here as a defensive type only, handled the
   * same as "both" below, never "email only." See the default below.
   */
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
 * A null preference should no longer occur - the applicants.
 * preferred_contact_channel column is `not null default 'both'` as of
 * 20260905140000_default_contact_channel_both.sql, matching P4-pre's own
 * spec ("Channel: email, SMS, or both. Default both.") and P4's own
 * body text ("Default to both for the first cohort"). This function
 * still treats null defensively the same way - as both channels, not
 * email-only - in case a caller ever passes one anyway, so a defensive
 * fallback can't silently violate the documented default.
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
  const wantsSms =
    contact.preferredContactChannel === "sms" ||
    contact.preferredContactChannel === "both" ||
    contact.preferredContactChannel === null;

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

export interface ApplicantContactRow {
  contact: MemberContact;
  timeZone: string | null;
  unsubscribeToken: string;
}

/**
 * Single-applicant contact lookup, shared by every notification path
 * that targets exactly one known applicant (X3's lifecycle messages,
 * P4's missed-session follow-up) rather than a cohort roster (P4's
 * session-wide reminders/reschedule/cancellation use
 * session-notifications.ts's own listEnrolledMembers instead). Moved
 * here from applicant-notifications.ts (2026-09-05 P4 gap-closure) so
 * session-notifications.ts can use it too without a circular import -
 * applicant-notifications.ts already imports FROM session-notifications.ts.
 */
export async function getApplicantContact(admin: SupabaseClient, applicantId: string): Promise<ApplicantContactRow | null> {
  const { data, error } = await admin
    .from("applicants")
    .select("email, phone, preferred_contact_channel, time_zone, notification_unsubscribe_token, notifications_opted_out")
    .eq("id", applicantId)
    .maybeSingle();
  if (error) throw error;
  // Same "an opted-out member simply never appears" contract as
  // listEnrolledMembers (session-notifications.ts) - checked explicitly
  // here rather than in a where clause, since this looks up exactly one
  // known applicant rather than filtering a cohort roster.
  if (!data || data.notifications_opted_out) return null;

  return {
    contact: { email: data.email, phone: data.phone, preferredContactChannel: data.preferred_contact_channel },
    timeZone: data.time_zone,
    unsubscribeToken: data.notification_unsubscribe_token,
  };
}
