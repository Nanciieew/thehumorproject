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

After login, users without `profiles.onboarding_completed_at` see a three-step
welcome dialog: required first/last names, an optional photo, and a required US
state. The final “start my journey!” button saves the profile and completion
timestamp together. Existing accounts also complete this once to select a state.
`/profile/complete` redirects home, where the dialog appears. Server actions
verify the session, validate every required answer, and prevent a stale welcome
form from overwriting a completed profile. A Google session is only a pending signup until completion. The final action
inserts the complete profile in one write; pending users cannot access Profile
Settings, Image Studio, or its generation API. Existing incomplete profiles are
preserved and completed by the same flow. No password
is stored in profiles.

To run the authentication integration checks, start the app on port 3000, then
run `node --env-file=.env.local scripts/test-auth.mjs`. This uses the configured
Supabase project, creates one temporary test user, and deletes it and its profile
and uploaded test images afterward. It checks profile edits, image validation,
private Storage access, replacement cleanup, and the Google authorization
redirect, but completing Google's
interactive consent screen still needs a real browser sign-in.

## Editing profiles and uploading photos

The Home sidebar is rendered only after the server verifies a signed-in
user. Guests see the public Avatar Gallery and Log in link, without a sidebar.
The small bottom-left avatar (initials until a photo is uploaded) opens a menu
with outlined Profile and Log out icons. The menu stays available across pages. Profile Settings lets users edit both names, choose
which of the 50 US states they represent, and
upload a JPG, PNG, or WebP photo (up to 2 MB and 24 megapixels). The server
validates and decodes the image with Sharp, strips metadata, and crops it to a
512×512 WebP. The private `profile-photos` Supabase Storage bucket contains the
image bytes. `profiles.avatar_path` contains only the user's object path;
the existing `avatar_url` column is retained for Google metadata.

Run `supabase/migrations/20261001000000_add_profile_photos.sql` for new database
setups, followed by `supabase/migrations/20261006000000_add_profile_state_onboarding.sql`
for `state_code` and `onboarding_completed_at` with database constraints. Then apply
`supabase/migrations/20261007000000_create_profiles_after_onboarding.sql` to
remove automatic profile creation on sign-in. The new server action creates
profiles only after all required onboarding answers are valid.
Photo access uses temporary signed URLs; no public Storage policies are
needed. Every update verifies the signed-in user and uses that ID, never an ID
from the form. A successfully replaced photo is removed from Storage; if the
profile save fails, the new upload is removed instead. The app allows a 3 MB
Server Action body to accommodate the 2 MB photo and multipart form overhead.

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

The interface uses locally hosted Inter and Anton fonts through `next/font/local`. Their SIL Open Font Licenses are included in `app/fonts`. The main surface is glossy white, with yellow, pink, blue and moss accents. The gallery uses one responsive grid, and the sidebar includes Image Studio, a future Leaderboard page and the account menu.

## Avatar Gallery

Apply `supabase/migrations/20261007000001_avatar_gallery.sql` after the existing
migrations. The homepage is a separate public gallery; it does not publish
profile photos or migrate the old joke images. Photos appear immediately after
explicit publication and display the contributor's full name.

The feed loads automatically as visitors scroll. Top ranks all photos by upvotes;
Top this week ranks photos published since Monday midnight in America/New_York;
Newest orders by publication time. Ties use publication time and ID. Cursor
requests exclude newer publications until a fresh feed load and the UI removes
duplicates. Vote counts can change between requests; refreshing starts a fresh
ranking. Voting never reorders the cards currently on screen.

`photo_votes` has one row per photo/user, with value 1 or -1. Selecting the same
vote removes it. Completed users write through a session client and RLS; guests
can browse totals but cannot vote. `gallery_vote_totals` exposes both counts to
administrators, while the restricted public feed/score functions expose only
upvote counts and contributor credit. Individual voter records stay private.

Gallery uploads accept JPG/PNG/WebP up to 10 MB and 24 megapixels. The upload
ticket endpoint creates an owner-bound record and signed URL for private
`gallery-staging` Storage. The browser uploads there directly. Publication
verifies and re-encodes image bytes, preserves aspect ratio (maximum 2048 pixels
on either side), strips metadata, and writes to public `gallery-photos` Storage.
Profile and onboarding photos retain their separate 2 MB limit and private bucket.

Generated images are downloaded from approved provider hosts, saved privately in
`generated-images`, and recorded with their owner before success is returned.
Image Studio reloads the latest 30 saved images. Publication uses the saved ID,
not a browser-supplied URL. Concurrent/repeated publications create only one
gallery row; images remain usable after the provider's original URL expires.

Staging tickets expire after two hours. Background cleanup on gallery visits and
upload requests removes up to 100 abandoned objects older than 24 hours per run
(at most once per five minutes per server process). With no traffic, cleanup
runs on the next visit. To run it manually or from a scheduler:

```bash
node --env-file=.env.local --conditions=react-server --import tsx scripts/cleanup-gallery.ts
```

API endpoints: `GET /api/gallery?sort=top|week|newest&cursor=…`,
`POST /api/gallery/vote` with `{photoId, value: 1|-1|null}`,
`POST /api/gallery/upload` with file `{size, type}`, and
`POST /api/gallery/publish` with `{assetId, source: "upload"|"generated"}`.
Writes require same-origin requests and completed signup. Secrets remain server-only.

Tests (integration checks create and remove temporary data in the configured project):

```bash
npm run test:gallery-ui
# With the local app on port 3000:
node --env-file=.env.local scripts/test-gallery.mjs
node --env-file=.env.local scripts/test-auth.mjs
node --env-file=.env.local --conditions=react-server --import tsx scripts/test-gallery-media.ts
```

Component tests cover optimistic voting, colors, login prompts, infinite scrolling,
retry, and direct upload sequencing. Integration tests cover RLS with separate
users, counts, weekly/DST boundaries, upload size and decoding, image ownership,
concurrent publication, and expired staging cleanup. The media test mocks only the
provider download, preserving real Supabase persistence without buying a generation.

## Preserved jokes table

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

The existing records and `lib/jokes.ts` remain available, but the homepage now
displays gallery submissions instead.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

Image Studio accepts an optional JPEG or PNG reference photo (up to 2 MB and 24 megapixels). The server validates its type and dimensions before sending it to Ark alongside the prompt. Reference photos are sent to Ark only when generating; the sample test uses its original text prompt. Run `npm run test:studio-ui` for UI submission and reference validation checks.
