import { COPY } from "@/lib/copy";

/**
 * X4: "surface the dial-in number and PIN in the member UI everywhere
 * the video join link appears, not buried behind a disclosure." Plain
 * visible text, not a modal or an expandable disclosure - a member who
 * can't get video working needs the phone option visible in that
 * moment, not one tap away. Renders nothing when either is missing
 * (a past session, or the facilitator hasn't shared it yet).
 */
export function DialInDetails({ dialInNumber, dialInPin }: { dialInNumber: string | null; dialInPin: string | null }) {
  if (!dialInNumber || !dialInPin) return null;

  return (
    <p className="text-body font-ui text-ink-soft">
      {COPY.applicant.assigned.dial_in_label}: {dialInNumber} — PIN {dialInPin}
    </p>
  );
}
