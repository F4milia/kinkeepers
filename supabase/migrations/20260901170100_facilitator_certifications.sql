-- A4-cert: facilitator certification tracking and assignment enforcement.
--
-- "A facilitator may only be assigned to a cohort for a program they are
-- currently certified in. Enforce this at assignment: block it, and say
-- why." The enforcement point already exists - A3's
-- enforce_cohort_program_and_facilitator() trigger on cohorts already
-- blocks an unlicensed program and a non-facilitator profile. This
-- migration extends that same function (create or replace, not a new
-- trigger) rather than touching A3's original migration file, which per
-- CLAUDE.md's Learned constraints must never be edited once any
-- environment may have applied it.
create table facilitator_certifications (
  id uuid primary key default gen_random_uuid(),
  -- on delete cascade, deliberately unlike audit_log.actor_id (RESTRICT
  -- by default there, and by design - see CLAUDE.md's Learned constraints,
  -- P7a entry: once a profile has any audit_log row it can never be hard-
  -- deleted). A certification record isn't a compliance trail that must
  -- outlive the person the way an audit entry is - deleting the
  -- facilitator's profile should be able to take their certification
  -- history with it, not become permanently blocked by it.
  facilitator_id uuid not null references profiles (id) on delete cascade,
  program_id uuid not null references programs (id),
  certified_on date not null,
  expires_on date not null check (expires_on > certified_on),
  -- Free text, not an enum - certifying bodies vary per program and
  -- nothing in either companion doc enumerates a fixed set.
  certifying_body text not null,
  evidence_note text,
  created_at timestamptz not null default now()
);

-- Multiple rows per (facilitator, program) over time are expected and
-- valuable - a recertification is a new row, not an overwrite, same
-- "history, not a single mutable status" reasoning P6 used for
-- member_consents.
create index facilitator_certifications_facilitator_program_idx
  on facilitator_certifications (facilitator_id, program_id, expires_on);

alter table facilitator_certifications enable row level security;

-- New tables get FULL default privileges to anon/authenticated/
-- service_role at creation time (CLAUDE.md's Learned constraints) -
-- explicit revoke first, then grant exactly what's needed.
revoke all on facilitator_certifications from anon, authenticated;
grant select on facilitator_certifications to authenticated;
grant all on facilitator_certifications to service_role;

-- A facilitator can see their own certification record (relevant to a
-- future facilitator-facing screen - F2/F3). Writes are admin-only, via
-- the service-role client from an admin Server Action - certification
-- data entry is a compliance action, same treatment as every other
-- admin-managed table so far (partner_organizations, programs).
create policy "facilitator_certifications_select_own"
  on facilitator_certifications for select
  to authenticated
  using (facilitator_id = auth.uid());

-- Grants on the function are unchanged by CREATE OR REPLACE (same name,
-- same signature) - Postgres preserves them, so they aren't repeated
-- here. Adds the third check; the first two (license status, real
-- facilitator role) are exactly what A3 already enforces.
create or replace function enforce_cohort_program_and_facilitator()
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

  if new.program_id is not null and new.facilitator_id is not null and not exists (
    select 1 from public.facilitator_certifications
    where facilitator_id = new.facilitator_id
      and program_id = new.program_id
      and expires_on >= current_date
  ) then
    raise exception 'facilitator % is not currently certified for program %', new.facilitator_id, new.program_id;
  end if;

  return new;
end;
$$;
