import { describe, it, expect } from 'vite-plus/test';
import { composeTiles } from '../panoStitch';
import { planGridTiles, projectTilePoint } from '../panoGeometry';

// Only composeTiles is covered here: it is the whole algorithm, and the rest of
// the module is canvas plumbing that jsdom has no 2D context for.
//
// Tiles are planned at size 64 throughout, so the descriptors' dimensions match
// the stand-in pixel buffers. The tile FOV a plan works out does not depend on
// its pixel size, so a 64px grid is geometrically the same grid as a 640px one.

const WIDE = { width: 640, height: 448, fov: 90 };
const TILE_PX = 64;

const grid = (options) => planGridTiles({ fov: 90, wide: WIDE, size: TILE_PX, ...options });

function buffer(width, height) {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

// A tile whose pixels encode their own position — red is x, green is y — so a
// composite can be checked against where each output pixel should have come from.
function positionTile(width = TILE_PX, height = TILE_PX) {
  const source = buffer(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      source.data[i] = Math.round((x / (width - 1)) * 255);
      source.data[i + 1] = Math.round((y / (height - 1)) * 255);
      source.data[i + 2] = 128;
      source.data[i + 3] = 255;
    }
  }
  return source;
}

function solidTile([r, g, b], width = TILE_PX, height = TILE_PX) {
  const source = buffer(width, height);
  for (let i = 0; i < source.data.length; i += 4) {
    source.data[i] = r;
    source.data[i + 1] = g;
    source.data[i + 2] = b;
    source.data[i + 3] = 255;
  }
  return source;
}

const pixelAt = (out, x, y) => {
  const i = (y * out.width + x) * 4;
  return [out.data[i], out.data[i + 1], out.data[i + 2], out.data[i + 3]];
};

describe('composeTiles', () => {
  it('fills the whole output from a covering grid', () => {
    const tiles = grid({ cols: 2, rows: 2 });
    const sources = tiles.map(() => solidTile([10, 20, 30]));
    const out = buffer(128, 90);

    const { filled, total } = composeTiles({ tiles, sources, wide: WIDE, out });

    expect(total).toBe(128 * 90);
    expect(filled).toBe(total);
  });

  it('marks every pixel it fills opaque', () => {
    // ImageData starts fully transparent, and a JPEG encoded from a partly
    // transparent buffer flattens to black.
    const tiles = grid({ cols: 2, rows: 2 });
    const sources = tiles.map(() => solidTile([90, 90, 90]));
    const out = buffer(128, 90);

    composeTiles({ tiles, sources, wide: WIDE, out });

    for (let i = 3; i < out.data.length; i += 4) {
      expect(out.data[i]).toBe(255);
    }
  });

  it('leaves pixels no tile can see untouched, and reports the shortfall', () => {
    // One tile aimed at the right half cannot reach the left edge.
    const tiles = [{ width: TILE_PX, height: TILE_PX, fov: 40, headingOffset: 30, pitchOffset: 0 }];
    const sources = [solidTile([255, 255, 255])];
    const out = buffer(128, 90);

    const { filled, total } = composeTiles({ tiles, sources, wide: WIDE, out });

    expect(filled).toBeGreaterThan(0);
    expect(filled).toBeLessThan(total);
    expect(pixelAt(out, 0, 45)).toEqual([0, 0, 0, 0]);
  });

  it('places content where forward projection says it belongs', () => {
    // A centred tile's middle pixel must land at the middle of the output,
    // whatever scale the output is drawn at.
    const tile = { width: TILE_PX, height: TILE_PX, fov: 50, headingOffset: 0, pitchOffset: 0 };
    const out = buffer(WIDE.width * 2, WIDE.height * 2);

    composeTiles({ tiles: [tile], sources: [positionTile()], wide: WIDE, out });

    const centre = projectTilePoint({ x: 32, y: 32 }, tile, WIDE);
    const [r, g] = pixelAt(out, Math.round(centre.x * 2), Math.round(centre.y * 2));
    // Tile pixel (32, 32) of 64 encodes roughly half-way along both axes.
    expect(r).toBeGreaterThan(118);
    expect(r).toBeLessThan(138);
    expect(g).toBeGreaterThan(118);
    expect(g).toBeLessThan(138);
  });

  it('resolves overlaps to the tile whose centre is nearest, without blending', () => {
    // Two tiles overlapping mid-frame, distinguishable by colour. Every pixel must
    // be exactly one of the two — a blend would show up as a mixture.
    const left = { width: TILE_PX, height: TILE_PX, fov: 60, headingOffset: -20, pitchOffset: 0 };
    const right = { width: TILE_PX, height: TILE_PX, fov: 60, headingOffset: 20, pitchOffset: 0 };
    const sources = [solidTile([200, 0, 0]), solidTile([0, 0, 200])];
    const out = buffer(128, 90);

    composeTiles({ tiles: [left, right], sources, wide: WIDE, out });

    expect(pixelAt(out, 20, 45)).toEqual([200, 0, 0, 255]);
    expect(pixelAt(out, 108, 45)).toEqual([0, 0, 200, 255]);
    for (let x = 0; x < 128; x += 1) {
      const [r, g, b, a] = pixelAt(out, x, 45);
      expect(a).toBe(255);
      expect(g).toBe(0);
      // Red or blue, never both.
      expect(Math.min(r, b)).toBe(0);
    }
  });

  it('samples the same content at any output scale', () => {
    // Doubling the output must resolve content more finely, not move it.
    const tiles = grid({ cols: 2, rows: 2 });
    const sources = tiles.map(() => positionTile());
    const small = buffer(160, 112);
    const large = buffer(320, 224);

    composeTiles({ tiles, sources, wide: WIDE, out: small });
    composeTiles({ tiles, sources, wide: WIDE, out: large });

    for (const [x, y] of [[40, 28], [120, 28], [40, 84], [120, 84]]) {
      const [sr, sg] = pixelAt(small, x, y);
      const [lr, lg] = pixelAt(large, x * 2, y * 2);
      expect(Math.abs(sr - lr)).toBeLessThanOrEqual(6);
      expect(Math.abs(sg - lg)).toBeLessThanOrEqual(6);
    }
  });

  it('interpolates rather than snapping to the nearest source pixel', () => {
    // An 8px ramp blown up should step smoothly; nearest-neighbour would hold
    // each value for several rows and then jump.
    const tile = { width: 8, height: 8, fov: 90, headingOffset: 0, pitchOffset: 0 };
    const out = buffer(64, 45);

    composeTiles({ tiles: [tile], sources: [positionTile(8, 8)], wide: WIDE, out });

    const column = [];
    for (let y = 12; y < 32; y += 1) column.push(pixelAt(out, 32, y)[1]);
    expect(new Set(column).size).toBeGreaterThan(column.length / 2);
  });

  it('skips a tile whose image is missing instead of throwing', () => {
    const tiles = grid({ cols: 2, rows: 2 });
    const sources = tiles.map(() => solidTile([5, 5, 5]));
    sources[0] = null;
    const out = buffer(128, 90);

    const { filled, total } = composeTiles({ tiles, sources, wide: WIDE, out });

    expect(filled).toBeGreaterThan(0);
    expect(filled).toBeLessThan(total);
  });

  it('keeps a 3x2 grid seamless too', () => {
    const tiles = grid({ cols: 3, rows: 2 });
    const sources = tiles.map(() => solidTile([44, 55, 66]));
    const out = buffer(192, 134);

    const { filled, total } = composeTiles({ tiles, sources, wide: WIDE, out });

    expect(filled).toBe(total);
  });
});
