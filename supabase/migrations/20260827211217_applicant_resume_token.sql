-- Cross-device intake resumption (P2 PR3 of 5 - see the run doc
-- conversation for why: the caregiver filling out intake is
-- unauthenticated, and "resumes on a different device with the same
-- email" (L2's acceptance criterion) needs a real mechanism, not a
-- cookie. Chosen approach: once they enter their email, mail them a
-- link carrying this token - no "type your email to look up your
-- application" search box, which would let anyone probe whether a given
-- email has an in-progress application to a dementia caregiver support
-- program (a real privacy leak, not just an account-enumeration one).
--
-- Deliberately a separate secret from applicants.id, not a reuse of the
-- primary key: id may legitimately surface elsewhere later (an admin
-- export row, an audit_log subject_id, an internal review-screen URL);
-- none of those leaking should also hand out public write access to the
-- intake form. resume_token exists for exactly one purpose and nothing
-- else ever has a reason to reference it.
alter table applicants
  add column resume_token uuid not null default gen_random_uuid() unique;
