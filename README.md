This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Environments

As of R1's production cutover, there are two genuinely separate hosted
Supabase projects: staging (`lupiicjafzrbihaosezv` — the original hosted
project, now Preview-only) and production (`vnadfnnckmkswfrzfjkj`, wired to
Vercel's Production environment only). A code deploy never moves data
between them. Every open PR's preview deployment reads and writes staging;
only the real production site reads and writes production. See CLAUDE.md's
Architecture notes for the full cutover record, including the dashboard-only
config (Auth URL settings, custom SMTP, admin role grants) that does NOT
carry over automatically when a new Supabase project is provisioned.

**One-command reset:** `npm run db:reset` (local Docker stack) or
`npm run db:reset:staging` (the linked hosted project — requires
`supabase link` first, and links to staging, never production). Both drop
and recreate the database from `supabase/migrations/` and reseed from
`supabase/seed.sql`, so they're safe to run repeatedly.

**What can't be tested in staging:** Twilio SMS delivery — no Twilio
credentials are configured in either environment yet, so SMS sign-in stays
deferred to email-only (see `lib/copy.ts`'s own `sign_in` comment). Resend
email and Zoom meeting creation both work in staging today, gated by
`lib/messaging/staging-guard.ts`'s outbound allowlist (`APP_ENV`/
`STAGING_MESSAGE_ALLOWLIST`, confirmed configured on Vercel's Preview
environment) so staging never reaches a real caregiver. **Known gap, not yet
resolved:** staging and production currently share the same Zoom account
credentials (`ZOOM_ACCOUNT_ID`/`ZOOM_CLIENT_ID`/`ZOOM_CLIENT_SECRET` are
identical across both Vercel environments) — X1's own requirement for a
separate staging Zoom app has not actually been provisioned. A staging
cohort's Zoom meeting is created on the same real account production uses.

**Local Supabase stack is shared, not per-worktree.** `supabase start` /
`supabase db reset` operate on Docker containers named after `project_id` in
`supabase/config.toml` ("Kinkeepers") — if two worktrees of this repo run
against the same machine, they share the same local database. Whoever runs
`db:reset` needs the full current `supabase/migrations/` directory, not just
their own new files, or it silently drops schema the other stream depends on.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
