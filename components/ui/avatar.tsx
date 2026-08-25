import { getInitials } from "@/lib/initials";

export type AvatarSize = 32 | 40 | 56;

const SIZE_STYLES: Record<AvatarSize, string> = {
  32: "h-8 w-8",
  40: "h-10 w-10",
  56: "h-14 w-14",
};

export interface AvatarProps {
  /** Full name (first name is all the fixtures give us) — initials are derived, never passed directly. */
  name: string;
  size?: AvatarSize;
  /** Set false when the name isn't rendered as visible text anywhere nearby. */
  decorative?: boolean;
}

// No photographs anywhere (Part 3.2) — initials in a circle, --action-dim
// background, --ink letter, deterministic per member.
export function Avatar({ name, size = 40, decorative = true }: AvatarProps) {
  return (
    <span
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-action-dim text-label font-ui text-ink ${SIZE_STYLES[size]}`}
    >
      {getInitials(name)}
    </span>
  );
}
