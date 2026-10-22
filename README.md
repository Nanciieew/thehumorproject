# checked

Finally, an app that sees the problem.

## Protected administration

`/admin` provides read-only users/profiles and gallery/battle votes, plus saved
media uploads, Seedream generation, caption editing, publication and deletion.
Direct admin uploads accept still JPG/PNG/WebP images up to 2 MB and 24 megapixels,
keeping multipart requests within serverless payload limits.
New media is private by default. Choose its completed-profile owner before
creation; ownership and image bytes cannot be edited afterward. Deletion removes
gallery votes, but database references such as sales prevent deletion. Storage
cleanup failures log their bucket/path for a trusted operator to retry.

Every admin page, API method and preview verifies the Google identity and reads
`profiles.is_superadmin` from the database. API mutations require the same Origin.
Private previews stream through authorized endpoints and admin responses are not
publicly cached. Users/profiles and votes cannot be modified through the admin UI.

Before deploying this version, apply the admin migration using a trusted local
terminal with the existing ignored `.env.local` credentials:

```bash
node --env-file=.env.local scripts/admin-setup.mjs migrate --apply
node --env-file=.env.local scripts/admin-setup.mjs grant nw2615@columbia.edu --apply
node --env-file=.env.local scripts/admin-setup.mjs inspect nw2615@columbia.edu
```

The grant command requires one existing, confirmed Google account with a profile.
There is no public promotion route or email-based runtime bypass. The management
access token is used only by the local setup script, never by app routes. Omit
`--apply` to inspect readiness without changing the database. Future administrator
grants use the same trusted command; ordinary profile forms cannot set the flag.
Google login preserves admin destinations while retaining the normal welcome flow
for other logins. Administrators see an Admin link in their account menu.

Run `npm run test:admin` for database permissions, bootstrap, authorization,
endpoint, media lifecycle and UI checks. Generation tests mock the provider and
incur no AI usage. Production environments also need the existing server-only
Supabase secret, publishable key and Ark credential for generation.

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

The interface uses locally hosted Inter and Anton fonts through `next/font/local`. Their SIL Open Font Licenses are included in `app/fonts`. The interface uses dark ink surfaces, chrome details and acid-yellow accents. The gallery uses one responsive grid, and the sidebar contains Checkly Quest, Checked Gallery, Checked Factory, Get Checked and My Checkboard, in that order.

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

The sidebar’s My Checkboard page keeps the existing `/my-works` URL and caption
editing links. Two responsive cards show all-time upvotes and **Egos uploaded**
(the count of published photos and results). Private saved generations stay in
the collection but do not count as uploaded egos. Revenue is no longer displayed.

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

## Factory original-photo retention

New Checked Factory uploads retain the exact uncaptioned JPG/PNG privately,
alongside the selected finished meme. Unconfirmed or failed batches expire with
their originals; confirmed originals remain after preview cleanup. Existing media
without a retained original cannot be reconstructed automatically.

The new nullable `images.original_storage_path` column points to the original
file in the private `generated-images` Supabase Storage bucket. The matching
`factory_batches.original_storage_path` tracks it during generation. Confirmation
links the original to the selected media record, and whole-record deletion removes
both the original and finished files. No user-interface changes are included.

Apply `supabase/migrations/20261022000000_factory_originals.sql` after the Factory
migration. The trusted local command
`node --env-file=.env.local scripts/factory-originals-migrate.mjs --apply` installs
and verifies it without printing credentials. `npm run test:factory` covers exact
original bytes, retention after confirmation and preview expiration, and cleanup
of failed or abandoned generations.

## Get Checked performance

Get Checked keeps Gemini for the roast and Seedream for the finished image.
Face tracking initializes while camera permission and startup are pending, after
explicit consent and Start. Uploads still require a ready tracker and exactly one
participant. A successful roast releases its database lease once; provider failures
still release it, and failed releases retry cleanup. The interface shows
“Generating your image…” until the final Seedream result is available.

Inspect the `Server-Timing` response header on `/api/roast` and `/api/roast/meme`
in browser Network tools. Server logs marked `[get-checked]` contain the same
durations in milliseconds: authentication, lease acquire/finish or error cleanup,
Gemini, Seedream, image download, compression, and total handler time. Each route
reports only its own stages; these timings exclude browser camera/model startup,
request/response transfer, and image display. Logs contain no account identifiers,
captions, snapshots, keys, or image URLs. Provider model, prompt, resolution, and
image quality settings are unchanged. `npm run test:roast` includes mocked pipeline
checks without paid provider calls.

## checked — deployment and new competition features

checked replaces the home gallery with **Get Checked**, the consent-first
webcam roast experience. Each click requests one roast attempt, then pauses until
the user chooses “Hurt my feelings again.” A completed live roast reveals the
**Challenge a friend** button in the top-right corner of the camera display; it
opens the snapshot preview and audience approval controls. **Publish my ego**,
beside it, publishes a solo snapshot and verified roast to Checked Gallery after
separate public-sharing approval. Solo gallery cards start with zero votes, need
no opponent, and do not count as active battles. Retries reuse the same card.
Run `npm run test:roast-publication` for receipt and publication concurrency checks. Skips, errors, cancellation and changes
to settings never start another attempt automatically. Signed-out visitors see a dark mirror landing page.
The guest mirror requests browser camera permission on arrival, with a retry button
if the browser blocks or defers the prompt. It sends no frames to the server or Gemini, requests no audio,
and releases the camera on Stop, page hiding, or navigation.
Run `npm run test:guest-ui` for this guest camera lifecycle. The existing photo feed is now `/gallery` (**Public
Evidence**); `/you-are-a-joke` redirects home. `/challenges` is **The Arena**,
`/leaderboard` is **Hall of Shame**, followed in navigation by **My Checkboard**
(`/my-works`). The standalone Friends page has been removed. Existing friend
relationships remain available in the challenge picker.
All public and signed-in pages share the dark ink, chrome and acid-yellow design.
The existing dashboard keeps its actual photo/vote/revenue calculations.
Marketplace and the former Image Studio remain removed. `/disguise` is the **Checked Factory** meme-caption page.

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


## Checked Factory

The signed-in `/disguise` upload page accepts a still JPG/PNG meme picture up to 2 MB through the file picker or drag-and-drop, plus an optional keyword. Clicking Create meme opens `/disguise/preview`, where the generated image appears on the left and five caption choices on the right. The shared factory layout preserves the upload and generation request across navigation. Both screens fit the viewport; on phones, the preview sits above the compact caption choices. There are no numbered steps or provider-consent checkbox. The Create meme action starts generation: Gemini (`GEMINI_API_KEY`, `GEMINI_MODEL`) writes five distinct, image-specific captions with sharper sarcasm, absurd escalation, and different comedic premises. A deterministic server renderer places each caption on the original picture. Checked Factory does not call Doubao or any image-generation model: the subject, background, existing text, framing, and native display dimensions are retained. The renderer bundles Anton and converts its glyphs to vector outlines, eliminating system-font substitution. All captions use the same white fill, black outline, uppercase type, fixed line spacing, and bottom baseline. The locked design scale is 48-pixel type, a 6-pixel outline, 58-pixel line spacing, and 40-pixel bottom inset per 1,000 pixels of the original’s shorter edge. That one scale applies to every caption; font size never changes to fit text. Captions wrap to at most three lines. If needed, Gemini is asked once for shorter copy instead of changing the typography. Only the text overlay is composited, and lossless WebP retains every pixel outside its footprint. Publication copies those same bytes into the gallery without resizing or lossy recompression.

The five previews are held privately in `generated-images/<user>/factory/<batch>/<index>.webp`, with owner-scoped metadata in the server-only `factory_batches` table. Switching caption choices only swaps cached previews and makes no new model request. The browser preloads those images and remembers only the batch ID in account-scoped session storage; uploaded picture data stays in browser memory until generation. A camera snapshot can still transfer from Get Checked through the existing short-lived in-memory draft.

Apply `supabase/migrations/20261019000000_factory_batches.sql` before using the factory. With a valid management token in `.env.local`, run:

```sh
node --env-file=.env.local scripts/factory-migrate.mjs --apply
```

The separate Publish to gallery action confirms public sharing. An atomic batch claim fixes one caption, creates one private `images` record, and publishes it through the existing gallery pipeline. After publication, the other four previews are deleted; only the keeper appears in My Checkboard. Duplicate publication and cleanup retries reuse the same image ID. Cleanup failure remains visible and retryable, including after restoring a batch. One active generation per account prevents overlapping generation jobs. If any image fails, all partial outputs are removed after the other jobs settle.

Previews expire after 24 hours. The existing authenticated daily maintenance cron retries expired/abandoned cache deletion and preserves private originals of already published memes. Starting another batch discards the previous previews. Cancelling invalidates late UI results, aborts the generation request, and asks the server to discard its batch.

Run `npm run test:factory` for UI, provider orchestration, account isolation, selection races, failed generation, cleanup retries, and database privacy checks. These tests use fixtures and do not incur provider charges. The older `test:disguise` and legacy single-image API remain available for regression checks; `scripts/test-disguise-live.mjs` exercises only that legacy API.

## Checkly Quest

Signed-in users land on the Checkly Quest dashboard at `/`, with a weekly completion timeline, current streak and quest upvote/downvote totals. A dismissible welcome invitation appears after login and links to the separate voting page at `/quest`. The dashboard also has a daily quest button. Completing any nonempty quest batch marks the day complete; continuing to vote does not add another completed day. The streak includes yesterday until today ends, so an unfinished current day does not prematurely reset it. Quest history is account-scoped browser storage, local to the browser; it does not sync across devices. Days use New York calendar dates. Memes follow the shared gallery’s newest-publication order. Right arrow, right swipe, and Upvote save an upvote; left arrow, left swipe, and Downvote save a downvote through `/api/gallery/vote`. Only successful saves advance progress. Each batch includes up to 10 memes, with a completion message and Keep on going to rate another batch without repeating that day’s rated memes. Browser storage retains progress per account and New York calendar day; progress is local to that browser. Checked Gallery refreshes on entry after quest voting and uses the same persisted votes. The roast studio is available at `/you-are-a-joke`. Arena, Hall of Shame and internal test pages have been removed from the app.

Run `npm run test:daily-quest` for voting, swipes, short feeds, continuation, retry, and progress restoration checks.

## Page loading performance

Page decorations use cropped WebP derivatives in `public/page-art` with content-hashed filenames and one-year immutable caching. The approved PNG sources remain available for future edits. `node scripts/optimize-page-art.mjs` regenerates derivatives; update the asset references if their hashes change. Public meme cards use responsive Next.js image optimization, restricted to this project's public `gallery-photos` bucket. Private Checkboard cards use an owner-checked thumbnail endpoint with bounded sizes and browser-only caching; full originals remain available in the editor.

Gallery enrichments run concurrently and author photo URLs are signed in one batch. User verification is reused during server rendering. The shell, account photo and meme collections have separate streaming boundaries, with a clean loading screen and a centered spinner. Checkboard uses its server-provided first page without immediately fetching it again; sorting, focus, vote events and periodic updates still refresh the collection.

The additive `20261020000000_owned_works_page.sql` migration moves Checkboard sorting, totals and pagination into one server-only database call. With the existing management credential, install it with `node --env-file=.env.local scripts/performance-migrate.mjs --apply`. The application retains a compatibility fallback for projects where the migration has not yet been installed.

Run `npm run test:performance`, `npm run test:checkboard`, `npm run test:gallery-ui`, `npm run test:daily-quest`, lint and a production build. For HTTP streaming and cache measurements, start a production server and run `node scripts/benchmark-pages.mjs http://127.0.0.1:3001`. This script makes guest requests and reports when the Gallery shell and cards arrive; it does not measure browser LCP, signed-in navigation or mobile network performance.
