"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { DeliveryBadge } from "@/components/session/delivery-badge";
import { DialInDetails } from "@/components/session/dial-in-details";
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
 */
export default function CaregiverError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
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
          <DialInDetails dialInNumber={cached.dialInNumber} dialInPin={cached.dialInPin} />
          <p className="text-meta font-ui text-ink-soft">
            {format(COPY.home.progress, { n: cached.sessionNumber, total: cached.sessionTotal })}
          </p>
        </Card>

        <Link href="/" className="min-h-12 text-label font-ui text-action underline underline-offset-2">
          {COPY.errors.not_found.go_home}
        </Link>
      </div>
    );
  }

  return <ErrorState variant="unavailable" onRetry={reset} />;
}
