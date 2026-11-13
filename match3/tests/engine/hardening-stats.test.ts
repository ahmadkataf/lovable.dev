/**
 * Hardening, part 4 — the engine's random choices and its speed.
 *
 * The Referee (./hardening-kit.ts) has to take the engine's random decisions from the transcript
 * (which colour dropped in, which way a piece slid, which gem became a beam …). It checks that
 * each one is legal; this file checks that they are also fair — spread the way the design
 * says "random" — and measures what a turn and a validMoves() call cost on a 9 × 9 board.
 */
import { describe, expect, it } from 'vitest';
import { Game } from '../../src/engine/index.ts';
import type { LevelDef, Piece, Step } from '../../src/engine/index.ts';
import { at, build, dice, posKey, stepsOf } from './hardening-kit.ts';

const open9: LevelDef = {
  id: 1,
  cols: 9,
  rows: 9,
  colors: 6,
  moves: 1_000_000,
  pieces: new Array<string>(9).fill('.........'),
  goals: [{ kind: 'score', target: 1e12 }],
  stars: [1e12, 2e12, 3e12],
};

/** Every share within `tolerance` (relative) of an even split. */
function expectEven(counts: number[], tolerance: number, what: string): void {
  const total = counts.reduce((a, b) => a + b, 0);
  const even = total / counts.length;
  counts.forEach((n, k) => {
    expect(Math.abs(n - even) / even, `${what}: share ${k} is ${n} of ${total} (even would be ${even.toFixed(0)})`).toBeLessThan(tolerance);
  });
}

describe('randomness is fair', () => {
  it('refill colours are uniform over the level\'s colours (and only those)', () => {
    for (const colors of [3, 4, 5, 6]) {
      const counts = new Array<number>(colors).fill(0);
      for (let seed = 1; seed <= 6; seed++) {
        const game = new Game({ ...open9, colors }, { seed });
        const bot = dice(seed);
        for (let n = 0; n < 250; n++) {
          const move = bot.pick(game.validMoves());
          const res = game.swap(move.a, move.b);
          let cascade = 1;
          for (const step of res.steps) {
            if (step.type === 'clear') cascade = step.cascade;
            if (step.type !== 'fall') continue;
            for (const s of step.spawns) {
              if (s.piece.kind !== 'gem' || !(s.piece.color >= 0 && s.piece.color < colors)) throw new Error(`a ${s.piece.kind} of colour ${s.piece.color} dropped in`);
              // from cascade 8 on the refill deliberately avoids matches: not part of this sample
              if (cascade < 8) counts[s.piece.color]++;
            }
          }
        }
      }
      expect(counts.reduce((a, b) => a + b, 0)).toBeGreaterThan(5000);
      expectEven(counts, 0.08, `${colors} colours`);
    }
  }, 60_000);

  it('the level-start fill uses every colour about equally and differs from seed to seed', () => {
    const counts = [0, 0, 0, 0, 0, 0];
    const boards = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const s = new Game(open9, { seed }).snapshot();
      boards.add(s.cells.map((cell) => (cell.piece as Piece).color).join(''));
      for (const cell of s.cells) counts[(cell.piece as Piece).color]++;
    }
    expect(boards.size).toBe(200);
    expectEven(counts, 0.05, 'start fill');
  });

  it('long turns end: on a three-colour 9 × 9 board no turn runs away', () => {
    let longest = 0;
    let deepest = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const game = new Game({ ...open9, colors: 3 }, { seed });
      const bot = dice(seed);
      for (let n = 0; n < 300; n++) {
        const move = bot.pick(game.validMoves());
        const res = game.swap(move.a, move.b);
        longest = Math.max(longest, res.steps.length);
        for (const step of res.steps) if (step.type === 'clear') deepest = Math.max(deepest, step.cascade);
        if (game.snapshot().status !== 'playing') throw new Error('the endless level ended');
      }
    }
    // the calm-refill valve (cascade 8+) is reached but keeps cascades short
    expect(deepest).toBeGreaterThanOrEqual(9);
    expect(deepest).toBeLessThan(40);
    expect(longest).toBeLessThan(150);
  }, 60_000);

  it('prism + beam turns gems into beams of both orientations; so does the end bonus', () => {
    const kinds = { beamH: 0, beamV: 0 };
    for (let seed = 1; seed <= 30; seed++) {
      const game = build(['~  ~  ~  ~  ~  ~', '~  P  A| ~  ~  ~', '~  ~  ~  ~  ~  ~', '~  ~  ~  ~  ~  ~', '~  ~  ~  ~  ~  ~', '~  ~  ~  ~  ~  ~'], { seed });
      const res = game.swap(at(1, 1), at(2, 1));
      const tr = stepsOf(res.steps, 'transform')[0];
      expect(tr.changes.length).toBe(11); // the background has twelve A cells; one of them holds the A beam itself
      for (const ch of tr.changes) kinds[ch.piece.kind as 'beamH' | 'beamV']++;
    }
    expectEven([kinds.beamH, kinds.beamV], 0.25, 'prism + beam orientation');

    const bonus = { beamH: 0, beamV: 0 };
    const cells = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const game = build(['~  ~  D  ~  ~', 'D  D  ~  ~  ~', '~  S1 ~  ~  ~', '~  ~  ~  ~  ~', '~  ~  ~  ~  ~'], { seed, goals: [{ kind: 'stone' }], moves: 6 });
      expect(game.swap(at(2, 0), at(2, 1)).snapshot.status).toBe('won');
      const tr = game.endBonus().steps[0] as Extract<Step, { type: 'transform' }>;
      expect(tr.changes.length).toBe(5);
      for (const ch of tr.changes) {
        bonus[ch.piece.kind as 'beamH' | 'beamV']++;
        cells.add(posKey(ch.at));
      }
    }
    expectEven([bonus.beamH, bonus.beamV], 0.3, 'end bonus orientation');
    // "a random plain gem": over 40 games the beams land all over the board
    expect(cells.size).toBeGreaterThan(18);
  });

  it('start boosters land on different gems from seed to seed', () => {
    const level: LevelDef = { ...open9, moves: 20 };
    const prisms = new Set<number>();
    const novas = new Set<number>();
    const beams = { beamH: 0, beamV: 0 };
    for (let seed = 1; seed <= 150; seed++) {
      const s = new Game(level, { seed, boosters: { prism: true, beamNova: true } }).snapshot();
      s.cells.forEach((cell, i) => {
        const p = cell.piece as Piece;
        if (p.kind === 'prism') prisms.add(i);
        if (p.kind === 'nova') novas.add(i);
        if (p.kind === 'beamH' || p.kind === 'beamV') beams[p.kind]++;
      });
    }
    expect(prisms.size).toBeGreaterThan(50);
    expect(novas.size).toBeGreaterThan(50);
    expectEven([beams.beamH, beams.beamV], 0.3, 'start beam orientation');
  });

  it('spawned lamps use every gap-free column', () => {
    const level: LevelDef = { ...open9, cols: 6, rows: 6, colors: 5, pieces: new Array<string>(6).fill('......'), goals: [{ kind: 'lamp', target: 999 }], lamps: { total: 999, maxOnBoard: 2, everyMoves: 0 }, moves: 100000 };
    const columns = [0, 0, 0, 0, 0, 0];
    for (let seed = 1; seed <= 5; seed++) {
      const game = new Game(level, { seed });
      const bot = dice(seed);
      for (let n = 0; n < 200; n++) {
        const move = bot.pick(game.validMoves());
        for (const fall of stepsOf(game.swap(move.a, move.b).steps, 'fall')) for (const s of fall.spawns) if (s.piece.kind === 'lamp') columns[s.from.c]++;
      }
    }
    expect(columns.reduce((a, b) => a + b, 0)).toBeGreaterThan(60);
    for (const n of columns) expect(n, `lamps per column: ${columns.join(' ')}`).toBeGreaterThan(4);
  });

  it('the shuffle booster gives a different arrangement for each seed', () => {
    const rows = new Array<string>(6).fill('?  ?  ?  ?  ?  ?');
    const results = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const game = build(rows, { seed: 7, startShuffle: true, colors: 5 });
      // same start board every time; the shuffles differ because the games are at different points of their random sequence
      for (let k = 0; k < seed % 5; k++) game.useBooster('shuffle');
      const before = JSON.stringify(game.snapshot().cells);
      const res = game.useBooster('shuffle');
      expect(res.accepted).toBe(true);
      expect(JSON.stringify(res.snapshot.cells)).not.toBe(before);
      results.add(JSON.stringify(res.snapshot.cells.map((cell) => (cell.piece as Piece).id)));
    }
    expect(results.size).toBeGreaterThanOrEqual(5);
  });
});

describe('speed on a 9 × 9 board', () => {
  function measure(level: LevelDef, turns: number): { turn: number; validMoves: number; hint: number; snapshot: number; clone: number; steps: number } {
    let seed = 2024;
    let game = new Game(level, { seed });
    const bot = dice(1);
    // a game can end (vines may overrun the board): then the measurement continues on a fresh one
    const alive = (): void => {
      if (game.snapshot().status !== 'playing') game = new Game(level, { seed: ++seed });
    };
    for (let k = 0; k < 300; k++) {
      alive();
      const m = bot.pick(game.validMoves());
      game.swap(m.a, m.b);
    }
    let tTurn = 0;
    let tValid = 0;
    let tHint = 0;
    let tSnap = 0;
    let tClone = 0;
    let steps = 0;
    for (let k = 0; k < turns; k++) {
      alive();
      let t0 = performance.now();
      const moves = game.validMoves();
      tValid += performance.now() - t0;
      t0 = performance.now();
      game.hint();
      tHint += performance.now() - t0;
      t0 = performance.now();
      game.snapshot();
      tSnap += performance.now() - t0;
      t0 = performance.now();
      game.clone();
      tClone += performance.now() - t0;
      const m = bot.pick(moves);
      t0 = performance.now();
      const res = game.swap(m.a, m.b);
      tTurn += performance.now() - t0;
      steps += res.steps.length;
    }
    return { turn: tTurn / turns, validMoves: tValid / turns, hint: tHint / turns, snapshot: tSnap / turns, clone: tClone / turns, steps: steps / turns };
  }

  it('a turn averages far below 0.5 ms and validMoves() far below 0.1 ms', () => {
    const blockers: LevelDef = {
      ...open9,
      colors: 5,
      pieces: ['.........', '.c..2..c.', '....v....', '..__.__..', '.........', '.1.....1.', '...vvv...', '.........', '.........'],
      floor: new Array<string>(9).fill('111111111'),
    };
    const cases: [string, LevelDef, number][] = [
      ['6 colours', open9, 3000],
      ['5 colours', { ...open9, colors: 5 }, 3000],
      ['4 colours', { ...open9, colors: 4 }, 3000],
      ['3 colours (long cascades)', { ...open9, colors: 3 }, 1500],
      ['5 colours with blockers, holes and sand', blockers, 2000],
    ];
    const lines: string[] = [];
    for (const [name, level, turns] of cases) {
      // best of three runs: a busy machine must not fail the test
      let best = measure(level, turns);
      for (let rep = 0; rep < 2; rep++) {
        const again = measure(level, turns);
        if (again.turn < best.turn) best = again;
      }
      lines.push(
        `  ${name.padEnd(40)} turn ${best.turn.toFixed(4)} ms · validMoves ${best.validMoves.toFixed(4)} ms · hint ${best.hint.toFixed(4)} ms · snapshot ${best.snapshot.toFixed(4)} ms · clone ${best.clone.toFixed(4)} ms · ${best.steps.toFixed(1)} steps/turn`,
      );
      expect(best.turn, `${name}: ms per turn`).toBeLessThan(0.5);
      expect(best.validMoves, `${name}: ms per validMoves()`).toBeLessThan(0.1);
      expect(best.hint, `${name}: ms per hint()`).toBeLessThan(0.2);
    }
    console.log(`engine speed, 9 × 9 (average per call):\n${lines.join('\n')}`);
  }, 120_000);
});
