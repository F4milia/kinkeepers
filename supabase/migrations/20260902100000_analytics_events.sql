-- P5 (Wave 6, run out of order at Ferenz's direction - see CLAUDE.md's L5
-- Learned Constraints entry for why): append-only analytics events, kept
-- entirely separate from audit_log (privileged-action accountability) and
-- applicant_status_events (operational status history) - this table
-- exists purely to answer retention/conversion questions with SQL, per
-- the run doc's own "no third-party analytics... query them with SQL"
-- requirement (CLAUDE.md invariant #3).
--
-- Of the six named event types, only three have a real trigger to hook
-- into today - confirmed by grep before writing this, not assumed:
--   member_enrolled   - assign_applicant_to_cohort() already exists
--   cohort_completed  - mark_cohort_completed() already exists
--   member_dropped    - no withdraw function existed; added below
-- The other three have no real backend AT ALL yet, confirmed absent:
--   session_attended / session_missed - no attendance-confirmation table,
--     column, or function exists anywhere (the facilitator session-log
--     UI only writes to localStorage - see components/facilitator/
--     session-log.tsx). Attendance tracking is X4's unbuilt territory.
--   post_created - no posts/discussion table exists anywhere (confirmed
--     again during L5 - the discussion board is local React state only).
-- Confirmed with Ferenz before writing any of this: inventing either
-- backend here would be scope creep into sessions this run doc names
-- separately (X4) or doesn't name at all (a real discussion backend
-- isn't its own session anywhere in this doc). The derived views below
-- for those two are still built as correct SQL against this event
-- shape now - they'll simply return zero/empty until those backends
-- exist and start writing events, which is honest, not silently broken.

create type analytics_event_type as enum (
  'member_enrolled',
  'session_attended',
  'session_missed',
  'post_created',
  'member_dropped',
  'cohort_completed'
);

-- Column list matches the run doc's own spec exactly: id, event_type,
-- occurred_at, actor_id, subject_id, cohort_id, payload jsonb. No
-- subject_type column (unlike audit_log) - event_type itself already
-- determines what subject_id refers to (an applicant id for every type
-- except cohort_completed, where it's the cohort's own id).
create table analytics_events (
  id bigint generated always as identity primary key,
  event_type analytics_event_type not null,
  occurred_at timestamptz not null default now(),
  actor_id uuid references profiles (id),
  subject_id text not null,
  cohort_id uuid references cohorts (id),
  payload jsonb
);

alter table analytics_events enable row level security;

-- Same append-only-at-the-grant-level discipline as audit_log - RLS
-- doesn't apply to service_role, so "no update/delete policy" alone
-- would not stop the admin client from editing history. Default ACLs
-- grant new tables FULL privileges to anon/authenticated/service_role at
-- creation time (CLAUDE.md's Learned Constraints, 2026-08-26 entry) -
-- every restriction below is an explicit REVOKE, not an omitted GRANT.
revoke all on analytics_events from anon, authenticated;
revoke update, delete, truncate on analytics_events from service_role;
grant insert, select on analytics_events to service_role;
grant usage on sequence analytics_events_id_seq to service_role;

create index analytics_events_occurred_at_idx on analytics_events (occurred_at desc);
create index analytics_events_type_idx on analytics_events (event_type);
create index analytics_events_cohort_idx on analytics_events (cohort_id);

-- The composable write path, same shape as record_audit_event: security
-- definer + fixed search_path so a privileged mutation function can
-- `perform` this as part of its own transaction - if the event write
-- fails, the mutation it's recording rolls back with it (CLAUDE.md
-- invariant #9, applied here even though this isn't the audit log
-- itself, since the same "don't silently lose the record" reasoning
-- applies to retention data P5's own prompt calls irreplaceable: "Run
-- this BEFORE the first real cohort. Retroactive retention analysis on
-- events that were never recorded is impossible.")
create function record_analytics_event(
  event_type analytics_event_type,
  subject_id text,
  cohort_id uuid default null,
  actor_id uuid default null,
  payload jsonb default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  insert into public.analytics_events (event_type, subject_id, cohort_id, actor_id, payload)
  values (event_type, subject_id, cohort_id, actor_id, payload)
  returning id into new_id;
  return new_id;
end;
$$;

-- Same reasoning as record_audit_event: default ACL grants EXECUTE to
-- every role at creation time - revoke first, or any signed-in user
-- could fabricate analytics history under a false actor_id.
revoke execute on function record_analytics_event from public, anon, authenticated;
grant execute on function record_analytics_event to service_role;

-- ---------------------------------------------------------------------
-- member_enrolled - wired into the existing assign_applicant_to_cohort().
-- CREATE OR REPLACE, not an edit to the original migration file: that
-- file already applied to hosted before this session started (CLAUDE.md's
-- 2026-09-01 Learned Constraints entry - a migration must never be edited
-- again once any environment may have applied it). Function body is
-- otherwise byte-for-byte identical to 20260829120200's original.
-- ---------------------------------------------------------------------
create or replace function assign_applicant_to_cohort(
  actor_id uuid,
  target_applicant_id uuid,
  target_cohort_id uuid
)
returns applicants
language plpgsql
security definer
set search_path = ''
as $$
declare
  applicant_status public.applicant_status;
  applicant_referral_source public.referral_source;
  cohort_capacity int;
  current_occupancy int;
  updated_row public.applicants;
begin
  select status, referral_source into applicant_status, applicant_referral_source
    from public.applicants where id = target_applicant_id for update;
  if not found then
    raise exception 'applicant % not found', target_applicant_id;
  end if;
  if applicant_status != 'pending_review' then
    raise exception 'applicant % is not awaiting review', target_applicant_id;
  end if;

  select capacity into cohort_capacity from public.cohorts where id = target_cohort_id for update;
  if not found then
    raise exception 'cohort % not found', target_cohort_id;
  end if;

  select count(*) into current_occupancy
    from public.applicants
    where cohort_id = target_cohort_id and status not in ('declined', 'withdrawn');

  if current_occupancy >= cohort_capacity then
    raise exception 'cohort % is at capacity', target_cohort_id;
  end if;

  update public.applicants
  set status = 'enrolled', cohort_id = target_cohort_id
  where id = target_applicant_id
  returning * into updated_row;

  perform public.record_audit_event(
    actor_id,
    'applicant_assigned'::public.audit_action,
    'applicant',
    target_applicant_id::text,
    null,
    jsonb_build_object('cohort_id', target_cohort_id)
  );

  perform public.record_analytics_event(
    'member_enrolled'::public.analytics_event_type,
    target_applicant_id::text,
    target_cohort_id,
    actor_id,
    jsonb_build_object('referral_source', applicant_referral_source)
  );

  return updated_row;
end;
$$;

revoke execute on function assign_applicant_to_cohort from public, anon, authenticated;
grant execute on function assign_applicant_to_cohort to service_role;

-- ---------------------------------------------------------------------
-- cohort_completed - wired into the existing mark_cohort_completed().
-- completion_rate is sessions-that-occurred / total sessions, excluding
-- cancelled ones - computable today with no attendance data at all,
-- matching A3's own "a cancelled session is our failure, not the
-- member's absence" philosophy (cancelled sessions were never counted
-- against completion by anything in this codebase - see this migration's
-- predecessor's own comment). NOT an attendance rate - no per-member
-- attendance exists to compute one from yet.
-- ---------------------------------------------------------------------
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

revoke execute on function mark_cohort_completed from public, anon, authenticated;
grant execute on function mark_cohort_completed to service_role;

-- ---------------------------------------------------------------------
-- member_dropped - no withdraw function existed anywhere (confirmed by
-- grep: the 'withdrawn' status has existed in the enum since P2, and is
-- already excluded from occupancy counts above, but nothing ever sets
-- it). Same shape as decline_applicant/reopen_applicant directly above
-- it in the original A2 migration - reason is free text, same as
-- applicant_status_events.reason and decline's own pattern, not a new
-- rigid enum (this is operational admin data, not member-facing copy -
-- same reasoning already used for applicant_decline_reason).
--
-- Guarded from 'enrolled' or 'attending' only: a pending_review
-- applicant who wants out is declined (already a workflow), not
-- withdrawn - withdrawal specifically means "was enrolled, dropped
-- before completing," which is the retention signal P5 cares about.
-- ---------------------------------------------------------------------
alter type audit_action add value 'applicant_withdrawn';

create function withdraw_applicant(
  actor_id uuid,
  target_applicant_id uuid,
  reason text default null
)
returns applicants
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_row public.applicants;
begin
  update public.applicants
  set status = 'withdrawn'
  where id = target_applicant_id and status in ('enrolled', 'attending')
  returning * into updated_row;

  if not found then
    raise exception 'applicant % is not enrolled or attending', target_applicant_id;
  end if;

  perform public.record_audit_event(
    actor_id,
    'applicant_withdrawn'::public.audit_action,
    'applicant',
    target_applicant_id::text,
    reason,
    null
  );

  perform public.record_analytics_event(
    'member_dropped'::public.analytics_event_type,
    target_applicant_id::text,
    updated_row.cohort_id,
    actor_id,
    jsonb_build_object('reason_code', reason)
  );

  return updated_row;
end;
$$;

revoke execute on function withdraw_applicant from public, anon, authenticated;
grant execute on function withdraw_applicant to service_role;

-- ---------------------------------------------------------------------
-- Derived views. Ivan reads these with a query, per the run doc's own
-- "build these as views or functions, not a dashboard" - no admin screen
-- in this PR. All revoke anon/authenticated and grant only service_role:
-- these aggregate across every partner organization and cohort at once,
-- which a partner_staff or facilitator role has no business seeing
-- regardless of what their own row-level RLS would otherwise allow -
-- these are Ivan's queries, not a member-facing or partner-facing
-- surface. security_invoker is set for consistency with this codebase's
-- other views (e.g. applicant_waitlist_summary) even though it's moot
-- here (service_role bypasses RLS regardless of invoker/definer).
-- ---------------------------------------------------------------------

-- Real today: applicants and member_enrolled events both exist now.
create view referral_conversion
  with (security_invoker = true)
  as
  select
    po.id as partner_organization_id,
    po.name as partner_organization_name,
    count(a.id) as total_referred,
    count(ae.id) as total_enrolled,
    round(count(ae.id)::numeric / nullif(count(a.id), 0) * 100, 1) as conversion_rate_percent
  from partner_organizations po
  left join applicants a on a.partner_organization_id = po.id
  left join analytics_events ae
    on ae.event_type = 'member_enrolled' and ae.subject_id = a.id::text
  group by po.id, po.name;

-- Real today: same two real data sources as above, joined on time.
create view cohort_fill_time
  with (security_invoker = true)
  as
  select
    c.id as cohort_id,
    c.name as cohort_name,
    avg(ae.occurred_at - a.created_at) as avg_referral_to_enrolled
  from cohorts c
  join applicants a on a.cohort_id = c.id
  join analytics_events ae
    on ae.event_type = 'member_enrolled' and ae.subject_id = a.id::text
  group by c.id, c.name;

-- Structurally correct, empty until attendance exists (session_attended/
-- session_missed have no real trigger yet - see this migration's header
-- comment). session_number lives in payload since analytics_events has
-- no dedicated column for it.
create view attendance_rate_by_session_number
  with (security_invoker = true)
  as
  select
    (payload->>'session_number')::int as session_number,
    count(*) filter (where event_type = 'session_attended') as attended_count,
    count(*) filter (where event_type = 'session_missed') as missed_count,
    round(
      count(*) filter (where event_type = 'session_attended')::numeric / nullif(count(*), 0) * 100,
    1) as attendance_rate_percent
  from analytics_events
  where event_type in ('session_attended', 'session_missed')
  group by (payload->>'session_number')::int
  order by session_number;

-- Structurally correct, empty until attendance exists - shared logic for
-- retention_at_session_3/6 (named separately in the run doc) factored
-- into one function rather than duplicated across two views.
--
-- target_cohort_id is optional (null = every cohort that ever existed,
-- what the two named views below use) since a single number blended
-- across every cohort regardless of program/cadence is a coarser
-- question than "what's retention for cohort X" - Ivan's real use case.
-- Passing a specific cohort_id is also what makes this function
-- independently testable in isolation from whatever else already exists
-- in the database (seed data, other cohorts) - confirmed necessary by
-- hand: an earlier version with no cohort filter produced a diluted,
-- wrong-looking percentage once seed.sql's own unrelated enrolled/
-- completed applicants (from L5's seed additions) were counted in.
create function retention_at_session(session_num int, target_cohort_id uuid default null)
returns table (enrolled_count bigint, retained_count bigint, retention_rate_percent numeric)
language sql
security invoker
stable
as $$
  select
    count(*) as enrolled_count,
    count(*) filter (
      where exists (
        select 1 from analytics_events ae
        where ae.subject_id = a.id::text
          and ae.event_type = 'session_attended'
          and (ae.payload->>'session_number')::int = session_num
      )
    ) as retained_count,
    round(
      count(*) filter (
        where exists (
          select 1 from analytics_events ae
          where ae.subject_id = a.id::text
            and ae.event_type = 'session_attended'
            and (ae.payload->>'session_number')::int = session_num
        )
      )::numeric / nullif(count(*), 0) * 100,
    1) as retention_rate_percent
  from applicants a
  where a.status in ('enrolled', 'attending', 'completed')
    and (target_cohort_id is null or a.cohort_id = target_cohort_id);
$$;

revoke execute on function retention_at_session from public, anon, authenticated;
grant execute on function retention_at_session to service_role;

create view retention_at_session_3
  with (security_invoker = true)
  as select * from retention_at_session(3);

create view retention_at_session_6
  with (security_invoker = true)
  as select * from retention_at_session(6);

-- Structurally correct, empty until a real posts table exists
-- (post_created has no real trigger yet - see this migration's header
-- comment).
create view engagement_rate
  with (security_invoker = true)
  as
  select
    c.id as cohort_id,
    c.name as cohort_name,
    count(distinct a.id) as enrolled_count,
    count(distinct ae.subject_id) as members_who_posted,
    round(
      count(distinct ae.subject_id)::numeric / nullif(count(distinct a.id), 0) * 100,
    1) as engagement_rate_percent
  from cohorts c
  left join applicants a on a.cohort_id = c.id and a.status in ('enrolled', 'attending', 'completed')
  left join analytics_events ae on ae.cohort_id = c.id and ae.event_type = 'post_created'
  group by c.id, c.name;

revoke all on referral_conversion, cohort_fill_time, attendance_rate_by_session_number,
  retention_at_session_3, retention_at_session_6, engagement_rate
  from anon, authenticated;
grant select on referral_conversion, cohort_fill_time, attendance_rate_by_session_number,
  retention_at_session_3, retention_at_session_6, engagement_rate
  to service_role;
