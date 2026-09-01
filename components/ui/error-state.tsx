import Link from "next/link";
import { Button, buttonClasses } from "@/components/ui/button";
import { COPY, format } from "@/lib/copy";

/**
 * L5's two renderable error states (auth expiry is a redirect, handled
 * by the layout, never rendered here). "network" and "server" share one
 * boundary (see lib/data-errors.ts's DataUnavailableError comment for
 * why); "not_found" is Next's own notFound()/not-found.tsx path.
 *
 * The phone number appears in every variant - CLAUDE.md: "this
 * population's fallback is a person, not a refresh."
 */
export function ErrorState({
  variant,
  onRetry,
}: {
  variant: "unavailable" | "not_found";
  onRetry?: () => void;
}) {
  const copy = variant === "not_found" ? COPY.errors.not_found : COPY.errors.network;

  return (
    <div className="flex flex-col items-center gap-4 py-section text-center">
      <p className="text-h3 font-heading text-ink">{copy.headline}</p>
      <p className="max-w-md text-body font-ui text-ink-soft">{copy.body}</p>
      {variant === "not_found" ? (
        <Link href="/" className={buttonClasses("primary")}>
          {COPY.errors.not_found.go_home}
        </Link>
      ) : onRetry ? (
        <Button variant="primary" onClick={onRetry}>
          {COPY.errors.network.retry}
        </Button>
      ) : null}
      <p className="text-meta font-ui text-ink-soft">
        {format(COPY.errors.call_for_help, { phoneNumber: COPY.support.phoneNumber })}
      </p>
    </div>
  );
}
