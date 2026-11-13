/**
 * Engine contract — the single source of truth shared by the engine, the board renderer,
 * the level designer/simulator and the tests. The engine is PURE logic: no DOM, no timers,
 * no Math.random (seeded RNG only), runnable under Node.
 *
 * Rules are specified in docs/DESIGN.md §2. Names here are the game's own vocabulary:
 *   beam  = line-clearing gem (made by matching 4 in a line)
 *   nova  = area-blast gem   (made by an L / T shaped match)
 *   prism = colour wildcard  (made by matching 5+ in a line)
 *   sand  = floor layer covering a cell (1–2 layers), removed when the cell is cleared/hit
 *   stone = immovable blocker piece with 1–3 layers, damaged by adjacent matches and blasts
 *   chain = lock on a gem: it cannot move or fall until the chain is broken
 *   vine  = immovable blocker that spreads when the player fails to cut it
 *   lamp  = drop item: must be brought down to an exit cell at the bottom of its column
 */

export type Color = 0 | 1 | 2 | 3 | 4 | 5;
export const COLOR_COUNT = 6;

export type PieceKind = 'gem' | 'beamH' | 'beamV' | 'nova' | 'prism' | 'lamp' | 'stone' | 'vine';

export interface Pos {
  /** column, 0 = left */
  c: number;
  /** row, 0 = top. Negative rows are used only for spawn origins above the board. */
  r: number;
}

export interface Piece {
  /** Unique within one Game, stable for the piece's lifetime (a transform keeps the id). */
  id: number;
  kind: PieceKind;
  /** -1 for prism, lamp, stone and vine. */
  color: Color | -1;
  /** stone: layers left (1..3). Every other kind: 1. */
  hp: number;
  /** Only gem / beamH / beamV / nova can be chained. A chained piece cannot be swapped and does not fall. */
  chained: boolean;
}

export interface CellView {
  /** false = hole in the board (never holds anything, pieces do not pass through it). */
  exists: boolean;
  piece: Piece | null;
  sand: 0 | 1 | 2;
  /** Lamps resting here after the board settles are collected. */
  exit: boolean;
  /** New pieces enter the board through this cell. */
  spawner: boolean;
}

// ───────────────────────────── Levels ─────────────────────────────

export type Goal =
  | { kind: 'score'; target: number }
  /** Collect `target` gems of one colour (any way of clearing them counts, including specials of that colour). */
  | { kind: 'color'; color: Color; target: number }
  /** Clear every sand layer on the board. */
  | { kind: 'sand' }
  /** Deliver `target` lamps to exit cells. */
  | { kind: 'lamp'; target: number }
  /** Destroy every stone / every vine / every chain that the level starts with. */
  | { kind: 'stone' }
  | { kind: 'vine' }
  | { kind: 'chain' };

export type GoalKind = Goal['kind'];

export interface LevelDef {
  /** 1-based level number. */
  id: number;
  cols: number;
  rows: number;
  /** How many gem colours spawn (3..6). Colours 0..colors-1 are used. */
  colors: number;
  moves: number;
  /**
   * Piece layer, `rows` strings of `cols` characters:
   *   '.' random gem      '_' hole (cell does not exist)
   *   '1' '2' '3' stone with that many layers
   *   'c' chained random gem      'v' vine      'L' lamp
   *   'H' beamH  'V' beamV  'N' nova (random colour)   'P' prism
   *   'a'..'f' plain gem of fixed colour 0..5 (tutorial boards)
   *   'A'..'F' the same fixed colours 0..5. NOTE: 'c' always means the chained gem above, so
   *            fixed colour 2 must be written 'C'.
   */
  pieces: string[];
  /** Floor layer, same shape: '0' none, '1' / '2' sand layers. Omitted = no sand. */
  floor?: string[];
  goals: Goal[];
  /** Score needed for 1, 2 and 3 stars (ascending). */
  stars: [number, number, number];
  /**
   * Lamp levels: besides lamps placed in `pieces`, more lamps drop in from random spawners
   * until `total` lamps have existed in the level. A new lamp is spawned when fewer than
   * `maxOnBoard` are on the board and at least `everyMoves` moves passed since the last one.
   */
  lamps?: { total: number; maxOnBoard: number; everyMoves: number };
  /** Marks a deliberately hard level (the map shows a different node). */
  hard?: boolean;
  /** Optional tutorial id shown before the level starts (see i18n keys `tut.<id>.*`). */
  tutorial?: string;
}

export interface GoalProgress {
  goal: Goal;
  current: number;
  target: number;
  done: boolean;
}

/** Boosters the player can bring into a level. */
export interface StartBoosters {
  /** +3 moves */
  extraMoves?: boolean;
  /** start with one prism on the board */
  prism?: boolean;
  /** start with one beam and one nova on the board */
  beamNova?: boolean;
}

export type InLevelBooster = 'hammer' | 'freeSwap' | 'shuffle';

export type GameStatus =
  /** waiting for the player's move */
  | 'playing'
  /** all goals met; call endBonus() (optional) to spend the remaining moves */
  | 'won'
  /** out of moves with goals unmet; addMoves() resumes play */
  | 'lost';

// ───────────────────────────── Turn script ─────────────────────────────
// Every state-changing call returns the ordered list of Steps the renderer plays back,
// plus the settled snapshot. Steps are a faithful transcript: applying them in order to the
// previous snapshot yields the new snapshot, so the renderer never has to guess.

export type HitCause = 'match' | 'blast' | 'adjacent' | 'booster';

export type HitResult =
  /** the piece left the board */
  | 'removed'
  /** stone lost a layer but still stands (see hpLeft) */
  | 'damaged'
  /** the chain broke, the piece stays */
  | 'unchained'
  /** a special piece fired (it is removed; its effect is the next 'activate' step) */
  | 'activated'
  /** only the floor was affected (sand) or nothing happened (e.g. a lamp shrugging off a blast) */
  | 'none';

export interface Hit {
  at: Pos;
  cause: HitCause;
  result: HitResult;
  /** The piece that was in the cell when it was hit (null if the cell was empty). */
  pieceId: number | null;
  kind: PieceKind | null;
  color: Color | -1;
  /** For 'damaged': layers left. */
  hpLeft?: number;
  /** Present when a sand layer was removed by this hit: layers left afterwards (0 or 1). */
  sandLeft?: 0 | 1;
}

export type FxKind =
  /** full row through `at` */
  | 'beamH'
  /** full column through `at` */
  | 'beamV'
  /** diamond blast, radius 2, around `at` */
  | 'nova'
  /** beam + beam: row and column through `at` */
  | 'cross'
  /** beam + nova: three rows and three columns centred on `at` */
  | 'bigCross'
  /** nova + nova: square blast radius 2 (5×5) plus the diamond tips at distance 3 */
  | 'bigNova'
  /** prism: rays from `at` to every cell in `targets` */
  | 'prism'
  /** prism + prism: the whole board */
  | 'prismAll';

export interface Fx {
  kind: FxKind;
  at: Pos;
  /** Colour of the firing piece / of the colour being cleared by a prism; -1 if none. */
  color: Color | -1;
  /** Every cell this effect reaches (already clipped to the board). */
  targets: Pos[];
}

export interface CreatedSpecial {
  piece: Piece;
  at: Pos;
  /** Cells of the match that merged into it (for the converge animation). */
  from: Pos[];
}

export type Step =
  /** The player's swap. valid=false: animate there-and-back, nothing else follows. */
  | { type: 'swap'; a: Pos; b: Pos; valid: boolean }
  /** Special pieces firing. Purely visual; the cells affected are in the 'clear' step that follows. */
  | { type: 'activate'; fx: Fx[] }
  /**
   * One wave of destruction. `cascade` starts at 1 for the wave caused directly by the player's
   * move and grows by one after every 'fall'. `created` specials appear at the end of the wave.
   */
  | {
      type: 'clear';
      cascade: number;
      hits: Hit[];
      created: CreatedSpecial[];
      /** Score gained by this wave (already added to the running score). */
      score: number;
      /** Floating score labels to show. */
      popups: { at: Pos; value: number }[];
    }
  /** Gravity + refill. Every piece that changed cell is listed exactly once with its final cell. */
  | {
      type: 'fall';
      moves: { id: number; from: Pos; to: Pos }[];
      /** New pieces. `from.r` is negative: the piece starts that many cells above its column's spawner. */
      spawns: { piece: Piece; from: Pos; to: Pos }[];
    }
  /** Lamps that reached an exit and leave the board. */
  | { type: 'collect'; lamps: { id: number; at: Pos }[]; score: number }
  /**
   * Pieces changing in place; each keeps its id and is replaced by `piece`.
   *   'prismCombo' prism + beam/nova: gems of one colour become beams / novas
   *   'endBonus'   each remaining move turns a gem into a beam (`score` = total end bonus)
   *   'recolor'    rare: follows a 'shuffle' step when no rearrangement of the gems can give a
   *                valid move — the plain gems get new colours instead (`score` = 0)
   */
  | {
      type: 'transform';
      reason: 'prismCombo' | 'endBonus' | 'recolor';
      changes: { at: Pos; piece: Piece }[];
      score: number;
    }
  /** A vine spreading from `from` into `at`, replacing the piece `replacedId`. */
  | { type: 'grow'; from: Pos; at: Pos; piece: Piece; replacedId: number | null }
  /** No moves were available: movable pieces are rearranged. Pieces keep their ids. */
  | { type: 'shuffle'; moves: { id: number; from: Pos; to: Pos }[] }
  /** A booster hitting the board (hammer). Followed by clear / fall steps. */
  | { type: 'booster'; booster: InLevelBooster; at: Pos | null }
  /** Emitted once, as the last step, when the status changes. */
  | { type: 'status'; status: GameStatus };

export type StepType = Step['type'];

export interface Snapshot {
  cols: number;
  rows: number;
  /** Row-major: index = r * cols + c. */
  cells: CellView[];
  movesLeft: number;
  score: number;
  goals: GoalProgress[];
  status: GameStatus;
  /** 0..3 for the current score against the level's thresholds. */
  stars: 0 | 1 | 2 | 3;
}

export interface TurnResult {
  /** false = nothing happened (illegal request); steps may still contain a rejected 'swap'. */
  accepted: boolean;
  steps: Step[];
  /** State after the turn (deep copy, safe to keep). */
  snapshot: Snapshot;
}

export interface Move {
  a: Pos;
  b: Pos;
}

export interface GameOptions {
  /** Seed for the deterministic RNG. Same level + seed + inputs ⇒ same game. */
  seed: number;
  boosters?: StartBoosters;
}

/** Public surface of the engine (implemented by `Game` in ./game.ts). */
export interface GameApi {
  readonly level: LevelDef;
  /** Deep copy of the current state. */
  snapshot(): Snapshot;
  /** True if swapping a and b would be accepted right now. */
  canSwap(a: Pos, b: Pos): boolean;
  /** The player's move. Costs one move when valid. */
  swap(a: Pos, b: Pos): TurnResult;
  /** hammer needs `a`; freeSwap needs `a` and `b` (adjacent); shuffle needs neither. Never costs a move. */
  useBooster(booster: InLevelBooster, a?: Pos, b?: Pos): TurnResult;
  /** A good available move, or null if none (the engine shuffles before that can be observed). */
  hint(): Move | null;
  /** All currently valid moves (used by the simulator bot). */
  validMoves(): Move[];
  /** After 'lost': grant extra moves and resume. */
  addMoves(n: number): TurnResult;
  /** After 'won': turn each remaining move into a special, fire them all, and settle. */
  endBonus(): TurnResult;
}
