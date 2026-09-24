# Sandbox Agent

Guide for creating a new sandbox experiment in PLACER.

## What the sandbox is

The sandbox is an experimental space where visitors interact with quick, focused tools
that explore an idea about public space. Each experiment is a self-contained React
component with its own logic, rendered inside a shared layout that handles navigation,
theming, and optional multi-player rooms.

Sandbox experiments are not proposals. They are somewhere to find out what you think.
Nothing is saved unless you open a room for other people to join.

## Anatomy of an experiment

Every experiment has four parts:

1. **Cover page** — the first thing a visitor sees, drawn from the registry entry (see [The cover page](#the-cover-page))
2. **Registry entry** in `src/sandbox/experiments.js` — metadata and wiring
3. **Component** in `src/components/sandbox/` — the interactive UI
4. **Logic module** in `src/lib/` — pure functions and constants (no React)

Write the cover page first, by filling in the registry entry's fields. Doing so
forces the experiment's question, audience and length to be settled before any of
the tool is.

Optional: a fourth part for multi-player room support (see [Rooms](#rooms)).

## Registry entry

Add an entry to the `EXPERIMENTS` array in `src/sandbox/experiments.js`:

```js
{
  id: 'my-experiment',
  name: 'My Experiment',
  tagline: 'One line that makes people curious.',
  blurb: 'A longer paragraph shown at the top of the experiment view. Explains what the visitor is looking at and what they can do.',
  color: '#5A3ED6',
  icon: 'flask',
  submittedBy: 'your-username',
  component: MyExperiment,
}
```

### Required fields

| Field | Type | Purpose |
|-------|------|---------|
| `id` | string | URL slug. The experiment lives at `/sandbox/{id}`. |
| `name` | string | Display heading in the layout header and on the tile. |
| `tagline` | string | Short teaser shown on the tile card. One sentence. |
| `blurb` | string | Longer description shown in the experiment header. |
| `color` | string | Accent hex colour. Used for the tile gradient, slider tracks, meter fills. |
| `icon` | string | Icon name from the `Icon` component (see `src/components/Icon.jsx`). |
| `submittedBy` | string | Username or team name of who built the experiment. Shown on the tile, cover and header. |
| `component` | Component | The React component that renders the experiment. |

### Optional fields

| Field | Type | Purpose |
|-------|------|---------|
| `duration` | string | Roughly how long it takes, e.g. `'About 3 minutes'`. Shown on the cover page. |

### Choosing a colour

Pick a colour that contrasts with the other experiments and suits the topic. Current
palette: blue (`#2F7BD6`), pink (`#D4407E`), green (`#3E9D4E`), orange (`#E08A2B`).
The colour is used at full opacity on slider tracks and at 15-22% opacity on tile
backgrounds, so it should look good both ways.

### Choosing an icon

Browse `src/components/Icon.jsx` for available names. Sandbox-appropriate icons
include `flask`, `section`, `path`, `walk`, `coins`, `tree`, `bench`, `light`,
`play`, `cart`, `bike`. If none fit, add a new 24x24 SVG to the `Icon` component
following the existing hand-drawn style (stroke-based, `viewBox="0 0 24 24"`).

## The cover page

Every experiment opens on a cover page, not on the tool. A visitor arriving from
the gallery, a shared link or a room's QR code should know what they are about to
do before they are asked to do it. The tool appears only once they press
**Get started**.

You do not build the cover. `SandboxPage` renders it for every experiment
(`src/components/sandbox/SandboxCover.jsx`), in the same split layout as the site's User Labs page:
a block of the experiment's `color` with its `icon` fills the left half, and the
right half carries, in order:

- **The name** — `name`, as the page heading.
- **The tagline** — `tagline`, as a bold subtitle.
- **What it is and what you will do** — `blurb`.
- **How long it takes and who made it** — `duration` (optional) and `submittedBy`.
- **The Get started button.**

So the cover is only as good as the registry entry. Write those fields as the pitch
for the experiment, and fill them in first: settling the question, the audience and
the length before building any of the tool is the point.

In a room, participants see the cover too, and the tool (with its `room.publish`
calls) only mounts once they press Get started, so nobody counts as taking part
until they have begun.

## The component

Create a file in `src/components/sandbox/YourExperiment.jsx`. Follow this pattern:

```jsx
import { useState } from 'react';
import { Meter, Panel, Readout } from '../SandboxLayout';
import { Btn } from '../UI';

export function MyExperiment({ t, experiment }) {
  const [value, setValue] = useState(0);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.6fr) minmax(280px, 1fr)',
      gap: 20,
      alignItems: 'start',
    }}>
      {/* Left: the interactive canvas */}
      <div style={{ background: t.surface, borderRadius: 12, border: `1px solid ${t.line}`,
        padding: 20, boxShadow: t.shadow }}>
        {/* Your interactive UI goes here */}
      </div>

      {/* Right: readout panels */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
        <Panel t={t} title="Result">
          <Readout t={t} value={value} label="units" />
        </Panel>
        <Panel t={t} title="How it works">
          <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6 }}>
            Explain what the visitor is seeing.
          </p>
        </Panel>
      </div>
    </div>
  );
}

export default MyExperiment;
```

### Props

| Prop | Type | Purpose |
|------|------|---------|
| `t` | object | Theme tokens. Use for all colours and spacing. |
| `experiment` | object | This experiment's registry entry. Use `experiment.color` for accent. |
| `room` | object | Room state (only present when a room is active). See [Rooms](#rooms). |

### Export convention

Always provide both a named and default export:

```js
export function MyExperiment({ t, experiment }) { ... }
export default MyExperiment;
```

### Layout

The shared layout (`SandboxLayout`) renders:
- A back button to `/sandbox`
- A header with the experiment icon, name, and blurb
- An actions slot (for "Start a room" / "Copy link" buttons)
- Your component as `{children}`

Your component fills the content area below the header. Use a two-column grid:

- **Left column** — the interactive element (canvas, sliders, map, calculator)
- **Right column** — stacked `Panel` components with readouts and explanations

### Styling rules

- **All styling is inline.** No CSS modules, no styled-components, no external CSS files.
- Use theme tokens (`t.ink`, `t.inkDim`, `t.surface`, `t.line`, etc.) for all colours.
- Use `experiment.color` for accent elements (slider tracks, highlights, meter fills).
- Cards/panels: `background: t.surface`, `border: 1px solid ${t.line}`, `borderRadius: 12`, `padding: 20`, `boxShadow: t.shadow`.
- Buttons: use `Btn` from `UI.jsx` with `variant="primary"`, `"accent"`, `"outline"`, or `"ghost"`.
- Typography: headings use `letterSpacing: '-0.02em'` to `-0.03em`. Labels use `fontSize: 12.5`, `fontWeight: 700`, uppercase monospace (`className="placer-mono"`).
- Large numbers: use `className="placer-disp"` with `fontWeight: 800` or `900`.

### Shared components

Import from `src/components/SandboxLayout.jsx`:

| Component | Purpose |
|-----------|---------|
| `Panel` | Card with optional title and aside slot. |
| `Readout` | Headline number with label, unit, and optional delta. |
| `Meter` | Horizontal bar (0-1, or signed for left-of-centre). |
| `PresetRow` | Row of preset `Chip` buttons. |

Import from `src/components/UI.jsx`:

| Component | Purpose |
|-----------|---------|
| `Btn` | Button with variants and icons. |
| `Chip` | Toggle/preset pill button. |
| `CopyButton` | Copies text to clipboard with feedback. |

### Interactive patterns

Experiments are typically one of these:

| Pattern | Example | Key elements |
|---------|---------|-------------|
| Calculator / slider tool | Budget Ballot | Range sliders, live readouts, budget caps |
| Drag-to-resize | Street Mixer | Dividers with `role="separator"`, keyboard nudge |
| Click-to-place map | 15-Minute Reach | SVG grid, roving cursor, keyboard navigation |
| Draw-and-measure | Desire Lines | SVG canvas, drag-to-draw, destination markers |

### Accessibility

- Use `aria-pressed` on toggle buttons.
- Use `role="separator"` with `aria-valuenow` / `aria-valuemin` / `aria-valuemax` on draggable dividers.
- Use `role="status"` with `aria-live="polite"` for dynamic readouts.
- Support keyboard interaction: Arrow keys for navigation, Enter/Space for activation.
- Use `role="img"` with `aria-label` on decorative SVG elements.

## The logic module

Keep pure logic separate from the component. Place it in `src/lib/yourExperiment.js`.

```js
// Constants
export const ITEM_LIST = [ ... ];

// Pure functions
export function calculate(state) { ... }
export function formatResult(value) { ... }
```

This separation keeps the component focused on rendering and the logic testable
without a DOM. Follow the pattern of `budgetBallot.js`, `streetSection.js`,
`desireLines.js`, or `reachGrid.js`.

## Registering the experiment

Once the component and logic are ready, wire them into `src/sandbox/experiments.js`:

```js
import MyExperiment from '../components/sandbox/MyExperiment';

export const EXPERIMENTS = [
  // ... existing experiments ...
  {
    id: 'my-experiment',
    name: 'My Experiment',
    tagline: '...',
    blurb: '...',
    color: '#5A3ED6',
    icon: 'flask',
    submittedBy: 'your-username',
    component: MyExperiment,
  },
];
```

The experiment will automatically appear on the Sandbox page, be reachable at
`/sandbox/my-experiment`, and show up in the tile grid.

## Rooms

Rooms let a facilitator open a session that other people join with a QR code or PIN.
Most experiments do not need rooms. Only add room support if the experiment benefits
from group participation.

To enable rooms:

1. Add a `room` object to the registry entry:

```js
room: {
  empty() {
    // Return the initial state for one participant.
    return { /* ... */ };
  },
  combine(states) {
    // Fold all participants' states into one aggregate.
    // This runs on the facilitator's browser.
    return { /* ... */ };
  },
}
```

2. Add the experiment id to the CHECK constraint in `supabase/rooms.sql`:

```sql
check (experiment in ('budget-ballot', 'my-experiment'));
```

3. Use the `room` prop in your component:

```jsx
export function MyExperiment({ t, experiment, room }) {
  // room.combined is the aggregate of all participants' states.
  // room.participantCount is how many people are in the room.
  // room.publish(state) sends this participant's state to the server (debounced).
}
```

Opening a room requires a signed-in account. Joining one does not.

A room lasts two hours by default. Opened from a project's dashboard, it can instead
stay open for a week, 30 or 90 days — a poll on a poster rather than a workshop — and
is joined by the code in its QR link instead of a PIN (`supabase/rooms-lifetime.sql`).
Your experiment needs nothing extra for this: `room.combined` and `room.publish` work
the same, so do not assume everybody is in the room at the same time.

## File structure

```
src/
  sandbox/
    experiments.js              # Registry — add your entry here
  components/
    sandbox/
      YourExperiment.jsx       # Your component
      SandboxCover.jsx         # Cover page, drawn from the registry entry (do not edit)
    SandboxPage.jsx             # Page (do not edit)
    SandboxLayout.jsx           # Layout + Panel, Readout, Meter
  lib/
    yourExperiment.js           # Pure logic and constants
    sandbox/                    # Additional logic files (if needed)
```

## Scope rules

The scope checker (`scripts/check-sandbox-scope.mjs`) runs on every PR and ensures
sandbox contributions stay within sandbox boundaries. These paths are allowed:

- `src/sandbox/**`
- `src/components/sandbox/**`
- `src/components/SandboxPage.jsx`
- `src/components/SandboxLayout.jsx`
- `src/lib/sandbox/**`
- `src/lib/yourExperiment.js` (the specific experiment library file)
- `src/components/__tests__/Sandbox*.test.jsx`

These paths are **denied** (security-sensitive room layer, reviewed separately):

- `src/sandbox/rooms.js`
- `src/sandbox/__tests__/rooms.test.js`
- `src/components/sandbox/RoomBar.jsx`
- `src/components/sandbox/useRoom.js`

## Testing

Write tests in `src/components/__tests__/SandboxTools.test.jsx`. Follow the existing
pattern: mount the experiment with `t={THEME}` and `experiment={findExperiment(id)}`.
The component is mounted on its own there, so there is no cover page in the way.

```jsx
describe('MyExperiment', () => {
  it('renders without crashing', () => {
    render(<MyExperiment t={THEME} experiment={findExperiment('my-experiment')} />);
    // ... assert the tool is showing
  });

  it('responds to user interaction', () => {
    render(<MyExperiment t={THEME} experiment={findExperiment('my-experiment')} />);
    // ... interact and assert
  });
});
```

Tests that mount the whole `SandboxPage` (as `SandboxPage.test.jsx` and
`SandboxRoom.test.jsx` do) land on the cover page first, and press
**Get started** to reach the tool.

If the experiment has room support, also add room tests in
`src/components/__tests__/SandboxRoom.test.jsx` and registry tests in
`src/sandbox/__tests__/experiments.test.js`.
