-- Coverage for the applicant_status_events.applicant_id -> applicants(id)
-- ON DELETE CASCADE fix. Without it, every applicant is permanently
-- undeletable via a plain DELETE the moment it exists - the
-- applicants_log_status_event trigger logs at least one event on every
-- INSERT unconditionally, so the FK's default NO ACTION behavior blocks
-- the delete outright. This silently broke test cleanup across every
-- vitest suite that creates real applicants (lib/admin/applicants.test.ts,
-- lib/admin/assignment.test.ts, lib/admin/waitlist.test.ts), none of
-- which checked the delete call's error - 114 orphaned rows had
-- accumulated in the local database by the time this was caught, via
-- lib/admin/waitlist.test.ts's exact-count assertions (which aggregate
-- the whole applicants table and have no baseline-delta escape hatch,
-- unlike audit_log).

begin;
select plan(3);

insert into partner_organizations (id, name, referral_link_slug) values
  ('11111111-0000-0000-0000-0000000000c1', 'Cascade Test Org', 'pgtap-cascade-org');

insert into applicants (id, partner_organization_id, referral_source, status)
values ('33333333-0000-0000-0000-0000000000c1', '11111111-0000-0000-0000-0000000000c1', 'partner_link', 'referred');

-- The INSERT trigger already logged one event unconditionally - confirm
-- the fixture itself actually exercises the coupling this migration
-- fixes, not a no-op.
select is(
  (select count(*)::int from applicant_status_events where applicant_id = '33333333-0000-0000-0000-0000000000c1'),
  1,
  'the applicant already has a status event logged, same as any real applicant'
);

select lives_ok(
  $$ delete from applicants where id = '33333333-0000-0000-0000-0000000000c1' $$,
  'deleting an applicant with status history no longer raises a foreign key violation'
);

select is(
  (select count(*)::int from applicant_status_events where applicant_id = '33333333-0000-0000-0000-0000000000c1'),
  0,
  'the applicant''s status events were deleted along with it, not left orphaned'
);

select * from finish();
rollback;
