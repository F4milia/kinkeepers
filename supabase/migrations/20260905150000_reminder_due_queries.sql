-- P4's own actual scope, never built until now (found during a
-- 2026-09-05 acceptance audit): "the notification-preference schema" and
-- generic send mechanism (Inngest wiring, dedup log, unsubscribe, admin
-- failure queue, per-member time zone rendering) were all built and are
-- well-tested, but the RUN DOC'S OWN SCHEDULE - 24 hours before a
-- session, 1 hour before, and a missed-session follow-up the next
-- morning - was never implemented. Every merged P4 PR (git log:
-- "generic outbound-message send mechanism," "wire up Inngest," "session
-- reschedule/cancellation member notifications," "per-member timezone,"
-- "notification dedup log, admin failure queue, and unsubscribe") built
-- infrastructure for reschedule/cancellation notifications (A3) instead
-- of the reminder schedule P4 itself was scoped to deliver.
--
-- Two read-only functions, not mutations - no audit_log row needed (see
-- CLAUDE.md invariant #9's own scope: "every MUTATION writes to
-- audit_log"; these never write anything, the calling Inngest function's
-- own notifyMember()/notification_log path is where a real write and a
-- real dedup guarantee happen). Time-window matching intentionally
-- doesn't try to fire "exactly once, exactly on time" - the calling
-- cron runs every 15 minutes and a session can match a window on
-- several consecutive ticks; notification_log's own unique
-- (dedup_key, channel) index (20260901170000) is what actually
-- guarantees a single send, the same mechanism already proven for
-- reschedule/cancellation. These functions only need to answer
-- "is this session/applicant currently due," not "has it already sent."

-- 24h and 1h reminders share one shape: a session whose scheduled_at
-- falls within [now, now + p_window) - called twice by the Inngest
-- function with different windows/reminder types. Excludes cancelled
-- sessions explicitly rather than requiring status = 'scheduled' -
-- CLAUDE.md's own Learned Constraints (2026-09-03 X4/F1 entry) already
-- found that a session's status column never actually transitions to
-- 'completed' anywhere in this codebase, so "not cancelled" is the only
-- reliable way to express "this session is still really happening."
create function sessions_due_for_time_reminder(p_window interval)
returns table (
  session_id uuid,
  cohort_id uuid,
  scheduled_at timestamptz,
  cohort_time_zone text,
  video_join_url text
)
language sql
security definer
set search_path = ''
stable
as $$
  select s.id, s.cohort_id, s.scheduled_at, c.time_zone, s.video_join_url
  from public.sessions s
  join public.cohorts c on c.id = s.cohort_id
  where s.status <> 'cancelled'
    and s.scheduled_at >= now()
    and s.scheduled_at < now() + p_window;
$$;

revoke execute on function sessions_due_for_time_reminder from public, anon, authenticated;
grant execute on function sessions_due_for_time_reminder to service_role;

-- The missed-session follow-up: fires once, the calendar day after the
-- session, between 8am and noon in the COHORT's own time zone (not the
-- member's - the whole cohort meets at one shared time, so "the next
-- morning" is a cohort-wide concept, same reference frame the run doc's
-- own SCHEDULE section uses). Date/hour math happens in Postgres via
-- `at time zone`, not JS - the same reliable, DST-aware primitive this
-- codebase already trusts for member-facing time rendering
-- (lib/session-time.ts, lib/admin/cohort-meeting-time.ts), just used
-- here to compare a calendar day/hour instead of formatting a string.
--
-- "Confirmed absence, not an unmarked one" (P4's own acceptance line) is
-- enforced by the inner join to session_attendance itself - an applicant
-- with no attendance row at all (unmarked) simply never appears in this
-- result set, structurally, not via an extra flag. Both 'absent' and
-- 'excused' count as a confirmed absence (contrasted with 'present' or
-- no row) - the message's own required tone ("no guilt, no urgency") is
-- true regardless of which reason a facilitator recorded.
--
-- p_now defaults to now() for every real caller, exactly like this
-- codebase's own established pattern of an optional testability
-- parameter on a privileged action (e.g. createCohortAction's
-- zoomCredentials override) - a pgTAP test can't otherwise control
-- whether "right now" happens to fall in the 8-11am cohort-local window
-- this function depends on, since Postgres's own now() isn't mockable
-- from within a test transaction.
create function applicants_due_for_missed_session_followup(p_now timestamptz default now())
returns table (
  session_id uuid,
  cohort_id uuid,
  applicant_id uuid
)
language sql
security definer
set search_path = ''
stable
as $$
  select s.id, s.cohort_id, a.id
  from public.sessions s
  join public.cohorts c on c.id = s.cohort_id
  join public.session_attendance sa on sa.session_id = s.id
  join public.applicants a on a.id = sa.applicant_id
  where s.status <> 'cancelled'
    and sa.status in ('absent', 'excused')
    and a.status in ('enrolled', 'attending')
    and a.notifications_opted_out = false
    and (s.scheduled_at at time zone c.time_zone)::date + 1 = (p_now at time zone c.time_zone)::date
    and extract(hour from p_now at time zone c.time_zone) between 8 and 11;
$$;

revoke execute on function applicants_due_for_missed_session_followup from public, anon, authenticated;
grant execute on function applicants_due_for_missed_session_followup to service_role;
