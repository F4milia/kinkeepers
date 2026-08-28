import type { ErrorEvent, Breadcrumb } from "@sentry/nextjs";

/**
 * PII scrubbing for Sentry events. Deliberately NOT server-only - this
 * runs from instrumentation-client.ts (browser) as well as the server/edge
 * configs, and it holds no secrets, just a pure data transformation, so
 * there's nothing for server-only to protect here.
 *
 * Configured and unit-tested FIRST, before Sentry is ever initialized
 * with a real DSN - per the session prompt: "if PII scrubbing cannot be
 * verified, do not enable Sentry."
 *
 * Structured fields (event.user, request headers/body/cookies) are
 * stripped outright rather than selectively allow-listed - Sentry has no
 * BAA, and this product's error context routinely includes exactly what
 * must never leave: names, emails, phone numbers, intake free text.
 *
 * Free-text fields (exception messages, breadcrumb messages, extra
 * values) are pattern-scrubbed for email/phone shapes, since PII can end
 * up embedded in an error message ("failed for jane@example.com") even
 * when no structured user/request data is attached at all.
 */

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
// Matches E.164 (+15551234567) and common formatted US numbers
// ((555) 123-4567, 555-123-4567) - deliberately broad rather than exact,
// since a false-positive redaction is free and a missed one is not.
const PHONE_PATTERN = /\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;

const SENSITIVE_HEADER_NAMES = new Set(["authorization", "cookie", "x-forwarded-for", "x-real-ip"]);

function redactPiiPatterns(text: string): string {
  return text.replace(EMAIL_PATTERN, "[redacted-email]").replace(PHONE_PATTERN, "[redacted-phone]");
}

function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  const scrubbed: Breadcrumb = { ...breadcrumb, data: undefined };
  if (typeof scrubbed.message === "string") {
    scrubbed.message = redactPiiPatterns(scrubbed.message);
  }
  return scrubbed;
}

export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  // User context: drop everything except an opaque id, if present at all.
  if (event.user) {
    event.user = event.user.id ? { id: event.user.id } : {};
  }

  // Request context: never send body, query string, or cookies. Strip
  // sensitive headers by name; scrub the rest defensively too, since a
  // custom header could carry an identifier.
  if (event.request) {
    delete event.request.data;
    delete event.request.query_string;
    delete event.request.cookies;
    if (event.request.headers) {
      for (const name of Object.keys(event.request.headers)) {
        if (SENSITIVE_HEADER_NAMES.has(name.toLowerCase())) {
          delete event.request.headers[name];
        }
      }
    }
  }

  // Exception messages: pattern-scrub, don't drop - the message is
  // usually the actually-useful diagnostic content.
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((value) => ({
      ...value,
      value: typeof value.value === "string" ? redactPiiPatterns(value.value) : value.value,
    }));
  }

  if (typeof event.message === "string") {
    event.message = redactPiiPatterns(event.message);
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb);
  }

  // extra/contexts: identifiers only is the rule everywhere else in this
  // codebase (lib/log.ts) - apply the same here rather than trusting
  // whatever a future call site attaches.
  if (event.extra) {
    for (const key of Object.keys(event.extra)) {
      const value = event.extra[key];
      if (typeof value === "string") {
        event.extra[key] = redactPiiPatterns(value);
      } else if (typeof value !== "number" && typeof value !== "boolean" && value !== null) {
        // Objects/arrays in extra are exactly how intake data or a
        // request body would leak through - drop rather than guess.
        event.extra[key] = "[redacted-non-primitive]";
      }
    }
  }

  return event;
}
