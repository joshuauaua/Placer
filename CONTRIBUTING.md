# Contributing to PLACER

Collaborators can work on any part of the app — the Toolkit's tools, projects, the
pages, the database. Every change reaches `Development` the same way: through a pull
request that the owner approves before it merges (see
[Opening the pull request](#opening-the-pull-request)).

## Getting set up

```bash
npm ci            # exactly the lockfile; not npm install
npm run dev       # the app on localhost
npm test          # watch mode
npm run test:run  # one pass
npm run lint
npm run build
```

No environment variables are needed to work on a Toolkit tool: the tools run entirely
in the browser and save nothing. The rest of the app — accounts, projects, the map,
shared rooms — needs a `.env`; ask the owner for one.

## Adding a tool

Four steps, and the register's own comment says the same thing:

1. **A component** in `src/components/toolkit/`. It takes exactly `{ t, tool }`
   — `t` is the theme, `tool` is its own register entry, used for its colour.
2. **A pure module** in `src/lib/toolkit/` holding all the arithmetic, with no React
   in it. Every existing tool does this, and it is why the sums can be tested
   without rendering anything. The four originals sit directly in `src/lib/` because
   they predate this being a boundary — the rest of `src/lib/` is image processing and
   maps code, so new work goes in the `toolkit/` subdirectory.
3. **An entry** in `src/toolkit/tools.js`: `id`, `name`, `tagline`, `blurb`,
   `hint`, `color`, `icon`, `component`.
4. **Tests.** The logic in `src/lib/toolkit/__tests__/`, the component in
   `src/components/__tests__/ToolkitTools.test.jsx`.

`icon` is a key into `src/components/Icon.jsx`; add a new mark there if none of the
existing ones fits. A tool that can be run in a room (`room: { empty, combine }` in its
entry) also has to be on the database's allowlist in `supabase/rooms.sql`, which is a
database change — see below.

## What review will look for

The codebase has strong habits. Matching them makes review quick:

- **Arithmetic lives in `src/lib/`**, components are the handles. If a component is
  doing sums, they are in the wrong file.
- **Tests import from `'vite-plus/test'`**, never from `'vitest'`, and query by role
  and accessible name where they can.
- **Styling is inline `style={{}}` objects driven by the `t` theme prop.** There is no
  Tailwind and no CSS modules. Never hardcode a colour that `t` already has; the
  exceptions are the two semantic literals used throughout, `#2E7D32` for good and
  `#C0392B` for bad.
- **Fonts come from `var(--placer-font)`**, not a font name.
- **Keyboard and screen-reader access is not optional.** Every existing tool has
  a keyboard path to everything a mouse can do — look at the `role="separator"`
  dividers in the Street Mixer, or the roving grid cursor with `aria-live` in
  15-Minute Reach.
- **No new dependencies.** If you genuinely need one, ask in an issue first; the
  lockfile is guarded and a new package is a decision rather than a detail.
- **Comments explain why, not what.** The existing ones are worth reading as a guide.
- The figures in these tools are deliberately rough — calibrated so the
  trade-offs behave like real ones, not so they could size a real scheme. Keep new
  ones in that spirit, and say in the pull request where yours came from.

## Opening the pull request

Branch from `Development` and open the pull request into `Development`. Do not push to
`Development` or `main` directly — the rulesets refuse it.

Every pull request needs the owner's approval before it can merge, whatever it
touches: `.github/CODEOWNERS` makes them the reviewer of every file, and a new push
after approval asks for it again. The tests, lint and build also run on it and should
be green.

**A database change needs the owner too.** Merging into `Development` deploys the beta
straight away, so a migration has to be live before the code that needs it. Add the
migration under `supabase/migrations/` (generated from the matching `supabase/*.sql`;
`npm run migrations:check` says whether they agree), say so in the pull request, and
the owner pushes it live before merging.
