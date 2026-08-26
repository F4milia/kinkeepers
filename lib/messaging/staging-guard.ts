/**
 * Outbound-message safety guardrail. P3/P4/X3 wire real Twilio/Resend
 * sends later; this exists first so none of them can accidentally reach a
 * real caregiver from a non-production environment.
 *
 * Fails closed: an unset or unrecognized APP_ENV is treated as non-production,
 * not as an escape hatch.
 */

const ALLOWLIST_SEPARATOR = ",";

export function isProductionEnvironment(): boolean {
  return process.env.APP_ENV === "production";
}

function getAllowlist(): string[] {
  const raw = process.env.STAGING_MESSAGE_ALLOWLIST ?? "";
  return raw
    .split(ALLOWLIST_SEPARATOR)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Call this immediately before any Twilio/Resend send. Throws if the
 * environment is non-production and the recipient isn't on the staging
 * allowlist - callers should let this throw propagate, not swallow it.
 */
export function assertOutboundMessageAllowed(recipient: string): void {
  if (isProductionEnvironment()) {
    return;
  }

  const normalized = recipient.trim().toLowerCase();
  if (getAllowlist().includes(normalized)) {
    return;
  }

  throw new Error(
    `Blocked outbound message to "${recipient}": APP_ENV is not "production" ` +
      "and this recipient is not on STAGING_MESSAGE_ALLOWLIST.",
  );
}
