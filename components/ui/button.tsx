import type { ButtonHTMLAttributes } from "react";
import { COPY } from "@/lib/copy";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "destructive";

/**
 * --gentle and --urgent never carry button label text (both fail AA against
 * --surface in light mode) — they're used only as borders/dots, which only
 * need the lower 3:1 non-text contrast threshold. Label text stays --ink or
 * the guaranteed-AAA action/surface pairing.
 */
const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-action text-surface hover:bg-action/90 active:bg-action/80",
  secondary:
    "border border-action bg-transparent text-action hover:bg-action-dim active:bg-action-dim",
  quiet: "bg-transparent text-action hover:bg-action-dim active:bg-action-dim",
  destructive:
    "border border-gentle bg-transparent text-ink hover:bg-gentle/10 active:bg-gentle/20",
};

// Part 3.3 / 3.4: primary actions are 56px tall; everything else interactive
// is 48px minimum. Measured, not assumed.
const SIZE_STYLES: Record<ButtonVariant, string> = {
  primary: "h-14 px-6",
  secondary: "min-h-12 px-5",
  quiet: "min-h-12 px-4",
  destructive: "min-h-12 px-5",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  children,
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-control text-label font-ui transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_STYLES[variant]} ${SIZE_STYLES[variant]} ${className}`}
      {...rest}
    >
      {loading ? COPY.loading : children}
    </button>
  );
}
