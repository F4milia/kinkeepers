import "server-only";
import { Resend } from "resend";
import { log, logError } from "@/lib/log";
import { assertOutboundMessageAllowed } from "@/lib/messaging/staging-guard";

// Constructed lazily, inside the function that uses it, not at module
// scope - same reasoning as lib/referral/send-resume-email.ts (a
// module-scope `new Resend(...)` runs the moment anything imports this
// file, breaking test files that don't set RESEND_API_KEY).
function getResendClient(): Resend {
  return new Resend(process.env.RESEND_API_KEY);
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  /**
   * Structured-logging fields only (ids, event names) - never the
   * message subject/body/recipient. lib/log.ts's own LogFields type
   * restricts values to primitives specifically so nothing prose-shaped
   * ends up here by accident.
   */
  logContext: Record<string, string | number | boolean | null>;
}

/**
 * The generic P4 send mechanism - callers own the actual copy (this
 * function invents none). assertOutboundMessageAllowed runs first so a
 * non-production environment can never reach a real recipient outside
 * the staging allowlist, no matter which caller forgets to check it
 * themselves.
 *
 * No RESEND_API_KEY configured is not exceptional - true in every
 * environment as of this writing (confirmed against the live Vercel
 * project - see lib/referral/send-resume-email.ts's own note). The
 * Resend SDK throws synchronously on a missing key, which the `if
 * (error)` check below can't catch (that only covers an error RETURNED
 * from .emails.send(), not a throw before it's ever called) - so this
 * logs and no-ops rather than crashing whatever feature called it, same
 * credential-gap treatment already used for Zoom and for this exact
 * Resend integration elsewhere in this codebase.
 */
export async function sendEmail({ to, subject, html, logContext }: SendEmailParams): Promise<void> {
  assertOutboundMessageAllowed(to);

  try {
    const { error } = await getResendClient().emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to,
      subject,
      html,
    });

    if (error) {
      logError("email_send_failed", logContext);
      return;
    }

    log("email_sent", logContext);
  } catch {
    logError("email_send_failed", logContext);
  }
}
