import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyMember, getApplicantContact, type MemberContact } from "@/lib/messaging/notify-member";
import { formatMeetingTime } from "@/lib/admin/cohort-meeting-time";
import { COPY } from "@/lib/copy";

/**
 * PLACEHOLDER COPY: P4 (this session) has no access to X3's real
 * transactional message text (X3, Wave 7, owns member-facing message
 * copy; its own enumerated message list isn't in this repo - same gap
 * lib/referral/send-resume-email.ts already flagged for the intake
 * resume link). Minimal and functionally descriptive only, not final -
 * same treatment P2 gave that email and P6 gave placeholder legal text.
 * Flag before this reaches a real caregiver.
 *
 * CLAUDE.md invariant #2 (no health information in any outbound
 * message) is honored here regardless of copy finality: nothing below
 * names dementia, caregiving, or the group - "meeting" is as specific
 * as this gets, matching the restraint of the existing sign-in-code
 * message ("Your KinKeepers sign-in code is 123456"). The support phone
 * number is the same placeholder already used in the member copy deck
 * (lib/copy.ts's own comment: reserved for fictional use, a demo tap
 * can't reach a real person) - reused here rather than inventing a
 * second fake number.
 */

interface EnrolledMemberContact {
  applicantId: string;
  contact: MemberContact;
  timeZone: string | null;
  unsubscribeToken: string;
}

/**
 * `notifications_opted_out = false` is what makes unsubscribe actually
 * stop delivery - an opted-out member simply never appears in this list,
 * so nothing downstream needs its own opt-out check. Their status/
 * cohort_id (real enrollment) is untouched by this filter or by
 * lib/referral/unsubscribe.ts's own action.
 */
async function listEnrolledMembers(admin: SupabaseClient, cohortId: string): Promise<EnrolledMemberContact[]> {
  const { data, error } = await admin
    .from("applicants")
    .select("id, email, phone, preferred_contact_channel, time_zone, notification_unsubscribe_token")
    .eq("cohort_id", cohortId)
    .in("status", ["enrolled", "attending"])
    .eq("notifications_opted_out", false);
  if (error) throw error;

  return data.map((row) => ({
    applicantId: row.id,
    contact: { email: row.email, phone: row.phone, preferredContactChannel: row.preferred_contact_channel },
    timeZone: row.time_zone,
    unsubscribeToken: row.notification_unsubscribe_token,
  }));
}

/**
 * The "say both" pattern already established for cohort meeting times
 * (lib/admin/cohort-meeting-time.ts's describeCohortMeetingForApplicant)
 * applied to a SPECIFIC known instant rather than "the next recurring
 * occurrence from now" - a rescheduled session's new time is already an
 * exact instant, not something to recompute from the cohort's weekly
 * slot. Reuses formatMeetingTime (already exported) rather than
 * duplicating its DST-aware rendering.
 *
 * Named edge case this closes: every member of a cohort previously got
 * the identical message rendered only in the cohort's own zone,
 * regardless of their own - wrong for "Applicant in Honolulu, cohort in
 * Eastern" exactly like cohort-meeting-time.ts's own named edge case.
 * Degrades to cohort-only when intake never recorded the member's zone,
 * matching describeCohortMeetingForApplicant's own fallback contract
 * (it requires a zone; callers already default to the cohort's own when
 * the applicant's is unknown - see lib/admin/assignment.ts).
 */
export function describeInstantForMember(instant: Date, memberTimeZone: string | null, cohortTimeZone: string): string {
  const cohortSide = formatMeetingTime(instant, cohortTimeZone);
  if (!memberTimeZone) return cohortSide;
  const memberSide = formatMeetingTime(instant, memberTimeZone);
  return `${memberSide} your time (${cohortSide} for the group)`;
}

/** The unsubscribe link every notification email footer carries - stops delivery, never touches enrollment. See lib/referral/unsubscribe.ts. */
export function unsubscribeLine(unsubscribeToken: string): string {
  const url = `${process.env.NEXT_PUBLIC_SITE_URL}/unsubscribe/${unsubscribeToken}`;
  return `<p><a href="${url}">Stop these emails</a></p>`;
}

export async function notifySessionRescheduled(
  admin: SupabaseClient,
  cohortId: string,
  sessionId: string,
  newInstant: Date,
  cohortTimeZone: string,
  joinUrl: string | null,
): Promise<void> {
  const members = await listEnrolledMembers(admin, cohortId);

  await Promise.all(
    members.map(({ applicantId, contact, timeZone, unsubscribeToken }) => {
      const timeDescription = describeInstantForMember(newInstant, timeZone, cohortTimeZone);
      const joinLine = joinUrl ? ` Join link: ${joinUrl}.` : "";
      return notifyMember({
        admin,
        applicantId,
        notificationType: "session_rescheduled",
        // A second reschedule of the SAME session to a DIFFERENT time is
        // a genuinely new notification (new instant in the key), not a
        // duplicate - see the migration's own comment on this shape.
        dedupKey: `${applicantId}:session_rescheduled:${sessionId}:${newInstant.toISOString()}`,
        contact,
        subject: "KinKeepers: your meeting time has changed",
        emailHtml: `<p>Your KinKeepers meeting has a new time: ${timeDescription}.${joinLine}</p><p>Questions? Call ${COPY.support.phoneNumber}.</p>${unsubscribeLine(unsubscribeToken)}`,
        smsBody: `KinKeepers: your meeting time changed to ${timeDescription}.${joinLine} Questions? Call ${COPY.support.phoneNumber}. Reply STOP to stop texts.`,
        logContext: { applicant_id: applicantId, cohort_id: cohortId, session_id: sessionId, notification: "session_rescheduled" },
      });
    }),
  );
}

export async function notifySessionCancelled(
  admin: SupabaseClient,
  cohortId: string,
  sessionId: string,
  cancelledInstant: Date,
  cohortTimeZone: string,
): Promise<void> {
  const members = await listEnrolledMembers(admin, cohortId);

  await Promise.all(
    members.map(({ applicantId, contact, timeZone, unsubscribeToken }) => {
      const timeDescription = describeInstantForMember(cancelledInstant, timeZone, cohortTimeZone);
      return notifyMember({
        admin,
        applicantId,
        notificationType: "session_cancelled",
        // A session can only be cancelled once (cancel_session's own
        // guard: "only a scheduled session can be cancelled"), so the
        // session id alone is a safe dedup key here - no instant needed.
        dedupKey: `${applicantId}:session_cancelled:${sessionId}`,
        contact,
        subject: "KinKeepers: your meeting has been cancelled",
        emailHtml: `<p>Your KinKeepers meeting on ${timeDescription} has been cancelled.</p><p>Questions? Call ${COPY.support.phoneNumber}.</p>${unsubscribeLine(unsubscribeToken)}`,
        smsBody: `KinKeepers: your meeting on ${timeDescription} is cancelled. Questions? Call ${COPY.support.phoneNumber}. Reply STOP to stop texts.`,
        logContext: { applicant_id: applicantId, cohort_id: cohortId, session_id: sessionId, notification: "session_cancelled" },
      });
    }),
  );
}

/**
 * P4's own actual schedule (24 hours before / 1 hour before a session) -
 * found missing entirely during a 2026-09-05 acceptance audit; every
 * merged P4 PR built the generic send mechanism and reschedule/
 * cancellation notifications instead of this. The run doc's own sample
 * text ("Your KinKeepers session starts in 1 hour. Join: [link]. Or call
 * 1-800-XXX-XXXX.") is used verbatim for the 1-hour message; the 24-hour
 * one matches the same voice. No health information, same restraint as
 * every other message in this file.
 *
 * The dedup key includes the session's own CURRENT instant, same
 * reasoning as notifySessionRescheduled above - if a session is
 * rescheduled after its 24h/1h reminder already fired for the old time,
 * the new time is a genuinely different notification, not a duplicate
 * of one that already went out for a time that no longer applies.
 */
export async function notifySessionReminder(
  admin: SupabaseClient,
  cohortId: string,
  sessionId: string,
  sessionInstant: Date,
  cohortTimeZone: string,
  joinUrl: string | null,
  reminderType: "24h" | "1h",
): Promise<void> {
  const members = await listEnrolledMembers(admin, cohortId);
  const hoursLabel = reminderType === "24h" ? "24 hours" : "1 hour";

  await Promise.all(
    members.map(({ applicantId, contact, timeZone, unsubscribeToken }) => {
      const timeDescription = describeInstantForMember(sessionInstant, timeZone, cohortTimeZone);
      const joinLine = joinUrl ? ` Join: ${joinUrl}.` : "";
      return notifyMember({
        admin,
        applicantId,
        notificationType: `session_reminder_${reminderType}`,
        dedupKey: `${applicantId}:session_reminder_${reminderType}:${sessionId}:${sessionInstant.toISOString()}`,
        contact,
        subject: `KinKeepers: your session starts in ${hoursLabel}`,
        emailHtml: `<p>Your KinKeepers session starts in ${hoursLabel}: ${timeDescription}.${joinLine}</p><p>Questions? Call ${COPY.support.phoneNumber}.</p>${unsubscribeLine(unsubscribeToken)}`,
        smsBody: `Your KinKeepers session starts in ${hoursLabel}.${joinLine} Or call ${COPY.support.phoneNumber}. Reply STOP to stop texts.`,
        logContext: { applicant_id: applicantId, cohort_id: cohortId, session_id: sessionId, notification: `session_reminder_${reminderType}` },
      });
    }),
  );
}

/**
 * P4's own missed-session follow-up - the run doc's own quoted text
 * verbatim: "We missed you Tuesday. The group meets again next week at
 * the same time." No guilt, no urgency, no streak language, no question
 * demanding a reply, per the prompt's own explicit requirement.
 *
 * The day name renders in the COHORT's own zone, not the member's -
 * every enrolled member missed the same shared calendar session, so one
 * day name is accurate for all of them (unlike a specific time, which
 * genuinely does vary by member zone elsewhere in this file). Per-
 * applicant, not per-cohort, since only confirmed-absent members ever
 * reach this function (the caller queries session_attendance first) -
 * uses getApplicantContact (notify-member.ts), the same single-applicant
 * lookup X3's lifecycle messages already use, not listEnrolledMembers.
 */
export async function notifyMissedSession(
  admin: SupabaseClient,
  applicantId: string,
  sessionId: string,
  cohortId: string,
  sessionInstant: Date,
  cohortTimeZone: string,
): Promise<void> {
  const applicant = await getApplicantContact(admin, applicantId);
  if (!applicant) return;

  const dayName = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: cohortTimeZone }).format(sessionInstant);

  await notifyMember({
    admin,
    applicantId,
    notificationType: "missed_session_followup",
    dedupKey: `${applicantId}:missed_session_followup:${sessionId}`,
    contact: applicant.contact,
    subject: "KinKeepers: we missed you",
    emailHtml: `<p>We missed you ${dayName}. The group meets again next week at the same time.</p>${unsubscribeLine(applicant.unsubscribeToken)}`,
    smsBody: `KinKeepers: we missed you ${dayName}. The group meets again next week at the same time. Reply STOP to stop texts.`,
    logContext: { applicant_id: applicantId, cohort_id: cohortId, session_id: sessionId, notification: "missed_session_followup" },
  });
}
