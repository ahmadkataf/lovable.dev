/**
 * Chapter 5 — Caverns (levels 81–100). Tighter boards and bigger jobs.
 * Hard levels: 89 and 99, each followed by a breather.
 *
 * Layouts, colours and goals are designed by hand. `moves` and `stars` (and the target of a
 * score-only level) are fitted by `node tools/levelgen/tune.ts` — change a layout, then run the
 * tuner again. The comment above each level is its brief: tier, idea, intended feel.
 * Piece / floor notation: see `LevelDef` in src/engine/types.ts.
 */
import type { LevelDef } from '../../engine/types.ts';

export const CHAPTER_5: readonly LevelDef[] = [
  // [normal] The cave mouth: a rock rises from the floor, with a heap of sand piled on top of it.
  {
    id: 81, cols: 9, rows: 8, colors: 6, moves: 25,
    pieces: [
      '_......._',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '...___...',
      '...___...',
    ],
    floor: [
      '000000000',
      '000000000',
      '000000000',
      '000111000',
      '001222100',
      '012222210',
      '000000000',
      '000000000',
    ],
    goals: [{ kind: 'sand' }],
    stars: [4400, 8500, 10800],
  },
  // [normal] Stalactites: three spurs hang from the ceiling, tipped with crystal; stumps of stone below.
  {
    id: 82, cols: 9, rows: 8, colors: 6, moves: 28,
    pieces: [
      '._.._.._.',
      '._.._.._.',
      '._..2.._.',
      '.2.....2.',
      '.........',
      '.........',
      '.........',
      '..3...3..',
    ],
    goals: [
      { kind: 'stone' },
      { kind: 'color', color: 3, target: 20 },
      { kind: 'color', color: 5, target: 20 },
    ],
    stars: [3800, 7100, 9400],
  },
  // [build-up] The crystal cluster: a pyramid of stone, thickest at its heart.
  {
    id: 83, cols: 8, rows: 8, colors: 6, moves: 19,
    pieces: [
      '........',
      '........',
      '...11...',
      '..1221..',
      '.123321.',
      '........',
      '........',
      '........',
    ],
    goals: [{ kind: 'stone' }],
    stars: [2700, 6100, 8400],
  },
  // [spike] The underground lake: a round pool of sand that gets deeper toward the middle.
  {
    id: 84, cols: 9, rows: 8, colors: 6, moves: 28,
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
      '000000000',
      '000000000',
      '000000000',
      '000111000',
      '001121100',
      '011222110',
      '011222110',
      '001121100',
    ],
    goals: [{ kind: 'sand' }],
    stars: [6800, 10800, 14000],
  },
  // [breather] Crystal columns: three columns of stone that thicken toward the foot.
  {
    id: 85, cols: 9, rows: 8, colors: 6, moves: 22,
    pieces: [
      '.........',
      '.1..1..1.',
      '.2..2..2.',
      '.3..3..3.',
      '.........',
      '.........',
      '.........',
      '.........',
    ],
    goals: [
      { kind: 'stone' },
      { kind: 'color', color: 2, target: 18 },
      { kind: 'color', color: 4, target: 18 },
    ],
    stars: [3500, 7200, 9900],
  },
  // [normal] Roots: vines hang from the ceiling, where they are hardest to reach.
  {
    id: 86, cols: 8, rows: 8, colors: 6, moves: 24,
    pieces: [
      'v.v..v.v',
      'v......v',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
    ],
    goals: [
      { kind: 'vine' },
      { kind: 'color', color: 1, target: 26 },
    ],
    stars: [3800, 7500, 10100],
  },
  // [normal] The geode: a hollow lined with crystal, thick at its four points.
  {
    id: 87, cols: 9, rows: 9, colors: 6, moves: 30,
    pieces: [
      '.........',
      '.........',
      '...121...',
      '..11_11..',
      '..2___2..',
      '..11_11..',
      '...121...',
      '.........',
      '.........',
    ],
    goals: [{ kind: 'stone' }],
    stars: [4600, 9000, 11600],
  },
  // [build-up] Chained crystals: stones and chained gems in facing pairs.
  {
    id: 88, cols: 8, rows: 8, colors: 6, moves: 29,
    pieces: [
      '........',
      '.c.22.c.',
      '........',
      '.2.cc.2.',
      '.2.cc.2.',
      '........',
      '.c.22.c.',
      '........',
    ],
    goals: [
      { kind: 'stone' },
      { kind: 'chain' },
    ],
    stars: [4500, 9200, 12000],
  },
  // [hard] The abyss: stones above a floor of sand that is deep at the very bottom.
  {
    id: 89, cols: 8, rows: 8, colors: 6, moves: 29,
    hard: true,
    pieces: [
      '........',
      '........',
      '........',
      '........',
      '2.2..2.2',
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
      '00111100',
      '02222220',
    ],
    goals: [
      { kind: 'sand' },
      { kind: 'stone' },
    ],
    stars: [6400, 10800, 13500],
  },
  // [breather] The lamp shaft: a wall splits the lower cave into two shafts; the middle column ends early.
  {
    id: 90, cols: 9, rows: 8, colors: 5, moves: 32,
    pieces: [
      '.........',
      '.........',
      '.........',
      '.........',
      '...._....',
      '...._....',
      '...._....',
      '...._....',
    ],
    goals: [{ kind: 'lamp', target: 3 }],
    lamps: { total: 3, maxOnBoard: 3, everyMoves: 1 },
    stars: [9600, 14700, 19100],
  },
  // [normal] Glow-worms: vines grow on the floor, right where the lamps have to land.
  {
    id: 91, cols: 8, rows: 7, colors: 5, moves: 22,
    pieces: [
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      'v.v..v.v',
    ],
    goals: [
      { kind: 'lamp', target: 3 },
      { kind: 'vine' },
    ],
    lamps: { total: 3, maxOnBoard: 3, everyMoves: 1 },
    stars: [7200, 12000, 16200],
  },
  // [normal] The narrow pass: two chambers joined by a short bridge of deep sand.
  {
    id: 92, cols: 9, rows: 7, colors: 6, moves: 30,
    pieces: [
      '...___...',
      '...___...',
      '.........',
      '.........',
      '.........',
      '...___...',
      '...___...',
    ],
    floor: [
      '000000000',
      '000000000',
      '000222000',
      '000222000',
      '000222000',
      '000000000',
      '000000000',
    ],
    goals: [
      { kind: 'sand' },
      { kind: 'color', color: 0, target: 20 },
    ],
    stars: [3600, 6500, 8400],
  },
  // [build-up] The sump: a funnel of a board with sand collecting at the bottom.
  {
    id: 93, cols: 9, rows: 8, colors: 5, moves: 25,
    pieces: [
      '.........',
      '.........',
      '_......._',
      '_......._',
      '__.....__',
      '__.....__',
      '___...___',
      '___...___',
    ],
    floor: [
      '000000000',
      '000000000',
      '000000000',
      '000000000',
      '001111100',
      '001111100',
      '000111000',
      '000222000',
    ],
    goals: [
      { kind: 'sand' },
      { kind: 'color', color: 2, target: 22 },
    ],
    stars: [5700, 11000, 14300],
  },
  // [spike] The cave-in: two walls of rubble, each with a single gap.
  {
    id: 94, cols: 8, rows: 8, colors: 6, moves: 26,
    pieces: [
      '........',
      '........',
      '........',
      '222.2222',
      '........',
      '2222.222',
      '........',
      '........',
    ],
    goals: [
      { kind: 'stone' },
      { kind: 'color', color: 3, target: 20 },
    ],
    stars: [4700, 8300, 11400],
  },
  // [breather] The bat colony: chained gems hang in a zigzag under the ceiling.
  {
    id: 95, cols: 8, rows: 8, colors: 6, moves: 27,
    pieces: [
      '........',
      'c.c.c.c.',
      '.c.c.c.c',
      '........',
      '........',
      '........',
      '........',
      '........',
    ],
    goals: [
      { kind: 'chain' },
      { kind: 'color', color: 4, target: 20 },
    ],
    stars: [3800, 7900, 11100],
  },
  // [normal] Twin caverns: one roof, two chambers — vines in the left one, deep sand in the right.
  {
    id: 96, cols: 9, rows: 8, colors: 6, moves: 27,
    pieces: [
      '.........',
      '.........',
      '...._....',
      '...._....',
      '.vv._....',
      '.vv._....',
      '...._....',
      '...._....',
    ],
    floor: [
      '000000000',
      '000000000',
      '000000000',
      '000000000',
      '000000220',
      '000000220',
      '000000110',
      '000000110',
    ],
    goals: [
      { kind: 'vine' },
      { kind: 'sand' },
    ],
    stars: [3900, 7600, 9900],
  },
  // [normal] The lantern lake: lamps on chains above a lake of sand.
  {
    id: 97, cols: 8, rows: 8, colors: 5, moves: 23,
    pieces: [
      '..L..L..',
      '..c..c..',
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
      '00000000',
      '00111100',
      '01222210',
      '12222221',
    ],
    goals: [
      { kind: 'lamp', target: 2 },
      { kind: 'sand' },
    ],
    stars: [8700, 15600, 21100],
  },
  // [build-up] Fungus: a lopsided clump of vines with stones scattered around it.
  {
    id: 98, cols: 8, rows: 8, colors: 6, moves: 19,
    pieces: [
      '........',
      '..2..2..',
      '...vv...',
      '.2vvv...',
      '...vv.2.',
      '....v...',
      '..2.....',
      '........',
    ],
    goals: [
      { kind: 'vine' },
      { kind: 'stone' },
      { kind: 'color', color: 2, target: 16 },
    ],
    stars: [2900, 6100, 8300],
  },
  // [hard] The heart of the mountain: a diamond of deep sand under vines, guarded by thick stones.
  {
    id: 99, cols: 9, rows: 9, colors: 6, moves: 20,
    hard: true,
    pieces: [
      '.........',
      '.........',
      '..c.3.c..',
      '.........',
      '.3.vvv.3.',
      '.........',
      '..c.3.c..',
      '.........',
      '.........',
    ],
    floor: [
      '000000000',
      '000000000',
      '000020000',
      '000222000',
      '002222200',
      '000222000',
      '000020000',
      '000000000',
      '000000000',
    ],
    goals: [
      { kind: 'sand' },
      { kind: 'stone' },
      { kind: 'vine' },
    ],
    stars: [5200, 9600, 13000],
  },
  // [breather] Twin stars: two round boards joined at the waist, a nova waiting in each.
  {
    id: 100, cols: 9, rows: 8, colors: 6, moves: 26,
    pieces: [
      '_..___.._',
      '...._....',
      '..N._....',
      '.........',
      '.........',
      '...._.N..',
      '...._....',
      '_..___.._',
    ],
    goals: [
      { kind: 'color', color: 0, target: 24 },
      { kind: 'color', color: 3, target: 24 },
    ],
    stars: [3200, 6400, 8400],
  },
];
