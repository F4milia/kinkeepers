import { test, expect } from "@playwright/test";

// A1's acceptance criterion: "Direct URL access to an unpermitted route
// returns a refusal, not a blank page." Every Playwright browser context
// starts with no session, so this exercises the real, unauthenticated
// case through actual Next.js routing (not a mocked/injected client, the
// way lib/admin/require-role-or-refuse.test.ts covers the wrong_role and
// signed_out branches directly at the function level).
//
// The signed-in wrong-role case (e.g. a facilitator hitting
// /admin/partners) isn't covered here - there's no Playwright
// infrastructure yet for driving a real Supabase Auth sign-in through a
// browser context (magic link / SMS code), and building that is out of
// scope for this PR. lib/admin/require-role-or-refuse.test.ts covers
// that case directly instead.
const ADMIN_ROUTES = [
  "/admin",
  "/admin/cohorts",
  "/admin/reports",
  "/admin/partners",
  "/admin/partners/new",
  // requireRoleOrRefuse runs before getPartnerOrganization's not-found
  // check, so an unauthenticated visitor gets the refusal without ever
  // needing this id to resolve to a real row.
  "/admin/partners/00000000-0000-0000-0000-000000000000/edit",
];

for (const path of ADMIN_ROUTES) {
  test(`${path} refuses an unauthenticated visitor instead of crashing or going blank`, async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    const response = await page.goto(path);
    expect(response?.ok()).toBe(true);
    expect(pageErrors).toEqual([]);

    await expect(page.getByText("Access not available")).toBeVisible();
    await expect(page.getByText("You need to sign in to view this page.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });
}
