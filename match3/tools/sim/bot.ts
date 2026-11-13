/**
 * Simulator bots. They play through the public engine surface only (`GameApi` + `Game.clone()`),
 * exactly like the play screen does, and are deterministic for a given seed.
 *
 *   random  a uniformly random valid move — the floor: the first levels must survive even this
 *   novice  a brand-new player: half the moves are random, the other half the best-looking one
 *   casual  an average casual player: looks at what each move does *immediately* (the match it
 *           makes and what the specials in it reach — no cascades, no planning), ranks the moves
 *           by goal progress first, then specials / combos, then matches right beside the goal,
 *           then gems cleared; equally good moves in random order. Plays the best-looking move
 *           60 % of the time, one of the four best-looking 28 % of the time, and any move at all
 *           12 % of the time (a slip of attention)
 *   expert  a strong, attentive player: tries every move on copies of the game and scores the
 *           position it leads to against the goals, plus what the best follow-up would be worth.
 *           The copies are RE-SEEDED before the move is tried, so the expert sees how the board
 *           falls but not which gems will drop in next — it cannot peek at the future
 *
 * The level balance (tools/levelgen/tune.ts, tools/sim/run.ts) is defined against the casual bot;
 * the expert bot proves that a level rewards good play and is not luck-only; the random and novice
 * bots guard the first levels.
 */
import { Game, createRng } from '../../src/engine/index.ts';
import type { GameApi, Goal, GoalProgress, LevelDef, Move, Rng, Snapshot } from '../../src/engine/index.ts';

export type BotKind = 'random' | 'novice' | 'casual' | 'expert';
export const BOT_KINDS: readonly BotKind[] = ['random', 'novice', 'casual', 'expert'];

/** What the bots need from a game: the public API plus `clone()` for look-ahead. */
export interface SimGame extends GameApi {
  clone(): SimGame;
}

export interface Bot {
  readonly kind: BotKind;
  /**
   * Choose the next move (`a` is dragged onto `b`). `snapshot` is the game's current state and
   * `moves` its valid moves (`game.validMoves()`; computed here when omitted).
   */
  pick(game: SimGame, snapshot: Snapshot, moves?: readonly Move[]): Move | null;
}

// ───────────────────────────── board view ─────────────────────────────

const K_NONE = 0;
const K_GEM = 1;
const K_BEAM_H = 2;
const K_BEAM_V = 3;
const K_NOVA = 4;
const K_PRISM = 5;
const K_LAMP = 6;
const K_STONE = 7;
const K_VINE = 8;

const KIND_CODE: Record<string, number> = {
  gem: K_GEM,
  beamH: K_BEAM_H,
  beamV: K_BEAM_V,
  nova: K_NOVA,
  prism: K_PRISM,
  lamp: K_LAMP,
  stone: K_STONE,
  vine: K_VINE,
};

/** A snapshot unpacked into flat arrays (index = r * cols + c) for the static evaluator. */
interface View {
  cols: number;
  rows: number;
  n: number;
  exists: Uint8Array;
  kind: Uint8Array;
  /** 0..5, or 9 for "no colour" */
  color: Uint8Array;
  chained: Uint8Array;
  hp: Uint8Array;
  sand: Uint8Array;
  exit: Uint8Array;
  /** scratch: hits per cell in the move being evaluated */
  mark: Uint8Array;
  /** scratch: 1 = the cell is emptied by the move being evaluated */
  gone: Uint8Array;
  /** 1 = the cell is on or right next to something the unmet goals still need (see `markNear`) */
  near: Uint8Array;
}

const NO_COLOR = 9;

function makeView(snap: Snapshot): View {
  const n = snap.cols * snap.rows;
  const v: View = {
    cols: snap.cols,
    rows: snap.rows,
    n,
    exists: new Uint8Array(n),
    kind: new Uint8Array(n),
    color: new Uint8Array(n),
    chained: new Uint8Array(n),
    hp: new Uint8Array(n),
    sand: new Uint8Array(n),
    exit: new Uint8Array(n),
    mark: new Uint8Array(n),
    gone: new Uint8Array(n),
    near: new Uint8Array(n),
  };
  for (let i = 0; i < n; i++) {
    const cell = snap.cells[i]!;
    v.color[i] = NO_COLOR;
    if (!cell.exists) continue;
    v.exists[i] = 1;
    v.sand[i] = cell.sand;
    v.exit[i] = cell.exit ? 1 : 0;
    const p = cell.piece;
    if (p === null) continue;
    v.kind[i] = KIND_CODE[p.kind] ?? K_NONE;
    v.color[i] = p.color >= 0 ? p.color : NO_COLOR;
    v.chained[i] = p.chained ? 1 : 0;
    v.hp[i] = p.hp;
  }
  return v;
}

/** What a move is worth at first sight, in the casual player's order of importance. */
interface MoveValue {
  /** progress toward the unmet goals (≈ one unit per gem / layer / blocker / lamp row) */
  goal: number;
  /** specials created or combined */
  special: number;
  /** cells emptied right beside what the goals still need (no progress yet, but it stirs the right spot) */
  near: number;
  /** cells hit */
  cleared: number;
}

/** Per-goal weights of the unmet goals, prepared once per position. */
interface Wants {
  color: Float64Array;
  sand: number;
  stone: number;
  vine: number;
  chain: number;
  lamp: number;
}

function wantsOf(goals: readonly GoalProgress[]): Wants {
  // Blockers that are not a goal still get a little attention: they are in the way.
  const w: Wants = { color: new Float64Array(6), sand: 0.1, stone: 0.25, vine: 0.6, chain: 0.25, lamp: 0 };
  for (const g of goals) {
    if (g.done) continue;
    const goal: Goal = g.goal;
    switch (goal.kind) {
      case 'color':
        w.color[goal.color] = 1;
        break;
      case 'sand':
        w.sand = 1;
        break;
      case 'stone':
        w.stone = 1;
        break;
      case 'vine':
        w.vine = 1.5;
        break;
      case 'chain':
        w.chain = 1.2;
        break;
      case 'lamp':
        w.lamp = 1;
        break;
      default:
        break;
    }
  }
  return w;
}

/**
 * Mark the neighbourhood of everything the unmet goals still need: sand, stones, vines and chains
 * that are goals, and the cells a lamp still has to sink through. A player who cannot make
 * progress right now works next to the goal, not at the far end of the board.
 */
function markNear(v: View, w: Wants): void {
  const { cols, rows, n, near } = v;
  near.fill(0);
  const around = (i: number): void => {
    const c0 = i % cols;
    const r0 = (i - c0) / cols;
    for (let r = Math.max(0, r0 - 1); r <= Math.min(rows - 1, r0 + 1); r++) {
      for (let c = Math.max(0, c0 - 1); c <= Math.min(cols - 1, c0 + 1); c++) near[r * cols + c] = 1;
    }
  };
  for (let i = 0; i < n; i++) {
    if (v.exists[i] === 0) continue;
    const kind = v.kind[i]!;
    if ((w.sand >= 1 && v.sand[i]! > 0) || (w.stone >= 1 && kind === K_STONE) || (w.vine > 1 && kind === K_VINE) || (w.chain >= 1 && v.chained[i] === 1)) around(i);
    if (w.lamp > 0 && kind === K_LAMP) for (let q = i + cols; q < n; q += cols) if (v.exists[q] === 1) around(q);
  }
}

/** Extra goal value of a move that cuts at least one vine: no vine spreads after it. */
const VINE_HELD_BACK = 1;

const SPECIAL_BEAM = 1.5;
const SPECIAL_NOVA = 2;
const SPECIAL_PRISM = 3;

/** Length of the same-colour run through `idx` (as if it held `color`), horizontal or vertical. */
function runLength(v: View, idx: number, color: number, horizontal: boolean): number {
  const { cols, n } = v;
  let run = 1;
  if (horizontal) {
    const c = idx % cols;
    for (let x = c - 1, k = idx - 1; x >= 0 && v.color[k] === color; x--, k--) run++;
    for (let x = c + 1, k = idx + 1; x < cols && v.color[k] === color; x++, k++) run++;
  } else {
    for (let k = idx - cols; k >= 0 && v.color[k] === color; k -= cols) run++;
    for (let k = idx + cols; k < n && v.color[k] === color; k += cols) run++;
  }
  return run;
}

/** Hit every cell an effect of `kind` centred on `at` reaches (first-order only). */
function blast(v: View, kind: 'beamH' | 'beamV' | 'nova' | 'cross' | 'bigCross' | 'bigNova' | 'all', at: number, out: number[]): void {
  const { cols, n } = v;
  const c0 = at % cols;
  const r0 = (at - c0) / cols;
  for (let i = 0; i < n; i++) {
    if (v.exists[i] === 0) continue;
    const c = i % cols;
    const dc = Math.abs(c - c0);
    const dr = Math.abs((i - c) / cols - r0);
    let inside: boolean;
    switch (kind) {
      case 'beamH':
        inside = dr === 0;
        break;
      case 'beamV':
        inside = dc === 0;
        break;
      case 'nova':
        inside = dc + dr <= 2;
        break;
      case 'cross':
        inside = dc === 0 || dr === 0;
        break;
      case 'bigCross':
        inside = dc <= 1 || dr <= 1;
        break;
      case 'bigNova':
        inside = (dc <= 2 && dr <= 2) || (dc === 3 && dr === 0) || (dr === 3 && dc === 0);
        break;
      default:
        inside = true;
    }
    if (inside) out.push(i);
  }
}

/**
 * First-sight value of dragging the piece on `i` onto `j`: the match(es) the swap makes, the
 * blockers next to them, and what the specials involved reach directly. No gravity, no cascades.
 */
function evaluate(v: View, w: Wants, i: number, j: number): MoveValue {
  const { cols, rows, n } = v;
  const matched: number[] = [];
  const blasted: number[] = [];
  let special = 0;

  const ka = v.kind[i]!;
  const kb = v.kind[j]!;
  const aBlast = ka === K_BEAM_H || ka === K_BEAM_V || ka === K_NOVA;
  const bBlast = kb === K_BEAM_H || kb === K_BEAM_V || kb === K_NOVA;
  const lampSwap = ka === K_LAMP || kb === K_LAMP;
  let swapped = false;

  if (ka === K_PRISM && kb === K_PRISM) {
    blast(v, 'all', j, blasted);
    special = 8;
  } else if ((ka === K_PRISM || kb === K_PRISM) && !lampSwap) {
    const other = ka === K_PRISM ? j : i;
    const otherKind = v.kind[other]!;
    const color = v.color[other]!;
    blasted.push(ka === K_PRISM ? i : j);
    let flip = false;
    for (let k = 0; k < n; k++) {
      if (v.color[k] !== color) continue;
      blasted.push(k);
      if (otherKind !== K_GEM && v.chained[k] === 0) {
        // every gem of that colour becomes a copy of the special and fires
        blast(v, otherKind === K_NOVA ? 'nova' : flip ? 'beamH' : 'beamV', k, blasted);
        flip = !flip;
      }
    }
    special = otherKind === K_GEM ? 4 : 6;
  } else if (aBlast && bBlast) {
    const novas = (ka === K_NOVA ? 1 : 0) + (kb === K_NOVA ? 1 : 0);
    blast(v, novas === 2 ? 'bigNova' : novas === 1 ? 'bigCross' : 'cross', j, blasted);
    blasted.push(i);
    special = novas === 2 ? 5 : novas === 1 ? 4 : 3;
  } else {
    // An ordinary swap: exchange the two pieces in the view and look at the runs through them.
    swapped = true;
    swapCells(v, i, j);
    for (let side = 0; side < 2; side++) {
      const cell = side === 0 ? j : i;
      const color = v.color[cell]!;
      if (color === NO_COLOR) continue;
      const h = runLength(v, cell, color, true);
      const vert = runLength(v, cell, color, false);
      const hOk = h >= 3;
      const vOk = vert >= 3;
      if (!hOk && !vOk) continue;
      const longest = Math.max(hOk ? h : 0, vOk ? vert : 0);
      special += longest >= 5 ? SPECIAL_PRISM : hOk && vOk ? SPECIAL_NOVA : longest === 4 ? SPECIAL_BEAM : 0;
      const c0 = cell % cols;
      if (hOk) {
        for (let x = c0 - 1, k = cell - 1; x >= 0 && v.color[k] === color; x--, k--) matched.push(k);
        for (let x = c0 + 1, k = cell + 1; x < cols && v.color[k] === color; x++, k++) matched.push(k);
      }
      if (vOk) {
        for (let k = cell - cols; k >= 0 && v.color[k] === color; k -= cols) matched.push(k);
        for (let k = cell + cols; k < n && v.color[k] === color; k += cols) matched.push(k);
      }
      matched.push(cell);
    }
  }

  // ── what the hits do ──
  const mark = v.mark;
  const gone = v.gone;
  mark.fill(0);
  gone.fill(0);
  let goal = 0;
  let cleared = 0;
  let vinesCut = 0;

  const hit = (k: number, byMatch: boolean): void => {
    const kind = v.kind[k]!;
    const first = mark[k] === 0;
    mark[k] = 1;
    if (kind === K_STONE) {
      if (v.hp[k]! > 0) {
        v.hp[k] = v.hp[k]! - 1;
        goal += w.stone;
        cleared++;
        if (v.hp[k] === 0) gone[k] = 1;
      }
      return;
    }
    if (!first) return;
    if (kind === K_VINE) {
      goal += w.vine;
      vinesCut++;
      cleared++;
      gone[k] = 1;
      return;
    }
    if (v.sand[k]! > 0) goal += w.sand;
    if (kind === K_NONE || kind === K_LAMP) return;
    if (v.chained[k] === 1) {
      goal += w.chain;
      cleared++;
      return;
    }
    cleared++;
    gone[k] = 1;
    const color = v.color[k]!;
    if (color !== NO_COLOR) goal += w.color[color]!;
    if (kind !== K_GEM) {
      // a special set off by the move: add what it reaches itself (first order only)
      special += 1;
      if (byMatch && kind !== K_PRISM) blast(v, kind === K_BEAM_H ? 'beamH' : kind === K_BEAM_V ? 'beamV' : 'nova', k, blasted);
    }
  };

  const hpBackup: number[] = [];
  const noteStone = (k: number): void => {
    if (v.kind[k] === K_STONE) hpBackup.push(k, v.hp[k]!);
  };

  for (const k of matched) {
    if (mark[k] === 1) continue;
    hit(k, true);
  }
  // Stones and vines next to a match take one hit each.
  const adjacentSeen: number[] = [];
  for (const k of matched) {
    const c = k % cols;
    const r = (k - c) / cols;
    for (let dir = 0; dir < 4; dir++) {
      const nc = c + (dir === 0 ? 1 : dir === 1 ? -1 : 0);
      const nr = r + (dir === 2 ? 1 : dir === 3 ? -1 : 0);
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const q = nr * cols + nc;
      const kind = v.kind[q]!;
      if ((kind !== K_STONE && kind !== K_VINE) || adjacentSeen.indexOf(q) >= 0) continue;
      adjacentSeen.push(q);
      noteStone(q);
      hit(q, false);
    }
  }
  // `blasted` can grow while we walk it (specials inside the match add their own reach).
  for (let b = 0; b < blasted.length; b++) {
    const k = blasted[b]!;
    noteStone(k);
    hit(k, false);
  }

  // Lamps: every cell emptied below a lamp lets it sink one row; so does swapping it downwards.
  if (w.lamp > 0) {
    for (let k = 0; k < n; k++) {
      if (v.kind[k] !== K_LAMP) continue;
      let below = 0;
      let drop = 0;
      for (let q = k + cols; q < n; q += cols) {
        if (v.exists[q] === 0) continue;
        below++;
        if (gone[q] === 1) drop++;
      }
      if (drop > 0) goal += w.lamp * drop + (drop >= below ? 3 : 0);
    }
    if (swapped && lampSwap && Math.abs(i - j) === cols) {
      // after the swap the lamp sits on the other cell: lower is progress, higher is a step back
      const lampNow = ka === K_LAMP ? j : i;
      const lampWas = ka === K_LAMP ? i : j;
      goal += lampNow > lampWas ? w.lamp : -w.lamp;
      if (lampNow > lampWas && v.exit[lampNow] === 1) goal += 3;
    }
  }

  // Undo the scratch changes (newest first, so every stone gets back the layers it started with).
  for (let b = hpBackup.length - 2; b >= 0; b -= 2) v.hp[hpBackup[b]!] = hpBackup[b + 1]!;
  if (swapped) swapCells(v, i, j);
  // A turn that cuts a vine also keeps the vines from spreading (the vine tip says so).
  if (vinesCut > 0) goal += VINE_HELD_BACK;

  let near = 0;
  for (let k = 0; k < n; k++) if (gone[k] === 1 && v.near[k] === 1) near++;
  return { goal, special, near, cleared };
}

function swapCells(v: View, i: number, j: number): void {
  let t = v.kind[i]!;
  v.kind[i] = v.kind[j]!;
  v.kind[j] = t;
  t = v.color[i]!;
  v.color[i] = v.color[j]!;
  v.color[j] = t;
  t = v.chained[i]!;
  v.chained[i] = v.chained[j]!;
  v.chained[j] = t;
  t = v.hp[i]!;
  v.hp[i] = v.hp[j]!;
  v.hp[j] = t;
}

/** Weight of one cell emptied right beside the goal (a real goal unit weighs 100, a beam 18). */
const NEAR_WEIGHT = 4;

/** One number for ranking: goals first, then specials / combos, then working near the goal, then gems cleared. */
function rank(value: MoveValue): number {
  return value.goal * 100 + value.special * 12 + value.near * NEAR_WEIGHT + value.cleared;
}

interface Rated {
  move: Move;
  value: number;
}

/**
 * Every valid move (in the better of its two drag directions) with its first-sight value, best
 * first. Moves that look equally good come in random order when `rng` is given (a player has no
 * reason to prefer the top-left corner), otherwise in reading order.
 */
function rateMoves(snap: Snapshot, moves: readonly Move[], rng?: Rng): Rated[] {
  if (moves.length === 0) return [];
  const view = makeView(snap);
  const wants = wantsOf(snap.goals);
  markNear(view, wants);
  const cols = view.cols;
  const out: Rated[] = [];
  for (const move of moves) {
    const i = move.a.r * cols + move.a.c;
    const j = move.b.r * cols + move.b.c;
    const forward = rank(evaluate(view, wants, i, j));
    // The drag direction only matters for combos (the effect is centred on the destination).
    const bothSpecial = view.kind[i]! >= K_BEAM_H && view.kind[i]! <= K_PRISM && view.kind[j]! >= K_BEAM_H && view.kind[j]! <= K_PRISM;
    if (bothSpecial) {
      const backward = rank(evaluate(view, wants, j, i));
      if (backward > forward) {
        out.push({ move: { a: move.b, b: move.a }, value: backward });
        continue;
      }
    }
    out.push({ move, value: forward });
  }
  if (rng) rng.shuffle(out);
  // The sort is stable: ties keep the (shuffled, or reading) order, so the result is deterministic.
  out.sort((x, y) => y.value - x.value);
  return out;
}

/** The first-sight value of one move, as the casual player ranks it (exported for the tests). */
export function firstSightValue(snap: Snapshot, move: Move): number {
  const view = makeView(snap);
  const wants = wantsOf(snap.goals);
  markNear(view, wants);
  return rank(evaluate(view, wants, move.a.r * view.cols + move.a.c, move.b.r * view.cols + move.b.c));
}

// ───────────────────────────── the bots ─────────────────────────────

/** Probability that the casual player spots (and plays) the best-looking move. */
export const CASUAL_BEST = 0.6;
/** Probability that the casual player's attention slips and any valid move is played. */
export const CASUAL_SLIP = 0.12;
/** Otherwise the casual player plays one of this many best-looking moves at random. */
export const CASUAL_TOP = 4;
/** Probability that the novice plays a random move instead of the best-looking one. */
export const NOVICE_RANDOM = 0.5;
/** Futures the expert samples for every move it considers. */
export const EXPERT_SAMPLES = 2;

function randomBot(rng: Rng): Bot {
  return {
    kind: 'random',
    pick(game, _snapshot, given) {
      const moves = given ?? game.validMoves();
      return moves.length === 0 ? null : rng.pick(moves);
    },
  };
}

function noviceBot(rng: Rng): Bot {
  return {
    kind: 'novice',
    pick(game, snapshot, given) {
      const moves = given ?? game.validMoves();
      if (moves.length === 0) return null;
      if (rng.next() < NOVICE_RANDOM) return rng.pick(moves);
      return rateMoves(snapshot, moves, rng)[0]!.move;
    },
  };
}

function casualBot(rng: Rng): Bot {
  return {
    kind: 'casual',
    pick(game, snapshot, given) {
      const moves = given ?? game.validMoves();
      if (moves.length === 0) return null;
      const roll = rng.next();
      if (roll >= 1 - CASUAL_SLIP) return rng.pick(moves);
      const rated = rateMoves(snapshot, moves, rng);
      if (roll < CASUAL_BEST) return rated[0]!.move;
      return rated[rng.int(Math.min(CASUAL_TOP, rated.length))]!.move;
    },
  };
}

/**
 * How good a position is for the player, higher = better. Roughly "minus the work left":
 * one unit per gem still to collect, per blocker layer still to break, per row a lamp still has
 * to sink — plus a little for specials waiting on the board.
 */
function potential(snap: Snapshot): number {
  const { cols, rows, cells } = snap;
  let sand = 0;
  let stoneHp = 0;
  let vines = 0;
  let chains = 0;
  let specials = 0;
  let lampRowsLeft = 0;
  let lampsOnBoard = 0;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!;
    if (!cell.exists) continue;
    sand += cell.sand;
    const p = cell.piece;
    if (p === null) continue;
    if (p.chained) chains++;
    switch (p.kind) {
      case 'stone':
        stoneHp += p.hp;
        break;
      case 'vine':
        vines++;
        break;
      case 'lamp': {
        lampsOnBoard++;
        const c = i % cols;
        for (let r = (i - c) / cols + 1; r < rows; r++) if (cells[r * cols + c]!.exists) lampRowsLeft++;
        break;
      }
      case 'beamH':
      case 'beamV':
        specials += p.chained ? 0.3 : 1;
        break;
      case 'nova':
        specials += p.chained ? 0.3 : 1.3;
        break;
      case 'prism':
        specials += 2.2;
        break;
      default:
        break;
    }
  }

  let work = 0;
  let scoreOnly = true;
  const goalKinds: Record<string, boolean> = {};
  for (const g of snap.goals) {
    goalKinds[g.goal.kind] = true;
    if (g.goal.kind !== 'score') scoreOnly = false;
    if (g.done) continue;
    const left = g.target - g.current;
    switch (g.goal.kind) {
      case 'color':
        work += left;
        break;
      case 'score':
        work += left / 250;
        break;
      case 'lamp':
        // lamps not yet on the board still have the whole column to travel
        work += lampRowsLeft + Math.max(0, left - lampsOnBoard) * rows + left * 2;
        break;
      default:
        break;
    }
  }
  // Blockers: full weight when they are a goal, a fraction when they are merely in the way.
  work += sand * (goalKinds['sand'] ? 1 : 0.1);
  work += stoneHp * (goalKinds['stone'] ? 1 : 0.25);
  work += vines * (goalKinds['vine'] ? 1.6 : 0.7);
  work += chains * (goalKinds['chain'] ? 1.2 : 0.25);

  return -work + specials * 0.7 + snap.score * (scoreOnly ? 0.004 : 0.0004);
}

/**
 * Give a copy of the game a different future: the gems that drop in from now on (and every other
 * random decision) no longer match what the original game will do. The engine keeps its generator
 * in the private field `rng`; tests/levels/sim.test.ts fails if that ever stops working.
 */
export function reseed(copy: SimGame, seed: number): void {
  (copy as unknown as { rng: Rng }).rng = createRng(seed);
}

function expertBot(rng: Rng, samples: number): Bot {
  return {
    kind: 'expert',
    pick(game, snapshot, given) {
      const moves = given ?? game.validMoves();
      const rated = rateMoves(snapshot, moves, rng);
      if (rated.length === 0) return null;
      // The same futures for every candidate (common random numbers): a fair comparison.
      const futures: number[] = [];
      for (let k = 0; k < samples; k++) futures.push(Math.floor(rng.next() * 4294967296));
      let best: Move = rated[0]!.move;
      let bestValue = -Infinity;
      for (const candidate of rated) {
        let total = 0;
        let tried = 0;
        for (const future of futures) {
          const trial = game.clone();
          reseed(trial, future);
          const res = trial.swap(candidate.move.a, candidate.move.b);
          if (!res.accepted) continue;
          tried++;
          const after = res.snapshot;
          if (after.status === 'won') {
            total += 1e6 + after.movesLeft * 1000 + after.score * 0.001;
          } else {
            total += potential(after);
            if (after.status === 'playing') {
              // one step ahead: what the best follow-up looks like from there
              const next = rateMoves(after, trial.validMoves());
              if (next.length > 0) total += next[0]!.value * 0.004;
            }
          }
        }
        if (tried === 0) continue;
        const value = total / tried;
        if (value > bestValue) {
          bestValue = value;
          best = candidate.move;
        }
      }
      return best;
    },
  };
}

export function createBot(kind: BotKind, seed: number): Bot {
  // The bot's own randomness is separate from the game's, so both are reproducible.
  const rng = createRng((seed ^ 0x5bd1e995) >>> 0);
  if (kind === 'random') return randomBot(rng);
  if (kind === 'novice') return noviceBot(rng);
  if (kind === 'expert') return expertBot(rng, EXPERT_SAMPLES);
  return casualBot(rng);
}

// ───────────────────────────── playing one game ─────────────────────────────

export interface PlayOptions {
  /** Play with this many moves instead of the level's own (the tuner uses a generous cap). */
  moves?: number;
  /** Record the running score after every move (`PlayResult.scoreTrack`). */
  trackScore?: boolean;
  /**
   * After a loss, take the game's own "continue" (`addMoves`) with this many extra moves and play
   * on, to learn how close the loss was (`PlayResult.rescuedAt`). The result otherwise describes
   * the game as it stood when it was lost.
   */
  continueWith?: number;
}

export interface PlayResult {
  won: boolean;
  /** Valid moves made. */
  movesUsed: number;
  /** Moves left at the moment the level was decided (before the end bonus spent them). */
  movesLeft: number;
  /** Final score — after the end bonus when the level was won. */
  score: number;
  /** Score at the moment the level was decided. */
  scoreBeforeBonus: number;
  stars: number;
  /** Automatic "no moves left" shuffles during the game. */
  shuffles: number;
  /** The move after which the first automatic shuffle came (1 = after the very first move); 0 = never. */
  firstShuffleAt: number;
  /** The level ended because no move could ever exist again (not resumable). */
  deadBoard: boolean;
  /** Sum, over the turns played, of the number of valid moves the board offered. */
  validMoves: number;
  /** Turns on which the board offered fewer than three valid moves. */
  tightTurns: number;
  /** With `continueWith`, after a loss: extra moves the bot then needed to win (0 = still lost). */
  rescuedAt: number;
  /** With `trackScore`: score after move 1, 2, 3 … */
  scoreTrack?: number[];
}

/** Hard stop: no level comes anywhere near this many moves. */
const MOVE_GUARD = 400;

/** Play one level to the end with one bot. Deterministic for (level, seed, bot kind, options). */
export function playGame(level: LevelDef, seed: number, kind: BotKind, opts: PlayOptions = {}): PlayResult {
  const def: LevelDef = opts.moves !== undefined ? { ...level, moves: opts.moves } : level;
  const game: SimGame = new Game(def, { seed });
  const bot = createBot(kind, seed);
  let snap = game.snapshot();
  let movesUsed = 0;
  let shuffles = 0;
  let firstShuffleAt = 0;
  let validMoves = 0;
  let tightTurns = 0;
  const track: number[] | undefined = opts.trackScore ? [] : undefined;

  const turn = (): void => {
    const moves = game.validMoves();
    validMoves += moves.length;
    if (moves.length < 3) tightTurns++;
    const move = bot.pick(game, snap, moves);
    if (move === null) throw new Error(`level ${level.id}, seed ${seed}: status is 'playing' but there is no valid move`);
    const res = game.swap(move.a, move.b);
    if (!res.accepted) throw new Error(`level ${level.id}, seed ${seed}: the engine refused a move it listed as valid`);
    movesUsed++;
    for (const step of res.steps) {
      if (step.type !== 'shuffle') continue;
      shuffles++;
      if (firstShuffleAt === 0) firstShuffleAt = movesUsed;
    }
    snap = res.snapshot;
    if (track) track.push(snap.score);
  };

  while (snap.status === 'playing' && movesUsed < MOVE_GUARD) turn();

  const won = snap.status === 'won';
  const result: PlayResult = {
    won,
    movesUsed,
    movesLeft: snap.movesLeft,
    score: snap.score,
    scoreBeforeBonus: snap.score,
    stars: snap.stars,
    shuffles,
    firstShuffleAt,
    deadBoard: snap.status === 'lost' && snap.canContinue === false,
    validMoves,
    tightTurns,
    rescuedAt: 0,
  };
  if (track) result.scoreTrack = track.slice();
  if (won) {
    const bonus = game.endBonus();
    result.score = bonus.snapshot.score;
    result.stars = bonus.snapshot.stars;
  } else if (opts.continueWith !== undefined && opts.continueWith > 0 && snap.status === 'lost' && snap.canContinue !== false) {
    // The statistics above are frozen: what follows only measures how close the loss was.
    const usedAtLoss = movesUsed;
    const resumed = game.addMoves(opts.continueWith);
    if (resumed.accepted) {
      snap = resumed.snapshot;
      while (snap.status === 'playing' && movesUsed < MOVE_GUARD) turn();
      if (snap.status === 'won') result.rescuedAt = movesUsed - usedAtLoss;
    }
  }
  return result;
}
