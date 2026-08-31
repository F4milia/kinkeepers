import { test, expect } from "@playwright/test";

// Every page that exists today renders from lib/fixtures (no real backend
// yet - L5, Wave 8, swaps that). This just proves each one actually
// renders without crashing; it's not testing product behavior, since
// there's no real interactive flow to exercise yet.
//
// /components (the dev-only component gallery) is deliberately excluded
// here and covered separately below - it's not supposed to render in a
// production build (this config always builds for production, see
// playwright.config.ts's webServer command), so "renders successfully"
// would be the wrong assertion for it. It also lives inside (caregiver),
// so as of L1 it's covered by the CAREGIVER_ROUTES redirect block below
// rather than its own dedicated test - see that block's comment.
//
// The (caregiver) routes are NOT in this list (see the dedicated
// unauthenticated-redirect block below) - as of L1 they require a real
// signed-in session, so an unauthenticated Playwright visitor would just
// be redirected to /sign-in, making "renders without a client-side error"
// silently test the wrong page. (applicant)/(facilitator) stay here - L1
// only gated the caregiver route group, not those demo surfaces.
const PAGES = [
  { path: "/sign-in", name: "sign-in" },
  { path: "/status/applicant-waiting-review", name: "applicant status — waiting for review" },
  { path: "/status/applicant-waitlisted", name: "applicant status — waitlisted" },
  { path: "/status/applicant-assigned", name: "applicant status — assigned" },
  { path: "/status/applicant-complete", name: "applicant status — program complete" },
  { path: "/facilitator", name: "facilitator home" },
  { path: "/facilitator/schedule", name: "facilitator schedule" },
  { path: "/refer/riverside-health", name: "referral landing — valid partner slug" },
  { path: "/refer/not-a-real-slug", name: "referral landing — invalid partner slug" },
];

for (const { path, name } of PAGES) {
  test(`${name} page (${path}) renders without a client-side error`, async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    const response = await page.goto(path);
    expect(response?.ok()).toBe(true);
    expect(pageErrors).toEqual([]);
  });
}

// L1: every (caregiver) route now requires a signed-in session -
// unauthenticated access redirects to /sign-in rather than rendering
// fixture content to anyone who shows up. Same pattern as
// admin-access.spec.ts's unauthenticated-refusal coverage for /admin.
//
// /components is included here, not given its own 404 assertion anymore:
// the layout's auth redirect now runs before the page's own
// `if (NODE_ENV === "production") notFound()` check ever executes, so an
// unauthenticated visitor lands on /sign-in (like any other caregiver
// route) rather than a 404. The underlying guarantee - the dev gallery
// never actually renders in production - still holds either way; only the
// specific status code changed. The notFound() path (an authenticated
// visitor in production) still exists in the page itself, unchanged, but
// isn't covered here - there's no Playwright infrastructure yet for a
// real signed-in browser context (same limitation admin-access.spec.ts
// notes for /admin's wrong-role case).
const CAREGIVER_ROUTES = ["/", "/cohort", "/discussion", "/session/session-005", "/components"];

for (const path of CAREGIVER_ROUTES) {
  test(`${path} redirects an unauthenticated visitor to /sign-in`, async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    const response = await page.goto(path);
    expect(response?.ok()).toBe(true);
    expect(pageErrors).toEqual([]);
    await expect(page).toHaveURL(/\/sign-in$/);
  });
}
