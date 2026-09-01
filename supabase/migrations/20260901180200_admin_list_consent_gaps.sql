-- A5 (Wave 7): closes a real gap found during A5's own acceptance-
-- criteria review, not a deliberate deferral. "Consent gaps ... queued"
-- was never surfaced anywhere in the admin surface, despite P6's
-- needs_reconsent() existing specifically so a later admin queue could
-- reuse it - see that function's own comment: "service_role bypasses
-- RLS entirely, so it can genuinely check anyone (A5's future admin
-- queue)."
--
-- needs_reconsent() itself stays exactly as P6 built it (per-member,
-- security invoker, relies on the caller's own RLS) - this is a
-- SEPARATE, admin-only, security definer function that does the same
-- comparison across every member at once, the way an admin queue needs.
-- Scoped to role = 'member': consent_documents (terms/privacy/
-- participant agreement/group confidentiality) are what a caregiver
-- signs, not something admin/facilitator/partner_staff accounts were
-- ever asked to consent to.
create function admin_list_consent_gaps()
returns table (member_id uuid, document_type consent_document_type, current_version int)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id as member_id, current.document_type, current.version
  from public.profiles p
  cross join (
    select cd.document_type, max(cd.version) as version
    from public.consent_documents cd
    group by cd.document_type
  ) as current
  left join public.member_consents mc
    on mc.member_id = p.id
    and mc.document_type = current.document_type
    and mc.document_version = current.version
  where p.role = 'member'
    and mc.id is null;
$$;

revoke execute on function admin_list_consent_gaps from public, anon, authenticated;
grant execute on function admin_list_consent_gaps to service_role;
