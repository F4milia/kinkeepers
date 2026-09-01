import { defineConfig, devices } from "@playwright/test";

// E2E smoke coverage. Plain Playwright, permanently - ZeroStep was tried
// directly and doesn't work, this isn't a stopgap pending a fix. See
// CLAUDE.md's Learned constraints.
//
// L5: every page under test used to render from lib/fixtures, so which
// Supabase project .env.local pointed at never mattered for E2E. Now
// that real pages query Supabase during render, it does - and
// .env.local on this machine points at the HOSTED project (so a
// developer can browse real data via `next dev`), which has none of the
// migrations/seed rows this suite depends on. vitest.config.mts and
// supabase/tests already override to the local stack for exactly this
// reason; webServer.env does the same here, using the identical
// standard local-dev demo keys (identical on every `supabase start`,
// only reachable at 127.0.0.1, not a secret) - so the build this suite
// exercises always targets local, regardless of .env.local.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54361",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
      SUPABASE_SERVICE_ROLE_KEY:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
    },
  },
});
