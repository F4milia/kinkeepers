import { defineConfig, devices } from "@playwright/test";

// E2E smoke coverage for what actually exists today (fixture-backed pages,
// no real auth/backend flows yet - those land through L5/Wave 8). Plain
// Playwright, permanently - ZeroStep was tried directly and doesn't work,
// this isn't a stopgap pending a fix. See CLAUDE.md's Learned constraints.
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
  },
});
