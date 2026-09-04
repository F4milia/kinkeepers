"use client";

import { useEffect } from "react";

/**
 * L1 audit finding (2026-09-04, live): clicking an already-used or
 * expired magic link does NOT reach app/auth/callback/route.ts at all.
 * Supabase's /auth/v1/verify endpoint rejects the token and redirects the
 * browser directly to the project's configured Site URL with the failure
 * encoded in the URL HASH FRAGMENT (#error=access_denied&error_code=
 * otp_expired&error_description=...) - confirmed live, not assumed:
 * Ferenz clicked a reused link and landed on a bare "/" carrying exactly
 * this hash, with no server-side code having run for that request at all.
 * A hash fragment is client-only by definition - the server never sees
 * it, so route.ts's own `?error=link_invalid` handling can't catch this
 * shape of failure no matter how it's written.
 *
 * This is the only way to catch it: read the hash once, client-side,
 * wherever it happens to land, and route to the one screen that already
 * knows how to explain this plainly (COPY.sign_in.error_link_invalid,
 * "same screen, never a dead end" per L1's own acceptance line).
 * Deliberately redirects unconditionally, even if the browser still holds
 * a valid session from an earlier, successful click of the same link
 * (this exact case, live: the first click had already signed Ferenz in
 * as admin) - that session isn't touched or signed out, and "this
 * specific link didn't work, here's why" is still the honest, correct
 * message to show for the click that just happened.
 */
/**
 * Pure parsing, kept separate from the DOM/useEffect glue below so it's
 * testable in this repo's plain-Node vitest environment (no jsdom
 * anywhere in this codebase, this component being the first to touch
 * `window` at all) - matches the established pattern of keeping real
 * logic behind a thin framework wrapper rather than only reachable via a
 * component render.
 */
export function hasAuthHashError(hash: string): boolean {
  if (!hash) return false;
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  return params.has("error");
}

export function AuthHashErrorRedirect() {
  useEffect(() => {
    if (!hasAuthHashError(window.location.hash)) return;
    window.location.replace("/sign-in?error=link_invalid");
  }, []);

  return null;
}
