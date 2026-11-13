/**
 * Chapter 4 — Palace (levels 61–80). Combinations of everything learned so far; from here on a
 * level often has two kinds of goal.
 * Hard levels: 69 and 79, each followed by a breather; 80 is the chapter's generous finale.
 *
 * Layouts, colours and goals are designed by hand. `moves` and `stars` (and the target of a
 * score-only level) are fitted by `node tools/levelgen/tune.ts` — change a layout, then run the
 * tuner again. The comment above each level is its brief: tier, idea, intended feel.
 * Piece / floor notation: see `LevelDef` in src/engine/types.ts.
 */
import type { LevelDef } from '../../engine/types.ts';

export const CHAPTER_4: readonly LevelDef[] = [
  // [normal] The dome: the outline of a dome drawn in sand, the floor included.
  {
    id: 61, cols: 9, rows: 8, colors: 5, moves: 26,
    pieces: [
      '___...___',
      '__.....__',
      '_......._',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
    ],
    floor: [
      '000111000',
      '001000100',
      '010000010',
      '100000001',
      '100000001',
      '100000001',
      '100000001',
      '111111111',
    ],
    goals: [{ kind: 'sand' }],
    stars: [5700, 12000, 16500],
  },
  // [normal] The pillared hall: nine pillars on an open floor, moonstone to gather between them. Six colours.
  {
    id: 62, cols: 9, rows: 9, colors: 6, moves: 22,
    pieces: [
      '.........',
      '.........',
      '..2.2.2..',
      '.........',
      '..2.2.2..',
      '.........',
      '..2.2.2..',
      '.........',
      '.........',
    ],
    goals: [
      { kind: 'stone' },
      { kind: 'color', color: 5, target: 26 },
    ],
    stars: [4000, 8700, 12100],
  },
  // [build-up] The lantern stair: three lamps, and four stones standing in the outer two columns of descent.
  {
    id: 63, cols: 7, rows: 8, colors: 5, moves: 23,
    pieces: [
      '.L.L.L.',
      '.......',
      '.2...2.',
      '.......',
      '.......',
      '.2...2.',
      '.......',
      '.......',
    ],
    goals: [{ kind: 'lamp', target: 3 }],
    stars: [6500, 12400, 16900],
  },
  // [spike] The chained mosaic: a lattice of chained gems over sand of mixed depth.
  {
    id: 64, cols: 8, rows: 8, colors: 5, moves: 23,
    pieces: [
      '........',
      '.c.c.c..',
      '..c.c.c.',
      '.c.c.c..',
      '..c.c.c.',
      '.c.c.c..',
      '..c.c.c.',
      '........',
    ],
    floor: [
      '00000000',
      '01212120',
      '02121210',
      '01212120',
      '02121210',
      '01212120',
      '02121210',
      '00000000',
    ],
    goals: [
      { kind: 'sand' },
      { kind: 'chain' },
    ],
    stars: [7600, 14500, 19800],
  },
  // [breather] Ivy on the walls: vines climb both side walls while you gather rubies in the open middle.
  {
    id: 65, cols: 9, rows: 8, colors: 5, moves: 21,
    pieces: [
      '.........',
      '.........',
      'v.......v',
      'vv.....vv',
      'vv.....vv',
      'v.......v',
      '.........',
      '.........',
    ],
    goals: [{ kind: 'color', color: 0, target: 36 }],
    stars: [5100, 12500, 18500],
  },
  // [normal] The cellar: three rows of sand under a ceiling of stone — little falls in until the ceiling breaks.
  {
    id: 66, cols: 8, rows: 9, colors: 5, moves: 20,
    pieces: [
      '........',
      '........',
      '........',
      '........',
      '........',
      '.222222.',
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
      '01111110',
      '01111110',
      '02222220',
    ],
    goals: [{ kind: 'sand' }],
    stars: [5600, 13800, 19900],
  },
  // [normal] The amethyst bower: two clumps of vine and a lot of amethyst to gather before they close in.
  {
    id: 67, cols: 8, rows: 8, colors: 5, moves: 21,
    pieces: [
      '_......_',
      '........',
      '........',
      '.vv..vv.',
      '..v..v..',
      '........',
      '........',
      '_......_',
    ],
    goals: [
      { kind: 'vine' },
      { kind: 'color', color: 4, target: 44 },
    ],
    stars: [5700, 12000, 17100],
  },
  // [build-up] The courtyard: two lamps on chains, and a knot of vine in the middle of the yard.
  {
    id: 68, cols: 8, rows: 8, colors: 5, moves: 25,
    pieces: [
      '.L....L.',
      '.c....c.',
      '........',
      '........',
      '...vv...',
      '...vv...',
      '........',
      '........',
    ],
    goals: [
      { kind: 'lamp', target: 2 },
      { kind: 'vine' },
    ],
    stars: [6800, 14900, 20500],
  },
  // [hard] The keep: a wall of vine with stone towers at its corners and one in its heart — and emeralds to gather.
  {
    id: 69, cols: 9, rows: 9, colors: 5, moves: 19,
    hard: true,
    pieces: [
      '.........',
      '.........',
      '..3vvv3..',
      '..v...v..',
      '..v.3.v..',
      '..v...v..',
      '..3vvv3..',
      '.........',
      '.........',
    ],
    goals: [
      { kind: 'stone' },
      { kind: 'vine' },
      { kind: 'color', color: 2, target: 45 },
    ],
    stars: [6500, 15000, 21500],
  },
  // [breather] The jewel box: a small board, sand everywhere, deep in the middle. Nothing but sweeping.
  {
    id: 70, cols: 6, rows: 6, colors: 5, moves: 27,
    pieces: [
      '......',
      '......',
      '......',
      '......',
      '......',
      '......',
    ],
    floor: [
      '111111',
      '122221',
      '122221',
      '122221',
      '122221',
      '111111',
    ],
    goals: [{ kind: 'sand' }],
    stars: [5800, 10000, 12500],
  },
  // [normal] The fountain: a wide basin under a gap in the board — deep sand in the basin, amber to gather around it.
  {
    id: 71, cols: 9, rows: 9, colors: 5, moves: 21,
    pieces: [
      '...___...',
      '...___...',
      '...___...',
      '...___...',
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
      '001111100',
      '001222100',
      '001222100',
      '001222100',
      '001111100',
    ],
    goals: [
      { kind: 'sand' },
      { kind: 'color', color: 1, target: 34 },
    ],
    stars: [5300, 10500, 14400],
  },
  // [normal] The lamp nests: two lamps, each between chained gems, and more chains hanging below.
  {
    id: 72, cols: 8, rows: 8, colors: 5, moves: 23,
    pieces: [
      '........',
      '.cLc.cLc',
      '..c...c.',
      '........',
      '.c.cc.c.',
      '........',
      '........',
      '........',
    ],
    goals: [
      { kind: 'lamp', target: 2 },
      { kind: 'chain' },
    ],
    stars: [5700, 13600, 19400],
  },
  // [build-up] The corridor: deep sand between two walls where only three tiles fit side by side.
  {
    id: 73, cols: 9, rows: 8, colors: 5, moves: 24,
    pieces: [
      '.........',
      '.........',
      '.._..._..',
      '.._..._..',
      '.._..._..',
      '.._..._..',
      '.........',
      '.........',
    ],
    floor: [
      '000000000',
      '001111100',
      '000222000',
      '000222000',
      '000222000',
      '000222000',
      '011111110',
      '001111100',
    ],
    goals: [{ kind: 'sand' }],
    stars: [5100, 9900, 12700],
  },
  // [spike] The double gate: three lamps, and two stones in the way of each.
  {
    id: 74, cols: 7, rows: 8, colors: 5, moves: 22,
    pieces: [
      '.L.L.L.',
      '.......',
      '.2.2.2.',
      '.......',
      '.......',
      '.2.2.2.',
      '.......',
      '.......',
    ],
    goals: [{ kind: 'lamp', target: 3 }],
    stars: [6100, 12400, 16600],
  },
  // [breather] The necklace: a ring of chained gems; two colours to gather, inside the ring or out.
  {
    id: 75, cols: 8, rows: 8, colors: 5, moves: 20,
    pieces: [
      '........',
      '........',
      '..c..c..',
      '.c....c.',
      '.c....c.',
      '..c..c..',
      '........',
      '........',
    ],
    goals: [
      { kind: 'color', color: 1, target: 30 },
      { kind: 'color', color: 3, target: 30 },
    ],
    stars: [4600, 11200, 16100],
  },
  // [normal] The vine court: a deep sand court with vines rooted across it.
  {
    id: 76, cols: 8, rows: 9, colors: 5, moves: 22,
    pieces: [
      '........',
      '........',
      '..v..v..',
      '........',
      '...vv...',
      '........',
      '..v..v..',
      '........',
      '........',
    ],
    floor: [
      '00000000',
      '02222220',
      '02222220',
      '02222220',
      '02222220',
      '02222220',
      '02222220',
      '02222220',
      '00000000',
    ],
    goals: [
      { kind: 'sand' },
      { kind: 'vine' },
    ],
    stars: [10100, 18800, 24400],
  },
  // [normal] The star tile: a diamond-shaped board with a ring of stones; two colours to gather.
  {
    id: 77, cols: 9, rows: 9, colors: 5, moves: 21,
    pieces: [
      '___...___',
      '__.....__',
      '_...2..._',
      '...1.1...',
      '..2...2..',
      '...1.1...',
      '_...2..._',
      '__.....__',
      '___...___',
    ],
    goals: [
      { kind: 'stone' },
      { kind: 'color', color: 0, target: 34 },
      { kind: 'color', color: 4, target: 34 },
    ],
    stars: [5100, 10600, 14900],
  },
  // [build-up] The guarded lamps: two lamps above chained gems, with stone posts at the sides.
  {
    id: 78, cols: 8, rows: 8, colors: 5, moves: 21,
    pieces: [
      '..L..L..',
      '........',
      '.2c..c2.',
      '........',
      '..c..c..',
      '.2....2.',
      '........',
      '........',
    ],
    goals: [
      { kind: 'lamp', target: 2 },
      { kind: 'stone' },
    ],
    stars: [5800, 12700, 18500],
  },
  // [hard] The throne room: two lamps on chains, a block of stone in the middle and deep sand under and around it.
  {
    id: 79, cols: 9, rows: 9, colors: 5, moves: 19,
    hard: true,
    pieces: [
      '..L...L..',
      '.........',
      '..c...c..',
      '...222...',
      '...232...',
      '...222...',
      '.........',
      '.........',
      '.........',
    ],
    floor: [
      '000000000',
      '000000000',
      '000000000',
      '001222100',
      '001222100',
      '001222100',
      '001111100',
      '000000000',
      '000000000',
    ],
    goals: [
      { kind: 'lamp', target: 2 },
      { kind: 'stone' },
      { kind: 'sand' },
    ],
    stars: [9200, 18100, 25200],
  },
  // [finale] The palace garden: a wide board with eight small pools, a prism and a nova lying ready, three colours to gather.
  {
    id: 80, cols: 9, rows: 9, colors: 5, moves: 23,
    pieces: [
      '.........',
      '.........',
      '._._._._.',
      '....P....',
      '.........',
      '....N....',
      '._._._._.',
      '.........',
      '.........',
    ],
    goals: [
      { kind: 'color', color: 1, target: 30 },
      { kind: 'color', color: 3, target: 30 },
      { kind: 'color', color: 4, target: 30 },
    ],
    stars: [5100, 12300, 17200],
  },
];
