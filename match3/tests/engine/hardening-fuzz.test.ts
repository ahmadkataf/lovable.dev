/**
 * Hardening, part 3 — fuzz. Whole games on generated levels, on the shipped levels and on
 * random "soups" of pieces, every call audited by the independent Referee of ./hardening-kit.ts
 * (its own match finder, swap rules, hit rules, flood fill and step replay — nothing from
 * src/engine/board.ts or replay.ts). After every call it checks, among other things:
 *
 *   transcript fidelity (the steps reproduce the snapshot, hit by hit) · no residual match ·
 *   nothing left to fall, every reachable cell filled · a valid move exists while playing ·
 *   ids unique and never reused · moves / score / stars / goal counters · status transitions ·
 *   validMoves(), hint() and canSwap() against the reference rules
 *
 * and, per game: determinism (byte-identical replay), no hidden state after refused calls,
 * clone() equivalence, and that swap() accepts exactly the moves validMoves() lists (every
 * adjacent pair of sampled boards, both orders).
 */
import { describe, expect, it } from 'vitest';
import { Game, applySteps, validateLevel } from '../../src/engine/index.ts';
import type { Color, DebugPiece, LevelDef, PieceKind, Pos, Snapshot, Step } from '../../src/engine/index.ts';
import { LEVELS } from '../../src/levels/index.ts';
import { Referee, at, checkDeterminism, dice, genLevel, moveKey, perform, picture, playAudited, probeSwaps, type Call, type Dice, type GameLog } from './hardening-kit.ts';

const LONG = 600_000;

function report(name: string, stats: Record<string, number>, extra: Record<string, number>): void {
  const pick = (prefix: string): string =>
    Object.keys(stats)
      .filter((k) => k.startsWith(prefix))
      .sort()
      .map((k) => `${k.slice(prefix.length)} ${stats[k]}`)
      .join(', ');
  console.log(
    `${name}: ${JSON.stringify(extra)}\n  steps: ${pick('step:')}\n  effects: ${pick('fx:')}\n  combos: ${pick('combo:')}\n  hits: ${pick('hit:')}\n  created: ${pick('created:')}\n  calls: ${['swap', 'hammer', 'freeSwap', 'shuffle', 'addMoves', 'endBonus'].map((op) => `${op} ${stats[`${op}:accepted`] ?? 0}/${stats[`${op}:rejected`] ?? 0}`).join(', ')} (accepted/refused)\n  other: ${['fall:diagonal', 'lamp:spawned', 'vine:grew', 'shuffle:auto', 'shuffle:recolor', 'deadBoard', 'start:dead', 'status:won', 'status:lost', 'bonus:round', 'probe:accepted', 'probe:refused', 'probe:rebuilt'].map((k) => `${k} ${stats[k] ?? 0}`).join(', ')}`,
  );
}

describe('hardening fuzz', () => {
  it(
    '400 audited games on generated levels (valid and invalid ones)',
    () => {
      const stats: Record<string, number> = {};
      const d = dice(1);
      let turns = 0;
      let valid = 0;
      const failures: string[] = [];
      for (let n = 0; n < 400; n++) {
        const level = genLevel(d, n + 1);
        if (validateLevel(level).length === 0) valid++;
        try {
          const played = playAudited(level, 1000 + n, 77 * n + 1, stats, { probeEvery: 7 });
          checkDeterminism(played);
          turns += played.turns;
        } catch (e) {
          failures.push(`game ${n}: ${(e as Error).message.split('\n').slice(0, 2).join(' | ')}`);
          if (failures.length <= 2) console.log(`game ${n}:\n${(e as Error).message.slice(0, 6000)}`);
        }
      }
      report('generated levels', stats, { games: 400, validLevels: valid, turns });
      expect(failures).toEqual([]);
      expect(turns).toBeGreaterThan(6000);
      // the fuzz must keep reaching every mechanic
      for (const key of [
        'combo:prism+gem',
        'combo:prism+beam',
        'combo:prism+nova',
        'combo:prism+prism',
        'combo:beam+beam',
        'combo:beam+nova',
        'combo:nova+nova',
        'created:beamH',
        'created:beamV',
        'created:nova',
        'created:prism',
        'hit:adjacent:removed',
        'hit:adjacent:damaged',
        'hit:match:unchained',
        'hit:blast:unchained',
        'hit:blast:none',
        'hit:booster:removed',
        'fall:diagonal',
        'lamp:spawned',
        'step:collect',
        'vine:grew',
        'shuffle:auto',
        'shuffle:recolor',
        'deadBoard',
        'status:won',
        'status:lost',
        'addMoves:accepted',
        'endBonus:accepted',
        'hammer:accepted',
        'freeSwap:accepted',
        'shuffle:accepted',
        'probe:accepted',
        'probe:refused',
        'probe:rebuilt',
      ]) {
        expect(stats[key] ?? 0, `the fuzz never reached "${key}"`).toBeGreaterThan(0);
      }
    },
    LONG,
  );

  it(
    'every shipped level: two audited games each, started with and without boosters',
    () => {
      const stats: Record<string, number> = {};
      const failures: string[] = [];
      let turns = 0;
      expect(LEVELS.length).toBeGreaterThan(0);
      for (const level of LEVELS) {
        for (let k = 0; k < 2; k++) {
          try {
            const played = playAudited(level, 31 * level.id + k, 1009 * level.id + k, stats, { probeEvery: 11 });
            checkDeterminism(played);
            turns += played.turns;
          } catch (e) {
            failures.push(`level ${level.id} game ${k}: ${(e as Error).message.split('\n').slice(0, 2).join(' | ')}`);
            if (failures.length <= 2) console.log(`level ${level.id}:\n${(e as Error).message.slice(0, 6000)}`);
          }
        }
      }
      report('shipped levels', stats, { levels: LEVELS.length, games: LEVELS.length * 2, turns });
      expect(failures).toEqual([]);
      // a shipped level never starts dead and is never given up as dead mid-game
      expect(stats['start:dead'] ?? 0).toBe(0);
    },
    LONG,
  );

  it(
    '300 random soups: unsettled hand-made boards with every kind of piece, random calls',
    () => {
      const stats: Record<string, number> = {};
      const d = dice(99);
      const failures: string[] = [];
      let calls = 0;
      for (let n = 0; n < 300; n++) {
        const { level, cells } = soup(d, n + 1);
        const seed = 500 + n;
        try {
          const game = new Game(level, { seed }, { cells, noStartShuffle: true });
          const referee = new Referee(level, game.snapshot(), { handBuilt: true, looseColors: true, stats });
          const bot = dice(n * 13 + 5);
          for (let k = 0; k < 40; k++) {
            const s = game.snapshot();
            let call: Call;
            const roll = bot.int(10);
            const cell = at(bot.int(level.cols), bot.int(level.rows));
            const side = bot.chance(0.5) ? at(cell.c + 1, cell.r) : at(cell.c, cell.r + 1);
            if (s.status === 'won') call = bot.chance(0.5) ? { op: 'endBonus' } : { op: 'swap', a: cell, b: side };
            else if (s.status === 'lost') call = bot.chance(0.6) ? { op: 'addMoves', n: 1 + bot.int(3) } : { op: 'hammer', at: cell };
            else if (roll < 5) {
              const moves = game.validMoves();
              const move = moves.length > 0 ? bot.pick(moves) : { a: cell, b: side };
              call = { op: 'swap', a: move.a, b: move.b };
            } else if (roll < 7) call = { op: 'hammer', at: cell };
            else if (roll < 9) call = { op: 'freeSwap', a: cell, b: side };
            else call = { op: 'shuffle' };
            const res = perform(game, call);
            calls++;
            // (a hand-made board need not offer a move at first; the first accepted turn sorts that out)
            referee.check(s, call, res, game);
            // src/engine/replay.ts is the renderer's reference: it must replay these odd boards too
            const replayed = applySteps(s, res.steps);
            if (JSON.stringify(replayed.cells) !== JSON.stringify(res.snapshot.cells) || replayed.score !== res.snapshot.score || replayed.status !== res.snapshot.status) {
              throw new Error(`applySteps() does not reproduce the snapshot after ${JSON.stringify(call)}\n${picture(s).join('\n')}`);
            }
          }
        } catch (e) {
          failures.push(`soup ${n}: ${(e as Error).message.split('\n').slice(0, 2).join(' | ')}`);
          if (failures.length <= 2) console.log(`soup ${n}:\n${(e as Error).message.slice(0, 6000)}`);
        }
      }
      report('soups', stats, { boards: 300, calls });
      expect(failures).toEqual([]);
      expect(calls).toBeGreaterThan(3000);
    },
    LONG,
  );

  it(
    'swap() accepts exactly the moves validMoves() lists — every adjacent pair of 600 sampled boards',
    () => {
      const stats: Record<string, number> = {};
      const d = dice(2024);
      let boards = 0;
      for (let n = 0; boards < 600 && n < 400; n++) {
        const level = genLevel(d, n + 1);
        const seed = 7000 + n;
        const game = new Game(level, { seed });
        const log: GameLog = { level, seed, boosters: {}, calls: [] };
        const bot = dice(n);
        for (let k = 0; k < 12 && game.snapshot().status === 'playing'; k++) {
          probeSwaps(game, log, bot, stats);
          boards++;
          const moves = game.validMoves();
          expect(moves.length, picture(game.snapshot()).join('\n')).toBeGreaterThan(0);
          const move = bot.pick(moves);
          const call: Call = { op: 'swap', a: move.a, b: move.b };
          log.calls.push(call);
          expect(perform(game, call).accepted).toBe(true);
        }
      }
      console.log(`swap probes: ${boards} boards, ${stats['probe:accepted']} accepted and ${stats['probe:refused']} refused swaps, ${stats['probe:rebuilt']} cross-checked on a rebuilt game`);
      expect(boards).toBeGreaterThanOrEqual(600);
      expect(stats['probe:accepted']).toBeGreaterThan(5000);
      expect(stats['probe:refused']).toBeGreaterThan(50000);
    },
    LONG,
  );

  it(
    'the rules have no preferred direction: mirrored and transposed boards give mirrored and transposed moves and first waves',
    () => {
      const d = dice(606);
      let boards = 0;
      let turns = 0;
      for (let n = 0; n < 260; n++) {
        const level = genLevel(d, n + 1);
        const game = new Game(level, { seed: 300 + n, boosters: n % 4 === 0 ? { prism: true, beamNova: true } : {} });
        // a few moves in, so that specials made by play are on the board too
        const bot = dice(n + 17);
        for (let k = 0; k < n % 5 && game.snapshot().status === 'playing'; k++) {
          const m = bot.pick(game.validMoves());
          game.swap(m.a, m.b);
        }
        const s = game.snapshot();
        if (s.status !== 'playing') continue;
        boards++;
        for (const view of [mirrorView(s.cols), transposeView()]) {
          const twin = view.build(s, level, 300 + n);
          const want = game.validMoves().map((m) => moveKey({ a: view.pos(m.a), b: view.pos(m.b) })).sort();
          const got = twin.validMoves().map(moveKey).sort();
          expect(got, `${view.name}\n${picture(s).join('\n')}`).toEqual(want);
          const moves = game.validMoves();
          for (let k = 0; k < 4 && k < moves.length; k++) {
            const move = moves[(k * 7 + n) % moves.length];
            const a = firstWave(game.clone().swap(move.a, move.b).steps, (p) => view.pos(p), view.kind);
            const b = firstWave(twin.clone().swap(view.pos(move.a), view.pos(move.b)).steps, (p) => p, (kind) => kind);
            if (a === null || b === null) continue; // prism + beam: the new beams get random orientations
            expect(b, `${view.name}, move ${JSON.stringify(move)}\n${picture(s).join('\n')}`).toEqual(a);
            turns++;
          }
        }
      }
      expect(boards).toBeGreaterThan(200);
      expect(turns).toBeGreaterThan(1200);
    },
    LONG,
  );

  it('garbage level data never throws: the game degrades to something consistent', () => {
    const d = dice(31337);
    const junk: unknown[] = [undefined, null, Number.NaN, -1, 0, 1e9, 2.5, '', 'x', [], {}, [1, 2], { kind: 'score' }, true, Number.POSITIVE_INFINITY, [null, undefined], 40];
    for (const bad of [null, undefined, 5, 'level', []] as unknown[]) expect(() => validateLevel(bad as LevelDef)).not.toThrow();
    for (let n = 0; n < 1500; n++) {
      const level = genLevel(d, n + 1) as unknown as Record<string, unknown>;
      // break one to three fields
      for (let k = 0; k < 1 + d.int(3); k++) {
        const field = d.pick(['cols', 'rows', 'colors', 'moves', 'pieces', 'floor', 'goals', 'stars', 'lamps', 'id']);
        if (field === 'pieces' && Array.isArray(level.pieces) && level.pieces.length > 0 && level.pieces.every((row) => typeof row === 'string') && d.chance(0.5)) {
          const rows = (level.pieces as string[]).slice();
          const r = d.int(rows.length);
          rows[r] = d.chance(0.5) ? rows[r].slice(0, d.int(rows[r].length)) : rows[r].replace(/./g, () => d.pick(['.', 'z', '9', ' ', 'c', '_', 'P', 'L']));
          level.pieces = rows;
        } else if (field === 'goals' && d.chance(0.5)) {
          level.goals = [d.pick(junk), { kind: 'color', color: 9, target: 3 }, { kind: 'lamp', target: -2 }];
        } else if (field === 'lamps' && d.chance(0.5)) {
          level.lamps = { total: d.pick(junk), maxOnBoard: d.pick(junk), everyMoves: d.pick(junk) };
        } else level[field] = d.pick(junk);
      }
      let game: Game;
      try {
        validateLevel(level as unknown as LevelDef);
        game = new Game(level as unknown as LevelDef, { seed: n });
        const s = game.snapshot();
        expect(Number.isFinite(s.movesLeft) && s.movesLeft >= 0).toBe(true);
        for (let k = 0; k < 6; k++) {
          const moves = game.validMoves();
          if (moves.length > 0) game.swap(moves[0].a, moves[0].b);
          game.useBooster('hammer', at(d.int(9), d.int(9)));
          game.useBooster('shuffle');
          game.hint();
          game.addMoves(1);
          game.endBonus();
        }
        const end = game.snapshot();
        expect(end.cells.length).toBe(end.cols * end.rows);
        expect(end.cols).toBeLessThanOrEqual(32);
        expect(end.rows).toBeLessThanOrEqual(32);
        expect(end.movesLeft).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(end.score)).toBe(true);
        expect(JSON.stringify(game.clone().snapshot())).toBe(JSON.stringify(end));
      } catch (e) {
        throw new Error(`level ${JSON.stringify(level)} threw: ${(e as Error).stack ?? String(e)}`);
      }
    }
  });
});

interface View {
  name: string;
  pos(p: Pos): Pos;
  kind(kind: PieceKind): PieceKind;
  /** The same position seen through the view, as a game of its own (start position kept as is). */
  build(s: Snapshot, level: LevelDef, seed: number): Game;
}

function viewOf(name: string, cols: (s: Snapshot) => number, rows: (s: Snapshot) => number, pos: (p: Pos) => Pos, kind: (kind: PieceKind) => PieceKind): View {
  return {
    name,
    pos,
    kind,
    build(s, level, seed) {
      const w = cols(s);
      const h = rows(s);
      const cells: (DebugPiece | null | undefined)[] = new Array<DebugPiece | null | undefined>(w * h).fill(undefined);
      const pieces: string[][] = [];
      const floor: string[][] = [];
      for (let r = 0; r < h; r++) {
        pieces.push(new Array<string>(w).fill('_'));
        floor.push(new Array<string>(w).fill('0'));
      }
      s.cells.forEach((cell, i) => {
        const to = pos(at(i % s.cols, Math.floor(i / s.cols)));
        if (!cell.exists) return;
        pieces[to.r][to.c] = '.';
        floor[to.r][to.c] = String(cell.sand);
        const p = cell.piece;
        cells[to.r * w + to.c] = p === null ? null : { kind: kind(p.kind), color: p.color, hp: p.hp, chained: p.chained };
      });
      const twin: LevelDef = { ...level, cols: w, rows: h, pieces: pieces.map((row) => row.join('')), floor: floor.map((row) => row.join('')) };
      return new Game(twin, { seed }, { cells, noStartShuffle: true });
    },
  };
}

const same = (kind: PieceKind): PieceKind => kind;
const mirrorView = (cols: number): View => viewOf('mirrored left-right', (s) => s.cols, (s) => s.rows, (p) => at(cols - 1 - p.c, p.r), same);
const transposeView = (): View =>
  viewOf('transposed', (s) => s.rows, (s) => s.cols, (p) => at(p.r, p.c), (kind) => (kind === 'beamH' ? 'beamV' : kind === 'beamV' ? 'beamH' : kind));

/**
 * Everything a turn does before its first fall, as order-free text: swap, waves (hits, created
 * specials, score) and effects (kind, centre, colour, targets). Positions and kinds go through
 * the given mappings. null when the turn contains a random transform.
 */
function firstWave(steps: readonly Step[], pos: (p: Pos) => Pos, kind: (kind: PieceKind) => PieceKind): string[] | null {
  const key = (p: Pos): string => {
    const q = pos(p);
    return `${q.c},${q.r}`;
  };
  const fxKind = (k: string): string => (k === 'beamH' || k === 'beamV' ? kind(k) : k);
  const out: string[] = [];
  for (const step of steps) {
    if (step.type === 'fall' || step.type === 'status' || step.type === 'grow' || step.type === 'shuffle') break;
    if (step.type === 'transform') return null;
    if (step.type === 'swap') out.push(`swap ${[key(step.a), key(step.b)].sort().join(' ')}`);
    else if (step.type === 'clear') {
      const hits = step.hits.map((h) => `${key(h.at)}:${h.cause}:${h.result}:${h.kind === null ? '-' : kind(h.kind)}:${h.color}:${h.hpLeft ?? ''}:${h.sandLeft ?? ''}`).sort();
      const made = step.created.map((m) => `${key(m.at)}:${kind(m.piece.kind)}:${m.piece.color}:${m.from.map(key).sort().join('+')}`).sort();
      out.push(`clear c${step.cascade} score ${step.score} hits ${hits.join(' ')} created ${made.join(' ')}`);
    } else if (step.type === 'activate') {
      out.push(`activate ${step.fx.map((f) => `${fxKind(f.kind)}@${key(f.at)}:${f.color}:${f.targets.map(key).sort().join('+')}`).sort().join(' | ')}`);
    }
  }
  return out;
}

/** A random board of anything: pre-existing matches, floating pieces, lamps on exits, empty cells. */
function soup(d: Dice, id: number): { level: LevelDef; cells: (DebugPiece | null | undefined)[] } {
  const cols = 3 + d.int(7);
  const rows = 3 + d.int(7);
  const colors = 3 + d.int(4);
  const pieces: string[] = [];
  const floor: string[] = [];
  const cells: (DebugPiece | null | undefined)[] = [];
  const holeChance = d.chance(0.5) ? 0 : 0.1;
  for (let r = 0; r < rows; r++) {
    let line = '';
    let sand = '';
    for (let c = 0; c < cols; c++) {
      if (d.chance(holeChance)) {
        line += '_';
        sand += '0';
        cells.push(undefined);
        continue;
      }
      line += '.';
      sand += d.chance(0.15) ? String(1 + d.int(2)) : '0';
      const roll = d.int(100);
      const color = d.int(colors) as Color;
      if (roll < 4) cells.push(null);
      else if (roll < 10) cells.push({ kind: 'stone', hp: 1 + d.int(3) });
      else if (roll < 14) cells.push({ kind: 'vine' });
      else if (roll < 17) cells.push({ kind: 'lamp' });
      else if (roll < 21) cells.push({ kind: 'prism' });
      else if (roll < 29) cells.push({ kind: d.pick(['beamH', 'beamV', 'nova'] as const), color, chained: d.chance(0.2) });
      else cells.push({ kind: 'gem', color, chained: d.chance(0.08) });
    }
    pieces.push(line);
    floor.push(sand);
  }
  const level: LevelDef = {
    id,
    cols,
    rows,
    colors,
    moves: 5 + d.int(20),
    pieces,
    floor,
    goals: d.pick<LevelDef['goals']>([[{ kind: 'score', target: 3000 }], [{ kind: 'sand' }], [{ kind: 'stone' }, { kind: 'vine' }], [{ kind: 'lamp', target: 2 }, { kind: 'chain' }], [{ kind: 'color', color: 0, target: 30 }]]),
    stars: [3000, 6000, 9000],
  };
  if (d.chance(0.4)) level.lamps = { total: 1 + d.int(4), maxOnBoard: 1 + d.int(2), everyMoves: d.int(3) };
  return { level, cells };
}
