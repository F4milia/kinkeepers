import { defineConfig, devices } from "@playwright/test";

// E2E smoke coverage for what actually exists today (fixture-backed pages,
// no real auth/backend flows yet - those land through L5/Wave 8). ZeroStep's
// AI-driven step definitions aren't wired in yet; that needs its own API key
// (same category as CodeRabbit/Greptile) and is a follow-up once there's a
// real interactive flow worth writing one for, not something to fake now.
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
