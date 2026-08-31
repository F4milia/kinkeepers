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
const CAREGIVER_ROUTES = ["/", "/cohort", "/discussion", "/session/session-005", "/components", "/consent"];

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

// L2: the real flow end to end, against the real backend (not mocked) -
// landing -> Start creates a real applicant row -> the 3-step intake form
// -> confirmation. This is a genuine interaction test, not a render check,
// since a multi-step form with save-on-blur has real behavior to break.
test("L2: full referral and intake flow completes", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  await page.goto("/refer/riverside-health");
  await page.getByRole("button", { name: "Start" }).click();

  await expect(page).toHaveURL(/\/intake\/[0-9a-f-]+$/);
  await expect(page.getByText("Step 1 of 3")).toBeVisible();

  await page.getByLabel("First name").fill("Jordan");
  await page.getByLabel("Last name").fill("Rivera");
  await page.getByLabel("Email").fill("jordan.rivera@example.com");
  await page.getByLabel("Phone").fill("555-0100");
  await page.getByLabel("Phone").blur();
  await expect(page.getByText("We saved your answers.")).toBeVisible();

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Step 2 of 3")).toBeVisible();

  await page.getByLabel("Your relationship to the person you care for").fill("Daughter");
  await page.getByText("I'm not sure").click();
  await page.getByText("Eastern", { exact: true }).click();

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Step 3 of 3")).toBeVisible();

  await page.getByText("Weekday evenings").click();
  await page.getByText("Either").click();

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("We have your information.")).toBeVisible();
  expect(pageErrors).toEqual([]);
});

// Same edge case P2's own test suite already covers at the data layer
// (lib/referral/intake-progress.test.ts) - here it's the actual UI: close
// the tab mid-form, come back via the resume URL, see the same data.
test("L2: resuming via the intake URL directly shows previously saved answers", async ({
  page,
}) => {
  await page.goto("/refer/riverside-health");
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page).toHaveURL(/\/intake\/[0-9a-f-]+$/);
  const intakeUrl = page.url();

  await page.getByLabel("First name").fill("Casey");
  await page.getByLabel("First name").blur();
  await expect(page.getByText("We saved your answers.")).toBeVisible();

  await page.goto("about:blank");
  await page.goto(intakeUrl);
  await expect(page.getByLabel("First name")).toHaveValue("Casey");
});
