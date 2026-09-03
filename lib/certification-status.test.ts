import { describe, expect, it } from "vitest";
import { computeCertificationExpiryStatus, CERTIFICATION_EXPIRY_WARNING_DAYS } from "@/lib/certification-status";

const NOW = new Date("2026-06-15T12:00:00Z");

describe("computeCertificationExpiryStatus", () => {
  it("is expired when expires_on is before today", () => {
    expect(computeCertificationExpiryStatus("2026-06-14", NOW)).toEqual({
      isExpired: true,
      isExpiringSoon: false,
    });
  });

  it("is not expired when expires_on is today", () => {
    expect(computeCertificationExpiryStatus("2026-06-15", NOW)).toEqual({
      isExpired: false,
      isExpiringSoon: true,
    });
  });

  it("is expiring soon when expires_on is within the warning window", () => {
    expect(computeCertificationExpiryStatus("2026-07-01", NOW)).toEqual({
      isExpired: false,
      isExpiringSoon: true,
    });
  });

  it("is exactly on the warning boundary (inclusive)", () => {
    const boundary = new Date(NOW.getTime() + CERTIFICATION_EXPIRY_WARNING_DAYS * 86_400_000)
      .toISOString()
      .slice(0, 10);
    expect(computeCertificationExpiryStatus(boundary, NOW)).toEqual({
      isExpired: false,
      isExpiringSoon: true,
    });
  });

  it("is neither expired nor expiring soon when well beyond the warning window", () => {
    expect(computeCertificationExpiryStatus("2027-01-01", NOW)).toEqual({
      isExpired: false,
      isExpiringSoon: false,
    });
  });
});
