# QA — r1-gap-migration-rollback-coverage R1: Deploy pipeline and rollback runbook (PR 1 of 2)

Preview URL: <filled in by whoever verifies, from the PR's Vercel comment>
Fixtures used: none from `docs/qa/FIXTURES.md` - this PR is docs + a CI script, no app behavior to click through.

## Primary check (from the run doc's Named edge-case register)
Every migration in the repo carries a rollback decision - grep for undecided migrations returns zero.

1. Run `npm run check:migration-rollback-decisions` from a clean checkout.
   **Expect:** `All 45 migrations have a recorded rollback decision.`, exit code 0.
2. Temporarily create an empty file `supabase/migrations/99999999999999_fake_test_migration.sql`, run the same command, then delete the file.
   **Expect:** the command fails (exit 1) and names `99999999999999_fake_test_migration` specifically - proving the check has teeth, not just a script that always exits 0.
3. Open `docs/migration-rollback-decisions.md` and confirm the Decisions table has a row for all 8 migrations added since the original R1 session (`20260903130000` through `20260908120000`).
   **Expect:** each of the 8 rows names what the migration adds, a Forward-fix-only/Down-path-tested decision, and a reason specific to that migration - not a copy-pasted line.
4. Confirm `.github/workflows/ci.yml` runs `npm run check:migration-rollback-decisions` as a step in the `ci` job (the same job branch protection already requires green before merge - confirmed via `gh api repos/F4milia/kinkeepers/branches/main/protection`).
   **Expect:** the step exists between lint/typecheck and `supabase test db`.

## Regression (previous two sessions)
- [ ] X4 (dial-in identity): `supabase test db` still passes in full (332 assertions) - this PR adds no migration and touches no schema, but confirms the local stack's own known container-restart flakiness (CLAUDE.md's Learned Constraints) didn't mask a real regression here.
- [ ] L3 (consent flow): `20260908120000_claim_applicant_pre_enrollment` and `20260908110000_consent_document_change_summary`, L3's own gap-closure migrations, are correctly represented in the new tracker rows added by this PR.

## Result
- [ ] All pass
- Failures → issue links:
- Loom:
- Executed by / at:
