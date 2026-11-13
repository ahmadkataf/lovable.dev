/**
 * Chapter 3 — Bazaar (levels 41–60). Vines arrive (41) and everything starts to mix.
 * Hard levels: 49 and 59, each followed by a breather; 60 is the chapter's generous finale.
 *
 * Layouts, colours and goals are designed by hand. `moves` and `stars` (and the target of a
 * score-only level) are fitted by `node tools/levelgen/tune.ts` — change a layout, then run the
 * tuner again. The comment above each level is its brief: tier, idea, intended feel.
 * Piece / floor notation: see `LevelDef` in src/engine/types.ts.
 */
import type { LevelDef } from '../../engine/types.ts';

export const CHAPTER_3: readonly LevelDef[] = [
  // [tutorial] Vines: two thick hedges of vine — match beside them to cut them back. Fixed start board: the hinted move cuts a vine.
  {
    id: 41, cols: 9, rows: 8, colors: 5, moves: 10,
    tutorial: 'vine',
    pieces: [
      'dbbCbebae',
      'adCddCeed',
      'bvvvdvvve',
      'avvvevvva',
      'bbeaeaaCC',
      'evvvavvvd',
      'bvvvevvva',
      'beCCeCCed',
    ],
    goals: [{ kind: 'vine' }],
    stars: [2500, 7400, 13000],
  },
  // [normal] The creeper: a column of vine down the middle while you gather amber — keep it trimmed or it takes the board.
  {
    id: 42, cols: 9, rows: 9, colors: 5, moves: 21,
    pieces: [
      '.........',
      '.........',
      '....v....',
      '....v....',
      '....v....',
      '....v....',
      '....v....',
      '.........',
      '.........',
    ],
    goals: [{ kind: 'color', color: 1, target: 52 }],
    stars: [7000, 16600, 24400],
  },
  // [build-up] The overgrown court: a deep sand court with vines rooted in it — the sand under a vine waits for the vine.
  {
    id: 43, cols: 9, rows: 8, colors: 5, moves: 23,
    pieces: [
      '.........',
      '.........',
      '.v.v.v.v.',
      '.........',
      '.........',
      '.v.v.v.v.',
      '.........',
      '.........',
    ],
    floor: [
      '000000000',
      '022222220',
      '022222220',
      '022222220',
      '022222220',
      '022222220',
      '022222220',
      '000000000',
    ],
    goals: [{ kind: 'sand' }],
    stars: [10400, 18200, 24600],
  },
  // [spike] The hedge: three lamps and a hedge of vine across their way.
  {
    id: 44, cols: 8, rows: 8, colors: 5, moves: 20,
    pieces: [
      '.L..L.L.',
      '........',
      '........',
      '.vvvvvv.',
      '........',
      '........',
      '........',
      '........',
    ],
    goals: [{ kind: 'lamp', target: 3 }],
    stars: [6000, 12400, 17800],
  },
  // [breather] The market square: a big open board with six pillars, three colours to gather — and a sixth colour in play.
  {
    id: 45, cols: 9, rows: 9, colors: 6, moves: 25,
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
      { kind: 'color', color: 0, target: 18 },
      { kind: 'color', color: 1, target: 18 },
      { kind: 'color', color: 3, target: 18 },
    ],
    stars: [2800, 7600, 10600],
  },
  // [normal] Locks and ivy: pairs of chained gems above and below, vines creeping in from both sides.
  {
    id: 46, cols: 8, rows: 8, colors: 5, moves: 23,
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
    stars: [4800, 12600, 17600],
  },
  // [normal] The low wall: four lamps and a stone wall with two gaps.
  {
    id: 47, cols: 8, rows: 7, colors: 5, moves: 26,
    pieces: [
      '.L.LL.L.',
      '........',
      '........',
      '11.11.11',
      '........',
      '........',
      '........',
    ],
    goals: [{ kind: 'lamp', target: 4 }],
    stars: [7300, 13000, 17300],
  },
  // [build-up] The lattice: a grid of sand lines, deep where they run down the board.
  {
    id: 48, cols: 9, rows: 9, colors: 5, moves: 21,
    pieces: [
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
    ],
    floor: [
      '002000200',
      '002000200',
      '112111211',
      '002000200',
      '002000200',
      '002000200',
      '112111211',
      '002000200',
      '002000200',
    ],
    goals: [{ kind: 'sand' }],
    stars: [7400, 17400, 25000],
  },
  // [hard] The choked garden: a deep sand court, a knot of vine in its middle, chained corners — and six colours.
  {
    id: 49, cols: 8, rows: 8, colors: 6, moves: 25,
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
    stars: [5800, 9900, 13000],
  },
  // [breather] A gift of lights: two beams and a nova lie ready; two colours to gather on an open board.
  {
    id: 50, cols: 9, rows: 9, colors: 6, moves: 23,
    pieces: [
      '.........',
      '.........',
      '.........',
      '.V.....V.',
      '.........',
      '....N....',
      '.........',
      '.........',
      '.........',
    ],
    goals: [
      { kind: 'color', color: 0, target: 26 },
      { kind: 'color', color: 5, target: 26 },
    ],
    stars: [4100, 9500, 13000],
  },
  // [normal] The colonnade: thick lintels on rows of pillars — stone only.
  {
    id: 51, cols: 9, rows: 8, colors: 5, moves: 20,
    pieces: [
      '.........',
      '.........',
      '.333.333.',
      '.2.2.2.2.',
      '.2.2.2.2.',
      '...2.2...',
      '.........',
      '.........',
    ],
    goals: [{ kind: 'stone' }],
    stars: [4400, 10600, 16100],
  },
  // [normal] Ivy at the gates: three lamps come down between vines growing in from both edges.
  {
    id: 52, cols: 8, rows: 7, colors: 5, moves: 26,
    pieces: [
      '.L..L.L.',
      '........',
      'v......v',
      'v......v',
      'v......v',
      '........',
      '........',
    ],
    goals: [{ kind: 'lamp', target: 3 }],
    stars: [6700, 12800, 17100],
  },
  // [build-up] Two rooms: stones in the left room, deep sand in the right, one shared floor.
  {
    id: 53, cols: 9, rows: 8, colors: 5, moves: 24,
    pieces: [
      '...._....',
      '.22._....',
      '.22._....',
      '.22._....',
      '.22._....',
      '.........',
      '.........',
      '.........',
    ],
    floor: [
      '000000000',
      '000001220',
      '000001220',
      '000001220',
      '000001220',
      '000011110',
      '000000000',
      '000000000',
    ],
    goals: [
      { kind: 'stone' },
      { kind: 'sand' },
    ],
    stars: [4900, 9500, 12600],
  },
  // [spike] The chain mail: sixteen chained gems on a checkerboard.
  {
    id: 54, cols: 8, rows: 8, colors: 5, moves: 20,
    pieces: [
      '........',
      '.c.c.c.c',
      '........',
      'c.c.c.c.',
      '........',
      '.c.c.c.c',
      '........',
      'c.c.c.c.',
    ],
    goals: [{ kind: 'chain' }],
    stars: [4900, 12000, 17800],
  },
  // [breather] Rain on the dunes: slanting stripes of shallow sand on an open board.
  {
    id: 55, cols: 9, rows: 8, colors: 5, moves: 25,
    pieces: [
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
    ],
    floor: [
      '100100100',
      '010010010',
      '001001001',
      '100100100',
      '010010010',
      '001001001',
      '100100100',
      '010010010',
    ],
    goals: [{ kind: 'sand' }],
    stars: [7100, 15400, 21900],
  },
  // [normal] The stone cross: a cross of thick stones cuts the board into four gardens.
  {
    id: 56, cols: 9, rows: 9, colors: 5, moves: 21,
    pieces: [
      '.........',
      '....2....',
      '....3....',
      '....3....',
      '.2333332.',
      '....3....',
      '....3....',
      '....2....',
      '.........',
    ],
    goals: [{ kind: 'stone' }],
    stars: [5000, 12200, 19400],
  },
  // [normal] Lamps over the wadi: two lamps held by chains, and three rows of sand at the bottom to sweep.
  {
    id: 57, cols: 8, rows: 8, colors: 5, moves: 28,
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
      '11111111',
      '22222222',
      '11111111',
    ],
    goals: [
      { kind: 'lamp', target: 2 },
      { kind: 'sand' },
    ],
    stars: [9400, 16900, 22400],
  },
  // [build-up] The thicket: a block of stones inside a wall of vine — cut your way in, then break the stones.
  {
    id: 58, cols: 9, rows: 9, colors: 5, moves: 22,
    pieces: [
      '.........',
      '.........',
      '..vvvvv..',
      '..v323v..',
      '..v232v..',
      '..v323v..',
      '..vvvvv..',
      '.........',
      '.........',
    ],
    goals: [
      { kind: 'vine' },
      { kind: 'stone' },
    ],
    stars: [5800, 13400, 20500],
  },
  // [hard] The sunken garden: three lamps, a hedge of vine across the board and a deep sand bed below it.
  {
    id: 59, cols: 9, rows: 8, colors: 5, moves: 21,
    hard: true,
    pieces: [
      '..L.L.L..',
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
      '011111110',
      '022222220',
      '022222220',
      '022222220',
      '011111110',
    ],
    goals: [
      { kind: 'lamp', target: 3 },
      { kind: 'sand' },
      { kind: 'vine' },
    ],
    stars: [10600, 17900, 23900],
  },
  // [finale] The crossroads: a wide plus-shaped board, three colours to gather and a prism at its heart.
  {
    id: 60, cols: 9, rows: 9, colors: 5, moves: 20,
    pieces: [
      '__.....__',
      '__.....__',
      '.........',
      '.........',
      '....P....',
      '.........',
      '.........',
      '__.....__',
      '__.....__',
    ],
    goals: [
      { kind: 'color', color: 0, target: 30 },
      { kind: 'color', color: 2, target: 30 },
      { kind: 'color', color: 3, target: 30 },
    ],
    stars: [5300, 12300, 17500],
  },
];
