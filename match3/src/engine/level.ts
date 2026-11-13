/**
 * Level definitions: parsing (`parseLevel`, used by the Game) and validation (`validateLevel`,
 * used by the level tools and tests). The text format is documented on `LevelDef` in types.ts.
 */
import type { Color, Goal, LevelDef, Piece } from './types.ts';
import { createRng } from './rng.ts';
import {
  RANDOM_COLOR,
  fillRandom,
  hasAnyMatch,
  hasMovePattern,
  hasValidMove,
  type Board,
  type PieceSpec,
} from './board.ts';

export const MAX_BOARD_SIZE = 9;
export const MIN_COLORS = 3;
export const MAX_COLORS = 6;

/** A level turned into per-cell data (row-major, index = r * cols + c). */
export interface ParsedLevel {
  cols: number;
  rows: number;
  n: number;
  exists: boolean[];
  /** Starting piece per cell; null on holes. */
  specs: (PieceSpec | null)[];
  /** Sand layers per cell (0..2). */
  sand: number[];
  /** Top-most existing cell of each column. */
  spawner: boolean[];
  /** Bottom-most existing cell of each column. */
  exit: boolean[];
}

const FIXED_LOWER = 'abcdef';
const FIXED_UPPER = 'ABCDEF';

/**
 * What one character of `LevelDef.pieces` means: a piece, a 'hole', or null for an illegal
 * character. Note that 'c' is the chained random gem — fixed colour 2 is written 'C'
 * ('A'..'F' are aliases of 'a'..'f' that do not clash with it).
 */
export function pieceSpecFor(ch: string): PieceSpec | 'hole' | null {
  switch (ch) {
    case '.':
      return { kind: 'gem', color: RANDOM_COLOR, hp: 1, chained: false };
    case '_':
      return 'hole';
    case '1':
    case '2':
    case '3':
      return { kind: 'stone', color: -1, hp: Number(ch), chained: false };
    case 'c':
      return { kind: 'gem', color: RANDOM_COLOR, hp: 1, chained: true };
    case 'v':
      return { kind: 'vine', color: -1, hp: 1, chained: false };
    case 'L':
      return { kind: 'lamp', color: -1, hp: 1, chained: false };
    case 'H':
      return { kind: 'beamH', color: RANDOM_COLOR, hp: 1, chained: false };
    case 'V':
      return { kind: 'beamV', color: RANDOM_COLOR, hp: 1, chained: false };
    case 'N':
      return { kind: 'nova', color: RANDOM_COLOR, hp: 1, chained: false };
    case 'P':
      return { kind: 'prism', color: -1, hp: 1, chained: false };
    default: {
      if (ch.length !== 1) return null;
      let color = FIXED_LOWER.indexOf(ch);
      if (color < 0) color = FIXED_UPPER.indexOf(ch);
      if (color < 0) return null;
      return { kind: 'gem', color, hp: 1, chained: false };
    }
  }
}

function dimension(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 0;
}

/**
 * Turn a level into cell data. Tolerant on purpose (the Game must never crash on odd data):
 * missing cells become holes and unknown characters become random gems. Use `validateLevel`
 * to find such mistakes.
 */
export function parseLevel(def: LevelDef): ParsedLevel {
  const cols = dimension(def.cols);
  const rows = dimension(def.rows);
  const n = cols * rows;
  const exists: boolean[] = [];
  const specs: (PieceSpec | null)[] = [];
  const sand: number[] = [];
  const pieceRows = Array.isArray(def.pieces) ? def.pieces : [];
  const floorRows = Array.isArray(def.floor) ? def.floor : [];
  for (let r = 0; r < rows; r++) {
    const pieceRow = typeof pieceRows[r] === 'string' ? (pieceRows[r] as string) : '';
    const floorRow = typeof floorRows[r] === 'string' ? (floorRows[r] as string) : '';
    for (let c = 0; c < cols; c++) {
      const ch = c < pieceRow.length ? pieceRow.charAt(c) : '_';
      const spec = pieceSpecFor(ch) ?? pieceSpecFor('.');
      if (spec === 'hole' || spec === null) {
        exists.push(false);
        specs.push(null);
        sand.push(0);
        continue;
      }
      exists.push(true);
      specs.push(spec);
      const f = floorRow.charAt(c);
      sand.push(f === '1' ? 1 : f === '2' ? 2 : 0);
    }
  }
  const spawner: boolean[] = new Array<boolean>(n).fill(false);
  const exit: boolean[] = new Array<boolean>(n).fill(false);
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (exists[r * cols + c]) {
        spawner[r * cols + c] = true;
        break;
      }
    }
    for (let r = rows - 1; r >= 0; r--) {
      if (exists[r * cols + c]) {
        exit[r * cols + c] = true;
        break;
      }
    }
  }
  return { cols, rows, n, exists, specs, sand, spawner, exit };
}

/** Build live board storage from parsed cells. Returns the cells whose colour is still to be chosen. */
export function createBoard(parsed: ParsedLevel, newId: () => number): { board: Board; randomCells: number[] } {
  const { cols, rows, n } = parsed;
  const board: Board = {
    cols,
    rows,
    n,
    exists: new Uint8Array(n),
    spawner: new Uint8Array(n),
    exit: new Uint8Array(n),
    sand: new Uint8Array(n),
    pieces: new Array<Piece | null>(n).fill(null),
  };
  const randomCells: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!parsed.exists[i]) continue;
    board.exists[i] = 1;
    board.spawner[i] = parsed.spawner[i] ? 1 : 0;
    board.exit[i] = parsed.exit[i] ? 1 : 0;
    board.sand[i] = parsed.sand[i] as number;
    const spec = parsed.specs[i];
    if (spec === null || spec === undefined) continue;
    const random = spec.color === RANDOM_COLOR;
    board.pieces[i] = {
      id: newId(),
      kind: spec.kind,
      color: (random ? -1 : spec.color) as Color | -1,
      hp: spec.hp,
      chained: spec.chained,
    };
    if (random) randomCells.push(i);
  }
  return { board, randomCells };
}

/**
 * Columns a spawned lamp may enter through: the column runs without a gap from its spawner down
 * to its exit (so the lamp can simply fall out) and is at least two cells tall.
 */
export function lampColumns(parsed: ParsedLevel): boolean[] {
  const { cols, rows, exists } = parsed;
  const out: boolean[] = [];
  for (let c = 0; c < cols; c++) {
    let top = -1;
    let bottom = -1;
    let count = 0;
    for (let r = 0; r < rows; r++) {
      if (!exists[r * cols + c]) continue;
      if (top < 0) top = r;
      bottom = r;
      count++;
    }
    out.push(count >= 2 && bottom - top + 1 === count);
  }
  return out;
}

// ───────────────────────────── validation ─────────────────────────────

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

const GOAL_KINDS: readonly string[] = ['score', 'color', 'sand', 'lamp', 'stone', 'vine', 'chain'];

/**
 * Check a level definition. Returns human-readable problems; an empty list means the level is
 * valid and playable: sane dimensions and characters, goals that the board can actually satisfy,
 * ascending stars, every cell refillable, and a start position with no match and a valid move.
 */
export function validateLevel(def: LevelDef): string[] {
  const problems: string[] = [];
  const say = (text: string): void => {
    problems.push(text);
  };

  if (!isInt(def.id) || def.id < 1) say(`id must be a positive integer (got ${String(def.id)})`);

  let shapeOk = true;
  if (!isInt(def.cols) || def.cols < 1 || def.cols > MAX_BOARD_SIZE) {
    say(`cols must be an integer from 1 to ${MAX_BOARD_SIZE} (got ${String(def.cols)})`);
    shapeOk = false;
  }
  if (!isInt(def.rows) || def.rows < 1 || def.rows > MAX_BOARD_SIZE) {
    say(`rows must be an integer from 1 to ${MAX_BOARD_SIZE} (got ${String(def.rows)})`);
    shapeOk = false;
  }
  let colorsOk = true;
  if (!isInt(def.colors) || def.colors < MIN_COLORS || def.colors > MAX_COLORS) {
    say(`colors must be an integer from ${MIN_COLORS} to ${MAX_COLORS} (got ${String(def.colors)})`);
    colorsOk = false;
  }
  if (!isInt(def.moves) || def.moves < 1) say(`moves must be a positive integer (got ${String(def.moves)})`);

  // ── piece layer ──
  if (!Array.isArray(def.pieces)) {
    say('pieces must be an array of strings');
    shapeOk = false;
  } else if (shapeOk) {
    if (def.pieces.length !== def.rows) {
      say(`pieces has ${def.pieces.length} rows, expected ${def.rows}`);
      shapeOk = false;
    }
    for (let r = 0; r < def.pieces.length; r++) {
      const row = def.pieces[r];
      if (typeof row !== 'string') {
        say(`pieces row ${r} is not a string`);
        shapeOk = false;
        continue;
      }
      if (row.length !== def.cols) {
        say(`pieces row ${r} has ${row.length} characters, expected ${def.cols}`);
        shapeOk = false;
      }
      for (let c = 0; c < row.length; c++) {
        const ch = row.charAt(c);
        const spec = pieceSpecFor(ch);
        if (spec === null) {
          say(`pieces row ${r}, column ${c}: illegal character '${ch}'`);
          shapeOk = false;
        } else if (spec !== 'hole' && colorsOk && spec.kind === 'gem' && spec.color >= def.colors) {
          say(`pieces row ${r}, column ${c}: fixed colour '${ch}' is outside the level's ${def.colors} colours`);
        }
      }
    }
  }

  // ── floor layer ──
  if (def.floor !== undefined) {
    if (!Array.isArray(def.floor)) {
      say('floor must be an array of strings');
      shapeOk = false;
    } else if (shapeOk) {
      if (def.floor.length !== def.rows) {
        say(`floor has ${def.floor.length} rows, expected ${def.rows}`);
        shapeOk = false;
      }
      for (let r = 0; r < def.floor.length; r++) {
        const row = def.floor[r];
        if (typeof row !== 'string') {
          say(`floor row ${r} is not a string`);
          shapeOk = false;
          continue;
        }
        if (row.length !== def.cols) {
          say(`floor row ${r} has ${row.length} characters, expected ${def.cols}`);
          shapeOk = false;
        }
        for (let c = 0; c < row.length; c++) {
          const ch = row.charAt(c);
          if (ch !== '0' && ch !== '1' && ch !== '2') {
            say(`floor row ${r}, column ${c}: illegal character '${ch}' (use 0, 1 or 2)`);
            shapeOk = false;
          } else if (ch !== '0' && typeof def.pieces?.[r] === 'string' && (def.pieces[r] as string).charAt(c) === '_') {
            say(`floor row ${r}, column ${c}: sand on a hole`);
          }
        }
      }
    }
  }

  // ── stars ──
  const stars = def.stars as unknown;
  let starsOk = Array.isArray(stars) && stars.length === 3 && stars.every((s) => isInt(s) && s > 0);
  if (!starsOk) {
    say('stars must be three positive integers');
  } else {
    const [s1, s2, s3] = def.stars;
    if (!(s1 < s2 && s2 < s3)) {
      say(`stars must be strictly ascending (got ${s1}, ${s2}, ${s3})`);
      starsOk = false;
    }
  }

  // ── lamp settings ──
  const lampCfg = def.lamps;
  let lampCfgOk = true;
  if (lampCfg !== undefined) {
    if (!isInt(lampCfg.total) || lampCfg.total < 1) {
      say(`lamps.total must be a positive integer (got ${String(lampCfg.total)})`);
      lampCfgOk = false;
    }
    if (!isInt(lampCfg.maxOnBoard) || lampCfg.maxOnBoard < 1) {
      say(`lamps.maxOnBoard must be a positive integer (got ${String(lampCfg.maxOnBoard)})`);
      lampCfgOk = false;
    }
    if (!isInt(lampCfg.everyMoves) || lampCfg.everyMoves < 0) {
      say(`lamps.everyMoves must be a non-negative integer (got ${String(lampCfg.everyMoves)})`);
      lampCfgOk = false;
    }
  }

  // ── goals (the parts that do not need the board) ──
  const goals: Goal[] = Array.isArray(def.goals) ? def.goals : [];
  if (goals.length === 0) say('the level needs at least one goal');
  const seenGoals = new Set<string>();
  for (const goal of goals) {
    if (goal === null || typeof goal !== 'object' || GOAL_KINDS.indexOf(goal.kind) < 0) {
      say(`unknown goal ${JSON.stringify(goal)}`);
      continue;
    }
    const key = goal.kind === 'color' ? `color:${goal.color}` : goal.kind;
    if (seenGoals.has(key)) say(`duplicate goal '${key}'`);
    seenGoals.add(key);
    if (goal.kind === 'score') {
      if (!isInt(goal.target) || goal.target < 1) say(`score goal: target must be a positive integer (got ${String(goal.target)})`);
    } else if (goal.kind === 'color') {
      if (!isInt(goal.target) || goal.target < 1) say(`colour goal: target must be a positive integer (got ${String(goal.target)})`);
      if (!isInt(goal.color) || goal.color < 0 || (colorsOk && goal.color >= def.colors)) {
        say(`colour goal: colour ${String(goal.color)} does not spawn in a level with ${String(def.colors)} colours`);
      }
    } else if (goal.kind === 'lamp') {
      if (!isInt(goal.target) || goal.target < 1) say(`lamp goal: target must be a positive integer (got ${String(goal.target)})`);
    }
  }
  const scoreOnly = goals.length > 0 && goals.every((g) => g !== null && typeof g === 'object' && g.kind === 'score');
  if (scoreOnly && starsOk) {
    const goal = goals[0] as { kind: 'score'; target: number };
    if (goal.target !== def.stars[0]) {
      say(`a score-only level's target must equal the one-star score (target ${goal.target}, stars[0] ${def.stars[0]})`);
    }
  }

  if (!shapeOk) return problems;

  // ── everything below looks at the actual board ──
  const parsed = parseLevel(def);
  const { cols, rows, n, exists } = parsed;
  let cellCount = 0;
  let sandLayers = 0;
  let stones = 0;
  let vines = 0;
  let chains = 0;
  let lampsPlaced = 0;
  for (let i = 0; i < n; i++) {
    if (!exists[i]) continue;
    cellCount++;
    sandLayers += parsed.sand[i] as number;
    const spec = parsed.specs[i] as PieceSpec;
    if (spec.kind === 'stone') stones++;
    else if (spec.kind === 'vine') vines++;
    else if (spec.kind === 'lamp') lampsPlaced++;
    if (spec.chained) chains++;
  }
  if (cellCount === 0) {
    say('the board has no cells');
    return problems;
  }

  for (const goal of goals) {
    if (goal === null || typeof goal !== 'object') continue;
    if (goal.kind === 'sand' && sandLayers === 0) say('sand goal, but the floor has no sand');
    if (goal.kind === 'stone' && stones === 0) say('stone goal, but the board has no stones');
    if (goal.kind === 'vine' && vines === 0) say('vine goal, but the board has no vines');
    if (goal.kind === 'chain' && chains === 0) say('chain goal, but the board has no chained pieces');
    if (goal.kind === 'lamp' && lampCfgOk && isInt(goal.target)) {
      const available = lampCfg !== undefined ? Math.max(lampsPlaced, lampCfg.total) : lampsPlaced;
      if (available === 0) say('lamp goal, but no lamps are placed and `lamps` is not set');
      else if (goal.target > available) say(`lamp goal wants ${goal.target} lamps but only ${available} will ever exist`);
    }
  }

  // Every cell must be refillable: reachable from a spawner by falling straight down or, where
  // the cell above is missing, diagonally (blockers are temporary, holes are not).
  const reach: boolean[] = new Array<boolean>(n).fill(false);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (!exists[i]) continue;
      if (parsed.spawner[i]) reach[i] = true;
      else if (r > 0) {
        const up = i - cols;
        reach[i] = reach[up] === true || (c > 0 && reach[up - 1] === true) || (c < cols - 1 && reach[up + 1] === true);
      }
      if (!reach[i]) say(`cell column ${c}, row ${r} can never be refilled (no spawner feeds it)`);
    }
  }

  // Lamps must be able to leave.
  const friendly = lampColumns(parsed);
  const hasLampGoal = goals.some((g) => g !== null && typeof g === 'object' && g.kind === 'lamp');
  if (lampsPlaced > 0 || hasLampGoal) {
    for (let i = 0; i < n; i++) {
      const spec = parsed.specs[i];
      if (!spec || spec.kind !== 'lamp') continue;
      const c = i % cols;
      const r = (i - c) / cols;
      if (parsed.exit[i]) say(`lamp at column ${c}, row ${r} starts on an exit cell`);
      for (let y = r + 1; y < rows; y++) {
        if (!exists[y * cols + c]) {
          let cellBelow = false;
          for (let z = y + 1; z < rows; z++) if (exists[z * cols + c]) cellBelow = true;
          if (cellBelow) say(`lamp at column ${c}, row ${r} has a hole between it and the exit of its column`);
          break;
        }
      }
    }
    if (lampCfg !== undefined && lampCfgOk && lampCfg.total > lampsPlaced && !friendly.some((f) => f)) {
      say('lamps are set to drop in, but no column runs without a gap from its spawner to its exit');
    }
  }

  // Start position: the fixed colours must not already match, a move must be possible at all,
  // and the random fill must be able to produce a clean start.
  if (colorsOk) {
    let nextId = 1;
    const { board, randomCells } = createBoard(parsed, () => nextId++);
    if (hasAnyMatch(board)) {
      say('pieces with fixed colours already form a match');
    } else {
      const rng = createRng(isInt(def.id) ? def.id : 1);
      if (!fillRandom(board, randomCells, def.colors, rng)) {
        if (randomCells.length === 0) say('the fixed start position has no valid move');
        else if (!hasMovePattern(board) && !hasValidMove(board)) say('no move can ever be made on this board');
        else say('could not fill the board without matches and with a valid move');
      }
    }
  }

  return problems;
}
