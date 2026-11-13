/**
 * Chapter 3 — Bazaar (levels 41–60). Vines arrive (41) and everything starts to mix.
 * Hard levels: 49 and 59, each followed by a breather.
 *
 * Layouts, colours and goals are designed by hand. `moves` and `stars` (and the target of a
 * score-only level) are fitted by `node tools/levelgen/tune.ts` — change a layout, then run the
 * tuner again. The comment above each level is its brief: tier, idea, intended feel.
 * Piece / floor notation: see `LevelDef` in src/engine/types.ts.
 */
import type { LevelDef } from '../../engine/types.ts';

export const CHAPTER_3: readonly LevelDef[] = [
  // [tutorial] First shoots: two hedges of vines — match next to them before they spread.
  {
    id: 41, cols: 8, rows: 8, colors: 5, moves: 11,
    tutorial: 'vine',
    pieces: [
      '........',
      '........',
      '.vvvvvv.',
      '........',
      '........',
      '.vvvvvv.',
      '........',
      '........',
    ],
    goals: [{ kind: 'vine' }],
    stars: [2100, 6400, 10300],
  },
  // [normal] The creeper: one long vine down the middle of a wide board.
  {
    id: 42, cols: 9, rows: 8, colors: 5, moves: 19,
    pieces: [
      '.........',
      '....v....',
      '....v....',
      '....v....',
      '....v....',
      '....v....',
      '....v....',
      '.........',
    ],
    goals: [
      { kind: 'vine' },
      { kind: 'color', color: 1, target: 44 },
    ],
    stars: [6600, 13100, 18800],
  },
  // [build-up] The overgrown path: a winding trail of sand, deep in the middle stretch, vines at its bends.
  {
    id: 43, cols: 8, rows: 8, colors: 5, moves: 14,
    pieces: [
      '........',
      '.v......',
      '......v.',
      '........',
      '.v......',
      '......v.',
      '........',
      '........',
    ],
    floor: [
      '00000000',
      '01111110',
      '00000010',
      '02222220',
      '01000000',
      '01111110',
      '00000000',
      '00000000',
    ],
    goals: [
      { kind: 'sand' },
      { kind: 'vine' },
    ],
    stars: [4100, 9100, 14200],
  },
  // [spike] Lantern vines: a hedge grows right under the two lamps.
  {
    id: 44, cols: 7, rows: 7, colors: 5, moves: 17,
    pieces: [
      '..L.L..',
      '.......',
      '.......',
      '..vvv..',
      '.......',
      '.......',
      '.......',
    ],
    goals: [
      { kind: 'lamp', target: 2 },
      { kind: 'vine' },
    ],
    stars: [4100, 8100, 11100],
  },
  // [breather] Four pillars: a big six-colour board with four gaps; three colours to gather.
  {
    id: 45, cols: 9, rows: 9, colors: 6, moves: 29,
    pieces: [
      '.........',
      '.........',
      '.._..._..',
      '.........',
      '.........',
      '.........',
      '.._..._..',
      '.........',
      '.........',
    ],
    goals: [
      { kind: 'color', color: 0, target: 24 },
      { kind: 'color', color: 1, target: 24 },
      { kind: 'color', color: 3, target: 24 },
    ],
    stars: [4000, 8400, 11400],
  },
  // [normal] Tangled locks: chains above and below, vines creeping in from both sides.
  {
    id: 46, cols: 8, rows: 8, colors: 5, moves: 24,
    pieces: [
      '........',
      'cc.cc.cc',
      '........',
      'v......v',
      'v......v',
      '........',
      'cc.cc.cc',
      '........',
    ],
    goals: [
      { kind: 'chain' },
      { kind: 'vine' },
    ],
    stars: [6100, 12900, 17700],
  },
  // [normal] The lamp market: three lamps come in together; a broken row of stones bars the way.
  {
    id: 47, cols: 8, rows: 7, colors: 5, moves: 26,
    pieces: [
      '........',
      '........',
      '........',
      '11.11.11',
      '........',
      '........',
      '........',
    ],
    goals: [{ kind: 'lamp', target: 3 }],
    lamps: { total: 3, maxOnBoard: 3, everyMoves: 1 },
    stars: [7100, 12900, 17900],
  },
  // [build-up] The lattice: two deep lanes crossed by two shallow rows of sand.
  {
    id: 48, cols: 8, rows: 8, colors: 5, moves: 22,
    pieces: [
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
    ],
    floor: [
      '00200200',
      '00200200',
      '11211211',
      '00200200',
      '00200200',
      '11211211',
      '00200200',
      '00200200',
    ],
    goals: [{ kind: 'sand' }],
    stars: [7200, 13400, 19300],
  },
  // [hard] The choked fountain: vines over a deep pool with a shallow rim, chains at its corners; six colours.
  {
    id: 49, cols: 8, rows: 8, colors: 6, moves: 24,
    hard: true,
    pieces: [
      '........',
      '........',
      '..c..c..',
      '...vv...',
      '...vv...',
      '..c..c..',
      '........',
      '........',
    ],
    floor: [
      '00000000',
      '01111110',
      '01222210',
      '01222210',
      '01222210',
      '01222210',
      '01111110',
      '00000000',
    ],
    goals: [
      { kind: 'sand' },
      { kind: 'vine' },
    ],
    stars: [6100, 9900, 12400],
  },
  // [breather] Lantern row: a breather — three specials are already hanging there. Points only.
  {
    id: 50, cols: 8, rows: 8, colors: 6, moves: 20,
    pieces: [
      '........',
      '........',
      '........',
      '.V....V.',
      '....N...',
      '........',
      '........',
      '........',
    ],
    goals: [{ kind: 'score', target: 4350 }],
    stars: [4350, 6400, 8800],
  },
  // [normal] The arcade: two stone arches, thick on top.
  {
    id: 51, cols: 9, rows: 8, colors: 6, moves: 22,
    pieces: [
      '.........',
      '.........',
      '.222.222.',
      '.1.1.1.1.',
      '.1.1.1.1.',
      '.........',
      '.........',
      '.........',
    ],
    goals: [
      { kind: 'stone' },
      { kind: 'color', color: 4, target: 20 },
    ],
    stars: [3700, 7100, 9900],
  },
  // [normal] Thorn guard: vines on both walls close in while two lamps come down the middle.
  {
    id: 52, cols: 8, rows: 7, colors: 5, moves: 25,
    pieces: [
      '........',
      '........',
      'v......v',
      'v......v',
      'v......v',
      '........',
      '........',
    ],
    goals: [
      { kind: 'lamp', target: 2 },
      { kind: 'vine' },
    ],
    lamps: { total: 2, maxOnBoard: 2, everyMoves: 1 },
    stars: [6400, 12200, 16500],
  },
  // [build-up] Two courtyards: a wall splits the board — stones on the left, sand on the right.
  {
    id: 53, cols: 9, rows: 8, colors: 5, moves: 15,
    pieces: [
      '...._....',
      '.11._....',
      '.11._....',
      '.11._....',
      '.11._....',
      '.........',
      '.........',
      '.........',
    ],
    floor: [
      '000000000',
      '000000110',
      '000000110',
      '000000110',
      '000000220',
      '000000000',
      '000000000',
      '000000000',
    ],
    goals: [
      { kind: 'stone' },
      { kind: 'sand' },
    ],
    stars: [2900, 6100, 9300],
  },
  // [spike] The iron grid: chained gems in a regular grid, six colours.
  {
    id: 54, cols: 8, rows: 8, colors: 6, moves: 28,
    pieces: [
      '........',
      '.c.c.c.c',
      '........',
      'c.c.c.c.',
      '........',
      '.c.c.c.c',
      '........',
      '........',
    ],
    goals: [
      { kind: 'chain' },
      { kind: 'color', color: 4, target: 20 },
    ],
    stars: [4700, 8300, 11500],
  },
  // [breather] Sand ripples: diagonal stripes of sand, and sapphires to gather.
  {
    id: 55, cols: 8, rows: 8, colors: 5, moves: 23,
    pieces: [
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
    ],
    floor: [
      '10010010',
      '01001001',
      '00100100',
      '10010010',
      '01001001',
      '00100100',
      '10010010',
      '01001001',
    ],
    goals: [
      { kind: 'sand' },
      { kind: 'color', color: 3, target: 24 },
    ],
    stars: [6400, 13800, 19400],
  },
  // [normal] The keystone cross: a cross of thick stone in the middle of a small board.
  {
    id: 56, cols: 7, rows: 7, colors: 5, moves: 18,
    pieces: [
      '.......',
      '...2...',
      '...3...',
      '.23332.',
      '...3...',
      '...2...',
      '.......',
    ],
    goals: [
      { kind: 'stone' },
      { kind: 'color', color: 2, target: 20 },
    ],
    stars: [3500, 6900, 10300],
  },
  // [normal] The deep caravan: lamps behind chains, and a sandy floor that is deep at the very bottom.
  {
    id: 57, cols: 8, rows: 8, colors: 5, moves: 33,
    pieces: [
      '..L..L..',
      '........',
      '..c..c..',
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
      '00000000',
      '00000000',
      '11111111',
      '22222222',
    ],
    goals: [
      { kind: 'lamp', target: 2 },
      { kind: 'sand' },
    ],
    stars: [10800, 19200, 24600],
  },
  // [build-up] The strangler: a wide ring of vines around a block of stone.
  {
    id: 58, cols: 9, rows: 9, colors: 5, moves: 13,
    pieces: [
      '.........',
      '.........',
      '..vvvvv..',
      '..v111v..',
      '..v131v..',
      '..v111v..',
      '..vvvvv..',
      '.........',
      '.........',
    ],
    goals: [
      { kind: 'vine' },
      { kind: 'stone' },
    ],
    stars: [3500, 9600, 15600],
  },
  // [hard] Bazaar at midnight: lamps above a hedge of vines, a sandy floor that is deep at the bottom.
  {
    id: 59, cols: 9, rows: 9, colors: 5, moves: 16,
    hard: true,
    pieces: [
      '..L...L..',
      '.........',
      '.........',
      '.vv.v.vv.',
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
      '000000000',
      '011111110',
      '011111110',
      '011111110',
      '022222220',
    ],
    goals: [
      { kind: 'lamp', target: 2 },
      { kind: 'sand' },
      { kind: 'vine' },
    ],
    stars: [8200, 17900, 26400],
  },
  // [breather] The crossroads: a cross-shaped board, three colours out of six.
  {
    id: 60, cols: 9, rows: 9, colors: 6, moves: 22,
    pieces: [
      '___...___',
      '___...___',
      '___...___',
      '.........',
      '.........',
      '.........',
      '___...___',
      '___...___',
      '___...___',
    ],
    goals: [
      { kind: 'color', color: 0, target: 14 },
      { kind: 'color', color: 2, target: 14 },
      { kind: 'color', color: 3, target: 14 },
    ],
    stars: [2300, 4700, 6400],
  },
];
