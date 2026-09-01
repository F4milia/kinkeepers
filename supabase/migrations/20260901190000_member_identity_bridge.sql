-- L5 (Wave 8): profiles<->applicants identity bridge.
--
-- Real gap, confirmed by grep before writing this: nothing anywhere links
-- a signed-in account (profiles.id, resolved from auth.uid()) to the
-- enrollment record that actually holds cohort_id (applicants). Every
-- member-facing screen built in frontend sessions 0-6 needs "which cohort
-- does the signed-in member belong to" answered from the database, not a
-- fixture constant - this migration is the prerequisite that answer needs.
--
-- Flagged already once, in this exact form, by L3 PR1's own commit
-- message ("a real identity-model gap, not something to invent solo in an
-- L-session") for a different pair of tables (profiles/member_consents
-- already share profiles.id directly - no gap there). This is the same
-- category of decision for applicants, confirmed with Ferenz before
-- writing any of it.

alter table applicants add column profile_id uuid unique references profiles (id);

-- Claim-on-first-visit, not claim-at-enrollment: nothing currently creates
-- an auth.users row for an applicant at enrollment time (P1's whole model
-- is passwordless sign-in initiated by the member, not an admin-issued
-- account) - the first moment a real auth identity exists for this person
-- is when they sign in themselves. Matches by email OR phone against
-- auth.users, scoped to applicants that are actually enrolled (cohort_id
-- set, status past pending_review) and not already claimed by a
-- different profile. Idempotent: a profile that already has a claimed
-- applicant just gets that same id back, no-op.
--
-- Ambiguous match (two applicant rows share this person's email/phone -
-- P2's own migration comment names this as an expected, not exceptional,
-- case for duplicate referrals) raises rather than silently picking one,
-- same "ambiguous callers surface to a human" principle already applied
-- to phone-join attendance matching (CLAUDE.md's seed learned
-- constraint). The caller (lib/data.ts) turns this into the "not found /
-- contact support" error state, never a guess.
create function claim_applicant_for_current_user()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_email text;
  caller_phone text;
  already_claimed_id uuid;
  candidate_id uuid;
  candidate_count int;
begin
  if caller_id is null then
    raise exception 'not_authenticated';
  end if;

  select id into already_claimed_id from public.applicants where profile_id = caller_id;
  if already_claimed_id is not null then
    return already_claimed_id;
  end if;

  select email, phone into caller_email, caller_phone from auth.users where id = caller_id;

  -- No min(uuid) aggregate in Postgres - count first, then fetch the one
  -- row separately rather than trying to combine both in one aggregate.
  select count(*) into candidate_count
  from public.applicants
  where profile_id is null
    and cohort_id is not null
    and status in ('enrolled', 'attending', 'completed')
    and (
      (caller_email is not null and email = caller_email)
      or (caller_phone is not null and phone = caller_phone)
    );

  if candidate_count = 0 then
    return null;
  elsif candidate_count > 1 then
    raise exception 'ambiguous_applicant_match';
  end if;

  select id into candidate_id
  from public.applicants
  where profile_id is null
    and cohort_id is not null
    and status in ('enrolled', 'attending', 'completed')
    and (
      (caller_email is not null and email = caller_email)
      or (caller_phone is not null and phone = caller_phone)
    );

  update public.applicants set profile_id = caller_id where id = candidate_id;
  return candidate_id;
end;
$$;

revoke execute on function claim_applicant_for_current_user from public, anon;
grant execute on function claim_applicant_for_current_user to authenticated;

-- A member reads their own enrollment row in full - it's their own data,
-- same reasoning as profiles_select_own (P1).
create policy "applicants_select_own_member"
  on applicants for select
  to authenticated
  using (profile_id = auth.uid());

-- Cohort-mate roster (CohortPage: "first name, avatar initials, role,
-- relationship... a face-recognition aid, not a directory"). Deliberately
-- NOT a broadened RLS policy on applicants for peer rows - that would
-- hand every authenticated client direct REST access to cohort-mates'
-- email/phone/relationship/care_recipient_stage, not just first/last
-- name, since RLS filters rows, not columns. A narrow SECURITY DEFINER
-- function returning only what the roster screen actually shows is the
-- same "expose a slice, not the row" pattern already used for
-- admin_list_consent_gaps and applicant_waitlist_summary.
create function list_cohort_roster()
returns table (applicant_id uuid, first_name text, last_name text)
language sql
security definer
set search_path = ''
stable
as $$
  select a.id, a.first_name, a.last_name
  from public.applicants a
  where a.cohort_id is not null
    and a.cohort_id = (
      select cohort_id from public.applicants where profile_id = auth.uid()
    );
$$;

revoke execute on function list_cohort_roster from public, anon;
grant execute on function list_cohort_roster to authenticated;

-- A member reads their own cohort's row (name/cadence/schedule/program) -
-- same additive-OR pattern already used for cohorts_select_own_facilitator.
create policy "cohorts_select_own_member"
  on cohorts for select
  to authenticated
  using (
    exists (
      select 1 from applicants
      where applicants.cohort_id = cohorts.id and applicants.profile_id = auth.uid()
    )
  );

-- A member reads their own cohort's sessions - same additive-OR pattern
-- already used for sessions_select_own_facilitator.
create policy "sessions_select_own_member"
  on sessions for select
  to authenticated
  using (
    exists (
      select 1 from applicants
      where applicants.cohort_id = sessions.cohort_id and applicants.profile_id = auth.uid()
    )
  );
