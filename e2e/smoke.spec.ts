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
// would be the wrong assertion for it.
const PAGES = [
  { path: "/", name: "home" },
  { path: "/cohort", name: "cohort" },
  { path: "/discussion", name: "discussion" },
  { path: "/session/session-005", name: "session detail" },
  { path: "/status/applicant-waiting-review", name: "applicant status — waiting for review" },
  { path: "/status/applicant-waitlisted", name: "applicant status — waitlisted" },
  { path: "/status/applicant-assigned", name: "applicant status — assigned" },
  { path: "/status/applicant-complete", name: "applicant status — program complete" },
  { path: "/facilitator", name: "facilitator home" },
  { path: "/facilitator/schedule", name: "facilitator schedule" },
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

test("component gallery (/components) is not reachable in a production build", async ({
  page,
}) => {
  const response = await page.goto("/components");
  expect(response?.status()).toBe(404);
});
