import { test, expect } from "@playwright/test";
import { adminClientForE2E, createTestUserWithRole, signInAsRealUser } from "./helpers/sign-in";

// A1's acceptance criterion, the half admin-access.spec.ts's own header
// comment explicitly left uncovered: "the signed-in wrong-role case...
// isn't covered here - there's no Playwright infrastructure yet for
// driving a real Supabase Auth sign-in through a browser context...
// building that is out of scope for this PR." Built during the
// 2026-09-04 acceptance-criteria audit (see e2e/helpers/sign-in.ts) -
// this file is what that comment deferred.
//
// "Nav renders by role" is unit-tested directly (lib/admin/nav.test.ts);
// this file proves the same thing through a real signed-in render, and
// proves the harder half - that a role's own nav omissions are backed by
// a real server-side refusal, not just a hidden link.

test.describe("signed-in wrong-role access", () => {
  test("a facilitator hitting an admin-only route gets a refusal, not a blank page", async ({
    page,
  }) => {
    const { email } = await createTestUserWithRole("facilitator");
    await signInAsRealUser(page, email);

    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    const response = await page.goto("/admin/partners");
    expect(response?.ok()).toBe(true);
    expect(pageErrors).toEqual([]);
    await expect(page.getByText("Access not available")).toBeVisible();
  });

  test("partner staff hitting an admin-only route gets a refusal, not a blank page", async ({
    page,
  }) => {
    const admin = adminClientForE2E();
    const { data: org, error } = await admin
      .from("partner_organizations")
      .insert({ name: "E2E Role Access Org", referral_link_slug: `e2e-role-access-${Date.now()}` })
      .select("id")
      .single();
    if (error || !org) throw error ?? new Error("failed to create partner org");

    const { email } = await createTestUserWithRole("partner_staff", { partnerOrganizationId: org.id });
    await signInAsRealUser(page, email);

    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    const response = await page.goto("/admin/applicants");
    expect(response?.ok()).toBe(true);
    expect(pageErrors).toEqual([]);
    await expect(page.getByText("Access not available")).toBeVisible();
  });

  test("a member hitting any /admin route gets a refusal, not a blank page", async ({ page }) => {
    const { email } = await createTestUserWithRole("member");
    await signInAsRealUser(page, email);

    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    const response = await page.goto("/admin");
    expect(response?.ok()).toBe(true);
    expect(pageErrors).toEqual([]);
    await expect(page.getByText("Access not available")).toBeVisible();
  });
});

test.describe("nav renders by role, live", () => {
  test("a facilitator signed in sees only 'My cohorts'", async ({ page }) => {
    const { email } = await createTestUserWithRole("facilitator");
    await signInAsRealUser(page, email);

    await page.goto("/admin/cohorts");
    const nav = page.getByRole("navigation", { name: "Admin navigation" });
    await expect(nav.getByRole("link", { name: "My cohorts" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Partner organizations" })).not.toBeVisible();
    await expect(nav.getByRole("link", { name: "Applicants" })).not.toBeVisible();
  });

  test("partner staff signed in sees Refer someone, Cohorts, and Reports - not Applicants or Partner organizations", async ({
    page,
  }) => {
    const admin = adminClientForE2E();
    const { data: org, error } = await admin
      .from("partner_organizations")
      .insert({ name: "E2E Nav Org", referral_link_slug: `e2e-nav-org-${Date.now()}` })
      .select("id")
      .single();
    if (error || !org) throw error ?? new Error("failed to create partner org");

    const { email } = await createTestUserWithRole("partner_staff", { partnerOrganizationId: org.id });
    await signInAsRealUser(page, email);

    await page.goto("/admin/refer");
    const nav = page.getByRole("navigation", { name: "Admin navigation" });
    await expect(nav.getByRole("link", { name: "Refer someone" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Cohorts" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Reports" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Applicants" })).not.toBeVisible();
    await expect(nav.getByRole("link", { name: "Partner organizations" })).not.toBeVisible();
  });

  test("an admin signed in sees the full nav, including Applicants and Partner organizations", async ({
    page,
  }) => {
    const { email } = await createTestUserWithRole("admin");
    await signInAsRealUser(page, email);

    await page.goto("/admin");
    const nav = page.getByRole("navigation", { name: "Admin navigation" });
    await expect(nav.getByRole("link", { name: "Applicants" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Partner organizations" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Cohorts" })).toBeVisible();
  });
});

test.describe("A1's discussion-content statement, said out loud in the UI", () => {
  // A1's own prompt: "Partner staff never see discussion content... say
  // it out loud in the UI." Found missing entirely during the
  // 2026-09-04 acceptance-criteria audit.
  test("partner staff see the discussion-content statement in the shell", async ({ page }) => {
    const admin = adminClientForE2E();
    const { data: org, error } = await admin
      .from("partner_organizations")
      .insert({ name: "E2E Discussion Statement Org", referral_link_slug: `e2e-discussion-${Date.now()}` })
      .select("id")
      .single();
    if (error || !org) throw error ?? new Error("failed to create partner org");

    const { email } = await createTestUserWithRole("partner_staff", { partnerOrganizationId: org.id });
    await signInAsRealUser(page, email);

    await page.goto("/admin/reports");
    await expect(page.getByText("You never see what caregivers write to each other")).toBeVisible();
  });

  test("an admin does not see the partner-staff-specific statement", async ({ page }) => {
    const { email } = await createTestUserWithRole("admin");
    await signInAsRealUser(page, email);

    await page.goto("/admin");
    await expect(page.getByText("You never see what caregivers write to each other")).not.toBeVisible();
  });
});
