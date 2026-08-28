-- A3 (Wave 4): extends A2's minimal cohorts stub with real creation
-- fields, and adds the sessions table - nothing before this session has
-- needed one. See program_catalog.sql's own comment for how
-- is_program_licensed() is meant to be wired in here (a trigger, since
-- CHECK constraints can't subquery another table).

create type cohort_status as enum ('draft', 'active', 'completed', 'cancelled');
create type cohort_delivery_format as enum ('video', 'in_person');
create type session_status as enum ('scheduled', 'completed', 'cancelled');

-- program_id/facilitator_id/first_session_date/delivery_format are
-- nullable at the schema level, not because they're optional for a real
-- cohort (the create-cohort Server Action, this session's next PR,
-- always supplies all four) - this table already has one pre-existing
-- row from A2's own work, predating this migration, with a real
-- assigned applicant attached, that never collected these fields. Same
-- "grows incrementally, minimal-then-extended" pattern already used for
-- partner_organizations/profiles. Completeness for the real creation
-- flow is enforced by the Server Action and by the trigger below (which
-- only validates a column when it's actually set), not by a blanket NOT
-- NULL that would require inventing values for that one legacy row.
--
-- `status` defaults to 'draft', matching every genuinely NEW cohort
-- (real creation always starts there, per the lifecycle spec) - a
-- separate one-time backfill below fixes up the pre-existing row
-- instead of using the column default for that purpose (confirmed by
-- hand: defaulting to 'active' here for backfill convenience quietly
-- makes 'active' the default for every future insert too, including
-- ones that never explicitly set status - caught by a pgTAP test in the
-- next PR that inserted a cohort without specifying status and got
-- 'active' instead of the intended 'draft').
alter table cohorts
  add column program_id uuid references programs (id),
  add column facilitator_id uuid references profiles (id),
  add column partner_organization_id uuid references partner_organizations (id),
  add column first_session_date date,
  add column delivery_format cohort_delivery_format,
  add column status cohort_status not null default 'draft',
  -- Set only when Zoom meeting creation fails during cohort creation.
  -- Spec: "If Zoom creation fails, the cohort is created in draft and
  -- surfaces the error. Do not create a cohort with silently missing
  -- join links." This is where that error lives so it's actually
  -- visible, not just logged somewhere an admin never sees.
  add column zoom_setup_error text;

-- One-time backfill: the row(s) that existed before this migration ran
-- are real, already-delivering cohorts (A2's own demo data has a live
-- enrolled applicant attached), not fresh drafts - captured before the
-- column existed so it can't be confused with a genuinely new 'draft'
-- row inserted moments later by this same reset/deploy.
update cohorts set status = 'active' where status = 'draft';

-- Enforces both cross-table checks a plain CHECK constraint can't
-- express. Runs on INSERT and on UPDATE (not just creation) since a
-- cohort's facilitator can be reassigned later. Deliberately silent
-- (no-op) when the relevant column is null - that's the pre-A3 legacy
-- row's own state, not a violation.
create function enforce_cohort_program_and_facilitator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.program_id is not null and not public.is_program_licensed(new.program_id) then
    raise exception 'program % is not licensed - cohorts may only run on licensed programs', new.program_id;
  end if;

  if new.facilitator_id is not null and not exists (
    select 1 from public.profiles where id = new.facilitator_id and role = 'facilitator'
  ) then
    raise exception 'profile % is not a facilitator', new.facilitator_id;
  end if;

  return new;
end;
$$;

revoke execute on function enforce_cohort_program_and_facilitator from public, anon, authenticated;
grant execute on function enforce_cohort_program_and_facilitator to service_role;

create trigger cohorts_enforce_program_and_facilitator
  before insert or update on cohorts
  for each row execute function enforce_cohort_program_and_facilitator();

-- Now that cohorts.facilitator_id exists, "a facilitator sees only their
-- own cohorts" (A1's persona table) is finally buildable - it was
-- explicitly deferred in A2's own migration comment for exactly this
-- reason ("neither role has a way to be linked to a cohort yet").
-- Additive alongside the existing admin-only policy: Postgres combines
-- multiple permissive SELECT policies with OR, so this only ever widens
-- access for the facilitator role, never narrows the admin one.
create policy "cohorts_select_own_facilitator"
  on cohorts for select
  to authenticated
  using (facilitator_id = auth.uid());

create table sessions (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references cohorts (id),
  session_number int not null check (session_number > 0),
  scheduled_at timestamptz not null,
  status session_status not null default 'scheduled',
  cancellation_reason text,
  -- Null means the cohort's own facilitator delivered this session.
  -- Set only when a substitute did instead - the original facilitator
  -- stays on the cohort regardless (spec: "the original facilitator
  -- stays on the cohort, the substitute is recorded on that session...
  -- this matters for payouts: base is earned per session delivered, by
  -- whoever delivered it").
  substitute_facilitator_id uuid references profiles (id),
  video_meeting_id text,
  video_join_url text,
  video_passcode text,
  video_dial_in_number text,
  video_dial_in_pin text,
  created_at timestamptz not null default now(),
  unique (cohort_id, session_number)
);

create function enforce_session_substitute_facilitator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.substitute_facilitator_id is not null and not exists (
    select 1 from public.profiles where id = new.substitute_facilitator_id and role = 'facilitator'
  ) then
    raise exception 'profile % is not a facilitator', new.substitute_facilitator_id;
  end if;
  return new;
end;
$$;

revoke execute on function enforce_session_substitute_facilitator from public, anon, authenticated;
grant execute on function enforce_session_substitute_facilitator to service_role;

create trigger sessions_enforce_substitute_facilitator
  before insert or update on sessions
  for each row execute function enforce_session_substitute_facilitator();

alter table sessions enable row level security;
revoke all on sessions from anon, authenticated;
grant select on sessions to authenticated;
grant all on sessions to service_role;

create policy "sessions_select_admin"
  on sessions for select
  to authenticated
  using ((select role from profiles where id = auth.uid()) = 'admin');

create policy "sessions_select_own_facilitator"
  on sessions for select
  to authenticated
  using (
    substitute_facilitator_id = auth.uid()
    or exists (
      select 1 from cohorts where cohorts.id = sessions.cohort_id and cohorts.facilitator_id = auth.uid()
    )
  );

create index sessions_cohort_id_idx on sessions (cohort_id);
