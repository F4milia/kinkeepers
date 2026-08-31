import "server-only";
import { logError } from "@/lib/log";
import { sendEmail } from "@/lib/messaging/send-email";
import { sendSms } from "@/lib/messaging/send-sms";

export interface MemberContact {
  email: string | null;
  phone: string | null;
  /** Null means intake never captured a preference - see the default below. */
  preferredContactChannel: "email" | "sms" | "both" | null;
}

export interface NotifyMemberParams {
  contact: MemberContact;
  subject: string;
  emailHtml: string;
  smsBody: string;
  /** Structured-logging fields only - see send-email.ts's SendEmailParams. */
  logContext: Record<string, string | number | boolean | null>;
}

/**
 * Sends via whichever channel(s) the member actually asked for -
 * CLAUDE.md invariant #2 (no health information in the message itself)
 * is the caller's responsibility via the subject/emailHtml/smsBody it
 * supplies; this function only handles channel selection.
 *
 * A null preference (intake never asked, or the caregiver skipped it)
 * defaults to email only, not sms - this project's own established
 * default reach channel elsewhere (magic-link auth, the intake-resume
 * link) is always email, never sms, so this stays consistent rather
 * than inventing a new default here.
 */
export async function notifyMember({ contact, subject, emailHtml, smsBody, logContext }: NotifyMemberParams): Promise<void> {
  const wantsEmail = contact.preferredContactChannel !== "sms";
  const wantsSms = contact.preferredContactChannel === "sms" || contact.preferredContactChannel === "both";

  const sends: Promise<void>[] = [];
  if (wantsEmail && contact.email) {
    sends.push(sendEmail({ to: contact.email, subject, html: emailHtml, logContext }));
  }
  if (wantsSms && contact.phone) {
    sends.push(sendSms({ to: contact.phone, body: smsBody, logContext }));
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
