-- X2: program catalog and license gating.
--
-- A3 (Wave 4) creates cohorts and needs a program to select from. This
-- migration exists first so that when A3 builds cohorts.program_id, the
-- license-gating enforcement (is_program_licensed() below) already
-- exists, tested, ready to call - not something A3 has to invent from
-- scratch under its own migration.
--
-- The whole point of this session: make it structurally impossible to
-- run a cohort on a program we haven't licensed. See is_program_licensed()
-- and its comment for exactly how A3 should wire that in.

create type program_license_status as enum ('not_licensed', 'in_negotiation', 'licensed');

create table programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  developer text not null,
  session_count int not null check (session_count > 0),
  session_duration_minutes int not null check (session_duration_minutes > 0),
  delivery_formats text[] not null,
  languages text[] not null,
  facilitator_qualification text not null,
  license_status program_license_status not null default 'not_licensed',
  notes text,
  created_at timestamptz not null default now()
);

-- Titles/descriptions stay NULL until Ivan confirms the license permits
-- display - licensed curriculum content may be protected. Never populate
-- these from any source, never infer them, never write a placeholder
-- that could be mistaken for a real title.
create table program_sessions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs (id) on delete cascade,
  session_number int not null check (session_number > 0),
  title text,
  description text,
  unique (program_id, session_number)
);

alter table programs enable row level security;
alter table program_sessions enable row level security;

-- New tables get FULL default privileges to anon/authenticated/service_role
-- at CREATE TABLE time - a persistent default ACL on the postgres role for
-- schema public (see CLAUDE.md's Architecture notes). Explicitly revoke
-- rather than relying on omission.
revoke all on programs, program_sessions from anon, authenticated;

grant select on programs, program_sessions to authenticated;
grant all on programs, program_sessions to service_role;

-- All programs are visible to any signed-in user, regardless of license
-- status - an admin reviewing what's in the pipeline needs to see
-- in_negotiation rows too, not just licensed ones. The gate is at cohort
-- creation, not at visibility.
create policy "programs_select_authenticated"
  on programs for select
  to authenticated
  using (true);

create policy "program_sessions_select_authenticated"
  on program_sessions for select
  to authenticated
  using (true);

-- The enforcement point. A3's cohorts table should give cohorts.program_id
-- a CHECK constraint calling this (check constraints can't subquery
-- directly in Postgres, so this needs to be either a trigger calling this
-- function, or the application layer calling it before insert - a trigger
-- is the structurally-safe choice per CLAUDE.md's "RLS is the security
-- model, not a layer on it" philosophy, since it can't be bypassed by a
-- code path that forgets to check). Built and tested now so A3 doesn't
-- have to invent this logic under its own migration.
create function is_program_licensed(check_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.programs
    where id = check_program_id and license_status = 'licensed'
  );
$$;

revoke execute on function is_program_licensed from public, anon;
grant execute on function is_program_licensed to authenticated, service_role;
