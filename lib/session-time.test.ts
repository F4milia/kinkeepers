import { describe, expect, it } from "vitest";
import { sessionDateTimeFields, zoneFriendlyLabel } from "@/lib/session-time";

describe("zoneFriendlyLabel", () => {
  it("maps a known US IANA zone to its friendly region name", () => {
    expect(zoneFriendlyLabel("America/New_York")).toBe("Eastern");
    expect(zoneFriendlyLabel("America/Los_Angeles")).toBe("Pacific");
  });

  it("falls back to the raw identifier for an unmapped zone, rather than guessing", () => {
    expect(zoneFriendlyLabel("Europe/London")).toBe("Europe/London");
  });
});

describe("sessionDateTimeFields", () => {
  it("renders an instant in the given zone as fixture-shaped date/time/timeZoneLabel", () => {
    // 2026-09-01 22:30 UTC = 6:30 PM Eastern (EDT, UTC-4) on the same calendar day.
    const instant = new Date("2026-09-01T22:30:00Z");
    const fields = sessionDateTimeFields(instant, "America/New_York");
    expect(fields).toEqual({ date: "2026-09-01", time: "6:30 PM", timeZoneLabel: "Eastern" });
  });

  it("renders the same instant differently for a different member time zone - the whole point of per-member rendering", () => {
    const instant = new Date("2026-09-01T22:30:00Z");
    const pacific = sessionDateTimeFields(instant, "America/Los_Angeles");
    expect(pacific).toEqual({ date: "2026-09-01", time: "3:30 PM", timeZoneLabel: "Pacific" });
  });

  it("crosses a calendar day boundary correctly for a zone far enough away", () => {
    // 2026-09-01 22:30 UTC is already 2026-09-02 07:30 in Honolulu... no,
    // Honolulu is UTC-10, so 22:30 UTC - 10h = 12:30 same day. Use a
    // late-UTC instant that genuinely crosses midnight in Honolulu instead.
    const instant = new Date("2026-09-02T05:00:00Z");
    const fields = sessionDateTimeFields(instant, "Pacific/Honolulu");
    expect(fields).toEqual({ date: "2026-09-01", time: "7:00 PM", timeZoneLabel: "Hawaii" });
  });
});
