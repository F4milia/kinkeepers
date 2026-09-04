# QA — fix-p1-local-dev-auth-config

Preview URL: N/A - this fix only affects local `supabase start`/`db reset`, not the hosted staging/production projects (their dashboard Auth config is separate and was verified/fixed directly in earlier sessions today).
Fixtures used: none - a fresh throwaway email works for every step; Renata Solis/Jamie Ellis (`docs/qa/FIXTURES.md`) work identically and are a good real-world check on step 3.

## Primary check
A real self-service magic-link sign-in, followed start to finish through the actual `/sign-in` form and a real emailed link, now completes correctly on a fresh local `supabase start` - it silently failed before this fix, with no error shown anywhere.

1. `supabase stop` if running, then `supabase start` followed by `npm run db:reset` (a real reset, not just a restart - `supabase start` alone restores from a Docker backup snapshot and can mask this class of bug).
2. Run `npm run dev`, open `http://localhost:3000/sign-in` (not `127.0.0.1` - see the new README note), enter any email address, submit.
   **Expect:** "check your email" state, not "We couldn't send that."
3. Open Mailpit (`http://127.0.0.1:54364` by default) and click the real link in the captured email.
   **Expect:** lands on the correct role home (`/` for a fresh signup with no applicant to claim yet, which will 404 honestly - that's correct, not this bug) - never silently back on `/sign-in` with no error.
4. Click the exact same emailed link a second time.
   **Expect:** "That link has expired or was already used," not a silent failure.
5. Check Mailpit only shows the one captured message - no real email was sent anywhere.

## Regression (previous two sessions)
- [ ] fix-admin-sign-in-link-pkce (PR #122): confirm the admin-issued sign-in link's `token_hash`/`verifyOtp` branch still works - this PR only touches config.toml's redirect-URL allowlist and SMTP toggle, not `/auth/callback`'s own branches, but both branches share the same route file.
- [ ] fix-not-found-role-aware-home-link (PR #123): confirm a signed-in facilitator/admin hitting a 404 still gets a working "Go to Home" - unrelated code, but exercised by the same sign-in flow this QA doc drives.

## Result
- [ ] All pass
- Failures → issue links:
- Loom:
- Executed by / at:
