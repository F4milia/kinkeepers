# QA — test-a1-signed-in-role-access-e2e

Preview URL: N/A - this PR is entirely new/updated tests and a shared helper function, verified by running the suite itself (see Result below), plus one shell copy addition worth eyeballing.
Fixtures used: none - the new e2e tests create and clean up their own real users/orgs per run.

## Primary check
A1's "direct URL access to an unpermitted route returns a refusal" now has real, signed-in, wrong-role browser coverage (previously only the unauthenticated case was covered), and A1's "say it out loud in the UI" requirement for partner_staff is now actually said somewhere.

1. Run `npx playwright test e2e/admin-role-access.spec.ts`.
   **Expect:** all pass - a facilitator, partner_staff, and member each get the real "Access not available" refusal screen on a route their role doesn't permit; each role's nav shows exactly the right items in a real signed-in session; partner_staff sees the discussion-content statement, admin does not.
2. Manually: sign in as a real `partner_staff` account (see PR #132's QA doc for how to create one locally), open `/admin/reports` or `/admin/cohorts`.
   **Expect:** a short note near the bottom of the left nav: "You never see what caregivers write to each other in their group. You see referrals, attendance, and delivery only."
3. Sign in as admin, confirm that note does NOT appear anywhere in the shell.
4. Run `npx playwright test` (full suite) once to confirm nothing else regressed from the `getRequestOrigin()` protocol-selection change.

## Regression (previous two sessions)
- [ ] fix-p2-staff-referral-screen (PR #132): confirm the "Refer someone" screen's resume link is still built correctly - it depends on the same `getRequestOrigin()` this PR changed the protocol logic for.
- [ ] fix-p1-local-dev-auth-config (PR #128): confirm a real self-service magic-link sign-in still works end to end in both `next dev` and a production build (`next build && next start`) - this PR specifically fixes the production-build case, which PR #128 never exercised.

## Result
- [ ] All pass
- Failures → issue links:
- Loom:
- Executed by / at:
