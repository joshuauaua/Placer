# PLACER

Placer is the open toolkit for co-designing shared spaces. It gives residents,
placemakers and cities one place to understand how a space is used today, imagine how
it could change, and plan that change together.

It is a React single-page app. Supabase holds accounts and data, Cloudflare R2 holds
uploaded pictures, and Google Maps provides the maps and Street View. Every backend is
optional: with none configured, the app still runs and keeps everything in the
browser.

## What you can do

### Imagine a space

Idea Visualizer turns an idea for a street corner into a picture, in three steps:

1. **Place.** Pick a spot on the map, open it in Street View, and capture the view.
   Then drag, resize and rotate benches, trees and other assets onto it.
2. **Describe.** Say what is wrong with the place today and what you propose.
3. **Post.** Review the before and after, then post it to the community map.

### Run a project

A project is the home for one place and the change it is working towards. Starting one
takes a few short screens:

- the kind of project: you have a say over a place, you want to push for change in
  one, or something else
- the basics: its name and goals, who can see it, and whether it has a budget (the
  budget is shown only to its organisers)
- the address
- the tools it will use
- a cover image

Organisers then get a **project dashboard** with views, a roster and documentation.
Everyone else gets a **public project page**, where each chosen tool appears in its own
section: a Poll's question, for example, appears right on the page.

Projects are public by default. A **private** project can be seen only by people its
organisers let in, and anybody else can ask for access.

### Use the Toolkit

The Toolkit at `/toolkit` is a gallery of small tools, grouped by what they help with:

| Understand | Imagine | Plan |
| --- | --- | --- |
| Desire Lines | Street Section Mixer | Co-Budget |
| 15-Minute Reach | Idea Visualizer | Poll |
| The Social Space Survey | | |
| Site-Specific Spatial Mapping Tool | | |
| Stationary Activity Mapping | | |

Some tools can run in a **room**: a facilitator opens one, participants join from their
own phones with a PIN or QR code, and their answers combine live. A project can attach
rooms so that the results sit on its page.

### Everything around it

- **Explore** (`/explore`): a map of projects and organisations near you, with search
  and saved places.
- **Organisations**: a public page, a dashboard for its admins, and the projects
  running under it.
- **Dashboard** (`/dashboard`): your projects, suggested next steps, and recent
  activity.
- **People and following**: public profiles, following people, projects and
  organisations, and notifications.
- **Resources, Guides, Quickstart, Project examples and FAQ**: reading material. The
  Resources articles come from Storyblok.
- **User Labs** (`/user-labs`): apply to an in-person testing session.
- **Settings**: your profile and your analytics consent. You can download or erase
  your data from the Terms and Privacy page.

## Tech stack

- **React 19** with [Vite+](https://github.com/voidzero-dev/vite-plus) (`vp`) for dev,
  build, lint and tests (Vitest with Testing Library)
- **wouter** for routing
- **React-Konva** for the imagination canvas, and **OpenCV.js** for stitching Street
  View captures
- **Google Maps JavaScript API**, with Street View, Places and the Static APIs
- **Supabase** for accounts, Postgres with row-level security, realtime rooms and Edge
  Functions
- **Cloudflare R2** for imagination previews, covers and photos
- **Storyblok** for Resources articles
- **PostHog** for analytics, loaded only after the visitor accepts cookies
- **Vercel** for hosting

## Getting started

### Prerequisites

- Node.js 20.19+, 22.18+ or 24.11+
- A Google Maps API key, if you want the maps. You can work on the Toolkit without one.

### Installation

```bash
git clone https://github.com/joshuauaua/Placer.git
cd Placer
npm ci
cp .env.example .env
npm run dev          # http://localhost:5173
```

Re-run `npm ci` after pulling a commit that changes `package-lock.json`. `npm audit`
reads the lockfile, not `node_modules`, so it reports a clean tree even while an
outdated (and possibly vulnerable) build stays installed. Run `npm run deps:check` at
any time to confirm that `node_modules` matches the lockfile.

Opt in to the repository's git hooks, which do nothing until you run this:

```bash
git config core.hooksPath .githooks
```

That enables four hooks. `post-merge` runs the check above after every `git pull` or
`git merge`, and it only ever prints a warning. `pre-commit`, `pre-merge-commit` and
`pre-push` do block, and only ever for one reason: to keep the `landingpage` holding
page out of the app branches (see [Branches](#branches)). Nothing else in `.githooks/`
stops a commit, a merge or a push.

### Environment variables

Each variable is documented in [`.env.example`](.env.example). They are all optional,
and each one switches on one part of the app:

| Variable | Turns on |
| --- | --- |
| `VITE_GOOGLE_MAPS_API_KEY` | maps, Street View and capture (needs Maps JavaScript, Street View Static and Maps Static) |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | accounts, projects, organisations, the community map, Toolkit rooms, following and notifications |
| `VITE_MEDIA_URL` | uploaded pictures (the public address of the R2 bucket) |
| `VITE_STORYBLOK_TOKEN` | Resources articles |
| `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` | analytics, behind the cookie banner |
| `VITE_ADMIN_ENABLED` | `/admin` and `/admin/imaginations` (a build-time flag, not authentication) |

Without Supabase, identity falls back to a display name stored on this device, and
anything posted stays in this browser. Setting up the database, accounts, R2 uploads
and the Slack notifications is covered step by step in
[`supabase/README.md`](supabase/README.md).

Vite reads `VITE_` variables at build time, so restart the dev server after changing
them, and redeploy after changing them on Vercel.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | starts the dev server |
| `npm test` / `npm run test:run` | runs the tests in watch mode / runs them once |
| `npm run lint` | lints the code |
| `npm run build` | builds into `dist/`, after checking dependencies and migrations |
| `npm run preview` | serves the built `dist/` |
| `npm run deps:check` | checks that `node_modules` matches the lockfile |
| `npm run migrations:check` | checks that `supabase/migrations/` matches the SQL it is generated from |

On Node 25 and later, run the tests with `NODE_OPTIONS=--no-experimental-webstorage`.
Without it, Node's built-in `localStorage` shadows jsdom's and around 150 tests fail
for no real reason.

## Project structure

```
src/
├── App.jsx              # routes and the main app shell
├── components/          # pages and shared UI
│   ├── toolkit/         # the Toolkit tools
│   └── survey/          # the placemaking survey
├── toolkit/             # the tool register (tools.js) and room helpers
├── services/            # Supabase, R2, Storyblok and localStorage data access
├── lib/                 # pure logic: maps, image stitching, the tools' arithmetic
└── theme.js             # design tokens
supabase/
├── *.sql                # schema and row-level security, one file per feature
├── migrations/          # the same SQL, for `supabase db push`
└── functions/           # Edge Functions: media uploads, survey → Slack
scripts/                 # the deps and migrations checks
docs/PRD.md              # the product requirements
```

## Contributing

Collaborators can work on any part of the app, through a pull request into
`Development` that the owner approves before it merges. [CONTRIBUTING.md](CONTRIBUTING.md)
explains how, and how to add a Toolkit tool.

## Branches

Three branches are long-lived, and two of them are deliberately not the same code:

| Branch | Serves | Role |
| --- | --- | --- |
| `landingpage` | the apex domain | the PLACER holding page, shown while the app is in beta |
| `main` | the `beta.` subdomain | production: the app itself |
| `Development` | — | staging and the working branch; promoted to `main` |

`landingpage` is temporary and **must never be merged**. It exists so that the public
domain can show a holding page while the app stays reachable for testing. It will be
deleted, not merged back, once the app is stable enough to serve the apex domain
itself. Merging it would replace the app's home view with the holding page. To move a
single change off it, cherry-pick that commit onto `Development`.

Four guards enforce that, because none of them is enough on its own:

- **`pre-commit`** refuses the commit that concludes a merge of the branch. This is the
  one that fires in practice: `landingpage` and `Development` always conflict, and git
  skips `pre-merge-commit` when a merge conflicts.
- **`pre-merge-commit`** covers the same merge when it applies cleanly.
- **`pre-push`** refuses a push that would put the branch's commits on `main` or
  `Development`, whatever route they took to get there.
- **The `landingpage is not merged` CI job** fails any pull request opened from the
  branch, or from a branch cut from it.

The hooks need `core.hooksPath` set (see [Installation](#installation)). The CI job is
the only guard that works in a fresh clone. The hooks are the only guards the
repository owner cannot bypass, because the rulesets on `main` and `Development` exempt
the admin role unconditionally: a required status check is a red light the owner can
still drive through.

## License

Placer is open source under the [GNU Affero General Public License v3.0](LICENSE).

## Support

For bugs and questions, open an issue on GitHub, use the bug report button in the app,
or email [info@plcr.org](mailto:info@plcr.org).
