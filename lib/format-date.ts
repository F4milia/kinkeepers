/** Formats a fixture date ("2026-09-01") as "Tuesday, September 1", parsed in the viewer's local zone. */
export function formatSessionDay(dateISO: string): string {
  const date = new Date(`${dateISO}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(date);
}

/** Formats a fixture date as "Today" / "1 day ago" / "{n} days ago", relative to now. */
export function formatRelativeDays(dateISO: string, now: Date = new Date()): string {
  const then = new Date(`${dateISO}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((today.getTime() - then.getTime()) / 86_400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

/** Days elapsed since a fixture date, floored at 0 — used for F1's "N days overdue" log status. */
export function daysSince(dateISO: string, now: Date = new Date()): number {
  const then = new Date(`${dateISO}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today.getTime() - then.getTime()) / 86_400_000));
}

/** Formats a fixture date ("2026-08-18") as "August 18, 2026" — used for facilitator log record timestamps. */
export function formatLongDate(dateISO: string): string {
  const date = new Date(`${dateISO}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(date);
}

/** Parses a Part 3.1-style time label ("6:30 PM") into 24h hours/minutes — exported for schedule overlap math (F1). */
export function parseTimeLabel(time: string): { hours: number; minutes: number } {
  const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return { hours: 0, minutes: 0 };
  let hours = parseInt(match[1], 10) % 12;
  if (match[3].toUpperCase() === "PM") hours += 12;
  return { hours, minutes: parseInt(match[2], 10) };
}

function formatTimeLabel(hours: number, minutes: number): string {
  const period = hours % 24 >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
}

/**
 * Formats a session's start time and duration as a range, e.g.
 * "6:30 PM – 8:30 PM Eastern". There's no cleared Part 3.1 copy string for a
 * bare duration unit ("120 min"), so duration is shown as a time range
 * instead — data, not invented copy.
 */
export function formatSessionTimeRange(time: string, durationMinutes: number, timeZoneLabel: string): string {
  const start = parseTimeLabel(time);
  const totalMinutes = start.hours * 60 + start.minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  return `${time} – ${formatTimeLabel(endHours, endMinutes)} ${timeZoneLabel}`;
}
