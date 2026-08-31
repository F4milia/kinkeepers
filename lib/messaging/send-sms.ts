import "server-only";
import twilio from "twilio";
import { log, logError } from "@/lib/log";
import { assertOutboundMessageAllowed } from "@/lib/messaging/staging-guard";

// Lazily constructed, same reasoning as send-email.ts's getResendClient -
// avoids a module-scope throw on import in any environment (every one,
// as of this writing) without TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN set.
function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error("Missing Twilio credentials: TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must both be set.");
  }
  return twilio(accountSid, authToken);
}

export interface SendSmsParams {
  to: string;
  body: string;
  /** Structured-logging fields only - see send-email.ts's SendEmailParams. */
  logContext: Record<string, string | number | boolean | null>;
}

/**
 * The generic P4 SMS send mechanism. Twilio credentials are unset in
 * every environment as of this writing (TWILIO_ACCOUNT_SID/
 * TWILIO_AUTH_TOKEN/TWILIO_FROM_NUMBER are all commented out in
 * .env.local; A2P 10DLC registration is a separate, still-pending
 * compliance step) - same credential-gap treatment as sendEmail: log and
 * no-op rather than crash the feature that called this.
 */
export async function sendSms({ to, body, logContext }: SendSmsParams): Promise<void> {
  assertOutboundMessageAllowed(to);

  try {
    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    if (!fromNumber) {
      throw new Error("Missing Twilio credentials: TWILIO_FROM_NUMBER must be set.");
    }
    await getTwilioClient().messages.create({ to, from: fromNumber, body });
    log("sms_sent", logContext);
  } catch {
    logError("sms_send_failed", logContext);
  }
}
