# Ego Check

Finally, an app that sees the problem.

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
Settings, You Are a Joke, or the image generation API. Existing incomplete profiles are
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

The interface uses locally hosted Inter and Anton fonts through `next/font/local`. Their SIL Open Font Licenses are included in `app/fonts`. The interface uses warm paper, black ink, acid yellow and red verdict stamps. The gallery uses one responsive grid, and the sidebar links Get Checked, The Arena, Public Evidence, Your Damage Report, Hall of Shame and Friends.

## Avatar Gallery

### Consolidated images migration

The connected project has been migrated to the consolidated `images` schema.
For a fresh environment, apply migrations through
`20261007000002_my_works.sql`, then
`supabase/migrations/20261007000003_consolidate_images.sql` before serving this
app version. The new `images` table replaces `generated_images`, `gallery_photos`,
and `work_captions`. Publication updates the existing generated image; uploaded
images are inserted after validation using the upload ticket's creation date.
Old uploads without tickets fall back to publication time. Profile pictures and
Storage buckets remain separate. `photo_votes` references `images` and rejects
unpublished targets. Public feed results expose no private paths or downvote totals.

Cutover procedure:

1. Inspect the live schema against the repository migrations. Pause generation,
   publication, caption edits, and voting (stop the app during this short cutover).
2. Capture a consistent data/schema backup outside the repository using
   `node --env-file=.env.local scripts/backup-images.mjs /private/tmp/images-backup.json`.
   This requires a valid Supabase management access token and writes an owner-only
   file without printing row contents. Storage objects are not moved or deleted.
3. Run the consolidation migration in Supabase SQL Editor. It locks the affected
   tables and rolls back completely on ID conflicts, owner mismatches, or orphaned
   captions. Do not bypass those checks; reconcile conflicting data first.
4. Deploy/start this app version. Previously open gallery cursors must be refreshed
   when switching sort definitions. The current forward migration uses publication time.
5. Compare the backup's row counts, IDs, captions, and votes with `images`; confirm
   private previews, public URLs, My Works, profile photos, and voting. Run
   `npm run test:images-db`, `npm run test:images-media`, `npm run test:gallery-ui`, and the integration scripts
   below against the migrated project and a local app. The database test is fully
   local and does not require credentials.

The consolidation migration retains restricted legacy snapshots. After successful
live verification and a fresh backup, apply
`supabase/migrations/20261007000004_remove_legacy_image_tables.sql` to remove
`generated_images`, `gallery_photos`, and `work_captions`. This retirement migration
verifies the original images and publication metadata exist in `images` and uses
`DROP TABLE` without `CASCADE` so unexpected dependencies abort the transaction.
The connected project has completed this retirement. Votes, profiles, upload
tickets, Storage objects, and the gallery/My Works views remain in place.
`scripts/backup-images.mjs` supports both the old and consolidated schemas.

### My Works

Apply `supabase/migrations/20261007000002_my_works.sql` after the gallery
migration before deploying the My Works feature. `/my-works` lists the signed-in
user’s published uploads and saved generated images, with private/published
badges and cursor-based scrolling. Generated works appear once after publication.
Each card opens an owner-only detail page for editing an optional name (100
characters) and description (1,000 characters).

`images` stores each saved image and its captions in one row. My Works queries
`images` directly with the authenticated client and the verified account ID, ordered
by creation time then ID. Details also filter by owner and image ID. The
`save_work_caption` function runs with the authenticated user’s permissions;
RLS checks ownership and completed onboarding. Generated-image previews use
private signed Storage URLs. `gallery_feed` returns captions only for published
photos, without exposing private captions or changing votes/publication times.

For the existing consolidated project, apply the forward migration
`20261007000006_gallery_publication_order.sql` during the deployment window;
it changes Gallery ordering and cursors to publication time without changing rows.
The app detects old creation-time cursors and reloads the first batch automatically.
Deploy and verify this direct-query app **before** applying
`20261007000007_remove_my_works_view.sql`. Its `DROP VIEW ... RESTRICT` deliberately
fails on unexpected dependencies. Do not rerun historical consolidation migrations.
The local database test runs with the view removed; live integration uses images only.

Run `node --import tsx --test scripts/works-ui.test.mjs` for interaction checks.
After applying the migration and starting the app on port 3000, run
`node --env-file=.env.local scripts/test-works.mjs` for Supabase/API integration
checks. The latter creates temporary users/assets and removes them afterward.

Apply `supabase/migrations/20261007000001_avatar_gallery.sql` after the existing
migrations. The homepage is a separate public gallery; it does not publish
profile photos or migrate the old joke images. Photos appear immediately after
explicit publication and display the contributor's full name.

The feed loads automatically as visitors scroll. Top ranks all photos by upvotes;
Top this week ranks photos published since Monday midnight in America/New_York;
Newest orders by publication time. Upvote ties use publication time descending, then ID descending. Downvotes are counted separately and never subtracted from the ranking score. Cursor
requests exclude newer publications until a fresh feed load and the UI removes
duplicates. Vote counts can change between requests; refreshing starts a fresh
ranking. Voting immediately reorders cards using the same ranking rules.

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
Existing generated images remain in My Dashboard. Publication uses the saved ID,
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

## Retired legacy avatar table

The connected project's unused `public.avatar` joke table was backed up and
removed with `supabase/migrations/20261007000005_remove_avatar.sql`. The current
app uses `images` for gallery content. The historical `create_jokes` migration
and unused `lib/jokes.ts` remain as repository history; they are not required by
the current gallery.

`gallery_uploads` is temporary staging, not a saved-drafts collection. Uploads
can be published for two hours; expired tickets/objects are cleaned up after
24 hours. Saved generated images instead live in `images` and can be reopened
through My Works.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

The image generation API accepts an optional JPEG or PNG reference photo (up to 2 MB and 24 megapixels). The server validates its type and dimensions before sending it to Ark alongside the prompt. Reference photos are sent to Ark only when generating; the sample test uses its original text prompt. Run `npm run test:images-reference` for reference validation checks.

Gallery favorites and this-week rankings reorder immediately when votes change, using upvotes descending and then creation date/ID for ties. Failed votes restore their previous counts and order. Visible pages refresh every 15 seconds while the tab is visible and on focus; this also discovers photos rising from later pages. Newest continues to sort by creation date.

## Sales leaderboard backend

Apply `supabase/migrations/20261008000000_sales_leaderboard.sql` after the images
consolidation. It adds nullable `images.price_cents`, an immutable state snapshot
at publication, and `image_sales`. Existing publication states are backfilled from
current profiles; their true historical states are unavailable. No sales are
invented and existing image/vote records are preserved.

`image_sales` stores one completed USD sale per unique transaction reference.
The server derives its seller and sale-time state. Only published images from
completed profiles can be sold; sale time cannot precede publication or be in
the future. Sale facts are immutable and referenced images/profiles cannot be
deleted while sales exist. `refunded_cents` is a cumulative, non-decreasing refund
amount, bounded by the original amount. Refunds reduce the original sale month's
revenue. Image price edits do not affect historical sale amounts.

Use the trusted local admin tool (amounts are integer cents):

```sh
npm run leaderboard:admin -- price IMAGE_UUID 1000
npm run leaderboard:admin -- sale IMAGE_UUID 1000 transaction-reference
npm run leaderboard:admin -- sale IMAGE_UUID 1000 another-reference 2026-10-08T12:00:00Z
npm run leaderboard:admin -- refund SALE_UUID 250
```

Repeating the same sale reference and details returns the existing sale ID;
conflicting details fail. Repeating a cumulative refund does not refund twice.
These commands use the server secret in `.env.local`; never run them in a browser.
There is no checkout/payment integration or credit issuance in this version.

`GET /api/leaderboard?period=monthly` (default) or `period=all_time` requires a
signed-in user with completed onboarding. It returns:

- `individuals`: rank, creator ID, full name, signed profile-photo URL, published
  avatar count, current upvotes, and net `revenue_cents`.
- `podium`: the first three rows of the same ranking, independent of page cursor.
- `monthly_top_avatars`: three avatars published this month ranked by current
  upvotes, including title, author, author profile photo and public avatar URL.
- `monthly_top_regions`: three states ranked by this month's net revenue, with
  state names and avatar contribution counts.
- `monthly_rewards`: display-only 2,000 / 1,000 / 500 credits; no balances/ledger.
- `as_of`, `month_start`, `month_end`, and an opaque `next_cursor`; pass it as
  `&cursor=...` for another 30 individuals.

Monthly periods use calendar-month boundaries in America/New_York. Monthly
creator avatar/vote counts concern avatars published this month; revenue includes
sales this month of older avatars. All-time mode expands only the individual
leaderboard and podium; sidebar arrays remain monthly. States receive sales by
sale-time state and avatar contributions by publication-time state. Downvotes
never subtract. Revenue ties use the latest qualifying avatar creation timestamp,
then creator UUID; avatar vote ties use creation timestamp and image UUID
descending; state revenue ties use state code ascending.

`revenue_cents` is a decimal **string** to preserve exact large totals; divide by
100 using an exact decimal formatter when displaying USD. Raw sales and storage
paths are never returned by the app endpoint. Missing profile photos return null
for an initials fallback. RLS/grants deny browser access to raw sales and all
backend RPCs; only the trusted server can call `leaderboard_summary`,
`record_image_sale`, and `record_image_refund`.

Pagination excludes later publications and sale records using `as_of`; live votes,
refunds and profile edits can still change results, so reload from the first page
when refreshing a leaderboard. `/leaderboard` renders the connected podium, creator
rankings, and monthly rewards/avatar/state panels. Monthly and All Time change
the central rankings; the right panels stay monthly in New York time. It supports
refresh, cursor pagination, retryable errors, empty states, and profile-photo
initials fallbacks. `/test/leaderboard` retains the sample-data design preview.
Reward credits are display-only; the page does not issue rewards.

The sales leaderboard migration is applied to the connected project. Its sales
table starts empty; record real sales with the admin tool to populate revenue.
The existing backup script also includes `image_sales` when present.

Run `npm run test:leaderboard-db` for isolated PostgreSQL schema/ranking tests and
`npm run test:leaderboard-api` for cursor, signed-photo and response tests.
`npm run test:leaderboard-ui` checks period switching, pagination, refresh,
error recovery, empty states, and exact USD rendering.

For live endpoint checks, start the app and run
`node --env-file=.env.local scripts/test-leaderboard.mjs`. Set
`LEADERBOARD_TEST_URL=http://localhost:3001` if using another port. This test creates
and removes temporary profiles/images and never creates sale records.

## Personal dashboard

The sidebar’s My Dashboard page keeps the existing `/my-works` URL and caption
editing links. Three responsive cards show all-time USD revenue after refunds,
upvotes on published avatars, and the count of published avatars. Private saved
generations stay in the collection but do not count as published.

`GET /api/dashboard` requires completed signup and always uses the authenticated
user ID; it accepts no owner selection. The response is private/no-store and
contains only aggregate decimal strings. Refresh updates the cards, and failures
retain the last successful values instead of showing invented zero totals.

The optional `20261008000001_personal_dashboard.sql` migration performs these
aggregates in one service-only database call. It has not been applied to the
connected project because the configured management credential was rejected.
Until installed, the server computes the same totals using owner-scoped,
keyset-paginated reads of `images`, `gallery_vote_totals`, and `image_sales`,
without the collection’s 30-item limit or Supabase’s row limit truncating totals.
No additional tables are required.

Run `npm run test:dashboard-ui` and `npm run test:dashboard-api`; the personal
aggregate SQL and permissions are also covered by `npm run test:leaderboard-db`.
The live integration script `scripts/test-leaderboard.mjs` verifies the dashboard
page and endpoint with temporary fixtures that are removed afterward.

## Ego Check — deployment and new competition features

Ego Check replaces the home gallery with **Get Checked**, the consent-first
webcam roast experience. Each click requests one roast attempt, then pauses until
the user chooses “Hurt my feelings again.” Skips, errors, cancellation and changes
to settings never start another attempt automatically. Signed-out visitors see a dark mirror landing page.
The guest mirror requests browser camera permission on arrival, with a retry button
if the browser blocks or defers the prompt. It sends no frames to the server or Gemini, requests no audio,
and releases the camera on Stop, page hiding, or navigation.
Run `npm run test:guest-ui` for this guest camera lifecycle. The existing photo feed is now `/gallery` (**Public
Evidence**); `/you-are-a-joke` redirects home. `/challenges` is **The Arena**,
`/friends` manages friendships, and `/leaderboard` is **Hall of Shame**.
All public and signed-in pages share the dark ink, chrome and acid-yellow design.
The existing dashboard keeps its actual photo/vote/revenue calculations.
Marketplace and Image Studio remain removed.

### Database setup (required before deployment)

Apply `supabase/migrations/20261014000000_ego_check.sql` in the connected Supabase
project's SQL Editor after the existing gallery/image migrations. It is a single
transaction, preserves existing users/photos/votes, and creates the new
friends/challenges/votes, shared roast sessions/limits, monthly vote activity,
private storage bucket and service-only operations. Do not run it twice.

Alternatively, put a valid `SUPABASE_ACCESS_TOKEN` in the ignored `.env.local`,
then use:

```sh
node --env-file=.env.local scripts/ego-migrate.mjs
node --env-file=.env.local scripts/ego-migrate.mjs --apply
```

The first command is a read-only preflight. The migration was applied manually
in Supabase SQL Editor and verified on October 15, 2026. The connected tables,
ranking RPC and private bucket are available. The live API test passed using
disposable accounts and synthetic snapshots against a local app server; test
accounts and media were removed afterward. Management-token access is separate
from the working data API and is not needed to use the installed features.

In Vercel retain the existing Supabase variables and configure:

```dotenv
ROAST_PROVIDER=gemini
GEMINI_API_KEY=your-server-only-key
GEMINI_MODEL=gemini-3.8-flash
CRON_SECRET=your-long-random-secret
```

`CRON_SECRET` authorizes `/api/cron/ego`; `vercel.json` schedules daily cleanup.
Create a random secret locally with `openssl rand -hex 32`, then enter it as the
Vercel value. Never prefix secrets with `NEXT_PUBLIC_`. Roast receipt signatures
use the existing server-only Supabase secret. Changing that secret invalidates
unsubmitted receipts. Redeploy after updating environment variables.

### Competition rules and privacy

- Invitations expire after seven days and can be accepted by only one opponent.
- Friends-only audiences are accepted friends of either participant. A removed
  friendship no longer grants media access. Public battles permit guest viewing;
  voting, friendships and entries require completed signup.
- Both participants explicitly approve their own snapshot/caption and disclosed
  audience. Snapshots are in-memory until that approval; no raw inference frames
  are stored. Signed, 15-minute receipts bind the owner, caption and exact JPEG.
- Spectators vote for **who got cooked harder**. One vote per account per battle;
  it can be changed/removed before the 48-hour deadline. Participants cannot vote.
- Challengers-only exchanges are private and unranked. A new audience requires
  a new challenge and new approvals; active entries/audiences are immutable.
- Deadline checks and transactional finalization freeze battle tallies even if
  the cron is delayed. Ties award no winner. Only public battles with three or
  more spectator votes qualify for rankings, with one win per opponent/week.
- Completed participants can explicitly publish only their own result to the
  existing gallery. Battle tallies are frozen context; gallery votes start at
  zero and are independent. Either participant can publish or unpublish their
  card. Their opponent's private identity, caption and snapshot are excluded.
- Challenge captions/media expire seven days after completion, or are withdrawn
  when cancelled. Media endpoints enforce expiry before daily cleanup runs.
  Failed storage deletions remain in a retry queue. Separately approved gallery
  copies remain public until unpublished; previously downloaded public copies
  cannot be recalled.
- Weekly rankings use Monday–Sunday and completion time in America/New_York.
  Monthly favorites count new, currently active gallery upvotes cast this month,
  including older cards. Repeated toggling never earns multiple monthly credits.
  Legacy vote timestamps are unknown, so tracking begins at migration rollout.
- Shared PostgreSQL leases enforce per-user request limits, per-session cooldowns
  and a global provider concurrency cap across Vercel instances. Session memory
  expires after 15 minutes and contains at most eight joke texts, never frames.

### Verification and rollout

Run `npm run test:ego-db`, `npm run test:ego-ui`, `npm run test:ego-receipts`,
`npm run test:roast`, existing gallery/dashboard tests, lint and a production
build. Database tests use isolated PGlite; no live users or photos are required.
After migration installation, start the app and run
`node --conditions=react-server --env-file=.env.local --import tsx scripts/test-ego-live.mjs`
for an API-level flow with disposable accounts and synthetic snapshots. It checks
for the schema before creating fixtures and cleans up its users/media. Set
`EGO_TEST_URL` for an explicitly chosen preview deployment. This does not test
actual model quality or physical camera permissions.

Use a Vercel preview and two consenting test accounts to verify login return to
an invitation, friendship permissions, both approved entries, spectator voting,
finalization, gallery publication, unpublishing and private-media cleanup before
production rollout. Physical-camera behavior and live two-account verification
are separate from automated tests. Request bodies must stay excluded from
hosting logs/error capture.
