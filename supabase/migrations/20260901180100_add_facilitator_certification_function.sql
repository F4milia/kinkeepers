-- A4-cert PR2/3: the write side. record_audit_event() is called from
-- inside this function, in the same transaction as the insert - not the
-- standalone lib/audit/record-audit-event.ts helper, which the audit
-- module's own comment says is only for actions with no dedicated
-- Postgres function - per CLAUDE.md invariant #9 ("if the audit write
-- fails, the mutation fails"), true atomicity needs both in one
-- transaction, same pattern as assign_applicant_to_cohort and every
-- other privileged mutation so far.
create function add_facilitator_certification(
  actor_id uuid,
  target_facilitator_id uuid,
  target_program_id uuid,
  p_certified_on date,
  p_expires_on date,
  p_certifying_body text,
  p_evidence_note text default null
)
returns facilitator_certifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_row public.facilitator_certifications;
begin
  if not exists (
    select 1 from public.profiles where id = target_facilitator_id and role = 'facilitator'
  ) then
    raise exception 'profile % is not a facilitator', target_facilitator_id;
  end if;

  if not exists (select 1 from public.programs where id = target_program_id) then
    raise exception 'program % not found', target_program_id;
  end if;

  insert into public.facilitator_certifications
    (facilitator_id, program_id, certified_on, expires_on, certifying_body, evidence_note)
  values
    (target_facilitator_id, target_program_id, p_certified_on, p_expires_on, p_certifying_body, p_evidence_note)
  returning * into new_row;

  perform public.record_audit_event(
    actor_id,
    'facilitator_certified'::public.audit_action,
    'facilitator_certification',
    new_row.id::text,
    null,
    jsonb_build_object(
      'facilitator_id', target_facilitator_id,
      'program_id', target_program_id,
      'expires_on', p_expires_on
    )
  );

  return new_row;
end;
$$;

revoke execute on function add_facilitator_certification from public, anon, authenticated;
grant execute on function add_facilitator_certification to service_role;
