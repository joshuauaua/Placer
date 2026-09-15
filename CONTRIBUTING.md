# Contributing to PLACER

Contributions are welcome **in the Sandbox**, and only there.

The Sandbox is the gallery of small experiments at `/sandbox` — the Street Section
Mixer, Desire Lines, 15-Minute Reach, the Budget Ballot. Each one is a self-contained
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
| `src/components/sandbox/**` | the experiments themselves |
| `src/sandbox/experiments.js` | the register that makes one appear in the gallery |
| `src/components/SandboxPage.jsx`, `SandboxLayout.jsx` | the gallery and the shared panel primitives |
| `src/lib/sandbox/**` | the arithmetic behind a **new** experiment |
| `src/lib/streetSection.js`, `desireLines.js`, `reachGrid.js`, `budgetBallot.js` | the arithmetic behind the four that already exist |
| the matching tests under `src/lib/sandbox/__tests__/`, `src/lib/__tests__/`, `src/sandbox/__tests__/`, `src/components/__tests__/Sandbox*.test.jsx` | |

Everything else is closed, including four files that sit *inside* those directories:
`src/components/sandbox/RoomBar.jsx`, `src/components/sandbox/useRoom.js`,
`src/sandbox/rooms.js` and their tests. Those are the shared-room layer, and what
they get wrong is not a wonky diagram but who can read a stranger's contribution.

`scripts/check-sandbox-scope.mjs` is the definition, not this table. Check a change
against it before you push:

```bash
git diff --name-only Development...HEAD | npm run sandbox:scope
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

No environment variables are needed for the Sandbox. The experiments run entirely in
the browser and save nothing. (`.env` matters only for the map, analytics and shared
rooms, none of which you need to work on an experiment.)

## Adding an experiment

Four steps, and the register's own comment says the same thing:

1. **A component** in `src/components/sandbox/`. It takes exactly `{ t, experiment }`
   — `t` is the theme, `experiment` is its own register entry, used for its colour.
2. **A pure module** in `src/lib/sandbox/` holding all the arithmetic, with no React
   in it. Every existing experiment does this, and it is why the sums can be tested
   without rendering anything. The four originals sit directly in `src/lib/` because
   they predate this being a boundary — the rest of `src/lib/` is image processing and
   maps code, so new work goes in the `sandbox/` subdirectory.
3. **An entry** in `src/sandbox/experiments.js`: `id`, `name`, `tagline`, `blurb`,
   `hint`, `color`, `icon`, `component`.
4. **Tests.** The logic in `src/lib/sandbox/__tests__/`, the component in
   `src/components/__tests__/SandboxTools.test.jsx`.

Two things need the owner, so mention them in the pull request rather than trying:

- **A new icon.** `icon` is a key into `src/components/Icon.jsx`, which is shared and
  therefore closed. Pick an existing name from that file, or say in the pull request
  what mark you want and it can be added.
- **A room-capable experiment.** Adding a `room: { empty, combine }` to your register
  entry is not enough on its own — the database has an allowlist of experiments that
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
- **Keyboard and screen-reader access is not optional.** Every existing experiment has
  a keyboard path to everything a mouse can do — look at the `role="separator"`
  dividers in the Street Mixer, or the roving grid cursor with `aria-live` in
  15-Minute Reach.
- **No new dependencies.** If you genuinely need one, ask in an issue first; the
  lockfile is guarded and a new package is a decision rather than a detail.
- **Comments explain why, not what.** The existing ones are worth reading as a guide.
- The figures in these experiments are deliberately rough — calibrated so the
  trade-offs behave like real ones, not so they could size a real scheme. Keep new
  ones in that spirit, and say in the pull request where yours came from.

## Opening the pull request

Branch from `Development` and target `Development`. Do not push to `Development` or
`main` directly.

Two checks run, and both have to be green: the Sandbox scope check, and the tests,
lint and build. Every pull request also needs a review from the owner — that is
deliberate, and it applies to everything, including changes inside the Sandbox.
