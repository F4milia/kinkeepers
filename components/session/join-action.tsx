import { Button, buttonClasses } from "@/components/ui/button";
import { COPY } from "@/lib/copy";
import type { Session } from "@/lib/types";
import { DialInDetails } from "@/components/session/dial-in-details";

/**
 * The one primary action on a session — "Join by video" or "Get directions".
 * Shared by Home and Session detail so the same meeting offers the same
 * action in both places; a caregiver who can join from the meeting card
 * shouldn't have to open the session to find the same button.
 *
 * Video calling is a link out, never built in (Part 5.3), so this renders a
 * real <a> when there's somewhere to go. With no destination — a past
 * session, or an in-person one, which has no address field in the model —
 * it falls back to a disabled Button rather than a link that goes nowhere.
 *
 * Renders DialInDetails itself (2026-09-08 X4 acceptance audit) rather
 * than leaving every call site to remember to render it as a sibling -
 * X4's own acceptance line ("dial-in details appear alongside EVERY join
 * link") was true today only because all three existing call sites
 * happened to pair the two correctly, not because anything enforced it;
 * a fourth call site could easily have forgotten. DialInDetails already
 * no-ops (returns null) when a session has no dial-in data, so this is
 * behavior-preserving for in-person/no-Zoom sessions - not a new
 * conditional to get wrong.
 */
export function JoinAction({ session, className = "" }: { session: Session; className?: string }) {
  const label = session.deliveryFormat === "video" ? COPY.home.join_video : COPY.home.get_directions;

  if (session.deliveryFormat === "video" && session.joinUrl) {
    return (
      <>
        <a
          href={session.joinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${buttonClasses("primary")} ${className}`}
        >
          {label}
        </a>
        <DialInDetails dialInNumber={session.dialInNumber} dialInPin={session.dialInPin} />
      </>
    );
  }

  return (
    <>
      <Button variant="primary" className={className} disabled>
        {label}
      </Button>
      <DialInDetails dialInNumber={session.dialInNumber} dialInPin={session.dialInPin} />
    </>
  );
}
