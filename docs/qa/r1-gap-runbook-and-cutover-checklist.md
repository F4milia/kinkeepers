# QA — r1-gap-runbook-and-cutover-checklist R1: Deploy pipeline and rollback runbook (PR 2 of 2)

Preview URL: <filled in by whoever verifies, from the PR's Vercel comment>
Fixtures used: none from `docs/qa/FIXTURES.md` - docs and an env-var example file, no app behavior to click through.

## Primary check (from the run doc's Named edge-case register)
The runbook is followable by someone who didn't write it, and correctly describes the real, current environment topology.

1. Read `docs/incident-response.md` cold.
   **Expect:** it describes the real post-cutover two-project topology (staging `lupiicjafzrbihaosezv` / production `vnadfnnckmkswfrzfjkj`), not the pre-cutover single-environment world it described before this PR. It cites measured `ci`/Vercel deploy timing, not an assumed number. It points to `docs/supabase-cutover-checklist.md` for dashboard-only config. It plainly states the rollback drill has not been executed, rather than implying the procedure above it is a verified transcript.
2. Read `docs/supabase-cutover-checklist.md` cold.
   **Expect:** all four dashboard-only gaps CLAUDE.md's Learned Constraints already found by hand (Auth URL Configuration, admin role grant, custom SMTP, session inactivity timeout — 2160 hours, not seconds) are named with the actual fix, not just mentioned in passing.
3. Diff `.env.local.example` against every `process.env.*` reference actually used in `lib/`.
   **Expect:** `ZOOM_ACCOUNT_ID`/`ZOOM_CLIENT_ID`/`ZOOM_CLIENT_SECRET`, `APP_ENV`, and `STAGING_MESSAGE_ALLOWLIST` are now documented, matching `lib/zoom/client.ts` and `lib/messaging/staging-guard.ts`'s real usage.

## Regression (previous two sessions)
- [ ] R1 gap PR1 (migration rollback-decision coverage, #160): confirm this PR's own `docs/migration-rollback-decisions.md` and `scripts/check-migration-rollback-decisions.mjs` are unaffected - this PR touches none of those files.
- [ ] P7b (Stream B, uptime monitoring): `docs/ops/uptime-monitoring.md` still accurately describes the real UptimeRobot setup - unrelated to this PR, but the same "dashboard-only state invisible to grep" category this PR's checklist doc now also documents for Auth settings.

## Result
- [ ] All pass
- Failures → issue links:
- Loom:
- Executed by / at:
