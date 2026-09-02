# QA — L2-intake-timezone dropdown value fix

Preview URL: <filled in by whoever verifies, from the PR's Vercel comment>
Fixtures used: none - this needs a fresh real intake submission, not a seeded fixture (the bug is specifically about what the live form stores)

## Primary check
Submitting the real intake form no longer poisons `applicants.time_zone` with a value that crashes the admin assignment screen. (Found live: a real intake submission crashed `/admin/applicants/[id]` with `RangeError: Invalid time zone specified: Central` - the dropdown stored the bare region name instead of an IANA identifier.)

1. Go to `/refer/<any active partner slug>` and submit a new applicant through to completion, picking any time zone option.
   **Expect:** intake completes normally, no error.
2. In `/admin/applicants`, open the new applicant's detail page.
   **Expect:** page renders normally - no crash, no "We couldn't load this."
3. If any open cohort exists, confirm the "Open cohorts" list shows a real meeting-time sentence (e.g. "Tuesday, 6:30 PM Eastern your time (...)"), not a blank or broken row.
   **Expect:** correctly formatted time in both the applicant's zone and the cohort's zone.

## Regression (previous two sessions)
- [ ] X4/P3 dial-in verification: this fix was found while manually testing P3's Zoom acceptance criteria on hosted - confirm that path (create/assign a test applicant, verify dial-in on Home) still works end to end now that assignment itself is unblocked.
- [ ] A2 (assignment picker, pre-existing): confirm assigning an applicant who picked a *different* time zone than the cohort's own (the named Honolulu/Eastern DST edge case `lib/admin/cohort-meeting-time.test.ts` already covers at the unit level) still renders correctly on the real admin screen, not just in the test suite.

## Result
- [ ] All pass
- Failures → issue links:
- Loom:
- Executed by / at:
