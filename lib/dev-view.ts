export type DevView = "caregiver" | "facilitator";

/**
 * Demo scaffolding only, not a product feature — lets a presenter flip the
 * /session screen between the caregiver and facilitator views without two
 * logins. Persisted as a cookie (same approach as kk_theme) so the server
 * component that picks which view to render gets it on first paint, no
 * flash — a short lifetime is enough since this is a demo control, not a
 * real preference worth remembering for a year.
 */
export const DEV_VIEW_COOKIE = "kk_dev_view";
export const DEV_VIEW_COOKIE_MAX_AGE = 60 * 60 * 24; // 1 day

export function isDevView(value: string | undefined | null): value is DevView {
  return value === "caregiver" || value === "facilitator";
}
