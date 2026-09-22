This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Install dependencies with `npm install`. For a new checkout, copy `.env.example`
to `.env.local` and fill in your Supabase project URL and publishable (or legacy
anon) key. The local environment file is ignored by Git.

The Supabase client reads `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` from the environment. Import it with:

```ts
import { supabase } from "@/lib/supabase";
```

The anon-key variable also accepts Supabase's newer publishable key. These
`NEXT_PUBLIC_` values are available to browser code; only use a publishable or
anon key here. Set both variables in your hosting environment before building
for deployment. Restart the development server after changing `.env.local`.

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
