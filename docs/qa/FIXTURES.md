# Named QA fixtures

Adapted from Ivan's `qa-previous-session-sop.md`, which was written in a
different project's terms (Family/Build/Bricks, `f4milia.test` emails) -
these are KinKeepers' own real entities instead, and only what genuinely
exists in `supabase/seed.sql` today. `seed.sql` grows incrementally
(X1's own rule: "do not pre-seed rows for tables that don't exist yet"),
so this table grows the same way - add a row here in the same PR that
adds the fixture to `seed.sql`, don't seed ahead of need.

Every fixture below is reset from scratch on `supabase db reset --local`
and, once staging resets nightly against this same file, will be
identically present on every preview deploy.

| Fixture | What it's for | Real id / lookup |
|---|---|---|
| Riverside Health Network | Partner org, active referrals | `partner_organizations.name = 'Riverside Health Network'` |
| Lakeside Family Medicine | Second partner org, for isolation checks (A org can't see B org's referrals) | `partner_organizations.name = 'Lakeside Family Medicine'` |
| Miriam Castillo | Oldest pending_review applicant (backdated 12 days) - oldest-first sort, "waiting for review" status screen | `88888888-0000-0000-0000-000000000001` |
| Priya Desai | Newest pending_review applicant (backdated 1 day), same relationship/stage as Miriam - waitlist grouping counts >1 | `88888888-0000-0000-0000-000000000002` |
| Oscar Bennett | pending_review, different partner org/relationship/stage | `88888888-0000-0000-0000-000000000003` |
| Frank Delgado | declined applicant, reason `unresponsive` - reopen flow | `88888888-0000-0000-0000-000000000004` |
| Sam Ellison | enrolled applicant with a real assigned first session (L5 Demo Cohort) - "assigned, before session one" status screen | `88888888-0000-0000-0000-000000000502` |
| Terry Whitfield | completed applicant, no next program - "program complete" status screen | `88888888-0000-0000-0000-000000000503` |
| L5 Demo Cohort | Real cohort with one real scheduled session (video, real join URL) - the only cohort with a session an applicant is actually assigned to | `99999999-0000-0000-0000-000000000501` |
| "Spouses, Early Stage" / "Adult Children, Middle Stage" | Two open A2-era cohorts with different capacity/cadence/zone, for the assignment picker's composition view | `99999999-0000-0000-0000-000000000001` / `...002` |
| Four consent documents (v1) | Terms/privacy/participant/group-confidentiality, all placeholder text pending Ivan's attorney-reviewed versions | `consent_documents` |

## Known gap

The hosted/staging project has accumulated its own ad-hoc named rows from
manual testing sessions (e.g. "Test Cohort4," a "Reminder Manual Test
Org") that were never formalized into `seed.sql` - they exist only on
whichever environment they were created against, not reproducibly. This
doc intentionally doesn't reference those: a QA doc should only cite
fixtures that reset are here in `seed.sql`, so every environment
(including a fresh local reset) has them. Formalize a hosted-only fixture
into `seed.sql` the next time a QA doc needs to reference it by name.

**Also note:** there's no nightly reset cron running against the hosted
project yet - X1 built the one-command reset itself, but not a schedule
that runs it. Until one exists, staging/preview data can drift from a
clean `seed.sql` state over time. Flagged for whoever picks up the
"preview deploys must exist per PR" prerequisite fully - the deploys
already exist (confirmed via the Vercel API and PR comments), the nightly
reset is the missing piece.
