-- L3 (remaining scope): notification preferences + account screen need a
-- signed-in member to update their OWN applicant row (first/last name,
-- contact email/phone, time zone, preferred_contact_channel) - nothing
-- currently grants authenticated any write access to applicants at all
-- (20260827203458_referral_intake_schema.sql revokes everything from
-- authenticated except select, per CLAUDE.md's own "default ACLs are
-- permissive, every restriction needs an explicit REVOKE" lesson, applied
-- correctly there - the gap here is a missing GRANT, not a missing
-- REVOKE).
--
-- Column-scoped GRANT + row-scoped RLS policy, not a SECURITY DEFINER
-- function - same "RLS is the security model, not a layer on it"
-- reasoning already applied to member_consents_insert_own
-- (lib/consent/actions.ts), the only existing precedent for a member
-- writing their own row. Deliberately excludes every other applicants
-- column (status, cohort_id, partner_reference_id, care_recipient_stage,
-- etc.) - a member can change their own contact details and notification
-- channel, nothing about their enrollment state.
--
-- email is included: confirmed safe against claim_applicant_for_current_
-- user's own matching logic (20260901190000) before including it - that
-- function only reads applicants.email/phone to find and claim a row
-- ONCE, short-circuiting immediately after via the already-claimed check
-- (`where profile_id = caller_id`). Once profile_id is set, this column
-- is inert for identity purposes and purely contact info - editing it
-- here cannot affect sign-in, which is auth.users.email, a completely
-- separate table this policy never touches.
grant update (first_name, last_name, email, phone, time_zone, preferred_contact_channel)
  on applicants to authenticated;

create policy "applicants_update_own_member"
  on applicants for update
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
