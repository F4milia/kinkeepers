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
