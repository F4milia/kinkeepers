import { describe, expect, it } from "vitest";
import { normalizeToE164, matchPhoneParticipants } from "@/lib/zoom/phone-matching";
import type { ZoomParticipant } from "@/lib/zoom/attendance";

function participant(overrides: Partial<ZoomParticipant> = {}): ZoomParticipant {
  return {
    participantId: "p1",
    name: "+1 512-555-0101",
    email: null,
    joinTime: "2026-09-04T22:30:00Z",
    leaveTime: "2026-09-05T00:00:00Z",
    durationMinutes: 90,
    ...overrides,
  };
}

describe("normalizeToE164", () => {
  it("normalizes a plain 10-digit number", () => {
    expect(normalizeToE164("5125550101")).toBe("+15125550101");
  });

  it("normalizes a formatted 10-digit number (dashes, parens, spaces)", () => {
    expect(normalizeToE164("(512) 555-0101")).toBe("+15125550101");
  });

  it("normalizes an 11-digit number with a leading 1", () => {
    expect(normalizeToE164("15125550101")).toBe("+15125550101");
  });

  it("normalizes an already-E.164 number", () => {
    expect(normalizeToE164("+1 512-555-0101")).toBe("+15125550101");
  });

  it("does not guess at a non-US-shaped number (wrong digit count)", () => {
    expect(normalizeToE164("442071234567")).toBeNull();
  });

  it("does not guess at a string that isn't phone-shaped at all", () => {
    expect(normalizeToE164("Denise Miller")).toBeNull();
  });
});

describe("matchPhoneParticipants", () => {
  const members = [
    { applicantId: "app-1", phone: "512-555-0101" },
    { applicantId: "app-2", phone: "+15125550102" },
    { applicantId: "app-3", phone: null },
  ];

  it("matches a phone joiner whose number matches a member, formatting aside", () => {
    const results = matchPhoneParticipants([participant({ participantId: "p1", name: "5125550101" })], members);
    expect(results).toEqual([{ participantId: "p1", status: "matched", applicantId: "app-1" }]);
  });

  it("matches with and without the country code present", () => {
    const results = matchPhoneParticipants(
      [
        participant({ participantId: "p1", name: "15125550101" }),
        participant({ participantId: "p2", name: "5125550102" }),
      ],
      members,
    );
    expect(results).toEqual([
      { participantId: "p1", status: "matched", applicantId: "app-1" },
      { participantId: "p2", status: "matched", applicantId: "app-2" },
    ]);
  });

  it("surfaces an unmatched phone joiner as unidentified with only the last 4 digits", () => {
    const results = matchPhoneParticipants([participant({ participantId: "p1", name: "5125559999" })], members);
    expect(results).toEqual([{ participantId: "p1", status: "unidentified", last4: "9999" }]);
  });

  it("never guesses a partial match for a similar-but-different number", () => {
    // Differs from app-1's 5125550101 by one digit - must not be matched.
    const results = matchPhoneParticipants([participant({ participantId: "p1", name: "5125550109" })], members);
    expect(results).toEqual([{ participantId: "p1", status: "unidentified", last4: "0109" }]);
  });

  it("skips a video/named participant entirely - not a phone-shaped name, not this module's concern", () => {
    const results = matchPhoneParticipants([participant({ participantId: "p1", name: "Denise Miller" })], members);
    expect(results).toEqual([]);
  });

  it("skips a member with no phone on file when building the match set", () => {
    const results = matchPhoneParticipants([participant({ participantId: "p1", name: "5125550101" })], [
      { applicantId: "app-3", phone: null },
    ]);
    expect(results).toEqual([{ participantId: "p1", status: "unidentified", last4: "0101" }]);
  });
});
