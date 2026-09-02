"use client";

import { useState } from "react";
import type { SVGProps } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JoinAction } from "@/components/session/join-action";
import { DeliveryBadge } from "@/components/session/delivery-badge";
import { DialInDetails } from "@/components/session/dial-in-details";
import { COPY, format } from "@/lib/copy";
import { formatSessionDay, formatSessionTimeRange } from "@/lib/format-date";
import type { Session } from "@/lib/types";

export interface SessionDetailProps {
  session: Session;
}

// Decorative throughout — every icon here sits beside text that already says
// the same thing, so all are aria-hidden and none carry meaning alone.
function IconCalendar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <rect x="3.25" y="5.25" width="17.5" height="15.5" rx="2.5" />
      <path d="M3.25 10h17.5M8 3.25v4M16 3.25v4" strokeLinecap="round" />
    </svg>
  );
}

function IconPeople(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" strokeLinecap="round" />
      <path d="M16 5.5a3.25 3.25 0 0 1 0 6.5M17.5 19.5a5.5 5.5 0 0 0-2-4.2" strokeLinecap="round" />
    </svg>
  );
}

function IconDocument(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" {...props}>
      <path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-5.5-5.5Z" strokeLinejoin="round" />
      <path d="M13.5 3.5V9H19" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Session detail (caregiver view) | Part 3.4: heading, date/time, location,
 * attending count, what we'll cover, materials, one primary action, and a
 * plain, guilt-free way to say they can't attend — no copy beyond Part 3.1.
 * Past sessions swap the last two for "What we covered": there's no join
 * action for something already over.
 *
 * Spacing is grouped rather than uniform. Part 2.3's 40px is a *section*
 * gap; applying it between every element spaced the date, the format, and
 * the headcount as far apart as unrelated sections and left the screen
 * without hierarchy. Facts about the same meeting now sit on the 8px scale
 * inside their group, and 40px separates the groups themselves.
 */
export function SessionDetail({ session }: SessionDetailProps) {
  const [markedAbsent, setMarkedAbsent] = useState(false);
  const isUpcoming = session.status === "upcoming";
  const attendingCount = isUpcoming ? session.attendingCount : session.attendance?.present;

  return (
    <div className="flex flex-col gap-section">
      {/* When and how — one block, tight internal rhythm. */}
      <header className="flex flex-col items-start gap-3">
        <h1 className="text-h2">
          {format(COPY.home.progress, { n: session.sessionNumber, total: session.sessionTotal })}
        </h1>
        <p className="flex items-start gap-2 text-body-lg font-ui text-ink-soft">
          <IconCalendar className="mt-1 h-5 w-5 shrink-0" />
          <span>
            {formatSessionDay(session.date)}
            {" · "}
            {formatSessionTimeRange(session.time, session.durationMinutes, session.timeZoneLabel)}
          </span>
        </p>
        <DeliveryBadge format={session.deliveryFormat} />
      </header>

      {/* Facts about the meeting — grouped, not scattered. */}
      {(typeof attendingCount === "number" || session.materialsCount > 0) && (
        <ul className="flex flex-col gap-3">
          {typeof attendingCount === "number" && (
            <li className="flex items-center gap-2 text-body font-ui text-ink">
              <IconPeople className="h-5 w-5 shrink-0 text-ink-soft" />
              {format(COPY.session.attending, { n: attendingCount })}
            </li>
          )}
          {session.materialsCount > 0 && (
            <li className="flex items-center gap-2 text-body font-ui text-ink">
              <IconDocument className="h-5 w-5 shrink-0 text-ink-soft" />
              {COPY.session.materials}
              <Badge variant="accent">{session.materialsCount}</Badge>
            </li>
          )}
        </ul>
      )}

      {session.topic && (
        <section className="flex flex-col gap-2">
          <h2 className="text-h3">{isUpcoming ? COPY.session.topic : COPY.session.past_notes}</h2>
          <p className="text-body font-ui text-ink">{session.topic}</p>
        </section>
      )}

      {isUpcoming &&
        (markedAbsent ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-body font-ui text-ink">{COPY.session.marked_absent}</p>
            <Button variant="quiet" onClick={() => setMarkedAbsent(false)}>
              {COPY.session.undo_absent}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <JoinAction session={session} className="w-full" />
            <DialInDetails dialInNumber={session.dialInNumber} dialInPin={session.dialInPin} />
            <Button variant="quiet" onClick={() => setMarkedAbsent(true)}>
              {COPY.session.mark_absent}
            </Button>
          </div>
        ))}
    </div>
  );
}
