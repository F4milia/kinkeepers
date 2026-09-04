# QA — audit-p4-pre-notification-preference-default P4-pre: Notification preference migration

Preview URL: <filled in by whoever verifies, from the PR's Vercel comment>
Fixtures used: none from `docs/qa/FIXTURES.md` - every existing fixture sets `preferred_contact_channel` explicitly, which is exactly why this gap needs a fresh applicant instead.

## Primary check (from the run doc's Named edge-case register)
An applicant who never touches the optional contact-preference control during intake must default to BOTH channels (email and SMS), not email-only.

1. On a fresh `supabase db reset --local`, submit a real referral through `/refer/[slug]` (any active partner org's link) and stop at intake step 3 without selecting anything in the "How should we reach you?" control.
   **Expect:** the form allows completing intake anyway - the control is optional, not required.
2. Query the resulting `applicants` row's `preferred_contact_channel` column directly.
   **Expect:** `'both'`, not `null` and not `'email'`.
3. Trigger a real notification for that applicant (e.g. the application-received message, or a session reminder if the applicant is later enrolled in a cohort with an upcoming session) with a real phone number and email on file.
   **Expect:** both `sendEmail` and `sendSms` are invoked for that applicant - check `notification_log` for one row per channel, not just one.
4. Repeat steps 1-3, this time explicitly selecting "Email only" in step 3.
   **Expect:** `preferred_contact_channel = 'email'`, and only the email channel fires for that applicant - explicit choices are never overridden by the default.

## Regression (previous two sessions)
- [ ] A3 (cohort creation and session scheduling): reschedule/cancel notifications (`lib/admin/session-management.ts`) still call the same `notifyMember()` this fix touched - confirm a reschedule notification still fires correctly for a member with an explicit preference set.
- [ ] A2 (intake review and cohort assignment): the review queue's applicant detail view still renders correctly for an applicant whose `preferred_contact_channel` is now backfilled to `'both'` rather than blank/null.

## Result
- [ ] All pass
- Failures → issue links:
- Loom:
- Executed by / at:
