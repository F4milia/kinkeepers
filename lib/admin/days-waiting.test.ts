import { describe, expect, it } from "vitest";
import { daysSince } from "@/lib/admin/days-waiting";

describe("daysSince", () => {
  it("returns 0 for a null timestamp", () => {
    expect(daysSince(null)).toBe(0);
  });

  it("returns 0 for a timestamp from right now", () => {
    expect(daysSince(new Date().toISOString())).toBe(0);
  });

  it("returns the correct whole number of elapsed days", () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 86_400_000).toISOString();
    expect(daysSince(fiveDaysAgo)).toBe(5);
  });

  it("clamps a future timestamp to 0, never negative", () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    expect(daysSince(tomorrow)).toBe(0);
  });

  it("floors a partial day rather than rounding", () => {
    const almostTwoDays = new Date(Date.now() - (2 * 86_400_000 - 1000)).toISOString();
    expect(daysSince(almostTwoDays)).toBe(1);
  });
});
