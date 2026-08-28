// DST-aware conversion between a cohort's recurring weekly meeting slot
// (day of week + time, defined in the cohort's own IANA zone) and any
// other zone - this session's named edge case: "Applicant in Honolulu,
// cohort in Eastern, across a DST-change week — both renderings
// correct." No date library is installed in this project; everything
// here is built on Intl.DateTimeFormat, which is backed by the real
// timezone database and handles DST transitions correctly on its own -
// the only non-trivial part is that JS has no built-in "construct a
// Date from wall-clock components in an arbitrary zone," so
// zonedWallTimeToUtc below uses the standard guess-and-correct
// technique (format a UTC guess in the target zone, measure the
// discrepancy, correct for it).

export interface CohortMeetingSlot {
  /** 0 (Sunday) - 6 (Saturday). */
  meetingDayOfWeek: number;
  /** 24-hour "HH:MM" or "HH:MM:SS", in the cohort's own time zone. */
  meetingTime: string;
  /** IANA identifier, e.g. "America/New_York". */
  timeZone: string;
}

function getWallClockParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // Intl renders midnight as "24" with hour12: false in some engines.
    hour: parts.hour === "24" ? 0 : Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function timeZoneOffsetMinutes(instant: Date, timeZone: string): number {
  const wall = getWallClockParts(instant, timeZone);
  const asUtcMs = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  return (asUtcMs - instant.getTime()) / 60000;
}

/**
 * The real UTC instant that a given wall-clock date/time represents in
 * `timeZone`. Converges in one correction for almost every case; two
 * iterations covers the rare instant that lands exactly on a DST
 * transition itself.
 */
function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  let utcGuessMs = Date.UTC(year, month - 1, day, hour, minute);
  for (let i = 0; i < 2; i++) {
    const offsetMinutes = timeZoneOffsetMinutes(new Date(utcGuessMs), timeZone);
    utcGuessMs = Date.UTC(year, month - 1, day, hour, minute) - offsetMinutes * 60000;
  }
  return new Date(utcGuessMs);
}

/**
 * The next real calendar occurrence of a recurring weekly slot, on or
 * after `from`. Returns a genuine Date instant (not a fixed offset
 * applied to `from`), so any later formatting - in the cohort's zone, an
 * applicant's zone, anywhere - reflects whichever side of a DST
 * transition that specific future date actually falls on.
 */
export function nextMeetingInstant(slot: CohortMeetingSlot, from: Date = new Date()): Date {
  const [hourStr, minuteStr] = slot.meetingTime.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);

  const wall = getWallClockParts(from, slot.timeZone);
  // Day-of-week is a calendar fact, independent of the zone we'll
  // eventually convert to - safe to read it off a plain UTC construction
  // of the same Y/M/D.
  const currentWeekday = new Date(Date.UTC(wall.year, wall.month - 1, wall.day)).getUTCDay();

  let daysUntil = (slot.meetingDayOfWeek - currentWeekday + 7) % 7;
  let candidate = zonedWallTimeToUtc(wall.year, wall.month, wall.day + daysUntil, hour, minute, slot.timeZone);

  if (candidate.getTime() <= from.getTime()) {
    daysUntil += 7;
    candidate = zonedWallTimeToUtc(wall.year, wall.month, wall.day + daysUntil, hour, minute, slot.timeZone);
  }

  return candidate;
}

/** "Tuesday, 6:30 PM EST" - a specific instant, rendered in one zone. */
export function formatMeetingTime(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(instant);
}

/**
 * The sentence A2's assignment screen shows per open cohort: the
 * applicant's own rendering first (what they'd actually need to know),
 * the cohort's own zone alongside it - same "say both" pattern as P4's
 * reminder content.
 */
export function describeCohortMeetingForApplicant(
  slot: CohortMeetingSlot,
  applicantTimeZone: string,
  now: Date = new Date(),
): string {
  const instant = nextMeetingInstant(slot, now);
  const applicantSide = formatMeetingTime(instant, applicantTimeZone);
  const cohortSide = formatMeetingTime(instant, slot.timeZone);
  return `${applicantSide} your time (${cohortSide} for the group)`;
}
