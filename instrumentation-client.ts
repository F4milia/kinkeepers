// Browser-side Sentry init. See sentry.server.config.ts for why this
// stays inert (no dsn) until a real KinKeepers Sentry project exists.

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

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
