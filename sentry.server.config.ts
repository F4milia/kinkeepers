// Server-side Sentry init. https://docs.sentry.io/platforms/javascript/guides/nextjs/
//
// No SENTRY_DSN exists anywhere for this project yet (KinKeepers needs its
// own Sentry project - reusing another product's DSN would mix unrelated
// error data). Sentry.init with an unset dsn captures nothing, which is
// the correct default state per the session prompt: "if PII scrubbing
// cannot be verified, do not enable Sentry." Scrubbing IS built and
// unit-tested (lib/observability/scrub-sentry-event.ts) - what's NOT done
// is live verification against a real Sentry ingest, which needs a real
// DSN to exist first.

import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/observability/scrub-sentry-event";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // First layer of defense: don't even collect user info or HTTP bodies
  // in the first place, rather than relying solely on beforeSend to strip
  // them after the fact.
  dataCollection: {
    userInfo: false,
    httpBodies: [],
  },

  // Second layer: pattern-scrub whatever's left (exception messages,
  // breadcrumbs, extra context can all carry PII even with dataCollection
  // restricted above).
  beforeSend: scrubSentryEvent,

  tracesSampleRate: 0.1,
});
