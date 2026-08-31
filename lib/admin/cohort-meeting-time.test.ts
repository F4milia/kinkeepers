import { describe, expect, it } from "vitest";
import {
  nextMeetingInstant,
  formatMeetingTime,
  describeCohortMeetingForApplicant,
  generateSessionInstants,
  type CohortMeetingSlot,
} from "@/lib/admin/cohort-meeting-time";

const EASTERN_TUESDAY_EVENING: CohortMeetingSlot = {
  meetingDayOfWeek: 2, // Tuesday
  meetingTime: "18:30",
  timeZone: "America/New_York",
};

describe("nextMeetingInstant", () => {
  it("finds the correct weekday when starting mid-week", () => {
    // Thursday, Jan 14 2027 -> next Tuesday is Jan 19 2027.
    const from = new Date(Date.UTC(2027, 0, 14, 12, 0));
    const instant = nextMeetingInstant(EASTERN_TUESDAY_EVENING, from);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "long",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(instant);
    const get = (type: string) => parts.find((p) => p.type === type)?.value;
    expect(get("weekday")).toBe("Tuesday");
    expect(`${get("year")}-${get("month")}-${get("day")}`).toBe("2027-01-19");
  });

  it("rolls over to next week when `from` is already past this week's slot", () => {
    // Wednesday, Jan 20 2027, 9am - this week's Tuesday slot (Jan 19)
    // already passed, so the next one is Jan 26.
    const from = new Date(Date.UTC(2027, 0, 20, 14, 0));
    const instant = nextMeetingInstant(EASTERN_TUESDAY_EVENING, from);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(instant);
    const get = (type: string) => parts.find((p) => p.type === type)?.value;
    expect(`${get("year")}-${get("month")}-${get("day")}`).toBe("2027-01-26");
  });
});

describe("named edge case: Honolulu applicant, Eastern cohort, across a DST-change week", () => {
  // Hawaii never observes DST (fixed UTC-10 year-round); Eastern does
  // (EST UTC-5 in winter, EDT UTC-4 in summer). A cohort meeting at
  // 6:30 PM Eastern is therefore 1:30 PM Honolulu time in winter but
  // 12:30 PM Honolulu time in summer - the hour must actually shift.
  // Deliberately mid-January and mid-July, not near the real transition
  // dates, so this doesn't depend on knowing the exact (year-specific)
  // Sunday the US clocks change on.

  it("renders 1:30 PM Honolulu time for a winter (EST) occurrence", () => {
    const winterFrom = new Date(Date.UTC(2027, 0, 15)); // Jan 15, 2027
    const instant = nextMeetingInstant(EASTERN_TUESDAY_EVENING, winterFrom);
    const honoluluTime = formatMeetingTime(instant, "Pacific/Honolulu");
    expect(honoluluTime).toContain("1:30");
    expect(honoluluTime).toMatch(/PM/);
  });

  it("renders 12:30 PM Honolulu time for a summer (EDT) occurrence - one hour earlier, same wall time in Eastern", () => {
    const summerFrom = new Date(Date.UTC(2027, 6, 15)); // Jul 15, 2027
    const instant = nextMeetingInstant(EASTERN_TUESDAY_EVENING, summerFrom);
    const honoluluTime = formatMeetingTime(instant, "Pacific/Honolulu");
    expect(honoluluTime).toContain("12:30");
    expect(honoluluTime).toMatch(/PM/);

    const easternTime = formatMeetingTime(instant, "America/New_York");
    expect(easternTime).toContain("6:30");
  });

  it("describeCohortMeetingForApplicant names both zones, applicant's zone first", () => {
    const winterFrom = new Date(Date.UTC(2027, 0, 15));
    const description = describeCohortMeetingForApplicant(
      EASTERN_TUESDAY_EVENING,
      "Pacific/Honolulu",
      winterFrom,
    );
    expect(description).toMatch(/^Tuesday, 1:30\s?PM HST your time \(Tuesday, 6:30\s?PM EST for the group\)$/);
  });
});

describe("generateSessionInstants", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  it("generates the requested count, 7 days apart for weekly cadence", () => {
    const instants = generateSessionInstants("18:30", "America/New_York", "2027-01-05", 7, 6);
    expect(instants).toHaveLength(6);
    for (let i = 1; i < instants.length; i++) {
      const diffDays = (instants[i].getTime() - instants[i - 1].getTime()) / DAY_MS;
      // Tolerant of a 1-hour DST shift landing between two consecutive
      // sessions (checked explicitly by the DST test below) - a plain
      // scheduling error (wrong cadence entirely) would be off by a full
      // day or more, well outside this range.
      expect(diffDays).toBeGreaterThan(6.9);
      expect(diffDays).toBeLessThan(7.1);
    }
  });

  it("uses 14-day spacing for biweekly cadence", () => {
    const instants = generateSessionInstants("18:30", "America/New_York", "2027-01-05", 14, 3);
    expect(instants).toHaveLength(3);
    const diffDays = (instants[1].getTime() - instants[0].getTime()) / DAY_MS;
    expect(diffDays).toBeGreaterThan(13.9);
    expect(diffDays).toBeLessThan(14.1);
  });

  it("keeps the wall-clock time correct in the cohort's own zone across a real DST transition", () => {
    // Six weekly sessions from mid-February through late March span the
    // actual US spring-forward transition, whichever exact Sunday it
    // falls on in a given year - each instant is computed independently
    // (not by adding milliseconds to the previous one), so every session
    // should still read 6:30 PM in Eastern regardless of which side of
    // the transition it lands on.
    const instants = generateSessionInstants("18:30", "America/New_York", "2027-02-16", 7, 6);
    for (const instant of instants) {
      expect(formatMeetingTime(instant, "America/New_York")).toContain("6:30");
    }
  });

  it("starts on the given first session date, not the next occurrence of some weekday", () => {
    const instants = generateSessionInstants("18:30", "America/New_York", "2027-03-10", 7, 1);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(instants[0]);
    const get = (type: string) => parts.find((p) => p.type === type)?.value;
    expect(`${get("year")}-${get("month")}-${get("day")}`).toBe("2027-03-10");
  });
});
