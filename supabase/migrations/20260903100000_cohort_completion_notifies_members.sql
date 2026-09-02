-- X3: mark_cohort_completed only ever updated cohorts.status - no code
-- path anywhere transitions an individual applicant's status to
-- 'completed', so a member's own status page (L4) would show them as
-- still "enrolled, before session one" forever, even after their cohort
-- is marked completed. Real gap, not something X3 invented: caught
-- while wiring the "program complete" message, since sending that
-- message to someone whose stored status still says "enrolled" would
-- be inconsistent with what the rest of the app shows them.
--
-- CREATE OR REPLACE, based on the CURRENT function body (P5's
-- 20260902100000, which already replaced A3's original version to add
-- the cohort_completed analytics event) - not A3's original version.
-- Getting this wrong once already cost a full pgTAP regression
-- (analytics_events.sql's completion_rate assertion went from a real
-- number to NULL, since a naive CREATE OR REPLACE off the older version
-- would silently delete P5's entire analytics instrumentation) - caught
-- immediately by the full suite, fixed before this migration was ever
-- pushed anywhere. Only new line is the applicants update.
--
-- applicants_log_status_event (P2) already fires generically on any
-- status change, so this update alone produces correct, individually-
-- timestamped status-event rows for every affected member with no
-- additional code - same "trigger already does the logging" reasoning
-- every other status transition in this schema relies on.
create or replace function mark_cohort_completed(
  actor_id uuid,
  target_cohort_id uuid
)
returns cohorts
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_row public.cohorts;
  total_sessions int;
  occurred_sessions int;
  computed_completion_rate numeric;
begin
  update public.cohorts set status = 'completed' where id = target_cohort_id and status = 'active'
  returning * into updated_row;

  if not found then
    raise exception 'cohort % is not active - only an active cohort can be marked completed', target_cohort_id;
  end if;

  update public.applicants
  set status = 'completed'
  where cohort_id = target_cohort_id and status in ('enrolled', 'attending');

  select count(*), count(*) filter (where status != 'cancelled')
    into total_sessions, occurred_sessions
    from public.sessions where cohort_id = target_cohort_id;

  computed_completion_rate := case when total_sessions > 0
    then round(occurred_sessions::numeric / total_sessions, 3)
    else null
  end;

  perform public.record_audit_event(
    actor_id,
    'cohort_completed'::public.audit_action,
    'cohort',
    target_cohort_id::text,
    null,
    null
  );

  perform public.record_analytics_event(
    'cohort_completed'::public.analytics_event_type,
    target_cohort_id::text,
    target_cohort_id,
    actor_id,
    jsonb_build_object('completion_rate', computed_completion_rate)
  );

  return updated_row;
end;
$$;

-- Grants unchanged by CREATE OR REPLACE (same name, same signature) -
-- Postgres preserves them, so they aren't repeated here.

-- Negative-test drill, actually run (not hypothetical): commented out
-- the applicants update above, `supabase db reset --local`, ran the
-- full suite -> exactly tests 5 and 6 in
-- supabase/tests/database/cohort_completion_function.sql failed as
-- expected ("have: enrolled/attending, want: completed"), nothing else
-- in the suite moved (analytics_events.sql's completion_rate assertion
-- stayed green, confirming P5's logic really is intact and independent
-- of this cascade). Restored, reset --local, full suite (288/288)
-- passing again.
