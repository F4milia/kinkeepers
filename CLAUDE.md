# CLAUDE.md — KinKeepers

KinKeepers runs closed peer-support cohorts for dementia caregivers, delivered over Zoom by certified lay facilitators, sold to health systems. Members are caregivers aged 50–75: often exhausted, often with presbyopia or tremor, sometimes on a tablet a family member set up. Every design decision serves that person. The candor of a closed room is the product.

## Stack — locked, do not re-litigate

Supabase (Postgres, Auth, RLS, Realtime, Storage) · Inngest (jobs) · Resend (email) · Twilio (SMS) · Zoom Workplace for Healthcare via Server-to-Server OAuth (join URLs only — NO embedded video, no Meeting SDK, no WebRTC) · pgTAP + ZeroStep/Playwright in CI · Sentry (PII-scrubbed or disabled). Analytics live in our own Postgres. Auth is Supabase Auth; Twilio/Resend are delivery only.

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

kinkeepers-frontend-build.md (design system, copy deck) · KINKEEPERS-COMPLETE-RUN-DOC.md (waves, session prompts, edge-case register) · f4milia-master-sequence.md (program data model notes) · f4milia-revenue-model.md §2 (facilitator compensation).

## Learned constraints — append-only; never edit or remove entries

Format: `YYYY-MM-DD · session · what happened · the rule now`. Every PR tagged `rework` adds a line here before the next session launches. Every discovered hidden coupling or non-obvious constraint adds a line, rework or not. This section is why week four is smarter than week one.

- 2026-08-26 · (seed) · Zoom participant reports identify phone joiners by number, not name · phone-join attendance requires E.164 matching (X4); never guess partial matches — ambiguous callers surface to the facilitator.
- 2026-08-26 · (seed) · staging must never send real messages · Twilio/Resend test mode or team-only allowlist; verify via provider logs, not assumption.
- 2026-08-26 · P1/P7a (both streams, independently) · Supabase's default ACLs grant new tables and functions FULL privileges to anon/authenticated/service_role at creation time — a GRANT in a migration is additive on top of this, not a starting point · every restriction needs an explicit REVOKE; see Architecture notes above.
- 2026-08-26 · P1 (Stream A) · Supabase's Management API `sessions_inactivity_timeout` field expects HOURS, not seconds — a value intended as "90 days in seconds" (7776000) was silently accepted, then crash-looped GoTrue ("invalid duration 7776000h") on the next full restart, causing a ~15-20 min Auth outage on the hosted project · convert to hours explicitly (2160 for 90 days) before writing this field via the Management API; GoTrue only re-reads it on a full restart, so a bad value can sit dormant and pass review before it actually breaks anything.
