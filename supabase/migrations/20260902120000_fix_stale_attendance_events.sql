-- Fix for a real bug found while building X4, in two already-merged P5
-- functions/views (20260902100000_analytics_events.sql) - CREATE OR
-- REPLACE here, not edits to that file, per CLAUDE.md's Learned
-- Constraints on never editing an already-applied migration.
--
-- X4's submit_session_log() only fires a new session_attended/
-- session_missed event when a member's status actually changes, so a
-- correction (e.g. present corrected to excused) leaves BOTH the old and
-- new event sitting in this append-only log. Both attendance_rate_by_
-- session_number and retention_at_session() were written as if the mere
-- EXISTENCE of a session_attended event meant "this person attended" -
-- true only until a correction happens, after which a person now marked
-- excused/absent still counted as attended, because their now-stale
-- original event was still in the log. Both need "this person's MOST
-- RECENT event at this session_number," not "ever had a session_attended
-- event at this session_number."
--
-- "Most recent" is resolved by `id` (the bigint identity column), not
-- `occurred_at` - confirmed by hand while writing the pgTAP regression
-- test below: `now()` is frozen for the entire duration of a
-- transaction in Postgres, so two events recorded moments apart inside
-- the SAME transaction (exactly how a pgTAP test runs, wrapped in one
-- begin/rollback) get an IDENTICAL occurred_at, making "order by
-- occurred_at desc" an unreliable tie-break - it picked the stale event
-- about as often as the correct one. `id` is monotonically increasing
-- by insertion order regardless of transaction timing, so it resolves
-- the tie correctly in both a real multi-transaction production flow
-- and a single-transaction test.

create or replace view attendance_rate_by_session_number
  with (security_invoker = true)
  as
  with latest_per_subject as (
    select distinct on (subject_id, (payload->>'session_number')::int)
      subject_id,
      (payload->>'session_number')::int as session_number,
      event_type
    from analytics_events
    where event_type in ('session_attended', 'session_missed')
    order by subject_id, (payload->>'session_number')::int, id desc
  )
  select
    session_number,
    count(*) filter (where event_type = 'session_attended') as attended_count,
    count(*) filter (where event_type = 'session_missed') as missed_count,
    round(
      count(*) filter (where event_type = 'session_attended')::numeric / nullif(count(*), 0) * 100,
    1) as attendance_rate_percent
  from latest_per_subject
  group by session_number
  order by session_number;

create or replace function retention_at_session(session_num int, target_cohort_id uuid default null)
returns table (enrolled_count bigint, retained_count bigint, retention_rate_percent numeric)
language sql
security invoker
stable
as $$
  select
    count(*) as enrolled_count,
    count(*) filter (
      where (
        select ae.event_type from analytics_events ae
        where ae.subject_id = a.id::text
          and ae.event_type in ('session_attended', 'session_missed')
          and (ae.payload->>'session_number')::int = session_num
        order by ae.id desc
        limit 1
      ) = 'session_attended'
    ) as retained_count,
    round(
      count(*) filter (
        where (
          select ae.event_type from analytics_events ae
          where ae.subject_id = a.id::text
            and ae.event_type in ('session_attended', 'session_missed')
            and (ae.payload->>'session_number')::int = session_num
          order by ae.id desc
          limit 1
        ) = 'session_attended'
      )::numeric / nullif(count(*), 0) * 100,
    1) as retention_rate_percent
  from applicants a
  where a.status in ('enrolled', 'attending', 'completed')
    and (target_cohort_id is null or a.cohort_id = target_cohort_id);
$$;
