# Adding an RLS boundary test

X5b (RLS suite completion): this file is the "how to add a boundary test
when a new table lands" reference the run doc's own acceptance criteria
requires. It distills patterns already used across the ~20 files in this
directory rather than inventing new ones - when in doubt, open the file
named as an example below and copy its shape.

CLAUDE.md's own rule: **RLS is the security model, not a layer on it.**
Every new table that holds data scoped to a partner org, a facilitator,
or a member needs its own isolation test proving the wrong caller is
actually denied - not just that the right caller is allowed.

## The one non-negotiable rule

**Authenticate as a real user with their own JWT, never the service
role.** `service_role` bypasses RLS entirely - a test written against it
passes even with the policy deleted, which means it proves nothing. Every
test in this directory does this instead:

```sql
set local role authenticated;
set local request.jwt.claims to '{"sub": "<uuid>", "role": "authenticated"}';
select is( (select count(*)::int from <table> where id = '<row>'), 1, '...' );
reset role;
```

`service_role` is fine for setup (inserting fixture rows) and for
`SECURITY DEFINER` functions that are meant to run with elevated
privilege - just never for the assertion that's supposed to prove RLS
itself is working.

## Shape of a boundary test

1. **Two real tenants**, not one. If you're testing partner-org
   isolation, insert two partner orgs and one applicant/cohort/whatever
   row scoped to each. If you're testing facilitator isolation, insert
   two facilitators and one cohort assigned to each. A test with only one
   tenant can't prove isolation - it can only prove the happy path.
2. **A positive assertion**: the right caller (the tenant that owns the
   row) can read it.
3. **A negative assertion**: the other tenant's caller reads zero rows
   for the same query. Not an error - RLS filters rows, it doesn't throw.
   `(select count(*)::int from ... where id = '...')` returning `0` is
   the expected shape, same as `partner_cohort_scoping.sql` and
   `cohort_creation_schema.sql`.
4. Wrap the whole file in `begin; select plan(<n>); ... select * from
   finish(); rollback;` - every test in this suite runs inside a
   transaction that's rolled back at the end, so fixture rows never
   leak between files or into a real environment.

Real examples to copy from:
- `referral_intake_schema.sql` - partner org A/B vs `applicants`
- `partner_cohort_scoping.sql` - partner org A/B vs `cohorts`/`sessions`
- `cohort_creation_schema.sql` - facilitator A/B/C vs `cohorts`/`sessions`
  (three facilitators, not two - see its own comment on why a facilitator
  who's a legitimate *session substitute* still can't stand in as the
  "wrong facilitator" negative case)
- `session_attendance.sql` - facilitator and partner-org isolation
  together, on the same table

## Run the actual negative-test drill - don't just assert and move on

A test that's never been proven to fail is not verified, it's assumed.
Before considering a new boundary test done:

1. Temporarily break the thing it's supposed to prove - drop the policy,
   comment out a grant line, or (fastest, no reset required) flip the
   test's own expected value to what it would read if the boundary were
   broken.
2. Re-run the file (`npx supabase test db`, or `supabase db reset --local`
   first if you changed a migration) and confirm it actually fails, with
   the failure message you'd expect.
3. Restore the real policy/grant/assertion, re-run, confirm everything
   passes again.
4. Write down what you did and what it printed, in a trailing comment at
   the bottom of the file - "run by hand," not "should work." Every file
   listed above has one; match that shape.

This has caught real, load-bearing distinctions in this codebase, not
hypothetical ones - see CLAUDE.md's Learned Constraints entry for
2026-09-02 (L5), on `member_identity_bridge.sql`'s own function-EXECUTE
drill, and `applicants_self_update.sql`'s own trailing comment (L3, this
same technique applied to a table/column grant instead) for two different
times running the drill for real turned up a materially different
failure mode than assuming it would work.

## Two gotchas specific to this schema

- **A function's own `grant execute ... to authenticated` line is
  cosmetic.** Supabase's default ACL already grants EXECUTE on every new
  function to `anon`/`authenticated`/`service_role` at creation time,
  regardless of that line - the real enforcement is the function's
  `revoke execute ... from public, anon` line. Table/column grants don't
  get this same treatment automatically once an earlier migration has
  already revoked them (see `20260827203458_referral_intake_schema.sql`'s
  own revoke-then-reselect-grant pattern) - a `grant update (...) on
  <table> to authenticated` added after that point is genuinely
  load-bearing, not cosmetic. When in doubt, run the drill on both the
  grant and the policy separately - `applicants_self_update.sql` and
  `member_identity_bridge.sql` both document doing exactly this and
  getting materially different failure modes for each.
- **A "most recent event for X" query must break ties by the row's own
  monotonic `id`, never `occurred_at`/`now()`.** Postgres freezes `now()`
  for the entire duration of a transaction, and every pgTAP suite in this
  repo runs inside one - two rows inserted moments apart in the same test
  file can get an identical timestamp.

## What's still out of reach for this file to cover

Post/discussion content isolation (the third boundary X5b's own prompt
names, alongside partner and facilitator scoping) has no real test here
because no `posts`/discussion table exists in the schema yet - only a
placeholder screen (`COPY.errors.discussion_not_yet_available`). CLAUDE.md
invariant #4 ("no code path exists") is, for now, trivially true because
there's no code at all. Whichever session builds real discussion content
should add the isolation test in the same PR that creates the table, not
as a follow-up - a table with a RLS gap between when it's created and
when it's isolated is exactly the kind of drift this file exists to
prevent.
