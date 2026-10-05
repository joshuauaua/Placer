# Supabase — getting the survey, Toolkit rooms, accounts and the map live

The survey works with no backend at all: with either environment variable below
missing, responses stay in the browser's localStorage. Everything in steps 1 to 7
is about switching that over to a real table.

Three features cannot fall back that way. Toolkit rooms (step 8), because a room is
shared between devices; without a project they are simply not offered, and the
Toolkit works as it always did. Accounts (step 9), because there is nowhere to keep
one; without a project the app uses the localStorage identity it used before accounts
existed — a display name on this device, no password, nothing to sign in to. And the
community map (step 10): without a project, posting saves to this browser exactly as
it always did, and "Post to community" reaches nobody. All three degrade rather than
break, and the whole test suite runs in exactly that state.

## 1. Create the project

Any Supabase project will do, but **pick an EU region**. The GDPR and privacy
pages state that survey answers are "stored in a Postgres database hosted by
Supabase in the EU". If you host elsewhere, change that wording in
`src/components/GdprPage.jsx` and `src/components/PrivacyPage.jsx` first.

## 2. Create the table

Dashboard → SQL Editor → New query → paste `schema.sql` → Run. It is safe to
re-run. It creates `public.survey_responses`, enables row-level security, and
adds exactly one policy: the `anon` role may INSERT and nothing else.

## 3. Collect the two values

Dashboard → Project Settings → API:

| Value | Where it goes |
| --- | --- |
| Project URL | `VITE_SUPABASE_URL` |
| Project API keys → `anon` / `public` | `VITE_SUPABASE_ANON_KEY` |

The `anon` key belongs in the bundle — it is a public identifier, and the table
is protected by the policy rather than by hiding the key. **Never** put the
`service_role` key in a `VITE_` variable: everything so prefixed is compiled into
the JavaScript the browser downloads, and that key bypasses row-level security.

## 4. Configure locally

Add both to `.env` (already gitignored), then **restart the dev server** — Vite
reads `VITE_` variables at build time, so hot reload will not pick them up.

## 5. Configure the deployment

Vercel → Project → Settings → Environment Variables → add both to Production and
Preview → **then redeploy**. Setting them alone changes nothing, for the same
build-time reason.

## 6. Verify

Submit the survey, then in the SQL editor:

```sql
select submitted_at, source, email, answers
from public.survey_responses
order by submitted_at desc
limit 1;
```

To check the policy without the app, from a shell with both values exported:

```sh
# Expect 201 Created.
curl -i "$VITE_SUPABASE_URL/rest/v1/survey_responses" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"source":"curl_check","answers":{"note":"delete me"}}'

# Expect 200 with an empty array: the anon role can insert but never read back.
curl -s "$VITE_SUPABASE_URL/rest/v1/survey_responses?select=id" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY"
```

An empty array from the second call is the policy working, not a failure. If the
first call returns 401 or a row-level security error, `schema.sql` has not run.

## 7. Read the results

`queries.sql` has the useful ones, including scoring the ranked question by the
position each feature was placed in.

## 8. Toolkit rooms

Optional, and separate from the survey. A facilitator opens a room on a Toolkit
tool; people join it with a six-digit PIN or by scanning its QR code, and
their answers are combined live. Without this the Toolkit still works — every
tool runs on its own in the browser, and the "Start a room" button simply
never appears.

**Opening a room takes an account. Joining one never does.** Opening creates
something other people are invited into, so it needs somebody accountable for it;
joining is what a participant does with a QR code in a workshop, and asking them to
make an account at that moment would cost the room the people it was opened for. This
means step 9 as well, if you want the "Start a room" button to work at all — without
accounts configured, a signed-out facilitator gets "Sign in to start a room" and no
further.

Run `rooms.sql` in the SQL editor, the same way as `schema.sql`. It is
re-runnable. Only Budget Ballot can host a room today; the tools allowed to
are enumerated in a CHECK constraint in that file, and adding a second one means
editing both it and `src/toolkit/tools.js`.

The access rules are deliberately unlike the survey's. Joining a room needs a
*read*, which nothing else here has, so instead of a select policy on the rooms
table — which would make every PIN enumerable — all of it goes through
`security definer` functions, and the anon role is granted nothing at all on
`toolkit_rooms`.

Of those functions, `toolkit_room_create` is the only one the anon role may not
execute — that grant is where "opening takes an account" is actually enforced, rather
than in the button. `toolkit_rooms.created_by` records which account opened each room,
and is nulled rather than cascaded if that account is later deleted: a room holds other
people's contributions, and those are not the facilitator's to take with them.

Verify with:

```bash
# No rows, and no error: there is no select policy on this table at all.
curl -s "$VITE_SUPABASE_URL/rest/v1/toolkit_rooms?select=id" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY"

# An unknown PIN is an empty result, not an error. Joining needs no account, so this
# works with nothing but the anon key.
curl -s "$VITE_SUPABASE_URL/rest/v1/rpc/toolkit_room_join" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_pin":"000000"}'

# Opening one does need an account, so the same key alone must be refused here —
# expect a 403 and "permission denied for function toolkit_room_create".
curl -s "$VITE_SUPABASE_URL/rest/v1/rpc/toolkit_room_create" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_tool":"budget-ballot"}'
```

Live updates need the `supabase_realtime` publication, which `rooms.sql` adds the
table to. If it reports that the publication does not exist, rooms still work —
the totals just stop moving on their own and need a reload.

**Rooms expire, and the sweep is not optional.** A room stops working two hours
after it is opened, or as soon as its facilitator closes it. That much is enforced
by the predicates in `rooms.sql`, so an expired room is already unreachable. But
the rows stay until something deletes them, and the GDPR page says room data "is
deleted within a day of the room ending" — so **run `rooms-cleanup.sql` too**. It
schedules an hourly `pg_cron` job, and needs pg_cron enabled under
Database → Extensions. Without it, rooms still expire correctly; the data simply
is not deleted, and that sentence on the GDPR page stops being true.

To change the two hours, edit the default on `expires_at` in `rooms.sql` and re-run
it — the interval is written in exactly one place for a plain room. A project can open
one for longer; see "Rooms that stay open for weeks" under step 12. Then change the retention row on
the GDPR page and the paragraph on the privacy page, both of which name it.

**A PIN is guessable.** Six digits is a million combinations, the publishable key
is in every visitor's bundle, and with no server in front there is nowhere to rate
limit. An open room can therefore be found by enumeration and joined by someone
who was not in the workshop. That is an accepted trade for an ephemeral,
non-binding tool — and a reason to close rooms rather than leave them open.

## 9. Accounts

Optional, and separate from both the survey and the Toolkit. Without it people can
still browse, draw, and open Toolkit rooms; what they cannot do is post an
imagination, because a posted imagination belongs to an account.

Run `auth.sql` in the SQL editor, the same way as `schema.sql`. It is re-runnable.
It creates `public.profiles` — one row per account, holding the display name, bio,
location and avatar icon — and the trigger on `auth.users` that fills it in the
moment an account exists.

If `public.profiles` already exists from before location and avatar were added,
re-running `auth.sql` is still all that is needed: the two columns are added with
`add column if not exists`, the same way `imaginations.sql` evolves a live table.

Supabase Auth itself needs no SQL: it owns the email address, the password hash and
the Google identity, and none of that is ours to store. What it does need is
configuration in the dashboard, and this is the part that is easy to miss, because
everything appears to work until the very last step of a sign-in.

**Authentication → Providers → Email.** Enabled, with **Confirm email on**. With it
off, anyone can own public content under an address they cannot read.

**Authentication → Providers → Google.** Enabled, with a client ID and secret from a
Google Cloud OAuth 2.0 **Web application** client. In Google Cloud, the authorised
redirect URI is Supabase's, not the app's:

```
https://<project-ref>.supabase.co/auth/v1/callback
```

Google talks to Supabase; Supabase talks to the app. Getting these the wrong way
round is the most common way for this to fail.

**Authentication → URL Configuration → Redirect URLs.** Every URL the app can be
sent back to has to be listed here or Supabase refuses the redirect. The app uses
one path for all three cases — the confirmation link, the Google return leg and the
password reset — so the list is short:

```
http://localhost:5173/auth/callback
https://<your-production-domain>/auth/callback
https://*-<your-vercel-scope>.vercel.app/auth/callback
```

The third is for preview deployments; leave it out if you do not need sign-in to
work on them. `vercel.json` already rewrites every path to `index.html`, so
`/auth/callback` needs nothing else.

**Email delivery.** The built-in SMTP sender is rate limited to a handful of
messages an hour and is meant for development. Confirmation and reset emails are the
only way into an account, so configure a real SMTP sender under
Authentication → Emails before anyone but you is signing up.

### Verify

```sql
-- RLS on, and the two owner-scoped policies:
select relname, relrowsecurity from pg_class where relname = 'profiles';
select policyname, cmd, roles from pg_policies where tablename = 'profiles';

-- After signing up once: one profile per account, and nobody without a name.
select u.email, u.confirmed_at, p.display_name
  from auth.users u left join public.profiles p on p.id = u.id
 order by u.created_at desc;
```

Then, that the profile really is private — with the anon key and no session there is
no policy that matches, so this returns an empty array rather than an error:

```sh
curl -s "https://<project-ref>.supabase.co/rest/v1/profiles?select=display_name" \
  -H "apikey: <anon key>"
# []
```

An empty array is the policy working. Rows come back only for the account whose
session is attached, which is why the app never joins a stranger's profile: the
author's name is copied onto each imagination when it is posted instead.

**Invite codes, during the beta.** Run `invites.sql` after `auth.sql`. From then
on a new account needs a code from `public.invite_codes`, checked by a trigger on
`auth.users` — existing accounts sign in as before. Codes are made in the SQL editor
(examples at the end of that file). New Google or Apple accounts are refused, since a
provider sign-in cannot carry a code, and so is the dashboard's "Add user". When the
beta ends, `drop trigger invite_code_on_new_user on auth.users;` opens signups again.

**A confirmation email cannot be un-sent.** Somebody who signs up with a typo'd
address owns an account they can never confirm and never delete. Nothing in the app
handles that yet; it needs the SQL editor.

## 10. The community map

Requires step 9 — a posted imagination belongs to an account. Run `imaginations.sql`
in the SQL editor after `auth.sql`. It is re-runnable, and unlike the other files it
also creates its own Storage bucket, so there is nothing to press in the dashboard.

It creates `public.imaginations`, public to read and owner-only to write; the
`imagination-previews` bucket, public, with writes confined to a folder named after the
account doing the writing; and `imagination_upvote()`, which raises a vote count without
handing out write access to somebody else's row.

The composited image does not go in a column. A preview is a few hundred KB of JPEG, and
a column would mean every read of the map dragging every picture with it, so the row
keeps a path of the form `<user_id>/<imagination_id>.jpg` and the bytes go to the bucket.
The extension is not always `.jpg`: the app exports PNG when a Street View capture failed,
because JPEG has no alpha and a transparent canvas would flatten to solid black.

**Imaginations already in a browser are left there.** They were made under a privacy
policy that said they would never leave the device, so nothing uploads them. The profile
page lists them separately under "Saved on this device" and says plainly that nobody else
can see them. An opt-in "publish this" button is the obvious next step and does not exist
yet.

### Verify

```sql
-- RLS on, one public select and three owner-scoped write policies:
select relname, relrowsecurity from pg_class where relname = 'imaginations';
select policyname, cmd, roles from pg_policies where tablename = 'imaginations';

-- The bucket, and the four policies on it:
select id, public from storage.buckets where id = 'imagination-previews';
select policyname, cmd from pg_policies
 where tablename = 'objects' and policyname like '%imagination preview%';
```

Reading is meant to be open, so unlike `profiles` this comes back with rows rather than
an empty array:

```sh
curl -s "https://<project-ref>.supabase.co/rest/v1/imaginations?select=title,author_name" \
  -H "apikey: <anon key>"
```

Writing is not. This must be refused — there is no session, so no `auth.uid()` for the
insert check to match:

```sh
curl -s -X POST "https://<project-ref>.supabase.co/rest/v1/imaginations" \
  -H "apikey: <anon key>" -H "Content-Type: application/json" \
  -d '{"user_id":"00000000-0000-0000-0000-000000000000","author_name":"x","title":"x"}'
```

**Votes can be cast repeatedly.** Nothing records who voted, and the key is in every
bundle, so the button counts every press. Read the number as a rough signal of interest,
not a count of people. Fixing it means a votes table with one row per account per
imagination — which also means signed-out visitors stop being able to vote at all.

## 11. Following

Requires step 9 — a follow belongs to an account. Run `follows.sql` in the SQL editor
after `auth.sql`. It is re-runnable.

It creates `public.follows`, one generic table for the four things a profile can follow
— users, imaginations, projects, and cities — rather than four separate ones. Every row
carries its own label rather than joining out to one, because cities still have no table
of their own (and a follow on a stranger's account must not join out to their private
profile either) — this way 'city' rows do not need a different shape from the other
three. See the comment at the top of `follows.sql` and of `src/services/follows.js` for
the full reasoning.

People, projects (step 12) and organisations (step 18) each have a Follow button on
their public page, and the dashboard lists what an account follows. Cities still have
no page to follow one from. Following organisations needs `follows-organisations.sql`,
which lets them into `follows_type_known`, takes a closed organisation off everyone's
followed list, and tells an organisation's followers when a project is started in its
name (an Activity notification — see step 13).

**Followers and following are public** since `profile-social.sql`: a profile shows how
many follow it and how many people, organisations and projects it follows, each opening
a list, and which organisations it is an admin of. The `follows` and
`organisation_admins` tables keep their owner-only policies; four security definer
functions answer for one profile at a time, the same shape as `profile_public()`.

### Verify

```sql
select relrowsecurity from pg_class where relname = 'follows';
select policyname, cmd, roles from pg_policies where tablename = 'follows';
```

Expect `rls` true, and one SELECT, one INSERT and one DELETE policy, all for
`{authenticated}`.

## 12. Projects

Requires steps 9, 10 and 8 (in that order — it references profiles, imaginations, and
toolkit rooms) — see `projects.sql`'s own header for why. Run `projects.sql` in the SQL
editor after all three. It is re-runnable, except for the caveat about `toolkit_rooms`
just below.

It creates `public.projects`, `public.project_collaborators` and `public.project_links`,
adds a nullable `project_id` to both `public.imaginations` and `public.toolkit_rooms`,
and replaces `toolkit_room_create` with a version that takes an optional project id — a
plain `toolkit_room_create(p_tool)` call behaves exactly as before, which is what
keeps the Toolkit gallery's ordinary, unattached rooms unaffected. It also adds
`project_toolkit_activity`, a narrow public function that hands back a bare session
count for a project's public page — the one number worth showing from a table
(`toolkit_rooms`) that otherwise grants nothing to anon or authenticated at all.

Scope choices — the ones worth knowing about before reading the SQL — are in the file's
own header: locations are free-text place names rather than geocoded points, and
collaborators are invited by email through `project_add_collaborator` because nothing in
PLACER lets one account look another up.

**The `toolkit_room_create` re-run is not harmless if a room is open.** Dropping and
recreating the function does not touch `toolkit_rooms` rows, so nothing already open is
lost — but a facilitator's browser is holding the *old* function's shape in memory only
in the sense that it is about to call it; PostgREST resolves the call fresh every time,
so this is safe to run at any moment, including mid-workshop. Mentioned here because
`rooms.sql`'s own header raises exactly this caution about the return type changing, and
it does not apply here — only the parameter list does, and a default-valued extra
parameter is backwards compatible for every existing caller.

### Verify

```sql
select relrowsecurity from pg_class where relname in ('projects', 'project_collaborators', 'project_links');
select policyname, cmd, roles from pg_policies where tablename in ('projects', 'project_collaborators', 'project_links');

select column_name from information_schema.columns
 where table_name in ('imaginations', 'toolkit_rooms') and column_name = 'project_id';
```

Expect `rls` true on all three new tables, a public SELECT policy on `projects` and
`project_links`, and `project_id` present on both `imaginations` and `toolkit_rooms`.

Then, that reading a project really is public — with nothing but the anon key this
returns rows rather than an empty array:

```sh
curl -s "https://<project-ref>.supabase.co/rest/v1/projects?select=name,owner_name" \
  -H "apikey: <anon key>"
```

### Rooms that stay open for weeks

Requires step 12. Run `rooms-lifetime.sql` in the SQL editor after `projects.sql`. It is
re-runnable.

A room can then be opened for 2 hours (the default, unchanged), 1 week, 30 days or 90
days — for a poll whose QR code goes on a poster rather than a screen. The rules, all
enforced in the database:

- Only those four lifetimes are accepted, and a check constraint caps every room at 90
  days whatever calls the function.
- Anything longer than two hours has to belong to a project, so there is always an
  owner who can find it again. The project dashboard lists its open rooms through
  `project_rooms` (owner or collaborator only), with each room's QR code, response
  count, and Open, Download QR and Close — from any browser, not only the one that
  opened it.
- A long room is joined through `toolkit_room_join_code` with a 32-character code,
  which is what its QR link carries. `toolkit_room_join` no longer answers for a long
  room's PIN, because six guessable digits are not fit to leave open for months (see
  "A PIN is guessable" in step 8). A code for a room that has ended says when it
  ended, so a poster scanned after its poll closed tells people so.

The sweep in `rooms-cleanup.sql` needs no change: it goes by `expires_at`, so a long
room is deleted a day after it ends like any other. The privacy page already names the
90-day ceiling — change it there too if you change it here.

### Deleting a project

Requires step 11 and step 12. Run `project-delete.sql` in the SQL editor after
`projects.sql` and `follows.sql` (or `supabase db push`). It is re-runnable.

An owner deletes a project from the bottom of its dashboard. The database already
takes its collaborators, links and view counts with it, and leaves the imaginations
and Toolkit rooms made for it in place, unlinked. The client removes its image from
R2. This file adds the one missing piece: a trigger that deletes everybody's follows
of the project, which nothing cascades to because `follows.followed_id` is a string
rather than a foreign key.

```sql
select tgname from pg_trigger where tgrelid = 'public.projects'::regclass
   and tgname = 'projects_delete_follows';
```

### Deleting a Toolkit room

Requires step 8. Run `rooms-delete.sql` in the SQL editor after `rooms.sql` (or
`supabase db push`). It is re-runnable.

It adds `toolkit_room_delete`, which removes a room and every contribution in it at
once instead of waiting for the sweep. Like `toolkit_room_close` it takes the
facilitator token, so only the browser that opened the room, or the project dashboard
of the project it belongs to, can delete it.

```sql
select proname from pg_proc where proname = 'toolkit_room_delete';
```

## 13. Notifications

Requires steps 9, 10, 11 and 12 (in that order — it references profiles, imaginations,
follows, projects and toolkit rooms). Run `notifications.sql` in the SQL editor after
all four. It is re-runnable.

It creates `public.notifications` and `public.notification_preferences`, and five
trigger functions that write a notification the moment the thing it is about happens: a
comment or an upvote on your own imagination (Engagement), somebody following your
profile (Follower), and a followed user or project posting a new imagination or closing
a Toolkit room (Activity). Nothing writes to `notifications` directly — like
`toolkit_rooms`, it has row-level security on and no INSERT policy at all, so the
triggers, running security definer, are the only door in. System alerts have no trigger
yet; the category exists in the check constraint for when something calls for one.

Every trigger checks `notification_wants()` first, so a category switched off in
`notification_preferences` is never written, not just hidden after the fact. A missing
preferences row (nobody has opened Settings) defaults every category on, matching the
column defaults.

**Email is not sent.** `notification_preferences` has an `_email` column next to every
`_inapp` one so Settings has somewhere to save the choice, but nothing in this file, or
in `src/services/notifications.js`, sends mail. Resend is wired up later against these
same columns.

### Verify

```sql
select relrowsecurity from pg_class where relname in ('notifications', 'notification_preferences');
select policyname, cmd, roles from pg_policies where tablename in ('notifications', 'notification_preferences');
select tgname from pg_trigger where tgrelid = 'public.notifications'::regclass and not tgisinternal;
```

Expect `rls` true on both tables; `notifications` with one SELECT, one UPDATE and one
DELETE policy and no INSERT; `notification_preferences` with SELECT, INSERT and UPDATE;
and no triggers listed on `notifications` itself — they live on the five tables that
cause a notification, not on the table that receives one.

## 14. Pictures on Cloudflare R2

Requires steps 9, 10 and 12 — for the profile covers and photos, the imagination
previews, and the project images. Supabase keeps the tables and the accounts; the
files themselves live in an R2 bucket. The R2 keys never reach the browser.

- **Re-encoded before upload.** Every picture is decoded, scaled and encoded afresh as
  WebP in the browser (`src/lib/imageEncode.js`): a 512px square avatar, a cover up to
  1920px, a project image up to 1600px. That drops all metadata — including the GPS
  location a phone photo carries — and brings a typical picture down to 40–300 KB.
- **Checked on upload.** The browser writes through the `media` Edge Function
  (`supabase/functions/media`), which checks the Supabase session and only writes keys
  under the caller's own id (`previews/<user id>/…`, `covers/<user id>/…`,
  `avatars/<user id>/…`), under a project they can edit (`projects/<project id>/…`,
  checked with `project_can_edit()`), or under an organisation they are an admin of
  (`organisations/<organisation id>/…`, see step 18). It reads each upload's bytes: only a real JPEG,
  PNG or WebP is stored, with the type the function found rather than the one the
  browser claimed, and within a size limit per folder (1 MB avatars, 3 MB covers and
  project images, 5 MB previews).
- **50 MB per account.** An upload is refused if it would take the account past 50 MB
  in all — its own folders plus the images of the projects it owns. A project image
  counts against the project's owner, whoever uploads it.
- **Old pictures are removed.** Uploading a cover, profile photo or project image
  deletes the older ones in that folder, keeping the new one and the one the row
  currently uses; deleting an imagination or a project deletes its picture.

**In Cloudflare**

1. The bucket. Create it with **Specify jurisdiction -> European Union** if the
   privacy page's "stored in the EU" is to stay true. A *location hint* such as
   "Eastern Europe (EEUR)" is not the same thing — it is a preference, not a
   guarantee. Jurisdiction is chosen at creation and cannot be changed afterwards.
2. Settings -> Public access -> connect a **custom domain** (e.g. `media.<your-domain>`).
   The `r2.dev` address is rate-limited and not meant for production.
3. No CORS policy is needed: the browser never talks to the bucket's S3 endpoint, only
   to the function and to the public domain. Remove one if it was added earlier.
4. R2 -> Manage API tokens -> an **Object Read & Write** token scoped to this bucket
   only. Keep the Access Key ID and Secret Access Key; the account ID is on the R2
   overview page.

**In Supabase**

```sh
supabase secrets set R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… R2_BUCKET=…
# Only for an EU-jurisdiction bucket, whose endpoint is <account>.eu.r2.cloudflarestorage.com:
supabase secrets set R2_JURISDICTION=eu
supabase functions deploy media
```

Then run `media-r2.sql` and `media-photos.sql` in the SQL editor (or `supabase db push`).
The second adds `profiles.avatar_path`, `projects.image_path` and `project_can_edit()`. It drops the
storage policies of the two old buckets, clears the preview and cover paths that
pointed into them, and adds a check that a row can only point into its owner's folder.
Finally delete the `imagination-previews` and `profile-covers` buckets in
Dashboard -> Storage; Supabase does not allow that from SQL.

**In the app**

Set `VITE_MEDIA_URL` to the custom domain, locally and in Vercel. It is the only R2
value the frontend knows.

### Verify

Upload a cover in Settings. The network tab should show one `POST …/functions/v1/media`
answered `200` with the new key, and the cover should load from `VITE_MEDIA_URL`. A
file that is not a JPEG, PNG or WebP — whatever its name says — answers `415`. Signed
out, the function answers `401`; a key under somebody else's id answers `403`.

## 15. Survey responses in Slack

Optional. Requires step 2. Each new row in `survey_responses` is posted to a Slack
channel by the `survey-to-slack` Edge Function (`supabase/functions/survey-to-slack`),
with the form it came from, the email, and the contact details if any were given.

**In Slack**

1. Create the channel, e.g. `#survey-responses`.
2. api.slack.com/apps -> Create New App -> From scratch -> **Incoming Webhooks** -> on ->
   Add New Webhook to Workspace -> pick the channel. Keep the URL; anyone holding it can
   post to that channel.

**In Supabase**

```sh
supabase secrets set SLACK_WEBHOOK_URL=https://hooks.slack.com/services/… \
  SURVEY_WEBHOOK_SECRET=$(openssl rand -hex 32)
supabase secrets list   # note the secret's value is not shown — keep your own copy of it
supabase functions deploy survey-to-slack
```

Then, in the SQL editor, put the same secret in Vault and run `survey-slack.sql`, which
adds an insert trigger that calls the function through `pg_net`:

```sql
select vault.create_secret('<same value as SURVEY_WEBHOOK_SECRET>', 'survey_webhook_secret');
```

(The dashboard's Database Webhooks do the same thing, if your dashboard shows them — use
one or the other, not both, or every response posts twice.)

The function refuses any call without that header, so the public function URL cannot be
used to post into the channel. Everything in a row came from an anonymous visitor, and
the function escapes it before it reaches Slack, so a response cannot `@channel` anyone.

**Everyone in the channel sees respondents' emails.** Keep the channel private and small,
and remember it when answering an erasure request: deleting the row does not delete the
Slack message.

### Verify

Submit the survey; a message should appear within a second or two. If not, look at the
webhook's calls:

```sql
select created, status_code, content from net._http_response order by created desc limit 5;
```

`401` means the header does not match the secret; `500 not configured` means a secret is
missing; `502` means Slack refused the post (usually a revoked webhook URL). Slack being
down loses that one message but never the response itself, which is already saved.

## 16. Bug reports in Slack

Optional. Requires step 15. Each new row in `bug_reports` is posted by the same
`survey-to-slack` function, with the message, the page it was sent from and the
browser's user agent. The reporter's account is left out of the message.

By default it posts to the survey channel. To send bug reports to a channel of their
own, add a second Incoming Webhook for that channel and set it:

```sh
supabase secrets set SLACK_BUG_WEBHOOK_URL=https://hooks.slack.com/services/…
supabase functions deploy survey-to-slack
```

Then run `bug-reports-slack.sql` in the SQL editor. It reuses `survey_webhook_secret`
from Vault, so there is nothing new to store there.

### Verify

Send a report from the "Report a bug" button; a message should appear within a second
or two. If not, check `net._http_response` as in step 15 — the status codes mean the
same things.

## 17. Toolkit submissions in Slack

Optional. Requires step 15. The Toolkit's **Contribute** button opens a form asking for a
tool's title, a description and an email address; each one is a row in
`tool_submissions` (`tool-submissions.sql`, also a migration), posted by the same
`survey-to-slack` function. The submitter's account is left out of the message.

By default it posts to the survey channel. To send submissions to a channel of their
own, add another Incoming Webhook for that channel and set it:

```sh
supabase secrets set SLACK_TOOL_WEBHOOK_URL=https://hooks.slack.com/services/…
supabase functions deploy survey-to-slack
```

Then run `tool-submissions-slack.sql` in the SQL editor. It reuses `survey_webhook_secret`
from Vault, so there is nothing new to store there.

**Everyone in the channel sees submitters' emails**, the same as step 15.

### Verify

Send a submission from `/toolkit` -> Contribute; a message should appear within a second
or two. If not, check `net._http_response` as in step 15 — the status codes mean the
same things.

## 18. Organisations

Requires steps 9 and 12 — an organisation is run by accounts, and projects can be run
in its name. Run `organisations.sql` in the SQL editor after `projects.sql` (or
`supabase db push`). It is re-runnable.

It creates `public.organisations` (public to read, like a project), the
`organisation_admins` roster, and `organisation_former_admins`, and adds a nullable
`organisation_id` to `public.projects`. The rules are enforced in the database rather
than the app: whoever creates an organisation is its first admin; any admin can add
another by email, remove one, leave, edit it, or close it (delete it, which leaves its
projects in place with no organisation); only an admin can start a project in its name;
and an organisation always keeps at least one admin, so the last one cannot leave.

The one way around that is the last admin's account being deleted. The organisation is
then unadministered (`unadministered_since` is set), nobody can change it, and any
account that used to be one of its admins can claim it back from its public page. If
nobody who could claim it is left, closing it takes the SQL editor.

Organisations are created from Settings, which also lists the ones you run.

**Cover images.** Run `organisation-covers.sql` after `organisations.sql`, and redeploy
the `media` function (`supabase functions deploy media`) — both are needed. It adds
`organisations.cover_path`, pointing into `organisations/<organisation id>/` in the R2
bucket, where any of the organisation's admins may write (the function asks
`organisation_is_admin()`). The limits are the same as a profile cover's: the browser
takes a file of up to 30 MB and re-encodes it to at most 1920px across, and the function
refuses anything still over 3 MB. The folder keeps at most two, and closing the
organisation deletes its cover. The uploading admin needs room under their own 50 MB
for it, but it is not counted against anyone afterwards; the folder's own limit bounds it.

**Addresses.** Run `organisation-address.sql` after `organisations.sql`. It adds
`organisations.address` and the point it is at (`location_lat`, `location_lng`, both
or neither). The setup form suggests addresses from Google Places as one is typed; the
one chosen is kept with its point, and its town and country fill in `location`, which
the public page shows. Explore pins an organisation on that point, and falls back to
geocoding the address or `location` text for one saved without it. All of it is public,
like the rest of the row.

It replaces the Individual / Organisation account type in Settings, which is gone from
the app. `profiles.account_type` is left in place so nothing saved is lost.

### Verify

```sql
select relrowsecurity from pg_class
 where relname in ('organisations', 'organisation_admins', 'organisation_former_admins');
select policyname, cmd, roles from pg_policies
 where tablename in ('organisations', 'organisation_admins');
```

Expect `rls` true on all three; SELECT, INSERT, UPDATE and DELETE policies on
`organisations`, one SELECT on `organisation_admins`, and none on
`organisation_former_admins`, which only the functions read.

## Still to decide

- **Projects have one role beyond the owner, not several.** A collaborator can edit
  setup, links and open a Toolkit room; only the owner manages the roster or deletes
  the project. Fine for a small team, and the schema in `projects.sql` would need
  widening (a `role` column on `project_collaborators`) before it says more than that.
- **Deleting a project does not delete what was posted to it.** `project_id` is
  `on delete set null` on both `imaginations` and `toolkit_rooms`, on purpose — an
  imagination somebody drew belongs to the person who posted it, not to the project
  it happened to be attached to, and removing a project should not take their work
  with it. It does mean a deleted project's imaginations quietly become unattached
  ones rather than disappearing.
- **Retention.** The GDPR page says answers are kept "while this research runs"
  and addresses "until you ask us to remove it, or the closed beta programme
  ends". Make that true, or change the page.
- **`/admin/imaginations` can only delete its own account's posts.** The rules in
  `imaginations.sql` scope delete to the owner, and the admin screen holds the same anon
  key as everybody else — so it is not a moderation tool once posts are in Supabase. It
  says so when a delete is refused rather than looking broken. Real moderation needs a
  `service_role` key behind a server, or an admin claim in the JWT and a policy that
  honours it. Until then, moderate from the SQL editor.
- **Neither are follows, for the same reason.** `public.follows` has the same gap as
  `public.profiles` below: it is server-side state belonging to an account, and the
  GDPR controls only reach what is in localStorage. A signed-out visitor's follows are
  covered — they live under `placemaking_follows`, in `STORAGE_KEYS` — an account's are not.
- **Nor are notifications or notification preferences**, for the same reason again —
  both are rows in Supabase, and neither is in `exportAllData` or `eraseAllData`.
  Neither are organisations or anyone's admin rows in them (step 18).
- **Activity alerts do not cover cities.** `follows.followed_type` includes `'city'`,
  but nothing in `notifications.sql` posts to a city yet — there is nowhere in the app
  that publishes news for one, the same gap `follows.sql`'s header notes. The trigger
  for a followed user or project is the pattern to extend once a city has something to
  post.
- **Accounts are not yet in the export or the erasure.** `exportAllData` and
  `eraseAllData` in `src/services/api.js` walk a registry of localStorage keys, and a
  profile row is not one. Two consequences: the GDPR page's download does not include
  the account, and its erase button leaves it untouched. There is also the session
  token to think about — `persistSession` writes `sb-<project-ref>-auth-token`, whose
  name no registry can hold in advance.
- **Deleting an account needs the SQL editor.** The key in the browser cannot remove a
  row from `auth.users`, so there is no button that can. An Edge Function with a
  `service_role` key is the fix.
- **The legal pages still say there are no accounts.** `PrivacyPage.jsx` opens with
  "PLACER has no user accounts" and `GdprPage.jsx` says twice that there is no
  sign-in. Both were true when they were written. Neither is now.
- **Erasure requests are manual.** The browser's key cannot delete, by design, so
  a request means running a `delete` in the SQL editor. If someone gave an email,
  that is the lookup key; a response submitted without one carries no identifier
  and cannot be picked out.
- **`OPERATOR` in `src/legal.js` is still a placeholder.** It names the data
  controller on both legal pages, and matters more now that an email address can
  be collected.
