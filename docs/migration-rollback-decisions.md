# Migration rollback decisions

R1's acceptance criterion: every migration in the repo carries a decision
- a tested down-path, or a documented reason a down-path is unsafe. This
file tracks that decision **separately from the migration files
themselves**, by explicit choice: every migration below has already been
applied to the one hosted Supabase project (see `README.md`'s
Environments section), and CLAUDE.md's own Learned Constraints record a
real incident (A3, 2026-09-01) caused by editing an already-applied
migration file - even a comment-only edit was judged not worth the risk
of setting that precedent again. **Every new migration going forward adds
its own row here in the same PR**, before merge.

## Two constraints that apply broadly, referenced by short name below

**"Enum values are permanent."** Postgres cannot remove a value from an
`enum` type once added (`alter type ... add value`) without recreating
the entire type - a genuinely higher-risk operation than the original
addition, especially once real rows use the new value. Every migration
that only adds enum values is forward-fix-only for this reason alone.

**"Real data now depends on this."** Every table in this schema has had
real rows written to it during this project's own testing (referrals,
cohorts, attendance, audit entries, consent records) - a `DROP TABLE` or
`DROP COLUMN` is a real data-loss operation here, not a schema-only one,
and later migrations frequently add foreign keys or columns onto tables
created earlier. A down-path that "only" drops schema silently destroys
whatever real rows came to depend on it in between.

## Decisions

| Migration | Adds | Decision | Reason |
|---|---|---|---|
| `20260826183733_profiles_and_sign_in_events` | `profiles`, `sign_in_events`, `app_role` enum | Forward-fix only | "Real data now depends on this" - `profiles` is the FK target of nearly every other table in this schema |
| `20260826202258_harden_explicit_revokes` | Explicit `revoke`s narrowing default-permissive grants | Forward-fix only | A down-path would re-widen anon/authenticated access to tables that should never have had it - reverting a security hardening is itself the unsafe operation |
| `20260826202705_audit_log` | `audit_log`, `audit_action` enum | Forward-fix only | "Enum values are permanent" + "Real data now depends on this" - this is the compliance log itself; it must never be droppable at all |
| `20260827202719_partner_organizations` | `partner_organizations` | Forward-fix only | "Real data now depends on this" - referenced by `applicants`, `cohorts`, `profiles` |
| `20260827203458_referral_intake_schema` | `applicants` + 4 enums, `profiles.partner_organization_id` | Forward-fix only | "Enum values are permanent" + "Real data now depends on this" - `applicants` is the core entity nearly every later migration builds on |
| `20260827211217_applicant_resume_token` | `applicants.resume_token` (unique) | Forward-fix only | Real intake-in-progress rows rely on this column existing to resume; dropping it breaks any in-flight intake, not just future ones |
| `20260828135251_program_catalog` | `programs`, `program_sessions`, license enum | Forward-fix only | "Real data now depends on this" - every cohort's session count/schedule derives from `programs` |
| `20260828135636_extend_partner_organizations` | status/contract-date columns + enum | Forward-fix only | "Enum values are permanent" |
| `20260828141442_consent_and_data_requests` | `consent_documents`, `member_consents`, request enums | Forward-fix only | "Enum values are permanent" + this is the legal/consent record - the one table where losing history is a compliance problem, not just an inconvenience |
| `20260828144500_admin_partner_organizations_crud` | 2 `audit_action` values | Forward-fix only | "Enum values are permanent" |
| `20260828144600_admin_partner_organizations_crud_functions` | 2 functions only | **Down-path available (untested in this pass, same pattern verified below)**: `drop function admin_create_partner_organization`, `drop function admin_update_partner_organization` - no data stored by a function itself; dropping only removes the ability to call it |
| `20260829120000_cohorts_and_applicant_assignment_schema` | `cohorts` + policies | Forward-fix only | "Real data now depends on this" |
| `20260829120100_add_applicant_audit_actions` | 3 `audit_action` values | Forward-fix only | "Enum values are permanent" |
| `20260829120200_applicant_assignment_functions` | 2 functions | Forward-fix only | Each function's own body is the ONLY write path CLAUDE.md's invariant #7-style rules rely on (e.g. attendance/status integrity) - dropping it doesn't undo past writes, it only removes the safety-checked way to make new ones, which is a functional regression, not a safe no-op |
| `20260829140000_applicant_status_events_cascade_delete` | FK constraint change (cascade behavior) | Forward-fix only | Reverting restores a delete-blocking FK behavior a later session (P7a) specifically needed changed - see CLAUDE.md's own Learned Constraints on why `RESTRICT` there caused a real problem |
| `20260829180000_cohort_creation_schema` | `sessions`, 3 enums, cohort-facilitator trigger | Forward-fix only | "Enum values are permanent" + "Real data now depends on this" |
| `20260829180100_add_cohort_audit_actions` | 2 `audit_action` values | Forward-fix only | "Enum values are permanent" |
| `20260829190000_cohort_cadence_enum` | `cohort_cadence` enum + column | Forward-fix only | "Enum values are permanent" |
| `20260829190100_cohort_creation_functions` | 2 functions | Forward-fix only | Same reasoning as `20260829120200` - the function IS the safety check, not incidental to it |
| `20260901120000_session_management_functions` | 3 `audit_action` values, reschedule/cancel functions | Forward-fix only | "Enum values are permanent" + same function-is-the-safety-check reasoning |
| `20260901130000_cohort_completion_function` | 1 `audit_action` value, `mark_cohort_completed()` | Forward-fix only | "Enum values are permanent"; this function has since been extended twice more (`20260902100000`, `20260903100000`) via `create or replace` - dropping the original definition's underlying object would break those later, currently-live versions too |
| `20260901140000_add_sessions_video_occurrence_id` | `sessions.video_occurrence_id` | Forward-fix only | Column looks trivially droppable, but every cohort-creation call and X4's attendance pre-fill read path write/read it directly - dropping it breaks currently-running functionality, not just future migrations |
| `20260901150000_partner_cohort_scoping` | 2 RLS policies (additive only) | **Down-path tested**: `drop policy "cohorts_select_own_partner_referrals" on cohorts;` and the `sessions` equivalent - verified locally (same pattern as `20260903110000` below) that dropping a purely-additive SELECT policy executes cleanly with zero schema/data impact; Postgres OR-combines multiple permissive policies, so removing one only narrows partner_staff's own read access back to what it was before this migration, nothing else is affected |
| `20260901160000_data_request_fulfillment` | 1 `audit_action` value, `mark_data_request_fulfilled()` | Forward-fix only | "Enum values are permanent" |
| `20260901170000_notification_log_and_unsubscribe` | `notification_log` + unsubscribe columns | Forward-fix only | "Real data now depends on this" - real failed-send rows already exist (verified manually this session, `/admin/notifications`) |
| `20260901170100_facilitator_certifications` | `facilitator_certifications` | Forward-fix only | "Real data now depends on this"; a cohort-assignment trigger added later (`enforce_cohort_program_and_facilitator`) depends on rows here existing |
| `20260901180000_add_facilitator_certified_audit_action` | 1 `audit_action` value | Forward-fix only | "Enum values are permanent" |
| `20260901180100_add_facilitator_certification_function` | 1 function | Forward-fix only | Same function-is-the-safety-check reasoning (this is the ONLY write path for certification rows) |
| `20260901180200_admin_list_consent_gaps` | 1 read-only function | **Down-path available**: `drop function admin_list_consent_gaps();` - purely a read query, no write path, no data at risk; not re-tested in this pass but the reasoning is unambiguous (no side effects exist to lose) |
| `20260901190000_member_identity_bridge` | `applicants.profile_id`, `claim_applicant_for_current_user()`, roster function, policy | Forward-fix only | "Real data now depends on this" - member sign-in itself resolves through this bridge; nearly every later member-facing RLS policy assumes `profile_id` exists |
| `20260902100000_analytics_events` | `analytics_events`, event enum, extends `assign_applicant_to_cohort`/`mark_cohort_completed`, adds `withdraw_applicant()` | Forward-fix only | "Enum values are permanent" + this is an append-only log by design, same category as `audit_log` |
| `20260902110000_session_attendance` | `session_logs`, `session_attendance`, 1 `audit_action` value, `submit_session_log()`, roster function | Forward-fix only | "Enum values are permanent" + "Real data now depends on this" - real attendance rows exist (verified manually this session) |
| `20260902120000_fix_stale_attendance_events` | `create or replace` on 2 existing views/functions (bug fix) | Forward-fix only | This IS a rollback of sorts already reversed - it fixed a real stale-data bug (CLAUDE.md's Learned Constraints); reverting it reintroduces that bug, which is strictly worse than "unsafe," it's a known regression |
| `20260902140000_session_prep_materials` | `session_materials`, `get_session_prep_materials()` | Forward-fix only | "Real data now depends on this" once any material is uploaded; function is the certification-gate check itself |
| `20260903100000_cohort_completion_notifies_members` | `create or replace` on `mark_cohort_completed()` (adds applicant-status cascade) | Forward-fix only | Reverting drops a real, previously-missing behavior (applicant status now correctly cascades to 'completed') that a later stream depends on for correctness, not just a cosmetic add |
| `20260903110000_session_attendance_partner_scoping` | 1 RLS policy (additive only) | **Down-path tested** (see `docs/qa/A5-partner-csv-export.md`'s own negative-drill record, and re-verified again while writing this file): `drop policy "session_attendance_select_own_partner_referrals" on session_attendance;` executes cleanly, zero data/schema impact, only narrows partner_staff's own read access back to pre-migration state |
| `20260903120000_member_self_update_applicants` | `grant update (...)` + 1 RLS policy | Forward-fix only (not independently re-tested for this file) | Combines a column-scoped grant with a policy - the grant half isn't a pure additive-policy case like the two above, so it's held to the more conservative default here rather than assumed equivalent |

## What this means in practice during an incident

Per `docs/incident-response.md`: if a bad merge involved a migration, the
overwhelming majority of entries above say the same thing - **do not try
to undo the migration**. Write a new, forward-fixing migration instead.
The two "down-path tested" rows (both plain additive RLS policies) are
the only cases where directly reversing the migration is actually the
right move, and even then, only because removing an additive policy
narrows access rather than destroying anything.
