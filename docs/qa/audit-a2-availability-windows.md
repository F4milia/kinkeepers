# QA — audit-a2-availability-windows

Preview URL: <filled in by whoever verifies, from the PR's Vercel comment>
Fixtures used: none - a real applicant with `availability_windows` set works for this; no existing seed row has it set.

## Primary check
A2's review queue and assignment screen now show an applicant's stated availability - a required field per A2's own prompt that was silently never wired up (the column was correctly collected and stored, just never displayed anywhere).

1. As admin, create a real applicant in `pending_review` with `availability_windows` set (e.g. via the real referral/intake flow, checking "Weekday evenings" and "Weekends").
2. Open `/admin/applicants` (the pending review queue).
   **Expect:** a line reading "Available: Weekday evenings, Weekends" on that applicant's row.
3. Open that applicant's own assignment page (`/admin/applicants/[id]`).
   **Expect:** the same "Available: Weekday evenings, Weekends" line near the top, alongside relationship/stage/time zone/days waiting.
4. Check an applicant who gave no availability.
   **Expect:** "Available: No availability given" - never a blank or broken line.

## Regression (previous two sessions)
- [ ] fix-p2-staff-referral-screen (PR #132): confirm a referral created via the new staff-facing form still flows correctly into this same review queue, with all fields (including availability) intact.
- [ ] test-a1-signed-in-role-access-e2e (PR #134): confirm `/admin/applicants` still refuses a non-admin signed-in user (facilitator, partner_staff) - this PR only changed what's displayed on that page for an admin, not its role gate.

## Result
- [ ] All pass
- Failures → issue links:
- Loom:
- Executed by / at:
