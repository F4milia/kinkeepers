-- X4 (Wave 9, run out of order at Ferenz's direction, same as P5):
-- prerequisite the run doc never actually assigns to anyone. P3's own
-- attendance pre-fill module says outright: "This module has no
-- attendance table to write to yet (that's A3/A5's territory)" - but
-- neither A3 nor A5 ever built one (confirmed by grep before writing
-- this), and X4's own prompt only extends an existing pre-fill/confirm
-- mechanism to phone joiners - it doesn't build the mechanism itself.
-- Nothing in the entire run doc explicitly owns "persist a real
-- attendance-confirmation record." Confirmed with Ferenz before treating
-- it as X4's job.
--
-- Two tables: session_logs (one per session - delivery confirmation +
-- notes) and session_attendance (one per session per applicant - the
-- actual mark). Kept separate because they have different cardinality
-- and different "who can see this" shapes, same reasoning already used
-- to split audit_log (accountability) from applicant_status_events
-- (domain history) rather than cramming both into one table.
--
-- CLAUDE.md invariant #7 ("attendance is pre-filled, never
-- auto-committed... a facilitator confirms") is enforced structurally:
-- the ONLY write path is submit_session_log(), called from a facilitator
-- (or their substitute) explicitly submitting the log screen - nothing
-- in this migration ever writes an attendance row on its own.

alter type audit_action add value 'session_log_submitted';

create type session_attendance_status as enum ('present', 'absent', 'excused');

create table session_logs (
  session_id uuid primary key references sessions (id),
  delivery_confirmed boolean not null default false,
  notes text,
  logged_by uuid not null references profiles (id),
  logged_at timestamptz not null default now(),
  updated_by uuid references profiles (id),
  updated_at timestamptz
);

alter table session_logs enable row level security;

-- Default ACLs grant FULL privileges to anon/authenticated/service_role
-- at creation time (CLAUDE.md's Learned Constraints, 2026-08-26 entry) -
-- explicit revoke first. Writes only ever happen through
-- submit_session_log() below (service_role, trusted actor_id) - same
-- "Server Action gates, RPC trusts" division of responsibility as every
-- other admin/facilitator mutation in this codebase - so authenticated
-- gets read-only access via the policies below, never a write grant.
revoke all on session_logs from anon, authenticated;
grant select on session_logs to authenticated;
grant all on session_logs to service_role;

create policy "session_logs_select_admin"
  on session_logs for select
  to authenticated
  using ((select role from profiles where id = auth.uid()) = 'admin');

create policy "session_logs_select_own_facilitator"
  on session_logs for select
  to authenticated
  using (
    exists (
      select 1 from sessions s
      join cohorts c on c.id = s.cohort_id
      where s.id = session_logs.session_id
        and (c.facilitator_id = auth.uid() or s.substitute_facilitator_id = auth.uid())
    )
  );

create table session_attendance (
  id bigint generated always as identity primary key,
  session_id uuid not null references sessions (id),
  applicant_id uuid not null references applicants (id),
  status session_attendance_status not null,
  marked_by uuid not null references profiles (id),
  marked_at timestamptz not null default now(),
  unique (session_id, applicant_id)
);

alter table session_attendance enable row level security;
revoke all on session_attendance from anon, authenticated;
grant select on session_attendance to authenticated;
grant all on session_attendance to service_role;

create policy "session_attendance_select_admin"
  on session_attendance for select
  to authenticated
  using ((select role from profiles where id = auth.uid()) = 'admin');

create policy "session_attendance_select_own_facilitator"
  on session_attendance for select
  to authenticated
  using (
    exists (
      select 1 from sessions s
      join cohorts c on c.id = s.cohort_id
      where s.id = session_attendance.session_id
        and (c.facilitator_id = auth.uid() or s.substitute_facilitator_id = auth.uid())
    )
  );

-- A member reads their own attendance record only - same additive-OR
-- pattern already used for cohorts_select_own_member /
-- sessions_select_own_member (L5's identity bridge).
create policy "session_attendance_select_own_member"
  on session_attendance for select
  to authenticated
  using (
    exists (
      select 1 from applicants a
      where a.id = session_attendance.applicant_id and a.profile_id = auth.uid()
    )
  );

create index session_attendance_session_idx on session_attendance (session_id);
create index session_attendance_applicant_idx on session_attendance (applicant_id);

-- The composable write path. Upserts the session-level log, then each
-- attendance mark, firing an analytics event (P5) only when a mark
-- actually changes value - not on every resubmission of an unchanged
-- mark, which would double-count in analytics_events (an append-only
-- log, not a current-state table). Every submission - first time or a
-- correction - writes exactly one audit_log row, satisfying A5's
-- "attendance corrections preserve prior values and write audit rows"
-- with one row per submission rather than one per member changed.
--
-- `attendance` shape: a jsonb array of {"applicant_id": uuid,
-- "status": "present"|"absent"|"excused"}. Each applicant_id is verified
-- to actually belong to this session's own cohort before writing -
-- cheap defense against a caller bug cross-contaminating another
-- cohort's attendance, not a substitute for the Server Action's own
-- ownership check (which happens before this is ever called).
create function submit_session_log(
  actor_id uuid,
  target_session_id uuid,
  delivery_confirmed boolean,
  notes text,
  attendance jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_cohort_id uuid;
  target_session_number int;
  entry jsonb;
  entry_applicant_id uuid;
  entry_status public.session_attendance_status;
  previous_status public.session_attendance_status;
  changes jsonb := '[]'::jsonb;
  had_previous_log boolean;
begin
  select cohort_id, session_number into target_cohort_id, target_session_number
    from public.sessions where id = target_session_id;
  if not found then
    raise exception 'session % not found', target_session_id;
  end if;

  select exists(select 1 from public.session_logs where session_id = target_session_id) into had_previous_log;

  insert into public.session_logs (session_id, delivery_confirmed, notes, logged_by)
  values (target_session_id, delivery_confirmed, notes, actor_id)
  on conflict (session_id) do update
    set delivery_confirmed = excluded.delivery_confirmed,
        notes = excluded.notes,
        updated_by = actor_id,
        updated_at = now();

  for entry in select * from jsonb_array_elements(attendance)
  loop
    entry_applicant_id := (entry->>'applicant_id')::uuid;
    entry_status := (entry->>'status')::public.session_attendance_status;

    if not exists (select 1 from public.applicants where id = entry_applicant_id and cohort_id = target_cohort_id) then
      raise exception 'applicant % is not enrolled in session %''s cohort', entry_applicant_id, target_session_id;
    end if;

    select status into previous_status
      from public.session_attendance
      where session_id = target_session_id and applicant_id = entry_applicant_id;

    insert into public.session_attendance (session_id, applicant_id, status, marked_by)
    values (target_session_id, entry_applicant_id, entry_status, actor_id)
    on conflict (session_id, applicant_id) do update
      set status = excluded.status, marked_by = actor_id, marked_at = now();

    if previous_status is distinct from entry_status then
      changes := changes || jsonb_build_object(
        'applicant_id', entry_applicant_id,
        'previous_status', previous_status,
        'new_status', entry_status
      );

      if entry_status = 'present' then
        perform public.record_analytics_event(
          'session_attended'::public.analytics_event_type,
          entry_applicant_id::text,
          target_cohort_id,
          actor_id,
          jsonb_build_object('session_number', target_session_number)
        );
      else
        perform public.record_analytics_event(
          'session_missed'::public.analytics_event_type,
          entry_applicant_id::text,
          target_cohort_id,
          actor_id,
          jsonb_build_object('session_number', target_session_number, 'excused', entry_status = 'excused')
        );
      end if;
    end if;
  end loop;

  perform public.record_audit_event(
    actor_id,
    'session_log_submitted'::public.audit_action,
    'session',
    target_session_id::text,
    null,
    jsonb_build_object(
      'delivery_confirmed', delivery_confirmed,
      'is_correction', had_previous_log,
      'attendance_changes', changes
    )
  );
end;
$$;

revoke execute on function submit_session_log from public, anon, authenticated;
grant execute on function submit_session_log to service_role;

-- list_cohort_roster() (L5) only resolves "my own cohort" via the
-- caller's own applicant.profile_id - a facilitator has no applicant row
-- at all, so it always returns empty for them. A facilitator can run
-- more than one cohort, so "my cohort" is ambiguous for them anyway -
-- this takes the cohort explicitly and verifies the caller actually
-- runs it (or is admin) before returning names. Same narrow "expose a
-- slice, not the row" shape as list_cohort_roster - never email/phone/
-- relationship, matching F2's own future spec for the facilitator
-- roster ("first name, relationship, and how many sessions they've
-- attended. Nothing else").
create function list_cohort_roster_for_facilitator(target_cohort_id uuid)
returns table (applicant_id uuid, first_name text, last_name text)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if (select role from public.profiles where id = auth.uid()) != 'admin'
     and not exists (
       select 1 from public.cohorts c
       where c.id = target_cohort_id and c.facilitator_id = auth.uid()
     )
     and not exists (
       select 1 from public.sessions s
       where s.cohort_id = target_cohort_id and s.substitute_facilitator_id = auth.uid()
     )
  then
    raise exception 'not the facilitator for cohort %', target_cohort_id;
  end if;

  return query
    select a.id, a.first_name, a.last_name
    from public.applicants a
    where a.cohort_id = target_cohort_id;
end;
$$;

revoke execute on function list_cohort_roster_for_facilitator from public, anon;
grant execute on function list_cohort_roster_for_facilitator to authenticated;
