/**
 * Chapter 2 — Dunes (levels 21–40). Lamps arrive (21) and chains (31).
 * Waves of five: normal, normal, build-up, spike, breather; level 39 is the first one marked hard.
 *
 * Layouts, colours and goals are designed by hand. `moves` and `stars` (and the target of a
 * score-only level) are fitted by `node tools/levelgen/tune.ts` — change a layout, then run the
 * tuner again. The comment above each level is its brief: tier, idea, intended feel.
 * Piece / floor notation: see `LevelDef` in src/engine/types.ts.
 */
import type { LevelDef } from '../../engine/types.ts';

export const CHAPTER_2: readonly LevelDef[] = [
  // [tutorial] Two lamps: the first lamps wait at the top — clear the cells beneath them. Four colours keep it gentle.
  {
    id: 21, cols: 7, rows: 7, colors: 4, moves: 15,
    tutorial: 'lamp',
    pieces: [
      '..L.L..',
      '.......',
      '.......',
      '.......',
      '.......',
      '.......',
      '.......',
    ],
    goals: [{ kind: 'lamp', target: 2 }],
    stars: [5700, 15200, 22200],
  },
  // [normal] The caravan: lamps arrive one after another; the outer columns end sooner.
  {
    id: 22, cols: 7, rows: 6, colors: 4, moves: 15,
    pieces: [
      '.......',
      '.......',
      '.......',
      '.......',
      '_....._',
      '__...__',
    ],
    goals: [{ kind: 'lamp', target: 3 }],
    lamps: { total: 3, maxOnBoard: 3, everyMoves: 1 },
    stars: [5000, 10100, 15200],
  },
  // [build-up] Wet sand: two lamps must cross a belt of sand that has to go as well.
  {
    id: 23, cols: 8, rows: 8, colors: 5, moves: 24,
    pieces: [
      '..L..L..',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
    ],
    floor: [
      '00000000',
      '00000000',
      '00000000',
      '00000000',
      '11111111',
      '11111111',
      '00000000',
      '00000000',
    ],
    goals: [
      { kind: 'lamp', target: 2 },
      { kind: 'sand' },
    ],
    stars: [8000, 14600, 19900],
  },
  // [spike] Quicksand: a checkerboard of deep sand over the whole board.
  {
    id: 24, cols: 7, rows: 7, colors: 5, moves: 26,
    pieces: [
      '.......',
      '.......',
      '.......',
      '.......',
      '.......',
      '.......',
      '.......',
    ],
    floor: [
      '2020202',
      '0202020',
      '2020202',
      '0202020',
      '2020202',
      '0202020',
      '2020202',
    ],
    goals: [{ kind: 'sand' }],
    stars: [7900, 13400, 16900],
  },
  // [breather] The crest: a wide lozenge of a board, two colours to gather.
  {
    id: 25, cols: 9, rows: 9, colors: 5, moves: 19,
    pieces: [
      '__.....__',
      '_......._',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '_......._',
      '__.....__',
    ],
    goals: [
      { kind: 'color', color: 1, target: 34 },
      { kind: 'color', color: 4, target: 34 },
    ],
    stars: [5700, 11600, 16700],
  },
  // [normal] The ridge: a stone staircase runs down the dune.
  {
    id: 26, cols: 8, rows: 8, colors: 5, moves: 18,
    pieces: [
      '........',
      '........',
      '22......',
      '..22....',
      '....22..',
      '......22',
      '........',
      '........',
    ],
    goals: [
      { kind: 'stone' },
      { kind: 'color', color: 3, target: 24 },
    ],
    stars: [4300, 10000, 14600],
  },
  // [normal] Sealed shafts: stone lids lie across both lamps' columns.
  {
    id: 27, cols: 7, rows: 7, colors: 5, moves: 25,
    pieces: [
      '..L.L..',
      '.......',
      '.......',
      '.22.22.',
      '.......',
      '.......',
      '.......',
    ],
    goals: [{ kind: 'lamp', target: 2 }],
    stars: [6000, 10600, 14600],
  },
  // [build-up] Six colours: a broad cross of a board and a sixth gem — points only.
  {
    id: 28, cols: 8, rows: 8, colors: 6, moves: 22,
    pieces: [
      '__....__',
      '__....__',
      '........',
      '........',
      '........',
      '........',
      '__....__',
      '__....__',
    ],
    goals: [{ kind: 'score', target: 2900 }],
    stars: [2900, 4300, 5700],
  },
  // [spike] The sunken road: lamps above stones, deep sand at the bottom.
  {
    id: 29, cols: 8, rows: 8, colors: 5, moves: 18,
    pieces: [
      '.L....L.',
      '........',
      '........',
      '.2....2.',
      '........',
      '........',
      '........',
      '........',
    ],
    floor: [
      '00000000',
      '00000000',
      '00000000',
      '00000000',
      '00000000',
      '02222220',
      '02222220',
      '02222220',
    ],
    goals: [
      { kind: 'lamp', target: 2 },
      { kind: 'sand' },
    ],
    stars: [7500, 14300, 19000],
  },
  // [breather] The ring road: a tall board around a gap, sand along the gap's edge, deep at the corners.
  {
    id: 30, cols: 8, rows: 9, colors: 5, moves: 19,
    pieces: [
      '........',
      '........',
      '........',
      '...__...',
      '...__...',
      '...__...',
      '........',
      '........',
      '........',
    ],
    floor: [
      '00000000',
      '00000000',
      '00211200',
      '00100100',
      '00100100',
      '00100100',
      '00211200',
      '00000000',
      '00000000',
    ],
    goals: [{ kind: 'sand' }],
    stars: [4300, 8500, 13100],
  },
  // [tutorial] Shackles: the first chained gems — match them to set them free.
  {
    id: 31, cols: 7, rows: 7, colors: 5, moves: 27,
    tutorial: 'chain',
    pieces: [
      '.......',
      '.......',
      '.c.c.c.',
      '.......',
      '.c.c.c.',
      '.......',
      '.......',
    ],
    goals: [{ kind: 'chain' }],
    stars: [5100, 9500, 12800],
  },
  // [normal] The guarded pool: chained gems stand around a pool of sand.
  {
    id: 32, cols: 8, rows: 8, colors: 5, moves: 20,
    pieces: [
      '........',
      '........',
      '..cccc..',
      '..c..c..',
      '..c..c..',
      '..cccc..',
      '........',
      '........',
    ],
    floor: [
      '00000000',
      '00000000',
      '00111100',
      '00122100',
      '00122100',
      '00111100',
      '00000000',
      '00000000',
    ],
    goals: [
      { kind: 'sand' },
      { kind: 'chain' },
    ],
    stars: [4900, 10800, 16100],
  },
  // [build-up] The shackled floor: chains along the bottom, where nothing moves by itself.
  {
    id: 33, cols: 8, rows: 8, colors: 5, moves: 31,
    pieces: [
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '..c..c..',
      'c..cc..c',
    ],
    goals: [
      { kind: 'chain' },
      { kind: 'color', color: 0, target: 24 },
    ],
    stars: [8900, 15900, 21400],
  },
  // [spike] Locked shafts: each lamp rests on a chained gem that has to be freed first.
  {
    id: 34, cols: 7, rows: 7, colors: 5, moves: 36,
    pieces: [
      '.L...L.',
      '.c...c.',
      '.......',
      '.......',
      '.......',
      '.......',
      '.......',
    ],
    goals: [{ kind: 'lamp', target: 2 }],
    stars: [8700, 13800, 17500],
  },
  // [breather] The strongbox: a prism locked behind stone — break in and use it.
  {
    id: 35, cols: 7, rows: 7, colors: 5, moves: 22,
    pieces: [
      '.......',
      '.......',
      '..222..',
      '..2P2..',
      '..222..',
      '.......',
      '.......',
    ],
    goals: [
      { kind: 'stone' },
      { kind: 'score', target: 6000 },
    ],
    stars: [6200, 10000, 13200],
  },
  // [normal] Chain mail: stones and chains woven into two rows.
  {
    id: 36, cols: 8, rows: 8, colors: 5, moves: 18,
    pieces: [
      '........',
      '........',
      '........',
      '.2c2c2c.',
      '.c2c2c2.',
      '........',
      '........',
      '........',
    ],
    goals: [
      { kind: 'stone' },
      { kind: 'chain' },
    ],
    stars: [3800, 8800, 14200],
  },
  // [normal] Terraces: the floor climbs to the left, so some columns are a much shorter way down.
  {
    id: 37, cols: 8, rows: 7, colors: 5, moves: 37,
    pieces: [
      '........',
      '........',
      '........',
      '_.......',
      '__......',
      '___.....',
      '____....',
    ],
    goals: [{ kind: 'lamp', target: 3 }],
    lamps: { total: 3, maxOnBoard: 3, everyMoves: 1 },
    stars: [8700, 13600, 17000],
  },
  // [build-up] The sand timer: lamps fall through the neck of an hourglass into a sandy bulb.
  {
    id: 38, cols: 7, rows: 8, colors: 5, moves: 32,
    pieces: [
      '.......',
      '.......',
      '_....._',
      '__...__',
      '_....._',
      '.......',
      '.......',
      '.......',
    ],
    floor: [
      '0000000',
      '0000000',
      '0000000',
      '0000000',
      '0000000',
      '0000000',
      '0111110',
      '0111110',
    ],
    goals: [
      { kind: 'lamp', target: 2 },
      { kind: 'sand' },
    ],
    lamps: { total: 2, maxOnBoard: 1, everyMoves: 2 },
    stars: [7500, 12800, 16300],
  },
  // [hard] The great dune: three lamps behind chains, and a dune of deep sand to clear.
  {
    id: 39, cols: 9, rows: 9, colors: 5, moves: 21,
    hard: true,
    pieces: [
      '.L..L..L.',
      '.........',
      '.c..c..c.',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
    ],
    floor: [
      '000000000',
      '000000000',
      '000000000',
      '000000000',
      '000010000',
      '000121000',
      '001222100',
      '012222210',
      '122222221',
    ],
    goals: [
      { kind: 'lamp', target: 3 },
      { kind: 'sand' },
    ],
    stars: [11100, 22100, 29400],
  },
  // [breather] Market colours: three colours out of six, with a few obstacles in the way.
  {
    id: 40, cols: 8, rows: 8, colors: 6, moves: 24,
    pieces: [
      '........',
      '.c....c.',
      '........',
      '...22...',
      '...22...',
      '........',
      '.c....c.',
      '........',
    ],
    goals: [
      { kind: 'color', color: 0, target: 18 },
      { kind: 'color', color: 2, target: 18 },
      { kind: 'color', color: 5, target: 18 },
    ],
    stars: [3700, 7400, 10500],
  },
];
