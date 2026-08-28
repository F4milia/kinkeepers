// Edge runtime Sentry init (middleware, edge routes). Required locally
// too, not just on Vercel's edge - see sentry.server.config.ts for why
// this stays inert (no dsn) until a real KinKeepers Sentry project exists.

import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/observability/scrub-sentry-event";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  dataCollection: {
    userInfo: false,
    httpBodies: [],
  },
  beforeSend: scrubSentryEvent,
  tracesSampleRate: 0.1,
});
