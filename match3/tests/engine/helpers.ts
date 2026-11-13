/**
 * Shared helpers for the engine tests:
 *  - `board()`      hand-built start positions from a small text notation
 *  - `checkTurn()`  the invariants every turn of every game must satisfy, checked against
 *                   independent reference implementations (they share no code with the engine)
 *  - `randomLevel()` / `playRandomGame()` for the fuzz suite
 */
import {
  Game,
  SCORE,
  applySteps,
  createRng,
  type CellView,
  type Color,
  type DebugPiece,
  type Goal,
  type LevelDef,
  type Move,
  type Piece,
  type PieceKind,
  type Pos,
  type Rng,
  type Snapshot,
  type StartBoosters,
  type Step,
  type TurnResult,
} from '../../src/engine/index.ts';

export const P = (c: number, r: number): Pos => ({ c, r });

// ───────────────────────────── hand-built boards ─────────────────────────────

export interface BoardOpts {
  colors?: number;
  moves?: number;
  goals?: Goal[];
  stars?: [number, number, number];
  floor?: string[];
  lamps?: LevelDef['lamps'];
  seed?: number;
  boosters?: StartBoosters;
  /** Default true: keep the position exactly as written (no level-start shuffle). */
  keep?: boolean;
}

/**
 * Build a game from rows of whitespace-separated tokens:
 *   a..f  plain gem of colour 0..5      aH / aV / aN  beamH / beamV / nova of that colour
 *   a*    chained (also aH*, …)         .   random gem      .*  chained random gem
 *   P prism   L lamp   v vine   1 2 3 stone   _ hole   0 empty cell
 *   ~     filler: the gem 'abc'[(column + row) % 3]. A board of fillers has no match and no
 *         valid move, and moving one filler by one cell never makes a match — so whatever
 *         happens in the first wave is exactly what the test wrote with the other tokens.
 *         Tests that use it pass `colors: 3` and build their shapes from d / e / f, which then
 *         never drop in from the spawners.
 * Unless told otherwise the level is score-only with an unreachable target, so it never ends.
 */
export function board(rows: string[], o: BoardOpts = {}): Game {
  const grid = rows.map((row) => row.trim().split(/\s+/));
  const cols = (grid[0] as string[]).length;
  const cells: (DebugPiece | null | undefined)[] = [];
  const pieces: string[] = [];
  grid.forEach((row, r) => {
    if (row.length !== cols) throw new Error(`board(): row "${row.join(' ')}" has ${row.length} cells, expected ${cols}`);
    let line = '';
    row.forEach((token, c) => {
      const cell = token === '~' ? ({ kind: 'gem', color: ((c + r) % 3) as Color } as DebugPiece) : parseToken(token);
      line += cell === 'hole' ? '_' : '.';
      cells.push(cell === 'hole' ? undefined : cell);
    });
    pieces.push(line);
  });
  const level: LevelDef = {
    id: 1,
    cols,
    rows: grid.length,
    colors: o.colors ?? 6,
    moves: o.moves ?? 30,
    pieces,
    goals: o.goals ?? [{ kind: 'score', target: 1e9 }],
    stars: o.stars ?? [1e9, 2e9, 3e9],
  };
  if (o.floor) level.floor = o.floor;
  if (o.lamps) level.lamps = o.lamps;
  const opts: { seed: number; boosters?: StartBoosters } = { seed: o.seed ?? 1 };
  if (o.boosters) opts.boosters = o.boosters;
  return new Game(level, opts, { cells, noStartShuffle: o.keep ?? true });
}

function parseToken(token: string): DebugPiece | null | 'hole' {
  if (token === '_') return 'hole';
  if (token === '0') return null;
  if (token === 'P') return { kind: 'prism' };
  if (token === 'L') return { kind: 'lamp' };
  if (token === 'v') return { kind: 'vine' };
  if (token === '1' || token === '2' || token === '3') return { kind: 'stone', hp: Number(token) };
  const m = /^([a-f.])([HVN]?)(\*?)$/.exec(token);
  if (!m) throw new Error(`board(): bad token "${token}"`);
  const kind: PieceKind = m[2] === 'H' ? 'beamH' : m[2] === 'V' ? 'beamV' : m[2] === 'N' ? 'nova' : 'gem';
  const piece: DebugPiece = { kind, chained: m[3] === '*' };
  if (m[1] !== '.') piece.color = 'abcdef'.indexOf(m[1] as string) as Color;
  return piece;
}

export function cellOf(s: Snapshot, c: number, r: number): CellView {
  return s.cells[r * s.cols + c] as CellView;
}

export function pieceOf(s: Snapshot, c: number, r: number): Piece | null {
  return cellOf(s, c, r).piece;
}

/** Compact picture of a snapshot's pieces for assertion messages and layout checks. */
export function picture(s: Snapshot): string[] {
  const out: string[] = [];
  for (let r = 0; r < s.rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < s.cols; c++) {
      const cell = cellOf(s, c, r);
      const p = cell.piece;
      if (!cell.exists) row.push('_');
      else if (p === null) row.push('0');
      else if (p.kind === 'prism') row.push('P');
      else if (p.kind === 'lamp') row.push('L');
      else if (p.kind === 'vine') row.push('v');
      else if (p.kind === 'stone') row.push(String(p.hp));
      else {
        const suffix = p.kind === 'beamH' ? 'H' : p.kind === 'beamV' ? 'V' : p.kind === 'nova' ? 'N' : '';
        row.push('abcdef'.charAt(p.color) + suffix + (p.chained ? '*' : ''));
      }
    }
    out.push(row.join(' '));
  }
  return out;
}

export function stepsOf<T extends Step['type']>(steps: readonly Step[], type: T): Extract<Step, { type: T }>[] {
  return steps.filter((s) => s.type === type) as Extract<Step, { type: T }>[];
}

export function stepTypes(steps: readonly Step[]): string {
  return steps.map((s) => s.type).join(' ');
}

// ───────────────────────────── reference rules (independent of the engine) ─────────────────────────────

function colorAt(s: Snapshot, c: number, r: number): number {
  if (c < 0 || r < 0 || c >= s.cols || r >= s.rows) return -1;
  const p = cellOf(s, c, r).piece;
  if (p === null) return -1;
  return p.kind === 'gem' || p.kind === 'beamH' || p.kind === 'beamV' || p.kind === 'nova' ? p.color : -1;
}

/** Any run of three same-coloured gem-like pieces? */
export function refHasMatch(s: Snapshot): boolean {
  for (let r = 0; r < s.rows; r++) {
    for (let c = 0; c < s.cols; c++) {
      const k = colorAt(s, c, r);
      if (k < 0) continue;
      if (colorAt(s, c + 1, r) === k && colorAt(s, c + 2, r) === k) return true;
      if (colorAt(s, c, r + 1) === k && colorAt(s, c, r + 2) === k) return true;
    }
  }
  return false;
}

function refSwappable(p: Piece | null): p is Piece {
  return p !== null && p.kind !== 'stone' && p.kind !== 'vine' && !p.chained;
}

/** DESIGN §2.2, written from scratch on a snapshot. */
export function refCanSwap(s: Snapshot, a: Pos, b: Pos): boolean {
  if (Math.abs(a.c - b.c) + Math.abs(a.r - b.r) !== 1) return false;
  const A = pieceOf(s, a.c, a.r);
  const B = pieceOf(s, b.c, b.r);
  if (!refSwappable(A) || !refSwappable(B)) return false;
  const special = (p: Piece): boolean => p.kind === 'beamH' || p.kind === 'beamV' || p.kind === 'nova';
  const gemLike = (p: Piece): boolean => p.kind === 'gem' || special(p);
  // the grid of colours after the swap
  const grid: number[][] = [];
  for (let r = 0; r < s.rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < s.cols; c++) row.push(colorAt(s, c, r));
    grid.push(row);
  }
  const ca = (grid[a.r] as number[])[a.c] as number;
  (grid[a.r] as number[])[a.c] = (grid[b.r] as number[])[b.c] as number;
  (grid[b.r] as number[])[b.c] = ca;
  const at = (c: number, r: number): number => (c < 0 || r < 0 || c >= s.cols || r >= s.rows ? -1 : ((grid[r] as number[])[c] as number));
  const inRun = (p: Pos): boolean => {
    const k = at(p.c, p.r);
    if (k < 0) return false;
    let h = 1;
    for (let c = p.c - 1; at(c, p.r) === k; c--) h++;
    for (let c = p.c + 1; at(c, p.r) === k; c++) h++;
    let v = 1;
    for (let r = p.r - 1; at(p.c, r) === k; r--) v++;
    for (let r = p.r + 1; at(p.c, r) === k; r++) v++;
    return h >= 3 || v >= 3;
  };
  if (A.kind === 'lamp' || B.kind === 'lamp') {
    if (A.kind === 'lamp' && B.kind === 'lamp') return false;
    // the non-lamp piece now sits on the lamp's old cell and must match there
    return inRun(A.kind === 'lamp' ? a : b);
  }
  if (A.kind === 'prism' || B.kind === 'prism') return gemLike(A) || gemLike(B) || (A.kind === 'prism' && B.kind === 'prism');
  if (special(A) && special(B)) return true;
  return inRun(a) || inRun(b);
}

export const moveKey = (m: Move): string => {
  const first = m.a.r < m.b.r || (m.a.r === m.b.r && m.a.c < m.b.c) ? m.a : m.b;
  const second = first === m.a ? m.b : m.a;
  return `${first.c},${first.r}-${second.c},${second.r}`;
};

export function refValidMoves(s: Snapshot): string[] {
  const out: string[] = [];
  for (let r = 0; r < s.rows; r++) {
    for (let c = 0; c < s.cols; c++) {
      if (c + 1 < s.cols && refCanSwap(s, P(c, r), P(c + 1, r))) out.push(moveKey({ a: P(c, r), b: P(c + 1, r) }));
      if (r + 1 < s.rows && refCanSwap(s, P(c, r), P(c, r + 1))) out.push(moveKey({ a: P(c, r), b: P(c, r + 1) }));
    }
  }
  return out.sort();
}

function movable(p: Piece | null): boolean {
  return p !== null && p.kind !== 'stone' && p.kind !== 'vine' && !p.chained;
}

/** Empty cells that gravity should have filled: a spawner, or a movable piece above / diagonally above. */
export function unfilledReachable(s: Snapshot): Pos[] {
  const out: Pos[] = [];
  const get = (c: number, r: number): CellView | null => (c < 0 || r < 0 || c >= s.cols || r >= s.rows ? null : cellOf(s, c, r));
  for (let r = 0; r < s.rows; r++) {
    for (let c = 0; c < s.cols; c++) {
      const cell = cellOf(s, c, r);
      if (!cell.exists || cell.piece !== null) continue;
      const up = get(c, r - 1);
      const upLeft = get(c - 1, r - 1);
      const upRight = get(c + 1, r - 1);
      if (cell.spawner || (up && movable(up.piece)) || (upLeft && movable(upLeft.piece)) || (upRight && movable(upRight.piece))) {
        out.push(P(c, r));
      }
    }
  }
  return out;
}

/** Score a clear step should carry, recomputed from its hits (DESIGN §2.10). */
export function refClearScore(step: Extract<Step, { type: 'clear' }>): number {
  let total = 0;
  const mult = Math.min(Math.max(step.cascade, 1), SCORE.cascadeCap);
  for (const hit of step.hits) {
    if (hit.sandLeft !== undefined) total += SCORE.sandLayer;
    if (hit.kind === 'stone') {
      if (hit.result === 'damaged' || hit.result === 'removed') total += SCORE.stoneLayer;
    } else if (hit.kind === 'vine') {
      if (hit.result === 'removed') total += SCORE.vine;
    } else if (hit.result === 'unchained') {
      total += SCORE.chain;
    } else if (hit.result === 'removed' || hit.result === 'activated') {
      total += SCORE.gem * mult;
    }
  }
  for (const made of step.created) {
    total += made.piece.kind === 'prism' ? SCORE.prism : made.piece.kind === 'nova' ? SCORE.nova : SCORE.beam;
  }
  return total;
}

// ───────────────────────────── per-turn invariants ─────────────────────────────

export type Action = 'swap' | 'booster' | 'addMoves' | 'endBonus';

/** Running totals the fuzz driver keeps to cross-check the goal counters. */
export interface Tally {
  collected: number[];
  lamps: number;
  vines: number;
}

export const newTally = (): Tally => ({ collected: [0, 0, 0, 0, 0, 0], lamps: 0, vines: 0 });

function fail(message: string, before: Snapshot, res: TurnResult): never {
  throw new Error(
    `${message}\n--- before ---\n${picture(before).join('\n')}\n--- steps ---\n${res.steps.map((s) => JSON.stringify(s)).join('\n')}\n--- after ---\n${picture(res.snapshot).join('\n')}`,
  );
}

/**
 * Everything that must hold after any call that returns a TurnResult.
 * `strictColors`: gem colours must be within the level's colour count (not true for hand-built boards).
 */
export function checkTurn(game: Game, before: Snapshot, res: TurnResult, action: Action, tally?: Tally, strictColors = true): void {
  const after = res.snapshot;
  const level = game.level;
  const steps = res.steps;

  // 1. The transcript replays to exactly the new board (and score, and status).
  let replayed;
  try {
    replayed = applySteps(before, steps);
  } catch (e) {
    return fail(`replay threw: ${(e as Error).message}`, before, res);
  }
  if (JSON.stringify(replayed.cells) !== JSON.stringify(after.cells)) fail('replayed cells differ from the snapshot', before, res);
  if (replayed.score !== after.score) fail(`replayed score ${replayed.score} != snapshot score ${after.score}`, before, res);
  if (replayed.status !== after.status) fail(`replayed status ${replayed.status} != ${after.status}`, before, res);

  // 2. A rejected call changes nothing.
  if (!res.accepted) {
    if (JSON.stringify(after) !== JSON.stringify(before)) fail('rejected call changed the state', before, res);
    if (steps.length > 1 || (steps.length === 1 && !((steps[0] as Step).type === 'swap' && (steps[0] as { valid: boolean }).valid === false))) {
      fail('rejected call may only carry one rejected swap step', before, res);
    }
    return;
  }

  // 3. Static structure never changes; pieces are sane and unique.
  if (after.cols !== before.cols || after.rows !== before.rows || after.cells.length !== before.cells.length) fail('board size changed', before, res);
  const ids = new Set<number>();
  for (let i = 0; i < after.cells.length; i++) {
    const cell = after.cells[i] as CellView;
    const old = before.cells[i] as CellView;
    if (cell.exists !== old.exists || cell.exit !== old.exit || cell.spawner !== old.spawner) fail(`cell ${i} changed its structure`, before, res);
    if (cell.sand > old.sand || cell.sand < 0) fail(`sand grew on cell ${i}`, before, res);
    const p = cell.piece;
    if (p === null) continue;
    if (!cell.exists) fail(`piece ${p.id} sits in a hole (cell ${i})`, before, res);
    if (ids.has(p.id)) fail(`duplicate piece id ${p.id}`, before, res);
    ids.add(p.id);
    const gemLike = p.kind === 'gem' || p.kind === 'beamH' || p.kind === 'beamV' || p.kind === 'nova';
    if (gemLike) {
      if (!(p.color >= 0 && p.color < (strictColors ? level.colors : 6))) fail(`piece ${p.id} (${p.kind}) has colour ${p.color}`, before, res);
    } else if (p.color !== -1) fail(`piece ${p.id} (${p.kind}) must have colour -1`, before, res);
    if (p.chained && !gemLike) fail(`piece ${p.id} (${p.kind}) cannot be chained`, before, res);
    if (p.kind === 'stone' ? !(p.hp >= 1 && p.hp <= 3) : p.hp !== 1) fail(`piece ${p.id} (${p.kind}) has hp ${p.hp}`, before, res);
  }

  // 3b. A stone or vine shields the sand under it for as long as it stands.
  for (let i = 0; i < after.cells.length; i++) {
    const was = (before.cells[i] as CellView).piece;
    const now = (after.cells[i] as CellView).piece;
    if (was !== null && now !== null && was.id === now.id && (was.kind === 'stone' || was.kind === 'vine')) {
      if ((after.cells[i] as CellView).sand !== (before.cells[i] as CellView).sand) fail(`sand under blocker ${was.id} changed`, before, res);
    }
  }
  for (const step of steps) {
    if (step.type !== 'clear') continue;
    for (const hit of step.hits) {
      if ((hit.kind === 'stone' || hit.kind === 'vine') && hit.sandLeft !== undefined) fail('a hit on a stone / vine reached the sand', before, res);
      if (hit.kind === 'lamp' && hit.result !== 'none') fail('a lamp was damaged', before, res);
    }
  }

  // 4. The board is settled: no match, nothing left to fall, no lamp waiting on an exit.
  if (refHasMatch(after)) fail('a match is left on a settled board', before, res);
  const holes = unfilledReachable(after);
  if (holes.length > 0) fail(`reachable cells left empty: ${JSON.stringify(holes)}`, before, res);
  for (const cell of after.cells) if (cell.exit && cell.piece !== null && cell.piece.kind === 'lamp') fail('a lamp rests on an exit cell', before, res);

  // 5. While playing there is always a move, and the engine's move list is exactly the reference one.
  const engineMoves = game.validMoves().map(moveKey).sort();
  if (after.status === 'playing') {
    const reference = refValidMoves(after);
    if (reference.length === 0) fail("status is 'playing' but there is no valid move", before, res);
    if (JSON.stringify(reference) !== JSON.stringify(engineMoves)) {
      fail(`validMoves() differs from the reference\nengine: ${engineMoves.join(' ')}\nreference: ${reference.join(' ')}`, before, res);
    }
    const hint = game.hint();
    if (hint === null || reference.indexOf(moveKey(hint)) < 0) fail(`hint ${JSON.stringify(hint)} is not a valid move`, before, res);
    if (hint !== null && !game.canSwap(hint.a, hint.b)) fail('canSwap rejects the hint', before, res);
  } else {
    if (engineMoves.length !== 0 || game.hint() !== null) fail('moves offered while not playing', before, res);
  }

  // 6. Counters.
  if (after.movesLeft < 0) fail('movesLeft is negative', before, res);
  if (after.score < before.score) fail('score went down', before, res);
  const expectedMoves =
    action === 'swap' ? before.movesLeft - 1 : action === 'booster' ? before.movesLeft : action === 'endBonus' ? 0 : -1;
  if (expectedMoves >= 0 && after.movesLeft !== expectedMoves) fail(`movesLeft ${after.movesLeft}, expected ${expectedMoves}`, before, res);
  if (action === 'addMoves' && after.movesLeft <= before.movesLeft) fail('addMoves did not add moves', before, res);
  const starCount = after.score >= level.stars[2] ? 3 : after.score >= level.stars[1] ? 2 : after.score >= level.stars[0] ? 1 : 0;
  if (after.stars !== (after.status === 'won' ? Math.max(1, starCount) : starCount)) fail(`stars ${after.stars} do not fit score ${after.score}`, before, res);

  // 7. Step grammar and per-step scores.
  let falls = 0;
  let lampsNow = 0;
  for (let k = 0; k < steps.length; k++) {
    const step = steps[k] as Step;
    if (step.type === 'status' && k !== steps.length - 1) fail('status step is not last', before, res);
    if (step.type === 'activate') {
      const next = steps[k + 1];
      if (!next || next.type !== 'clear') fail('activate is not followed by clear', before, res);
      if (step.fx.length === 0) fail('empty activate step', before, res);
    }
    if (step.type === 'clear') {
      if (step.cascade !== falls + 1) fail(`clear has cascade ${step.cascade}, expected ${falls + 1}`, before, res);
      const expected = refClearScore(step);
      if (step.score !== expected) fail(`clear score ${step.score}, recomputed ${expected}`, before, res);
      let popupSum = 0;
      for (const popup of step.popups) {
        if (popup.value <= 0) fail('popup without points', before, res);
        popupSum += popup.value;
      }
      if (popupSum !== step.score) fail(`popups sum to ${popupSum}, clear score is ${step.score}`, before, res);
      const hitCells = new Set<number>();
      for (const hit of step.hits) {
        const key = hit.at.r * after.cols + hit.at.c;
        if (hitCells.has(key)) fail(`cell ${hit.at.c},${hit.at.r} is hit twice in one wave`, before, res);
        hitCells.add(key);
        if (tally && (hit.result === 'removed' || hit.result === 'activated') && hit.color >= 0) {
          tally.collected[hit.color] = (tally.collected[hit.color] as number) + 1;
        }
        if (tally && hit.kind === 'vine' && hit.result === 'removed') tally.vines++;
      }
    }
    if (step.type === 'fall') {
      falls++;
      if (step.moves.length + step.spawns.length === 0) fail('empty fall step', before, res);
      const perColumn = new Map<number, number[]>();
      for (const spawn of step.spawns) {
        if (!(spawn.from.r < 0)) fail('spawn origin row is not negative', before, res);
        const list = perColumn.get(spawn.from.c) ?? [];
        list.push(-spawn.from.r);
        perColumn.set(spawn.from.c, list);
      }
      perColumn.forEach((list, col) => {
        list.sort((x, y) => x - y);
        list.forEach((v, idx) => {
          if (v !== idx + 1) fail(`spawn heights of column ${col} are not 1..k`, before, res);
        });
        let hasSpawner = false;
        for (let r = 0; r < after.rows; r++) if (cellOf(after, col, r).spawner) hasSpawner = true;
        if (!hasSpawner) fail(`spawn from column ${col}, which has no spawner`, before, res);
      });
      for (const move of step.moves) if (move.to.r <= move.from.r) fail('a piece fell upwards or sideways', before, res);
    }
    if (step.type === 'collect') {
      if (step.score !== step.lamps.length * SCORE.lamp || step.lamps.length === 0) fail('bad collect step', before, res);
      lampsNow += step.lamps.length;
    }
    if (step.type === 'transform') {
      const expected = step.reason === 'endBonus' ? before.movesLeft * SCORE.endBonusPerMove : 0;
      if (step.score !== expected) fail(`transform score ${step.score}, expected ${expected}`, before, res);
    }
  }
  const statusStep = steps.length > 0 && (steps[steps.length - 1] as Step).type === 'status';
  if (statusStep !== (after.status !== before.status)) fail('status step must appear exactly when the status changes', before, res);
  if (tally) tally.lamps += lampsNow;

  // 8. Goals: monotonic, capped, and equal to what the board and the transcript say.
  let sandNow = 0;
  let stonesNow = 0;
  let chainsNow = 0;
  for (const cell of after.cells) {
    sandNow += cell.sand;
    if (cell.piece?.kind === 'stone') stonesNow++;
    if (cell.piece?.chained) chainsNow++;
  }
  after.goals.forEach((g, idx) => {
    const old = before.goals[idx] as Snapshot['goals'][number];
    if (g.current < 0 || g.current > g.target) fail(`goal ${g.goal.kind}: current ${g.current} outside 0..${g.target}`, before, res);
    if (g.current < old.current || g.target !== old.target) fail(`goal ${g.goal.kind} went backwards`, before, res);
    if (g.done !== g.current >= g.target) fail(`goal ${g.goal.kind}: done flag is wrong`, before, res);
    if (g.goal.kind === 'sand' && g.target - g.current !== sandNow) fail(`sand goal says ${g.target - g.current} left, board has ${sandNow}`, before, res);
    if (g.goal.kind === 'stone' && g.target - g.current !== stonesNow) fail(`stone goal says ${g.target - g.current} left, board has ${stonesNow}`, before, res);
    if (g.goal.kind === 'chain' && g.target - g.current !== chainsNow) fail(`chain goal says ${g.target - g.current} left, board has ${chainsNow}`, before, res);
    if (g.goal.kind === 'score' && g.current !== Math.min(after.score, g.target)) fail('score goal does not follow the score', before, res);
    if (tally && g.goal.kind === 'lamp' && g.current !== Math.min(tally.lamps, g.target)) fail(`lamp goal ${g.current}, transcript says ${tally.lamps}`, before, res);
    if (tally && g.goal.kind === 'vine' && g.current !== Math.min(tally.vines, g.target)) fail(`vine goal ${g.current}, transcript says ${tally.vines}`, before, res);
    if (tally && g.goal.kind === 'color' && g.current !== Math.min(tally.collected[g.goal.color] as number, g.target)) {
      fail(`colour goal ${g.current}, transcript says ${tally.collected[g.goal.color]}`, before, res);
    }
  });

  // 9. Status rules.
  const allDone = after.goals.every((g) => g.done);
  const scoreOnly = level.goals.every((g) => g.kind === 'score');
  if (after.status === 'won' && !allDone) fail('won with unmet goals', before, res);
  if (after.status === 'won' && scoreOnly && action !== 'endBonus' && after.movesLeft !== 0) fail('score-only level won before the moves ran out', before, res);
  if (after.status === 'lost' && before.status === 'playing') {
    if (allDone && !scoreOnly) fail('lost with every goal done', before, res);
    // Out of moves — or, with moves left, a board on which no move can ever exist.
    if (after.movesLeft > 0 && refValidMoves(after).length > 0) fail('lost with moves left and a valid move on the board', before, res);
  }
  if (after.status === 'playing' && action !== 'addMoves') {
    if (after.movesLeft === 0) fail("still 'playing' with no moves left", before, res);
    if (allDone && !scoreOnly) fail("still 'playing' with every goal done", before, res);
  }
}

// ───────────────────────────── random levels and games (fuzz) ─────────────────────────────

/**
 * A random level with a random mix of everything the engine supports: holes (cut corners, pits,
 * missing column tops, random gaps), sand, stones, chains, vines, lamps, pre-placed specials and
 * 3..6 colours. Not necessarily a *good* level — `validateLevel` decides that.
 */
export function randomLevel(rng: Rng, id: number): LevelDef {
  const cols = 4 + rng.int(6);
  const rows = 4 + rng.int(6);
  const colors = 3 + rng.int(4);
  const exists: boolean[][] = [];
  for (let r = 0; r < rows; r++) exists.push(new Array<boolean>(cols).fill(true));
  const cut = (c: number, r: number): void => {
    if (c >= 0 && c < cols && r >= 0 && r < rows) (exists[r] as boolean[])[c] = false;
  };
  const shape = rng.int(7);
  if (shape === 1) {
    // cut corners
    const k = 1 + rng.int(2);
    for (let r = 0; r < k; r++) {
      for (let c = 0; c < k - r; c++) {
        cut(c, r);
        cut(cols - 1 - c, r);
        cut(c, rows - 1 - r);
        cut(cols - 1 - c, rows - 1 - r);
      }
    }
  } else if (shape === 2) {
    // a pit in the middle
    const c0 = 1 + rng.int(Math.max(1, cols - 3));
    const r0 = 1 + rng.int(Math.max(1, rows - 3));
    for (let r = r0; r < r0 + 1 + rng.int(2); r++) for (let c = c0; c < c0 + 1 + rng.int(2); c++) cut(c, r);
  } else if (shape === 3) {
    // column tops missing
    for (let c = 0; c < cols; c++) if (rng.int(3) === 0) for (let r = 0; r < 1 + rng.int(2); r++) cut(c, r);
  } else if (shape === 4) {
    // random gaps
    for (let k = 0; k < 1 + rng.int(5); k++) cut(rng.int(cols), rng.int(rows));
  } else if (shape === 5) {
    // ragged bottom
    for (let c = 0; c < cols; c++) if (rng.int(3) === 0) for (let r = 0; r < 1 + rng.int(2); r++) cut(c, rows - 1 - r);
  }

  const features = {
    sand: rng.int(3) === 0,
    stone: rng.int(3) === 0,
    chain: rng.int(3) === 0,
    vine: rng.int(4) === 0,
    lamp: rng.int(4) === 0,
    special: rng.int(5) === 0,
  };
  const pieces: string[] = [];
  const floor: string[] = [];
  let sand = 0;
  let stones = 0;
  let chains = 0;
  let vines = 0;
  let lamps = 0;
  for (let r = 0; r < rows; r++) {
    let line = '';
    let floorLine = '';
    for (let c = 0; c < cols; c++) {
      if (!(exists[r] as boolean[])[c]) {
        line += '_';
        floorLine += '0';
        continue;
      }
      let ch = '.';
      const roll = rng.int(100);
      if (features.stone && roll < 12) {
        ch = String(1 + rng.int(3));
        stones++;
      } else if (features.chain && roll >= 12 && roll < 22) {
        ch = 'c';
        chains++;
      } else if (features.vine && roll >= 22 && roll < 30) {
        ch = 'v';
        vines++;
      } else if (features.lamp && roll >= 30 && roll < 33 && r < rows - 2) {
        ch = 'L';
        lamps++;
      } else if (features.special && roll >= 33 && roll < 38) {
        ch = 'HVNP'.charAt(rng.int(4));
      }
      line += ch;
      const layers = features.sand && rng.int(3) === 0 ? 1 + rng.int(2) : 0;
      sand += layers;
      floorLine += String(layers);
    }
    pieces.push(line);
    floor.push(floorLine);
  }

  const goals: Goal[] = [];
  if (sand > 0 && rng.int(2) === 0) goals.push({ kind: 'sand' });
  if (stones > 0 && rng.int(2) === 0) goals.push({ kind: 'stone' });
  if (chains > 0 && rng.int(2) === 0) goals.push({ kind: 'chain' });
  if (vines > 0 && rng.int(2) === 0) goals.push({ kind: 'vine' });
  const level: LevelDef = { id, cols, rows, colors, moves: 4 + rng.int(18), pieces, goals, stars: [0, 0, 0] };
  if (features.lamp) {
    const total = lamps + rng.int(4);
    if (total > 0) {
      if (total > lamps || rng.int(2) === 0) level.lamps = { total, maxOnBoard: 1 + rng.int(3), everyMoves: rng.int(4) };
      goals.push({ kind: 'lamp', target: 1 + rng.int(total) });
    }
  }
  if (rng.int(3) === 0) goals.push({ kind: 'color', color: rng.int(colors) as Color, target: 5 + rng.int(40) });
  const s1 = 300 + rng.int(4000);
  level.stars = [s1, s1 + 500 + rng.int(3000), s1 + 4000 + rng.int(6000)];
  if (goals.length === 0 || rng.int(6) === 0) {
    if (goals.length === 0) goals.push({ kind: 'score', target: s1 });
    else goals.push({ kind: 'score', target: 200 + rng.int(3000) });
  }
  if (sand > 0) level.floor = floor;
  return level;
}

export interface PlayOptions {
  /** Hard cap on calls, so a game always ends. */
  maxActions?: number;
  /** Probability (0..1) that the bot uses a booster / makes a nonsense call instead of a move. */
  mischief?: number;
  /** Called after every engine call (the fuzz suite passes `checkTurn`). */
  onTurn?: (game: Game, before: Snapshot, res: TurnResult, action: Action, tally: Tally) => void;
}

/**
 * Play one complete game with a seeded bot: mostly random valid moves, sometimes the hint,
 * boosters, invalid swaps and calls in the wrong status; continues once or twice after losing and
 * takes the end bonus after winning. Returns the JSON of every step the engine produced.
 */
export function playRandomGame(level: LevelDef, seed: number, botSeed: number, o: PlayOptions = {}): { transcript: string; game: Game; turns: number } {
  const bot = createRng(botSeed);
  const boosters: StartBoosters = {};
  if (bot.int(4) === 0) boosters.extraMoves = true;
  if (bot.int(5) === 0) boosters.prism = true;
  if (bot.int(5) === 0) boosters.beamNova = true;
  const game = new Game(level, { seed, boosters });
  const tally = newTally();
  const log: Step[][] = [];
  const mischief = o.mischief ?? 0.15;
  let continues = bot.int(3);
  let turns = 0;

  const run = (action: Action, call: () => TurnResult): TurnResult => {
    const before = game.snapshot();
    const res = call();
    log.push(res.steps);
    turns++;
    if (o.onTurn) o.onTurn(game, before, res, action, tally);
    return res;
  };
  const randomCell = (): Pos => P(bot.int(level.cols), bot.int(level.rows));
  const randomNeighbour = (p: Pos): Pos => {
    const d = bot.int(4);
    return P(p.c + (d === 0 ? 1 : d === 1 ? -1 : 0), p.r + (d === 2 ? 1 : d === 3 ? -1 : 0));
  };

  for (let guard = 0; guard < (o.maxActions ?? 400); guard++) {
    const status = game.snapshot().status;
    if (status === 'won') {
      // wrong-status calls first, then the bonus, then the bonus again (must be refused)
      run('swap', () => game.swap(randomCell(), randomCell()));
      run('addMoves', () => game.addMoves(3));
      run('endBonus', () => game.endBonus());
      run('endBonus', () => game.endBonus());
      run('booster', () => game.useBooster('hammer', randomCell()));
      break;
    }
    if (status === 'lost') {
      run('booster', () => game.useBooster('shuffle'));
      run('endBonus', () => game.endBonus());
      if (continues <= 0) break;
      continues--;
      const res = run('addMoves', () => game.addMoves(1 + bot.int(5)));
      if (!res.accepted) break;
      continue;
    }
    if (bot.next() < mischief) {
      const what = bot.int(8);
      if (what === 0) run('booster', () => game.useBooster('hammer', randomCell()));
      else if (what === 1) {
        const a = randomCell();
        run('booster', () => game.useBooster('freeSwap', a, randomNeighbour(a)));
      } else if (what === 2) run('booster', () => game.useBooster('shuffle'));
      else if (what === 3) {
        const a = randomCell();
        run('swap', () => game.swap(a, randomNeighbour(a)));
      } else if (what === 4) run('swap', () => game.swap(randomCell(), randomCell()));
      else if (what === 5) run('addMoves', () => game.addMoves(5));
      else if (what === 6) run('endBonus', () => game.endBonus());
      else run('booster', () => game.useBooster('hammer', P(-1, 99)));
      continue;
    }
    const moves = game.validMoves();
    if (moves.length === 0) throw new Error("status is 'playing' but validMoves() is empty");
    let move = bot.pick(moves);
    if (bot.int(8) === 0) move = game.hint() as Move;
    const flip = bot.int(2) === 0;
    run('swap', () => game.swap(flip ? move.b : move.a, flip ? move.a : move.b));
  }
  return { transcript: JSON.stringify(log), game, turns };
}
