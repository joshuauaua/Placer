# Supabase — getting the survey, Sandbox rooms, accounts and the map live

The survey works with no backend at all: with either environment variable below
missing, responses stay in the browser's localStorage. Everything in steps 1 to 7
is about switching that over to a real table.

Three features cannot fall back that way. Sandbox rooms (step 8), because a room is
shared between devices; without a project they are simply not offered, and the
Sandbox works as it always did. Accounts (step 9), because there is nowhere to keep
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

## 8. Sandbox rooms

Optional, and separate from the survey. A facilitator opens a room on a Sandbox
experiment; people join it with a six-digit PIN or by scanning its QR code, and
their answers are combined live. Without this the Sandbox still works — every
experiment runs on its own in the browser, and the "Start a room" button simply
never appears.

**Opening a room takes an account. Joining one never does.** Opening creates
something other people are invited into, so it needs somebody accountable for it;
joining is what a participant does with a QR code in a workshop, and asking them to
make an account at that moment would cost the room the people it was opened for. This
means step 9 as well, if you want the "Start a room" button to work at all — without
accounts configured, a signed-out facilitator gets "Sign in to start a room" and no
further.

Run `rooms.sql` in the SQL editor, the same way as `schema.sql`. It is
re-runnable. Only Budget Ballot can host a room today; the experiments allowed to
are enumerated in a CHECK constraint in that file, and adding a second one means
editing both it and `src/sandbox/experiments.js`.

The access rules are deliberately unlike the survey's. Joining a room needs a
*read*, which nothing else here has, so instead of a select policy on the rooms
table — which would make every PIN enumerable — all of it goes through
`security definer` functions, and the anon role is granted nothing at all on
`sandbox_rooms`.

Of those functions, `sandbox_room_create` is the only one the anon role may not
execute — that grant is where "opening takes an account" is actually enforced, rather
than in the button. `sandbox_rooms.created_by` records which account opened each room,
and is nulled rather than cascaded if that account is later deleted: a room holds other
people's contributions, and those are not the facilitator's to take with them.

Verify with:

```bash
# No rows, and no error: there is no select policy on this table at all.
curl -s "$VITE_SUPABASE_URL/rest/v1/sandbox_rooms?select=id" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY"

# An unknown PIN is an empty result, not an error. Joining needs no account, so this
# works with nothing but the anon key.
curl -s "$VITE_SUPABASE_URL/rest/v1/rpc/sandbox_room_join" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_pin":"000000"}'

# Opening one does need an account, so the same key alone must be refused here —
# expect a 403 and "permission denied for function sandbox_room_create".
curl -s "$VITE_SUPABASE_URL/rest/v1/rpc/sandbox_room_create" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_experiment":"budget-ballot"}'
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
it — the interval is written in exactly one place. Then change the retention row on
the GDPR page and the paragraph on the privacy page, both of which name it.

**A PIN is guessable.** Six digits is a million combinations, the publishable key
is in every visitor's bundle, and with no server in front there is nowhere to rate
limit. An open room can therefore be found by enumeration and joined by someone
who was not in the workshop. That is an accepted trade for an ephemeral,
non-binding tool — and a reason to close rooms rather than leave them open.

## 9. Accounts

Optional, and separate from both the survey and the Sandbox. Without it people can
still browse, draw, and open Sandbox rooms; what they cannot do is post an
imagination, because a posted imagination belongs to an account.

Run `auth.sql` in the SQL editor, the same way as `schema.sql`. It is re-runnable.
It creates `public.profiles` — one row per account, holding the display name and bio
— and the trigger on `auth.users` that fills it in the moment an account exists.

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

## Still to decide

- **Retention.** The GDPR page says answers are kept "while this research runs"
  and addresses "until you ask us to remove it, or the closed beta programme
  ends". Make that true, or change the page.
- **`/admin/imaginations` can only delete its own account's posts.** The rules in
  `imaginations.sql` scope delete to the owner, and the admin screen holds the same anon
  key as everybody else — so it is not a moderation tool once posts are in Supabase. It
  says so when a delete is refused rather than looking broken. Real moderation needs a
  `service_role` key behind a server, or an admin claim in the JWT and a policy that
  honours it. Until then, moderate from the SQL editor.
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
