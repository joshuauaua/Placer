# Street View Line Extractor

A standalone, **non-AI** command-line tool that turns a Street View / Google
Maps screenshot into a transparent-background RGBA PNG containing high-contrast
lines for road edges, lane markings, curbs, and tree/vegetation outlines. It
uses classical computer vision only (OpenCV: bilateral/Gaussian denoise,
Canny edge detection, `HoughLinesP`, HSV colour masking) — no machine
learning, no external services.

This tool is not wired into the PLOT app. It's a script you run by hand
against an exported screenshot. See "Using the output in PLOT" below.

## Install

```bash
cd tools/streetview_lines
python3 -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

`requirements.txt` pulls the full `opencv-python` (bundles Qt/GUI bits it
doesn't need here). If you're running this in CI or a headless container,
swap it for the lighter `opencv-python-headless` instead — same API, no GUI
dependency.

## Run

```bash
# Basic — writes <input_stem>_lines.png next to the input
python3 extract_lines.py path/to/screenshot.png

# Explicit output path
python3 extract_lines.py screenshot.png -o overlay.png

# Print per-class feature counts (fastest signal for "too noisy" vs "too sparse")
python3 extract_lines.py screenshot.png --stats

# Dump intermediate stages next to the output for tuning
# (<stem>_grey.png, <stem>_canny.png, <stem>_green_mask.png, <stem>_marking_mask.png)
python3 extract_lines.py screenshot.png --debug

# Self-check the pipeline on a synthetic frame — no screenshot needed
python3 extract_lines.py --selftest
```

Worked tuning example — too many artifacts on cobblestone/gravel:

```bash
python3 extract_lines.py screenshot.png \
    --canny-low 80 --canny-high 200 --hough-min-line-length 120
```

Every hyperparameter documented below is also a CLI flag (`--canny-low`,
`--sky-fraction`, etc. — run `--help` for the full list), so tuning never
requires editing the script. Flags override the module constants; the
constants remain the single source of truth for defaults.

## Hyperparameters

All constants live at the top of `extract_lines.py`. Each has an inline
comment explaining which direction to move it; summarized here:

| Constant | Default | What it controls |
|---|---|---|
| `RESIZE_MAX_WIDTH` | `1600` | Downscale wide inputs before detection; smaller = faster, fewer thin-texture lines |
| `BILATERAL_D` / `BILATERAL_SIGMA_COLOR` / `BILATERAL_SIGMA_SPACE` | `9 / 75 / 75` | Edge-preserving denoise that kills asphalt grain; raise sigmas if asphalt speckle survives |
| `GAUSSIAN_KSIZE` | `(5, 5)` | Extra blur before Canny; raise to `(7,7)` for very noisy JPEGs, `(3,3)` if lines vanish |
| `USE_CLAHE` / `CLAHE_CLIP` | `True / 2.0` | Local contrast boost so curbs in shadow still register; lower clip if noise amplifies |
| `CANNY_LOW` / `CANNY_HIGH` | `50 / 150` | **Primary noise knob.** Too many artifacts → raise both (e.g. 80/200); too few lines → lower (30/90). Keep ~1:3 ratio |
| `HOUGH_THRESHOLD` | `60` | Votes needed per line; raise to drop spurious short lines |
| `HOUGH_MIN_LINE_LENGTH` | `60` | **Primary clutter knob.** Raise (100–150) to keep only long road edges; lower to catch dashes |
| `HOUGH_MAX_LINE_GAP` | `12` | Raise (25–40) to bridge dashed lane markings into one line; too high merges unrelated edges |
| `SKY_FRACTION` | `0.42` | Top fraction of the frame ignored for road lines (suppresses skyline/building/window edges). Raise if buildings still produce lines; lower for a high-pitch camera |
| `ANGLE_HORIZONTAL_MAX_DEG` | `12` | Below this ⇒ cross-scene feature (crosswalk / far curb) |
| `ANGLE_VERTICAL_MIN_DEG` | `72` | Above this ⇒ vertical structure (poles, building corners) |
| `DRAW_VERTICALS` | `True` | Set `False` to drop poles/facade edges entirely |
| `MARKING_DETECTION` | `True` | Second Hough pass on a bright-paint mask, for lane markings specifically |
| `MARKING_S_MAX` / `MARKING_V_MIN` | `60 / 175` | Paint = low saturation, high value. Lower `V_MIN` for overcast/worn paint |
| `GREEN_HSV_LOWER` / `GREEN_HSV_UPPER` | `(30, 40, 40)` / `(90, 255, 255)` | OpenCV hue is **0–179**. Widen to `(25,30,30)`–`(95,255,255)` for autumn/dry foliage; narrow the hue span if grey-green roofs leak in |
| `VEG_MORPH_KERNEL` | `(7, 7)` | Open→close to despeckle the mask; raise to merge canopy blobs |
| `VEG_MIN_AREA_FRAC` | `0.0008` | Drop contours smaller than this fraction of frame area (resolution-independent) |
| `VEG_APPROX_EPS_FRAC` | `0.006` | `approxPolyDP` epsilon as a fraction of contour perimeter; raise for blockier, cleaner outlines |
| `STROKE_ROAD_EDGE` / `STROKE_MARKING` / `STROKE_VERTICAL` / `STROKE_VEG` | `3 / 3 / 2 / 3` | Stroke widths in px |
| `COLOR_ROAD_EDGE` | `(0, 255, 255)` cyan | RGB |
| `COLOR_MARKING` | `(255, 235, 0)` yellow | |
| `COLOR_HORIZONTAL` | `(255, 0, 200)` magenta | Crosswalks / cross-scene curbs |
| `COLOR_VERTICAL` | `(140, 160, 255)` pale blue | |
| `COLOR_VEG` | `(0, 255, 90)` bright green | |
| `ANTIALIAS` | `False` | `False` = fully opaque solid vectors. `True` = softer strokes with partial alpha |

## Troubleshooting

| Symptom | Knob |
|---|---|
| Too many noisy artifacts | Raise `--canny-low`/`--canny-high` (keep ~1:3 ratio), raise `--hough-min-line-length` |
| No lines detected at all | Lower `--canny-low`/`--canny-high`, lower `--hough-min-line-length`, check `--debug`'s `_canny.png` first |
| Dashed lane markings broken into fragments | Raise `--hough-max-line-gap` |
| Buildings/skyline detected as road lines | Raise `--sky-fraction` |
| Trees missed in autumn / dry foliage | Widen `--green-hsv-lower`/`--green-hsv-upper` (e.g. `25,30,30` to `95,255,255`) |
| Whole canopy filled instead of outlined | Lower `VEG_APPROX_EPS_FRAC` for a tighter outline, or raise `VEG_MORPH_KERNEL` to merge fragmented blobs into one contour first |
| Google Maps UI chrome (zoom buttons, the pegman, the Map/Satellite toggle, the copyright watermark) shows up as extra straight-edge or text-blob lines | These sit outside `SKY_FRACTION`'s reach and this tool has no in-tool cropping option. Crop them out of the PNG before running the tool (e.g. with Pillow: `Image.open(...).crop(...)`) |

When in doubt, run with `--debug` and look at `_canny.png` first — it's the
most direct signal for "too much" vs "too little" line detection, before the
Hough/classification stages even run.

## Using the output in PLOT

PLOT's `handleCaptureView` (in
[`src/components/MapContainer.jsx`](../../src/components/MapContainer.jsx))
captures the live Maps/Street View `<div>` with `html-to-image`'s `toPng()`
and holds the result as a base64 data URL on `capturedView.screenshot` — it's
never written to disk and there's no export/download button in the app
today. To feed a screenshot to this tool, you currently have to get that
data URL onto disk by hand, e.g. by pasting it into a browser address bar
and saving, or `atob`-decoding it in devtools.

Once you have a PNG file:

```bash
python3 extract_lines.py capture.png -o overlay.png
```

Drop the resulting transparent `overlay.png` in `public/overlays/` so it can
be fed to the Konva background/asset layer the same way
`capturedView.screenshot` is today. This is documentation only — building an
export button or wiring the overlay into the React app is out of scope for
this tool (see "Out of scope" below).

## Out of scope

This plan is documentation + a standalone script only. It does **not**
include:

- Wiring the overlay into the React app or the Konva canvas
- Capturing real Street View POV metadata (heading/pitch/fov) in
  `MapContainer.jsx` — it currently hardcodes `heading: 0, pitch: 0`
- An export/download button for `capturedView.screenshot`
- Any actual implementation of the GIS/Overpass/pyproj approach outlined
  below

## Appendix: alternative approach — GIS vector projection

Instead of extracting lines from pixels, an alternative approach projects
real-world vector data (OpenStreetMap) into the camera's image plane using
the Street View pano's own metadata. This is geometrically exact where the
pixel-based CV approach above is a noisy approximation, but it depends on
data PLOT does not currently capture. Outlined here, not implemented.

1. **Metadata needed**: pano `lat/lon`, `heading` (degrees from north),
   `pitch`, `fov`, output `W×H`, and an assumed camera height (≈2.5 m). PLOT
   does not capture these yet —
   [`MapContainer.jsx`](../../src/components/MapContainer.jsx) hardcodes
   `pov: { heading: 0, pitch: 0 }` on capture. The Street View Image
   Metadata endpoint, or the JS API's `panorama.getPov()` /
   `getPosition()`, would supply real values.
2. **Fetch vectors**: query the Overpass API within ~80 m of the pano
   position for `way[highway]` (road centrelines + width), `node[natural=tree]`
   and `way[natural=tree_row]` (vegetation), and `way[barrier=kerb]` (curbs).
3. **Convert to a metric local frame**: transform lat/lon to a local ENU
   (East-North-Up) frame centred on the camera, in metres, using a `pyproj`
   `Transformer` to a local azimuthal-equidistant or UTM CRS. `U = 0` at
   road level.
4. **Camera intrinsics**: `f = (W / 2) / tan(radians(fov) / 2)`,
   `cx = W / 2`, `cy = H / 2`.
5. **Camera extrinsics**: rotate by yaw `R_z(-heading)` then pitch
   `R_x(pitch)`; the camera looks down its local `+Z` axis.
   `p_cam = R^T · (P_world − C)` for camera position `C`.
6. **Project**: `u = f · x_cam / z_cam + cx`, `v = f · y_cam / z_cam + cy`,
   keeping only points with `z_cam > z_near` (≈0.5 m) — clip each road
   segment against the near plane *before* projecting, so segments that
   cross behind the camera don't smear across the frame.
7. **Draw**: offset road centrelines laterally by `width / 2` for the two
   edges; represent each tree as a base point at `U = -camera_height` and a
   crown point at `U = -camera_height + tree_height`; render with Pillow's
   `ImageDraw` onto an `Image.new("RGBA", (W, H), (0, 0, 0, 0))` canvas —
   the same alpha=0 transparent-background convention as the CV pipeline.
8. **Trade-offs**: geometrically exact, no pixel noise, features come
   pre-labelled by OSM tag, and occlusion ordering falls out of the
   projected depth — but it depends on OSM completeness in the area, on
   accurate pano heading/pitch (which PLOT doesn't capture today), and on a
   flat-ground assumption (hills or tall kerbs would need a DEM). It cannot
   see anything OSM doesn't record.
9. Extra dependencies this route would need if built: `requests` or
   `overpy` (Overpass API client), `pyproj` (CRS transforms).
