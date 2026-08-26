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

Pre-launch, there is one hosted Supabase project (`lupiicjafzrbihaosezv`), and it
serves as staging. There is no separate production project yet — provisioning
one, and the cutover, is R1's job (Wave 10), completing before cohort one's
first live session. Until then, "staging" and "the hosted project" are the same
thing; don't assume a prod/staging split exists elsewhere in config or docs.

**One-command reset:** `npm run db:reset` (local Docker stack) or
`npm run db:reset:staging` (the linked hosted project — requires
`supabase link` first). Both drop and recreate the database from
`supabase/migrations/` and reseed from `supabase/seed.sql`, so they're safe
to run repeatedly.

**What can't be tested in staging yet:** real outbound Twilio/Resend/Zoom
delivery — none of those integrations exist yet (they land in P3/P4/X3).
Once they do, staging must never send a real message to a real person; see
`lib/messaging/staging-guard.ts` for the mechanism enforcing that.

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
