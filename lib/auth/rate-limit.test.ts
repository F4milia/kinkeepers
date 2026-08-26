import { describe, expect, it, beforeEach, afterAll } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkSignInRateLimit } from "@/lib/auth/rate-limit";

// Integration test against the local Supabase stack (`supabase start`),
// exercising the exact acceptance criterion: "Sixth code request in an
// hour is refused." Uses the real sign_in_events table, not a mock, since
// the thing worth verifying is the SQL query's time-window logic.
const identifier = "rate-limit-test@example.com";
const admin = createAdminClient();

async function clearEvents() {
  await admin.from("sign_in_events").delete().eq("identifier", identifier);
}

async function seedSentEvents(count: number, ageMs = 0) {
  const createdAt = new Date(Date.now() - ageMs).toISOString();
  await admin.from("sign_in_events").insert(
    Array.from({ length: count }, () => ({
      identifier,
      method: "email_link" as const,
      outcome: "sent" as const,
      created_at: createdAt,
    })),
  );
}

describe("checkSignInRateLimit", () => {
  beforeEach(clearEvents);
  afterAll(clearEvents);

  it("allows the request when under both limits", async () => {
    await seedSentEvents(4);
    const result = await checkSignInRateLimit(identifier);
    expect(result.allowed).toBe(true);
  });

  it("refuses the 6th request within an hour (5 already sent)", async () => {
    await seedSentEvents(5);
    const result = await checkSignInRateLimit(identifier);
    expect(result).toEqual({ allowed: false, retryReason: "hourly" });
  });

  it("does not count events older than an hour toward the hourly limit", async () => {
    await seedSentEvents(5, 2 * 60 * 60 * 1000); // 2 hours ago
    const result = await checkSignInRateLimit(identifier);
    expect(result.allowed).toBe(true);
  });

  it("refuses the 16th request within a day even if the hourly window is clear", async () => {
    // 15 sent 90 minutes ago (outside the 1h window, inside the 24h window)
    await seedSentEvents(15, 90 * 60 * 1000);
    const result = await checkSignInRateLimit(identifier);
    expect(result).toEqual({ allowed: false, retryReason: "daily" });
  });
});
