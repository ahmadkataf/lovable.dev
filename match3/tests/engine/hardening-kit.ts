/**
 * Hardening kit — an independent referee for the engine (docs/DESIGN.md §2).
 *
 * Nothing in this file calls the engine's own match finder, swap validator, gravity or replayer
 * (src/engine/board.ts, replay.ts). It re-implements the rules from the design document and then
 * walks a turn's Step transcript with its own board, PREDICTING every deterministic consequence:
 *
 *   - which swaps are legal (§2.2), which groups match, which special each group makes and where (§2.3)
 *   - the exact cells every effect reaches (§2.4), and the exact Hit record of every hit (§2.5)
 *   - adjacent damage, once per blocker per wave
 *   - when a fall / collect / grow / shuffle / status step MUST and MUST NOT appear
 *   - that after every fall the cells reachable from a spawner (flood fill) are full (§2.6)
 *   - every score, counter, goal and status (§2.9, §2.10)
 *
 * Only the engine's random choices are taken from the transcript (spawn colours, which way a
 * piece slid, shuffle result, which gem became a beam) — and those are checked for plausibility.
 *
 * Used by tests/engine/hardening*.test.ts:
 *   `build()` / `audit()`   hand-written boards, the latter with a Referee attached (`Audit`)
 *   `Referee`               audits one game call by call
 *   `quietRun()`            picks a seed whose random refill does not disturb a hand-built scenario
 *   `playAudited()`         one whole game played by a seeded bot (valid moves, boosters, illegal
 *                           and out-of-turn calls, continues, end bonus), every call audited
 *   `probeSwaps()`          swap() ⇔ validMoves() ⇔ canSwap() ⇔ the reference rules, for every
 *                           adjacent pair of a board
 *   `checkDeterminism()`    byte-identical replay, no hidden state after refused calls, clone()
 *
 * Where the design leaves room the Referee follows the engine's documented decisions (header of
 * src/engine/game.ts): a special made by a match is immune to blasts until the next fall; vines
 * spread only after moves, and a vine cut by a booster counts for the next move; a hammer needs
 * something to hit; freeSwap refuses identical pieces; lamps enter through gap-free columns; a
 * board on which no move can ever exist ends the level; the cascade counter grows with every
 * fall step (also the one after a lamp was collected); within one wave, prisms that pick their
 * own colour fire after the other effects.
 */
import { Game, SCORE } from '../../src/engine/index.ts';
import type {
  CellView,
  Color,
  DebugPiece,
  Fx,
  FxKind,
  Goal,
  Hit,
  HitCause,
  LevelDef,
  Move,
  Piece,
  PieceKind,
  Pos,
  Snapshot,
  StartBoosters,
  Step,
  TurnResult,
} from '../../src/engine/index.ts';

export const at = (c: number, r: number): Pos => ({ c, r });
export const posKey = (p: Pos): string => `${p.c},${p.r}`;

// ───────────────────────────── tiny seeded RNG (the kit's own) ─────────────────────────────

export interface Dice {
  next(): number;
  int(n: number): number;
  pick<T>(list: readonly T[]): T;
  chance(p: number): boolean;
}

export function dice(seed: number): Dice {
  let s = (seed ^ 0x9e3779b9) >>> 0 || 1;
  const next = (): number => {
    // xorshift32
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
  const int = (n: number): number => (n > 1 ? Math.floor(next() * n) : 0);
  return {
    next,
    int,
    pick: <T>(list: readonly T[]): T => list[int(list.length)] as T,
    chance: (p: number): boolean => next() < p,
  };
}

// ───────────────────────────── hand-built boards ─────────────────────────────

export interface BuildOpts {
  colors?: number;
  moves?: number;
  goals?: Goal[];
  stars?: [number, number, number];
  /** Sand layers, one string of digits per row (same shape as the board). */
  floor?: string[];
  lamps?: LevelDef['lamps'];
  seed?: number;
  boosters?: StartBoosters;
  /** Let the engine shuffle / refuse the start position as it would for a real level. */
  startShuffle?: boolean;
}

/**
 * Build a game from rows of whitespace-separated tokens:
 *   A..F   plain gem of colour 0..5        A-  beamH     A|  beamV     A*  nova
 *   …#     chained (A#, A-#, A*#)          ?   random gem              ?#  chained random gem
 *   P prism   L lamp   V vine   S1 S2 S3 stone   _ hole   0 empty cell
 *   ~      background: the gem 'ABC'[(col + row) % 3]. A board of background has no match and no
 *          legal move, and moving one background gem by one cell never makes a match. Shapes
 *          under test are written with D / E / F and the level uses 3 colours, so refills are
 *          only ever A / B / C.
 * Unless told otherwise the level is score-only with an unreachable target (it never ends) and
 * the start position is kept exactly as written.
 */
export function build(rows: string[], o: BuildOpts = {}): Game {
  const grid = rows.map((row) => row.trim().split(/\s+/));
  const cols = grid[0].length;
  const cells: (DebugPiece | null | undefined)[] = [];
  const pieces: string[] = [];
  grid.forEach((row, r) => {
    if (row.length !== cols) throw new Error(`build(): row ${r} has ${row.length} tokens, expected ${cols}`);
    let line = '';
    row.forEach((token, c) => {
      const cell = parseToken(token, c, r);
      line += cell === 'hole' ? '_' : '.';
      cells.push(cell === 'hole' ? undefined : cell);
    });
    pieces.push(line);
  });
  const level: LevelDef = {
    id: 1,
    cols,
    rows: grid.length,
    colors: o.colors ?? 3,
    moves: o.moves ?? 30,
    pieces,
    goals: o.goals ?? [{ kind: 'score', target: 1e9 }],
    stars: o.stars ?? [1e9, 2e9, 3e9],
  };
  if (o.floor) level.floor = o.floor;
  if (o.lamps) level.lamps = o.lamps;
  const opts: { seed: number; boosters?: StartBoosters } = { seed: o.seed ?? 1 };
  if (o.boosters) opts.boosters = o.boosters;
  return new Game(level, opts, { cells, noStartShuffle: !o.startShuffle });
}

function parseToken(token: string, c: number, r: number): DebugPiece | null | 'hole' {
  if (token === '_') return 'hole';
  if (token === '0') return null;
  if (token === '~') return { kind: 'gem', color: ((c + r) % 3) as Color };
  if (token === 'P') return { kind: 'prism' };
  if (token === 'L') return { kind: 'lamp' };
  if (token === 'V') return { kind: 'vine' };
  const stone = /^S([123])$/.exec(token);
  if (stone) return { kind: 'stone', hp: Number(stone[1]) };
  const m = /^([A-F?])([-|*]?)(#?)$/.exec(token);
  if (!m) throw new Error(`build(): bad token "${token}"`);
  const kind: PieceKind = m[2] === '-' ? 'beamH' : m[2] === '|' ? 'beamV' : m[2] === '*' ? 'nova' : 'gem';
  const piece: DebugPiece = { kind, chained: m[3] === '#' };
  if (m[1] !== '?') piece.color = 'ABCDEF'.indexOf(m[1]) as Color;
  return piece;
}

/** The same notation back from a snapshot (for assertions and failure dumps). */
export function picture(s: { cols: number; rows: number; cells: readonly CellView[] }): string[] {
  const out: string[] = [];
  for (let r = 0; r < s.rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < s.cols; c++) {
      const cell = s.cells[r * s.cols + c];
      const p = cell.piece;
      if (!cell.exists) row.push('_');
      else if (p === null) row.push('0');
      else if (p.kind === 'prism') row.push('P');
      else if (p.kind === 'lamp') row.push('L');
      else if (p.kind === 'vine') row.push('V');
      else if (p.kind === 'stone') row.push(`S${p.hp}`);
      else row.push('ABCDEF'.charAt(p.color) + (p.kind === 'beamH' ? '-' : p.kind === 'beamV' ? '|' : p.kind === 'nova' ? '*' : '') + (p.chained ? '#' : ''));
    }
    out.push(row.join(' '));
  }
  return out;
}

export function pieceAt(s: Snapshot, c: number, r: number): Piece | null {
  return s.cells[r * s.cols + c].piece;
}

export function cellAt(s: Snapshot, c: number, r: number): CellView {
  return s.cells[r * s.cols + c];
}

export function stepsOf<T extends Step['type']>(steps: readonly Step[], type: T): Extract<Step, { type: T }>[] {
  return steps.filter((s) => s.type === type) as Extract<Step, { type: T }>[];
}

export const stepTypes = (steps: readonly Step[]): string => steps.map((s) => s.type).join(' ');

/** "c,r" keys of a list of positions, sorted — for comparing sets of cells. */
export const keysOf = (list: readonly Pos[]): string[] => list.map(posKey).sort();

/** Keys of every cell of the rectangle c0..c1 × r0..r1. */
export function rect(c0: number, r0: number, c1: number, r1: number): string[] {
  const out: string[] = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) out.push(`${c},${r}`);
  return out.sort();
}

// ───────────────────────────── reference rules ─────────────────────────────

interface W {
  cols: number;
  rows: number;
  cells: CellView[];
}

const isSpecial = (p: Piece): boolean => p.kind === 'beamH' || p.kind === 'beamV' || p.kind === 'nova';
const isGemLike = (p: Piece): boolean => p.kind === 'gem' || isSpecial(p);
const isFixed = (p: Piece): boolean => p.chained || p.kind === 'stone' || p.kind === 'vine';
const isPlain = (p: Piece): boolean => p.kind === 'gem' && !p.chained;
const fires = (p: Piece): boolean => isSpecial(p) || p.kind === 'prism';

function copyCells(cells: readonly CellView[]): CellView[] {
  return cells.map((cell) => ({
    exists: cell.exists,
    piece: cell.piece === null ? null : { ...cell.piece },
    sand: cell.sand,
    exit: cell.exit,
    spawner: cell.spawner,
  }));
}

function colourOf(w: W, c: number, r: number): number {
  if (c < 0 || r < 0 || c >= w.cols || r >= w.rows) return -1;
  const p = w.cells[r * w.cols + c].piece;
  return p !== null && isGemLike(p) ? p.color : -1;
}

export interface RefGroup {
  color: number;
  /** Cell indices, ascending. */
  cells: number[];
  maxRun: number;
  /** Cells that lie in a horizontal AND a vertical run. */
  crossings: number[];
  runs: { cells: number[]; horizontal: boolean }[];
}

/** §2.3 — every match group on the board (runs of 3+ that share a cell are one group). */
export function refGroups(w: W): RefGroup[] {
  const { cols, rows } = w;
  const n = cols * rows;
  const hRun: (number[] | null)[] = new Array<number[] | null>(n).fill(null);
  const vRun: (number[] | null)[] = new Array<number[] | null>(n).fill(null);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; ) {
      const k = colourOf(w, c, r);
      let e = c + 1;
      while (k >= 0 && e < cols && colourOf(w, e, r) === k) e++;
      if (k >= 0 && e - c >= 3) {
        const run: number[] = [];
        for (let x = c; x < e; x++) run.push(r * cols + x);
        for (const cell of run) hRun[cell] = run;
      }
      c = e;
    }
  }
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; ) {
      const k = colourOf(w, c, r);
      let e = r + 1;
      while (k >= 0 && e < rows && colourOf(w, c, e) === k) e++;
      if (k >= 0 && e - r >= 3) {
        const run: number[] = [];
        for (let y = r; y < e; y++) run.push(y * cols + c);
        for (const cell of run) vRun[cell] = run;
      }
      r = e;
    }
  }
  const seen = new Array<boolean>(n).fill(false);
  const groups: RefGroup[] = [];
  for (let start = 0; start < n; start++) {
    if (seen[start] || (hRun[start] === null && vRun[start] === null)) continue;
    const group: RefGroup = { color: (w.cells[start].piece as Piece).color, cells: [], maxRun: 0, crossings: [], runs: [] };
    const queue = [start];
    seen[start] = true;
    while (queue.length > 0) {
      const cell = queue.pop() as number;
      group.cells.push(cell);
      const h = hRun[cell];
      const v = vRun[cell];
      if (h !== null && v !== null) group.crossings.push(cell);
      for (const run of [h, v]) {
        if (run === null) continue;
        if (!group.runs.some((known) => known.cells === run)) group.runs.push({ cells: run, horizontal: run === h });
        if (run.length > group.maxRun) group.maxRun = run.length;
        for (const other of run) {
          if (!seen[other]) {
            seen[other] = true;
            queue.push(other);
          }
        }
      }
    }
    group.cells.sort((x, y) => x - y);
    group.crossings.sort((x, y) => x - y);
    groups.push(group);
  }
  return groups;
}

export function refHasMatch(w: W): boolean {
  for (let r = 0; r < w.rows; r++) {
    for (let c = 0; c < w.cols; c++) {
      const k = colourOf(w, c, r);
      if (k < 0) continue;
      if (colourOf(w, c + 1, r) === k && colourOf(w, c + 2, r) === k) return true;
      if (colourOf(w, c, r + 1) === k && colourOf(w, c, r + 2) === k) return true;
    }
  }
  return false;
}

/** §2.2 written from the design text. */
export function refCanSwap(w: W, a: Pos, b: Pos): boolean {
  const inside = (p: Pos): boolean => Number.isInteger(p.c) && Number.isInteger(p.r) && p.c >= 0 && p.r >= 0 && p.c < w.cols && p.r < w.rows;
  if (!inside(a) || !inside(b)) return false;
  if (Math.abs(a.c - b.c) + Math.abs(a.r - b.r) !== 1) return false;
  const cellA = w.cells[a.r * w.cols + a.c];
  const cellB = w.cells[b.r * w.cols + b.c];
  if (!cellA.exists || !cellB.exists) return false;
  const A = cellA.piece;
  const B = cellB.piece;
  if (A === null || B === null || isFixed(A) || isFixed(B)) return false;
  // colours as they would be after the swap
  const after = (c: number, r: number): number => {
    if (c === a.c && r === a.r) return isGemLike(B) ? B.color : -1;
    if (c === b.c && r === b.r) return isGemLike(A) ? A.color : -1;
    return colourOf(w, c, r);
  };
  const inLine = (p: Pos): boolean => {
    const k = after(p.c, p.r);
    if (k < 0) return false;
    let h = 1;
    for (let c = p.c - 1; after(c, p.r) === k; c--) h++;
    for (let c = p.c + 1; after(c, p.r) === k; c++) h++;
    let v = 1;
    for (let r = p.r - 1; after(p.c, r) === k; r--) v++;
    for (let r = p.r + 1; after(p.c, r) === k; r++) v++;
    return h >= 3 || v >= 3;
  };
  if (A.kind === 'lamp' && B.kind === 'lamp') return false;
  // "A lamp can be swapped only if the swap produces a match for the other piece."
  if (A.kind === 'lamp') return isGemLike(B) && inLine(a);
  if (B.kind === 'lamp') return isGemLike(A) && inLine(b);
  if (A.kind === 'prism' || B.kind === 'prism') return true;
  if (isSpecial(A) && isSpecial(B)) return true;
  return inLine(a) || inLine(b);
}

export const moveKey = (m: Move): string => {
  const first = m.a.r < m.b.r || (m.a.r === m.b.r && m.a.c < m.b.c) ? m.a : m.b;
  const second = first === m.a ? m.b : m.a;
  return `${first.c},${first.r}-${second.c},${second.r}`;
};

export function refMoves(w: W): string[] {
  const out: string[] = [];
  for (let r = 0; r < w.rows; r++) {
    for (let c = 0; c < w.cols; c++) {
      if (refCanSwap(w, at(c, r), at(c + 1, r))) out.push(moveKey({ a: at(c, r), b: at(c + 1, r) }));
      if (refCanSwap(w, at(c, r), at(c, r + 1))) out.push(moveKey({ a: at(c, r), b: at(c, r + 1) }));
    }
  }
  return out.sort();
}

/**
 * §2.6 flood fill: the cells a new piece can reach — a spawner, or a cell below / diagonally
 * below a reachable cell — moving only through existing cells that hold no immovable piece.
 * After gravity every one of them must hold a piece.
 */
export function flowCells(w: W): boolean[] {
  const { cols, rows } = w;
  const flow = new Array<boolean>(cols * rows).fill(false);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const cell = w.cells[i];
      if (!cell.exists || (cell.piece !== null && isFixed(cell.piece))) continue;
      if (cell.spawner) flow[i] = true;
      else if (r > 0) flow[i] = flow[i - cols] || (c > 0 && flow[i - cols - 1]) || (c < cols - 1 && flow[i - cols + 1]);
    }
  }
  return flow;
}

/** Is anything still able to fall? (an empty spawner, or an empty cell under / diagonally under a movable piece) */
function needsFall(w: W): boolean {
  const { cols, rows } = w;
  const movable = (c: number, r: number): boolean => {
    if (c < 0 || r < 0 || c >= cols || r >= rows) return false;
    const p = w.cells[r * cols + c].piece;
    return p !== null && !isFixed(p);
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = w.cells[r * cols + c];
      if (!cell.exists || cell.piece !== null) continue;
      if (cell.spawner || movable(c, r - 1) || movable(c - 1, r - 1) || movable(c + 1, r - 1)) return true;
    }
  }
  return false;
}

/** Cells an effect of `kind` centred on `centre` reaches (§2.4), holes excluded. */
export function refTargets(w: W, kind: FxKind, centre: Pos): string[] {
  const out: string[] = [];
  for (let r = 0; r < w.rows; r++) {
    for (let c = 0; c < w.cols; c++) {
      if (!w.cells[r * w.cols + c].exists) continue;
      const dc = Math.abs(c - centre.c);
      const dr = Math.abs(r - centre.r);
      let inside = false;
      if (kind === 'beamH') inside = r === centre.r;
      else if (kind === 'beamV') inside = c === centre.c;
      else if (kind === 'nova') inside = dc + dr <= 2;
      else if (kind === 'cross') inside = r === centre.r || c === centre.c;
      else if (kind === 'bigCross') inside = dr <= 1 || dc <= 1;
      else if (kind === 'bigNova') inside = (dc <= 2 && dr <= 2) || (dc + dr === 3 && (dc === 0 || dr === 0));
      else if (kind === 'prismAll') inside = true;
      if (inside) out.push(`${c},${r}`);
    }
  }
  return out.sort();
}

// ───────────────────────────── the referee ─────────────────────────────

export type Call =
  | { op: 'swap'; a: Pos; b: Pos }
  | { op: 'hammer'; at: Pos }
  | { op: 'freeSwap'; a: Pos; b: Pos }
  | { op: 'shuffle' }
  | { op: 'addMoves'; n: number }
  | { op: 'endBonus' };

export function perform(game: Game, call: Call): TurnResult {
  switch (call.op) {
    case 'swap':
      return game.swap(call.a, call.b);
    case 'hammer':
      return game.useBooster('hammer', call.at);
    case 'freeSwap':
      return game.useBooster('freeSwap', call.a, call.b);
    case 'shuffle':
      return game.useBooster('shuffle');
    case 'addMoves':
      return game.addMoves(call.n);
    case 'endBonus':
      return game.endBonus();
  }
}

interface Fire {
  kind: FxKind;
  at: number;
  /** For 'prism': the colour to clear, or -1 = most common. Otherwise the firing piece's colour (-2 = not checked). */
  color: number;
  /** Cells whose pieces are used up by this very effect (swap combos, end bonus). */
  consumed: number[];
}

interface Ctx {
  w: W;
  before: Snapshot;
  res: TurnResult;
  call: Call;
  steps: readonly Step[];
  k: number;
  falls: number;
  fresh: Set<number>;
  pending: Fire[];
  vineCut: boolean;
  score: number;
  bonus: boolean;
}

export interface RefereeOptions {
  /** Shared counters for coverage reports. */
  stats?: Record<string, number>;
  /** Pieces on the board may use colours outside the level's count (hand-built boards). */
  looseColors?: boolean;
  /** The game was built with start boosters (only matters for the start audit). */
  boosters?: StartBoosters;
  /** Skip the start-position audit (hand-built boards that are not settled). */
  handBuilt?: boolean;
}

/** Audits one game from its first snapshot on. Call `check()` after every engine call; it throws on any deviation. */
export class Referee {
  readonly level: LevelDef;
  readonly stats: Record<string, number>;
  private readonly colors: number;
  readonly looseColors: boolean;
  private readonly scoreOnly: boolean;
  private readonly ids = new Set<number>();
  private readonly totals = { sand: 0, stone: 0, vine: 0, chain: 0 };
  private readonly done = { sand: 0, stone: 0, vine: 0, chain: 0, lamp: 0, color: [0, 0, 0, 0, 0, 0] };
  private readonly lampFriendly: boolean[];
  private lampsExisted = 0;
  private lastLampMove = 0;
  private moveCount = 0;
  private bonusDone = false;
  /** §2.7 — a vine was destroyed (by a booster) since the last move settled: it counts for the next move. */
  private vineCutSinceMove = false;

  constructor(level: LevelDef, start: Snapshot, o: RefereeOptions = {}) {
    this.level = level;
    this.stats = o.stats ?? {};
    this.colors = level.colors;
    this.looseColors = o.looseColors === true;
    this.scoreOnly = level.goals.length > 0 && level.goals.every((g) => g.kind === 'score');
    for (const cell of start.cells) {
      this.totals.sand += cell.sand;
      const p = cell.piece;
      if (p === null) continue;
      if (this.ids.has(p.id)) throw new Error(`start: duplicate piece id ${p.id}`);
      this.ids.add(p.id);
      if (p.kind === 'stone') this.totals.stone++;
      if (p.kind === 'vine') this.totals.vine++;
      if (p.kind === 'lamp') this.lampsExisted++;
      if (p.chained) this.totals.chain++;
    }
    this.lastLampMove = this.lampsExisted > 0 ? 0 : -Infinity;
    // Columns a lamp can simply fall out of: at least two cells, no gap between top and bottom.
    const friendly: boolean[] = [];
    for (let c = 0; c < start.cols; c++) {
      let top = -1;
      let bottom = -1;
      let count = 0;
      for (let r = 0; r < start.rows; r++) {
        if (!start.cells[r * start.cols + c].exists) continue;
        if (top < 0) top = r;
        bottom = r;
        count++;
      }
      friendly.push(count >= 2 && bottom - top + 1 === count);
    }
    this.lampFriendly = friendly.some((f) => f) ? friendly : friendly.map(() => true);
    if (!o.handBuilt) this.checkStart(start, o.boosters ?? {});
  }

  private bump(name: string, by = 1): void {
    this.stats[name] = (this.stats[name] ?? 0) + by;
  }

  // ── level start (§2.1, §2.8, §2.11) ──

  private checkStart(s: Snapshot, boosters: StartBoosters): void {
    const level = this.level;
    const die = (message: string): never => {
      throw new Error(`start position: ${message}\n${picture(s).join('\n')}\nlevel ${JSON.stringify(level)}`);
    };
    if (s.cols !== level.cols || s.rows !== level.rows || s.cells.length !== level.cols * level.rows) die('wrong size');
    let prisms = 0;
    let beams = 0;
    let novas = 0;
    let levelPrisms = 0;
    let levelBeams = 0;
    let levelNovas = 0;
    for (let c = 0; c < s.cols; c++) {
      let top = -1;
      let bottom = -1;
      for (let r = 0; r < s.rows; r++) {
        if (level.pieces[r].charAt(c) !== '_') {
          if (top < 0) top = r;
          bottom = r;
        }
      }
      for (let r = 0; r < s.rows; r++) {
        const ch = level.pieces[r].charAt(c);
        const cell = s.cells[r * s.cols + c];
        const p = cell.piece;
        const where = `cell ${c},${r}`;
        if (cell.exists !== (ch !== '_')) die(`${where}: exists flag is wrong`);
        if (cell.spawner !== (r === top)) die(`${where}: spawner flag is wrong`);
        if (cell.exit !== (r === bottom)) die(`${where}: exit flag is wrong`);
        const sand = level.floor ? Number(level.floor[r].charAt(c)) : 0;
        if (cell.sand !== (cell.exists ? sand : 0)) die(`${where}: sand ${cell.sand}, level says ${sand}`);
        if (!cell.exists) {
          if (p !== null) die(`${where}: a piece in a hole`);
          continue;
        }
        if (p === null) {
          die(`${where}: empty at level start`);
          continue;
        }
        if (p.kind === 'prism') prisms++;
        if (p.kind === 'beamH' || p.kind === 'beamV') beams++;
        if (p.kind === 'nova') novas++;
        if (ch === 'P') levelPrisms++;
        if (ch === 'H' || ch === 'V') levelBeams++;
        if (ch === 'N') levelNovas++;
        const gemLike = isGemLike(p);
        if (gemLike ? !(p.color >= 0 && p.color < 6) : p.color !== -1) die(`${where}: ${p.kind} with colour ${p.color}`);
        if (p.kind === 'stone' ? !(p.hp >= 1 && p.hp <= 3) : p.hp !== 1) die(`${where}: ${p.kind} with hp ${p.hp}`);
        if (p.chained && !gemLike) die(`${where}: chained ${p.kind}`);
        // Fixed pieces are kept as given (§2.1).
        if ('123'.includes(ch) && !(p.kind === 'stone' && p.hp === Number(ch))) die(`${where}: expected stone ${ch}`);
        if (ch === 'v' && p.kind !== 'vine') die(`${where}: expected a vine`);
        if (ch === 'L' && p.kind !== 'lamp') die(`${where}: expected a lamp`);
        if (ch === 'c' && !(p.kind === 'gem' && p.chained)) die(`${where}: expected a chained gem`);
        if (ch !== 'c' && p.chained) die(`${where}: unexpected chain`);
        if (ch === 'H' && p.kind !== 'beamH') die(`${where}: expected beamH`);
        if (ch === 'V' && p.kind !== 'beamV') die(`${where}: expected beamV`);
        if (ch === 'N' && p.kind !== 'nova') die(`${where}: expected nova`);
        if (ch === 'P' && p.kind !== 'prism') die(`${where}: expected prism`);
        // random pieces use the level's colours only
        if (gemLike && p.color >= this.colors) {
          die(`${where}: random colour ${p.color} outside 0..${this.colors - 1}`);
        }
      }
    }
    if (prisms !== levelPrisms + (boosters.prism ? 1 : 0)) this.bump('start:prismBoosterNotPlaced');
    if (beams !== levelBeams + (boosters.beamNova ? 1 : 0)) this.bump('start:beamBoosterNotPlaced');
    if (novas !== levelNovas + (boosters.beamNova ? 1 : 0)) this.bump('start:novaBoosterNotPlaced');
    const startMoves = Math.max(0, Math.floor(level.moves)) + (boosters.extraMoves ? 3 : 0);
    if (s.movesLeft !== startMoves) die(`movesLeft ${s.movesLeft}`);
    if (s.score !== 0) die('score is not 0');
    const w: W = { cols: s.cols, rows: s.rows, cells: copyCells(s.cells) };
    const moves = refMoves(w);
    if (s.status === 'playing') {
      if (refHasMatch(w)) die('the board starts with a match');
      if (moves.length === 0) die("no valid move although the status is 'playing'");
    } else if (s.status === 'lost' && startMoves <= 0 && moves.length > 0) {
      // a level without moves (bad data) starts out of moves; addMoves() resumes it
      if (s.canContinue !== true) die('a level that starts out of moves on a playable board can be continued');
      if (refHasMatch(w)) die('the board starts with a match');
      this.bump('start:noMoves');
    } else if (s.status === 'lost') {
      if (s.canContinue !== false || moves.length > 0) die("a level may only start 'lost' when no move can ever exist");
      this.bump('start:dead');
    } else die(`status ${s.status} at level start`);
    this.checkGoals(s, die);
  }

  // ── one engine call ──

  check(before: Snapshot, call: Call, res: TurnResult, game?: Game): void {
    const ctx: Ctx = {
      w: { cols: before.cols, rows: before.rows, cells: copyCells(before.cells) },
      before,
      res,
      call,
      steps: res.steps,
      k: 0,
      falls: 0,
      fresh: new Set<number>(),
      pending: [],
      vineCut: this.vineCutSinceMove,
      score: before.score,
      bonus: false,
    };
    const die = (message: string): never => this.fail(ctx, message);
    const w = ctx.w;
    const expected = this.shouldAccept(before, call);
    this.bump(`${call.op}:${res.accepted ? 'accepted' : 'rejected'}`);

    if (!res.accepted) {
      if (expected === true) die(`${call.op} was rejected but the rules allow it`);
      if (JSON.stringify(res.snapshot) !== JSON.stringify(before)) die('a rejected call changed the state');
      const wantsStep =
        call.op === 'swap' &&
        before.status === 'playing' &&
        Math.abs(call.a.c - call.b.c) + Math.abs(call.a.r - call.b.r) === 1 &&
        this.existsAt(w, call.a) &&
        this.existsAt(w, call.b);
      if (wantsStep) {
        const step = res.steps[0];
        if (res.steps.length !== 1 || step.type !== 'swap' || step.valid !== false || posKey(step.a) !== posKey(call.a) || posKey(step.b) !== posKey(call.b)) {
          die('an invalid swap must return exactly one swap step with valid:false');
        }
      } else if (res.steps.length !== 0) die('a refused call must not return steps');
      return;
    }
    if (expected === false) die(`${call.op} was accepted but the rules forbid it`);

    let expectMoves = before.movesLeft;
    switch (call.op) {
      case 'swap': {
        expectMoves--;
        this.moveCount++;
        this.playSwap(ctx, call.a, call.b);
        this.tail(ctx, true);
        break;
      }
      case 'freeSwap': {
        const step = this.take(ctx, 'booster');
        if (step.booster !== 'freeSwap') die('expected the freeSwap booster step');
        this.playSwap(ctx, call.a, call.b);
        this.tail(ctx, false);
        break;
      }
      case 'hammer': {
        const step = this.take(ctx, 'booster');
        if (step.booster !== 'hammer' || step.at === null || posKey(step.at) !== posKey(call.at)) die('expected the hammer booster step on the chosen cell');
        const clear = this.take(ctx, 'clear');
        const hits: Hit[] = [];
        const points = this.hit(ctx, call.at.r * w.cols + call.at.c, 'booster', hits);
        this.sameHits(ctx, clear.hits, hits, true);
        if (clear.created.length !== 0) die('a hammer creates no special');
        this.checkClearScore(ctx, clear, points);
        this.settle(ctx, null);
        this.tail(ctx, false);
        break;
      }
      case 'shuffle': {
        const step = this.take(ctx, 'booster');
        if (step.booster !== 'shuffle' || step.at !== null) die('expected the shuffle booster step');
        const look = picture(w).join('|');
        this.playShuffle(ctx);
        if (picture(w).join('|') === look) die('the shuffle booster left the board looking the same');
        this.tail(ctx, false);
        break;
      }
      case 'addMoves': {
        expectMoves += call.n;
        const step = this.take(ctx, 'status');
        if (step.status !== 'playing') die('addMoves must report status playing');
        if (res.snapshot.status !== 'playing') die('addMoves must resume play');
        if (refMoves(w).length === 0) die('addMoves resumed a board without a move');
        break;
      }
      case 'endBonus': {
        expectMoves = 0;
        this.bonusDone = true;
        ctx.bonus = true;
        this.playBonus(ctx);
        if (res.snapshot.status !== 'won') die('the end bonus must leave the level won');
        break;
      }
    }
    if (ctx.k !== ctx.steps.length) die(`unexpected extra step '${ctx.steps[ctx.k].type}' at index ${ctx.k}`);
    // A move ends the vines' turn; whatever a booster cut is remembered for the move that follows.
    this.vineCutSinceMove = call.op === 'swap' ? false : ctx.vineCut;

    // The transcript must reproduce the snapshot exactly.
    const after = res.snapshot;
    if (JSON.stringify(w.cells) !== JSON.stringify(after.cells)) {
      die(`the steps do not lead to the snapshot\nreferee board:\n${picture(w).join('\n')}`);
    }
    if (ctx.score !== after.score) die(`score: steps add up to ${ctx.score}, snapshot says ${after.score}`);
    if (after.movesLeft !== expectMoves) die(`movesLeft ${after.movesLeft}, expected ${expectMoves}`);
    if (after.cols !== before.cols || after.rows !== before.rows) die('board size changed');
    const seen = new Set<number>();
    for (let i = 0; i < after.cells.length; i++) {
      const cell = after.cells[i];
      const old = before.cells[i];
      if (cell.exists !== old.exists || cell.exit !== old.exit || cell.spawner !== old.spawner) die(`cell ${i} changed its structure`);
      const p = cell.piece;
      if (p === null) continue;
      if (!cell.exists) die(`piece ${p.id} in a hole`);
      if (seen.has(p.id)) die(`duplicate piece id ${p.id}`);
      seen.add(p.id);
      if (!this.ids.has(p.id)) die(`piece ${p.id} appeared without a step introducing it`);
      const gemLike = isGemLike(p);
      if (gemLike ? !(p.color >= 0 && p.color < 6) : p.color !== -1) die(`piece ${p.id} (${p.kind}) has colour ${p.color}`);
      if (p.kind === 'stone' ? !(p.hp >= 1 && p.hp <= 3) : p.hp !== 1) die(`piece ${p.id} (${p.kind}) has hp ${p.hp}`);
      if (p.chained && !gemLike) die(`piece ${p.id} (${p.kind}) is chained`);
    }
    const starCount = after.score >= this.level.stars[2] ? 3 : after.score >= this.level.stars[1] ? 2 : after.score >= this.level.stars[0] ? 1 : 0;
    if (after.stars !== (after.status === 'won' ? Math.max(1, starCount) : starCount)) die(`stars ${after.stars} do not fit score ${after.score}`);
    if ((after.canContinue !== undefined) !== (after.status === 'lost')) die('canContinue must be present exactly while lost');
    this.checkGoals(after, die);

    // A turn that resolved the board leaves it settled.
    if (call.op === 'swap' || call.op === 'freeSwap' || call.op === 'hammer' || call.op === 'endBonus') {
      if (refHasMatch(w)) die('a match is left on the settled board');
      if (needsFall(w)) die('something can still fall on the settled board');
      const flow = flowCells(w);
      for (let i = 0; i < flow.length; i++) if (flow[i] && w.cells[i].piece === null) die(`cell ${i % w.cols},${Math.floor(i / w.cols)} is reachable from a spawner but empty`);
      for (const cell of w.cells) if (cell.exit && cell.piece !== null && cell.piece.kind === 'lamp') die('a lamp rests on an exit');
    }
    const moves = refMoves(w);
    if (after.status === 'playing' && moves.length === 0) die("status 'playing' without a valid move");
    if (after.status === 'playing' && after.movesLeft <= 0) die("status 'playing' without moves left");
    if (after.status === 'lost' && after.canContinue !== moves.length > 0) die(`canContinue ${String(after.canContinue)} but the board ${moves.length > 0 ? 'has' : 'has no'} move`);

    if (game) this.checkQueries(ctx, game, moves);
  }

  /** validMoves(), hint() and canSwap() against the reference (§2.2). */
  private checkQueries(ctx: Ctx, game: Game, moves: string[]): void {
    const die = (message: string): never => this.fail(ctx, message);
    const w = ctx.w;
    const playing = ctx.res.snapshot.status === 'playing';
    const listed = game.validMoves();
    const keys = listed.map(moveKey).sort();
    if (new Set(keys).size !== keys.length) die('validMoves() lists a move twice');
    const want = playing ? moves : [];
    if (JSON.stringify(keys) !== JSON.stringify(want)) die(`validMoves() differs from the rules\nengine:    ${keys.join(' ')}\nreference: ${want.join(' ')}`);
    const hint = game.hint();
    if (playing) {
      if (hint === null || moves.indexOf(moveKey(hint)) < 0) die(`hint ${JSON.stringify(hint)} is not a valid move`);
    } else if (hint !== null) die('a hint while not playing');
    for (let r = 0; r < w.rows; r++) {
      for (let c = 0; c < w.cols; c++) {
        for (const other of [at(c + 1, r), at(c, r + 1)]) {
          const want2 = playing && refCanSwap(w, at(c, r), other);
          if (game.canSwap(at(c, r), other) !== want2 || game.canSwap(other, at(c, r)) !== want2) die(`canSwap(${c},${r} ↔ ${other.c},${other.r}) should be ${String(want2)}`);
        }
      }
    }
  }

  // ── acceptance (true / false, or null = the referee cannot tell) ──

  private shouldAccept(before: Snapshot, call: Call): boolean | null {
    const w: W = before;
    switch (call.op) {
      case 'swap':
        return before.status === 'playing' && refCanSwap(w, call.a, call.b);
      case 'hammer': {
        if (before.status !== 'playing' || !this.existsAt(w, call.at)) return false;
        const cell = w.cells[call.at.r * w.cols + call.at.c];
        // nothing to hit: an empty cell or a lamp, with no sand under it
        return (cell.piece !== null && cell.piece.kind !== 'lamp') || cell.sand > 0;
      }
      case 'freeSwap': {
        if (before.status !== 'playing' || !this.existsAt(w, call.a) || !this.existsAt(w, call.b)) return false;
        if (Math.abs(call.a.c - call.b.c) + Math.abs(call.a.r - call.b.r) !== 1) return false;
        const A = w.cells[call.a.r * w.cols + call.a.c].piece;
        const B = w.cells[call.b.r * w.cols + call.b.c].piece;
        if (A === null || B === null || isFixed(A) || isFixed(B)) return false;
        // trading two identical pieces would change nothing
        if (A.kind === B.kind && A.color === B.color && (A.kind === 'gem' || A.kind === 'lamp')) return false;
        return true;
      }
      case 'shuffle':
        return before.status === 'playing' ? null : false;
      case 'addMoves':
        return before.status === 'lost' && before.canContinue === true && Number.isInteger(call.n) && call.n >= 1;
      case 'endBonus':
        return before.status === 'won' && !this.bonusDone;
    }
  }

  private existsAt(w: W, p: Pos): boolean {
    return Number.isInteger(p.c) && Number.isInteger(p.r) && p.c >= 0 && p.r >= 0 && p.c < w.cols && p.r < w.rows && w.cells[p.r * w.cols + p.c].exists;
  }

  // ── step cursor ──

  private fail(ctx: Ctx, message: string): never {
    const steps = ctx.steps.map((s, i) => `${i === ctx.k - 1 ? '>>' : '  '}${i}: ${JSON.stringify(s)}`).join('\n');
    throw new Error(
      `REFEREE: ${message}\ncall: ${JSON.stringify(ctx.call)}\n--- before ---\n${picture(ctx.before).join('\n')}\n--- steps ---\n${steps}\n--- after ---\n${picture(ctx.res.snapshot).join('\n')}\nlevel: ${JSON.stringify(this.level)}`,
    );
  }

  private peek(ctx: Ctx): Step | null {
    return ctx.k < ctx.steps.length ? ctx.steps[ctx.k] : null;
  }

  private take<T extends Step['type']>(ctx: Ctx, type: T): Extract<Step, { type: T }> {
    const step = this.peek(ctx);
    if (step === null || step.type !== type) {
      ctx.k++;
      return this.fail(ctx, `expected a '${type}' step at index ${ctx.k - 1}, found ${step === null ? 'the end of the transcript' : `'${step.type}'`}`);
    }
    ctx.k++;
    this.bump(`step:${type}`);
    return step as Extract<Step, { type: T }>;
  }

  // ── swaps and combos (§2.2, §2.4) ──

  private playSwap(ctx: Ctx, a: Pos, b: Pos): void {
    const die = (message: string): never => this.fail(ctx, message);
    const w = ctx.w;
    const step = this.take(ctx, 'swap');
    if (!step.valid || posKey(step.a) !== posKey(a) || posKey(step.b) !== posKey(b)) die('the swap step does not describe the requested swap');
    const ia = a.r * w.cols + a.c;
    const ib = b.r * w.cols + b.c;
    const A = w.cells[ia].piece as Piece;
    const B = w.cells[ib].piece as Piece;
    w.cells[ia].piece = B;
    w.cells[ib].piece = A;
    const horizontal = a.r === b.r;

    let swapCtx: { a: number; b: number; horizontal: boolean } | null = null;
    const aPrism = A.kind === 'prism';
    const bPrism = B.kind === 'prism';
    if (aPrism && bPrism) {
      ctx.pending.push({ kind: 'prismAll', at: ib, color: -1, consumed: [ib, ia] });
      this.bump('combo:prism+prism');
    } else if ((aPrism || bPrism) && (aPrism ? B : A).kind !== 'lamp') {
      const other = aPrism ? B : A;
      const prismCell = aPrism ? ib : ia;
      if (other.kind !== 'gem') {
        // prism + beam / nova: every plain gem of that colour becomes one (§2.4)
        const tr = this.take(ctx, 'transform');
        if (tr.reason !== 'prismCombo' || tr.score !== 0) die('expected a prismCombo transform worth 0');
        const want: number[] = [];
        for (let i = 0; i < w.cells.length; i++) {
          const p = w.cells[i].piece;
          if (p !== null && isPlain(p) && p.color === other.color) want.push(i);
        }
        const got = tr.changes.map((ch) => ch.at.r * w.cols + ch.at.c).sort((x, y) => x - y);
        if (JSON.stringify(got) !== JSON.stringify(want)) die(`prism combo must transform exactly the plain gems of colour ${other.color}`);
        for (const ch of tr.changes) {
          const cell = w.cells[ch.at.r * w.cols + ch.at.c];
          const old = cell.piece as Piece;
          const okKind = other.kind === 'nova' ? ch.piece.kind === 'nova' : ch.piece.kind === 'beamH' || ch.piece.kind === 'beamV';
          if (!okKind || ch.piece.id !== old.id || ch.piece.color !== old.color || ch.piece.hp !== 1 || ch.piece.chained) die('bad piece in the prismCombo transform');
          cell.piece = { ...ch.piece };
        }
        this.bump(other.kind === 'nova' ? 'combo:prism+nova' : 'combo:prism+beam');
      } else this.bump('combo:prism+gem');
      ctx.pending.push({ kind: 'prism', at: ib, color: other.color, consumed: [prismCell] });
    } else if (isSpecial(A) && isSpecial(B)) {
      const novas = (A.kind === 'nova' ? 1 : 0) + (B.kind === 'nova' ? 1 : 0);
      ctx.pending.push({ kind: novas === 2 ? 'bigNova' : novas === 1 ? 'bigCross' : 'cross', at: ib, color: -2, consumed: [ib, ia] });
      this.bump(novas === 2 ? 'combo:nova+nova' : novas === 1 ? 'combo:beam+nova' : 'combo:beam+beam');
    } else {
      swapCtx = { a: ia, b: ib, horizontal };
    }
    this.settle(ctx, swapCtx);
  }

  // ── the settle loop: waves, gravity, lamps (§2.3–§2.6) ──

  private settle(ctx: Ctx, swapCtx: { a: number; b: number; horizontal: boolean } | null): void {
    const w = ctx.w;
    for (let guard = 0; guard < 2000; guard++) {
      let acted = false;
      if (ctx.pending.length === 0) {
        const groups = refGroups(w);
        if (groups.length > 0) {
          this.matchWave(ctx, groups, swapCtx);
          acted = true;
        }
      }
      swapCtx = null;
      while (ctx.pending.length > 0) {
        this.blastWave(ctx);
        acted = true;
      }
      if (needsFall(w)) {
        this.fall(ctx);
        acted = true;
      }
      while (this.lampsOnExits(w).length > 0) {
        this.collect(ctx);
        acted = true;
        if (needsFall(w)) this.fall(ctx);
      }
      if (!acted) return;
    }
    this.fail(ctx, 'the turn never settles');
  }

  private checkClearScore(ctx: Ctx, step: Extract<Step, { type: 'clear' }>, points: number): void {
    if (step.cascade !== ctx.falls + 1) this.fail(ctx, `clear has cascade ${step.cascade}, expected ${ctx.falls + 1} (one more than the falls so far)`);
    if (step.score !== points) this.fail(ctx, `clear step scores ${step.score}, the rules give ${points}`);
    let sum = 0;
    for (const popup of step.popups) {
      if (!(popup.value > 0) || !this.existsAt(ctx.w, popup.at)) this.fail(ctx, 'bad score popup');
      sum += popup.value;
    }
    if (sum !== step.score) this.fail(ctx, `popups add up to ${sum}, the wave scored ${step.score}`);
    ctx.score += step.score;
  }

  private sameHits(ctx: Ctx, got: readonly Hit[], want: readonly Hit[], ordered: boolean): void {
    const norm = (list: readonly Hit[]): string[] => {
      const out = list.map((h) => JSON.stringify([h.at.c, h.at.r, h.cause, h.result, h.pieceId, h.kind, h.color, h.hpLeft ?? null, h.sandLeft ?? null]));
      return ordered ? out : out.sort();
    };
    const g = norm(got);
    const x = norm(want);
    if (JSON.stringify(g) !== JSON.stringify(x)) {
      const missing = x.filter((h) => g.indexOf(h) < 0);
      const extra = g.filter((h) => x.indexOf(h) < 0);
      this.fail(ctx, `hits differ from the rules (${ordered ? 'ordered' : 'as a set'})\nmissing: ${missing.join(' ')}\nextra:   ${extra.join(' ')}\nwant: ${x.join(' ')}\ngot:  ${g.join(' ')}`);
    }
  }

  /** §2.5 — one hit on one cell. Appends the Hit record the engine must report; returns the points. */
  private hit(ctx: Ctx, i: number, cause: HitCause, out: Hit[]): number {
    const w = ctx.w;
    const cell = w.cells[i];
    if (!cell.exists) return 0;
    const where = at(i % w.cols, Math.floor(i / w.cols));
    const mult = Math.min(ctx.falls + 1, SCORE.cascadeCap);
    const p = cell.piece;
    let points = 0;
    const takeSand = (h: Hit): void => {
      if (cell.sand > 0) {
        cell.sand = (cell.sand - 1) as 0 | 1;
        h.sandLeft = cell.sand as 0 | 1;
        this.done.sand++;
        points += SCORE.sandLayer;
      }
    };
    if (p === null) {
      if (cell.sand === 0) return 0;
      const h: Hit = { at: where, cause, result: 'none', pieceId: null, kind: null, color: -1 };
      takeSand(h);
      out.push(h);
      return points;
    }
    const h: Hit = { at: where, cause, result: 'none', pieceId: p.id, kind: p.kind, color: p.color };
    if (p.kind === 'stone') {
      // the blocker absorbs the hit: the sand under it is safe
      points += SCORE.stoneLayer;
      if (p.hp <= 1) {
        cell.piece = null;
        h.result = 'removed';
        this.done.stone++;
      } else {
        p.hp--;
        h.result = 'damaged';
        h.hpLeft = p.hp;
      }
    } else if (p.kind === 'vine') {
      cell.piece = null;
      h.result = 'removed';
      this.done.vine++;
      ctx.vineCut = true;
      points += SCORE.vine;
    } else if (p.kind === 'lamp') {
      takeSand(h);
    } else if (p.chained) {
      p.chained = false;
      h.result = 'unchained';
      this.done.chain++;
      points += SCORE.chain;
      takeSand(h);
    } else if (ctx.fresh.has(p.id)) {
      // engine decision: a special made by a match in this cascade is immune until the board moves
      takeSand(h);
    } else {
      cell.piece = null;
      points += SCORE.gem * mult;
      if (p.color >= 0) this.done.color[p.color]++;
      if (fires(p)) {
        h.result = 'activated';
        ctx.pending.push({ kind: p.kind as FxKind, at: i, color: p.color, consumed: [] });
      } else h.result = 'removed';
      takeSand(h);
    }
    this.bump(`hit:${cause}:${h.result}`);
    out.push(h);
    return points;
  }

  /** §2.3 — all groups are cleared in one wave; stones and vines next to them take one hit. */
  private matchWave(ctx: Ctx, groups: RefGroup[], swapCtx: { a: number; b: number; horizontal: boolean } | null): void {
    const die = (message: string): never => this.fail(ctx, message);
    const w = ctx.w;
    const { cols, rows } = w;
    const step = this.take(ctx, 'clear');
    ctx.fresh.clear();
    this.bump('wave:match');

    // Plan the specials first: they depend on which members are chained right now.
    const plans = groups.map((g) => this.planSpecial(w, g, swapCtx));
    const want: Hit[] = [];
    let points = 0;
    const blockers = new Set<number>();
    for (const g of groups) {
      for (const cell of g.cells) {
        const c = cell % cols;
        const r = Math.floor(cell / cols);
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nc = c + dc;
          const nr = r + dr;
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
          const q = w.cells[nr * cols + nc].piece;
          if (q !== null && (q.kind === 'stone' || q.kind === 'vine')) blockers.add(nr * cols + nc);
        }
      }
    }
    for (const g of groups) for (const cell of g.cells) points += this.hit(ctx, cell, 'match', want);
    // "at most one per blocker per wave"
    blockers.forEach((cell) => {
      points += this.hit(ctx, cell, 'adjacent', want);
    });
    this.sameHits(ctx, step.hits, want, false);

    const made = step.created.slice();
    for (let n = 0; n < groups.length; n++) {
      const g = groups[n];
      const plan = plans[n];
      const idx = made.findIndex((m) => g.cells.indexOf(m.at.r * cols + m.at.c) >= 0);
      if (plan === null) {
        if (idx >= 0) die(`a group of colour ${g.color} (longest run ${g.maxRun}) must not make a special`);
        continue;
      }
      if (idx < 0) die(`a group of colour ${g.color} (longest run ${g.maxRun}, ${g.crossings.length} crossings) must make a ${plan.kind}`);
      const m = made.splice(idx, 1)[0];
      const cell = m.at.r * cols + m.at.c;
      if (m.piece.kind !== plan.kind) die(`group must make a ${plan.kind}, the engine made a ${m.piece.kind}`);
      if (m.piece.color !== plan.color || m.piece.hp !== 1 || m.piece.chained) die('created special has wrong colour / hp / chain');
      if (plan.cells.indexOf(cell) < 0) die(`created ${plan.kind} appears on ${m.at.c},${m.at.r}; allowed: ${plan.cells.map((x) => `${x % cols},${Math.floor(x / cols)}`).join(' ')}`);
      if (this.ids.has(m.piece.id)) die(`created special reuses id ${m.piece.id}`);
      this.ids.add(m.piece.id);
      if (w.cells[cell].piece !== null) die('created special lands on an occupied cell');
      const fromKeys = keysOf(m.from);
      if (new Set(fromKeys).size !== fromKeys.length) die('created.from lists a cell twice');
      for (const f of m.from) if (g.cells.indexOf(f.r * cols + f.c) < 0) die('created.from names a cell outside the group');
      w.cells[cell].piece = { ...m.piece };
      ctx.fresh.add(m.piece.id);
      points += m.piece.kind === 'prism' ? SCORE.prism : m.piece.kind === 'nova' ? SCORE.nova : SCORE.beam;
      this.bump(`created:${m.piece.kind}`);
    }
    if (made.length > 0) die('a special was created that belongs to no group');
    this.checkClearScore(ctx, step, points);
  }

  /** Which special a group makes and on which cells it may appear (§2.3). */
  private planSpecial(w: W, g: RefGroup, swapCtx: { a: number; b: number; horizontal: boolean } | null): { kind: PieceKind; color: number; cells: number[] } | null {
    const make = g.maxRun >= 5 ? 'prism' : g.crossings.length > 0 ? 'nova' : g.maxRun === 4 ? 'beam' : null;
    if (make === null) return null;
    const free = g.cells.filter((cell) => !(w.cells[cell].piece as Piece).chained);
    if (free.length === 0) return null; // chained members do not merge: nothing is left to become the special
    let ideal: number[];
    if (swapCtx !== null && g.cells.indexOf(swapCtx.b) >= 0) ideal = [swapCtx.b];
    else if (swapCtx !== null && g.cells.indexOf(swapCtx.a) >= 0) ideal = [swapCtx.a];
    else if (make === 'nova') ideal = g.crossings.slice();
    else {
      ideal = [];
      for (const run of g.runs) {
        if (run.cells.length !== g.maxRun) continue;
        ideal.push(run.cells[(run.cells.length - 1) >> 1]);
        ideal.push(run.cells[run.cells.length >> 1]);
      }
    }
    const { cols } = w;
    const dist = (x: number, y: number): number => Math.abs((x % cols) - (y % cols)) + Math.abs(Math.floor(x / cols) - Math.floor(y / cols));
    const cells: number[] = [];
    for (const x of ideal) {
      if (free.indexOf(x) >= 0) {
        cells.push(x);
        continue;
      }
      // the ideal cell keeps its (now unchained) gem: the nearest member that leaves takes over
      let best = Infinity;
      for (const m of free) best = Math.min(best, dist(m, x));
      for (const m of free) if (dist(m, x) === best) cells.push(m);
    }
    if (make === 'prism') return { kind: 'prism', color: -1, cells };
    if (make === 'nova') return { kind: 'nova', color: g.color, cells };
    const run = g.runs.find((x) => x.cells.length === 4) as { cells: number[]; horizontal: boolean };
    // along the swap in the wave the swap caused; across the run in later cascades
    const beamH = swapCtx !== null ? swapCtx.horizontal : !run.horizontal;
    return { kind: beamH ? 'beamH' : 'beamV', color: g.color, cells };
  }

  /** §2.4 — one `activate` + `clear` pair: every pending special fires. */
  private blastWave(ctx: Ctx): void {
    const die = (message: string): never => this.fail(ctx, message);
    const w = ctx.w;
    const cols = w.cols;
    const act = this.take(ctx, 'activate');
    const step = this.take(ctx, 'clear');
    // Effects apply in the order listed. A prism that picks its own colour depends on what the
    // other effects leave, so it comes after them (engine decision: best for the player, and the
    // outcome no longer depends on the order in which the specials happened to be hit).
    const lonePrism = (fire: Fire): boolean => fire.kind === 'prism' && fire.color < 0;
    const fireList = ctx.pending.filter((fire) => !lonePrism(fire)).concat(ctx.pending.filter(lonePrism));
    ctx.pending = [];
    this.bump('wave:blast');
    if (fireList.some(lonePrism) && !lonePrism(fireList[0])) this.bump('wave:prismAfterOthers');
    if (act.fx.length !== fireList.length) die(`${fireList.length} specials must fire, the activate step lists ${act.fx.length}`);
    const mult = Math.min(ctx.falls + 1, SCORE.cascadeCap);
    const want: Hit[] = [];
    let points = 0;

    // Pieces used up by their own effect (combo partners, end-bonus specials) leave first.
    for (const fire of fireList) {
      for (const cell of fire.consumed) {
        const c = w.cells[cell];
        const p = c.piece;
        if (p === null) continue;
        c.piece = null;
        const h: Hit = { at: at(cell % cols, Math.floor(cell / cols)), cause: 'blast', result: 'activated', pieceId: p.id, kind: p.kind, color: p.color };
        points += SCORE.gem * mult;
        if (p.color >= 0) this.done.color[p.color]++;
        if (c.sand > 0) {
          c.sand = (c.sand - 1) as 0 | 1;
          h.sandLeft = c.sand as 0 | 1;
          this.done.sand++;
          points += SCORE.sandLayer;
        }
        want.push(h);
      }
    }

    for (let n = 0; n < fireList.length; n++) {
      const fire = fireList[n];
      const fx: Fx = act.fx[n];
      const centre = at(fire.at % cols, Math.floor(fire.at / cols));
      if (fx.kind !== fire.kind || posKey(fx.at) !== posKey(centre)) die(`effect ${n} should be ${fire.kind} at ${posKey(centre)}, the engine lists ${fx.kind} at ${posKey(fx.at)}`);
      this.bump(`fx:${fx.kind}`);
      const targetKeys = keysOf(fx.targets);
      if (new Set(targetKeys).size !== targetKeys.length) die(`effect ${n} lists a target twice`);
      let wantTargets: string[];
      if (fire.kind === 'prism') {
        // counts as the board is when this effect is applied
        const counts = [0, 0, 0, 0, 0, 0];
        for (const cell of w.cells) if (cell.piece !== null && isGemLike(cell.piece)) counts[cell.piece.color]++;
        let colour = fire.color;
        if (colour < 0) {
          const most = Math.max(...counts);
          if (most === 0) {
            if (fx.color !== -1) die('a prism with nothing to clear must report colour -1');
          } else if (fx.color < 0 || counts[fx.color] !== most) die(`a lone prism must pick the most common colour (counts ${counts.join(',')}), it picked ${fx.color}`);
          colour = fx.color;
        } else if (fx.color !== colour) die(`prism combo must clear colour ${colour}, the engine reports ${fx.color}`);
        wantTargets = [];
        for (let i = 0; i < w.cells.length; i++) {
          const p = w.cells[i].piece;
          if (colour >= 0 && p !== null && isGemLike(p) && p.color === colour) wantTargets.push(`${i % cols},${Math.floor(i / cols)}`);
        }
        wantTargets.sort();
      } else {
        wantTargets = refTargets(w, fire.kind, centre);
        if (fire.color !== -2 && fx.color !== fire.color) die(`effect ${n} should carry colour ${fire.color}`);
      }
      if (JSON.stringify(targetKeys) !== JSON.stringify(wantTargets)) {
        die(`effect ${n} (${fire.kind} at ${posKey(centre)}) reaches the wrong cells\nengine: ${targetKeys.join(' ')}\nrules:  ${wantTargets.join(' ')}`);
      }
      for (const t of fx.targets) {
        const cell = t.r * cols + t.c;
        if (fire.consumed.indexOf(cell) >= 0) continue;
        points += this.hit(ctx, cell, 'blast', want);
      }
    }
    this.sameHits(ctx, step.hits, want, true);
    if (step.created.length !== 0) die('a blast wave creates no special');
    this.checkClearScore(ctx, step, points);
  }

  private lampsOnExits(w: W): number[] {
    const out: number[] = [];
    for (let i = 0; i < w.cells.length; i++) {
      const cell = w.cells[i];
      if (cell.exit && cell.piece !== null && cell.piece.kind === 'lamp') out.push(i);
    }
    return out;
  }

  private collect(ctx: Ctx): void {
    const w = ctx.w;
    const step = this.take(ctx, 'collect');
    const want = this.lampsOnExits(w);
    const got = step.lamps.map((l) => l.at.r * w.cols + l.at.c).sort((x, y) => x - y);
    if (JSON.stringify(got) !== JSON.stringify(want)) this.fail(ctx, 'collect must take exactly the lamps resting on exits');
    for (const lamp of step.lamps) {
      const cell = w.cells[lamp.at.r * w.cols + lamp.at.c];
      if ((cell.piece as Piece).id !== lamp.id) this.fail(ctx, 'collect names the wrong lamp id');
      cell.piece = null;
    }
    if (step.score !== want.length * SCORE.lamp) this.fail(ctx, `collect scores ${step.score}, expected ${want.length * SCORE.lamp}`);
    ctx.score += step.score;
    this.done.lamp += want.length;
  }

  /** §2.6 — gravity + refill. The destinations are the engine's; everything about them is checked. */
  private fall(ctx: Ctx): void {
    const die = (message: string): never => this.fail(ctx, message);
    const w = ctx.w;
    const { cols, rows } = w;
    const step = this.take(ctx, 'fall');
    if (step.moves.length + step.spawns.length === 0) die('an empty fall step');
    const idx = (p: Pos): number => p.r * cols + p.c;
    // Cells pieces may travel through: existing, not holding an immovable piece.
    const open = w.cells.map((cell) => cell.exists && !(cell.piece !== null && isFixed(cell.piece)));
    // A cell with nothing but open cells above it, up to its spawner, is fed straight down — never diagonally.
    const straight = new Array<boolean>(cols * rows).fill(false);
    for (let c = 0; c < cols; c++) {
      let ok = false;
      for (let r = 0; r < rows; r++) {
        const i = r * cols + c;
        if (w.cells[i].spawner) ok = true;
        if (!open[i]) ok = false;
        straight[i] = ok && open[i];
      }
    }
    const reaches = (from: number, to: number): boolean => {
      // can a piece get from `from` to `to` by steps down / diagonally down through open cells?
      let frontier = new Set<number>([from]);
      for (let r = Math.floor(from / cols); r < Math.floor(to / cols); r++) {
        const next = new Set<number>();
        frontier.forEach((i) => {
          const c = i % cols;
          for (const dc of [-1, 0, 1]) {
            const nc = c + dc;
            if (nc < 0 || nc >= cols || r + 1 >= rows) continue;
            const j = (r + 1) * cols + nc;
            if (open[j]) next.add(j);
          }
        });
        frontier = next;
      }
      return frontier.has(to);
    };

    const lifted: Piece[] = [];
    const movedIds = new Set<number>();
    for (const m of step.moves) {
      if (!this.existsAt(w, m.from) || !this.existsAt(w, m.to)) die('fall: a move leaves the board');
      const cell = w.cells[idx(m.from)];
      const p = cell.piece;
      if (p === null || p.id !== m.id) return die(`fall: piece ${m.id} is not on ${posKey(m.from)}`);
      if (isFixed(p)) die(`fall: immovable piece ${p.id} (${p.kind}${p.chained ? ', chained' : ''}) moved`);
      if (movedIds.has(m.id)) die(`fall: piece ${m.id} listed twice`);
      movedIds.add(m.id);
      if (m.to.r <= m.from.r) die(`fall: piece ${m.id} did not move down`);
      if (!reaches(idx(m.from), idx(m.to))) die(`fall: piece ${m.id} cannot get from ${posKey(m.from)} to ${posKey(m.to)} (holes / blockers in the way)`);
      if (m.from.c !== m.to.c) {
        this.bump('fall:diagonal');
        if (straight[idx(m.to)]) die(`fall: piece ${m.id} slid sideways into ${posKey(m.to)}, a cell that is fed from straight above`);
      }
      lifted.push(p);
      cell.piece = null;
    }
    step.moves.forEach((m, n) => {
      const cell = w.cells[idx(m.to)];
      if (cell.piece !== null) die(`fall: ${posKey(m.to)} is occupied`);
      cell.piece = lifted[n];
    });

    let lampsOnBoard = 0;
    for (const cell of w.cells) if (cell.piece !== null && cell.piece.kind === 'lamp') lampsOnBoard++;
    const heights = new Map<number, number[]>();
    let lampsSpawned = 0;
    let friendlySpawn = false;
    for (const s of step.spawns) {
      if (!(s.from.r < 0) || !Number.isInteger(s.from.r) || s.from.c < 0 || s.from.c >= cols) die('spawn: origin must be above the board');
      let spawnerCell = -1;
      for (let r = 0; r < rows; r++) if (w.cells[r * cols + s.from.c].spawner) spawnerCell = r * cols + s.from.c;
      if (spawnerCell < 0) return die(`spawn: column ${s.from.c} has no spawner`);
      if (!open[spawnerCell]) die(`spawn: the spawner of column ${s.from.c} is blocked`);
      if (!this.existsAt(w, s.to)) die('spawn: lands outside the board');
      if (!reaches(spawnerCell, idx(s.to)) && spawnerCell !== idx(s.to)) die(`spawn: a piece from column ${s.from.c} cannot reach ${posKey(s.to)}`);
      if (s.from.c !== s.to.c) {
        this.bump('fall:diagonal');
        if (straight[idx(s.to)]) die(`spawn: slid sideways into ${posKey(s.to)}, a cell that is fed from straight above`);
      }
      const list = heights.get(s.from.c) ?? [];
      list.push(-s.from.r);
      heights.set(s.from.c, list);
      const p = s.piece;
      if (this.ids.has(p.id)) die(`spawn: id ${p.id} was used before`);
      this.ids.add(p.id);
      if (p.hp !== 1 || p.chained) die('spawn: bad hp / chain');
      if (p.kind === 'lamp') {
        lampsSpawned++;
        if (p.color !== -1) die('spawn: lamp with a colour');
        if (idx(s.to) !== spawnerCell) die('spawn: a lamp must enter as the last piece of its column (it starts on the spawner cell)');
        if (!this.lampFriendly[s.from.c]) die(`spawn: lamp dropped into column ${s.from.c}, which has a gap before its exit`);
      } else if (p.kind === 'gem') {
        if (!(Number.isInteger(p.color) && p.color >= 0 && p.color < this.colors)) die(`spawn: gem colour ${p.color} outside 0..${this.colors - 1}`);
      } else die(`spawn: a ${p.kind} cannot drop in`);
      if (this.lampFriendly[s.from.c]) friendlySpawn = true;
      const cell = w.cells[idx(s.to)];
      if (cell.piece !== null) die(`spawn: ${posKey(s.to)} is occupied`);
      cell.piece = { ...p };
    }
    heights.forEach((list, col) => {
      list.sort((x, y) => x - y);
      list.forEach((v, n) => {
        if (v !== n + 1) die(`spawn: heights of column ${col} are not 1..k`);
      });
    });

    // Lamp cadence (LevelDef.lamps).
    const cfg = this.level.lamps;
    const allowed =
      cfg !== undefined && !ctx.bonus && this.lampsExisted < cfg.total && this.moveCount - this.lastLampMove >= cfg.everyMoves && lampsOnBoard < cfg.maxOnBoard;
    if (lampsSpawned > 1) die('spawn: more than one lamp in one fall');
    if (lampsSpawned === 1) {
      if (!allowed) {
        die(`spawn: a lamp dropped in against the level's lamp settings (existed ${this.lampsExisted}, on board ${lampsOnBoard}, moves since last ${this.moveCount - this.lastLampMove}, bonus ${String(ctx.bonus)})`);
      }
      this.lampsExisted++;
      this.lastLampMove = this.moveCount;
      this.bump('lamp:spawned');
    } else if (allowed && friendlySpawn) die('spawn: the lamp settings call for a lamp but none dropped in');

    // Result: everything that can be reached is filled, nothing hangs.
    if (needsFall(w)) die(`fall: pieces can still fall afterwards\n${picture(w).join('\n')}`);
    const flow = flowCells(w);
    for (let i = 0; i < flow.length; i++) {
      if (flow[i] && w.cells[i].piece === null) die(`fall: cell ${i % cols},${Math.floor(i / cols)} is reachable from a spawner but was left empty`);
    }
    ctx.falls++;
    ctx.fresh.clear();
  }

  // ── end of turn: vines, shuffle, status (§2.7–§2.9) ──

  private goalsDone(score: number): boolean {
    return this.level.goals.every((g) => this.progress(g, score).done);
  }

  private progress(g: Goal, score: number): { current: number; target: number; done: boolean } {
    let current = 0;
    let target = 0;
    if (g.kind === 'score') {
      current = score;
      target = g.target;
    } else if (g.kind === 'color') {
      current = this.done.color[g.color];
      target = g.target;
    } else if (g.kind === 'lamp') {
      current = this.done.lamp;
      target = g.target;
    } else {
      current = this.done[g.kind];
      target = this.totals[g.kind];
    }
    current = Math.min(current, target);
    return { current, target, done: current >= target };
  }

  private checkGoals(s: Snapshot, die: (message: string) => never): void {
    if (s.goals.length !== this.level.goals.length) die('snapshot.goals does not list every goal');
    this.level.goals.forEach((g, n) => {
      const want = this.progress(g, s.score);
      const got = s.goals[n];
      if (JSON.stringify(got.goal) !== JSON.stringify(g)) die(`goal ${n} changed`);
      if (got.current !== want.current || got.target !== want.target || got.done !== want.done) {
        die(`goal ${g.kind}: engine ${got.current}/${got.target} done=${String(got.done)}, referee ${want.current}/${want.target} done=${String(want.done)}`);
      }
    });
  }

  private tail(ctx: Ctx, isMove: boolean): void {
    const die = (message: string): never => this.fail(ctx, message);
    const w = ctx.w;
    const movesLeft = ctx.res.snapshot.movesLeft;
    const done = this.goalsDone(ctx.score);
    let status: Snapshot['status'] = 'playing';
    if (done && (!this.scoreOnly || movesLeft <= 0)) {
      status = 'won';
    } else {
      // §2.7: one vine spreads when the player's move cut none
      const spots = this.vineSpots(w);
      const next = this.peek(ctx);
      if (isMove && !ctx.vineCut && spots.length > 0) {
        const step = this.take(ctx, 'grow');
        const from = step.from.r * w.cols + step.from.c;
        const to = step.at.r * w.cols + step.at.c;
        if (!spots.some((s) => s.from === from && s.to === to)) die('grow: a vine can only spread from a vine into an orthogonally adjacent plain gem');
        const old = w.cells[to].piece as Piece;
        if (step.replacedId !== old.id) die('grow: wrong replacedId');
        const p = step.piece;
        if (p.kind !== 'vine' || p.color !== -1 || p.hp !== 1 || p.chained || this.ids.has(p.id)) die('grow: bad vine piece');
        this.ids.add(p.id);
        w.cells[to].piece = { ...p };
        this.bump('vine:grew');
      } else if (next !== null && next.type === 'grow') {
        die(`a vine spread although ${!isMove ? 'this was not a move' : ctx.vineCut ? 'a vine was destroyed since the last move' : 'no vine has a plain gem next to it'}`);
      }
      // §2.8: no move left → shuffle
      if (refMoves(w).length === 0) {
        const step = this.peek(ctx);
        if (step !== null && step.type === 'shuffle') {
          this.playShuffle(ctx);
          this.bump('shuffle:auto');
          status = movesLeft <= 0 ? 'lost' : 'playing';
        } else {
          // The engine says no move can ever exist on this board. Try to prove it wrong.
          const counter = this.findArrangement(w, 400);
          if (counter !== null) die(`the engine gave the board up as dead, but this ${counter.how} is playable:\n${counter.picture.join('\n')}`);
          status = done ? 'won' : 'lost';
          this.bump('deadBoard');
          if (status === 'lost' && ctx.res.snapshot.canContinue !== false) die('a dead board cannot be continued');
        }
      } else {
        const step = this.peek(ctx);
        if (step !== null && step.type === 'shuffle') die('the board was shuffled although a valid move existed');
        status = movesLeft <= 0 ? 'lost' : 'playing';
      }
    }
    if (status !== ctx.before.status) {
      const step = this.take(ctx, 'status');
      if (step.status !== status) die(`status step says ${step.status}, the rules say ${status}`);
    }
    if (ctx.res.snapshot.status !== status) die(`status is ${ctx.res.snapshot.status}, the rules say ${status}`);
    this.bump(`status:${status}`);
  }

  private vineSpots(w: W): { from: number; to: number }[] {
    const out: { from: number; to: number }[] = [];
    const { cols, rows } = w;
    for (let i = 0; i < w.cells.length; i++) {
      const p = w.cells[i].piece;
      if (p === null || p.kind !== 'vine') continue;
      const c = i % cols;
      const r = Math.floor(i / cols);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const q = w.cells[nr * cols + nc].piece;
        if (q !== null && isPlain(q)) out.push({ from: i, to: nr * cols + nc });
      }
    }
    return out;
  }

  /** A `shuffle` step, optionally followed by a 'recolor' transform (§2.8). */
  private playShuffle(ctx: Ctx): void {
    const die = (message: string): never => this.fail(ctx, message);
    const w = ctx.w;
    const cols = w.cols;
    const startCells = copyCells(w.cells);
    const step = this.take(ctx, 'shuffle');
    const lifted: Piece[] = [];
    const fromSet: number[] = [];
    const toSet: number[] = [];
    for (const m of step.moves) {
      const cell = w.cells[m.from.r * cols + m.from.c];
      const p = cell.piece;
      if (p === null || p.id !== m.id) return die(`shuffle: piece ${m.id} is not on ${posKey(m.from)}`);
      if (!isPlain(p)) die(`shuffle: only plain gems move, piece ${p.id} is ${p.kind}${p.chained ? ' (chained)' : ''}`);
      if (posKey(m.from) === posKey(m.to)) die('shuffle: a move that goes nowhere');
      lifted.push(p);
      fromSet.push(m.from.r * cols + m.from.c);
      toSet.push(m.to.r * cols + m.to.c);
    }
    fromSet.sort((x, y) => x - y);
    toSet.sort((x, y) => x - y);
    if (JSON.stringify(fromSet) !== JSON.stringify(toSet) || new Set(fromSet).size !== fromSet.length) die('shuffle: the gems must trade places among themselves');
    for (const m of step.moves) w.cells[m.from.r * cols + m.from.c].piece = null;
    step.moves.forEach((m, n) => {
      w.cells[m.to.r * cols + m.to.c].piece = lifted[n];
    });
    const next = this.peek(ctx);
    if (next !== null && next.type === 'transform' && next.reason === 'recolor') {
      const tr = this.take(ctx, 'transform');
      if (tr.score !== 0 || tr.changes.length === 0) die('recolor: must be worth 0 and change something');
      for (const ch of tr.changes) {
        const cell = w.cells[ch.at.r * cols + ch.at.c];
        const old = cell.piece;
        if (old === null || old.id !== ch.piece.id || !isPlain(old)) return die('recolor: only plain gems may change colour');
        if (ch.piece.kind !== 'gem' || ch.piece.chained || ch.piece.hp !== 1) die('recolor: only the colour may change');
        if (!(ch.piece.color >= 0 && ch.piece.color < this.colors)) die(`recolor: colour ${ch.piece.color} outside the level's colours`);
        cell.piece = { ...ch.piece };
      }
      this.bump('shuffle:recolor');
      // Recolouring is the last resort: a plain rearrangement must have been impossible (or at least very hard to find).
      const easy = this.findArrangement({ cols: w.cols, rows: w.rows, cells: startCells }, 60, true);
      if (easy !== null) this.bump('shuffle:recolorAvoidable');
    }
    if (refHasMatch(w)) die('shuffle: the result contains a match');
    if (refMoves(w).length === 0) die('shuffle: the result has no valid move');
  }

  /**
   * Independent search for a playable arrangement of the plain gems (no match, at least one
   * move): random permutations first, then (unless `permuteOnly`) random recolourings.
   */
  private findArrangement(w: W, tries: number, permuteOnly = false): { how: string; picture: string[] } | null {
    const d = dice(w.cells.length * 7919 + tries);
    const spots: number[] = [];
    for (let i = 0; i < w.cells.length; i++) {
      const p = w.cells[i].piece;
      if (p !== null && isPlain(p)) spots.push(i);
    }
    if (spots.length === 0) return null;
    const trial: W = { cols: w.cols, rows: w.rows, cells: copyCells(w.cells) };
    const gems = spots.map((i) => trial.cells[i].piece as Piece);
    for (let t = 0; t < tries; t++) {
      const order = gems.slice();
      for (let i = order.length - 1; i > 0; i--) {
        const j = d.int(i + 1);
        const tmp = order[i];
        order[i] = order[j];
        order[j] = tmp;
      }
      spots.forEach((i, n) => {
        trial.cells[i].piece = order[n];
      });
      if (!refHasMatch(trial) && refMoves(trial).length > 0) return { how: 'rearrangement', picture: picture(trial) };
    }
    if (permuteOnly) return null;
    for (let t = 0; t < tries; t++) {
      spots.forEach((i, n) => {
        trial.cells[i].piece = { ...gems[n], color: d.int(this.colors) as Color };
      });
      if (!refHasMatch(trial) && refMoves(trial).length > 0) return { how: 'recolouring', picture: picture(trial) };
    }
    return null;
  }

  // ── end bonus (§2.9) ──

  private playBonus(ctx: Ctx): void {
    const die = (message: string): never => this.fail(ctx, message);
    const w = ctx.w;
    const cols = w.cols;
    const left = ctx.before.movesLeft;
    if (left > 0) {
      const tr = this.take(ctx, 'transform');
      if (tr.reason !== 'endBonus') die('expected the endBonus transform');
      if (tr.score !== left * SCORE.endBonusPerMove) die(`end bonus scores ${tr.score}, expected ${left} × ${SCORE.endBonusPerMove}`);
      let plain = 0;
      for (const cell of w.cells) if (cell.piece !== null && isPlain(cell.piece)) plain++;
      if (tr.changes.length !== Math.min(left, plain)) die(`end bonus must turn ${Math.min(left, plain)} gems into beams, it turned ${tr.changes.length}`);
      const used = new Set<string>();
      for (const ch of tr.changes) {
        if (used.has(posKey(ch.at))) die('end bonus: a cell is listed twice');
        used.add(posKey(ch.at));
        const cell = w.cells[ch.at.r * cols + ch.at.c];
        const old = cell.piece;
        if (old === null || !isPlain(old) || old.id !== ch.piece.id) return die('end bonus: only plain gems become beams');
        if ((ch.piece.kind !== 'beamH' && ch.piece.kind !== 'beamV') || ch.piece.color !== old.color || ch.piece.hp !== 1 || ch.piece.chained) die('end bonus: bad beam');
        cell.piece = { ...ch.piece };
      }
      ctx.score += tr.score;
    }
    for (let round = 0; round < 200; round++) {
      for (let i = 0; i < w.cells.length; i++) {
        const p = w.cells[i].piece;
        if (p !== null && !p.chained && fires(p)) ctx.pending.push({ kind: p.kind as FxKind, at: i, color: p.color, consumed: [i] });
      }
      if (ctx.pending.length === 0) return;
      this.bump('bonus:round');
      this.settle(ctx, null);
    }
  }
}

// ───────────────────────────── random levels ─────────────────────────────

/**
 * A random level: 3..9 × 3..9, one of several hole layouts, any mix of sand / stones / chains /
 * vines / lamps / pre-placed specials / fixed colours, 3..6 colours and any goal mix. Not
 * necessarily a level the validator accepts — the referee holds either way.
 */
export function genLevel(d: Dice, id: number): LevelDef {
  const cols = d.chance(0.35) ? 9 : 3 + d.int(7);
  const rows = d.chance(0.35) ? 9 : 3 + d.int(7);
  const colors = 3 + d.int(4);
  const exists: boolean[][] = [];
  for (let r = 0; r < rows; r++) exists.push(new Array<boolean>(cols).fill(true));
  const cut = (c: number, r: number): void => {
    if (c >= 0 && c < cols && r >= 0 && r < rows) exists[r][c] = false;
  };
  const shape = d.int(10);
  if (shape === 1) {
    // rounded corners
    const k = 1 + d.int(2);
    for (let r = 0; r < k; r++) for (let c = 0; c < k - r; c++) for (const [x, y] of [[c, r], [cols - 1 - c, r], [c, rows - 1 - r], [cols - 1 - c, rows - 1 - r]]) cut(x, y);
  } else if (shape === 2) {
    // a block of holes in the middle (gaps inside columns)
    const c0 = 1 + d.int(Math.max(1, cols - 2));
    const r0 = 1 + d.int(Math.max(1, rows - 2));
    const wide = 1 + d.int(3);
    const high = 1 + d.int(2);
    for (let r = r0; r < r0 + high && r < rows - 1; r++) for (let c = c0; c < c0 + wide; c++) cut(c, r);
  } else if (shape === 3) {
    // scattered single holes
    for (let k = 0; k < 1 + d.int(7); k++) cut(d.int(cols), d.int(rows));
  } else if (shape === 4) {
    // ragged top and bottom
    for (let c = 0; c < cols; c++) {
      if (d.chance(0.4)) for (let r = 0; r < 1 + d.int(2); r++) cut(c, r);
      if (d.chance(0.3)) for (let r = 0; r < 1 + d.int(2); r++) cut(c, rows - 1 - r);
    }
  } else if (shape === 5) {
    // a horizontal shelf of holes with one or two gaps: everything below is fed diagonally
    const r0 = 1 + d.int(Math.max(1, rows - 2));
    for (let c = 0; c < cols; c++) cut(c, r0);
    exists[r0][d.int(cols)] = true;
    if (d.chance(0.5)) exists[r0][d.int(cols)] = true;
  } else if (shape === 6) {
    // a missing column (splits the board)
    const c0 = d.int(cols);
    for (let r = 0; r < rows; r++) if (d.chance(0.8)) cut(c0, r);
  } else if (shape === 7) {
    // diamond
    const mc = (cols - 1) / 2;
    const mr = (rows - 1) / 2;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (Math.abs(c - mc) / (mc + 0.5) + Math.abs(r - mr) / (mr + 0.5) > 1.05) cut(c, r);
  }

  const has = {
    sand: d.chance(0.35),
    stone: d.chance(0.35),
    chain: d.chance(0.3),
    vine: d.chance(0.25),
    lamp: d.chance(0.3),
    special: d.chance(0.25),
    fixed: d.chance(0.15),
  };
  const density = 4 + d.int(14);
  const pieces: string[] = [];
  const floor: string[] = [];
  const count = { sand: 0, stone: 0, chain: 0, vine: 0, lamp: 0 };
  for (let r = 0; r < rows; r++) {
    let line = '';
    let floorLine = '';
    for (let c = 0; c < cols; c++) {
      if (!exists[r][c]) {
        line += '_';
        floorLine += '0';
        continue;
      }
      let ch = '.';
      const roll = d.int(100);
      if (has.stone && roll < density) {
        ch = String(1 + d.int(3));
        count.stone++;
      } else if (has.chain && roll >= 20 && roll < 20 + density) {
        ch = 'c';
        count.chain++;
      } else if (has.vine && roll >= 40 && roll < 40 + density / 2) {
        ch = 'v';
        count.vine++;
      } else if (has.lamp && roll >= 50 && roll < 53) {
        ch = 'L';
        count.lamp++;
      } else if (has.special && roll >= 55 && roll < 62) {
        ch = 'HVNP'.charAt(d.int(4));
      } else if (has.fixed && roll >= 65 && roll < 75) {
        // fixed colours ('c' is the chained gem, so colour 2 is written 'C')
        ch = 'abCdef'.charAt(d.int(colors));
      }
      line += ch;
      const layers = has.sand && d.chance(0.35) ? 1 + d.int(2) : 0;
      count.sand += layers;
      floorLine += String(layers);
    }
    pieces.push(line);
    floor.push(floorLine);
  }

  const goals: Goal[] = [];
  if (count.sand > 0 && d.chance(0.6)) goals.push({ kind: 'sand' });
  if (count.stone > 0 && d.chance(0.6)) goals.push({ kind: 'stone' });
  if (count.chain > 0 && d.chance(0.6)) goals.push({ kind: 'chain' });
  if (count.vine > 0 && d.chance(0.6)) goals.push({ kind: 'vine' });
  const s1 = 200 + d.int(3000);
  const level: LevelDef = { id, cols, rows, colors, moves: 2 + d.int(22), pieces, goals, stars: [s1, s1 + 400 + d.int(3000), s1 + 4000 + d.int(8000)] };
  if (has.lamp) {
    const total = count.lamp + d.int(5);
    if (total > 0) {
      if (total > count.lamp || d.chance(0.5)) level.lamps = { total, maxOnBoard: 1 + d.int(3), everyMoves: d.int(4) };
      goals.push({ kind: 'lamp', target: 1 + d.int(total) });
    }
  }
  if (d.chance(0.3)) goals.push({ kind: 'color', color: d.int(colors) as Color, target: 4 + d.int(40) });
  if (goals.length === 0) goals.push({ kind: 'score', target: s1 });
  else if (d.chance(0.2)) goals.push({ kind: 'score', target: 100 + d.int(4000) });
  if (count.sand > 0) level.floor = floor;
  return level;
}

// ───────────────────────────── audited games ─────────────────────────────

export interface GameLog {
  level: LevelDef;
  seed: number;
  boosters: StartBoosters;
  calls: Call[];
}

/** A fresh game brought to the state after the first `upTo` calls of a log (used as a "clone"). */
export function replayLog(log: GameLog, upTo: number = log.calls.length): Game {
  const game = new Game(log.level, { seed: log.seed, boosters: log.boosters });
  for (let n = 0; n < upTo; n++) perform(game, log.calls[n]);
  return game;
}

export interface Played {
  log: GameLog;
  /** Every TurnResult, in call order. */
  results: TurnResult[];
  /** JSON of `results`. */
  transcript: string;
  game: Game;
  turns: number;
  accepted: number;
}

export interface PlayOptions {
  maxCalls?: number;
  /**
   * Every `probeEvery` calls (while playing) try EVERY pair of adjacent cells, in both orders, on
   * copies of the game: swap() must accept exactly the pairs validMoves() lists — and the
   * reference rules allow — charge exactly one move, and leave a refused copy untouched.
   */
  probeEvery?: number;
}

/**
 * swap() ⇔ validMoves() ⇔ the reference rules, for every adjacent pair of the current board.
 * Works on `game.clone()` copies; one pair per call is cross-checked on a game rebuilt from the
 * log instead (so a broken clone() cannot hide a broken swap()).
 */
export function probeSwaps(game: Game, log: GameLog, d: Dice, stats: Record<string, number>): void {
  const s = game.snapshot();
  if (s.status !== 'playing') return;
  const listed = new Set(game.validMoves().map(moveKey));
  const w = { cols: s.cols, rows: s.rows, cells: s.cells };
  const before = JSON.stringify(s);
  const pairs: [Pos, Pos][] = [];
  for (let r = 0; r < s.rows; r++) {
    for (let c = 0; c < s.cols; c++) {
      if (c + 1 < s.cols) pairs.push([at(c, r), at(c + 1, r)]);
      if (r + 1 < s.rows) pairs.push([at(c, r), at(c, r + 1)]);
    }
  }
  const rebuilt = pairs.length > 0 ? d.int(pairs.length) : -1;
  pairs.forEach(([a, b], n) => {
    const key = moveKey({ a, b });
    const want = listed.has(key);
    if (refCanSwap(w, a, b) !== want) throw new Error(`probe: validMoves() ${want ? 'lists' : 'omits'} ${key} against the rules\n${picture(s).join('\n')}`);
    for (const [x, y] of [[a, b], [b, a]] as const) {
      const copy = game.clone();
      const res = copy.swap(x, y);
      if (res.accepted !== want) throw new Error(`probe: swap(${posKey(x)} → ${posKey(y)}) accepted=${String(res.accepted)} but validMoves() ${want ? 'lists' : 'does not list'} it\n${picture(s).join('\n')}`);
      if (game.canSwap(x, y) !== want) throw new Error(`probe: canSwap(${posKey(x)} → ${posKey(y)}) disagrees with validMoves()`);
      if (res.accepted) {
        if (res.snapshot.movesLeft !== s.movesLeft - 1) throw new Error('probe: an accepted swap must cost exactly one move');
        const first = res.steps[0];
        if (first.type !== 'swap' || !first.valid || posKey(first.a) !== posKey(x) || posKey(first.b) !== posKey(y)) throw new Error('probe: an accepted swap must start with its swap step');
      } else {
        if (JSON.stringify(res.snapshot) !== before || JSON.stringify(copy.snapshot()) !== before) throw new Error('probe: a refused swap changed the state');
        const bothExist = s.cells[x.r * s.cols + x.c].exists && s.cells[y.r * s.cols + y.c].exists;
        if (!bothExist) {
          if (res.steps.length !== 0) throw new Error('probe: a swap with a hole is no swap at all: no step');
        } else if (res.steps.length !== 1 || res.steps[0].type !== 'swap' || res.steps[0].valid) {
          throw new Error('probe: a refused swap of two existing adjacent cells returns one swap step with valid:false');
        }
      }
      stats[want ? 'probe:accepted' : 'probe:refused'] = (stats[want ? 'probe:accepted' : 'probe:refused'] ?? 0) + 1;
      if (n === rebuilt && x === a) {
        const fresh = replayLog(log);
        if (JSON.stringify(fresh.snapshot()) !== before) throw new Error('probe: replaying the log does not reproduce the game');
        if (JSON.stringify(fresh.swap(x, y)) !== JSON.stringify(res)) throw new Error('probe: a clone and a replayed game answer the same swap differently');
        stats['probe:rebuilt'] = (stats['probe:rebuilt'] ?? 0) + 1;
      }
    }
  });
  if (JSON.stringify(game.snapshot()) !== before) throw new Error('probe: probing changed the game');
}

/**
 * Play one whole game with a seeded bot and audit every call. The bot mostly makes valid moves
 * (sometimes the hint), and mixes in boosters, illegal swaps, calls in the wrong status,
 * continues after losing and the end bonus.
 */
export function playAudited(level: LevelDef, seed: number, botSeed: number, stats: Record<string, number>, options: PlayOptions | number = {}): Played {
  const o: PlayOptions = typeof options === 'number' ? { maxCalls: options } : options;
  const maxCalls = o.maxCalls ?? 260;
  const prober = dice(botSeed ^ 0x5bd1e995);
  const bot = dice(botSeed);
  const boosters: StartBoosters = {};
  if (bot.chance(0.25)) boosters.extraMoves = true;
  if (bot.chance(0.2)) boosters.prism = true;
  if (bot.chance(0.2)) boosters.beamNova = true;
  const game = new Game(level, { seed, boosters });
  const log: GameLog = { level, seed, boosters, calls: [] };
  const referee = new Referee(level, game.snapshot(), { stats, boosters });
  const results: TurnResult[] = [];
  let turns = 0;
  let accepted = 0;
  let continues = bot.int(3);
  const mischief = 0.1 + bot.next() * 0.25;

  const run = (call: Call): TurnResult => {
    const before = game.snapshot();
    const res = perform(game, call);
    log.calls.push(call);
    results.push(res);
    turns++;
    if (res.accepted) accepted++;
    referee.check(before, call, res, game);
    return res;
  };
  const anyCell = (): Pos => at(bot.int(level.cols + 2) - 1, bot.int(level.rows + 2) - 1);
  const neighbour = (p: Pos): Pos => {
    const k = bot.int(4);
    return at(p.c + (k === 0 ? 1 : k === 1 ? -1 : 0), p.r + (k === 2 ? 1 : k === 3 ? -1 : 0));
  };

  for (let guard = 0; guard < maxCalls; guard++) {
    const status = game.snapshot().status;
    if (o.probeEvery !== undefined && guard % o.probeEvery === 0) probeSwaps(game, log, prober, stats);
    if (status === 'won') {
      run({ op: 'swap', a: anyCell(), b: anyCell() });
      run({ op: 'addMoves', n: 3 });
      run({ op: 'endBonus' });
      run({ op: 'endBonus' });
      run({ op: 'hammer', at: anyCell() });
      run({ op: 'shuffle' });
      break;
    }
    if (status === 'lost') {
      run({ op: 'shuffle' });
      run({ op: 'endBonus' });
      run({ op: 'addMoves', n: bot.pick([0, -1, 1.5, Number.NaN]) });
      if (continues <= 0) break;
      continues--;
      if (!run({ op: 'addMoves', n: 1 + bot.int(5) }).accepted) break;
      continue;
    }
    if (bot.chance(mischief)) {
      const what = bot.int(9);
      if (what === 0 || what === 1) run({ op: 'hammer', at: anyCell() });
      else if (what === 2 || what === 3) {
        const a = anyCell();
        run({ op: 'freeSwap', a, b: neighbour(a) });
      } else if (what === 4) run({ op: 'shuffle' });
      else if (what === 5) {
        const a = anyCell();
        run({ op: 'swap', a, b: neighbour(a) });
      } else if (what === 6) run({ op: 'swap', a: anyCell(), b: anyCell() });
      else if (what === 7) run({ op: 'addMoves', n: 5 });
      else run({ op: 'endBonus' });
      continue;
    }
    const moves = game.validMoves();
    if (moves.length === 0) throw new Error("status 'playing' but validMoves() is empty");
    let move = bot.pick(moves);
    if (bot.chance(0.2)) move = game.hint() as Move;
    const flip = bot.chance(0.5);
    run({ op: 'swap', a: flip ? move.b : move.a, b: flip ? move.a : move.b });
  }
  return { log, results, transcript: JSON.stringify(results), game, turns, accepted };
}

/**
 * §2.12 and "a refused call changes nothing": replay a played game on fresh engines.
 *  - the full log gives a byte-identical transcript;
 *  - the log WITHOUT its refused calls gives byte-identical results for the accepted ones, i.e.
 *    refused calls (and the queries in between) leave no hidden trace, not even in the RNG;
 *  - a clone taken half-way continues exactly like the original.
 */
export function checkDeterminism(played: Played): void {
  const { log, results } = played;
  const again = new Game(log.level, { seed: log.seed, boosters: log.boosters });
  const lean = new Game(log.level, { seed: log.seed, boosters: log.boosters });
  const half = Math.floor(log.calls.length / 2);
  let fork: Game | null = null;
  log.calls.forEach((call, n) => {
    if (n === half) fork = again.clone();
    const want = JSON.stringify(results[n]);
    if (JSON.stringify(perform(again, call)) !== want) throw new Error(`determinism: call ${n} (${JSON.stringify(call)}) gives a different result on replay`);
    if (results[n].accepted && JSON.stringify(perform(lean, call)) !== want) {
      throw new Error(`hidden state: call ${n} (${JSON.stringify(call)}) gives a different result when the refused calls before it are left out`);
    }
    if (fork !== null && JSON.stringify(perform(fork, call)) !== want) throw new Error(`clone: call ${n} (${JSON.stringify(call)}) gives a different result on a clone taken at call ${half}`);
  });
  const end = JSON.stringify(played.game.snapshot());
  if (JSON.stringify(again.snapshot()) !== end || JSON.stringify(lean.snapshot()) !== end) throw new Error('determinism: final snapshots differ');
}

// ───────────────────────────── audited hand-built games ─────────────────────────────

/**
 * A game with a Referee attached from its first snapshot: every call made through it is audited
 * (transcript, hits, scores, counters, queries) on top of whatever the test itself asserts.
 */
export class Audit {
  readonly game: Game;
  readonly referee: Referee;
  /** Every call made so far (for replaying the game on a fresh engine). */
  readonly calls: Call[] = [];

  constructor(game: Game, o: RefereeOptions = { handBuilt: true, looseColors: true }) {
    this.game = game;
    this.referee = new Referee(game.level, game.snapshot(), o);
  }

  get snap(): Snapshot {
    return this.game.snapshot();
  }

  run(call: Call): TurnResult {
    const before = this.game.snapshot();
    const res = perform(this.game, call);
    this.calls.push(call);
    this.referee.check(before, call, res, this.game);
    return res;
  }

  swap(a: Pos, b: Pos): TurnResult {
    return this.run({ op: 'swap', a, b });
  }

  hammer(where: Pos): TurnResult {
    return this.run({ op: 'hammer', at: where });
  }

  freeSwap(a: Pos, b: Pos): TurnResult {
    return this.run({ op: 'freeSwap', a, b });
  }

  shuffle(): TurnResult {
    return this.run({ op: 'shuffle' });
  }

  addMoves(n: number): TurnResult {
    return this.run({ op: 'addMoves', n });
  }

  endBonus(): TurnResult {
    return this.run({ op: 'endBonus' });
  }
}

/** `build()` + `Audit` in one go. */
export function audit(rows: string[], o: BuildOpts = {}): Audit {
  return new Audit(build(rows, o));
}

export type ClearStep = Extract<Step, { type: 'clear' }>;
export type FallStep = Extract<Step, { type: 'fall' }>;
export type ActivateStep = Extract<Step, { type: 'activate' }>;

export const clearsOf = (res: TurnResult): ClearStep[] => stepsOf(res.steps, 'clear');

/** "c,r:cause:result" of every hit of a clear step, in transcript order. */
export const hitList = (step: ClearStep): string[] => step.hits.map((h) => `${h.at.c},${h.at.r}:${h.cause}:${h.result}`);

/** Sorted "c,r" keys of the hits of a clear step (optionally only those with a given result / cause). */
export function hitCells(step: ClearStep, only?: { cause?: HitCause; result?: Hit['result'] }): string[] {
  return step.hits
    .filter((h) => (only?.cause === undefined || h.cause === only.cause) && (only?.result === undefined || h.result === only.result))
    .map((h) => posKey(h.at))
    .sort();
}

/** Sorted "c,r" keys from a compact list like "0,1 2,1 3,1". */
export const cellsOf = (text: string): string[] => text.trim().split(/\s+/).filter((t) => t.length > 0).sort();

/**
 * Try seeds 1..`tries` until `quiet(result)` holds for the first call — used where a test needs a
 * transcript without accidental matches among the randomly coloured refill gems. Throws when no
 * seed qualifies, so a test can never silently skip its assertions.
 */
export function quietRun(rows: string[], o: BuildOpts, call: Call, quiet: (res: TurnResult) => boolean, tries = 300): { t: Audit; res: TurnResult; seed: number } {
  for (let seed = 1; seed <= tries; seed++) {
    const probe = build(rows, { ...o, seed });
    if (!quiet(perform(probe, call))) continue;
    const t = new Audit(build(rows, { ...o, seed }));
    return { t, res: t.run(call), seed };
  }
  throw new Error(`quietRun: no seed in 1..${tries} gives the transcript shape the test needs`);
}
