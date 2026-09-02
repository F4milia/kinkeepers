import "server-only";
import type { ZoomParticipant } from "@/lib/zoom/attendance";

/**
 * X4: Zoom's participant report identifies a phone joiner by the phone
 * number itself in the `name` field, not a name (see
 * lib/zoom/attendance.ts's own doc comment) - P3's video/name-based
 * pre-fill silently misses exactly these joiners, who are disproportionately
 * the members this program exists for (no broadband, can't manage video,
 * hands shake). This module is the missing match step: normalize both
 * sides to E.164, match, and never guess a partial one.
 */

export interface PhoneMatchResult {
  participantId: string;
  status: "matched" | "unidentified";
  applicantId?: string;
  /** Only set when unidentified - last 4 digits only, never the full number, per the prompt's own "Unidentified caller — (last 4 digits)" spec. */
  last4?: string;
}

/**
 * Normalizes to E.164 for a US number (+1XXXXXXXXXX), handling the
 * leading 1 present or absent and arbitrary formatting (dashes, spaces,
 * parens). Returns null rather than guessing when the digit count isn't
 * exactly 10 or 11 (with a leading 1) - "do not guess at partial
 * matches" (X4's own prompt) applies to normalization too: everything
 * collected so far (intake, seed data) is a US number, so an ambiguous
 * or non-US-shaped string is left unmatched, not forced into a shape
 * that might be wrong.
 */
export function normalizeToE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/**
 * `participants` is the full Zoom report (video and phone joiners alike -
 * see getAttendancePreFill). A participant whose `name` doesn't normalize
 * to a phone number at all is a video/named joiner, already handled by
 * P3's own pre-fill matching - not this module's concern, so it's simply
 * skipped rather than reported as unidentified.
 */
export function matchPhoneParticipants(
  participants: ZoomParticipant[],
  memberPhones: Array<{ applicantId: string; phone: string | null }>,
): PhoneMatchResult[] {
  const phoneToApplicant = new Map<string, string>();
  for (const member of memberPhones) {
    if (!member.phone) continue;
    const normalized = normalizeToE164(member.phone);
    if (normalized) phoneToApplicant.set(normalized, member.applicantId);
  }

  const results: PhoneMatchResult[] = [];
  for (const participant of participants) {
    const normalizedParticipant = normalizeToE164(participant.name);
    if (!normalizedParticipant) continue;

    const applicantId = phoneToApplicant.get(normalizedParticipant);
    if (applicantId) {
      results.push({ participantId: participant.participantId, status: "matched", applicantId });
    } else {
      results.push({
        participantId: participant.participantId,
        status: "unidentified",
        last4: normalizedParticipant.slice(-4),
      });
    }
  }
  return results;
}
