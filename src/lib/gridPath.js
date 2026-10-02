/* PLACER — shortest walking distances across a rectangular cell grid.
 *
 * Shared by the toolkit tools: 15-Minute Reach measures how far an amenity
 * is from every home, and Desire Lines measures how long the paved route between
 * two points is. Both questions are the same one — cheapest cost from a set of
 * starting cells to everywhere else — so they share one Dijkstra.
 *
 * Distances come back in *cell steps*, not metres. Callers multiply by their own
 * cell size, which is the only thing that differs between them.
 */

// Cells are indexed row-major: i = y * cols + x.
const STEPS_4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const STEPS_8 = [...STEPS_4, [1, 1], [1, -1], [-1, 1], [-1, -1]];

/**
 * Binary min-heap over (cell, distance) pairs. A cell can be pushed more than
 * once; the stale copies are skipped on pop because the cell is already settled.
 */
class MinHeap {
  constructor() {
    this.cells = [];
    this.costs = [];
  }

  get size() {
    return this.cells.length;
  }

  push(cell, cost) {
    this.cells.push(cell);
    this.costs.push(cost);
    let i = this.cells.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.costs[parent] <= this.costs[i]) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop() {
    const cell = this.cells[0];
    const last = this.cells.length - 1;
    this.swap(0, last);
    this.cells.pop();
    this.costs.pop();
    let i = 0;
    for (;;) {
      const left = i * 2 + 1;
      const right = left + 1;
      let small = i;
      if (left < this.cells.length && this.costs[left] < this.costs[small]) small = left;
      if (right < this.cells.length && this.costs[right] < this.costs[small]) small = right;
      if (small === i) break;
      this.swap(i, small);
      i = small;
    }
    return cell;
  }

  swap(a, b) {
    [this.cells[a], this.cells[b]] = [this.cells[b], this.cells[a]];
    [this.costs[a], this.costs[b]] = [this.costs[b], this.costs[a]];
  }
}

/**
 * Cheapest number of steps from any of `sources` to every cell on the grid.
 *
 * @param {object} grid
 * @param {number} grid.cols
 * @param {number} grid.rows
 * @param {(index: number) => boolean} grid.passable — false for water, rail, walls.
 * @param {number[]} grid.sources — cell indices to start from.
 * @param {boolean} [grid.diagonal=true] — allow diagonal steps, costed at √2.
 * @returns {Float64Array} steps to each cell; Infinity where unreachable.
 */
export function distanceField({ cols, rows, passable, sources, diagonal = true }) {
  const count = cols * rows;
  const dist = new Float64Array(count).fill(Infinity);
  if (!sources || sources.length === 0) return dist;

  const settled = new Uint8Array(count);
  const queue = new MinHeap();
  for (const source of sources) {
    if (source >= 0 && source < count && passable(source) && dist[source] !== 0) {
      dist[source] = 0;
      queue.push(source, 0);
    }
  }

  const steps = diagonal ? STEPS_8 : STEPS_4;

  while (queue.size > 0) {
    const cell = queue.pop();
    if (settled[cell]) continue;
    settled[cell] = 1;
    const cost = dist[cell];
    const x = cell % cols;
    const y = (cell - x) / cols;

    for (const [dx, dy] of steps) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const next = ny * cols + nx;
      if (settled[next] || !passable(next)) continue;
      // A diagonal step may not squeeze through the corner between two blocked
      // cells — without this you can walk through the crossing point of a rail
      // line and a canal.
      if (dx !== 0 && dy !== 0 && (!passable(y * cols + nx) || !passable(ny * cols + x))) continue;
      const candidate = cost + (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1);
      if (candidate < dist[next]) {
        dist[next] = candidate;
        queue.push(next, candidate);
      }
    }
  }

  return dist;
}

/** Cell index containing a point, clamped to the grid. */
export function cellAt({ cols, rows }, x, y, cellSize) {
  const cx = Math.min(cols - 1, Math.max(0, Math.floor(x / cellSize)));
  const cy = Math.min(rows - 1, Math.max(0, Math.floor(y / cellSize)));
  return cy * cols + cx;
}

/** Centre point of a cell, in the same units as `cellSize`. */
export function cellCentre({ cols }, index, cellSize) {
  const x = index % cols;
  const y = (index - x) / cols;
  return { x: (x + 0.5) * cellSize, y: (y + 0.5) * cellSize };
}
