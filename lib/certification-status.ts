/**
 * The 60-day expiry-warning window is a real business rule, not a display
 * detail — it needs to compute identically wherever a certification's
 * status is shown (originally the admin roster/detail screens from
 * A4-cert, now also F2's facilitator self-view). Extracted here so the
 * two screens can't drift apart on what "expiring soon" means.
 */
export const CERTIFICATION_EXPIRY_WARNING_DAYS = 60;

export interface CertificationExpiryStatus {
  isExpired: boolean;
  isExpiringSoon: boolean;
}

export function computeCertificationExpiryStatus(
  expiresOn: string,
  now: Date = new Date(),
): CertificationExpiryStatus {
  const today = now.toISOString().slice(0, 10);
  const warningDate = new Date(now.getTime() + CERTIFICATION_EXPIRY_WARNING_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);

  return {
    isExpired: expiresOn < today,
    isExpiringSoon: expiresOn >= today && expiresOn <= warningDate,
  };
}
