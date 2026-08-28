// Shared with lib/admin/waitlist.ts. Split out because lib/admin/applicants.ts
// is a "use server" file, which may only export async functions - this
// is the same constraint that split lib/admin/decline-reasons.ts out.
export function daysSince(isoTimestamp: string | null): number {
  if (!isoTimestamp) return 0;
  const elapsedMs = Date.now() - new Date(isoTimestamp).getTime();
  return Math.max(0, Math.floor(elapsedMs / (24 * 60 * 60 * 1000)));
}
