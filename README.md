This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Install dependencies with `npm install`. For a new checkout, copy `.env.example`
to `.env.local` and fill in your Supabase project URL and secret key.
The local environment file is ignored by Git.

The Supabase client reads `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SECRET_KEY` from the environment. Import it from server code with:

```ts
import { supabase } from "@/lib/supabase";
```

The client is marked `server-only` to prevent imports into Client Components.
The secret key has elevated database access and bypasses row level security;
never expose it through a `NEXT_PUBLIC_` variable or commit it to Git.
Set both variables in Vercel before deploying this version, then redeploy.
Restart the development server after changing `.env.local`.

## Google login and profiles

The top-right Log in link opens `/login`. Google OAuth returns through
`/auth/callback`, where the server exchanges the authorization code for a
cookie-based session using `@supabase/ssr`. `proxy.ts` refreshes sessions.
Google credentials are configured in Supabase's Google provider, not in browser code.

Add `SUPABASE_PUBLISHABLE_KEY` to `.env.local` and Vercel's environment variables
alongside the URL and secret key above. It is the project's publishable (or
legacy anon) key, used by a separate, per-request user authentication client.
The admin client remains server-only. Deploy the code after updating Vercel.

Allow `https://YOUR-SITE/auth/callback` under Supabase Authentication → URL
Configuration → Redirect URLs, and use the stable production origin as Site URL.
For local development, allow `http://localhost:3000/auth/callback`. An individual
Vercel deployment URL only covers that deployment; allow the stable domain for
future releases. Google's authorized redirect URI remains the Supabase URL
`https://YOUR-PROJECT.supabase.co/auth/v1/callback`.

After login, the app checks `profiles.first_name` and `profiles.last_name`.
If either is null, empty, or whitespace, `/profile/complete` asks for the missing
fields. Server actions verify the user with Supabase before saving, derive the
profile ID from that user, validate names, and preserve existing names. Profiles
are normally created by the SQL sign-in trigger; completing the form also
supports older accounts without a profile. No password is stored in profiles.

To run the authentication integration checks, start the app on port 3000, then
run `node --env-file=.env.local scripts/test-auth.mjs`. This uses the configured
Supabase project, creates one temporary test user, and deletes it and its profile
afterward. It checks the Google authorization redirect, but completing Google's
interactive consent screen still needs a real browser sign-in.

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

## Jokes table

Run `supabase/migrations/20260922000000_create_jokes.sql` in your project's
Supabase SQL Editor to create `public.jokes`. The migration enables row level
security and allows visitors to read jokes, while keeping writes restricted
to administrators.

Each row contains an automatically generated `id` and `created_at`, plus these
required fields:

| Column | Content |
| --- | --- |
| `photo_url` | An HTTP(S) image URL, such as a public Supabase Storage URL |
| `funny_question` | The joke's question |
| `funny_answer` | The joke's answer |

Add rows using the Supabase Table Editor. The homepage calls `getJokes()` from
`lib/jokes.ts` on each request and displays the newest jokes first. The image
URL must be publicly accessible so visitors can see the photo.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
