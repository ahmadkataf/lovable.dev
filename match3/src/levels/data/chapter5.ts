/**
 * Chapter 5 — Caverns (levels 81–100). Tighter boards and bigger jobs.
 * Hard levels: 89 and 99, each followed by a breather; 100 is the chapter's generous finale.
 *
 * Layouts, colours and goals are designed by hand. `moves` and `stars` (and the target of a
 * score-only level) are fitted by `node tools/levelgen/tune.ts` — change a layout, then run the
 * tuner again. The comment above each level is its brief: tier, idea, intended feel.
 * Piece / floor notation: see `LevelDef` in src/engine/types.ts.
 */
import type { LevelDef } from '../../engine/types.ts';

export const CHAPTER_5: readonly LevelDef[] = [
  // [normal] The stalagmite: a mound of sand, deep at its base, standing over a gap in the floor. Six colours.
  {
    id: 81, cols: 9, rows: 8, colors: 6, moves: 22,
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
  // [normal] The organ pipes: three shafts in the ceiling, five stones, two colours to gather.
  {
    id: 82, cols: 9, rows: 8, colors: 5, moves: 22,
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
      { kind: 'color', color: 3, target: 30 },
      { kind: 'color', color: 4, target: 30 },
    ],
    stars: [3800, 7100, 9400],
  },
  // [build-up] The rock fall: a pile of stones, thicker the deeper you dig.
  {
    id: 83, cols: 9, rows: 8, colors: 5, moves: 27,
    pieces: [
      '.........',
      '.........',
      '....2....',
      '...232...',
      '..23332..',
      '.2333332.',
      '.........',
      '.........',
    ],
    goals: [{ kind: 'stone' }],
    stars: [2700, 6100, 8400],
  },
  // [spike] The crystal bed: a diamond of sand at the bottom of the cave, deep at its core. Six colours.
  {
    id: 84, cols: 9, rows: 9, colors: 6, moves: 23,
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
      '000000000',
      '000000000',
      '000000000',
      '000111000',
      '001121100',
      '011222110',
      '011222110',
      '001121100',
      '000111000',
    ],
    goals: [{ kind: 'sand' }],
    stars: [6800, 10800, 14000],
  },
  // [breather] The three pillars: stone columns of growing thickness; two colours to gather around them. Six colours.
  {
    id: 85, cols: 9, rows: 8, colors: 6, moves: 23,
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
      { kind: 'color', color: 2, target: 18 },
      { kind: 'color', color: 4, target: 18 },
    ],
    stars: [3500, 7200, 9900],
  },
  // [normal] The cave moss: a knot of vine in the middle of the cave and amber to gather. Six colours.
  {
    id: 86, cols: 8, rows: 8, colors: 6, moves: 27,
    pieces: [
      '........',
      '........',
      '........',
      '..v..v..',
      '...vv...',
      '..v..v..',
      '........',
      '........',
    ],
    goals: [
      { kind: 'vine' },
      { kind: 'color', color: 1, target: 30 },
    ],
    stars: [3800, 7500, 10100],
  },
  // [normal] The sinkhole: a ring of stones around a hole in the middle of the board.
  {
    id: 87, cols: 9, rows: 9, colors: 5, moves: 28,
    pieces: [
      '.........',
      '.........',
      '...232...',
      '..22_22..',
      '..3___3..',
      '..22_22..',
      '...232...',
      '.........',
      '.........',
    ],
    goals: [{ kind: 'stone' }],
    stars: [4600, 9000, 11600],
  },
  // [build-up] Locked veins: thick stones and chained gems arranged around the middle.
  {
    id: 88, cols: 9, rows: 8, colors: 5, moves: 20,
    pieces: [
      '.........',
      '.c.333.c.',
      '.........',
      '.3.c.c.3.',
      '.3.c.c.3.',
      '.........',
      '.c.333.c.',
      '.........',
    ],
    goals: [
      { kind: 'stone' },
      { kind: 'chain' },
    ],
    stars: [4500, 9200, 12000],
  },
  // [hard] The flooded chamber: a row of stones across the board and a deep sand bed below it. Six colours.
  {
    id: 89, cols: 8, rows: 8, colors: 6, moves: 20,
    hard: true,
    pieces: [
      '........',
      '........',
      '........',
      '2.2..2.2',
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
      '01111110',
      '01222210',
      '01222210',
      '00111100',
    ],
    goals: [
      { kind: 'sand' },
      { kind: 'stone' },
    ],
    stars: [6400, 10800, 13500],
  },
  // [breather] The lamp shaft: five lamps and only four colours — everything falls fast. The floor is split by a wall.
  {
    id: 90, cols: 9, rows: 8, colors: 4, moves: 20,
    pieces: [
      '.L..L..L.',
      '.........',
      '..L...L..',
      '.........',
      '...._....',
      '...._....',
      '...._....',
      '...._....',
    ],
    goals: [{ kind: 'lamp', target: 5 }],
    stars: [9600, 14700, 19100],
  },
  // [normal] The hedge of roots: three lamps, and a broken hedge of vine halfway down.
  {
    id: 91, cols: 8, rows: 7, colors: 5, moves: 22,
    pieces: [
      '.L..L.L.',
      '........',
      '........',
      '........',
      'v.v..v.v',
      '........',
      '........',
    ],
    goals: [
      { kind: 'lamp', target: 3 },
      { kind: 'vine' },
    ],
    stars: [7200, 12000, 16200],
  },
  // [normal] The rope bridge: two chambers joined by a bridge of deep sand; rubies to gather.
  {
    id: 92, cols: 9, rows: 7, colors: 5, moves: 22,
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
      { kind: 'color', color: 0, target: 26 },
    ],
    stars: [3600, 6500, 8400],
  },
  // [build-up] The funnel: the board narrows to three tiles at the bottom; sand all the way down.
  {
    id: 93, cols: 9, rows: 8, colors: 5, moves: 20,
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
      '011111110',
      '012222210',
      '001222100',
      '001222100',
      '000222000',
      '000111000',
    ],
    goals: [{ kind: 'sand' }],
    stars: [5700, 11000, 14300],
  },
  // [spike] The double wall: two stone walls, each with a single gap, and sapphires to gather.
  {
    id: 94, cols: 8, rows: 8, colors: 5, moves: 22,
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
      { kind: 'color', color: 3, target: 36 },
    ],
    stars: [4700, 8300, 11400],
  },
  // [breather] The glitter vein: two rows of chained gems near the top; amethyst to gather.
  {
    id: 95, cols: 9, rows: 8, colors: 5, moves: 22,
    pieces: [
      '.........',
      'c.c.c.c.c',
      '.c.c.c.c.',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
    ],
    goals: [{ kind: 'color', color: 4, target: 38 }],
    stars: [3800, 7900, 11100],
  },
  // [normal] The twin grottoes: a wall splits the cave — vines grow on one side, deep sand lies on the other.
  {
    id: 96, cols: 9, rows: 8, colors: 5, moves: 20,
    pieces: [
      '.........',
      '.........',
      '.........',
      '...._....',
      '.vv._....',
      '.vv._....',
      '.vv._....',
      '.........',
    ],
    floor: [
      '000000000',
      '000000000',
      '000001220',
      '000001220',
      '000001220',
      '000001220',
      '000001220',
      '000001110',
    ],
    goals: [
      { kind: 'vine' },
      { kind: 'sand' },
    ],
    stars: [3900, 7600, 9900],
  },
  // [normal] The lamp well: two lamps on chains above a deep basin of sand.
  {
    id: 97, cols: 8, rows: 8, colors: 5, moves: 24,
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
  // [build-up] The mossy stones: a knot of vine between four stones, and emeralds to gather.
  {
    id: 98, cols: 8, rows: 9, colors: 5, moves: 21,
    pieces: [
      '........',
      '........',
      '..2..2..',
      '...vv...',
      '...vv...',
      '..2..2..',
      '........',
      '........',
      '........',
    ],
    goals: [
      { kind: 'vine' },
      { kind: 'stone' },
      { kind: 'color', color: 2, target: 44 },
    ],
    stars: [2900, 6100, 8300],
  },
  // [hard] The heart of the mountain: thick stones, chained gems and a row of vine over a diamond of deep sand. Six colours.
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
  // [finale] The crystal cave: an odd-shaped cave with two novas lying ready; two colours to gather.
  {
    id: 100, cols: 9, rows: 8, colors: 5, moves: 23,
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
