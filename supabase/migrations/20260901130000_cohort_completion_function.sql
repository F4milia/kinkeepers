-- A3 PR5: manually marking a cohort completed. CLAUDE.md invariant #11
-- ("payout release is never automatic ... a reviewer releases") and the
-- run doc's own spec for this PR both rule out any auto-detection of
-- "all sessions are done" - this is a plain reviewer action, nothing
-- more. Cancelled sessions never blocked or triggered anything here in
-- the first place (nothing in this codebase counts session completion
-- toward this transition at all), so PR4's "cancelled sessions don't
-- count against completion" assumption is honored simply by there being
-- no such count to violate.

alter type audit_action add value 'cohort_completed';

create function mark_cohort_completed(
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
begin
  update public.cohorts set status = 'completed' where id = target_cohort_id and status = 'active'
  returning * into updated_row;

  if not found then
    raise exception 'cohort % is not active - only an active cohort can be marked completed', target_cohort_id;
  end if;

  perform public.record_audit_event(
    actor_id,
    'cohort_completed'::public.audit_action,
    'cohort',
    target_cohort_id::text,
    null,
    null
  );

  return updated_row;
end;
$$;

revoke execute on function mark_cohort_completed from public, anon, authenticated;
grant execute on function mark_cohort_completed to service_role;
