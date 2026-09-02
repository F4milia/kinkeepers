-- Coverage for 20260903130000: partner_zoom_credentials holds a live
-- Zoom OAuth client secret per partner - service_role-only, zero grant
-- to anon/authenticated at all. Real role switches throughout, per this
-- suite's own README.

begin;
select plan(5);

insert into partner_organizations (id, name, referral_link_slug) values
  ('11111111-0000-0000-0000-000000000801', 'Zoom Credentials Test Org', 'pgtap-08-org');

insert into auth.users (id, email) values
  ('66666666-0000-0000-0000-000000000801', '08-member@example.com');

set local role service_role;
select lives_ok(
  $$ insert into partner_zoom_credentials (partner_organization_id, account_id, client_id, client_secret)
     values ('11111111-0000-0000-0000-000000000801', 'acct-1', 'client-1', 'secret-1') $$,
  'service_role can provision a partner''s own Zoom credentials'
);
select is(
  (select count(*)::int from partner_zoom_credentials where partner_organization_id = '11111111-0000-0000-0000-000000000801'),
  1,
  'service_role can read it back'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-0000-0000-0000-000000000801", "role": "authenticated"}';
select throws_ok(
  $$ select * from partner_zoom_credentials $$,
  '42501', null,
  'an authenticated member cannot read partner_zoom_credentials at all - no grant exists'
);
select throws_ok(
  $$ insert into partner_zoom_credentials (partner_organization_id, account_id, client_id, client_secret)
     values ('11111111-0000-0000-0000-000000000801', 'x', 'y', 'z') $$,
  '42501', null,
  'an authenticated member cannot insert into partner_zoom_credentials either'
);
reset role;

set local role anon;
select throws_ok(
  $$ select * from partner_zoom_credentials $$,
  '42501', null,
  'anon cannot read partner_zoom_credentials at all - no grant exists'
);
reset role;

select * from finish();
rollback;

-- Negative-test drill, actually run (not hypothetical, and the first
-- attempt was WRONG - worth recording why): first tried commenting out
-- the "grant select, insert, update, delete on partner_zoom_credentials
-- to service_role" line - all 5 tests still passed, meaning that grant
-- is cosmetic, same footgun CLAUDE.md's Learned Constraints already
-- found for EXECUTE grants on new functions, except here it's a TABLE
-- grant to service_role specifically: Supabase's default ACL already
-- grants service_role full privileges on a new table at creation time,
-- and this migration never revokes them (only from anon/authenticated),
-- so the explicit grant line restates a default that was never removed.
-- Restored it, then commented out "revoke all on partner_zoom_credentials
-- from anon, authenticated" instead - THAT made tests 3 and 5 fail with
-- "caught: no exception, wanted: 42501" (both anon and authenticated
-- could suddenly read the table), confirming the revoke line is the
-- real, load-bearing one. Restored, reset --local, all 5 passed again.
