# QA — R1-incident-notes-and-rollback-decisions

Preview URL: <filled in by whoever verifies, from the PR's Vercel comment>
Fixtures used: none - docs and a repo settings change, no app behavior to click through

## Primary check
R1 (Wave 10) is partially scoped this pass - see CLAUDE.md's own Learned Constraints entry for why the real production cutover and staged rollback drill are held out. This PR ships the three pieces that don't depend on that split.

1. Read `docs/incident-response.md` cold, as someone who wasn't in this conversation.
   **Expect:** it names real roles (Ferenz/Ivan per the run doc's own header), the real support number (`1-800-555-0142`, matching `COPY.support.phoneNumber` - not invented), a real rollback command (`npx vercel rollback --yes`), and points to `docs/migration-rollback-decisions.md` for the DB half rather than inventing rollback SQL inline.
2. Read `docs/migration-rollback-decisions.md` and confirm every one of the 36 files currently in `supabase/migrations/` has a row.
   **Expect:** two rows say "down-path tested" (both purely-additive RLS policies, `20260901150000` and `20260903110000`) with a real, specific reason; every other row says "forward-fix only" with a reason specific to that migration, not one copy-pasted line repeated 34 times.
3. Confirm no migration FILE itself was touched by this PR - `git diff` should show zero changes under `supabase/migrations/`.
4. Check whether branch protection on `main` requiring the `ci` check was actually applied (this needed a manual `gh api` call outside Claude Code's sandbox - confirm someone ran it): `gh api repos/F4milia/kinkeepers/branches/main/protection` should return the `required_status_checks.contexts: ["ci"]` config, not a 404.

## Regression (previous two sessions)
- [ ] A5/X4 (session-status fix, PR #115): confirm `/admin/reports` and Facilitator Home's "Needs a log" still work - unrelated to this PR, but it's the most recently-changed shared surface.
- [ ] X5b (RLS suite completion, just merged as PR #116): confirm `supabase test db` still passes in full - this PR's own local verification touched the same `session_attendance` policy X5b's suite may also exercise.

## Result
- [ ] All pass
- Failures → issue links:
- Loom:
- Executed by / at:
