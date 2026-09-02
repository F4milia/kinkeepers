-- F3: session prep view + certification-gated materials.
--
-- Materials belong to program_sessions (the curriculum slot, shared
-- across every cohort running that program), not to a specific sessions
-- row - same modeling program_sessions already uses for titles/
-- descriptions. No real curriculum content exists yet (see
-- program_sessions' own comment: titles/descriptions stay null until
-- Ivan confirms licensing) - seed.sql's rows are obviously-placeholder,
-- same treatment already given to consent_documents' "[PLACEHOLDER...]"
-- text, never real files.
create table session_materials (
  id uuid primary key default gen_random_uuid(),
  program_session_id uuid not null references program_sessions (id) on delete cascade,
  title text not null,
  -- Never a public URL - a path a signed URL gets generated from, at
  -- request time, only for a caller who already passed the
  -- ownership+certification check below. No file exists behind these
  -- placeholder paths - see seed.sql's own comment.
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table session_materials enable row level security;

-- New tables get FULL default privileges to anon/authenticated/
-- service_role at creation time (CLAUDE.md's Learned constraints) -
-- explicit revoke first, then grant exactly what's needed. No SELECT
-- policy at all for authenticated: this table is reachable ONLY through
-- get_session_prep_materials() below, never a direct query - RLS alone
-- can't express "restricted to a currently-certified facilitator for
-- THIS specific session", so the table stays service-role-only and the
-- SECURITY DEFINER function is the real access boundary, same
-- "expose a slice, not the row" pattern as list_cohort_roster.
revoke all on session_materials from anon, authenticated;
grant all on session_materials to service_role;

-- Prep roster: deliberately NOT a new function here. X4's
-- list_cohort_roster_for_facilitator(cohort_id) already does the
-- ownership-verified roster lookup a prep view needs, and
-- session_attendance_select_own_facilitator (X4, same migration) already
-- lets the owning facilitator read real attendance rows for their own
-- cohort directly - both are real, already-audited access paths, not
-- something worth a second SECURITY DEFINER function that would
-- duplicate the exact same ownership check. Attendance counts, not
-- per-member notes: lib/data.ts composes these two into a real per-
-- member aggregate (how many of this cohort's PAST sessions this
-- applicant was marked present for) - a number, never free text about a
-- specific person. Deliberately NOT certification-gated either way - a
-- facilitator whose certification has lapsed still legitimately needs to
-- see who's coming, for logistics; only the licensed materials below are
-- restricted to currently-certified facilitators.

-- Materials: same ownership check as the roster path above, PLUS the
-- certification check enforce_cohort_program_and_facilitator already
-- uses for cohort assignment - applied here to viewing materials
-- instead. An uncertified owner-facilitator gets a named exception, not
-- a silently empty list, so "verified with a test user lacking
-- certification" has something concrete to assert on.
create function get_session_prep_materials(target_session_id uuid)
returns table (material_id uuid, title text, storage_path text)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_program_id uuid;
  v_session_number int;
  v_is_owner boolean;
begin
  select c.program_id, s.session_number,
    (c.facilitator_id = auth.uid() or s.substitute_facilitator_id = auth.uid())
    into v_program_id, v_session_number, v_is_owner
  from public.sessions s
  join public.cohorts c on c.id = s.cohort_id
  where s.id = target_session_id;

  if v_is_owner is not true then
    raise exception 'session % is not yours to prep', target_session_id;
  end if;

  if v_program_id is null then
    return;
  end if;

  if not exists (
    select 1 from public.facilitator_certifications
    where facilitator_id = auth.uid()
      and program_id = v_program_id
      and expires_on >= current_date
  ) then
    raise exception 'facilitator % is not currently certified for program %', auth.uid(), v_program_id;
  end if;

  return query
    select sm.id, sm.title, sm.storage_path
    from public.session_materials sm
    join public.program_sessions ps on ps.id = sm.program_session_id
    where ps.program_id = v_program_id and ps.session_number = v_session_number;
end;
$$;

revoke execute on function get_session_prep_materials from public, anon;
grant execute on function get_session_prep_materials to authenticated;
