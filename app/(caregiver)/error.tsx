"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { DeliveryBadge } from "@/components/session/delivery-badge";
import { JoinAction } from "@/components/session/join-action";
import { COPY, format } from "@/lib/copy";
import { readNextSessionCache, type CachedNextSession } from "@/components/session/next-session-cache";
import { formatSessionDay } from "@/lib/format-date";

/**
 * Route-segment error boundary for every (caregiver) screen - catches a
 * thrown DataUnavailableError (or anything else a Server Component in
 * this group throws) instead of a blank page or a raw stack trace.
 * error.tsx is always a Client Component per Next.js, which is exactly
 * what this needs: it's the one place that can read the offline
 * next-session cache and show a member on a flaky connection something
 * more useful than a bare retry button.
 *
 * 2026-09-08 L5 acceptance audit: retry deliberately does a full
 * `window.location.reload()`, NOT Next's own `reset` prop. This
 * boundary sits below (caregiver)/layout.tsx in the tree - `reset()`
 * only re-renders what's inside THIS boundary (the page that threw),
 * never the parent layout, which is where the actual auth check
 * (`getCurrentRole()`) lives. If the real cause of the throw was a
 * session that expired mid-request (not a transient network blip), a
 * `reset()`-driven retry would just re-run the same failing data fetch
 * and fail the same way again, with no path to the sign-in screen's
 * correct "you've been signed out" explanation - a real, if narrow,
 * retry-loop gap: L5's own acceptance line requires "auth expiry
 * mid-session recovers cleanly," and a scoped reset() cannot do that. A
 * full reload always re-runs the layout, so an actually-expired session
 * correctly redirects to /sign-in?error=session_expired on retry,
 * while a genuine transient failure just succeeds normally.
 */
export default function CaregiverError() {
  const [cached, setCached] = useState<CachedNextSession | null>(null);

  useEffect(() => {
    setCached(readNextSessionCache());
  }, []);

  if (cached) {
    return (
      <div className="flex flex-col gap-section">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-h3 font-heading text-ink">{COPY.errors.offline.headline}</p>
          <p className="text-body font-ui text-ink-soft">{COPY.errors.offline.body}</p>
        </div>

        <Card className="flex flex-col items-start gap-4">
          <p className="text-h2 font-heading">{formatSessionDay(cached.date)}</p>
          <p className="text-body-lg font-ui text-ink-soft">
            {cached.time} {cached.timeZoneLabel}
          </p>
          <DeliveryBadge format={cached.deliveryFormat} />
          <JoinAction
            session={{
              id: "cached",
              cohortId: "",
              sessionNumber: cached.sessionNumber,
              sessionTotal: cached.sessionTotal,
              status: "upcoming",
              date: cached.date,
              time: cached.time,
              timeZoneLabel: cached.timeZoneLabel,
              durationMinutes: 0,
              deliveryFormat: cached.deliveryFormat,
              topic: null,
              joinUrl: cached.joinUrl,
              dialInNumber: cached.dialInNumber,
              dialInPin: cached.dialInPin,
              materialsCount: 0,
            }}
            className="w-full"
          />
          <p className="text-meta font-ui text-ink-soft">
            {format(COPY.home.progress, { n: cached.sessionNumber, total: cached.sessionTotal })}
          </p>
        </Card>

        {/* 2026-09-08 L5 acceptance audit: this offline-cache view had no
            phone number anywhere - ErrorState (the other branch below)
            always renders one, but this branch, being a separate
            hand-built layout for the cached-session card, didn't inherit
            that. "The phone number appears in every failure state" (L5's
            own acceptance line) applies here too - this is still a
            failure state, just one with something useful to show
            alongside the apology. */}
        <p className="text-meta font-ui text-ink-soft">
          {format(COPY.errors.call_for_help, { phoneNumber: COPY.support.phoneNumber })}
        </p>

        <Link href="/" className="min-h-12 text-label font-ui text-action underline underline-offset-2">
          {COPY.errors.not_found.go_home}
        </Link>
      </div>
    );
  }

  return <ErrorState variant="unavailable" onRetry={() => window.location.reload()} />;
}
