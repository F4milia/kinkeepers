import "server-only";
import { Resend } from "resend";
import { log, logError } from "@/lib/log";

// Constructed lazily, inside the function that uses it, not at module
// scope - a module-scope `new Resend(...)` runs the moment anything
// imports this file (directly or transitively, e.g. via
// lib/referral/actions.ts), which broke every test file that imports
// that chain without itself needing RESEND_API_KEY set, since vitest's
// test env (vitest.config.mts) doesn't define it.
function getResendClient(): Resend {
  return new Resend(process.env.RESEND_API_KEY);
}

/**
 * Sends the cross-device intake resumption link (P2 PR5 - see the run
 * doc conversation on why an emailed link, not a "type your email to
 * look up your application" search box: the latter is an enumeration
 * surface for something more sensitive than an account, and this
 * matches the mental model P1 already taught this population).
 *
 * PLACEHOLDER COPY: this session (P2) is backend-only and has no access
 * to the Part 3.1 copy deck. The subject/body below are deliberately
 * minimal and functionally descriptive, not final - same treatment P6
 * gave placeholder legal text pending real review. Flag before this
 * ships to a real caregiver; X3 (Wave 7, transactional messages) is
 * where the other member-facing message copy lives, but "intake resume
 * link" isn't in X3's own enumerated list of 7 messages either - this
 * is a genuine gap between P2 and X3 worth resolving explicitly, not
 * silently patched over by inventing final copy here.
 */
export async function sendResumeEmail(email: string, resumeToken: string, applicantId: string) {
  const resumeUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/intake/resume?token=${resumeToken}`;

  const { error } = await getResendClient().emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: email,
    subject: "Continue your KinKeepers application",
    html: `<p>You can pick up where you left off here: <a href="${resumeUrl}">${resumeUrl}</a></p>`,
  });

  if (error) {
    logError("intake_resume_email_failed", { applicant_id: applicantId });
    return;
  }

  log("intake_resume_email_sent", { applicant_id: applicantId });
}
