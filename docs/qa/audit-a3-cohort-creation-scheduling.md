# QA — audit-a3-cohort-creation-scheduling A3: Cohort creation and session scheduling

Preview URL: <filled in by whoever verifies, from the PR's Vercel comment>
Fixtures used: none from `docs/qa/FIXTURES.md` — see "Fixture note" below for
why this session's own primary check can't use a seeded fixture.

## Primary check (from the run doc's Named edge-case register)
Failed Zoom creation must leave the cohort in draft with a visible error,
never a crash — and a cohort's "partner organization (optional)" field must
actually be selectable in the UI.

**Fixture note:** `supabase/seed.sql` deliberately seeds zero
`license_status = 'licensed'` programs — that's the accurate real-world
state (no licensing deal is signed yet), not an oversight, per that file's
own comment. That means `/admin/cohorts/new` always renders "No licensed
programs are selectable yet" against a fresh reset, and there is no
persistent fixture this doc can point to for a click-through. Verifying
this session's fix requires temporarily flipping one program's
`license_status` to `'licensed'` via the admin client for the duration of
the check, then reverting it immediately after — local only, never
staging/production. Do not add a fake licensed-program row to `seed.sql`
to make this convenient; that would misrepresent real business state for
every environment that resets from it.

1. On a fresh `supabase db reset --local`, temporarily set one program's
   `license_status` to `'licensed'` (e.g. `77777777-0000-0000-0000-000000000001`,
   Tele-Savvy) via the admin client.
   **Expect:** `/admin/cohorts/new` now renders the create-cohort form
   instead of "No licensed programs are selectable yet."
2. Sign in as a real admin fixture (see `docs/qa/FIXTURES.md`'s "Signing in
   as a fixture" for the pattern — any account with `profiles.role = 'admin'`
   works). Go to `/admin/cohorts/new`.
   **Expect:** the form shows a "Partner organization (optional)" dropdown
   between Facilitator and Cadence, defaulting to "None - KinKeepers direct."
3. Fill in the required fields (name, grouping description, first session
   date) with no `ZOOM_ACCOUNT_ID`/`ZOOM_CLIENT_ID`/`ZOOM_CLIENT_SECRET` set
   in the running server's environment, and submit.
   **Expect:** no crash / no generic error page. The page redirects to
   `/admin/cohorts/[id]`, shows status "draft," and displays "Zoom setup
   failed: Missing Zoom Server-to-Server OAuth credentials..." on the page.
4. Query the `cohorts` row directly.
   **Expect:** `status = 'draft'`, `zoom_setup_error` populated with the
   same message, zero rows in `sessions` for that cohort.
5. Repeat step 3, this time selecting a real active partner organization
   from the new dropdown before submitting.
   **Expect:** same graceful draft result; the cohort's own
   `partner_organization_id` column matches the selected org.
6. Revert the program's `license_status` back to its original value and
   delete the test cohort(s)/session rows created in steps 3 and 5.
   **Expect:** `supabase/seed.sql`'s original state is restored — confirm
   with a diff-free `license_status` read, not just "it should be back."

## Regression (previous two sessions)
- [ ] A2 (intake review and cohort assignment): assignment still shows
  correct cohort meeting times in the applicant's own time zone — this
  session touched `lib/admin/cohort-creation.ts`'s Zoom/session-instant
  logic, which A2's assignment screen reads from.
- [ ] A1 (admin shell, roles): `/admin/cohorts/new` is still reachable only
  to `admin` (not `facilitator`/`partner_staff`) — this session added a new
  data fetch (`listPartnerOrganizations()`) to that page's server component.

## Result
- [ ] All pass
- Failures → issue links:
- Loom:
- Executed by / at:
