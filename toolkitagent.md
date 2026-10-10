# Toolkit Agent

Guide for creating a new toolkit tool in PLACER.

## What the toolkit is

The Toolkit hosts PLACER's tools: participatory placemaking methods, each made by an
organisation, turned into something people can use in a browser. Every tool is in one
of three categories — **Understand** how a place is used, **Imagine** how it could
change, or **Plan** that change in one place. Each tool is a self-contained React
component with its own logic, rendered inside a shared layout that handles navigation,
theming, and optional multi-player rooms.
Nothing is saved unless you open a room for other people to join.

## Anatomy of a tool

Every tool has four parts:

1. **Cover page** — the first thing a visitor sees, drawn from the registry entry (see [The cover page](#the-cover-page))
2. **Registry entry** in `src/toolkit/tools.js` — metadata and wiring
3. **Component** in `src/components/toolkit/` — the interactive UI
4. **Logic module** in `src/lib/` — pure functions and constants (no React)

Write the cover page first, by filling in the registry entry's fields. Doing so
forces the tool's question, audience and length to be settled before any of
the tool is.

Optional: a fourth part for multi-player room support (see [Rooms](#rooms)).

## Registry entry

Add an entry to the `TOOLS` array in `src/toolkit/tools.js`:

```js
{
  id: 'my-tool',
  name: 'My Tool',
  tagline: 'One line that makes people curious.',
  blurb: 'A longer paragraph shown at the top of the tool view. Explains what the visitor is looking at and what they can do.',
  color: '#5A3ED6',
  icon: 'flask',
  category: 'understand',
  createdBy: 'Your Organisation',
  component: MyTool,
}
```

### Categories

Every tool is in one of three categories, which the Toolkit lists it under
(`CATEGORIES` in `src/toolkit/tools.js`):

| `category` | Shown as | For tools that… |
|-----------|----------|-----------------|
| `understand` | Understand | show how a place is used today: observation, mapping, surveys. |
| `imagine` | Imagine | explore how a place could change. |
| `plan` | Plan | help a group decide on the change together: voting, budgeting. |

Pick the one that describes what someone gets out of the tool, not how it works.

### Required fields

| Field | Type | Purpose |
|-------|------|---------|
| `id` | string | URL slug. The tool lives at `/toolkit/{id}`. |
| `name` | string | Display heading in the layout header and on the tile. |
| `tagline` | string | Short teaser shown on the tile card. One sentence. |
| `blurb` | string | Longer description shown in the tool header. |
| `color` | string | Accent hex colour. Used for the tile gradient, slider tracks, meter fills. |
| `icon` | string | Icon name from the `Icon` component (see `src/components/Icon.jsx`). |
| `category` | string | `'understand'`, `'imagine'` or `'plan'`. See Categories above. |
| `createdBy` | string | The organisation whose method this is. Shown as "By …" on the tile, cover and header. |
| `component` | Component | The React component that renders the tool. |

### Optional fields

| Field | Type | Purpose |
|-------|------|---------|
| `duration` | string | Roughly how long it takes, e.g. `'About 3 minutes'`. Shown on the cover page. |

### Choosing a colour

Pick a colour that contrasts with the other tools and suits the topic. Current
palette: blue (`#2F7BD6`), pink (`#D4407E`), green (`#3E9D4E`), orange (`#E08A2B`).
The colour is used at full opacity on slider tracks and at 15-22% opacity on tile
backgrounds, so it should look good both ways.

### Choosing an icon

Browse `src/components/Icon.jsx` for available names. Toolkit-appropriate icons
include `flask`, `section`, `path`, `walk`, `coins`, `tree`, `bench`, `light`,
`play`, `cart`, `bike`. If none fit, add a new 24x24 SVG to the `Icon` component
following the existing hand-drawn style (stroke-based, `viewBox="0 0 24 24"`).

## The cover page

Every tool opens on a cover page, not on the tool. A visitor arriving from
the gallery, a shared link or a room's QR code should know what they are about to
do before they are asked to do it. The tool appears only once they press
**Get started**.

You do not build the cover. `ToolkitPage` renders it for every tool
(`src/components/toolkit/ToolCover.jsx`), in the same split layout as the site's User Labs page:
a block of the tool's `color` with its `icon` fills the left half, and the
right half carries, in order:

- **The category** — `category`, as the label above the name.
- **The name** — `name`, as the page heading.
- **The tagline** — `tagline`, as a bold subtitle.
- **What it is and what you will do** — `blurb`.
- **How long it takes and who made it** — `duration` (optional) and `createdBy`.
- **The Get started button.**

So the cover is only as good as the registry entry. Write those fields as the pitch
for the tool, and fill them in first: settling the question, the audience and
the length before building any of the tool is the point.

In a room, participants see the cover too, and the tool (with its `room.publish`
calls) only mounts once they press Get started, so nobody counts as taking part
until they have begun.

## The component

Create a file in `src/components/toolkit/YourTool.jsx`. Follow this pattern:

```jsx
import { useState } from 'react';
import { Meter, Panel, Readout } from '../ToolLayout';
import { Btn } from '../UI';

export function MyTool({ t, tool }) {
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

export default MyTool;
```

### Props

| Prop | Type | Purpose |
|------|------|---------|
| `t` | object | Theme tokens. Use for all colours and spacing. |
| `tool` | object | This tool's registry entry. Use `tool.color` for accent. |
| `room` | object | Room state (only present when a room is active). See [Rooms](#rooms). |

### Export convention

Always provide both a named and default export:

```js
export function MyTool({ t, tool }) { ... }
export default MyTool;
```

### Layout

The shared layout (`ToolLayout`) renders:
- A back button to `/toolkit`
- A header with the tool icon, name, and blurb
- An actions slot (for "Start a room" / "Copy link" buttons)
- Your component as `{children}`

Your component fills the content area below the header. Use a two-column grid:

- **Left column** — the interactive element (canvas, sliders, map, calculator)
- **Right column** — stacked `Panel` components with readouts and explanations

### Styling rules

- **All styling is inline.** No CSS modules, no styled-components, no external CSS files.
- Use theme tokens (`t.ink`, `t.inkDim`, `t.surface`, `t.line`, etc.) for all colours.
- Use `tool.color` for accent elements (slider tracks, highlights, meter fills).
- Cards/panels: `background: t.surface`, `border: 1px solid ${t.line}`, `borderRadius: 12`, `padding: 20`, `boxShadow: t.shadow`.
- Buttons: use `Btn` from `UI.jsx` with `variant="primary"`, `"accent"`, `"outline"`, or `"ghost"`.
- Typography: headings use `letterSpacing: '-0.02em'` to `-0.03em`. Labels use `fontSize: 12.5`, `fontWeight: 700`, uppercase monospace (`className="placer-mono"`).
- Large numbers: use `className="placer-disp"` with `fontWeight: 800` or `900`.

### Shared components

Import from `src/components/ToolLayout.jsx`:

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

Tools are typically one of these:

| Pattern | Example | Key elements |
|---------|---------|-------------|
| Calculator / slider tool | Co-Budget | Range sliders, live readouts, budget caps |
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

Keep pure logic separate from the component. Place it in `src/lib/yourTool.js`.

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

## Registering the tool

Once the component and logic are ready, wire them into `src/toolkit/tools.js`:

```js
import MyTool from '../components/toolkit/MyTool';

export const TOOLS = [
  // ... existing tools ...
  {
    id: 'my-tool',
    name: 'My Tool',
    tagline: '...',
    blurb: '...',
    color: '#5A3ED6',
    icon: 'flask',
    createdBy: 'Your Organisation',
    component: MyTool,
  },
];
```

The tool will automatically appear on the Toolkit page, be reachable at
`/toolkit/my-tool`, and show up in the tile grid.

## Rooms

Rooms let a facilitator open a session that other people join with a QR code or PIN.
Most tools do not need rooms. Only add room support if the tool benefits
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

2. Add the tool id to the CHECK constraint in `supabase/rooms.sql`:

```sql
check (tool in ('budget-ballot', 'my-tool'));
```

3. Use the `room` prop in your component:

```jsx
export function MyTool({ t, tool, room }) {
  // room.combined is the aggregate of all participants' states.
  // room.participantCount is how many people are in the room.
  // room.publish(state) sends this participant's state to the server (debounced).
}
```

Opening a room requires a signed-in account. Joining one does not.

A room lasts two hours by default. Opened from a project's dashboard, it can instead
stay open for a week, 30 or 90 days — a poll on a poster rather than a workshop — and
is joined by the code in its QR link instead of a PIN (`supabase/rooms-lifetime.sql`).
Your tool needs nothing extra for this: `room.combined` and `room.publish` work
the same, so do not assume everybody is in the room at the same time.

### Setting the tool up for a room

A room-capable tool can also have a `setup`: what the organiser chooses before the
room opens, so a tool run for a project is about that project's place. The Budget
Ballot's is its budget and which things are on the ballot.

```js
setup: {
  defaults() { return { /* the setup a new room starts from */ }; },
  problems(setup) { return [/* what is wrong, as sentences; empty when it can open */]; },
  Form: MyToolSetup, // ({ t, tool, setup, onChange }) — edits it, nothing more
},
```

"Start a room" then opens the setup in place of the tool, and the room opens with it.
It is fixed for the room's whole life (`supabase/rooms-config.sql`) and reaches your
component as `room.config` — null outside a room, and in a room opened without one, so
the tool has to work either way. Keep `defaults()` to a setup `problems()` accepts; the
registry tests check it.

## File structure

```
src/
  toolkit/
    tools.js              # Registry — add your entry here
  components/
    toolkit/
      YourTool.jsx       # Your component
      ToolCover.jsx         # Cover page, drawn from the registry entry (do not edit)
    ToolkitPage.jsx             # Page (do not edit)
    ToolLayout.jsx           # Layout + Panel, Readout, Meter
  lib/
    yourTool.js           # Pure logic and constants
    toolkit/                    # Additional logic files (if needed)
```

## Scope rules

The scope checker (`scripts/check-sandbox-scope.mjs`) runs on every PR and ensures
toolkit contributions stay within toolkit boundaries. These paths are allowed:

- `src/toolkit/**`
- `src/components/toolkit/**`
- `src/components/ToolkitPage.jsx`
- `src/components/ToolLayout.jsx`
- `src/lib/toolkit/**`
- `src/lib/yourTool.js` (the specific tool library file)
- `src/components/__tests__/Toolkit*.test.jsx`

These paths are **denied** (security-sensitive room layer, reviewed separately):

- `src/toolkit/rooms.js`
- `src/toolkit/__tests__/rooms.test.js`
- `src/components/toolkit/RoomBar.jsx`
- `src/components/toolkit/useRoom.js`

## Testing

Write tests in `src/components/__tests__/ToolkitTools.test.jsx`. Follow the existing
pattern: mount the tool with `t={THEME}` and `tool={findTool(id)}`.
The component is mounted on its own there, so there is no cover page in the way.

```jsx
describe('MyTool', () => {
  it('renders without crashing', () => {
    render(<MyTool t={THEME} tool={findTool('my-tool')} />);
    // ... assert the tool is showing
  });

  it('responds to user interaction', () => {
    render(<MyTool t={THEME} tool={findTool('my-tool')} />);
    // ... interact and assert
  });
});
```

Tests that mount the whole `ToolkitPage` (as `ToolkitPage.test.jsx` and
`ToolkitRoom.test.jsx` do) land on the cover page first, and press
**Get started** to reach the tool.

If the tool has room support, also add room tests in
`src/components/__tests__/ToolkitRoom.test.jsx` and registry tests in
`src/toolkit/__tests__/tools.test.js`.
