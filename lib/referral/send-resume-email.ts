import "server-only";
import { Resend } from "resend";
import { log, logError } from "@/lib/log";
import { assertOutboundMessageAllowed } from "@/lib/messaging/staging-guard";

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

  // L2 audit finding (2026-09-05): this function called Resend directly
  // with no staging-guard check at all - the exact same gap already found
  // and fixed in lib/auth/actions.ts's requestEmailLink()/requestSmsCode()
  // (assertOutboundMessageAllowed() protects every other real send in
  // this codebase; this one was simply missed). On staging, ANY real
  // email typed into intake step 1 would have received a real resume-link
  // email, unconditionally - exactly the "trust failure we cannot undo"
  // X1's own prompt warns against. Same "log and no-op, never throw"
  // treatment as a missing RESEND_API_KEY below - a blocked send must not
  // fail the intake flow it's attached to.
  try {
    assertOutboundMessageAllowed(email);
  } catch {
    logError("intake_resume_email_failed", { applicant_id: applicantId });
    return;
  }

  // RESEND_API_KEY is now configured on the real Vercel project (as of
  // P1/A1's own 2026-09 audits confirming real sends) - no longer the
  // universally-missing case an earlier version of this comment claimed.
  // Still wrapped: the Resend SDK's constructor throws synchronously on a
  // missing/invalid key, which the `if (error)` check below can't catch
  // (that only covers an error returned FROM .emails.send(), not a throw
  // before it's ever called) - a local dev environment with no key set
  // still needs this to degrade gracefully rather than fail the whole
  // saveIntakeProgress call. Same credential-gap treatment as Zoom/Sentry
  // elsewhere in this codebase: log and no-op rather than crash the
  // feature it's attached to.
  try {
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
  } catch {
    logError("intake_resume_email_failed", { applicant_id: applicantId });
  }
}
