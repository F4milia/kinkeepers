# QA — A5-partner-csv-export

Preview URL: <filled in by whoever verifies, from the PR's Vercel comment>
Fixtures used: none - needs a real partner_staff account with at least one referred applicant, ideally one with a logged session

## Primary check
A5's real acceptance criteria (confirmed against `KINKEEPERS-COMPLETE-RUN-DOC.md`, not a reconstructed summary) requires "Partner export scoped correctly and carrying partner_reference_id... Export stays labeled 'Export attendance and delivery (CSV)'." This didn't exist before this PR - `/admin/reports` only rendered a plain HTML list for partner_staff.

1. Sign in as a partner_staff user with at least one referred applicant.
   **Expect:** an "Export attendance and delivery (CSV)" button appears above the referral list.
2. Click it.
   **Expect:** a CSV downloads with columns Applicant, Partner Reference ID, Cohort, Status, Session Number, Attendance - one row per applicant with no logged session yet, one row per (applicant, logged session) for those who have one.
3. Open the CSV in a spreadsheet app or a text editor.
   **Expect:** the partner_reference_id column matches what's on file for each applicant; no other partner organization's applicants appear anywhere in the file.
4. Sign in as a DIFFERENT partner_staff user (a different organization) and repeat step 2.
   **Expect:** a completely different set of rows - never the first organization's data.
5. Attempt to hit `/admin/reports/export` directly as an admin or facilitator (not partner_staff).
   **Expect:** a 403 JSON response, not a CSV and not a 500.

## Regression (previous two sessions)
- [ ] A5 (unlogged sessions / consecutive-absence flag, this same wave): confirm those two sections on `/admin/reports` still render correctly for the admin role - this PR only touched the partner_staff branch of the same page.
- [ ] X4: confirm `session_attendance`'s existing RLS policies (facilitator-own, member-own, admin) still hold - this PR adds a new ADDITIVE partner_staff policy alongside them, verified by hand (commented out, reset --local, re-ran pgTAP, confirmed the new assertion alone failed, restored) but worth re-confirming the older roles weren't affected.

## Result
- [ ] All pass
- Failures → issue links:
- Loom:
- Executed by / at:
