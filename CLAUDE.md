# CLAUDE.md — KinKeepers

KinKeepers runs closed peer-support cohorts for dementia caregivers, delivered over Zoom by certified lay facilitators, sold to health systems. Members are caregivers aged 50–75: often exhausted, often with presbyopia or tremor, sometimes on a tablet a family member set up. Every design decision serves that person. The candor of a closed room is the product.

## Stack — locked, do not re-litigate

Supabase (Postgres, Auth, RLS, Realtime, Storage) · Inngest (jobs) · Resend (email) · Twilio (SMS) · Zoom Workplace for Healthcare via Server-to-Server OAuth (join URLs only — NO embedded video, no Meeting SDK, no WebRTC) · pgTAP + Playwright in CI (ZeroStep was tried and doesn't work — plain Playwright, not a stopgap) · Sentry (PII-scrubbed or disabled). Analytics live in our own Postgres. Auth is Supabase Auth; Twilio/Resend are delivery only.

## Hard invariants — violating any of these is a failed session

1. NO passwords. Anywhere. Not optional, not fallback. Magic link + SMS code.
2. NO health information in any outbound message (email, SMS, push). "Your KinKeepers sign-in code is 123456" — nothing about dementia, caregiving, the program, or the group. Assume every inbox and phone is shared with the person being cared for.
3. NO third-party analytics. No Mixpanel/Amplitude/PostHog/Segment/GA. Participation in this program is health information about identifiable people. Events stay in Postgres, queried with SQL.
4. Partner staff are STRUCTURALLY incapable of reaching post/discussion content. Not filtered, not summarized, not sentiment-scored — no code path exists. Verified by grep and by RLS test.
5. NO auto-matcher, no risk scores, no severity levels, no sentiment analysis, no engagement scoring. Absence counts only. We are peer support, not clinical monitoring. Matching is human judgment — surface signal, never decide.
6. Recording is NEVER possible. Zoom meetings carry all five enforced settings at creation: auto_recording none, waiting_room true, password required, join_before_host false, screen share host-only.
7. Attendance is PRE-FILLED, never auto-committed. A facilitator confirms. Attendance feeds payouts and delivery evidence. Store the raw Zoom report alongside the confirmation.
8. NEVER collect: diagnosis details, medications, the care recipient's name, any date of birth, any beneficiary identifier. partner_reference_id is opaque — store, never parse, never show to members, echo only in the partner export.
9. Every mutation writes to audit_log. If the audit write fails, the mutation fails. Role and cohort resolve server-side from the database, never from a client claim. RLS is the security model, not a layer on it.
10. NO hardcoded session counts or program facts — the programs row drives everything. Only license_status = 'licensed' programs are selectable. program_sessions titles/descriptions stay NULL until Ivan confirms the license permits display; never invent them.
11. Payout release is never automatic. Screens show; a reviewer releases.
12. No gamification, badges, certificates, streaks, or celebration screens. Finishing a dementia caregiving program is not an achievement to congratulate — the situation hasn't improved.

## Standing workflow — applies to every session, no paste required

1. FIRST OUTPUT, before any code: a PR plan — ordered PRs, each under 200 lines, each independently mergeable and green on its own. Then execute PR by PR. If the plan changes mid-session, restate the rest.
2. Per PR: tests first against the acceptance criteria — implement — run — self-correct until green — open the PR.
3. Migrations ship as the smallest possible standalone PR.
4. Touch only files in this session's scope. Needing a file outside it — especially migrations, auth, RLS, Zoom settings, another session's surface — means STOP and report which file and why. Do not proceed.
5. Every PR description lists: (a) every file modified, (b) any acceptance criterion not satisfied and why, (c) every assumption the prompt didn't specify.
6. Never delete or weaken an existing test to make a change pass.

## Design constraints — every member/facilitator screen

18px base text · 48px touch targets (56px primary actions) · WCAG AAA contrast · keyboard operable · no time-based interactions · no skeleton shimmer (plain "Loading…") · no invented copy · plain and warm, never cheerful, no emoji, no exclamation points. The human phone number appears in every error state and every locked-out moment — this population's fallback is a person, not a refresh. Error states never dead-end. The /admin density exemption applies to /admin only. New UI strings go in the copy deck (frontend-build Part 3.1), never inline.

## Testing rules

RLS tests authenticate as real users with their own JWTs — NEVER the service role key, which bypasses RLS and makes the test worthless while passing. Every isolation test must demonstrably fail with its policy removed (write — delete policy — watch fail — restore). Failing isolation tests block merge, no override.

## Architecture notes for future sessions

Implementation-specific conventions already decided in this codebase — not covered by any companion doc below, so kept here rather than lost when this file was consolidated from the earlier frontend-only CLAUDE.md.

- See `@AGENTS.md` for framework-version notes — auto-managed by `next dev`, do not hand-edit.
- **Tailwind v4, CSS-first config.** There is no `tailwind.config.ts` — all tokens live in
  `app/globals.css` via `@theme` / `@theme inline` blocks. Color and type tokens use
  `@theme inline` because they reference runtime custom properties (the `.dark` class, the
  768px media query); static tokens (radius, spacing, container width) use plain `@theme`.
  If you need a new token, add the CSS custom property and its `@theme` mapping in
  `globals.css` — don't reach for a JS config file.
- **Dark mode**: class strategy (`.dark` on `<html>`), persisted via the `kk_theme` cookie (not
  localStorage — see `lib/theme.ts`). On first visit with no cookie, a small blocking inline
  script in `<head>` (`themeInitScript`) reads `prefers-color-scheme`, applies the class before
  paint, and writes the cookie so subsequent requests render server-side with no flash.
  `app/layout.tsx` reads the cookie server-side via `next/headers` and sets the class directly on
  first paint whenever a cookie already exists. `components/theme-toggle.tsx` is the only place
  that writes the cookie after initial load.
- **Data layer**: `lib/fixtures/` holds typed mock data (`Cohort`, `CohortMember`, `Facilitator`,
  `Session`, `Post`) populated verbatim from Part 3.2 of the build doc. `lib/data.ts` is what
  screens actually import (`getCohort`, `getCohortMembers`, `getFacilitator`, `getSessions`,
  `getPosts`, `getUpcomingSession`) — when a real API exists, only `lib/data.ts` changes (L5,
  Wave 8).
  Session dates in the fixtures are concrete ISO dates anchored to a real Tuesday, not the
  relative labels ("next Tuesday") used in the prose of the build doc.
- Tele-Savvy session topics come from licensed curriculum materials and are not cleared for
  display — `Session.topic` stays in the type but is `null` in every fixture. Do not invent
  session titles.
- `program`, `sessionTotal`, and `deliveryFormat` are fields on `Cohort`/`Session`, never
  hardcoded assumptions — other programs (Stress-Busting: 9 sessions, Powerful Tools: 6) will run
  on this same platform.
- No photographs of people anywhere, including avatars — initials only, deterministic per member.
- **Supabase default ACLs are permissive, not restrictive.** New tables and functions get FULL
  privileges (INSERT/SELECT/UPDATE/DELETE/TRUNCATE, EXECUTE) granted to anon/authenticated/
  service_role automatically at creation time — confirmed via `pg_default_acl` on both local and
  the hosted project. A GRANT statement in a migration is additive on top of this, never a
  starting point: omitting a GRANT restricts nothing. Every restriction must be an explicit
  REVOKE. This bit both P1 (sign_in_events/profiles, fixed in p1-harden-grants) and P7a
  (audit_log) independently before either stream knew to look for it.
- **The local Supabase stack is shared across worktrees, not per-worktree.** `supabase start` /
  `supabase db reset` operate on Docker containers named after `project_id` in
  `supabase/config.toml` ("Kinkeepers") — every worktree of this repo on the same machine talks
  to the same containers. Whoever runs `db:reset` needs the full current
  `supabase/migrations/` directory, not just their own new files, or it silently drops schema
  the other stream depends on.

## Companion docs

kinkeepers-frontend-build.md (design system, copy deck) · KINKEEPERS-COMPLETE-RUN-DOC.md (waves, session prompts, edge-case register) · kinkeepers-testing-workflow.md (review pipeline, trigger globs, the 09:30 merge window) · f4milia-master-sequence.md (program data model notes) · f4milia-revenue-model.md §2 (facilitator compensation).

## Learned constraints — append-only; never edit or remove entries

Format: `YYYY-MM-DD · session · what happened · the rule now`. Every PR tagged `rework` adds a line here before the next session launches. Every discovered hidden coupling or non-obvious constraint adds a line, rework or not. This section is why week four is smarter than week one.

- 2026-08-26 · (seed) · Zoom participant reports identify phone joiners by number, not name · phone-join attendance requires E.164 matching (X4); never guess partial matches — ambiguous callers surface to the facilitator.
- 2026-08-26 · (seed) · staging must never send real messages · Twilio/Resend test mode or team-only allowlist; verify via provider logs, not assumption.
- 2026-08-26 · P1/P7a (both streams, independently) · Supabase's default ACLs grant new tables and functions FULL privileges to anon/authenticated/service_role at creation time — a GRANT in a migration is additive on top of this, not a starting point · every restriction needs an explicit REVOKE; see Architecture notes above.
- 2026-08-26 · P1 (Stream A) · Supabase's Management API `sessions_inactivity_timeout` field expects HOURS, not seconds — a value intended as "90 days in seconds" (7776000) was silently accepted, then crash-looped GoTrue ("invalid duration 7776000h") on the next full restart, causing a ~15-20 min Auth outage on the hosted project · convert to hours explicitly (2160 for 90 days) before writing this field via the Management API; GoTrue only re-reads it on a full restart, so a bad value can sit dormant and pass review before it actually breaks anything.
- 2026-08-27 · P7a (caught by Stream A) · audit_log.actor_id references profiles(id) with no ON DELETE behavior (defaults to RESTRICT), and audit_log is append-only by design — once a profile has written one audit row, that profile can never be hard-deleted, ever · P6/A5's deletion-fulfillment flow must anonymize/detach the profile rather than DELETE it; do not assume a plain delete works once a member has any privileged-action history (e.g. was ever a facilitator or admin). Also broke an absolute-row-count pgTAP assertion in audit_log.sql once a second test suite (admin-issued-sign-in-link) started writing real permanent rows - fixed to a baseline-delta assertion; any future audit_log test needs the same pattern, never an absolute count.
- 2026-08-27 · Stream A (E2E infra) · ZeroStep does not work, tried directly · dropped permanently, not a stopgap. E2E is plain Playwright (playwright.config.ts, e2e/*.spec.ts, path-filtered CI via .github/workflows/e2e.yml on app/**, components/**). Do not attempt to wire ZeroStep back in.
- 2026-08-28 · A1 PR3 (Stream A) · a pgTAP suite for two new audit_log-writing functions used an absolute-count assertion, reasoned as safe because the two audit_action enum values were brand new in that same migration and "nothing could have written them yet" - true only until a vitest integration test (lib/admin/partner-organizations.test.ts) that calls the same functions against the real, non-rolled-back local database ran once and left permanent rows behind, since audit_log is append-only and pgTAP's own begin/rollback wrapper doesn't protect against writes made outside that transaction by a different test runner · any pgTAP assertion touching audit_log needs the baseline-delta pattern (see audit_log.sql), never an absolute count - "this enum value is brand new" is not an exemption, because app-level integration tests (vitest, not just other pgTAP suites) can and do write real committed rows through the same code path before the migration's own PR even merges.
- 2026-08-29 · L4 (Stream B) · a stacked PR (#51, based on #50's branch) showed as "Merged" on GitHub, but its content never reached `main` - the reviewer merged #50 (branch → main) before merging #51 (PR2's commit → #50's branch), so `main` only picked up whatever #50's branch contained at the moment IT was merged, not the later commit #51 added to that same branch afterward. GitHub's PR "Merged" badge reflects the commit landing in the PR's own base branch, not in `main` - true only for a stacked PR. Caught by `git merge-base --is-ancestor <merge-commit> origin/main` returning false despite both PRs reading "Merged". · for a stacked PR chain, the base PR must merge to `main` LAST, after every PR stacked on it has merged into it first - merging the base PR early silently drops everything stacked on top, with no error and no visual sign on either PR. If merge order gets reversed anyway, the fix is a clean cherry-pick of the stranded commit onto current `main` in a fresh PR - the work isn't lost, just unreachable, and recovering it must not replay the stale branch wholesale (it will show every file the base stream has since gained as a deletion).
- 2026-08-31 · A3 (Stream A) · the exact L4 failure mode above recurred on a 3-deep stack: PR64 (`a3-cohort-schema` → `main`) merged 15 seconds *before* PR65 (`a3-cohort-creation-action` → `a3-cohort-schema`) finished, so `main` got only PR1's schema - PR2's orchestration functions and PR3's admin screen never reached `main` despite all three PRs reading "Merged". All three merges landed within the same 12-second window, meaning even a careful reviewer clicking "Merge" in the visually-correct bottom-to-top order can lose the race if GitHub's own merge-into-base and merge-into-main requests overlap - this is not solely a discipline problem, it can happen even when the merge button clicks happen in the right order. Recovered by creating a fresh integration branch off the stack's tip, `git merge origin/main` into it (a real 3-way merge, not a rebase/cherry-pick), confirmed the merge alone restored every unrelated file (another stream's parallel PR) that a naive tip-to-tip `git diff` had shown as a deletion, then opened one landing PR of the reconciled branch into `main` · for any stack 3+ PRs deep, verify each intermediate merge actually landed (`git log --oneline origin/main..origin/<next-branch-in-stack>` should be empty right before merging the next one) before clicking merge on the next PR in the chain - do not trust merge-order alone once three or more merges are happening close together in time. When recovery is needed, build the landing branch from a real `git merge`, never a diff-and-replay, so parallel unrelated work merged to `main` in the meantime is preserved rather than showing as deleted.
- 2026-09-01 · A3 (Stream A) · the SAME failure mode recurred a THIRD time on the recovery PR itself: the landing PR (#67, `a3-landing-main` → `main`) merged at 16:13:53, then the very next PR stacked on it (#68, session management) merged into #67's branch 12 seconds later at 16:14:05, and the PR stacked on #68 (#69, cohort completion) merged even later at 16:17:13 - so `main` again only picked up what the base branch contained at the moment it merged, silently dropping PR4 and PR5 despite both reading "Merged." This was caught only because a user's manual test of a not-yet-verified feature turned up a runtime error that shouldn't have been possible if the code were really live - a reminder that "the PR merged" is never sufficient confirmation on its own. Recovered the same way (fresh branch off the stack's tip, real `git merge origin/main`, one new landing PR - see the entry directly above for the full method) · treat every PR in a 3+-deep stack as suspect, including a PR whose entire purpose was fixing a previous instance of this bug - the fix is not immune to the bug it was fixing. After ANY stack of 3+ PRs reports as fully merged, the closing step is non-negotiable: run `git log --oneline origin/main..origin/<tip-branch>` and confirm it is empty before treating the feature as live, telling a user it shipped, or moving on to build the next thing on top of it.
- 2026-09-01 · A3 (Stream A) · `sessions.video_occurrence_id` was added by editing an EXISTING migration file (`20260829180000_cohort_creation_schema.sql`) with a new commit on its still-open PR branch, rather than writing a new migration file - reasoned as safe at the time because the PR hadn't merged yet. It merged into `main` in between the edit's two halves, and separately, its ORIGINAL (pre-edit) content had already been pushed to the hosted project via `supabase db push` before the edit was even written. Supabase's migration tracking records applied migrations by filename/version, not by content hash - so the later push of the edited file was silently a no-op on hosted (that version was already marked applied), and the column simply never existed there. Every local/CI environment looked fine because `supabase db reset --local` rebuilds the database from scratch, replaying every migration file's CURRENT content in order - it can never reveal this kind of drift, only a real diff against a persistent database can. Surfaced by a user's manual test failing with a misleading "Session not found" (the actual Postgres error - a missing column - was being swallowed and relabeled by `lib/admin/session-management.ts`'s own error handling); confirmed and scoped precisely via `supabase db diff --linked`, which flagged the missing column as the only real drift · a migration file must never be edited again once ANY environment may have applied it - not just once its PR merges to `main`, but from the moment `supabase db push`/`migration up` has been run against hosted OR any shared persistent database, including mid-PR-review pushes for manual testing. A schema change discovered to be needed after that point is always a new migration file, even if the "original" migration technically hasn't merged yet. When drift is suspected between local and hosted, `supabase db diff --linked` finds the exact discrepancy directly - it does not require guessing from symptoms. Separately: don't let a data-access helper collapse a real query error into a generic domain message ("Session not found") - surface the actual error, or the true cause (missing column, wrong permissions, whatever it is) gets hidden behind a misleading one.
