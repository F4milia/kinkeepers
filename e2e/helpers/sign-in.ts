import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/auth/roles";

// Real signed-in sessions for e2e, via a real magic link captured from
// the local stack's Mailpit catch-all - the same technique proven during
// the 2026-09-04 acceptance-criteria audit (P1), now made reusable.
// admin-access.spec.ts's own header comment named this exact gap ("no
// Playwright infrastructure yet for driving a real Supabase Auth
// sign-in through a browser context") as out of scope when it was
// written; this closes it.
//
// Requires local Supabase's [auth.email.smtp] to be disabled (fixed in
// the same audit pass, PR #128) - with it enabled, local dev/CI sends
// through real Resend instead of Mailpit and this never receives mail.
// Same standard local-dev demo keys as vitest.config.mts and
// playwright.config.ts's own webServer.env - identical on every local
// `supabase start`, only reachable at 127.0.0.1, not a secret. Hardcoded
// directly rather than read from process.env because this file runs in
// the Playwright test-runner process, which (unlike webServer.env) never
// receives the env vars set for the Next.js server under test.
const SUPABASE_URL = "http://127.0.0.1:54361";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const MAILPIT_URL = "http://127.0.0.1:54364";

export function adminClientForE2E() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

export async function createTestUserWithRole(
  role: AppRole,
  opts: { partnerOrganizationId?: string } = {},
) {
  const admin = adminClientForE2E();
  const email = `e2e-${role}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser failed");

  await admin
    .from("profiles")
    .update({ role, partner_organization_id: opts.partnerOrganizationId ?? null })
    .eq("id", data.user.id);

  return { userId: data.user.id, email };
}

async function waitForVerifyLink(email: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/messages`);
    const data = await res.json();
    const msg = data.messages?.find((m: { To?: { Address: string }[] }) =>
      m.To?.some((t) => t.Address === email),
    );
    if (msg) {
      const fullRes = await fetch(`${MAILPIT_URL}/api/v1/message/${msg.ID}`);
      const full = await fullRes.json();
      const text: string = full.Text || full.HTML;
      const match = text.match(/https?:\/\/[^\s"'<>]+auth\/v1\/verify\?[^\s"'<>]+/);
      if (match) return match[0].replace(/&amp;/g, "&");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`magic link email for ${email} never arrived in Mailpit`);
}

// Drives the actual /sign-in form and a real emailed link, exactly the
// path a real user takes - never a shortcut that bypasses the app's own
// code. `page` must already be on a fresh, unauthenticated context.
export async function signInAsRealUser(page: Page, email: string) {
  await page.goto("/sign-in", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', email);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1000);

  const verifyLink = await waitForVerifyLink(email);
  await page.goto(verifyLink, { waitUntil: "networkidle" });
}
