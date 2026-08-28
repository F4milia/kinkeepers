"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { COPY, format } from "@/lib/copy";

/**
 * Root-level error boundary - catches what even app/layout.tsx couldn't
 * render, so this can't depend on AppShell, theme cookies, or anything
 * else that might also be broken. Sentry recommends this file so React
 * rendering errors reach it, same reporting path as everything else
 * (scrubbed first - see lib/observability/scrub-sentry-event.ts).
 *
 * No new copy invented: reuses error.load_failed, error.retry, and
 * support.phoneNumber, all already in the deck. Per CLAUDE.md, the phone
 * number appears in every error state - this is the last-resort one.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center bg-canvas px-6 font-ui text-ink">
        <div className="max-w-content text-center">
          <p className="text-body">{COPY.error.load_failed}</p>
          <p className="mt-4 text-body">{format(COPY.support.call, { phoneNumber: COPY.support.phoneNumber })}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 min-h-14 rounded-control bg-action px-6 text-label text-surface"
          >
            {COPY.error.retry}
          </button>
        </div>
      </body>
    </html>
  );
}
