import { Badge } from "@/components/ui/badge";
import { COPY } from "@/lib/copy";
import type { DeliveryFormat } from "@/lib/types";

function IconVideo() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
    >
      <rect x="2.75" y="6.75" width="12.5" height="10.5" rx="2" />
      <path d="M15.25 11 21 8v8l-5.75-3Z" strokeLinejoin="round" />
    </svg>
  );
}

function IconPlace() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
    >
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

/**
 * How a session is delivered — "By video" or "In person". Soft-filled rather
 * than outlined so it reads as information about the meeting instead of a
 * status warning, and shared by Home and Session detail so the same meeting
 * is labelled identically in both places. The icon is decorative; the label
 * carries the meaning.
 */
export function DeliveryBadge({ format }: { format: DeliveryFormat }) {
  const isVideo = format === "video";
  return (
    <Badge variant="accent" icon={isVideo ? <IconVideo /> : <IconPlace />}>
      {isVideo ? COPY.session.location_video : COPY.session.location_person}
    </Badge>
  );
}
