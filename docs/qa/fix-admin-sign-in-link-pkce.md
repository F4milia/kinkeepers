# QA — fix-admin-sign-in-link-pkce

Preview URL: <filled in by whoever verifies, from the PR's Vercel comment>
Fixtures used: Renata Solis (facilitator, `ferenz+kinkeepers@brandlamb.com`) - any real, sign-in-able account works for step 1; no new fixture needed.

## Primary check
`issueAdminSignInLink()` (P1's human recovery path) now issues a link that actually establishes a session when redeemed, instead of silently redirecting back to `/sign-in` - see CLAUDE.md's Learned Constraints entry for the root cause (an admin-generated link can't use this app's PKCE flow at all).

1. As an admin, use the admin sign-in-link action to issue a link for Renata Solis's email (`ferenz+kinkeepers@brandlamb.com`), giving any non-empty reason.
   **Expect:** a success result with a link pointing at this app's own `/auth/callback?token_hash=...&type=magiclink` (not a `supabase.co/auth/v1/verify...` URL).
2. Open that link in a fresh/incognito browser session (not already signed in as anyone).
   **Expect:** lands on Renata's real facilitator home screen, signed in - not back on `/sign-in`.
3. Reload or re-open the same link a second time.
   **Expect:** redirects to `/sign-in?error=link_invalid` - the token is single-use, same as a normal magic link.
4. Repeat step 1 with an email that has no matching user.
   **Expect:** `not_found` result, no link issued, no new user created.

## Regression (previous two sessions)
- [ ] R1 (incident/rollback docs): no code paths touched by that PR overlap with this one; confirm `docs/incident-response.md` and `docs/migration-rollback-decisions.md` are unaffected (docs-only, sanity check only).
- [ ] X4 (dial-in identity / role-based redirect): confirm a normal member/facilitator magic-link sign-in (`requestEmailLink` → `/auth/callback?code=...`) still lands each role on its correct home screen - this PR adds a second branch to the same route but must not change the existing `code` branch's behavior.

## Result
- [ ] All pass
- Failures → issue links:
- Loom:
- Executed by / at:
