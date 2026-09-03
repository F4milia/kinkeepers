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
 *
 * `homeHref` defaults to "/" (the caregiver home) but a caller whose
 * not-found page can be reached by a non-member role (e.g. an admin or
 * facilitator hitting a route gated to a different role) must pass that
 * role's own roleHomePath() - otherwise "Go to Home" sends them to "/",
 * which 404s again for them and turns this into a dead-end loop, exactly
 * what CLAUDE.md's "error states never dead-end" rule forbids.
 */
export function ErrorState({
  variant,
  onRetry,
  homeHref = "/",
}: {
  variant: "unavailable" | "not_found";
  onRetry?: () => void;
  homeHref?: string;
}) {
  const copy = variant === "not_found" ? COPY.errors.not_found : COPY.errors.network;

  return (
    <div className="flex flex-col items-center gap-4 py-section text-center">
      <p className="text-h3 font-heading text-ink">{copy.headline}</p>
      <p className="max-w-md text-body font-ui text-ink-soft">{copy.body}</p>
      {variant === "not_found" ? (
        <Link href={homeHref} className={buttonClasses("primary")}>
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
