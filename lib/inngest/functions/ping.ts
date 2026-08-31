import { inngest } from "@/lib/inngest/client";
import { log } from "@/lib/log";

// Pure logic, separate from the Inngest wiring below - same "testable
// logic in lib/, thin framework wrapper on top" split already used for
// Server Actions and API routes elsewhere in this codebase (e.g.
// app/api/health/route.ts delegates to lib/health/check-health.ts).
export async function handlePing(): Promise<{ ok: true }> {
  log("inngest_ping_received");
  return { ok: true };
}

/**
 * Proves the Inngest wiring works end-to-end (registered function,
 * served route, real event delivery) before any function with actual
 * business logic exists - same "scaffold ahead of the consuming
 * feature" pattern P3's Zoom client used ahead of A3 consuming it.
 * Triggered by a "kinkeepers/ping" event sent manually via the Inngest
 * dev server UI or `inngest.send()` - not wired to any real trigger.
 */
export const pingFunction = inngest.createFunction(
  { id: "ping", triggers: { event: "kinkeepers/ping" } },
  handlePing,
);
