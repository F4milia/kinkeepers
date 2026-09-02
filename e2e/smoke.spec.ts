import { test, expect } from "@playwright/test";

// L5: most pages here now render from real endpoints (lib/data.ts), not
// lib/fixtures - the applicant-status ids below are real rows seeded in
// supabase/seed.sql specifically for this file, not fixture slugs. This
// still just proves each one renders without a client-side error, not
// full product behavior.
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
// silently test the wrong page. /facilitator moved to that same block in
// L5, once it got the same auth gate (it had none before - see
// lib/data.ts's PR description). (applicant) stays here - that route is
// deliberately pre-auth by design (see lib/data.ts's getApplicant).
//
// The old fixture-only "waitlisted" (pending review, no matching cohort)
// state isn't seeded or tested here anymore: hasMatchingCohort is
// hardcoded true in lib/data.ts (confirmed with Ferenz - no real
// matching signal exists without inventing one near CLAUDE.md's
// no-auto-matcher invariant), so every pending_review applicant renders
// "waiting for review" now and that branch is unreachable with real data.
//
// The three /status/[applicantId] states below moved out of this
// render-only loop into their own dedicated tests further down, each
// asserting the actual rendered copy - a real shipped bug (a boolean
// inversion in getApplicant's hasMatchingCohort, caught by Stream B
// while rebasing against this same PR) rendered without any client-side
// error on the WRONG branch, so "renders without a client-side error"
// alone was never going to catch it.
const PAGES = [
  { path: "/sign-in", name: "sign-in" },
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

// L4/L5: real content assertions, not just "no client-side error" - see
// the comment above PAGES for why a render-only check isn't enough here.
test("applicant status — pending review renders the generic 'still finding' state", async ({ page }) => {
  await page.goto("/status/88888888-0000-0000-0000-000000000001");
  await expect(page.getByText("We're finding your group")).toBeVisible();
  await expect(page.getByText("You're on the list")).toHaveCount(0);
});

test("applicant status — enrolled renders the assigned-session state with a real date", async ({ page }) => {
  await page.goto("/status/88888888-0000-0000-0000-000000000502");
  await expect(page.getByText("Your first session")).toBeVisible();
});

test("applicant status — completed renders the program-complete state", async ({ page }) => {
  await page.goto("/status/88888888-0000-0000-0000-000000000503");
  await expect(page.getByText("You've completed the program")).toBeVisible();
});

// L4 acceptance criteria, checked directly against the real backend.
//
// "The waitlist names the specific grouping sought" is NOT covered here,
// even though L4 built it (Waitlisted, in app/(applicant)/status -
// [applicantId]/page.tsx, keyed off hasMatchingCohort === false): per the
// PAGES comment above, hasMatchingCohort is hardcoded true in
// getApplicant() because no real "does a matching cohort exist" signal
// exists yet, so that branch is unreachable with real data today, not
// just untested. Re-add this once a real signal exists to drive it.
test("applicant status — waiting-for-review shows the support phone number", async ({ page }) => {
  await page.goto("/status/88888888-0000-0000-0000-000000000001");
  await page.getByRole("button", { name: "Get help now" }).click();
  await expect(page.getByRole("link", { name: "Call 1-800-555-0142" })).toBeVisible();
});

test("applicant status — completed has no gamification, no certificate, badge, or celebration language", async ({
  page,
}) => {
  await page.goto("/status/88888888-0000-0000-0000-000000000503");
  await expect(page.getByText("You've completed the program")).toBeVisible();
  for (const term of ["Congratulations", "Certificate", "Badge", "Achievement", "🎉"]) {
    await expect(page.getByText(term)).toHaveCount(0);
  }
});

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
//
// L5: /facilitator and /facilitator/schedule joined this list - that
// route had no auth gate at all before this session (anyone could load
// it), a real gap closed alongside wiring real per-facilitator data
// through it (see lib/data.ts's PR description). The signed-in
// wrong-role case for /facilitator (e.g. a real member hitting it, which
// renders not-found rather than redirecting - see app/facilitator/
// layout.tsx) has the same "no real signed-in browser context yet"
// limitation as the admin wrong-role case above, so isn't covered here.
const CAREGIVER_ROUTES = [
  "/",
  "/cohort",
  "/discussion",
  "/session/session-005",
  "/components",
  "/consent",
  "/facilitator",
  "/facilitator/schedule",
  "/facilitator/certifications",
  // requireRole-equivalent checks inside getSession/getSessionPrepRoster
  // run before any not-found resolution, same reasoning as the admin
  // applicant/partner-edit routes in admin-access.spec.ts - an
  // unauthenticated visitor gets the redirect without this id ever
  // needing to resolve to a real row.
  "/facilitator/session/00000000-0000-0000-0000-000000000000/prep",
];

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
