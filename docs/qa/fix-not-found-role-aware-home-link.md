# QA — fix-not-found-role-aware-home-link

Preview URL: <filled in by whoever verifies, from the PR's Vercel comment>
Fixtures used: Renata Solis (facilitator, `ferenz+kinkeepers@brandlamb.com`) - any real, sign-in-able non-member account works.

## Primary check
A signed-in facilitator or admin who lands on a not-found page no longer dead-ends on "Go to Home" - it now sends them to their own role's home instead of looping back to the caregiver home, which 404s for them.

1. Sign in as Renata Solis (facilitator) and manually navigate to `/` (the caregiver home - not a link in the app, type it directly).
   **Expect:** the not-found page (`We couldn't find that.`), with the phone number shown, and a "Go to Home" button whose link points at `/facilitator`, not `/`.
2. Click "Go to Home" from that page.
   **Expect:** lands on the real facilitator home screen - not the same not-found page again.
3. As a real member (an applicant with a claimed profile), navigate to a genuinely missing route under the caregiver group (e.g. `/session/00000000-0000-0000-0000-000000000000`).
   **Expect:** same not-found page, "Go to Home" link points at `/` (unchanged for an actual member - this is still their real home).
4. As an admin, navigate to a nonexistent `/facilitator/**` sub-route.
   **Expect:** the facilitator not-found page, "Go to Home" points at `/admin`, not `/facilitator` or `/`.

## Regression (previous two sessions)
- [ ] fix-admin-sign-in-link-pkce: confirm a normal magic-link sign-in still redirects each role to its correct home via `/auth/callback`'s `roleHomePath()` - this PR reuses that same helper in a different place and must not change its behavior.
- [ ] X4 (role-based redirect): confirm a facilitator's real 404 experience elsewhere (e.g. a stale bookmarked session URL) still shows the phone number and doesn't regress to a blank/raw error.

## Result
- [ ] All pass
- Failures → issue links:
- Loom:
- Executed by / at:
