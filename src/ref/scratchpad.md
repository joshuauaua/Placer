# PLOT — "Reimagine Your City" — Placemaking app mockup

Desktop web app · static hi-fi screens · bold & modern, high-contrast editorial.
Presented on a design canvas. Realistic (Google/Mapbox-style) map tiles, mocked in SVG.

## Product name
**PLOT** — wordmark in Archivo Expanded. Double meaning: a plot of land + to plot a
change on the map. Tagline / subtitle: *Reimagine Your City.*
The user-generated proposals are called **Imaginations**.

## Design language
- Type: Archivo Expanded (display/wordmark/big numbers), Archivo (UI/body),
  Space Mono (coordinates, tags, vote counts, metadata — cartographic data texture).
- Signal accent: electric lime #D7FB36. Ink #14130E. Paper/bone #EDE9DF.
- Editorial: big type, hard grid lines, generous negative space, mono micro-labels,
  no rounded-corner-+-left-border cards, no gradient slop.
- Category color coding (solid, editorial):
  Green space #3E9D4E · Public seating #E08A2B · Art & culture #D4407E ·
  Play & recreation #7A52E0 · Safety & lighting #2F7BD6 · Food & markets #D6452F

## Themes (visual directions)
- **Bone** (primary flow): warm paper chrome, light realistic map, ink + lime signal.
- **Ink**: dark chrome, dark map tiles, lime pins — striking night-mode.
- **Signal**: light chrome, electric-blue (#2D5BFF) accent instead of lime.

## Map mock (SVG)
Land + water (river) + park polygons + road network (casing + fill, major vs minor) +
street labels in mono + category pins (teardrop w/ icon) + one numbered cluster +
selected-pin preview popover. Light + dark palettes.

## Street scene (asset-placement diorama)
Flat editorial 3/4 diorama: sky band + far skyline + building facades row + sidewalk
band (assets sit here) + foreground road w/ lane markings. Placed assets: bench,
planter, tree drawn as clean flat SVG. Placement guides + selection handles on one.

## Asset library
Bench · Flowerpot/planter · Tree · Bike rack · Lighting · Playground — line-icon grid.

## Screens (1440×900 desktop)
CORE FLOW (Bone theme):
1. Map Home — top nav (PLOT · search · avatar + Create), left rail (categories,
   sort: Trending/New/Top, Imagination list cards), map w/ pins + selected popover,
   map controls.
2. Search & Filter — query filled, category filter panel open, sort=Top voted,
   result count, filtered list + highlighted pins.
3. Street View — Place Assets — diorama scene, right asset-library panel w/ tabs,
   3 placed assets, edit toolbar (move/rotate/delete, undo/redo), step nav
   "1 Place · 2 Describe · 3 Post", Next button.
4. Create — Describe & Post — before/after toggle of scene, Title + Description
   fields, category select, location label + coords, assets-used chips, Post button.
5. Imagination Detail — big before/after hero, title, author+time, location, category,
   description, vote control (upvotes + rank #), like/comment/share row, comments
   thread (3) + add-comment field, nearby-imaginations rail.

VISUAL DIRECTIONS:
- Map Home rendered in Bone / Ink / Signal for side-by-side comparison.

## Title style
Screen/section titles = short topic noun-phrases (Map Home, Search & Filter,
Street View, Create, Imagination Detail).

## File split
- ds.css        fonts, reset, keyframes, scrollbar hiding
- tokens.jsx    THEME objects + CAT colors + shared helpers
- icons.jsx     UI + asset + category icons (SVG) -> window
- map.jsx       MapCanvas (SVG tiles) + Pin
- street.jsx    StreetScene diorama + flat asset illustrations
- maphome.jsx   MapHome (themeable) + filter state
- street-screen.jsx  Street view place-assets screen
- create.jsx    compose & post screen
- detail.jsx    imagination detail screen
- app.jsx       assemble DesignCanvas (Core Flow + Visual Directions)
- Placemaking App.html  shell: fonts, scripts in order
