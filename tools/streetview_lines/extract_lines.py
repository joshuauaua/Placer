#!/usr/bin/env python3
"""Extract road/lane/curb/vegetation line overlays from a Street View style
screenshot into a transparent-background RGBA PNG.

Classical CV pipeline (no ML/AI): denoise -> Canny + HoughLinesP for
structural lines, HSV colour masking for lane markings and vegetation,
composited onto a fully transparent canvas.

Usage:
    python3 extract_lines.py INPUT.png -o OUTPUT.png
    python3 extract_lines.py --selftest

See README.md in this directory for install instructions, a tuning guide,
and an outline of the alternative OSM/pinhole-camera projection approach.
"""

from __future__ import annotations

import argparse
import math
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Sequence

import cv2
import numpy as np
from PIL import Image

# ---------------------------------------------------------------------------
# Hyperparameters. Every constant here is also exposed as a CLI flag of the
# same lowercase name (see build_config / add_cli_overrides) so tuning does
# not require editing this file. These are the single source of truth for
# defaults.
# ---------------------------------------------------------------------------

# Downscale wide inputs before detection; smaller = faster, fewer thin-texture
# lines.
RESIZE_MAX_WIDTH = 1600

# Edge-preserving denoise that kills asphalt grain; raise sigmas if asphalt
# speckle survives.
BILATERAL_D = 9
BILATERAL_SIGMA_COLOR = 75
BILATERAL_SIGMA_SPACE = 75

# Extra blur before Canny; raise to (7,7) for very noisy JPEGs, (3,3) if
# lines vanish.
GAUSSIAN_KSIZE = (5, 5)

# Local contrast boost so curbs in shadow still register; lower clip if
# noise amplifies.
USE_CLAHE = True
CLAHE_CLIP = 2.0

# Primary noise knob. Too many artifacts -> raise both (e.g. 80/200); too
# few lines -> lower (30/90). Keep ~1:3 ratio.
CANNY_LOW = 50
CANNY_HIGH = 150

# Votes needed per line; raise to drop spurious short lines.
HOUGH_THRESHOLD = 60

# Primary clutter knob. Raise (100-150) to keep only long road edges; lower
# to catch dashes.
HOUGH_MIN_LINE_LENGTH = 60

# Raise (25-40) to bridge dashed lane markings into one line; too high
# merges unrelated edges.
HOUGH_MAX_LINE_GAP = 12

# Top fraction of the frame ignored for road lines (suppresses
# skyline/building/window edges). Raise if buildings still produce lines;
# lower for a high-pitch camera.
SKY_FRACTION = 0.42

# Below this angle (degrees) a segment is a cross-scene feature (crosswalk /
# far curb).
ANGLE_HORIZONTAL_MAX_DEG = 12

# Above this angle (degrees) a segment is a vertical structure (poles,
# building corners).
ANGLE_VERTICAL_MIN_DEG = 72

# Set False to drop poles/facade edges entirely.
DRAW_VERTICALS = True

# Second Hough pass on a bright-paint mask, for lane markings specifically.
MARKING_DETECTION = True

# Paint = low saturation, high value. Lower V_MIN for overcast/worn paint.
MARKING_S_MAX = 60
MARKING_V_MIN = 175

# OpenCV hue is 0-179. Widen to (25,30,30)-(95,255,255) for autumn/dry
# foliage; narrow the hue span if grey-green roofs leak in.
GREEN_HSV_LOWER = (30, 40, 40)
GREEN_HSV_UPPER = (90, 255, 255)

# Open->close to despeckle the vegetation mask; raise to merge canopy blobs.
VEG_MORPH_KERNEL = (7, 7)

# Drop contours smaller than this fraction of frame area (resolution
# independent, hence a fraction rather than a pixel count).
VEG_MIN_AREA_FRAC = 0.0008

# approxPolyDP epsilon as a fraction of contour perimeter; raise for
# blockier, cleaner outlines.
VEG_APPROX_EPS_FRAC = 0.006

# Stroke widths in px.
STROKE_ROAD_EDGE = 3
STROKE_MARKING = 3
STROKE_VERTICAL = 2
STROKE_VEG = 3

# Colours are RGB (converted to BGR internally for OpenCV drawing).
COLOR_ROAD_EDGE = (0, 255, 255)  # cyan
COLOR_MARKING = (255, 235, 0)  # yellow
COLOR_HORIZONTAL = (255, 0, 200)  # magenta - crosswalks / cross-scene curbs
COLOR_VERTICAL = (140, 160, 255)  # pale blue
COLOR_VEG = (0, 255, 90)  # bright green

# False = cv2.LINE_8, fully opaque solid vectors. True = LINE_AA, softer
# strokes with partial alpha.
ANTIALIAS = False


@dataclass
class Config:
    resize_max_width: int = RESIZE_MAX_WIDTH
    bilateral_d: int = BILATERAL_D
    bilateral_sigma_color: int = BILATERAL_SIGMA_COLOR
    bilateral_sigma_space: int = BILATERAL_SIGMA_SPACE
    gaussian_ksize: tuple[int, int] = field(default_factory=lambda: GAUSSIAN_KSIZE)
    use_clahe: bool = USE_CLAHE
    clahe_clip: float = CLAHE_CLIP
    canny_low: int = CANNY_LOW
    canny_high: int = CANNY_HIGH
    hough_threshold: int = HOUGH_THRESHOLD
    hough_min_line_length: int = HOUGH_MIN_LINE_LENGTH
    hough_max_line_gap: int = HOUGH_MAX_LINE_GAP
    sky_fraction: float = SKY_FRACTION
    angle_horizontal_max_deg: float = ANGLE_HORIZONTAL_MAX_DEG
    angle_vertical_min_deg: float = ANGLE_VERTICAL_MIN_DEG
    draw_verticals: bool = DRAW_VERTICALS
    marking_detection: bool = MARKING_DETECTION
    marking_s_max: int = MARKING_S_MAX
    marking_v_min: int = MARKING_V_MIN
    green_hsv_lower: tuple[int, int, int] = field(default_factory=lambda: GREEN_HSV_LOWER)
    green_hsv_upper: tuple[int, int, int] = field(default_factory=lambda: GREEN_HSV_UPPER)
    veg_morph_kernel: tuple[int, int] = field(default_factory=lambda: VEG_MORPH_KERNEL)
    veg_min_area_frac: float = VEG_MIN_AREA_FRAC
    veg_approx_eps_frac: float = VEG_APPROX_EPS_FRAC
    stroke_road_edge: int = STROKE_ROAD_EDGE
    stroke_marking: int = STROKE_MARKING
    stroke_vertical: int = STROKE_VERTICAL
    stroke_veg: int = STROKE_VEG
    color_road_edge: tuple[int, int, int] = field(default_factory=lambda: COLOR_ROAD_EDGE)
    color_marking: tuple[int, int, int] = field(default_factory=lambda: COLOR_MARKING)
    color_horizontal: tuple[int, int, int] = field(default_factory=lambda: COLOR_HORIZONTAL)
    color_vertical: tuple[int, int, int] = field(default_factory=lambda: COLOR_VERTICAL)
    color_veg: tuple[int, int, int] = field(default_factory=lambda: COLOR_VEG)
    antialias: bool = ANTIALIAS


def _line_type(cfg: Config) -> int:
    return cv2.LINE_AA if cfg.antialias else cv2.LINE_8


# ---------------------------------------------------------------------------
# Pipeline stages
# ---------------------------------------------------------------------------


def load_image(path: str, cfg: Config) -> np.ndarray:
    """Read an image from disk and downscale it to cfg.resize_max_width."""
    bgr = cv2.imread(path, cv2.IMREAD_COLOR)
    if bgr is None:
        raise SystemExit(
            f"error: could not read image at '{path}' - check the path exists "
            "and is a format OpenCV supports (PNG/JPEG, not HEIC)"
        )
    h, w = bgr.shape[:2]
    if w > cfg.resize_max_width:
        scale = cfg.resize_max_width / w
        bgr = cv2.resize(bgr, (cfg.resize_max_width, int(h * scale)), interpolation=cv2.INTER_AREA)
    return bgr


def preprocess(bgr: np.ndarray, cfg: Config) -> np.ndarray:
    """Grayscale -> bilateral denoise -> optional CLAHE -> Gaussian blur."""
    grey = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    grey = cv2.bilateralFilter(
        grey, cfg.bilateral_d, cfg.bilateral_sigma_color, cfg.bilateral_sigma_space
    )
    if cfg.use_clahe:
        clahe = cv2.createCLAHE(clipLimit=cfg.clahe_clip)
        grey = clahe.apply(grey)
    grey = cv2.GaussianBlur(grey, tuple(cfg.gaussian_ksize), 0)
    return grey


def road_roi_mask(shape: tuple[int, int], cfg: Config) -> np.ndarray:
    """uint8 mask: zeros above sky_fraction * H, 255 below."""
    h, w = shape
    mask = np.zeros((h, w), np.uint8)
    sky_rows = int(h * cfg.sky_fraction)
    mask[sky_rows:, :] = 255
    return mask


def detect_structural_lines(
    grey: np.ndarray, roi: np.ndarray, cfg: Config
) -> list[tuple[int, int, int, int]]:
    """Canny -> mask by ROI -> HoughLinesP. Returns (x1, y1, x2, y2) tuples."""
    edges = cv2.Canny(grey, cfg.canny_low, cfg.canny_high)
    edges = cv2.bitwise_and(edges, edges, mask=roi)
    lines = cv2.HoughLinesP(
        edges,
        1,
        np.pi / 180,
        threshold=cfg.hough_threshold,
        minLineLength=cfg.hough_min_line_length,
        maxLineGap=cfg.hough_max_line_gap,
    )
    if lines is None:
        return []
    return [tuple(int(v) for v in line) for line in lines.reshape(-1, 4)]


def classify_line(seg: tuple[int, int, int, int], cfg: Config) -> str:
    """Classify a segment by angle: horizontal / vertical / road_edge."""
    x1, y1, x2, y2 = seg
    angle = abs(math.degrees(math.atan2(y2 - y1, x2 - x1)))
    angle = angle if angle <= 90 else 180 - angle
    if angle <= cfg.angle_horizontal_max_deg:
        return "horizontal"
    if angle >= cfg.angle_vertical_min_deg:
        return "vertical"
    return "road_edge"


def detect_lane_markings(
    bgr: np.ndarray, roi: np.ndarray, cfg: Config
) -> tuple[list[tuple[int, int, int, int]], np.ndarray]:
    """HSV bright-paint mask + Hough pass. Returns (segments, mask)."""
    h, w = bgr.shape[:2]
    if not cfg.marking_detection:
        return [], np.zeros((h, w), np.uint8)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    lower = np.array([0, 0, cfg.marking_v_min], np.uint8)
    upper = np.array([179, cfg.marking_s_max, 255], np.uint8)
    mask = cv2.inRange(hsv, lower, upper)
    mask = cv2.bitwise_and(mask, mask, mask=roi)
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    lines = cv2.HoughLinesP(
        mask,
        1,
        np.pi / 180,
        threshold=cfg.hough_threshold,
        minLineLength=cfg.hough_min_line_length,
        maxLineGap=cfg.hough_max_line_gap * 2,
    )
    segments = (
        []
        if lines is None
        else [tuple(int(v) for v in line) for line in lines.reshape(-1, 4)]
    )
    return segments, mask


def detect_vegetation(bgr: np.ndarray, cfg: Config) -> tuple[list[np.ndarray], np.ndarray]:
    """HSV green mask -> morphology -> contours -> approxPolyDP simplification.

    Runs on the full frame (not the road ROI) since tree canopies live in the
    upper half of the image.
    """
    h, w = bgr.shape[:2]
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    lower = np.array(cfg.green_hsv_lower, np.uint8)
    upper = np.array(cfg.green_hsv_upper, np.uint8)
    mask = cv2.inRange(hsv, lower, upper)
    kernel = np.ones(tuple(cfg.veg_morph_kernel), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    min_area = cfg.veg_min_area_frac * h * w
    simplified = []
    for contour in contours:
        if cv2.contourArea(contour) < min_area:
            continue
        eps = cfg.veg_approx_eps_frac * cv2.arcLength(contour, True)
        simplified.append(cv2.approxPolyDP(contour, eps, True))
    return simplified, mask


def render_rgba(
    shape: tuple[int, int],
    classified_segments: Sequence[tuple[tuple[int, int, int, int], str]],
    marking_segments: Sequence[tuple[int, int, int, int]],
    veg_contours: Sequence[np.ndarray],
    cfg: Config,
) -> np.ndarray:
    """Compose per-class masks into a single RGBA array with alpha=0 background.

    Draws into a single-channel mask per feature class first (rather than
    directly onto an RGBA array) so that background pixels stay exactly
    alpha=0 and antialiased partial coverage is preserved correctly.
    """
    h, w = shape
    line_type = _line_type(cfg)

    def new_mask() -> np.ndarray:
        return np.zeros((h, w), np.uint8)

    road_mask = new_mask()
    horiz_mask = new_mask()
    vert_mask = new_mask()
    marking_mask = new_mask()
    veg_mask = new_mask()

    for (x1, y1, x2, y2), label in classified_segments:
        if label == "road_edge":
            cv2.line(road_mask, (x1, y1), (x2, y2), 255, cfg.stroke_road_edge, line_type)
        elif label == "horizontal":
            cv2.line(horiz_mask, (x1, y1), (x2, y2), 255, cfg.stroke_road_edge, line_type)
        elif label == "vertical" and cfg.draw_verticals:
            cv2.line(vert_mask, (x1, y1), (x2, y2), 255, cfg.stroke_vertical, line_type)

    for x1, y1, x2, y2 in marking_segments:
        cv2.line(marking_mask, (x1, y1), (x2, y2), 255, cfg.stroke_marking, line_type)

    for contour in veg_contours:
        cv2.polylines(veg_mask, [contour], isClosed=True, color=255, thickness=cfg.stroke_veg, lineType=line_type)

    rgba = np.zeros((h, w, 4), np.uint8)
    # veg drawn last so canopy outlines sit on top of any road/vertical lines
    # that pass behind them.
    layers_in_z_order = [
        (road_mask, cfg.color_road_edge),
        (horiz_mask, cfg.color_horizontal),
        (vert_mask, cfg.color_vertical),
        (marking_mask, cfg.color_marking),
        (veg_mask, cfg.color_veg),
    ]
    for mask, rgb in layers_in_z_order:
        sel = mask > 0
        rgba[sel, 0:3] = rgb
        rgba[sel, 3] = np.maximum(rgba[sel, 3], mask[sel])

    return rgba


def save_png(rgba: np.ndarray, out_path: Path) -> None:
    """Write via Pillow so the alpha channel round-trips correctly."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, mode="RGBA").save(out_path)


def write_debug_images(
    out_path: Path,
    grey: np.ndarray,
    canny: np.ndarray,
    green_mask: np.ndarray,
    marking_mask: np.ndarray,
) -> None:
    stem = out_path.parent / out_path.stem
    cv2.imwrite(str(Path(f"{stem}_grey.png")), grey)
    cv2.imwrite(str(Path(f"{stem}_canny.png")), canny)
    cv2.imwrite(str(Path(f"{stem}_green_mask.png")), green_mask)
    cv2.imwrite(str(Path(f"{stem}_marking_mask.png")), marking_mask)


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


def run_pipeline(bgr: np.ndarray, cfg: Config, debug_out: Path | None = None) -> tuple[np.ndarray, dict]:
    """Run the full pipeline on a BGR frame. Returns (rgba, stats)."""
    h, w = bgr.shape[:2]
    grey = preprocess(bgr, cfg)
    roi = road_roi_mask((h, w), cfg)

    structural = detect_structural_lines(grey, roi, cfg)
    classified = [(seg, classify_line(seg, cfg)) for seg in structural]

    marking_segments, marking_mask = detect_lane_markings(bgr, roi, cfg)
    veg_contours, green_mask = detect_vegetation(bgr, cfg)

    rgba = render_rgba((h, w), classified, marking_segments, veg_contours, cfg)

    if debug_out is not None:
        canny = cv2.Canny(grey, cfg.canny_low, cfg.canny_high)
        canny = cv2.bitwise_and(canny, canny, mask=roi)
        write_debug_images(debug_out, grey, canny, green_mask, marking_mask)

    counts = {"road_edge": 0, "horizontal": 0, "vertical": 0}
    for _, label in classified:
        counts[label] += 1
    opaque_frac = float((rgba[:, :, 3] > 0).sum()) / (h * w)

    stats = {
        "road_edge": counts["road_edge"],
        "horizontal": counts["horizontal"],
        "vertical": counts["vertical"],
        "marking": len(marking_segments),
        "vegetation": len(veg_contours),
        "opaque_frac": opaque_frac,
    }
    return rgba, stats


def print_stats(stats: dict) -> None:
    print(f"road_edge: {stats['road_edge']} segments")
    print(f"horizontal: {stats['horizontal']} segments")
    print(f"vertical: {stats['vertical']} segments")
    print(f"marking: {stats['marking']} segments")
    print(f"vegetation: {stats['vegetation']} contours")
    print(f"opaque pixels: {stats['opaque_frac'] * 100:.1f}%")


# ---------------------------------------------------------------------------
# Selftest
# ---------------------------------------------------------------------------


def make_synthetic_frame() -> np.ndarray:
    """640x480 BGR frame: converging grey road, dashed white centre lines,
    a green canopy ellipse, plus light Gaussian noise - enough signal to
    exercise every stage of the pipeline without a real screenshot."""
    h, w = 480, 640
    frame = np.full((h, w, 3), (60, 110, 150), np.uint8)  # sky-ish blue-grey (BGR)

    horizon = int(h * 0.42)
    road_pts = np.array(
        [
            [w // 2 - 20, horizon],
            [w // 2 + 20, horizon],
            [w - 40, h],
            [40, h],
        ],
        np.int32,
    )
    cv2.fillPoly(frame, [road_pts], (25, 25, 25))  # dark asphalt (BGR) - needs
    # strong contrast against the background so Canny clears CANNY_HIGH after
    # the bilateral+Gaussian blur smears a diagonal edge over several pixels

    # dashed white centre-line rectangles converging toward the vanishing point
    for t in range(0, 10):
        frac_a = 0.05 + t * 0.09
        frac_b = frac_a + 0.05
        if frac_b > 0.95:
            break
        y_a = int(horizon + frac_a * (h - horizon))
        y_b = int(horizon + frac_b * (h - horizon))
        cx = w // 2
        half_w = int(4 + frac_a * 10)
        cv2.rectangle(frame, (cx - half_w, y_a), (cx + half_w, y_b), (255, 255, 255), -1)

    # green canopy
    cv2.ellipse(frame, (int(w * 0.18), int(h * 0.22)), (70, 50), 0, 0, 360, (40, 150, 40), -1)

    noise = np.random.default_rng(0).normal(0, 4, frame.shape).astype(np.int16)
    frame = np.clip(frame.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    return frame


def run_selftest() -> bool:
    cfg = Config()
    frame = make_synthetic_frame()
    rgba, stats = run_pipeline(frame, cfg)

    checks = [
        ("corners transparent (top-left)", rgba[0, 0, 3] == 0),
        ("corners transparent (bottom-left)", rgba[-1, 0, 3] == 0),
        ("something was drawn", (rgba[..., 3] > 0).any()),
        ("at least one road_edge segment", stats["road_edge"] >= 1),
        ("at least one vegetation contour", stats["vegetation"] >= 1),
        ("opaque pixels < 25% of frame", stats["opaque_frac"] < 0.25),
    ]

    failed = [name for name, ok in checks if not ok]
    if failed:
        print("SELFTEST FAIL:", ", ".join(failed))
        print_stats(stats)
        return False

    print("SELFTEST PASS")
    return True


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _parse_triplet(text: str) -> tuple[int, int, int]:
    parts = [int(p.strip()) for p in text.split(",")]
    if len(parts) != 3:
        raise argparse.ArgumentTypeError("expected H,S,V (three comma-separated integers)")
    return (parts[0], parts[1], parts[2])


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Extract road/lane/curb/vegetation lines from a screenshot into a transparent PNG."
    )
    parser.add_argument("input", nargs="?", help="path to the input JPG/PNG")
    parser.add_argument("-o", "--output", help="output PNG path (default: <input_stem>_lines.png)")
    parser.add_argument("--debug", action="store_true", help="write intermediate debug images")
    parser.add_argument("--stats", action="store_true", help="print per-class feature counts")
    parser.add_argument("--strict", action="store_true", help="exit non-zero if zero features are detected")
    parser.add_argument("--selftest", action="store_true", help="run the built-in synthetic-frame selftest")

    parser.add_argument("--resize-max-width", type=int)
    parser.add_argument("--canny-low", type=int)
    parser.add_argument("--canny-high", type=int)
    parser.add_argument("--hough-threshold", type=int)
    parser.add_argument("--hough-min-line-length", type=int)
    parser.add_argument("--hough-max-line-gap", type=int)
    parser.add_argument("--sky-fraction", type=float)
    parser.add_argument("--no-verticals", action="store_true", help="drop poles/facade edges entirely")
    parser.add_argument("--no-markings", action="store_true", help="skip the lane-marking detection pass")
    parser.add_argument("--green-hsv-lower", type=_parse_triplet, metavar="H,S,V")
    parser.add_argument("--green-hsv-upper", type=_parse_triplet, metavar="H,S,V")
    parser.add_argument("--veg-min-area-frac", type=float)
    parser.add_argument("--antialias", action="store_true", help="draw anti-aliased strokes instead of solid opaque ones")
    return parser


def build_config(args: argparse.Namespace) -> Config:
    cfg = Config()
    overrides = {
        "resize_max_width": args.resize_max_width,
        "canny_low": args.canny_low,
        "canny_high": args.canny_high,
        "hough_threshold": args.hough_threshold,
        "hough_min_line_length": args.hough_min_line_length,
        "hough_max_line_gap": args.hough_max_line_gap,
        "sky_fraction": args.sky_fraction,
        "green_hsv_lower": args.green_hsv_lower,
        "green_hsv_upper": args.green_hsv_upper,
        "veg_min_area_frac": args.veg_min_area_frac,
    }
    for name, value in overrides.items():
        if value is not None:
            setattr(cfg, name, value)
    if args.no_verticals:
        cfg.draw_verticals = False
    if args.no_markings:
        cfg.marking_detection = False
    if args.antialias:
        cfg.antialias = True
    return cfg


def main(argv: list[str] | None = None) -> int:
    parser = build_arg_parser()
    args = parser.parse_args(argv)

    if args.selftest:
        return 0 if run_selftest() else 1

    if not args.input:
        parser.error("INPUT is required unless --selftest is given")

    cfg = build_config(args)
    input_path = Path(args.input)
    output_path = Path(args.output) if args.output else input_path.with_name(f"{input_path.stem}_lines.png")

    bgr = load_image(str(input_path), cfg)
    debug_out = output_path if args.debug else None
    rgba, stats = run_pipeline(bgr, cfg, debug_out=debug_out)
    save_png(rgba, output_path)

    total_features = stats["road_edge"] + stats["horizontal"] + stats["vertical"] + stats["marking"] + stats["vegetation"]
    if total_features == 0:
        message = f"warning: no features detected in '{input_path}' - try loosening --canny-low/--canny-high or --hough-min-line-length"
        if args.strict:
            print(message, file=sys.stderr)
            return 1
        print(message, file=sys.stderr)

    if args.stats:
        print_stats(stats)

    print(f"wrote {output_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
