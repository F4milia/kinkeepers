import { describe, expect, it } from "vitest";
import { handlePing } from "@/lib/inngest/functions/ping";

describe("handlePing", () => {
  it("resolves ok - proves the Inngest wiring's actual logic runs, independent of the framework plumbing around it", async () => {
    await expect(handlePing()).resolves.toEqual({ ok: true });
  });
});
