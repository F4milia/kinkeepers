import Link from "next/link";

/**
 * Refusal UI for /admin routes reached without permission - either
 * signed out, or signed in as a role that isn't allowed on this route.
 * A1 acceptance criterion: "Direct URL access to an unpermitted route
 * returns a refusal, not a blank page." Not part of the member/
 * facilitator copy deck (lib/copy.ts is scoped to those screens per
 * kinkeepers-frontend-build.md Part 3.1) - /admin has no copy deck yet,
 * so this is plain, honest, inline text rather than an invented entry
 * in a deck that doesn't cover this surface.
 */
export function AccessRefused({ reason }: { reason: "signed_out" | "wrong_role" }) {
  const body =
    reason === "signed_out"
      ? "You need to sign in to view this page."
      : "Your account doesn't have access to this page.";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      <p className="text-h2 font-heading text-ink">Access not available</p>
      <p className="max-w-md text-body font-ui text-ink-soft">{body}</p>
      {reason === "signed_out" ? (
        <Link
          href="/sign-in"
          className="mt-2 inline-flex min-h-12 items-center rounded-control bg-action px-6 text-label font-ui text-canvas hover:bg-action-dim"
        >
          Sign in
        </Link>
      ) : null}
      <p className="mt-4 text-meta font-ui text-ink-soft">
        If you think this is a mistake, call 1-800-555-0142.
      </p>
    </div>
  );
}
