-- PR3 of the P4 gap-closure needs the session's own scheduled_at and the
-- cohort's time_zone to render notifyMissedSession()'s day name (e.g.
-- "We missed you Tuesday") - applicants_due_for_missed_session_followup()
-- (20260905150000) only returned session_id/cohort_id/applicant_id.
-- Rather than an untyped nested-relation select in the Inngest handler
-- (this codebase has no generated Supabase types anywhere, and no
-- existing query joins across tables that way - every caller selects
-- flat columns), extending this function's own return shape to match
-- sessions_due_for_time_reminder()'s existing flat-columns convention.
--
-- Changing a function's RETURN TYPE requires DROP FUNCTION first -
-- CREATE OR REPLACE cannot do it (same "drop the exact old signature,
-- re-grant afterward" lesson as the 2026-09-03 Stream B Learned
-- Constraints entry, there for adding a parameter; changing the return
-- table has the identical requirement).
drop function applicants_due_for_missed_session_followup(timestamptz);

create function applicants_due_for_missed_session_followup(p_now timestamptz default now())
returns table (
  session_id uuid,
  cohort_id uuid,
  applicant_id uuid,
  scheduled_at timestamptz,
  cohort_time_zone text
)
language sql
security definer
set search_path = ''
stable
as $$
  select s.id, s.cohort_id, a.id, s.scheduled_at, c.time_zone
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
