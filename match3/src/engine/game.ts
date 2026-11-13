/**
 * The game engine: one `Game` per level attempt. Pure logic — no DOM, no timers, no Math.random.
 * Rules: docs/DESIGN.md §2. Contract: ./types.ts (`GameApi`).
 *
 * Shape of one turn (the Step transcript the renderer plays back):
 *
 *   swap → [transform] → [activate] → clear → ([activate] → clear)* → fall → [collect → fall]
 *        → (next cascade: clear → … → fall)* → [grow] → [shuffle [→ transform 'recolor']] → [status]
 *
 * - A *wave* is one `clear` step. A wave is either a match wave (all match groups on the board,
 *   plus adjacent damage — at most one adjacent hit per blocker per wave) or a blast wave
 *   (everything the specials listed in the preceding `activate` step reach).
 * - In a blast wave every effect hits each cell it reaches exactly once, in the order the effects
 *   are listed. Two effects that share a cell both hit it, so `hits` can name a cell more than
 *   once (a 2-layer stone under two crossing beams is destroyed).
 * - Specials hit in a wave fire in the next wave, before gravity runs (chain reactions). Each
 *   special fires once: the hit removes it, later hits of the same wave find an empty cell.
 * - Swap combos and the end bonus use their pieces up in the same wave that carries the effect:
 *   those pieces appear as hits with result 'activated' in the `clear` after the `activate`.
 * - A special created by a match is immune until the next `fall` (a blast that reaches it is
 *   reported as a hit with result 'none'), so the piece the player just made is not wasted.
 * - `cascade` grows by one after every `fall` step.
 *
 * Other turns: hammer = booster → clear (the one hit) → …settle as above;
 * freeSwap = booster → swap → …; shuffle booster = booster → shuffle;
 * endBonus = [transform 'endBonus'] → (activate → clear → …settle)* until no special is left.
 *
 * Decisions where DESIGN.md §2 leaves room (all covered by tests/engine):
 * - Vines spread only after a real move (a valid swap), never after a booster.
 * - freeSwap may move a lamp; a hammer on a lamp, an empty cell or a hole with no sand to remove
 *   is refused, as is any booster call that would change nothing.
 * - Lamps drop in through columns that run without a gap from spawner to exit, as the last
 *   piece entering that column; with no lamp placed in the level the first one may come at once.
 * - Vine / stone / chain / sand goals count what is destroyed against the number the level
 *   started with (vines that grew later do not raise the target).
 * - If no arrangement of the board can ever contain a move (even after recolouring), the level
 *   ends: 'lost' — or 'won' for a score-only level whose target is already reached. Such a loss
 *   cannot be resumed: `Snapshot.canContinue` is false and addMoves() is refused. This never
 *   loops and never leaves the player stuck in 'playing'.
 * - The end-of-turn shuffle also runs on the turn that uses up the last move, so the board is
 *   ready when addMoves() resumes the level.
 * - From cascade 8 on, refills avoid completing a match (see CALM_CASCADE): turns always end.
 *
 * ./replay.ts applies such a transcript to a snapshot; the tests use it to prove that every
 * transcript is complete.
 */
import type {
  CellView,
  Color,
  CreatedSpecial,
  Fx,
  FxKind,
  GameApi,
  GameOptions,
  GameStatus,
  Goal,
  GoalProgress,
  Hit,
  HitCause,
  InLevelBooster,
  LevelDef,
  Move,
  Piece,
  PieceKind,
  Pos,
  Snapshot,
  Step,
  TurnResult,
} from './types.ts';
import { createRng, type Rng } from './rng.ts';
import { EXTRA_MOVES_BOOSTER, SCORE, cascadeMultiplier, specialBonus, starsFor } from './score.ts';
import { createBoard, lampColumns, parseLevel } from './level.ts';
import {
  RANDOM_COLOR,
  colourWithoutMatch,
  fillRandom,
  findGroups,
  hasValidMove,
  isBlastKind,
  isFreeGem,
  isImmovable,
  isValidSwap,
  reshuffle,
  validSwaps,
  type Board,
  type Group,
} from './board.ts';

/** A piece for `GameDebug.cells`. Gem-like kinds without a colour get a random one. */
export interface DebugPiece {
  kind: PieceKind;
  color?: Color | -1;
  hp?: number;
  chained?: boolean;
}

/**
 * Hand-built start positions for tests and tools (third constructor argument). Not used by the
 * game itself.
 */
export interface GameDebug {
  /**
   * Row-major overrides of the level's piece layer: a DebugPiece replaces the level's piece,
   * `null` leaves the cell empty, `undefined` keeps the level's piece. Holes stay holes.
   */
  cells?: readonly (DebugPiece | null | undefined)[];
  /** Keep the start position exactly as given, even when it has no valid move. */
  noStartShuffle?: boolean;
}

/** A special effect waiting to fire in the next blast wave. */
interface Fire {
  kind: FxKind;
  /** Cell the effect is centred on. */
  at: number;
  /** Colour of the firing piece; for 'prism': the colour to clear, or -1 = pick the most common. */
  color: Color | -1;
  /**
   * Cells whose pieces are used up by this effect in the same wave (swap combos, end bonus).
   * null for chain reactions: there the special was already removed by the hit that triggered it.
   */
  consumed: number[] | null;
}

interface Turn {
  steps: Step[];
  cascade: number;
  pending: Fire[];
  /** The player's swap, until the first match wave has used it (special placement, beam direction). */
  swap: { i: number; j: number; horizontal: boolean } | null;
  /** Ids of specials created since the last fall (immune to blasts until then). */
  fresh: Set<number>;
}

/**
 * From this cascade on, new gems are coloured so that they do not complete a match where they
 * land. Refills are plain random before that. Without this valve a large board with three
 * colours is close to a self-sustaining chain reaction (hundreds of cascades in one turn); with
 * it every turn ends after a few more cascades. The value equals the score multiplier cap, so
 * nothing is lost: the cascade is already worth its maximum.
 */
const CALM_CASCADE = SCORE.cascadeCap;
/** Hard stop for the settle loop (never reached in practice; guarantees termination). */
const SETTLE_GUARD = 300;
/** Hard stop for the end-bonus "fire everything" rounds. */
const BONUS_ROUNDS = 60;
/** Sort key = distance * KEY + cell index (cell indices are far below KEY). */
const KEY = 65536;

export class Game implements GameApi {
  readonly level: LevelDef;

  private readonly b: Board;
  private readonly rng: Rng;
  private readonly colors: number;
  /** The level's goals, minus anything that is not a goal object (the Game never crashes on bad data). */
  private readonly goals: Goal[];
  private readonly starLimits: [number, number, number];
  private readonly scoreOnly: boolean;
  private readonly lampCfg: { total: number; maxOnBoard: number; everyMoves: number } | null;
  private readonly lampCols: boolean[];
  /** Scratch: blockers that already took their adjacent hit in the current match wave. */
  private readonly seen: Uint8Array;
  /** Scratch: pieces spawned per column in the current fall. */
  private readonly spawnCount: Uint8Array;

  private nextId = 1;
  private movesLeft = 0;
  private score = 0;
  private status: GameStatus = 'playing';
  /** Valid swaps made so far (lamp spawn timing). */
  private moveCount = 0;
  private bonusDone = false;
  /** While 'lost': can addMoves() resume? False when no move can ever exist on the board again. */
  private resumable = true;
  private lampSpawnsOff = false;
  private vineCut = false;
  private hintForward = true;

  // goal bookkeeping
  private readonly collected: number[] = [0, 0, 0, 0, 0, 0];
  private sandTotal = 0;
  private sandCleared = 0;
  private stoneTotal = 0;
  private stonesDestroyed = 0;
  private vineTotal = 0;
  private vinesDestroyed = 0;
  private chainTotal = 0;
  private chainsBroken = 0;
  private lampsDelivered = 0;
  private lampsExisted = 0;
  private lastLampMove = 0;

  constructor(level: LevelDef, opts: GameOptions, debug?: GameDebug) {
    this.level = level;
    this.rng = createRng(opts ? opts.seed : 0);
    this.colors = Number.isInteger(level.colors) ? Math.min(6, Math.max(1, level.colors)) : 6;
    this.goals = Array.isArray(level.goals) ? level.goals.filter((g) => g !== null && typeof g === 'object' && typeof g.kind === 'string') : [];
    const stars = level.stars as unknown;
    this.starLimits =
      Array.isArray(stars) && stars.length === 3 && stars.every((v) => typeof v === 'number' && !Number.isNaN(v))
        ? [stars[0] as number, stars[1] as number, stars[2] as number]
        : [Infinity, Infinity, Infinity];

    const parsed = parseLevel(level);
    if (debug?.cells) {
      for (let i = 0; i < parsed.n; i++) {
        const d = debug.cells[i];
        if (d === undefined || !parsed.exists[i]) continue;
        if (d === null) {
          parsed.specs[i] = null;
          continue;
        }
        const coloured = d.kind === 'gem' || isBlastKind(d.kind);
        parsed.specs[i] = {
          kind: d.kind,
          color: coloured ? (d.color !== undefined && d.color >= 0 ? d.color : RANDOM_COLOR) : -1,
          hp: d.kind === 'stone' ? Math.min(3, Math.max(1, d.hp ?? 1)) : 1,
          chained: coloured && d.chained === true,
        };
      }
    }
    const { board, randomCells } = createBoard(parsed, () => this.nextId++);
    this.b = board;
    this.seen = new Uint8Array(board.n);
    this.spawnCount = new Uint8Array(board.cols);

    const clean = fillRandom(board, randomCells, this.colors, this.rng);

    // Goal targets are counted from the initial board (§2.9).
    for (let i = 0; i < board.n; i++) {
      this.sandTotal += board.sand[i] as number;
      const p = board.pieces[i] as Piece | null;
      if (p === null) continue;
      if (p.kind === 'stone') this.stoneTotal++;
      else if (p.kind === 'vine') this.vineTotal++;
      else if (p.kind === 'lamp') this.lampsExisted++;
      if (p.chained) this.chainTotal++;
    }
    this.scoreOnly = this.goals.length > 0 && this.goals.every((g) => g.kind === 'score');

    const cfg = level.lamps;
    const lampsOk = cfg !== undefined && cfg !== null && Number.isFinite(cfg.total) && Number.isFinite(cfg.maxOnBoard) && Number.isFinite(cfg.everyMoves);
    this.lampCfg = lampsOk ? { total: cfg.total, maxOnBoard: cfg.maxOnBoard, everyMoves: cfg.everyMoves } : null;
    const friendly = lampColumns(parsed);
    this.lampCols = friendly.some((f) => f) ? friendly : friendly.map(() => true);
    // With lamps already on the board the first drop waits `everyMoves`; otherwise it may come at once.
    this.lastLampMove = this.lampsExisted > 0 ? 0 : -1e9;

    const boosters = (opts && opts.boosters) || {};
    const moves = Number.isFinite(level.moves) ? Math.max(0, Math.floor(level.moves)) : 0;
    this.movesLeft = moves + (boosters.extraMoves ? EXTRA_MOVES_BOOSTER : 0);

    const keep = debug?.noStartShuffle === true;
    if (!clean && !keep && !hasValidMove(board)) reshuffle(board, this.rng, this.colors, false);

    // Start boosters (§2.11) go onto random plain gems.
    if (boosters.prism || boosters.beamNova) {
      const free: number[] = [];
      for (let i = 0; i < board.n; i++) {
        const p = board.pieces[i] as Piece | null;
        if (p !== null && isFreeGem(p)) free.push(i);
      }
      this.rng.shuffle(free);
      let next = 0;
      if (boosters.prism && next < free.length) {
        const p = board.pieces[free[next++] as number] as Piece;
        p.kind = 'prism';
        p.color = -1;
      }
      if (boosters.beamNova) {
        if (next < free.length) (board.pieces[free[next++] as number] as Piece).kind = this.rng.int(2) === 0 ? 'beamH' : 'beamV';
        if (next < free.length) (board.pieces[free[next++] as number] as Piece).kind = 'nova';
      }
    }

    if (!keep && !hasValidMove(board)) {
      // Nothing on this board can ever form a move (see `ensurePlayable`).
      if (reshuffle(board, this.rng, this.colors, false) === null) {
        this.status = 'lost';
        this.resumable = false;
      }
    }
  }

  // ───────────────────────────── queries ─────────────────────────────

  snapshot(): Snapshot {
    const b = this.b;
    const cells: CellView[] = [];
    for (let i = 0; i < b.n; i++) {
      const p = b.pieces[i] as Piece | null;
      cells.push({
        exists: b.exists[i] === 1,
        piece: p === null ? null : { id: p.id, kind: p.kind, color: p.color, hp: p.hp, chained: p.chained },
        sand: b.sand[i] as 0 | 1 | 2,
        exit: b.exit[i] === 1,
        spawner: b.spawner[i] === 1,
      });
    }
    const snap: Snapshot = {
      cols: b.cols,
      rows: b.rows,
      cells,
      movesLeft: this.movesLeft,
      score: this.score,
      goals: this.goalProgress(),
      status: this.status,
      stars: this.stars(),
    };
    if (this.status === 'lost') snap.canContinue = this.resumable;
    return snap;
  }

  canSwap(a: Pos, b: Pos): boolean {
    if (this.status !== 'playing') return false;
    const i = this.index(a);
    const j = this.index(b);
    return i >= 0 && j >= 0 && this.adjacent(i, j) && isValidSwap(this.b, i, j);
  }

  validMoves(): Move[] {
    if (this.status !== 'playing') return [];
    const pairs = validSwaps(this.b);
    const out: Move[] = [];
    for (let k = 0; k < pairs.length; k += 2) {
      out.push({ a: this.pos(pairs[k] as number), b: this.pos(pairs[k + 1] as number) });
    }
    return out;
  }

  /**
   * The best available move: prism combos > special + special > makes a prism > makes a nova >
   * makes a beam > longest match. Ties go to the first move in reading order (deterministic).
   * `a` is the piece to drag, `b` where to drag it.
   */
  hint(): Move | null {
    if (this.status !== 'playing') return null;
    const { cols, n, pieces } = this.b;
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < n; i++) {
      const p = pieces[i] as Piece | null;
      if (p !== null && p.color >= 0) counts[p.color] = (counts[p.color] as number) + 1;
    }
    let best = -1;
    let from = -1;
    let to = -1;
    for (let i = 0; i < n; i++) {
      if (pieces[i] === null) continue;
      for (let dir = 0; dir < 2; dir++) {
        const j = dir === 0 ? i + 1 : i + cols;
        if (dir === 0 ? (i % cols) + 1 >= cols : j >= n) continue;
        const rating = this.rateSwap(i, j, counts);
        if (rating > best) {
          best = rating;
          from = this.hintForward ? i : j;
          to = this.hintForward ? j : i;
        }
      }
    }
    return best < 0 ? null : { a: this.pos(from), b: this.pos(to) };
  }

  /**
   * An independent deep copy of this game, RNG state included: the copy and the original give
   * identical results for identical inputs from here on, and neither affects the other. Used by
   * the level simulator's bots to look ahead. (Not part of `GameApi`.)
   */
  clone(): Game {
    const source = this as unknown as Record<string, unknown>;
    const copy = Object.create(Game.prototype) as Record<string, unknown>;
    for (const key of Object.keys(source)) {
      const value = source[key];
      // Arrays of numbers / flags are copied; everything else here is a primitive or is never
      // mutated after construction (level, goals, lamp settings), so it can be shared.
      if (value instanceof Uint8Array) copy[key] = value.slice();
      else if (Array.isArray(value)) copy[key] = value.slice();
      else copy[key] = value;
    }
    const b = this.b;
    const board: Board = {
      cols: b.cols,
      rows: b.rows,
      n: b.n,
      exists: b.exists,
      spawner: b.spawner,
      exit: b.exit,
      sand: b.sand.slice(),
      pieces: b.pieces.map((p) => (p === null ? null : clonePiece(p))),
    };
    copy.b = board;
    copy.rng = this.rng.clone();
    return copy as unknown as Game;
  }

  // ───────────────────────────── player actions ─────────────────────────────

  swap(a: Pos, b: Pos): TurnResult {
    if (this.status !== 'playing') return this.rejected();
    const i = this.index(a);
    const j = this.index(b);
    if (i < 0 || j < 0 || !this.adjacent(i, j)) return this.rejected();
    if (!isValidSwap(this.b, i, j)) {
      return this.rejected([{ type: 'swap', a: this.pos(i), b: this.pos(j), valid: false }]);
    }
    this.movesLeft--;
    this.moveCount++;
    this.vineCut = false;
    const t = this.newTurn();
    this.performSwap(i, j, t);
    this.finishTurn(t, true);
    return this.accepted(t.steps);
  }

  useBooster(booster: InLevelBooster, a?: Pos, b?: Pos): TurnResult {
    if (this.status !== 'playing') return this.rejected();
    const board = this.b;

    if (booster === 'hammer') {
      const i = this.index(a);
      if (i < 0) return this.rejected();
      const p = board.pieces[i] as Piece | null;
      // Nothing to hit: an empty cell without sand, or a lamp (which shrugs hits off) without sand.
      if ((p === null || p.kind === 'lamp') && board.sand[i] === 0) return this.rejected();
      const t = this.newTurn();
      t.steps.push({ type: 'booster', booster: 'hammer', at: this.pos(i) });
      const hits: Hit[] = [];
      const points = this.hitCell(i, 'booster', t, hits);
      this.score += points;
      t.steps.push({
        type: 'clear',
        cascade: t.cascade,
        hits,
        created: [],
        score: points,
        popups: points > 0 ? [{ at: this.pos(i), value: points }] : [],
      });
      this.settle(t);
      this.finishTurn(t, false);
      return this.accepted(t.steps);
    }

    if (booster === 'freeSwap') {
      const i = this.index(a);
      const j = this.index(b);
      if (i < 0 || j < 0 || !this.adjacent(i, j)) return this.rejected();
      const A = board.pieces[i] as Piece | null;
      const B = board.pieces[j] as Piece | null;
      if (A === null || B === null || isImmovable(A) || isImmovable(B)) return this.rejected();
      // Trading two identical pieces would change nothing: do not waste the booster.
      if (A.kind === B.kind && A.color === B.color && (A.kind === 'gem' || A.kind === 'lamp')) return this.rejected();
      const t = this.newTurn();
      t.steps.push({ type: 'booster', booster: 'freeSwap', at: this.pos(i) });
      this.performSwap(i, j, t);
      this.finishTurn(t, false);
      return this.accepted(t.steps);
    }

    if (booster === 'shuffle') {
      const outcome = reshuffle(board, this.rng, this.colors, true);
      if (outcome === null) return this.rejected();
      const t = this.newTurn();
      t.steps.push({ type: 'booster', booster: 'shuffle', at: null });
      this.pushShuffle(t.steps, outcome);
      this.finishTurn(t, false);
      return this.accepted(t.steps);
    }

    return this.rejected();
  }

  addMoves(n: number): TurnResult {
    // A board on which no move can ever exist cannot be resumed (`Snapshot.canContinue` is false).
    if (this.status !== 'lost' || !this.resumable || !Number.isInteger(n) || n < 1) return this.rejected();
    // The losing turn already made sure the board has a move, so there is nothing to shuffle here.
    this.movesLeft += n;
    this.status = 'playing';
    return this.accepted([{ type: 'status', status: 'playing' }]);
  }

  endBonus(): TurnResult {
    if (this.status !== 'won' || this.bonusDone) return this.rejected();
    this.bonusDone = true;
    this.lampSpawnsOff = true;
    const board = this.b;
    const t = this.newTurn();

    // Each remaining move turns a random plain gem into a beam.
    const left = this.movesLeft;
    if (left > 0) {
      const free: number[] = [];
      for (let i = 0; i < board.n; i++) {
        const p = board.pieces[i] as Piece | null;
        if (p !== null && isFreeGem(p)) free.push(i);
      }
      this.rng.shuffle(free);
      const changes: { at: Pos; piece: Piece }[] = [];
      for (let k = 0; k < left && k < free.length; k++) {
        const cell = free[k] as number;
        const p = board.pieces[cell] as Piece;
        p.kind = this.rng.int(2) === 0 ? 'beamH' : 'beamV';
        changes.push({ at: this.pos(cell), piece: clonePiece(p) });
      }
      const gain = left * SCORE.endBonusPerMove;
      this.movesLeft = 0;
      this.score += gain;
      t.steps.push({ type: 'transform', reason: 'endBonus', changes, score: gain });
    }

    // Then every special on the board fires, the board cascades, and so on until none is left.
    for (let round = 0; round < BONUS_ROUNDS; round++) {
      for (let i = 0; i < board.n; i++) {
        const p = board.pieces[i] as Piece | null;
        if (p === null || p.chained) continue;
        if (isBlastKind(p.kind) || p.kind === 'prism') {
          t.pending.push({ kind: p.kind as FxKind, at: i, color: p.color, consumed: [i] });
        }
      }
      if (t.pending.length === 0) break;
      this.settle(t);
    }
    return this.accepted(t.steps);
  }

  // ───────────────────────────── turn machinery ─────────────────────────────

  private newTurn(): Turn {
    return { steps: [], cascade: 1, pending: [], swap: null, fresh: new Set<number>() };
  }

  private accepted(steps: Step[]): TurnResult {
    return { accepted: true, steps, snapshot: this.snapshot() };
  }

  private rejected(steps: Step[] = []): TurnResult {
    return { accepted: false, steps, snapshot: this.snapshot() };
  }

  /**
   * Exchange the two pieces and resolve everything that follows (shared by `swap` and the
   * freeSwap booster). The piece from `i` ends on `j`, the destination cell: combos are centred there.
   */
  private performSwap(i: number, j: number, t: Turn): void {
    const board = this.b;
    const pieces = board.pieces;
    const A = pieces[i] as Piece;
    const B = pieces[j] as Piece;
    t.steps.push({ type: 'swap', a: this.pos(i), b: this.pos(j), valid: true });
    pieces[i] = B;
    pieces[j] = A;

    const aPrism = A.kind === 'prism';
    const bPrism = B.kind === 'prism';
    if (aPrism && bPrism) {
      t.pending.push({ kind: 'prismAll', at: j, color: -1, consumed: [j, i] });
    } else if ((aPrism || bPrism) && (aPrism ? B : A).kind !== 'lamp') {
      const prismCell = aPrism ? j : i;
      const other = aPrism ? B : A;
      const color = other.color;
      if (other.kind !== 'gem') {
        // prism + beam / nova: every plain gem of that colour becomes one, then they all fire
        // (the prism's rays hit them, which sets them off in the next wave).
        const changes: { at: Pos; piece: Piece }[] = [];
        for (let k = 0; k < board.n; k++) {
          const p = pieces[k] as Piece | null;
          if (p === null || !isFreeGem(p) || p.color !== color) continue;
          p.kind = other.kind === 'nova' ? 'nova' : this.rng.int(2) === 0 ? 'beamH' : 'beamV';
          changes.push({ at: this.pos(k), piece: clonePiece(p) });
        }
        t.steps.push({ type: 'transform', reason: 'prismCombo', changes, score: 0 });
      }
      t.pending.push({ kind: 'prism', at: j, color, consumed: [prismCell] });
    } else if (isBlastKind(A.kind) && isBlastKind(B.kind)) {
      const novas = (A.kind === 'nova' ? 1 : 0) + (B.kind === 'nova' ? 1 : 0);
      const kind: FxKind = novas === 2 ? 'bigNova' : novas === 1 ? 'bigCross' : 'cross';
      t.pending.push({ kind, at: j, color: A.color, consumed: [j, i] });
    } else {
      t.swap = { i, j, horizontal: Math.abs(i - j) === 1 };
    }
    this.settle(t);
  }

  /** Run waves, gravity and lamp collection until nothing changes any more. */
  private settle(t: Turn): void {
    for (let guard = 0; guard < SETTLE_GUARD; guard++) {
      let acted = false;
      if (t.pending.length === 0) {
        const groups = findGroups(this.b);
        if (groups.length > 0) {
          this.matchWave(groups, t);
          acted = true;
        }
      }
      while (t.pending.length > 0) {
        this.blastWave(t);
        acted = true;
      }
      t.swap = null;
      if (this.gravity(t)) acted = true;
      while (this.collectLamps(t)) {
        acted = true;
        this.gravity(t);
      }
      t.fresh.clear();
      if (!acted) return;
    }
  }

  /**
   * After the board settled (§2.9): goals, vine growth, dead-board check, status.
   * Levels with only score goals are decided when no further move is possible — normally when
   * the moves run out; every other level is won the moment all goals are done.
   */
  private finishTurn(t: Turn, isMove: boolean): void {
    const met = this.goalsMet();
    if (met && (!this.scoreOnly || this.movesLeft <= 0)) {
      this.status = 'won';
    } else {
      if (isMove && !this.vineCut) this.growVine(t.steps);
      // §2.8 — also when the moves just ran out: the board must be ready for addMoves().
      if (!this.ensurePlayable(t.steps)) {
        // No move can ever exist on this board again: the level ends here and cannot be resumed.
        this.status = met ? 'won' : 'lost';
        this.resumable = false;
      } else if (this.movesLeft <= 0) {
        this.status = 'lost';
      }
    }
    if (this.status !== 'playing') t.steps.push({ type: 'status', status: this.status });
  }

  // ───────────────────────────── waves ─────────────────────────────

  /**
   * One hit on one cell (§2.5). Mutates the board and the goal counters, appends the Hit record
   * (when anything was there to hit), queues a fired special, and returns the points earned.
   */
  private hitCell(i: number, cause: HitCause, t: Turn, hits: Hit[]): number {
    const b = this.b;
    if (b.exists[i] === 0) return 0;
    const p = b.pieces[i] as Piece | null;
    if (p === null) {
      if (b.sand[i] === 0) return 0;
      b.sand[i] = (b.sand[i] as number) - 1;
      this.sandCleared++;
      hits.push({ at: this.pos(i), cause, result: 'none', pieceId: null, kind: null, color: -1, sandLeft: b.sand[i] as 0 | 1 });
      return SCORE.sandLayer;
    }

    const hit: Hit = { at: this.pos(i), cause, result: 'none', pieceId: p.id, kind: p.kind, color: p.color };
    let points = 0;
    let reachesSand = true;
    if (p.kind === 'stone') {
      reachesSand = false;
      p.hp--;
      points += SCORE.stoneLayer;
      if (p.hp <= 0) {
        b.pieces[i] = null;
        hit.result = 'removed';
        this.stonesDestroyed++;
      } else {
        hit.result = 'damaged';
        hit.hpLeft = p.hp;
      }
    } else if (p.kind === 'vine') {
      reachesSand = false;
      b.pieces[i] = null;
      hit.result = 'removed';
      this.vinesDestroyed++;
      this.vineCut = true;
      points += SCORE.vine;
    } else if (p.kind === 'lamp') {
      // lamps are never destroyed
    } else if (p.chained) {
      p.chained = false;
      hit.result = 'unchained';
      this.chainsBroken++;
      points += SCORE.chain;
    } else if (t.fresh.has(p.id)) {
      // a special made in this very cascade shrugs blasts off
    } else {
      b.pieces[i] = null;
      points += SCORE.gem * cascadeMultiplier(t.cascade);
      if (p.color >= 0) this.collected[p.color] = (this.collected[p.color] as number) + 1;
      if (p.kind === 'gem') {
        hit.result = 'removed';
      } else {
        hit.result = 'activated';
        t.pending.push({ kind: p.kind as FxKind, at: i, color: p.color, consumed: null });
      }
    }
    if (reachesSand && b.sand[i] !== 0) {
      b.sand[i] = (b.sand[i] as number) - 1;
      this.sandCleared++;
      hit.sandLeft = b.sand[i] as 0 | 1;
      points += SCORE.sandLayer;
    }
    hits.push(hit);
    return points;
  }

  /** Clear every match group on the board (§2.3) and deal adjacent damage (§2.5). */
  private matchWave(groups: Group[], t: Turn): void {
    const b = this.b;
    const { cols, rows, pieces } = b;
    const hits: Hit[] = [];
    const popups: { at: Pos; value: number }[] = [];
    const plans: { at: number; kind: PieceKind; color: Color | -1; from: number[] }[] = [];
    const seen = this.seen;
    seen.fill(0);
    let total = 0;

    for (const g of groups) {
      // Decide the special first: it depends on which members are chained right now.
      const plan = this.planSpecial(g, t);
      let points = 0;
      const merged: number[] = [];
      for (const cell of g.cells) {
        if (pieces[cell] === null) continue;
        points += this.hitCell(cell, 'match', t, hits);
        if ((hits[hits.length - 1] as Hit).result === 'removed') merged.push(cell);
      }
      // Stones and vines next to the group take one hit each, at most once per wave.
      for (const cell of g.cells) {
        const c = cell % cols;
        const r = (cell - c) / cols;
        for (let dir = 0; dir < 4; dir++) {
          const nc = c + (dir === 0 ? 1 : dir === 1 ? -1 : 0);
          const nr = r + (dir === 2 ? 1 : dir === 3 ? -1 : 0);
          if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
          const k = nr * cols + nc;
          if (seen[k] === 1) continue;
          const q = pieces[k] as Piece | null;
          if (q === null || (q.kind !== 'stone' && q.kind !== 'vine')) continue;
          seen[k] = 1;
          points += this.hitCell(k, 'adjacent', t, hits);
        }
      }
      if (plan !== null) {
        points += specialBonus(plan.kind);
        plans.push({ at: plan.at, kind: plan.kind, color: plan.color, from: merged });
      }
      if (points > 0) popups.push({ at: this.pos(plan !== null ? plan.at : g.center), value: points });
      total += points;
    }

    // Created specials appear at the end of the wave, on the (now empty) cell chosen for them.
    const created: CreatedSpecial[] = [];
    for (const plan of plans) {
      const piece: Piece = { id: this.nextId++, kind: plan.kind, color: plan.color, hp: 1, chained: false };
      pieces[plan.at] = piece;
      t.fresh.add(piece.id);
      created.push({ piece: clonePiece(piece), at: this.pos(plan.at), from: plan.from.map((cell) => this.pos(cell)) });
    }
    this.score += total;
    t.steps.push({ type: 'clear', cascade: t.cascade, hits, created, score: total, popups });
  }

  /** Which special (if any) a match group makes, and where (§2.3). */
  private planSpecial(g: Group, t: Turn): { at: number; kind: 'beamH' | 'beamV' | 'nova' | 'prism'; color: Color | -1 } | null {
    const pieces = this.b.pieces;
    const make = g.maxRun >= 5 ? 'prism' : g.cross >= 0 ? 'nova' : g.maxRun === 4 ? 'beam' : null;
    if (make === null) return null;

    // On the swapped cell when it belongs to the group, else the crossing / the middle of the run.
    let at = -1;
    const sw = t.swap;
    if (sw !== null) {
      if (g.cells.indexOf(sw.j) >= 0) at = sw.j;
      else if (g.cells.indexOf(sw.i) >= 0) at = sw.i;
    }
    if (at < 0) {
      if (make === 'nova') at = g.cross;
      else if (make === 'prism') at = g.longest[(g.longest.length - 1) >> 1] as number;
      else at = g.longest[1] as number;
    }
    // A chained member stays on the board, so the special needs the nearest member that leaves.
    if ((pieces[at] as Piece).chained) {
      const cols = this.b.cols;
      const c0 = at % cols;
      const r0 = (at - c0) / cols;
      let best = -1;
      let bestDist = Infinity;
      for (const cell of g.cells) {
        if ((pieces[cell] as Piece).chained) continue;
        const c = cell % cols;
        const d = Math.abs(c - c0) + Math.abs((cell - c) / cols - r0);
        if (d < bestDist) {
          bestDist = d;
          best = cell;
        }
      }
      if (best < 0) return null;
      at = best;
    }

    if (make === 'prism') return { at, kind: 'prism', color: -1 };
    if (make === 'nova') return { at, kind: 'nova', color: g.color };
    // Beam direction: along the player's swap in the wave the swap caused, otherwise across the run.
    const horizontalBeam = sw !== null ? sw.horizontal : !g.longestHorizontal;
    return { at, kind: horizontalBeam ? 'beamH' : 'beamV', color: g.color };
  }

  /** Fire every pending special: one `activate` step, then one `clear` step with all their hits. */
  private blastWave(t: Turn): void {
    const fires = t.pending;
    t.pending = [];
    const hits: Hit[] = [];
    const popups: { at: Pos; value: number }[] = [];
    const fxs: Fx[] = [];
    const points: number[] = [];
    let total = 0;

    // Pieces used up by their own effect leave first, so no other effect of this wave can set
    // them off a second time. That counts as the effect's hit on those cells.
    for (const fire of fires) {
      let gained = 0;
      if (fire.consumed !== null) for (const cell of fire.consumed) gained += this.consume(cell, t, hits);
      points.push(gained);
    }

    for (let k = 0; k < fires.length; k++) {
      const fire = fires[k] as Fire;
      let color = fire.color;
      let targets: number[];
      if (fire.kind === 'prism') {
        // Effects apply in order, so a second prism of the same wave sees what the first one left.
        if (color < 0) color = this.mostCommonColor();
        targets = this.cellsOfColor(color, fire.at);
      } else {
        targets = this.targetsOf(fire.kind, fire.at);
      }
      let gained = points[k] as number;
      const used = fire.consumed;
      for (const cell of targets) {
        if (used !== null && used.indexOf(cell) >= 0) continue;
        gained += this.hitCell(cell, 'blast', t, hits);
      }
      fxs.push({ kind: fire.kind, at: this.pos(fire.at), color, targets: targets.map((cell) => this.pos(cell)) });
      if (gained > 0) popups.push({ at: this.pos(fire.at), value: gained });
      total += gained;
    }

    this.score += total;
    t.steps.push({ type: 'activate', fx: fxs });
    t.steps.push({ type: 'clear', cascade: t.cascade, hits, created: [], score: total, popups });
  }

  /** Remove a piece that is used up by its own effect (combo partner, end-bonus special). */
  private consume(i: number, t: Turn, hits: Hit[]): number {
    const b = this.b;
    const p = b.pieces[i] as Piece | null;
    if (p === null) return 0;
    b.pieces[i] = null;
    const hit: Hit = { at: this.pos(i), cause: 'blast', result: 'activated', pieceId: p.id, kind: p.kind, color: p.color };
    let points = SCORE.gem * cascadeMultiplier(t.cascade);
    if (p.color >= 0) this.collected[p.color] = (this.collected[p.color] as number) + 1;
    if (b.sand[i] !== 0) {
      b.sand[i] = (b.sand[i] as number) - 1;
      this.sandCleared++;
      hit.sandLeft = b.sand[i] as 0 | 1;
      points += SCORE.sandLayer;
    }
    hits.push(hit);
    return points;
  }

  /** Cells reached by a line / area effect centred on `at`, nearest first (holes excluded). */
  private targetsOf(kind: FxKind, at: number): number[] {
    const { cols, n, exists } = this.b;
    const c0 = at % cols;
    const r0 = (at - c0) / cols;
    const keyed: number[] = [];
    for (let i = 0; i < n; i++) {
      if (exists[i] === 0) continue;
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
        case 'prismAll':
          inside = true;
          break;
        default:
          inside = false;
      }
      if (inside) keyed.push((dc + dr) * KEY + i);
    }
    keyed.sort(ascending);
    for (let k = 0; k < keyed.length; k++) keyed[k] = (keyed[k] as number) % KEY;
    return keyed;
  }

  /** Cells holding a gem-like piece of `color`, nearest to `at` first. */
  private cellsOfColor(color: number, at: number): number[] {
    if (color < 0) return [];
    const { cols, n, pieces } = this.b;
    const c0 = at % cols;
    const r0 = (at - c0) / cols;
    const keyed: number[] = [];
    for (let i = 0; i < n; i++) {
      const p = pieces[i] as Piece | null;
      if (p === null || p.color !== color) continue;
      const c = i % cols;
      keyed.push((Math.abs(c - c0) + Math.abs((i - c) / cols - r0)) * KEY + i);
    }
    keyed.sort(ascending);
    for (let k = 0; k < keyed.length; k++) keyed[k] = (keyed[k] as number) % KEY;
    return keyed;
  }

  /** The gem colour with the most pieces on the board right now (lowest colour wins ties); -1 if none. */
  private mostCommonColor(): Color | -1 {
    const { n, pieces } = this.b;
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < n; i++) {
      const p = pieces[i] as Piece | null;
      if (p !== null && p.color >= 0) counts[p.color] = (counts[p.color] as number) + 1;
    }
    let best = -1;
    let bestCount = 0;
    for (let color = 0; color < counts.length; color++) {
      if ((counts[color] as number) > bestCount) {
        bestCount = counts[color] as number;
        best = color;
      }
    }
    return best as Color | -1;
  }

  // ───────────────────────────── gravity, lamps, vines ─────────────────────────────

  /**
   * Gravity + refill (§2.6). Emits one `fall` step when anything moved and returns whether it did.
   *
   * Phase A repeats "every empty cell pulls the movable piece straight above it; an empty
   * spawner cell gets a new gem" until nothing moves. Phase B then lets ONE piece slide
   * diagonally into the top-most empty cell that has a movable piece on its upper-left or
   * upper-right, and phase A runs again. The loop ends when neither phase can move anything —
   * every empty cell left is unreachable (nothing movable above it or diagonally above it).
   */
  private gravity(t: Turn): boolean {
    const b = this.b;
    const { cols, rows, n, pieces, exists, spawner } = b;
    const firstNewId = this.nextId;
    let origin: Map<Piece, number> | null = null;
    let spawned: { piece: Piece; col: number; order: number }[] | null = null;
    const spawnCount = this.spawnCount;
    spawnCount.fill(0);

    for (;;) {
      let changed = true;
      while (changed) {
        changed = false;
        for (let r = rows - 1; r >= 0; r--) {
          const base = r * cols;
          for (let c = 0; c < cols; c++) {
            const i = base + c;
            if (exists[i] === 0 || pieces[i] !== null) continue;
            if (spawner[i] === 1) {
              const piece: Piece = { id: this.nextId++, kind: 'gem', color: this.rng.int(this.colors) as Color, hp: 1, chained: false };
              pieces[i] = piece;
              spawnCount[c] = (spawnCount[c] as number) + 1;
              if (spawned === null) spawned = [];
              spawned.push({ piece, col: c, order: spawnCount[c] as number });
              changed = true;
            } else if (r > 0 && exists[i - cols] === 1) {
              const p = pieces[i - cols] as Piece | null;
              if (p !== null && !isImmovable(p)) {
                if (p.id < firstNewId) {
                  if (origin === null) origin = new Map<Piece, number>();
                  if (!origin.has(p)) origin.set(p, i - cols);
                }
                pieces[i] = p;
                pieces[i - cols] = null;
                changed = true;
              }
            }
          }
        }
      }

      let slid = false;
      for (let i = cols; i < n && !slid; i++) {
        if (exists[i] === 0 || pieces[i] !== null) continue;
        const c = i % cols;
        const left = c > 0 ? i - cols - 1 : -1;
        const right = c < cols - 1 ? i - cols + 1 : -1;
        const lp = left >= 0 ? (pieces[left] as Piece | null) : null;
        const rp = right >= 0 ? (pieces[right] as Piece | null) : null;
        const leftOk = lp !== null && !isImmovable(lp);
        const rightOk = rp !== null && !isImmovable(rp);
        if (!leftOk && !rightOk) continue;
        const src = leftOk && rightOk ? (this.rng.int(2) === 0 ? left : right) : leftOk ? left : right;
        const p = pieces[src] as Piece;
        if (p.id < firstNewId) {
          if (origin === null) origin = new Map<Piece, number>();
          if (!origin.has(p)) origin.set(p, src);
        }
        pieces[i] = p;
        pieces[src] = null;
        slid = true;
      }
      if (!slid) break;
    }

    if (origin === null && spawned === null) return false;

    // Final cells, lowest rows first.
    const moves: { id: number; from: Pos; to: Pos }[] = [];
    const landed = new Map<Piece, number>();
    for (let i = n - 1; i >= 0; i--) {
      const p = pieces[i] as Piece | null;
      if (p === null) continue;
      if (p.id >= firstNewId) landed.set(p, i);
      else if (origin !== null) {
        const from = origin.get(p);
        if (from !== undefined) moves.push({ id: p.id, from: this.pos(from), to: this.pos(i) });
      }
    }
    const spawns: { piece: Piece; from: Pos; to: Pos }[] = [];
    if (spawned !== null) {
      if (t.cascade >= CALM_CASCADE) {
        // Safety valve: deep into a cascade the refill stops feeding it (see CALM_CASCADE).
        for (const s of spawned) s.piece.color = -1;
        landed.forEach((cell, piece) => {
          piece.color = colourWithoutMatch(b, cell, this.colors, this.rng);
        });
      }
      this.maybeSpawnLamp(spawned);
      for (const s of spawned) {
        // `from.r` = -k: the piece starts k cells above the spawner cell of column `from.c`.
        spawns.push({ piece: clonePiece(s.piece), from: { c: s.col, r: -s.order }, to: this.pos(landed.get(s.piece) as number) });
      }
    }
    t.steps.push({ type: 'fall', moves, spawns });
    t.cascade++;
    return true;
  }

  /** Lamp levels (§2.6): one of the gems that just dropped in may be a lamp instead. */
  private maybeSpawnLamp(spawned: readonly { piece: Piece; col: number; order: number }[]): void {
    const cfg = this.lampCfg;
    if (cfg === null || this.lampSpawnsOff) return;
    if (this.lampsExisted >= cfg.total) return;
    if (this.moveCount - this.lastLampMove < cfg.everyMoves) return;
    let onBoard = 0;
    for (const p of this.b.pieces) if (p !== null && p.kind === 'lamp') onBoard++;
    if (onBoard >= cfg.maxOnBoard) return;
    // Candidates: the last piece to enter through each lamp-friendly column (it starts at the top).
    const last = new Map<number, Piece>();
    for (const s of spawned) if (this.lampCols[s.col]) last.set(s.col, s.piece);
    if (last.size === 0) return;
    const columns: number[] = [];
    last.forEach((_piece, col) => columns.push(col));
    columns.sort(ascending);
    const piece = last.get(this.rng.pick(columns)) as Piece;
    piece.kind = 'lamp';
    piece.color = -1;
    this.lampsExisted++;
    this.lastLampMove = this.moveCount;
  }

  /** Lamps resting on exit cells leave the board (§2.6). */
  private collectLamps(t: Turn): boolean {
    const b = this.b;
    let lamps: { id: number; at: Pos }[] | null = null;
    for (let i = 0; i < b.n; i++) {
      if (b.exit[i] === 0) continue;
      const p = b.pieces[i] as Piece | null;
      if (p === null || p.kind !== 'lamp') continue;
      b.pieces[i] = null;
      if (lamps === null) lamps = [];
      lamps.push({ id: p.id, at: this.pos(i) });
    }
    if (lamps === null) return false;
    const gain = lamps.length * SCORE.lamp;
    this.lampsDelivered += lamps.length;
    this.score += gain;
    t.steps.push({ type: 'collect', lamps, score: gain });
    return true;
  }

  /** §2.7 — a random vine turns one orthogonally adjacent plain gem into a new vine. */
  private growVine(steps: Step[]): void {
    const { cols, rows, n, pieces } = this.b;
    const options: number[][] = [];
    for (let i = 0; i < n; i++) {
      const p = pieces[i] as Piece | null;
      if (p === null || p.kind !== 'vine') continue;
      const c = i % cols;
      const r = (i - c) / cols;
      const targets: number[] = [i];
      for (let dir = 0; dir < 4; dir++) {
        const nc = c + (dir === 0 ? 1 : dir === 1 ? -1 : 0);
        const nr = r + (dir === 2 ? 1 : dir === 3 ? -1 : 0);
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
        const q = pieces[nr * cols + nc] as Piece | null;
        if (q !== null && isFreeGem(q)) targets.push(nr * cols + nc);
      }
      if (targets.length > 1) options.push(targets);
    }
    if (options.length === 0) return;
    const choice = this.rng.pick(options);
    const from = choice[0] as number;
    const at = choice[1 + this.rng.int(choice.length - 1)] as number;
    const replaced = pieces[at] as Piece;
    const vine: Piece = { id: this.nextId++, kind: 'vine', color: -1, hp: 1, chained: false };
    pieces[at] = vine;
    steps.push({ type: 'grow', from: this.pos(from), at: this.pos(at), piece: clonePiece(vine), replacedId: replaced.id });
  }

  // ───────────────────────────── shuffles ─────────────────────────────

  /**
   * §2.8 — make sure a move exists, shuffling if needed. Returns false when no arrangement can
   * ever have a move (e.g. vines left fewer than three gems): the board is then left untouched
   * and the caller ends the level as 'lost'.
   */
  private ensurePlayable(steps: Step[]): boolean {
    if (hasValidMove(this.b)) return true;
    const outcome = reshuffle(this.b, this.rng, this.colors, false);
    if (outcome === null) return false;
    this.pushShuffle(steps, outcome);
    return true;
  }

  private pushShuffle(steps: Step[], outcome: { moved: { id: number; from: number; to: number }[]; recolored: number[] }): void {
    steps.push({
      type: 'shuffle',
      moves: outcome.moved.map((m) => ({ id: m.id, from: this.pos(m.from), to: this.pos(m.to) })),
    });
    if (outcome.recolored.length > 0) {
      // No legal rearrangement existed: the plain gems were recoloured in place instead.
      steps.push({
        type: 'transform',
        reason: 'recolor',
        changes: outcome.recolored.map((cell) => ({ at: this.pos(cell), piece: clonePiece(this.b.pieces[cell] as Piece) })),
        score: 0,
      });
    }
  }

  // ───────────────────────────── goals ─────────────────────────────

  private goalProgress(): GoalProgress[] {
    const out: GoalProgress[] = [];
    for (const goal of this.goals) {
      let current = 0;
      let target = 0;
      switch (goal.kind) {
        case 'score':
          target = goal.target;
          current = this.score;
          break;
        case 'color':
          target = goal.target;
          current = this.collected[goal.color] ?? 0;
          break;
        case 'sand':
          target = this.sandTotal;
          current = this.sandCleared;
          break;
        case 'lamp':
          target = goal.target;
          current = this.lampsDelivered;
          break;
        case 'stone':
          target = this.stoneTotal;
          current = this.stonesDestroyed;
          break;
        case 'vine':
          target = this.vineTotal;
          current = this.vinesDestroyed;
          break;
        case 'chain':
          target = this.chainTotal;
          current = this.chainsBroken;
          break;
      }
      if (current > target) current = target;
      out.push({ goal: { ...goal }, current, target, done: current >= target });
    }
    return out;
  }

  private goalsMet(): boolean {
    for (const g of this.goalProgress()) if (!g.done) return false;
    return true;
  }

  private stars(): 0 | 1 | 2 | 3 {
    const stars = starsFor(this.score, this.starLimits);
    return this.status === 'won' && stars < 1 ? 1 : stars;
  }

  // ───────────────────────────── hints ─────────────────────────────

  /**
   * Rating of the swap i↔j (higher is better), or -1 when it is not a valid move. Sets
   * `hintForward`: true when the piece on `i` is the one to drag onto `j`.
   */
  private rateSwap(i: number, j: number, counts: readonly number[]): number {
    const b = this.b;
    if (!isValidSwap(b, i, j)) return -1;
    const pieces = b.pieces;
    const A = pieces[i] as Piece;
    const B = pieces[j] as Piece;
    this.hintForward = true;
    const lamp = A.kind === 'lamp' || B.kind === 'lamp';
    if (!lamp) {
      const aPrism = A.kind === 'prism';
      const bPrism = B.kind === 'prism';
      if (aPrism && bPrism) return 9e6;
      if (aPrism || bPrism) {
        const other = aPrism ? B : A;
        const tier = other.kind === 'nova' ? 8e6 : other.kind === 'gem' ? 6e6 : 7e6;
        return tier + (counts[other.color] as number);
      }
      if (A.kind !== 'gem' && B.kind !== 'gem') {
        const novas = (A.kind === 'nova' ? 1 : 0) + (B.kind === 'nova' ? 1 : 0);
        return novas === 2 ? 5e6 : novas === 1 ? 4.5e6 : 4e6;
      }
    }
    pieces[i] = B;
    pieces[j] = A;
    const ra = A.color >= 0 ? this.rateAt(j, A.color) : 0;
    const rb = B.color >= 0 ? this.rateAt(i, B.color) : 0;
    pieces[i] = A;
    pieces[j] = B;
    this.hintForward = ra >= rb;
    const tier = Math.max(Math.floor(ra / 10000), Math.floor(rb / 10000));
    const size = (Math.floor(ra / 100) % 100) + (Math.floor(rb / 100) % 100);
    const specials = (ra % 100) + (rb % 100);
    return tier * 1e6 + size * 1e3 + specials * 100;
  }

  /**
   * What the piece on `idx` (colour `color`) would match there:
   * tier * 10000 + cells * 100 + specials set off, or 0 for no match.
   * tier: 3 = makes a prism, 2 = nova, 1 = beam, 0 = plain match.
   */
  private rateAt(idx: number, color: number): number {
    const { cols, n, pieces } = this.b;
    const c = idx % cols;
    let h = 1;
    let v = 1;
    let hSpecials = 0;
    let vSpecials = 0;
    for (let x = c - 1, k = idx - 1; x >= 0; x--, k--) {
      const p = pieces[k] as Piece | null;
      if (p === null || p.color !== color) break;
      h++;
      if (p.kind !== 'gem' && !p.chained) hSpecials++;
    }
    for (let x = c + 1, k = idx + 1; x < cols; x++, k++) {
      const p = pieces[k] as Piece | null;
      if (p === null || p.color !== color) break;
      h++;
      if (p.kind !== 'gem' && !p.chained) hSpecials++;
    }
    for (let k = idx - cols; k >= 0; k -= cols) {
      const p = pieces[k] as Piece | null;
      if (p === null || p.color !== color) break;
      v++;
      if (p.kind !== 'gem' && !p.chained) vSpecials++;
    }
    for (let k = idx + cols; k < n; k += cols) {
      const p = pieces[k] as Piece | null;
      if (p === null || p.color !== color) break;
      v++;
      if (p.kind !== 'gem' && !p.chained) vSpecials++;
    }
    const hOk = h >= 3;
    const vOk = v >= 3;
    if (!hOk && !vOk) return 0;
    const tier = (hOk && h >= 5) || (vOk && v >= 5) ? 3 : hOk && vOk ? 2 : (hOk && h === 4) || (vOk && v === 4) ? 1 : 0;
    const size = (hOk ? h : 0) + (vOk ? v : 0) - (hOk && vOk ? 1 : 0);
    const own = (pieces[idx] as Piece).kind !== 'gem' ? 1 : 0;
    const specials = (hOk ? hSpecials : 0) + (vOk ? vSpecials : 0) + own;
    return tier * 10000 + size * 100 + specials;
  }

  // ───────────────────────────── small helpers ─────────────────────────────

  private pos(i: number): Pos {
    const c = i % this.b.cols;
    return { c, r: (i - c) / this.b.cols };
  }

  /** Index of an existing cell, or -1 for anything else (holes, out of range, garbage). */
  private index(p: Pos | undefined | null): number {
    if (p === undefined || p === null || !Number.isInteger(p.c) || !Number.isInteger(p.r)) return -1;
    const { cols, rows, exists } = this.b;
    if (p.c < 0 || p.c >= cols || p.r < 0 || p.r >= rows) return -1;
    const i = p.r * cols + p.c;
    return exists[i] === 1 ? i : -1;
  }

  private adjacent(i: number, j: number): boolean {
    const cols = this.b.cols;
    const d = Math.abs(i - j);
    if (d === cols) return true;
    return d === 1 && Math.floor(i / cols) === Math.floor(j / cols);
  }
}

function clonePiece(p: Piece): Piece {
  return { id: p.id, kind: p.kind, color: p.color, hp: p.hp, chained: p.chained };
}

function ascending(a: number, b: number): number {
  return a - b;
}
