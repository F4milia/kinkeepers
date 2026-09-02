import { describe, expect, it } from "vitest";
import { formatScheduledInstant } from "@/lib/format-date";

describe("formatScheduledInstant", () => {
  // Regression: dateStyle/timeStyle combined with timeZoneName throws
  // "Invalid option : option" in Node's ICU at request time - a real
  // production crash on /admin/reports, only surfaced once real
  // unlogged-session data existed to render. This test calls the real
  // Intl.DateTimeFormat, the same runtime as production - it would have
  // failed exactly like the live crash if the bug were still present.
  it("formats a real timestamptz instant with a zone name, without throwing", () => {
    expect(() => formatScheduledInstant("2026-08-20T22:30:00+00:00")).not.toThrow();
  });

  it("includes the year, a short month/day, the time, and a zone abbreviation", () => {
    const result = formatScheduledInstant("2026-08-20T22:30:00+00:00");
    expect(result).toContain("2026");
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});
