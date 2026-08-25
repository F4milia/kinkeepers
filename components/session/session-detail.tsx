"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { COPY, format } from "@/lib/copy";
import { formatSessionDay, formatSessionTimeRange } from "@/lib/format-date";
import type { Session } from "@/lib/fixtures";

export interface SessionDetailProps {
  session: Session;
}

// Session detail (caregiver view) | Part 3.4: heading, date/time, location,
// attending count, what we'll cover, materials, one primary action, and a
// plain, guilt-free way to say they can't attend — no copy beyond Part 3.1.
// Past sessions swap the last two for "What we covered": there's no join
// action for something already over.
export function SessionDetail({ session }: SessionDetailProps) {
  const [markedAbsent, setMarkedAbsent] = useState(false);
  const isUpcoming = session.status === "upcoming";
  const attendingCount = isUpcoming ? session.attendingCount : session.attendance?.present;

  return (
    <div className="flex flex-col gap-section">
      <div>
        <h1 className="text-h2">{format(COPY.home.progress, { n: session.sessionNumber, total: session.sessionTotal })}</h1>
        <p className="mt-2 text-body-lg font-ui text-ink-soft">
          {formatSessionDay(session.date)}
          {" · "}
          {formatSessionTimeRange(session.time, session.durationMinutes, session.timeZoneLabel)}
        </p>
      </div>

      <div className="self-start">
        <Badge variant="neutral">
          {session.deliveryFormat === "video" ? COPY.session.location_video : COPY.session.location_person}
        </Badge>
      </div>

      {typeof attendingCount === "number" && (
        <p className="text-body font-ui text-ink">{format(COPY.session.attending, { n: attendingCount })}</p>
      )}

      {session.topic && (
        <section className="flex flex-col gap-2">
          <h2 className="text-h3">{isUpcoming ? COPY.session.topic : COPY.session.past_notes}</h2>
          <p className="text-body font-ui text-ink">{session.topic}</p>
        </section>
      )}

      {session.materialsCount > 0 && (
        <div className="flex items-center gap-3 self-start">
          <p className="text-label font-ui text-ink">{COPY.session.materials}</p>
          <Badge variant="neutral">{session.materialsCount}</Badge>
        </div>
      )}

      {isUpcoming &&
        (markedAbsent ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-body font-ui text-ink">{COPY.session.marked_absent}</p>
            <Button variant="quiet" className="w-fit" onClick={() => setMarkedAbsent(false)}>
              {COPY.session.undo_absent}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <Button variant="primary" className="w-full">
              {session.deliveryFormat === "video" ? COPY.home.join_video : COPY.home.get_directions}
            </Button>
            <Button variant="quiet" className="w-fit" onClick={() => setMarkedAbsent(true)}>
              {COPY.session.mark_absent}
            </Button>
          </div>
        ))}
    </div>
  );
}
