import type { ReactNode } from "react";

export type BadgeVariant = "neutral" | "accent" | "gentle" | "urgent";

// Label text always stays --ink / --ink-soft — --gentle and --urgent appear
// only as the border and dot, which is all the 3:1 non-text threshold covers.
//
// `accent` is the one soft-filled treatment: --action-dim ground with --ink
// text, which measures 13.59:1 light and 11.45:1 dark (AAA). Using --action
// as the text color on that ground would look more tonal but only reaches
// 6.47:1 — AA, not AAA — so it isn't used here.
const VARIANT_STYLES: Record<BadgeVariant, string> = {
  neutral: "border-line bg-surface text-ink-soft",
  accent: "border-transparent bg-action-dim text-ink",
  gentle: "border-gentle bg-surface text-ink",
  urgent: "border-urgent bg-surface text-ink",
};

const DOT_STYLES: Partial<Record<BadgeVariant, string>> = {
  gentle: "bg-gentle",
  urgent: "bg-urgent",
};

export function Badge({
  children,
  variant = "neutral",
  icon,
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  /** Decorative leading glyph — must be aria-hidden by the caller; the label carries the meaning. */
  icon?: ReactNode;
}) {
  const dot = DOT_STYLES[variant];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-control border px-2.5 py-1 text-meta font-ui font-medium ${VARIANT_STYLES[variant]}`}
    >
      {dot && <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />}
      {icon}
      {children}
    </span>
  );
}
