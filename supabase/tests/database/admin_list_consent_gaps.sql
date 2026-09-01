-- Coverage for admin_list_consent_gaps (A5) - the admin-wide companion
-- to P6's per-member needs_reconsent().

begin;
select plan(5);

insert into auth.users (id, email) values
  ('66666666-0000-0000-0000-0000000000a1', 'a5-gaps-member-a@example.com'),
  ('66666666-0000-0000-0000-0000000000a2', 'a5-gaps-member-b@example.com'),
  ('66666666-0000-0000-0000-0000000000a3', 'a5-gaps-admin@example.com');
update profiles set role = 'admin' where id = '66666666-0000-0000-0000-0000000000a3';
-- member A and B default to role 'member'.

-- A real, non-placeholder-shaped version bump on top of whatever the
-- seed already has, so this test doesn't depend on seed.sql's exact
-- current version numbers.
insert into consent_documents (document_type, version, body, is_placeholder) values
  ('terms_of_service', 999, 'pgTAP test version', true);

-- Member A consents to the new version; member B never does.
insert into member_consents (member_id, document_type, document_version) values
  ('66666666-0000-0000-0000-0000000000a1', 'terms_of_service', 999);

set local role authenticated;
select throws_ok(
  $$ select * from admin_list_consent_gaps() $$,
  '42501', null,
  'authenticated cannot call admin_list_consent_gaps directly - execute not granted'
);
reset role;

set local role service_role;

select is(
  (select count(*)::int from admin_list_consent_gaps()
     where member_id = '66666666-0000-0000-0000-0000000000a1' and document_type = 'terms_of_service' and current_version = 999),
  0,
  'a member who consented to the current version has no gap for it'
);

select is(
  (select count(*)::int from admin_list_consent_gaps()
     where member_id = '66666666-0000-0000-0000-0000000000a2' and document_type = 'terms_of_service' and current_version = 999),
  1,
  'a member who never consented to the current version shows up as a gap'
);

select is(
  (select count(*)::int from admin_list_consent_gaps() where member_id = '66666666-0000-0000-0000-0000000000a3'),
  0,
  'an admin profile (role != member) is never listed, even with zero consent rows'
);

-- Named edge case: a member who consented to an OLDER version still has
-- a gap for the current one - re-consent is a new row, never an
-- overwrite (same "history, not a mutable status" reasoning P6 used).
insert into member_consents (member_id, document_type, document_version) values
  ('66666666-0000-0000-0000-0000000000a2', 'terms_of_service', 1);

select is(
  (select count(*)::int from admin_list_consent_gaps()
     where member_id = '66666666-0000-0000-0000-0000000000a2' and document_type = 'terms_of_service' and current_version = 999),
  1,
  'consenting to an older version does not clear the gap for the current one'
);

reset role;

select * from finish();
rollback;
