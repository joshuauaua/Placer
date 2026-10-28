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

Optional, and separate from the survey. A project's organiser opens a room on one
of its tools, by configuring the tool from the project's dashboard; people join it
with a six-digit PIN or by scanning its QR code, and their answers are combined
live. The Toolkit page itself only lets people try the tools, and opens no rooms.
Without this every tool still runs on its own in the browser.

**Opening a room takes an account. Joining one never does.** Opening creates
something other people are invited into, so it needs somebody accountable for it;
joining is what a participant does with a QR code, and asking them to make an
account at that moment would cost the room the people it was opened for. Opening
one means step 9 as well, since only a project's owner or collaborators can.

Run `rooms.sql` in the SQL editor, the same way as `schema.sql`. It is
re-runnable. Which tools may host a room is set later, by `room-tools.sql` (see
"Which tools can host a room" below).

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

**Retired** by `imaginations-retire.sql` (section 21): the tables this step creates are
dropped again there, and nothing in the app reads or writes them any more. It stays
here because the migrations that follow it still expect them to have existed.

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

### Setting a tool up before its room opens

Requires the section above. Run `rooms-config.sql` in the SQL editor after
`rooms-lifetime.sql` (or `supabase db push`). It is re-runnable.

A tool with a `setup` in `src/toolkit/tools.js` — the Co-Budget so far — is set up
before its room opens: for the Co-Budget, the budget and which things are on the
ballot. The room keeps it in `toolkit_rooms.config`, fixed for the room's whole life,
and `toolkit_room_state` hands it to everybody who joins. The database checks only that
it is a JSON object under 16 KB; what it means is checked by the tool in the browser.
Until this file has run, the app still opens rooms on tools without a setup, but opening
one on the Co-Budget fails, because it sends a setup the older function does not take.

```sql
select pg_get_function_identity_arguments('public.toolkit_room_create'::regproc);
-- p_tool text, p_project_id uuid, p_lifetime text, p_config jsonb
```

### Scheduling a project's room to start later

Run `rooms-schedule.sql` in the SQL editor after `project-privacy.sql` (or
`supabase db push`). It is re-runnable.

A project's room can be set up ahead of time to start on a day within the project's
dates (the Poll's last setup step offers it). The room keeps when it starts in
`toolkit_rooms.opens_at`, at the start of that day in the organiser's time zone; until
then it is `scheduled` — listed on the project's dashboard, but not on its public page,
and it cannot be joined or answered — and its lifetime counts from when it opens.
`toolkit_room_create` refuses a day outside the project's dates, in the past, or for a
project without dates.

```sql
select pg_get_function_identity_arguments('public.toolkit_room_create'::regproc);
-- p_tool text, p_project_id uuid, p_lifetime text, p_config jsonb, p_opens_on date, p_time_zone text
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

**Projects and organisations.** Run `notifications-projects.sql` after this file,
`organisations.sql`, `media-photos.sql` and `follows-organisations.sql`. It adds three
more alerts: somebody you follow starting a project (Activity); somebody following a
project you run or an organisation you are an admin of (Follower, which this file only
sent for a profile); and somebody answering a Toolkit tool in a project you run
(Engagement), to its owner and collaborators. It replaces `notifications_on_follow` and
`notifications_on_room_closed` from this file in place, so edit them there.

Answers are governed by a choice of their own rather than the Engagement switch:
`notification_preferences.project_responses` is `every` (each new answer, the
default), `session` (one summary when a session is closed by hand) or `off`, and
`project_notification_settings` overrides it for one account on one project, from the
project's dashboard. Only a new answer counts; a participant changing theirs does not.
A session that runs out of time never records a close, so it sends no summary, as it
already sent followers no "new results".

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

### Changing a room after it is set up

Run `rooms-edit.sql` in the SQL editor after `rooms-schedule.sql` (or
`supabase db push`). It is re-runnable.

A room scheduled to start later can be changed completely until it starts — its setup,
the day it starts and how long it stays open (`toolkit_room_reschedule`) — since nobody
can have answered it yet. Once a room is open its setup stays fixed, as
`rooms-config.sql` explains, but a long room's closing day can move, within ninety days
of when it opened (`toolkit_room_set_closes`). A room joined by its PIN keeps its two
hours, and a long one cannot be cut to two hours or less, which would make its join code
a PIN room's. Both are for the project's owner and collaborators. `project_rooms` also
returns each room's setup now.

```sql
select pg_get_function_identity_arguments('public.toolkit_room_set_closes'::regproc);
-- p_room_id uuid, p_closes_on date, p_time_zone text
```

### A room that starts at a time of day

Run `rooms-start-time.sql` in the SQL editor after `rooms-edit.sql` (or
`supabase db push`). It is re-runnable.

A scheduled room can start at a time on its day, not only at the start of it:
`toolkit_room_create` and `toolkit_room_reschedule` take `p_opens_time`, in the
organiser's time zone. Left out, the room opens at the start of the day as before. A
time already gone by is refused.

```sql
select pg_get_function_identity_arguments('public.toolkit_room_create'::regproc);
-- ..., p_opens_on date, p_time_zone text, p_opens_time time without time zone
```

### A project's Workshop Room

Run `project-workshop-room.sql` in the SQL editor after `project-tool-config.sql` (or
`supabase db push`). It is re-runnable.

`project_tools.placement` says where a project's tool is shown on its public page:
`'page'`, the Project tab, as every tool was before, or `'workshop'`, the Workshop
Room tab. It is chosen per tool, so all of a tool's rooms follow it, and the project's
owner and collaborators set and change it.

```sql
select tool, placement from public.project_tools limit 5;
```

### A project's room schedule

Run `project-room-schedule.sql` in the SQL editor after `rooms-schedule.sql` (or
`supabase db push`). It is re-runnable.

`project_room_schedule` lists every room of a project, earliest first, with when it
opens and closes and whether it is `scheduled`, `open`, `closed` or `expired` — the
Workshop Room's schedule. Anybody who can see the project can call it, so a room that
has not started is listed by its times alone: no PIN, no join code and no setup.

```sql
select * from public.project_room_schedule((select id from public.projects limit 1));
```

### A project's public page: updates, comments and its numbers

Run `project-public-page.sql` in the SQL editor after `project-privacy.sql` and
`media-photos.sql` (or `supabase db push`). It is re-runnable.

It adds `project_updates`, which only a project's organisers post — its owner and the
admins of the organisation it is run for (`project_is_organiser`), not its collaborators —
and
`project_comments`, which anybody signed in who can see the project may add and its
author, owner or collaborators may remove. Both are readable by whoever can see the
project (`project_can_view`), and who wrote each is set by a trigger from the poster's
profile, never from what the client sends. `project_public_summary(project_id)` returns
the public page's numbers (views, followers, and interactions: Toolkit contributions,
imaginations and comments), the owner's public details with the day they joined and how
many public projects they run, the collaborators' names and photos, never their
email, and whether the caller may post an update. It returns null for a project the
caller cannot see. `20261014130001_project_updates_organisers.sql` catches up a
database that took the first version, which let collaborators post updates too.

```sql
select public.project_public_summary((select id from public.projects limit 1));
select policyname, cmd, roles from pg_policies where tablename in ('project_updates', 'project_comments');
```

### Posting as a project's organisation

Run `project-posts-as-organisation.sql` after `project-public-page.sql` (or
`supabase db push`). It is re-runnable.

A project's organisers — its owner and the admins of the organisation it is run for —
can post an update or a comment either as themselves or as that organisation.
`organisation_id` on `project_updates` and `project_comments` is that choice; the
author trigger checks it is the project's own organisation and that the poster
organises the project, then names the post after the organisation. `author_id` stays
the person, so they can still remove it.

### A person's public profile: joined date and projects

Run `profile-activity.sql` after `project-privacy.sql` and `media-photos.sql` (or
`supabase db push`). It is re-runnable.

`profile_public_activity(user_id)` returns when the account joined and the projects it
owns or collaborates on, each with its role — only projects the caller may see
(`project_can_view`). Null for an account that does not exist. The profile's Comments
tab reads `project_comments` by author directly, leaving out those posted as an
organisation.

### Profile photos beside posts

Run `profile-photos.sql` after `media-photos.sql` (or `supabase db push`). It is
re-runnable. `profile_photos(ids)` returns each account's `avatar_path` — already public
through `profile_public()` — for up to 200 accounts at once, so a project's updates and
comments can show their authors' photos in one call.

### Inquiries kept on a profile

Run `profile-inquiries.sql` after `auth.sql` (or `supabase db push`). It is re-runnable.
`profile_inquiries` holds what somebody signed in chose to keep from a tool used on its
own — for Desire Lines the site, its marks, the note on why it matters and the walks drawn
— to start a project's tool from later. Private to the account: its row-level security lets
only the owner read, add or delete them.

### Photos on a project's page

Besides its header image, a project can have up to 12 photos, added from its settings
and shown in a Photos section on its public page. `project-gallery.sql` (also a
migration) adds `projects.gallery_paths`, the keys in the order they are shown. The
files go in the bucket under `gallery/<project id>/`, so deploy the `media` function
again (step 14) so it accepts the new folder:

```sh
supabase functions deploy media
```

Run the SQL before the app goes out: the app reads the column with every project.

Each photo can have a caption, shown under it in the page's gallery.
`project-gallery-captions.sql` (also a migration) adds `projects.gallery_captions`, an
object from a photo's path to its caption, so a caption stays with its photo when they
are reordered. Run it before the app goes out too.

### Photos shown on their own

A project's photos can each be shown by itself, as a section of the page, rather than
in the gallery with the rest. `project-gallery-standalone.sql` (also a migration) adds
`projects.gallery_standalone`, the paths of the ones that are; Page Layout orders them
under the key `photo:<path>`. Any section's title can also be hidden from Page Layout,
which needs no SQL: it is `hideTitle` on the section's entry in `page_layout`. Run the
SQL before the app goes out: the app reads the column with every project.

### A project's subtitle

The line under a project's name at the top of its page used to be its description,
which the page also shows under About the project. `project-subtitle.sql` (also a
migration) adds `projects.subtitle`, set in the project's setup as a field of its own.
Empty, which every project's is to begin with, shows no line. Run it before the app
goes out: the app reads the column with every project.

### Replies to a project's updates and comments

Anybody signed in who can see a project can reply to its updates and comments, one
level deep. `project-replies.sql` (also a migration) adds `project_replies`: each names
its post by `update_id` or `comment_id`, takes its project from that post, and goes
when the post does. Its author can remove it, as can the project's team and
organisers. Run it before the app goes out: the page reads replies with its posts.

### The order and titles of a project page's sections

Edit project's **Page Layout** field lets organisers put the sections of the project's page
(About, Goals, Photos and each tool) in their own order and retitle them — a Poll
need not be "We want your opinion". `project-page-layout.sql` (also a migration) adds
`projects.page_layout`, the list they saved; `src/lib/projectSections.js` says what it
holds. Empty, which every project's is to begin with, is the page as it always was.
Like the photos, run it before the app goes out.

### Room limits big enough for a map

Run `room-size-limits.sql` after `rooms.sql` and `rooms-config.sql` (or `supabase db push`).
It is re-runnable. It raises the cap on a participant's answer from 4000 characters, and on a
room's setup from 16 KB, to 64 KB each — Desire Lines' walks and marked-up sites need the room.

### Which tools can host a room

Run `room-tools.sql` in the SQL editor after `rooms.sql` and `notifications-projects.sql`
(or `supabase db push`), then every file in `room-tools/`. They are re-runnable.

`toolkit_room_tools` has a row per tool that can run in a room, and
`toolkit_rooms.tool` references it, so a room cannot be opened on a tool the database
has not been told about. `toolkit_tool_name` reads the tool's name from it for the
notifications' text. It replaces a CHECK constraint in `rooms.sql` that listed the
tools: every new tool edited that list, so branches adding tools conflicted on it.

A new tool adds `room-tools/<id>.sql`, inserting its row, and runs
`node scripts/check-migrations.mjs --write` to generate its migration — see
`room-tools/README.md`.

```sql
select id, name from public.toolkit_room_tools order by id;
-- budget-ballot | Co-Budget, open-vote | Poll, pop-quiz | Pop Quiz, word-cloud | Word Cloud, …
```

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
  browser claimed, and within a size limit per folder (0.5 MB avatars, 1.5 MB covers and
  project images, 5 MB previews).
- **Smaller copies.** A cover, project image, gallery photo or preview is uploaded with
  copies 640 and 1080 pixels wide beside it, named by width
  (`image-…-w1600.webp`, `image-…-w640.webp`; see `src/lib/responsiveImage.js`), so a
  phone is sent one its own size. The function keeps and deletes a picture's copies with
  it.
- **50 MB per account.** An upload is refused if it would take the account past 50 MB
  in all — its own folders plus the images of the projects it owns. A project image
  counts against the project's owner, whoever uploads it.
- **Old pictures are removed.** Uploading a cover, profile photo or project image
  deletes the older ones in that folder, keeping the new one and the one the row
  currently uses; deleting an imagination or a project deletes its picture.
  A project's Idea Visualizer base image (`scenes/<project id>/`, see
  `project-tool-config.sql`) is not swept: the setup page deletes the one it
  replaces, and deleting the project deletes it too.

**In Cloudflare**

1. The bucket. Create it with **Specify jurisdiction -> European Union** if the
   privacy page's "stored in the EU" is to stay true. A *location hint* such as
   "Eastern Europe (EEUR)" is not the same thing — it is a preference, not a
   guarantee. Jurisdiction is chosen at creation and cannot be changed afterwards.
2. Settings -> Public access -> connect a **custom domain** (e.g. `media.<your-domain>`).
   The `r2.dev` address is rate-limited and not meant for production.
3. Settings -> CORS policy -> allow `GET` from the app's origins. Uploads never need
   it (the browser never talks to the bucket's S3 endpoint, only to the function), but
   Idea Visualizer reads a project's base image (the `scenes` folder) with `fetch`
   to draw on, and that read is cross-origin. Without the rule, people imagining for a
   project are sent to the map instead of the organiser's photo.

   ```json
   [
     {
       "AllowedOrigins": ["https://beta.plcr.org", "https://plcr.org", "http://localhost:5173"],
       "AllowedMethods": ["GET"],
       "AllowedHeaders": []
     }
   ]
   ```
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
takes a file of up to 20 MB and re-encodes it to at most 1920px across, and the function
refuses anything still over 1.5 MB. The folder keeps at most two, and closing the
organisation deletes its cover. The uploading admin needs room under their own 50 MB
for it, but it is not counted against anyone afterwards; the folder's own limit bounds it.

**Profile pictures.** Run `organisation-avatars.sql` after `organisation-covers.sql`, and
redeploy the `media` function — both are needed. It adds `organisations.avatar_path`,
pointing into `organisation-avatars/<organisation id>/`: a folder of its own, since the
function sweeps a folder down to the one picture its column names, and sharing the
cover's would delete each whenever the other was replaced. Admins write it the same way
as the cover; the browser re-encodes it to a 512px square, and the function refuses
anything over 0.5 MB. Closing the organisation deletes it with the cover. Until the
function is redeployed it refuses the folder, so uploading a picture fails while
everything else works.

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

## 19. Case study submissions

The Resources page's **Submit a case study** button (also its own address,
`/resources/submit-case-study`) opens a form for a customer or partner to tell us about
a project: company, industry, the problem, the solution, the results, an optional
testimonial, and a contact name and email. Each one is a row in
`case_study_submissions` (`case-study-submissions.sql`, also a migration). Like
`tool_submissions`, the browser can add a row and never read one back.

**Where the content team reads them:** Dashboard -> Table Editor ->
`case_study_submissions`, or in the SQL editor:

```sql
select created_at, company, industry, contact_name, contact_email,
       problem, solution, results, testimonial, logo_path, image_path
from public.case_study_submissions order by created_at desc;
```

Give the team access through Dashboard -> Organization -> Team. Never hand them a
`service_role` key.

**Logo and picture.** These are optional, and only someone signed in can attach them: an
upload goes through the `media` function (step 14), which needs an account, into
`case-studies/<user id>/`. The row keeps the key, so the file is at
`<VITE_MEDIA_URL>/<logo_path>`. The bucket is read publicly, the same as every other
picture, so the address is unguessable but not private. Deploy the function again so it
accepts the new folder:

```sh
supabase functions deploy media
```

**In Slack (optional, requires step 15).** Run `case-study-submissions-slack.sql` in the
SQL editor, and deploy `survey-to-slack` again so it knows the new table. Submissions
go to the survey channel unless `SLACK_CASE_STUDY_WEBHOOK_URL` is set:

```sh
supabase secrets set SLACK_CASE_STUDY_WEBHOOK_URL=https://hooks.slack.com/services/…
supabase functions deploy survey-to-slack
```

**Everyone in the channel sees the contact's name and email.**

## 20. Following up on survey responses

`survey-followup.sql` (also a migration) makes `survey_responses` workable from the
dashboard, with no page of our own to build or secure. It adds a `contacted` checkbox,
a `contacted_at` that stamps itself when the box is ticked, and a free-text `notes`
column, plus these views:

| View | What it shows |
| --- | --- |
| `survey_followups` | The to-do list: one row per request ("Book a 1-on-1 demo", "Confirm the User Labs place", "Add to the waitlist", …) with the name and email. Landing page waitlist responses come from the address left and the "how would you like to be involved" answer |
| `survey_form_responses` | Community, landing and trends surveys: contact details, `wants_report` / `wants_beta` / `wants_demo`, and each module's answers |
| `survey_user_labs` | User Labs applications, one column per field |
| `survey_newsletter` | Everyone who asked for the newsletter |
| `survey_response_counts` | Responses and how many were contacted, per form per week |

**Day to day:** Dashboard -> Table Editor -> `survey_followups`, filtered on `contacted`
is false, is the list of who to get back to. Views are read-only there, so to tick
somebody off open `survey_responses`, filter on their `id` or `email`, and tick
`contacted` (and add a note). The views show the change straight away.

**A chart:** in the SQL editor, run `select * from survey_response_counts order by week`
and switch the result to **Chart**.

Like the table, none of the views can be read with the browser's key.

## 21. Retiring imaginations

The Idea Visualizer used on its own no longer posts to `public.imaginations`: like every
other tool used on its own, it saves to its maker's profile as an inquiry
(`profile_inquiries`, `tool = 'reimagine-a-space'`), private to them. Publishing an
inquiry to the map is still to come. `imaginations-retire.sql` (also a migration):

1. copies every imagination into its owner's inquiries. The preview stays where it is in
   R2 and the inquiry keeps its key as `config.preview`; `config.imaginationId` says
   which imagination it was.
2. deletes follows of an imagination and notifications about one, and narrows both
   tables' type checks.
3. takes imaginations out of `project_public_summary`'s interactions, and out of
   `project_stats`, which now returns only `toolkit_rooms_count`.
4. drops `imaginations`, `imagination_votes` and `imagination_comments`, and the
   functions only they used.

**Order matters.** Push it only once the app that stopped reading those tables is
deployed, or the map and project pages of the app still running will fail to load
them. Then deploy the `media` function again, for its wording:

```sh
supabase db push
supabase functions deploy media
```

### Verify

```sql
select to_regclass('public.imaginations');                                  -- null
select count(*) from public.profile_inquiries where config ? 'imaginationId'; -- one per imagination
```

## 22. Organisations as collaborators

`project-collaborating-organisations.sql` (also a migration) lets a project's owner add
an organisation as a collaborator, from the dashboard's Settings tab. Every admin of the
organisation then counts as one of the project's collaborators, including admins added
later, and stops counting as soon as they leave or the organisation is taken off.
Nothing is copied into `project_collaborators`.

- **Who:** only the owner adds an organisation. The owner, or any of the organisation's
  own admins, can remove it, since it is credited on the project's public page without
  its admins being asked.
- **How:** `project_collaborator_exists` now also returns true for an admin of a
  collaborating organisation. The functions and policies that checked the roster inline
  (the project and link write policies, `project_stats`, `project_rooms`,
  `toolkit_room_create`, `toolkit_room_can_edit`, `project_is_member`, `project_member_ids`)
  are re-issued to ask it instead. `project_public_summary` also returns `organisations`
  and `can_edit`.

Run it after every other file here. **Push it before merging** the app change: the
dashboard and the organisation page leave the new parts out when the table is missing,
but nobody can add an organisation until the table exists.


## 23. Screenshots with bug reports

`bug-report-screenshots.sql` (also a migration) adds `screenshot_path` to `bug_reports`.
Somebody signed in can attach a screenshot from the "Report a bug" panel, or paste one
into its text box. It is re-encoded in the browser like every other picture (WebP, at
most 1920px, metadata stripped) and uploaded through the `media` function (step 14) to
`bug-reports/<user id>/`; the row keeps the key, so the file is at
`<VITE_MEDIA_URL>/<screenshot_path>`. As with case study pictures, the bucket is read
publicly, so the address is unguessable but not private. A signed-out visitor can still
send a report, without a screenshot.

Run it after `bug-reports.sql`, then deploy the function again so it accepts the new folder:

```sh
supabase functions deploy media
```

If bug reports go to Slack (step 16), run `bug-reports-slack.sql` again and redeploy
`survey-to-slack`. To have the screenshot shown in the message, with a link to it, give
the function the bucket's public address too (the app's `VITE_MEDIA_URL`):

```sh
supabase secrets set MEDIA_URL=https://media.plcr.org
supabase functions deploy survey-to-slack
```

Without `MEDIA_URL` the message only says a screenshot is attached. The key, and so the
link, carries the reporter's account id; that is in Slack now, though `user_id` still is
not. After 30 days the file is deleted (below), and the picture in Slack stops loading.

**Screenshots are deleted after 30 days.** A screenshot can show somebody's account or
work, so it is not kept once the bug has had time to be looked into. A daily `pg_cron` job
calls the `media-expire` function, which deletes every file under `bug-reports/` older
than 30 days (by the file's own age, so a screenshot whose report never saved goes too)
and clears `screenshot_path` on the reports that pointed at them. The reports themselves
are kept. The privacy page says so; change `EXPIRE_DAYS` in
`supabase/functions/media-expire/index.ts` and that page together.

It uses the media function's R2 secrets (step 14) and one of its own. Enable `pg_cron` and
`pg_net` under Database → Extensions, then:

```sh
supabase secrets set MEDIA_EXPIRE_SECRET=$(openssl rand -hex 32)
supabase functions deploy media-expire
```

Store the same value in Vault from the SQL editor, then run
`bug-report-screenshots-expire.sql` (not a migration: it names this project's URL):

```sql
select vault.create_secret('<same value as MEDIA_EXPIRE_SECRET>', 'media_expire_secret');
```

To check it by hand rather than wait for 03:41 UTC:

```sh
curl -X POST https://<project>.supabase.co/functions/v1/media-expire \
  -H "x-cron-secret: <MEDIA_EXPIRE_SECRET>"
# {"ok":true,"deleted":0}
```

`401` means the header does not match the secret; `500 not configured` means
`MEDIA_EXPIRE_SECRET` is missing. Any other `500` names what failed — a missing R2 secret,
or R2 refusing the listing — and a run that fails leaves everything for the next one.

**Push the migration and deploy `media` before merging** the app change: until then a
report with a screenshot is refused (the column does not exist), though one without
still goes through.

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
