-- L3 audit gap-closure: claim_applicant_for_current_user() (L5,
-- 20260901190000_member_identity_bridge.sql) deliberately scoped its
-- match to enrolled applicants only ("cohort_id is not null and status
-- in ('enrolled', 'attending', 'completed')") - which meant a real
-- pending_review/intake_complete/referred applicant's first-ever sign-in
-- could never resolve to their own applicant row at all, always
-- returning null and 404ing at getCurrentApplicantOrNotFound() before
-- getViewer()'s own cohort/consent checks ever ran. Confirmed live this
-- session against a real staging fixture (Dana Whitfield, pending_review,
-- no cohort) - signing in landed on a flat 404, not the /status/
-- [applicantId] screen that already exists for exactly this state.
--
-- Widened to match any NON-terminal-negative status - every status
-- except 'declined'/'withdrawn' can now be claimed by email/phone match.
-- Those two stay deliberately unclaimable: a declined or withdrawn
-- applicant seeing a "waiting for review" status screen on sign-in would
-- be actively misleading, and what a declined/withdrawn applicant SHOULD
-- see on sign-in is its own separate UX question (the run doc's own
-- edge-case register already names "decline an applicant, then re-open
-- them" for L4 and "withdraw a member mid-program" for F2) - out of
-- scope here, not silently decided by this migration.
--
-- CREATE OR REPLACE is safe here (no DROP FUNCTION needed) - the
-- signature (name, zero arguments, returns uuid) is unchanged from the
-- original, only the body's WHERE clause changed. The P3 Learned
-- Constraints entry's DROP FUNCTION requirement applies only to adding a
-- new PARAMETER, not a body-only change.
create or replace function claim_applicant_for_current_user()
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
    and status not in ('declined', 'withdrawn')
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
    and status not in ('declined', 'withdrawn')
    and (
      (caller_email is not null and email = caller_email)
      or (caller_phone is not null and phone = caller_phone)
    );

  update public.applicants set profile_id = caller_id where id = candidate_id;
  return candidate_id;
end;
$$;

-- CREATE OR REPLACE preserves existing grants/revokes (unlike DROP
-- FUNCTION, which wipes them) - restated here anyway for clarity, not
-- because it's structurally required this time.
revoke execute on function claim_applicant_for_current_user from public, anon;
grant execute on function claim_applicant_for_current_user to authenticated;
