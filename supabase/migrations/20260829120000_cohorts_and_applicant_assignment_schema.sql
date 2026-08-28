-- A2 (Wave 3): minimal cohorts stub + the applicant-side columns needed
-- for review/assignment. A3 (Wave 4) owns real cohort creation and
-- extends this table with scheduling and Zoom fields - same "minimal
-- table now, extended later" pattern already used twice for
-- partner_organizations (P2 -> A1). Kept to exactly what A2's own
-- screens need: display fields for the assignment picker, nothing A3
-- would need to redesign around.
--
-- Deliberately no `status`/lifecycle column: A2 only needs to know
-- whether a cohort still has room, which is fully computable as
-- `capacity - count(active assignments)`. Inventing a lifecycle enum
-- ('draft'/'active'/...) here risks guessing wrong at what A3 actually
-- needs; A3 adds its own when it owns creation.
create table cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- e.g. "Spouses, early stage" - the human-readable grouping shown in
  -- the assignment picker. Free text, not derived from relationship/
  -- stage values, since a cohort's intended focus and its actual
  -- membership composition are related but not identical.
  grouping_description text not null,
  capacity int not null check (capacity > 0),
  -- Recurring weekly/biweekly meeting slot. A3 replaces this with real
  -- session rows generated from program + cadence + first session date;
  -- until then this is the single source A2 needs to render "Tuesdays
  -- at 6:30 PM Eastern" and convert it to an applicant's own zone.
  cadence text not null,
  meeting_day_of_week int not null check (meeting_day_of_week between 0 and 6),
  meeting_time time not null,
  -- IANA identifier (e.g. "America/New_York"), not a display label like
  -- "Eastern" - DST-aware conversion (this session's named edge case)
  -- requires a real zone database entry, not a fixed offset or a label.
  -- L2 (the intake form, not yet built) must collect applicants.time_zone
  -- in the same format for the conversion to mean anything.
  time_zone text not null,
  created_at timestamptz not null default now()
);

alter table cohorts enable row level security;

-- Default ACLs grant FULL privileges to anon/authenticated/service_role
-- automatically at creation time (CLAUDE.md's Learned constraints,
-- 2026-08-26 entry) - explicit revoke first, then grant exactly what's
-- needed.
revoke all on cohorts from anon, authenticated;
grant select on cohorts to authenticated;
grant all on cohorts to service_role;

-- Admin-only for now: A2's assignment screen is the only reader that
-- exists yet. Facilitator ("their own cohorts") and partner_staff
-- ("cohorts containing caregivers they referred") scoping are real
-- future requirements (A1's persona table already names them) but
-- neither role has a way to be linked to a cohort yet - that link is
-- exactly what assign_applicant_to_cohort below starts creating, and
-- A3/A5 build the read-scoping once cohorts have facilitators and real
-- membership. Revisit this policy then rather than guessing its shape
-- now.
create policy "cohorts_select_admin_only"
  on cohorts for select
  to authenticated
  using ((select role from profiles where id = auth.uid()) = 'admin');

-- Which cohort an applicant has been assigned to. Nullable - only set
-- once assign_applicant_to_cohort (next migration) runs. Not enforced
-- NOT NULL on any status because withdrawal/decline after assignment is
-- a real future path (A3+) that should still show which cohort they were
-- in, not null it out.
alter table applicants add column cohort_id uuid references cohorts (id);

-- "Decline with a reason code" (A2 spec) - a fixed set, not free text.
-- Internal-review-only data, never shown to the applicant/member, so
-- naming these ourselves (nothing in either companion doc enumerates
-- them) carries the same reasoning as A1's partner_organization_status:
-- operational admin data, not the member-facing "no invented copy" rule.
create type applicant_decline_reason as enum (
  'not_a_fit', 'unresponsive', 'ineligible', 'duplicate', 'other'
);

alter table applicants add column decline_reason applicant_decline_reason;

-- P2 gap this session depends on: completeIntake (lib/referral/actions.ts)
-- only ever sets status to 'intake_complete' - nothing anywhere advances
-- it to 'pending_review', so no applicant could ever actually reach A2's
-- review queue. "Finished intake" and "waiting for review" are the same
-- moment in the actual product flow (P2's own review-queue description:
-- applicants sit in pending_review from the moment intake completes,
-- there's no separate action that puts them there) - so this advances
-- them automatically rather than requiring every future intake-completing
-- code path to remember a second status write. Lives in the schema layer
-- (a trigger), not in completeIntake itself, so it holds regardless of
-- which code path sets 'intake_complete'.
--
-- Safe against recursion: this fires only when NEW.status =
-- 'intake_complete', and its own UPDATE sets status to 'pending_review',
-- which will never re-trigger itself.
--
-- Postgres fires same-timing triggers in NAME order, not registration
-- order - confirmed by hand (this trigger originally named
-- "applicants_advance_intake_complete", which sorts BEFORE
-- "applicants_log_status_event"; the nested pending_review UPDATE this
-- function issues then ran - and logged its own event - to completion
-- before the outer statement's log_status_event trigger even fired,
-- producing an event history in the wrong order: pending_review logged
-- before intake_complete, despite intake_complete happening first in
-- real time). The trigger name below is deliberately prefixed to sort
-- AFTER "applicants_log_status_event" so the outer transition's own
-- event is always written first.
create function advance_intake_complete_to_pending_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'intake_complete' then
    update public.applicants set status = 'pending_review' where id = new.id;
  end if;
  return new;
end;
$$;

revoke execute on function advance_intake_complete_to_pending_review from public, anon, authenticated;
grant execute on function advance_intake_complete_to_pending_review to service_role;

create trigger applicants_z_advance_intake_complete
  after insert or update on applicants
  for each row execute function advance_intake_complete_to_pending_review();
