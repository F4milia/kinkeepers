# QA — audit-p4-reminders-gap-closure P4: Reminders (gap-closure, 3 PRs)

Preview URL: <filled in by whoever verifies, from the PR's Vercel comment>
Fixtures used: none from `docs/qa/FIXTURES.md` - a reminder is inherently
relative to "right now" (24 hours before a session that hasn't happened
yet), which a static seeded row can't represent across every future
`db reset`. Steps below create the needed session/attendance state
inline, relative to the moment they're run.

## Primary check (from the run doc's Named edge-case register)
The 24h/1h reminder schedule and the missed-session follow-up must
actually fire, exactly once each, and the missed-session message must
never fire for an unmarked (not yet logged) session.

1. Create a real cohort with a licensed program and a certified
   facilitator (see `docs/qa/audit-a3-cohort-creation-scheduling.md`'s
   own steps for the license-status flip needed locally), then insert one
   session with `scheduled_at` ~23 hours from now and one enrolled member
   with a real email on file.
   **Expect:** nothing fires yet - the 24h window hasn't been reached.
2. Manually invoke the Inngest function (`Inngest Dev Server` UI at
   `http://localhost:8288`, or `POST` a `session-reminders` cron event
   directly) once the session is within 24 hours out - or update the
   session's `scheduled_at` to ~23 hours from now first if it's already
   past that point.
   **Expect:** a `notification_log` row appears for that applicant with
   `notification_type = 'session_reminder_24h'` and `status = 'sent'`,
   and the real inbox (Mailpit locally) shows the message - "Your
   KinKeepers session starts in 24 hours," no health information.
3. Invoke it again immediately.
   **Expect:** no second email, no second `notification_log` row - the
   real unique `(dedup_key, channel)` index blocks it.
4. Update that same session's `scheduled_at` to ~45 minutes from now and
   invoke the function again.
   **Expect:** a SEPARATE `notification_type = 'session_reminder_1h'` row
   appears (the 1h reminder is independent of the 24h one), with "starts
   in 1 hour" in the message.
5. Create a second session dated yesterday with NO attendance logged at
   all for its enrolled member, and invoke the function.
   **Expect:** no `missed_session_followup` row for that member - an
   unmarked session must never trigger it.
6. Log that same session's attendance as `absent` for that member (via
   the facilitator session-log screen or `submit_session_log()`
   directly), then invoke the function again the next morning (or with a
   backdated `scheduled_at` + a real clock, since `p_now` has no override
   outside of tests).
   **Expect:** a `missed_session_followup` row appears, `status =
   'sent'`, message reads "We missed you [day]. The group meets again
   next week at the same time." - no guilt, no question.
7. Confirm the failed-send admin queue (`/admin/notifications`) surfaces
   any of the above if forced to fail (e.g. temporarily break
   `RESEND_API_KEY` and repeat step 2).
   **Expect:** a `{channel} failed` row appears for the applicant.
8. Unsubscribe that applicant (`/unsubscribe/[token]`) and repeat step 2
   for a fresh due session.
   **Expect:** no reminder sent, and the applicant's `status`/`cohort_id`
   (real enrollment) are unchanged.

## Regression (previous two sessions)
- [ ] P4-pre (notification preference default): an applicant who never
  set a contact preference still gets both email and SMS reminders, not
  just email - this PR's `notifySessionReminder`/`notifyMissedSession`
  both read `preferred_contact_channel` the same way `notifyMember`
  already does.
- [ ] A3 (cohort creation and session scheduling): rescheduling a session
  (`/admin/cohorts/[id]`) still correctly notifies members of the new
  time - this gap-closure only added new functions, but touched the
  shared `notify-member.ts` (moved `getApplicantContact` into it), which
  A3's own reschedule/cancellation notifications also depend on.

## Result
- [ ] All pass
- Failures → issue links:
- Loom:
- Executed by / at:
