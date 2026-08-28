-- Atomic assign/decline/reopen for A2's review queue - each composes the
-- applicants status change with its audit_log row in one transaction
-- (security definer functions calling record_audit_event), same pattern
-- as A1's admin_create/update_partner_organization. CLAUDE.md invariant
-- #9: "if the audit write fails, the mutation fails."
--
-- All three trust their actor_id argument rather than independently
-- checking the caller's role - EXECUTE is service_role-only, so the
-- app-level Server Action (requireRole(["admin"]) first, then invokes
-- these via the service-role client) is the only real caller, same
-- division of responsibility as every other admin mutation in this
-- codebase.
--
-- Status-transition guards below are deliberately strict (only from
-- pending_review, only from declined for reopen) rather than permissive -
-- per the P2 gap fixed in the prior migration, every applicant reaches
-- pending_review automatically the moment intake completes, so there is
-- no real workflow state these guards would wrongly block.

create function assign_applicant_to_cohort(
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
  cohort_capacity int;
  current_occupancy int;
  updated_row public.applicants;
begin
  -- Validate the subject before the destination: an applicant who isn't
  -- awaiting review should always get that error, even when the target
  -- cohort also happens to be full - checking capacity first would mask
  -- it (confirmed by hand: this order bug shipped in this migration's
  -- first draft and was caught by its own pgTAP suite).
  select status into applicant_status from public.applicants where id = target_applicant_id for update;
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

  return updated_row;
end;
$$;

revoke execute on function assign_applicant_to_cohort from public, anon, authenticated;
grant execute on function assign_applicant_to_cohort to service_role;

create function decline_applicant(
  actor_id uuid,
  target_applicant_id uuid,
  reason applicant_decline_reason
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
  set status = 'declined', decline_reason = reason
  where id = target_applicant_id and status = 'pending_review'
  returning * into updated_row;

  if not found then
    raise exception 'applicant % is not awaiting review', target_applicant_id;
  end if;

  perform public.record_audit_event(
    actor_id,
    'applicant_declined'::public.audit_action,
    'applicant',
    target_applicant_id::text,
    reason::text,
    null
  );

  return updated_row;
end;
$$;

revoke execute on function decline_applicant from public, anon, authenticated;
grant execute on function decline_applicant to service_role;

-- Declined applicants are re-openable - "decisions get revisited" (A2
-- spec). Returns to pending_review, same as any applicant awaiting
-- review; pending_review_since is re-stamped by the existing trigger
-- since old.status ('declined') is distinct from new.status
-- ('pending_review'), so days-waiting counts from the reopen, not the
-- original review.
create function reopen_applicant(
  actor_id uuid,
  target_applicant_id uuid
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
  set status = 'pending_review', decline_reason = null
  where id = target_applicant_id and status = 'declined'
  returning * into updated_row;

  if not found then
    raise exception 'applicant % is not declined', target_applicant_id;
  end if;

  perform public.record_audit_event(
    actor_id,
    'applicant_reopened'::public.audit_action,
    'applicant',
    target_applicant_id::text,
    null,
    null
  );

  return updated_row;
end;
$$;

revoke execute on function reopen_applicant from public, anon, authenticated;
grant execute on function reopen_applicant to service_role;
