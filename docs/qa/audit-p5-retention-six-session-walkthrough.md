# QA — audit-p5-retention-six-session-walkthrough P5: Instrumentation

Preview URL: <filled in by whoever verifies, from the PR's Vercel comment>
Fixtures used: none from `docs/qa/FIXTURES.md` - P5's own derived views are read directly with SQL by Ivan ("not a dashboard" is the prompt's own instruction), so there's no UI screen to click through. Verification here is a database-level walkthrough.

## Primary check (from the run doc's Named edge-case register)
Every event fires from its real trigger, and `retention_at_session_6` returns a correct number produced by actually walking a seeded cohort through six real sessions - not a synthetic shortcut.

1. On a fresh `supabase db reset --local`, confirm `supabase/tests/database/retention_six_session_walkthrough.sql` passes as part of `npx supabase test db` (it does, by default - this is the automated form of this check).
   **Expect:** 8/8 assertions pass, including `retention_at_session_3` = 75% and `retention_at_session_6` = 50%, both produced by six real `submit_session_log()` calls.
2. As a real facilitator (see `docs/qa/FIXTURES.md`'s "Signing in as a fixture"), open a real cohort's session-log screen for a session and submit attendance for at least one member marked `absent`.
   **Expect:** the submission succeeds with no error, matching the facilitator-attendance flow this walkthrough proves at the DB level.
3. Query `retention_at_session(<that session's number>, '<that cohort's id>')` directly (via `psql` or Supabase Studio's SQL editor).
   **Expect:** a real, non-null percentage reflecting the members actually marked present vs. absent/excused for that cohort - not an empty result.
4. Grep the repo for `mixpanel`, `amplitude`, `posthog`, `segment`, `gtag` across `package.json`, `lib/`, `app/`, `components/`.
   **Expect:** zero hits.

## Regression (previous two sessions)
- [ ] P4 (reminders gap-closure): the missed-session-follow-up path (`applicants_due_for_missed_session_followup`) still correctly reads `session_attendance` rows written by the same `submit_session_log()` this session's own new test exercises more thoroughly - confirm a real missed-session reminder still fires for a confirmed absence.
- [ ] X4 (attendance tracking, pre-existing): the facilitator's own "Needs a log" home-screen list still correctly surfaces past sessions - unrelated to this change's own scope, but shares the same `submit_session_log()` write path this PR added new coverage around.

## Result
- [ ] All pass
- Failures → issue links:
- Loom:
- Executed by / at:
