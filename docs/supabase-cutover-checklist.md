# Supabase project cutover checklist

Provisioning a new Supabase project (R1's own 2026-09-04 production
cutover, or any future re-provisioning) does not carry the following four
settings over automatically. All four are dashboard-only state - invisible
to `git diff`, `supabase db diff --linked`, `supabase db reset`, and every
test suite in this repo - and each one surfaced only after a real human
tried to use the new project for the first time. This checklist exists so
the next cutover finds all four before a real user does; see CLAUDE.md's
Learned Constraints (2026-09-04 "Production manual verification" and
2026-09-04 "P1 audit follow-up" entries) for the incidents that found each
one the hard way.

1. **Auth → URL Configuration.** A new project's Site URL defaults to
   `http://localhost:3000` with an empty Redirect URLs allowlist. With an
   empty allowlist, GoTrue rejects every real `redirect_to` the app sends
   and silently falls back to Site URL - a magic-link sign-in looks normal
   (the email arrives, the link looks right) but lands back on `/`
   with no session, and zero requests ever reach `/auth/callback`. Set
   Site URL to the real deployed domain, and add that domain's (plus any
   Vercel alias domains') `/auth/callback` explicitly to Redirect URLs -
   never a wildcard like `https://*.vercel.app/auth/callback`, since that
   would also match preview deployments wired to the *other* Supabase
   project.
2. **A real admin account.** Nothing in `seed.sql` or any migration ever
   grants `role = 'admin'` to anyone - there is no self-service path to
   admin by design (CLAUDE.md invariant #9: role resolves server-side from
   the database only). A brand-new project's `auth.users`/`profiles`
   tables are empty, so the first real sign-in - even the intended admin's
   own - gets the column default, `'member'`. Elevate the real admin's row
   by hand: `update profiles set role = 'admin' where id = (select id from
   auth.users where email = '<admin email>')`, run only after that person
   has actually signed in once.
3. **Custom SMTP settings (Auth → Emails → SMTP Settings).** Supabase
   Auth's own outbound email (magic links, OTP) is sent by GoTrue using
   the project's own SMTP configuration, entirely separate from the app's
   `RESEND_API_KEY`/`RESEND_FROM_EMAIL` env vars (used only for the app's
   own transactional sends). A new project defaults to Supabase's own
   sender (`noreply@mail.app.supabase.io`), not "KinKeepers." Copy the
   working values from `supabase/config.toml`'s `[auth.email.smtp]` block
   into the dashboard by hand, field by field - **never** run `supabase
   config push` against a real project to do this: that command pushes
   the entire config file with no way to scope it to one section, and
   `config.toml`'s own `[auth]` section holds `site_url`/
   `additional_redirect_urls` values meant for local dev, which would
   silently clobber whatever URL Configuration was just set correctly in
   step 1.
4. **Auth → Sessions → User Sessions inactivity timeout.** A new project
   defaults to Supabase's own value, not this app's spec'd 90 days. Set it
   to **2160** - the field expects hours, not seconds (a value intended as
   "90 days in seconds" was silently accepted once and crash-looped GoTrue
   on the next full restart; see CLAUDE.md's 2026-08-26 entry). GoTrue
   only re-reads this field on a full restart, so an incorrect value can
   sit dormant and pass every check before it actually breaks anything.

None of these four announce their own absence - each was found only by a
real person trying to actually sign in, or actually look for a setting,
against a project that had just been cut over. Run through all four
explicitly the next time this repo points at a new Supabase project,
rather than waiting for a real user to find whichever one was missed.
