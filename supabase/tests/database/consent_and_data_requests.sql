-- Coverage for the P6 consent-and-data-requests migration.
--
-- Per the run doc's methodology: every isolation boundary is tested as a
-- real authenticated user, never the service role.

begin;
select plan(13);

insert into auth.users (id, email) values
  ('99111111-0000-0000-0000-000000000001', 'consent-a@example.com'),
  ('99111111-0000-0000-0000-000000000002', 'consent-b@example.com');

-- A member cannot read another member's consent history.
set local role authenticated;
set local request.jwt.claims to '{"sub": "99111111-0000-0000-0000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$ insert into member_consents (member_id, document_type, document_version)
     values ('99111111-0000-0000-0000-000000000001', 'terms_of_service', 1) $$,
  'a member can record their own consent'
);
select throws_ok(
  $$ insert into member_consents (member_id, document_type, document_version)
     values ('99111111-0000-0000-0000-000000000002', 'terms_of_service', 1) $$,
  '42501',
  null,
  'a member cannot record consent on another member''s behalf'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "99111111-0000-0000-0000-000000000002", "role": "authenticated"}';
select is(
  (select count(*)::int from member_consents where member_id = '99111111-0000-0000-0000-000000000001'),
  0,
  'a member cannot read another member''s consent history'
);
reset role;

-- Paired positive control for the assertion above: without this, "member
-- 2 sees 0 of member 1's rows" would pass identically whether isolation
-- is real or the SELECT policy is simply missing entirely (member 1's own
-- read would also be 0 in that case) - caught for real when the negative-
-- test drill below dropped the policy and this, not the cross-member
-- check, was the assertion that actually failed.
set local role authenticated;
set local request.jwt.claims to '{"sub": "99111111-0000-0000-0000-000000000001", "role": "authenticated"}';
select is(
  (select count(*)::int from member_consents where member_id = '99111111-0000-0000-0000-000000000001'),
  1,
  'a member CAN read their own consent history - the paired positive control'
);
reset role;

-- A document version bump doesn't overwrite the old consent record - both
-- rows survive, and "which version did they agree to" stays answerable
-- for any past date.
insert into consent_documents (document_type, version, body) values
  ('terms_of_service', 2, '[PLACEHOLDER v2 - a real change would go here]');

set local role authenticated;
set local request.jwt.claims to '{"sub": "99111111-0000-0000-0000-000000000001", "role": "authenticated"}';
select lives_ok(
  $$ insert into member_consents (member_id, document_type, document_version)
     values ('99111111-0000-0000-0000-000000000001', 'terms_of_service', 2) $$,
  'a member can re-consent to a new version'
);
select is(
  (select count(*)::int from member_consents where member_id = '99111111-0000-0000-0000-000000000001' and document_type = 'terms_of_service'),
  2,
  'both the v1 and v2 consent records survive - re-consent is a new row, not an overwrite'
);

-- Cannot record consent to a version that doesn't exist - the composite
-- FK to consent_documents is what makes this a hard guarantee, not just
-- app-layer discipline.
select throws_ok(
  $$ insert into member_consents (member_id, document_type, document_version)
     values ('99111111-0000-0000-0000-000000000001', 'terms_of_service', 999) $$,
  '23503',
  null,
  'cannot record consent to a document version that does not exist (composite FK)'
);

-- needs_reconsent: v1-only consent still shows terms_of_service needing
-- v2, since the member only agreed to v1 there... except this member
-- (...001) already consented to v2 above, so check the OTHER member, who
-- has consented to nothing at all - every current document should show.
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "99111111-0000-0000-0000-000000000002", "role": "authenticated"}';
select is(
  (select count(*)::int from needs_reconsent('99111111-0000-0000-0000-000000000002')),
  4,
  'needs_reconsent lists all four documents for a member who has never consented to anything'
);
-- Passing a mismatched id doesn't leak the other member's real status -
-- RLS filters the join to nothing, so it just shows "needs everything"
-- rather than either erroring or revealing member 001's actual consent.
select is(
  (select count(*)::int from needs_reconsent('99111111-0000-0000-0000-000000000001')),
  4,
  'needs_reconsent for a mismatched id reads as "needs everything", not a leak of the real member''s status'
);
reset role;

-- member_data_requests: a member can create and read their own; not
-- another member's.
set local role authenticated;
set local request.jwt.claims to '{"sub": "99111111-0000-0000-0000-000000000001", "role": "authenticated"}';
select lives_ok(
  $$ insert into member_data_requests (member_id, request_type)
     values ('99111111-0000-0000-0000-000000000001', 'export') $$,
  'a member can create their own data request'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "99111111-0000-0000-0000-000000000002", "role": "authenticated"}';
select is(
  (select count(*)::int from member_data_requests where member_id = '99111111-0000-0000-0000-000000000001'),
  0,
  'a member cannot read another member''s data request'
);
select throws_ok(
  $$ update member_data_requests set status = 'fulfilled'
     where member_id = '99111111-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'a member cannot update a data request''s fulfillment status - service_role only'
);
reset role;

-- Placeholder documents are readable (so the mechanism is real and
-- testable), and clearly marked as such.
set local role authenticated;
select is(
  (select count(*)::int from consent_documents where is_placeholder = true),
  5,
  'all seeded/inserted documents in this test are marked as placeholders (4 seeded + the v2 bump above)'
);
reset role;

select * from finish();
rollback;

-- Negative-test drill, actually run (not hypothetical) - and it caught a
-- real weakness in an earlier version of this file:
--   drop policy "member_consents_select_own" on member_consents;
--   -> first run: only test 3 (cross-member read = 0) existed as the
--      isolation check, and it still PASSED with the policy gone - member
--      2 never had member 1's rows to see regardless, so "0 rows" was
--      true for the wrong reason (deny-everything, not real isolation).
--      Added test 4 as a paired positive control (member 1 reading their
--      OWN row) specifically because of this.
--   -> re-ran with test 4 added: it failed as expected ("have: 0, want:
--      1"), correctly exposing that removing the policy breaks reads
--      entirely - now the pair together actually proves isolation rather
--      than coincidentally looking like it.
--   supabase db reset (restores the migration, including the policy)
--   -> re-ran this file: all 13 assertions passed again.
