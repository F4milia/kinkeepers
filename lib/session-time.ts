import "server-only";
import { getWallClockParts } from "@/lib/admin/cohort-meeting-time";

/**
 * Friendly US region labels ("Eastern", not "EST"/"America/New_York") -
 * matches the exact style already used throughout lib/fixtures/data.ts.
 * Every cohort/session time zone collected so far is a US IANA zone
 * (L2's intake form and A3's cohort creation both only offer these) - an
 * unmapped zone falls back to the raw IANA identifier rather than
 * guessing a label, since a wrong region name is worse than a technical
 * one for this audience.
 */
const FRIENDLY_ZONE_LABELS: Record<string, string> = {
  "America/New_York": "Eastern",
  "America/Chicago": "Central",
  "America/Denver": "Mountain",
  "America/Phoenix": "Arizona",
  "America/Los_Angeles": "Pacific",
  "America/Anchorage": "Alaska",
  "Pacific/Honolulu": "Hawaii",
};

export function zoneFriendlyLabel(timeZone: string): string {
  return FRIENDLY_ZONE_LABELS[timeZone] ?? timeZone;
}

/**
 * Converts a real instant (sessions.scheduled_at) into the fixture-shaped
 * date/time/timeZoneLabel fields every session-rendering component
 * already consumes - so lib/data.ts can hand these components real data
 * without any of them needing to change. Rendered in `timeZone` (the
 * member's own applicants.time_zone when known, the cohort's otherwise -
 * same fallback already established for messaging in
 * lib/messaging/session-notifications.ts's describeInstantForMember).
 *
 * `time` is deliberately 12-hour with AM/PM ("6:30 PM"), matching
 * lib/format-date.ts's parseTimeLabel, which every consumer of
 * Session.time already parses with that exact format.
 */
export function sessionDateTimeFields(
  instant: Date,
  timeZone: string,
): { date: string; time: string; timeZoneLabel: string } {
  const wall = getWallClockParts(instant, timeZone);
  const date = `${wall.year}-${String(wall.month).padStart(2, "0")}-${String(wall.day).padStart(2, "0")}`;
  const time = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", hour12: true }).format(
    instant,
  );
  return { date, time, timeZoneLabel: zoneFriendlyLabel(timeZone) };
}
