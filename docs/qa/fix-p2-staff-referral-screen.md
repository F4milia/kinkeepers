# QA — fix-p2-staff-referral-screen

Preview URL: <filled in by whoever verifies, from the PR's Vercel comment>
Fixtures used: none existing - a partner_staff account is needed; no fixture in `docs/qa/FIXTURES.md` currently has that role. Create one locally the same way this PR's own live verification did (`admin.auth.admin.createUser` + `profiles.role = 'partner_staff'` + a real `partner_organizations` row), or ask Ferenz for a real staging one if this needs graduating to a fixture.

## Primary check
A partner-organization navigator can now actually submit a referral on a caregiver's behalf through the app - the underlying action existed and was tested, but no screen ever called it.

1. Sign in as a `partner_staff` user (see Fixtures note above).
   **Expect:** the `/admin` nav shows "Refer someone" above "Cohorts" and "Reports" - not "Applicants" or "Partner organizations" (admin-only).
2. Open "Refer someone," enter a reference ID (e.g. `ext-ref-1`), submit.
   **Expect:** "Referral created," with a shareable `/intake/resume?token=...` link shown - no redirect away from the page.
3. Follow that link in a fresh/incognito session.
   **Expect:** lands on the real intake form, Step 1 of 3, exactly like the self-service referral-link flow.
4. As an admin, query the resulting applicant row.
   **Expect:** `referral_source = 'staff_form'`, `partner_reference_id` matches what was entered, `partner_organization_id` matches the navigator's own org - never a different one.
5. Submit again with the reference ID field left blank.
   **Expect:** succeeds identically, `partner_reference_id` is null.
6. Sign in as a member or as admin and try navigating directly to `/admin/refer`.
   **Expect:** the standard wrong-role refusal screen - never the referral form.

## Regression (previous two sessions)
- [ ] fix-p1-local-dev-auth-config (PR #128): confirm a real self-service magic-link sign-in still works end to end - this PR's own live verification signed in as a fresh test user through the real `/sign-in` form and depends on that path being intact.
- [ ] fix-not-found-role-aware-home-link (PR #123): confirm a `partner_staff` user hitting a genuinely missing `/admin/**` route still gets a working "Go to Home" pointing at `/admin`, not a loop.

## Result
- [ ] All pass
- Failures → issue links:
- Loom:
- Executed by / at:
