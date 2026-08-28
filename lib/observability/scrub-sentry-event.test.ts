import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/observability/scrub-sentry-event";

// A deliberately PII-laden fake event - the "deliberate test error
// containing fake PII" the session prompt calls for, run against the
// scrubber function directly. This is what CAN be verified without a
// real Sentry account: the scrubbing logic itself, exhaustively. Whether
// a real Sentry ingest pipeline receives the scrubbed (not raw) version
// still needs live credentials to confirm - flagged in this PR, not
// something this test can close on its own.
function piiLadenEvent(): ErrorEvent {
  return {
    type: undefined,
    user: { id: "user-123", email: "jane.caregiver@example.com", ip_address: "203.0.113.5" },
    request: {
      headers: {
        Authorization: "Bearer secret-token",
        Cookie: "session=abc123",
        "User-Agent": "Mozilla/5.0",
      },
      data: { relationship: "spouse", careRecipientStage: "early" },
      query_string: "email=jane.caregiver@example.com",
      cookies: { kk_theme: "dark" },
    },
    exception: {
      values: [
        {
          type: "Error",
          value: "Failed to send reminder to jane.caregiver@example.com at +1 (555) 123-4567",
        },
      ],
    },
    message: "Sign-in failed for jane.caregiver@example.com",
    breadcrumbs: [
      {
        message: "Called requestEmailLink for jane.caregiver@example.com",
        data: { email: "jane.caregiver@example.com" },
      },
    ],
    extra: {
      identifier: "jane.caregiver@example.com",
      intakeAnswer: { relationship: "spouse", stage: "early" },
      retryCount: 3,
      succeeded: false,
    },
  };
}

describe("scrubSentryEvent", () => {
  it("reduces user context to an opaque id only", () => {
    const scrubbed = scrubSentryEvent(piiLadenEvent());
    expect(scrubbed.user).toEqual({ id: "user-123" });
    expect(JSON.stringify(scrubbed.user)).not.toContain("jane.caregiver@example.com");
    expect(JSON.stringify(scrubbed.user)).not.toContain("203.0.113.5");
  });

  it("strips request body, query string, cookies, and sensitive headers", () => {
    const scrubbed = scrubSentryEvent(piiLadenEvent());
    expect(scrubbed.request?.data).toBeUndefined();
    expect(scrubbed.request?.query_string).toBeUndefined();
    expect(scrubbed.request?.cookies).toBeUndefined();
    expect(scrubbed.request?.headers?.Authorization).toBeUndefined();
    expect(scrubbed.request?.headers?.Cookie).toBeUndefined();
    // A non-sensitive header survives - this isn't a blanket wipe.
    expect(scrubbed.request?.headers?.["User-Agent"]).toBe("Mozilla/5.0");
  });

  it("redacts an email and phone number embedded in the exception message text", () => {
    const scrubbed = scrubSentryEvent(piiLadenEvent());
    const exceptionText = scrubbed.exception?.values?.[0]?.value ?? "";
    expect(exceptionText).not.toContain("jane.caregiver@example.com");
    expect(exceptionText).not.toContain("555");
    expect(exceptionText).toContain("[redacted-email]");
    expect(exceptionText).toContain("[redacted-phone]");
  });

  it("redacts PII from the top-level event message", () => {
    const scrubbed = scrubSentryEvent(piiLadenEvent());
    expect(scrubbed.message).not.toContain("jane.caregiver@example.com");
    expect(scrubbed.message).toContain("[redacted-email]");
  });

  it("strips breadcrumb data entirely and redacts breadcrumb messages", () => {
    const scrubbed = scrubSentryEvent(piiLadenEvent());
    const breadcrumb = scrubbed.breadcrumbs?.[0];
    expect(breadcrumb?.data).toBeUndefined();
    expect(breadcrumb?.message).not.toContain("jane.caregiver@example.com");
    expect(breadcrumb?.message).toContain("[redacted-email]");
  });

  it("redacts PII in extra string values and drops non-primitive extra values entirely", () => {
    const scrubbed = scrubSentryEvent(piiLadenEvent());
    expect(scrubbed.extra?.identifier).toBe("[redacted-email]");
    expect(scrubbed.extra?.intakeAnswer).toBe("[redacted-non-primitive]");
    // Primitives that aren't PII-shaped survive untouched.
    expect(scrubbed.extra?.retryCount).toBe(3);
    expect(scrubbed.extra?.succeeded).toBe(false);
  });

  it("the fully scrubbed event, serialized, contains no trace of the original PII at all", () => {
    const scrubbed = scrubSentryEvent(piiLadenEvent());
    const serialized = JSON.stringify(scrubbed);
    expect(serialized).not.toContain("jane.caregiver@example.com");
    expect(serialized).not.toContain("555");
    expect(serialized).not.toContain("203.0.113.5");
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("abc123");
    expect(serialized).not.toContain("spouse");
  });

  it("handles an event with none of these fields present without throwing", () => {
    expect(() => scrubSentryEvent({ type: undefined })).not.toThrow();
  });
});
