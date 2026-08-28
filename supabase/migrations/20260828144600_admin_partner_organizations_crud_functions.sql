-- Continuation of 20260828144500 - split into its own migration because
-- a newly added enum value cannot safely be used within the same
-- transaction that added it, on some Postgres versions/runners. See that
-- migration's comment for the overall rationale.

create function admin_create_partner_organization(
  actor_id uuid,
  p_name text,
  p_referral_link_slug text,
  p_status partner_organization_status,
  p_contract_start date,
  p_contract_end date,
  p_notes text
)
returns partner_organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_row public.partner_organizations;
begin
  insert into public.partner_organizations (name, referral_link_slug, status, contract_start, contract_end, notes)
  values (p_name, p_referral_link_slug, p_status, p_contract_start, p_contract_end, p_notes)
  returning * into new_row;

  perform public.record_audit_event(
    actor_id,
    'partner_organization_created'::public.audit_action,
    'partner_organization',
    new_row.id::text,
    null,
    jsonb_build_object('name', new_row.name)
  );

  return new_row;
end;
$$;

revoke execute on function admin_create_partner_organization from public, anon, authenticated;
grant execute on function admin_create_partner_organization to service_role;

create function admin_update_partner_organization(
  actor_id uuid,
  target_id uuid,
  p_name text,
  p_referral_link_slug text,
  p_status partner_organization_status,
  p_contract_start date,
  p_contract_end date,
  p_notes text
)
returns partner_organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_row public.partner_organizations;
begin
  update public.partner_organizations
  set name = p_name,
      referral_link_slug = p_referral_link_slug,
      status = p_status,
      contract_start = p_contract_start,
      contract_end = p_contract_end,
      notes = p_notes
  where id = target_id
  returning * into updated_row;

  if not found then
    raise exception 'partner_organization % not found', target_id;
  end if;

  perform public.record_audit_event(
    actor_id,
    'partner_organization_updated'::public.audit_action,
    'partner_organization',
    updated_row.id::text,
    null,
    jsonb_build_object('name', updated_row.name)
  );

  return updated_row;
end;
$$;

revoke execute on function admin_update_partner_organization from public, anon, authenticated;
grant execute on function admin_update_partner_organization to service_role;
