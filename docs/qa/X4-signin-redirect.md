# QA — X4-signin-redirect auth callback role routing

Preview URL: <filled in by whoever verifies, from the PR's Vercel comment>
Fixtures used: Renata Solis (see docs/qa/FIXTURES.md's "Signing in as a fixture" section - the only fixture with a real login today)

## Primary check
A facilitator completing the magic-link sign-in lands on their own home screen, not "We couldn't find that." (Found live: a real facilitator sign-in on hosted 404'd twice - the callback always redirected to `/`, the caregiver home, regardless of role; a facilitator has no `applicants` row for that page's `getViewer()` to find.)

1. Sign in as `renata.solis@example.com` (magic link via Mailpit locally - see FIXTURES.md).
   **Expect:** redirected to `/facilitator` (Home) - not the "We couldn't find that" screen.
2. From there, click into Schedule, then a session, confirming normal facilitator navigation still works post-redirect.
   **Expect:** no unexpected redirect or 404 anywhere in that path.

Admin/partner_staff/member redirect targets (`/admin`, `/admin`, `/`) aren't manually checkable yet - no real-login fixture exists for those roles today (see FIXTURES.md's "Known gap"). They're covered instead by `lib/auth/roles.test.ts`'s `roleHomePath` unit tests, which assert all four roles plus the unresolved-role case directly against the same pure function the callback route calls.

## Regression (previous two sessions)
- [ ] F2: F2.md's own step 1 ("Sign in as Renata... Expect: lands on `/facilitator`") depended on exactly the redirect this PR fixes - its QA doc was written but its `Result` checklist was never checked off, so this is the first real run of that expectation. Confirm it now holds.
- [ ] X4: the facilitator session-log screen (`/session/[sessionId]`) is only reachable at all once a facilitator can actually land somewhere logged-in - confirm a fresh sign-in-to-session-log path still works end to end, not just the home redirect in isolation.

## Result
- [ ] All pass
- Failures → issue links:
- Loom:
- Executed by / at:
