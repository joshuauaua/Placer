#!/usr/bin/env node
// Fails if a migration has drifted from the SQL file it was generated from.
//
// supabase/*.sql are the documented Dashboard -> SQL Editor path, and they are what
// supabase/README.md walks a new operator through. supabase/migrations/*.sql are the
// same SQL under `supabase db push`. Both have to exist: the dashboard path is the
// fallback when nobody has the CLI, and the migrations are what makes the schema
// reviewable and repeatable. What must never happen is the two saying different
// things about a table whose only protection is row-level security.
//
// So this file owns the relationship in one place. It generates the migrations and
// it checks them, which is why there is no second copy of the mapping to keep in
// step:
//
//   node scripts/check-migrations.mjs           # verify, exit 1 on drift
//   node scripts/check-migrations.mjs --write   # regenerate after editing a source
//
// An absent supabase/migrations passes. The landingpage branch has no migrations at
// all, and a branch that has not adopted them is not this script's problem.
//
// hardening.sql is deliberately absent from the mapping. Every constraint and grant
// in it is already in schema.sql -- it exists to retrofit a table that predates
// them -- and it opens by requiring a DELETE be run first, which would fail a push
// against a table holding a setup_check row.
//
// HAND_WRITTEN below is the migrations-directory equivalent of that: a one-off
// catch-up migration for a master file that was edited after its own migration had
// already been pushed and recorded as applied. Supabase tracks migrations by version,
// not content, so `db push` never replays an edited one -- these re-issue just the
// part that never ran. There is no single current source to render them from (the
// master file has since moved on), so PLAN's generate-and-diff machinery does not fit
// them; they are only ever checked for presence, the same as hardening.sql is exempt
// outright. Add a new one here, by name, whenever this drift happens again -- each
// file's own header explains which migration it is catching up.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const DIR = 'supabase'
const OUT = `${DIR}/migrations`

/*
 * Which migration comes from which file, in apply order.
 *
 * `slice` names the part of a source that is schema. Only rooms-cleanup.sql needs
 * one: its first three steps are an interactive count and a by-hand DELETE, which
 * are operational commands and would be wrong to replay on every push.
 */
const PLAN = [
  { name: '20260913090001_survey_responses.sql', src: 'schema.sql' },
  { name: '20260913090002_profiles_and_accounts.sql', src: 'auth.sql' },
  { name: '20260913090003_sandbox_rooms.sql', src: 'rooms.sql' },
  {
    name: '20260913090004_sandbox_rooms_sweep.sql',
    src: 'rooms-cleanup.sql',
    slice: { from: 'create extension if not exists pg_cron;', to: '-- To see it, or stop it again:' },
    note:
      'Only step 4 of that file. Steps 1-3 are an interactive count and a manual\n' +
      '-- DELETE -- operational commands, not schema, so they stay out of migrations.',
  },
  { name: '20260913090005_imaginations.sql', src: 'imaginations.sql' },
  { name: '20260922090001_follows.sql', src: 'follows.sql' },
  { name: '20260922100001_projects.sql', src: 'projects.sql' },
  { name: '20260923090001_notifications.sql', src: 'notifications.sql' },
  { name: '20260924090001_sandbox_rooms_lifetime.sql', src: 'rooms-lifetime.sql' },
  { name: '20260925110001_invite_codes.sql', src: 'invites.sql' },
  { name: '20260927090001_profiles_public.sql', src: 'profiles-public.sql' },
  { name: '20260927100001_profiles_details.sql', src: 'profiles-details.sql' },
  { name: '20260927110001_project_views.sql', src: 'project-views.sql' },
  // Dated after the migrations above it rather than when it was written: it was
  // pushed after them, and `db push` refuses one older than the newest applied.
  { name: '20260928080001_bug_reports.sql', src: 'bug-reports.sql' },
  { name: '20260928090001_media_on_r2.sql', src: 'media-r2.sql' },
  { name: '20260928110001_profile_photos_and_project_images.sql', src: 'media-photos.sql' },
  { name: '20260928120001_project_delete_follows.sql', src: 'project-delete.sql' },
  { name: '20260928120002_sandbox_room_delete.sql', src: 'rooms-delete.sql' },
  { name: '20260929090001_tool_submissions.sql', src: 'tool-submissions.sql' },
  { name: '20260929100001_project_types.sql', src: 'project-types.sql' },
  { name: '20260930090001_organisations.sql', src: 'organisations.sql' },
]

const HAND_WRITTEN = [
  '20260922110001_profiles_location_avatar_backfill.sql',
  '20260922120001_project_collaborators_no_recursion.sql',
  '20260922130001_imagination_votes_and_comments.sql',
  '20260922130002_sandbox_rooms_open_vote.sql',
  '20260925090001_survey_responses_new_sources.sql',
  '20260925100001_survey_responses_sandbox_contribution.sql',
  '20260928100001_profiles_cover_path_r2_folder.sql',
]

export function render({ src, slice, note }, read = (f) => readFileSync(`${DIR}/${f}`, 'utf8')) {
  let body = read(src)

  if (slice) {
    const from = body.indexOf(slice.from)
    const to = body.indexOf(slice.to)
    if (from === -1 || to === -1 || to < from) {
      throw new Error(`${src}: slice markers not found -- the source was restructured`)
    }
    body = `${body.slice(from, to).trimEnd()}\n`
  }

  const header =
    `-- Generated from supabase/${src} -- keep the two in step.\n` +
    '-- That file remains the documented Dashboard -> SQL Editor path\n' +
    '-- (see supabase/README.md); this is the same SQL under CLI control.\n' +
    (note ? `--\n-- ${note}\n` : '')

  return `${header}\n${body}`
}

export function check({ write = false } = {}) {
  if (!existsSync(OUT)) return { drifted: [], orphans: [], skipped: true }

  const drifted = []
  for (const entry of PLAN) {
    const expected = render(entry)
    const path = `${OUT}/${entry.name}`
    const actual = existsSync(path) ? readFileSync(path, 'utf8') : null

    if (actual === expected) continue
    if (write) writeFileSync(path, expected)
    else drifted.push({ ...entry, reason: actual === null ? 'missing' : 'differs from source' })
  }

  // A migration nobody generated is worse than a stale one: it will be pushed and
  // never checked. Name it rather than quietly ignoring it -- HAND_WRITTEN is that
  // naming, for the ones that are supposed to exist without a generated source.
  const known = new Set([...PLAN.map((e) => e.name), ...HAND_WRITTEN])
  const orphans = readdirSync(OUT).filter((f) => f.endsWith('.sql') && !known.has(f))

  return { drifted, orphans, skipped: false }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const write = process.argv.includes('--write')
  const { drifted, orphans, skipped } = check({ write })

  if (skipped) {
    console.log('no supabase/migrations on this branch — nothing to check')
    process.exit(0)
  }
  if (write) {
    console.log(`regenerated ${PLAN.length} migrations from supabase/*.sql`)
  }
  for (const d of drifted) {
    console.error(`drift: ${OUT}/${d.name} ${d.reason} (source: ${DIR}/${d.src})`)
  }
  for (const o of orphans) {
    console.error(`orphan: ${OUT}/${o} has no source in PLAN`)
  }
  if (drifted.length || orphans.length) {
    console.error('\nRun `node scripts/check-migrations.mjs --write` if the source is correct.')
    process.exit(1)
  }
  if (!write) console.log(`${PLAN.length} migrations match their sources`)
}
