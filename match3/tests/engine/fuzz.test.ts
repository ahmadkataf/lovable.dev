import { describe, expect, it } from 'vitest';
import { createRng, validateLevel, type LevelDef, type Snapshot, type TurnResult } from '../../src/engine/index.ts';
import { checkTurn, playRandomGame, randomLevel, type Action } from './helpers.ts';

// Property / fuzz suite: about a thousand complete games on generated levels (every blocker type,
// several hole shapes, 3..6 colours, start boosters), played by a seeded bot that also uses
// boosters, makes illegal calls, continues after losing and takes the end bonus.
//
// After EVERY engine call `checkTurn` (helpers.ts) asserts, against reference implementations
// that share no code with the engine:
//   - replaying the Step transcript on the previous snapshot gives exactly the new cells, score, status
//   - no match is left on the settled board, nothing is left to fall, no lamp rests on an exit
//   - while 'playing' a valid move exists, and validMoves()/hint()/canSwap agree with §2.2
//   - piece ids are unique, no piece sits in a hole, the board structure never changes
//   - movesLeft / score / stars / every goal counter are consistent, monotonic and never negative
//   - step grammar: cascade numbers, per-wave scores recomputed from the hits, popups, spawn origins
// Everything is seeded, so a failure reproduces exactly.

const stats: Record<string, number> = {};
const bump = (key: string, by = 1): void => {
  stats[key] = (stats[key] ?? 0) + by;
};

function describeLevel(level: LevelDef): void {
  const text = level.pieces.join('');
  bump(`colors:${level.colors}`);
  if (text.includes('_')) bump('level:holes');
  if (/[123]/.test(text)) bump('level:stones');
  if (text.includes('c')) bump('level:chains');
  if (text.includes('v')) bump('level:vines');
  if (text.includes('L') || level.lamps) bump('level:lamps');
  if (/[HVNP]/.test(text)) bump('level:specials');
  if (level.floor) bump('level:sand');
  for (const goal of level.goals) bump(`goal:${goal.kind}`);
  // hole shapes: missing column tops, missing column bottoms, gaps inside a column
  for (let c = 0; c < level.cols; c++) {
    const column = level.pieces.map((row) => row.charAt(c) !== '_');
    const first = column.indexOf(true);
    const last = column.lastIndexOf(true);
    if (first > 0) bump('shape:topMissing');
    if (last >= 0 && last < level.rows - 1) bump('shape:bottomMissing');
    if (first >= 0 && column.slice(first, last + 1).includes(false)) bump('shape:gapInColumn');
  }
}

function observe(before: Snapshot, res: TurnResult, action: Action): void {
  bump(`${res.accepted ? 'accepted' : 'rejected'}:${action}`);
  for (const step of res.steps) {
    bump(`step:${step.type}`);
    if (step.type === 'activate') for (const fx of step.fx) bump(`fx:${fx.kind}`);
    if (step.type === 'clear') {
      for (const hit of step.hits) bump(`hit:${hit.cause}:${hit.result}`);
      for (const made of step.created) bump(`created:${made.piece.kind}`);
    }
    if (step.type === 'booster') bump(`booster:${step.booster}`);
    if (step.type === 'fall') {
      if (step.moves.some((m) => m.from.c !== m.to.c) || step.spawns.some((s) => s.from.c !== s.to.c)) bump('diagonalFeed');
      if (step.spawns.some((s) => s.piece.kind === 'lamp')) bump('lampSpawn');
    }
  }
  if (before.status === 'playing' && res.snapshot.status === 'lost' && res.snapshot.movesLeft > 0) bump('deadBoard');
}

function run(level: LevelDef, seed: number, botSeed: number): void {
  try {
    const out = playRandomGame(level, seed, botSeed, {
      onTurn: (game, before, res, action, tally) => {
        checkTurn(game, before, res, action, tally);
        observe(before, res, action);
      },
    });
    bump('games');
    bump('turns', out.turns);
    bump(`end:${out.game.snapshot().status}`);
  } catch (e) {
    throw new Error(`fuzz game failed — seed ${seed}, bot ${botSeed}, level ${JSON.stringify(level)}\n${(e as Error).message}`);
  }
}

describe('fuzz: complete random games', () => {
  it('valid generated levels: every turn of 700 games satisfies every invariant', () => {
    const rng = createRng(20240611);
    let made = 0;
    for (let attempt = 0; made < 700 && attempt < 9000; attempt++) {
      const level = randomLevel(rng, attempt + 1);
      if (validateLevel(level).length > 0) {
        bump('generator:rejected');
        continue;
      }
      describeLevel(level);
      run(level, 9000 + attempt, 31 * attempt + 5);
      made++;
    }
    expect(made).toBe(700);
  }, 300_000);

  it('levels the validator would reject still play consistently (330 games, never a hang)', () => {
    // Raw generator output plus deliberately awkward boards: unreachable pockets, lamps that can
    // get stuck, tiny boards, boards that are mostly blockers. The engine may end such a game
    // early as 'lost' (no move can ever exist) but must stay consistent.
    const rng = createRng(77);
    for (let n = 0; n < 300; n++) run(randomLevel(rng, n + 1), 400 + n, 17 * n + 3);
    const awkward: LevelDef[] = [];
    const base = { id: 1, moves: 12, goals: [{ kind: 'score' as const, target: 100 }], stars: [100, 200, 300] as [number, number, number] };
    awkward.push({ ...base, cols: 3, rows: 3, colors: 3, pieces: ['...', '__.', '...'] });
    awkward.push({ ...base, cols: 1, rows: 5, colors: 3, pieces: ['.', '.', '.', '.', '.'] });
    awkward.push({ ...base, cols: 5, rows: 1, colors: 4, pieces: ['.....'] });
    awkward.push({ ...base, cols: 2, rows: 2, colors: 3, pieces: ['..', '..'] });
    awkward.push({ ...base, cols: 5, rows: 5, colors: 3, pieces: ['33333', '3...3', '3.v.3', '3...3', '33333'] });
    awkward.push({ ...base, cols: 5, rows: 5, colors: 6, pieces: ['.v.v.', 'v.v.v', '.v.v.', 'v.v.v', '.v.v.'] });
    awkward.push({ ...base, cols: 6, rows: 6, colors: 3, pieces: ['L.L.L.', '......', '__..__', '......', 'cccccc', '......'], goals: [{ kind: 'lamp', target: 3 }], lamps: { total: 9, maxOnBoard: 5, everyMoves: 0 } });
    awkward.push({ ...base, cols: 6, rows: 6, colors: 4, pieces: ['PPPPPP', 'HVHVHV', 'NNNNNN', '......', 'cccccc', '123123'] });
    awkward.push({ ...base, cols: 4, rows: 4, colors: 3, pieces: ['aaa.', 'bbb.', '....', '....'] }); // starts with matches
    awkward.push({ ...base, cols: 7, rows: 7, colors: 3, pieces: ['.......', '.vvvvv.', '.v...v.', '.v.L.v.', '.v...v.', '.vvvvv.', '.......'], goals: [{ kind: 'vine' }] });
    let n = 0;
    for (const level of awkward) for (let k = 0; k < 3; k++) run(level, 700 + n, 900 + n++);
    expect(stats['games']).toBe(700 + 300 + awkward.length * 3);
  }, 300_000);

  it('determinism: the same seed gives byte-identical steps, another seed another game', () => {
    const rng = createRng(4711);
    let different = 0;
    const total = 40;
    for (let n = 0; n < total; n++) {
      const level = randomLevel(rng, n + 1);
      const a = playRandomGame(level, 5000 + n, n);
      const b = playRandomGame(level, 5000 + n, n);
      expect(a.transcript).toBe(b.transcript);
      expect(JSON.stringify(a.game.snapshot())).toBe(JSON.stringify(b.game.snapshot()));
      if (playRandomGame(level, 6000 + n, n).transcript !== a.transcript) different++;
    }
    expect(different).toBeGreaterThan(total * 0.9);
  }, 300_000);

  it('the games above really exercised the whole engine', () => {
    const need = [
      'colors:3', 'colors:4', 'colors:5', 'colors:6',
      'level:holes', 'level:stones', 'level:chains', 'level:vines', 'level:lamps', 'level:specials', 'level:sand',
      'shape:topMissing', 'shape:bottomMissing', 'shape:gapInColumn',
      'goal:score', 'goal:color', 'goal:sand', 'goal:lamp', 'goal:stone', 'goal:vine', 'goal:chain',
      'step:swap', 'step:activate', 'step:clear', 'step:fall', 'step:collect', 'step:transform', 'step:grow', 'step:shuffle', 'step:booster', 'step:status',
      'fx:beamH', 'fx:beamV', 'fx:nova', 'fx:prism', 'fx:cross', 'fx:bigCross',
      'created:beamH', 'created:beamV', 'created:nova', 'created:prism',
      'hit:match:removed', 'hit:match:activated', 'hit:match:unchained', 'hit:adjacent:damaged', 'hit:adjacent:removed',
      'hit:blast:removed', 'hit:blast:activated', 'hit:blast:damaged', 'hit:blast:unchained', 'hit:blast:none', 'hit:booster:removed',
      'booster:hammer', 'booster:freeSwap', 'booster:shuffle',
      'accepted:swap', 'accepted:booster', 'accepted:addMoves', 'accepted:endBonus',
      'rejected:swap', 'rejected:booster', 'rejected:addMoves', 'rejected:endBonus',
      'end:won', 'end:lost', 'diagonalFeed', 'lampSpawn', 'deadBoard',
    ];
    const missing = need.filter((key) => !stats[key]);
    expect(missing, `never happened: ${missing.join(', ')}`).toEqual([]);
    expect(stats['turns']).toBeGreaterThan(15000);
    expect(stats['end:won']).toBeGreaterThan(200);
    expect(stats['end:lost']).toBeGreaterThan(200);
  });
});
