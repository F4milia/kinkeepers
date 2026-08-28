-- Fixes a real hidden coupling discovered while building A2 PR4's own
-- test suite: applicant_status_events.applicant_id references
-- applicants(id) with no ON DELETE behavior (defaults to NO ACTION), and
-- every applicant automatically gets at least one status event logged
-- the moment it's created (applicants_log_status_event's INSERT branch
-- fires unconditionally). That makes every applicant row permanently
-- undeletable via a plain DELETE, the same class of bug already
-- documented for audit_log.actor_id/profiles - except here it was
-- silently corrupting test data rather than blocking a real delete
-- outright: every vitest integration test that creates real applicants
-- and cleans up via `.delete().in("id", [...])` in afterAll has been
-- failing that delete silently (Postgrest returns a 23503 error object,
-- but nothing checked it), leaving permanent orphaned rows behind on
-- every single run. Those orphans then corrupted
-- lib/admin/waitlist.test.ts specifically, since
-- applicant_waitlist_summary aggregates the whole table with no way to
-- scope out old test residue.
--
-- Unlike audit_log/profiles (where the actor's identity must survive
-- independent of what it audited), applicant_status_events has no
-- standalone meaning once its applicant is gone - it IS that applicant's
-- own status history, not a shared audit trail. Cascading its deletion
-- with the applicant it belongs to is coherent, not a compliance
-- shortcut: the separate audit_log table (which DOES need
-- actor-independent survival) is untouched by this change.
alter table applicant_status_events
  drop constraint applicant_status_events_applicant_id_fkey,
  add constraint applicant_status_events_applicant_id_fkey
    foreign key (applicant_id) references applicants (id) on delete cascade;
