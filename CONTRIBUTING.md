# Contributing to PLACER

Contributions are welcome **in the Toolkit**, and only there.

The Toolkit is the gallery of small tools at `/toolkit` — the Street Section
Mixer, Desire Lines, 15-Minute Reach, the Co-Budget. Each one is a self-contained
toy that makes one argument about participatory urban design. Adding a new one, or
improving an existing one, is the kind of change this repository is open to.

The rest of the app is not open to pull requests. That is not a judgement about
anyone's code — it is that the rest of it carries things a reviewer cannot check
quickly: the legal pages make promises about what is stored where, the Supabase rules
are what stop one visitor reading another's data, and the app shell is shared by every
screen. If you want to change something out there, **open an issue** and we will talk
about it first.

## What you can change

| Open | |
|---|---|
| `src/components/toolkit/**` | the tools themselves |
| `src/toolkit/tools.js` | the register that makes one appear in the gallery |
| `src/components/ToolkitPage.jsx`, `ToolLayout.jsx` | the gallery and the shared panel primitives |
| `src/lib/toolkit/**` | the arithmetic behind a **new** tool |
| `src/lib/streetSection.js`, `desireLines.js`, `reachGrid.js`, `budgetBallot.js` | the arithmetic behind the four that already exist |
| the matching tests under `src/lib/toolkit/__tests__/`, `src/lib/__tests__/`, `src/toolkit/__tests__/`, `src/components/__tests__/Toolkit*.test.jsx` | |

Everything else is closed, including four files that sit *inside* those directories:
`src/components/toolkit/RoomBar.jsx`, `src/components/toolkit/useRoom.js`,
`src/toolkit/rooms.js` and their tests. Those are the shared-room layer, and what
they get wrong is not a wonky diagram but who can read a stranger's contribution.

`scripts/check-sandbox-scope.mjs` is the definition, not this table. Check a change
against it before you push:

```bash
git diff --name-only Development...HEAD | npm run toolkit:scope
```

A pull request that reaches outside gets a failing check that names the files.

## Getting set up

```bash
npm ci            # exactly the lockfile; not npm install
npm run dev       # the app on localhost
npm test          # watch mode
npm run test:run  # one pass
npm run lint
npm run build
```

No environment variables are needed for the Toolkit. The tools run entirely in
the browser and save nothing. (`.env` matters only for the map, analytics and shared
rooms, none of which you need to work on a tool.)

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

Two things need the owner, so mention them in the pull request rather than trying:

- **A new icon.** `icon` is a key into `src/components/Icon.jsx`, which is shared and
  therefore closed. Pick an existing name from that file, or say in the pull request
  what mark you want and it can be added.
- **A room-capable tool.** Adding a `room: { empty, combine }` to your register
  entry is not enough on its own — the database has an allowlist of tools that
  may host a room, in `supabase/rooms.sql`, and that half has to be done by the owner.

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

Branch from `Development` and target `Development`. Do not push to `Development` or
`main` directly.

Two checks run, and both have to be green: the Toolkit scope check, and the tests,
lint and build. Every pull request also needs a review from the owner — that is
deliberate, and it applies to everything, including changes inside the Toolkit.
