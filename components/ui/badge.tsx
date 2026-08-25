import type { ReactNode } from "react";

export type BadgeVariant = "neutral" | "gentle" | "urgent";

// Label text always stays --ink / --ink-soft — --gentle and --urgent appear
// only as the border and dot, which is all the 3:1 non-text threshold covers.
const VARIANT_STYLES: Record<BadgeVariant, string> = {
  neutral: "border-line text-ink-soft",
  gentle: "border-gentle text-ink",
  urgent: "border-urgent text-ink",
};

const DOT_STYLES: Record<BadgeVariant, string> = {
  neutral: "",
  gentle: "bg-gentle",
  urgent: "bg-urgent",
};

export function Badge({ children, variant = "neutral" }: { children: ReactNode; variant?: BadgeVariant }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-control border bg-surface px-2.5 py-1 text-meta font-ui font-medium ${VARIANT_STYLES[variant]}`}
    >
      {variant !== "neutral" && (
        <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${DOT_STYLES[variant]}`} />
      )}
      {children}
    </span>
  );
}
