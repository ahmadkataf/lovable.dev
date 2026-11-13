/**
 * Board storage and the pure, allocation-light algorithms that work on it: match detection, swap
 * validity, the level-start fill and the "no moves left" reshuffle. Nothing here knows about
 * scores, goals or steps — that is game.ts. Cells are addressed by index = r * cols + c.
 */
import type { Color, Piece, PieceKind } from './types.ts';
import type { Rng } from './rng.ts';

/** Placeholder colour of a piece whose colour is chosen by the level-start fill. */
export const RANDOM_COLOR = -2;

/** A piece as described by a level (before it gets an id). `color` may be RANDOM_COLOR. */
export interface PieceSpec {
  kind: PieceKind;
  color: number;
  hp: number;
  chained: boolean;
}

export interface Board {
  readonly cols: number;
  readonly rows: number;
  /** cols * rows */
  readonly n: number;
  /** 1 = the cell exists, 0 = hole. */
  readonly exists: Uint8Array;
  readonly spawner: Uint8Array;
  readonly exit: Uint8Array;
  /** Sand layers per cell (0..2). */
  readonly sand: Uint8Array;
  /** Live pieces (mutable objects owned by the Game). Always null on holes. */
  readonly pieces: (Piece | null)[];
}

// ───────────────────────────── piece predicates ─────────────────────────────

/** beam or nova: the specials that carry a colour, take part in matches and combine with each other. */
export function isBlastKind(kind: PieceKind): boolean {
  return kind === 'beamH' || kind === 'beamV' || kind === 'nova';
}

/** Never moves: not by gravity, not by a swap, not by a shuffle. */
export function isImmovable(p: Piece): boolean {
  return p.chained || p.kind === 'stone' || p.kind === 'vine';
}

/** A plain, unchained gem: the only thing shuffles move, vines eat and boosters transform. */
export function isFreeGem(p: Piece): boolean {
  return p.kind === 'gem' && !p.chained;
}

// ───────────────────────────── matches ─────────────────────────────

/**
 * Would a piece of `color` sitting on `idx` be part of a run of 3+? The current content of `idx`
 * itself is ignored. Only gem-like pieces have a colour >= 0, so comparing colours is enough.
 */
export function formsMatchAt(b: Board, idx: number, color: number): boolean {
  const { cols, n, pieces } = b;
  const c = idx % cols;
  let run = 1;
  for (let x = c - 1, k = idx - 1; x >= 0; x--, k--) {
    const p = pieces[k] as Piece | null;
    if (p !== null && p.color === color) run++;
    else break;
  }
  for (let x = c + 1, k = idx + 1; x < cols; x++, k++) {
    const p = pieces[k] as Piece | null;
    if (p !== null && p.color === color) run++;
    else break;
  }
  if (run >= 3) return true;
  run = 1;
  for (let k = idx - cols; k >= 0; k -= cols) {
    const p = pieces[k] as Piece | null;
    if (p !== null && p.color === color) run++;
    else break;
  }
  for (let k = idx + cols; k < n; k += cols) {
    const p = pieces[k] as Piece | null;
    if (p !== null && p.color === color) run++;
    else break;
  }
  return run >= 3;
}

/** Is there any run of 3+ on the board? */
export function hasAnyMatch(b: Board): boolean {
  const { cols, n, pieces } = b;
  for (let i = 0; i < n; i++) {
    const p = pieces[i] as Piece | null;
    if (p === null || p.color < 0) continue;
    const color = p.color;
    if ((i % cols) + 2 < cols) {
      const q1 = pieces[i + 1] as Piece | null;
      const q2 = pieces[i + 2] as Piece | null;
      if (q1 !== null && q2 !== null && q1.color === color && q2.color === color) return true;
    }
    if (i + 2 * cols < n) {
      const q1 = pieces[i + cols] as Piece | null;
      const q2 = pieces[i + 2 * cols] as Piece | null;
      if (q1 !== null && q2 !== null && q1.color === color && q2.color === color) return true;
    }
  }
  return false;
}

/** One match group: same-coloured runs of 3+ that share cells (§2.3). */
export interface Group {
  color: Color;
  /** Every cell of the group, ascending. */
  cells: number[];
  /** Length of the longest straight run. */
  maxRun: number;
  /** Cells of that run, left→right or top→bottom. */
  longest: number[];
  longestHorizontal: boolean;
  /** A cell where a horizontal and a vertical run cross (lowest index), or -1. */
  cross: number;
  /** The member closest to the group's centre (where the score popup goes). */
  center: number;
}

const NO_GROUPS: Group[] = [];

/** All match groups currently on the board, ordered by their first cell. */
export function findGroups(b: Board): Group[] {
  const { cols, rows, n, pieces } = b;
  const runs: number[][] = [];
  const horizontal: boolean[] = [];

  for (let r = 0; r < rows; r++) {
    const base = r * cols;
    let c = 0;
    while (c < cols) {
      const p = pieces[base + c] as Piece | null;
      if (p === null || p.color < 0) {
        c++;
        continue;
      }
      let e = c + 1;
      while (e < cols) {
        const q = pieces[base + e] as Piece | null;
        if (q !== null && q.color === p.color) e++;
        else break;
      }
      if (e - c >= 3) {
        const run: number[] = [];
        for (let x = c; x < e; x++) run.push(base + x);
        runs.push(run);
        horizontal.push(true);
      }
      c = e;
    }
  }
  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      const p = pieces[r * cols + c] as Piece | null;
      if (p === null || p.color < 0) {
        r++;
        continue;
      }
      let e = r + 1;
      while (e < rows) {
        const q = pieces[e * cols + c] as Piece | null;
        if (q !== null && q.color === p.color) e++;
        else break;
      }
      if (e - r >= 3) {
        const run: number[] = [];
        for (let y = r; y < e; y++) run.push(y * cols + c);
        runs.push(run);
        horizontal.push(false);
      }
      r = e;
    }
  }
  if (runs.length === 0) return NO_GROUPS;

  // Union runs that share a cell. Horizontal runs never overlap each other (same for vertical
  // ones), so a cell is owned by at most one run of each direction.
  const parent: number[] = [];
  for (let k = 0; k < runs.length; k++) parent.push(k);
  const find = (k: number): number => {
    while (parent[k] !== k) {
      parent[k] = parent[parent[k] as number] as number;
      k = parent[k] as number;
    }
    return k;
  };
  const owner = new Int16Array(n).fill(-1);
  const crossings: number[] = [];
  for (let k = 0; k < runs.length; k++) {
    for (const cell of runs[k] as number[]) {
      const o = owner[cell] as number;
      if (o >= 0) {
        crossings.push(cell);
        const a = find(o);
        const bRoot = find(k);
        if (a !== bRoot) parent[bRoot] = a;
      } else {
        owner[cell] = k;
      }
    }
  }

  const byRoot = new Map<number, Group>();
  const groups: Group[] = [];
  for (let k = 0; k < runs.length; k++) {
    const run = runs[k] as number[];
    const root = find(k);
    let g = byRoot.get(root);
    if (g === undefined) {
      g = {
        color: (pieces[run[0] as number] as Piece).color as Color,
        cells: [],
        maxRun: 0,
        longest: run,
        longestHorizontal: true,
        cross: -1,
        center: -1,
      };
      byRoot.set(root, g);
      groups.push(g);
    }
    for (const cell of run) g.cells.push(cell);
    if (run.length > g.maxRun) {
      g.maxRun = run.length;
      g.longest = run;
      g.longestHorizontal = horizontal[k] as boolean;
    }
  }
  for (const cell of crossings) {
    const g = byRoot.get(find(owner[cell] as number)) as Group;
    if (g.cross < 0 || cell < g.cross) g.cross = cell;
  }
  for (const g of groups) {
    g.cells.sort(ascending);
    // crossing cells were pushed once per run: drop the duplicates
    let w = 0;
    for (let k = 0; k < g.cells.length; k++) {
      if (k === 0 || g.cells[k] !== g.cells[k - 1]) g.cells[w++] = g.cells[k] as number;
    }
    g.cells.length = w;
    let sumC = 0;
    let sumR = 0;
    for (const cell of g.cells) {
      sumC += cell % cols;
      sumR += (cell - (cell % cols)) / cols;
    }
    const midC = sumC / w;
    const midR = sumR / w;
    let best = Infinity;
    for (const cell of g.cells) {
      const dc = (cell % cols) - midC;
      const dr = (cell - (cell % cols)) / cols - midR;
      const d = dc * dc + dr * dr;
      if (d < best - 1e-9) {
        best = d;
        g.center = cell;
      }
    }
  }
  groups.sort((x, y) => (x.cells[0] as number) - (y.cells[0] as number));
  return groups;
}

function ascending(a: number, b: number): number {
  return a - b;
}

// ───────────────────────────── swaps ─────────────────────────────

/**
 * §2.2 — would swapping the pieces on the two (adjacent, existing) cells be a legal move?
 * Adjacency is the caller's business.
 */
export function isValidSwap(b: Board, i: number, j: number): boolean {
  const pieces = b.pieces;
  const A = pieces[i] as Piece | null;
  const B = pieces[j] as Piece | null;
  if (A === null || B === null) return false;
  if (isImmovable(A) || isImmovable(B)) return false;

  const aLamp = A.kind === 'lamp';
  const bLamp = B.kind === 'lamp';
  if (aLamp || bLamp) {
    // A lamp only moves when the piece it trades places with makes a match in the lamp's cell.
    if (aLamp && bLamp) return false;
    const other = aLamp ? B : A;
    if (other.color < 0) return false;
    const dest = aLamp ? i : j;
    pieces[i] = B;
    pieces[j] = A;
    const ok = formsMatchAt(b, dest, other.color);
    pieces[i] = A;
    pieces[j] = B;
    return ok;
  }
  // (a) a prism combines with any gem / beam / nova / prism
  if (A.kind === 'prism' || B.kind === 'prism') return true;
  // (b) two specials combine
  if (A.kind !== 'gem' && B.kind !== 'gem') return true;
  // (c) the swap makes a match that contains one of the two swapped pieces
  if (A.color === B.color) return false;
  pieces[i] = B;
  pieces[j] = A;
  const ok = formsMatchAt(b, j, A.color) || formsMatchAt(b, i, B.color);
  pieces[i] = A;
  pieces[j] = B;
  return ok;
}

/** Every legal move as a flat list of index pairs [i0, j0, i1, j1, …] with i < j. */
export function validSwaps(b: Board): number[] {
  const { cols, n, pieces } = b;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    if (pieces[i] === null) continue;
    if ((i % cols) + 1 < cols && isValidSwap(b, i, i + 1)) out.push(i, i + 1);
    if (i + cols < n && isValidSwap(b, i, i + cols)) out.push(i, i + cols);
  }
  return out;
}

export function hasValidMove(b: Board): boolean {
  const { cols, n, pieces } = b;
  for (let i = 0; i < n; i++) {
    if (pieces[i] === null) continue;
    if ((i % cols) + 1 < cols && isValidSwap(b, i, i + 1)) return true;
    if (i + cols < n && isValidSwap(b, i, i + cols)) return true;
  }
  return false;
}

// ───────────────────────────── level-start fill ─────────────────────────────

const FILL_TRIES = 60;

/**
 * Pick a colour for `idx` that does not complete a run with what is already there. Falls back
 * to a random colour when every colour would (the caller then notices the match and retries).
 */
export function colourWithoutMatch(b: Board, idx: number, colors: number, rng: Rng): Color {
  const start = rng.int(colors);
  for (let d = 0; d < colors; d++) {
    const color = (start + d) % colors;
    if (!formsMatchAt(b, idx, color)) return color as Color;
  }
  return start as Color;
}

/**
 * Colour the level's random pieces (§2.1) so the board starts with no match and at least one
 * valid move. Returns false when that could not be achieved (the board then keeps the last try).
 */
export function fillRandom(b: Board, cells: readonly number[], colors: number, rng: Rng): boolean {
  const pieces = b.pieces;
  if (cells.length === 0) return !hasAnyMatch(b) && hasValidMove(b);
  for (let attempt = 0; attempt < FILL_TRIES; attempt++) {
    for (const i of cells) (pieces[i] as Piece).color = -1;
    for (const i of cells) (pieces[i] as Piece).color = colourWithoutMatch(b, i, colors, rng);
    if (!hasAnyMatch(b) && hasValidMove(b)) return true;
  }
  return false;
}

// ───────────────────────────── reshuffle (§2.8) ─────────────────────────────

const PERMUTE_TRIES = 40;
const RECOLOR_TRIES = 48;

export interface Reshuffle {
  /** Free gems that changed cell. */
  moved: { id: number; from: number; to: number }[];
  /** Cells whose free gem got a new colour (only when no legal rearrangement exists). */
  recolored: number[];
}

/**
 * Rearrange the free gems so the board has no match and at least one valid move.
 *
 * Stage 1 permutes the free gems (greedy placement + local repair, a bounded number of tries).
 * Stage 2 — only when no permutation works, e.g. too few gems of any one colour — plants a
 * guaranteed move by recolouring its gems (and, if that alone leaves a match, the other free
 * gems around it).
 * Returns null when neither is possible (nothing on the board can ever form a move); the board
 * is then left exactly as it was. Never loops: every stage has a fixed budget.
 *
 * `mustChange` (shuffle booster on a playable board): the result must look different.
 */
export function reshuffle(b: Board, rng: Rng, colors: number, mustChange: boolean): Reshuffle | null {
  const pieces = b.pieces;
  const cells: number[] = [];
  for (let i = 0; i < b.n; i++) {
    const p = pieces[i] as Piece | null;
    if (p !== null && isFreeGem(p)) cells.push(i);
  }
  if (cells.length === 0) return null;
  const original = cells.map((i) => pieces[i] as Piece);
  const originalColors = original.map((p) => p.color);

  if (cells.length >= 2) {
    for (let attempt = 0; attempt < PERMUTE_TRIES; attempt++) {
      if (!arrange(b, cells, original, rng) || !hasValidMove(b)) continue;
      let looksDifferent = false;
      for (let k = 0; k < cells.length; k++) {
        if ((pieces[cells[k] as number] as Piece).color !== originalColors[k]) {
          looksDifferent = true;
          break;
        }
      }
      if (mustChange && !looksDifferent) continue;
      const home = new Map<Piece, number>();
      for (let k = 0; k < cells.length; k++) home.set(original[k] as Piece, cells[k] as number);
      const moved: Reshuffle['moved'] = [];
      for (const to of cells) {
        const p = pieces[to] as Piece;
        const from = home.get(p) as number;
        if (from !== to) moved.push({ id: p.id, from, to });
      }
      return { moved, recolored: [] };
    }
    for (let k = 0; k < cells.length; k++) pieces[cells[k] as number] = original[k] as Piece;
  }

  const restore = (): void => {
    for (let k = 0; k < original.length; k++) (original[k] as Piece).color = originalColors[k] as Color | -1;
  };
  const patterns = movePatterns(b);
  rng.shuffle(patterns);
  const tries = Math.min(patterns.length, RECOLOR_TRIES);
  // Pass 0 is gentle: only the gems of the planted move change colour. Pass 1 recolours every
  // free gem around the planted move (needed when the old colours would leave a match).
  for (let pass = 0; pass < 2; pass++) {
    for (let attempt = 0; attempt < tries; attempt++) {
      const pattern = patterns[attempt] as number[];
      restore();
      // Members that cannot be recoloured (specials, chained gems) dictate the colour.
      let fixed = -1;
      let consistent = true;
      for (const m of pattern) {
        const p = pieces[m] as Piece;
        if (isFreeGem(p)) continue;
        if (fixed >= 0 && p.color !== fixed) consistent = false;
        fixed = p.color;
      }
      if (!consistent) continue;
      const candidates: number[] = [];
      if (fixed >= 0) candidates.push(fixed);
      else if (pass === 1) candidates.push(rng.int(colors));
      else {
        // the members' own colours, the one two of them already share first
        const own = pattern.map((m) => (pieces[m] as Piece).color);
        if (own[0] === own[1] || own[0] === own[2]) candidates.push(own[0] as number);
        else if (own[1] === own[2]) candidates.push(own[1] as number);
        for (const color of own) if (candidates.indexOf(color) < 0) candidates.push(color);
      }
      for (const color of candidates) {
        restore();
        if (pass === 1) for (const p of original) p.color = -1;
        for (const m of pattern) (pieces[m] as Piece).color = color as Color;
        if (pass === 1) {
          for (const i of cells) {
            const p = pieces[i] as Piece;
            if (p.color < 0) p.color = colourWithoutMatch(b, i, colors, rng);
          }
        }
        if (hasAnyMatch(b) || !hasValidMove(b)) continue;
        const recolored: number[] = [];
        for (let k = 0; k < cells.length; k++) {
          if ((original[k] as Piece).color !== originalColors[k]) recolored.push(cells[k] as number);
        }
        if (mustChange && recolored.length === 0) continue;
        return { moved: [], recolored };
      }
    }
  }
  restore();
  return null;
}

/**
 * Place `original` (the free gems) back onto `cells` in a random order with no match.
 * Returns false when it could not avoid a match (the cells are then filled but unusable).
 */
function arrange(b: Board, cells: readonly number[], original: readonly Piece[], rng: Rng): boolean {
  const pieces = b.pieces;
  for (const i of cells) pieces[i] = null;
  const pool = rng.shuffle(original.slice());
  for (const i of cells) {
    let pick = pool.length - 1;
    for (let k = pool.length - 1; k >= 0; k--) {
      if (!formsMatchAt(b, i, (pool[k] as Piece).color)) {
        pick = k;
        break;
      }
    }
    pieces[i] = pool[pick] as Piece;
    pool[pick] = pool[pool.length - 1] as Piece;
    pool.pop();
  }
  if (!hasAnyMatch(b)) return true;
  // Local repair: trade a matched gem with a random other one when that fixes both cells.
  for (let pass = 0; pass < 4; pass++) {
    for (const i of cells) {
      const p = pieces[i] as Piece;
      if (!formsMatchAt(b, i, p.color)) continue;
      for (let t = 0; t < 12; t++) {
        const j = cells[rng.int(cells.length)] as number;
        const q = pieces[j] as Piece;
        if (j === i || q.color === p.color) continue;
        pieces[i] = q;
        pieces[j] = p;
        if (!formsMatchAt(b, i, q.color) && !formsMatchAt(b, j, p.color)) break;
        pieces[i] = p;
        pieces[j] = q;
      }
    }
    if (!hasAnyMatch(b)) return true;
  }
  return false;
}

const LINE_OFFSETS: readonly (readonly [number, number])[] = [
  [-2, -1],
  [-1, 1],
  [1, 2],
];

/**
 * Every place where a move could exist if the colours were right: [mover, x, y] means the
 * swappable gem-like piece on `mover` can step onto a neighbouring swappable cell and line up
 * there with the gem-like pieces on `x` and `y`.
 */
function movePatterns(b: Board): number[][] {
  const { cols, rows, n, pieces } = b;
  const out: number[][] = [];
  const coloured = (i: number): boolean => {
    const p = pieces[i] as Piece | null;
    return p !== null && (p.kind === 'gem' || isBlastKind(p.kind));
  };
  for (let p = 0; p < n; p++) {
    const P = pieces[p] as Piece | null;
    if (P === null || isImmovable(P) || !coloured(p)) continue;
    const pc = p % cols;
    const pr = (p - pc) / cols;
    for (let dir = 0; dir < 4; dir++) {
      const qc = pc + (dir === 0 ? 1 : dir === 1 ? -1 : 0);
      const qr = pr + (dir === 2 ? 1 : dir === 3 ? -1 : 0);
      if (qc < 0 || qc >= cols || qr < 0 || qr >= rows) continue;
      const q = qr * cols + qc;
      const Q = pieces[q] as Piece | null;
      if (Q === null || isImmovable(Q)) continue;
      for (const [d1, d2] of LINE_OFFSETS) {
        if (qc + d1 >= 0 && qc + d2 < cols) {
          const x = q + d1;
          const y = q + d2;
          if (x !== p && y !== p && coloured(x) && coloured(y)) out.push([p, x, y]);
        }
        if (qr + d1 >= 0 && qr + d2 < rows) {
          const x = q + d1 * cols;
          const y = q + d2 * cols;
          if (x !== p && y !== p && coloured(x) && coloured(y)) out.push([p, x, y]);
        }
      }
    }
  }
  return out;
}

/** Could any colouring of the free gems give this board a move? (Used by the level validator.) */
export function hasMovePattern(b: Board): boolean {
  return movePatterns(b).length > 0;
}
