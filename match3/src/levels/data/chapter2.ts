/**
 * Chapter 2 — Dunes (levels 21–40). Lamps arrive (21) and chains (31).
 * Waves of five: normal, normal, build-up, spike, breather; level 39 is the first one marked hard
 * and level 40 a generous finale.
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
  // [normal] The caravan: four lamps travel together, two ahead and two behind. Lamps always stand away from the edges.
  {
    id: 22, cols: 8, rows: 8, colors: 5, moves: 27,
    pieces: [
      '.L....L.',
      '........',
      '...LL...',
      '........',
      '........',
      '........',
      '........',
      '........',
    ],
    goals: [{ kind: 'lamp', target: 4 }],
    stars: [5000, 10100, 15200],
  },
  // [build-up] Wet sand: two lamps sink through a band of sand — clearing their way sweeps most of it.
  {
    id: 23, cols: 8, rows: 7, colors: 5, moves: 21,
    pieces: [
      '..L..L..',
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
  // [spike] The mosaic: sand on every other tile, deep in the middle of the board — a long sweep.
  {
    id: 24, cols: 7, rows: 7, colors: 5, moves: 24,
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
      '1010101',
      '0202020',
      '1020201',
      '0202020',
      '1020201',
      '0202020',
      '1010101',
    ],
    goals: [{ kind: 'sand' }],
    stars: [7900, 13400, 16900],
  },
  // [breather] The dune: a wide rounded board, two colours, nothing in the way.
  {
    id: 25, cols: 9, rows: 9, colors: 5, moves: 23,
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
  // [normal] The stairway: three-layer stones step down across the board.
  {
    id: 26, cols: 8, rows: 8, colors: 5, moves: 22,
    pieces: [
      '........',
      '........',
      '33......',
      '..33....',
      '....33..',
      '......33',
      '........',
      '........',
    ],
    goals: [{ kind: 'stone' }],
    stars: [4300, 10000, 14600],
  },
  // [normal] Lamps over stones: each of the three lamps must break through the stone under it.
  {
    id: 27, cols: 8, rows: 7, colors: 5, moves: 29,
    pieces: [
      '.L..L.L.',
      '........',
      '........',
      '.2..2.2.',
      '........',
      '........',
      '........',
    ],
    goals: [{ kind: 'lamp', target: 3 }],
    stars: [6000, 10600, 14600],
  },
  // [build-up] The crossing: a plus-shaped board, two colours to gather in its narrow arms.
  {
    id: 28, cols: 8, rows: 8, colors: 5, moves: 21,
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
    goals: [
      { kind: 'color', color: 0, target: 28 },
      { kind: 'color', color: 3, target: 28 },
    ],
    stars: [2900, 4300, 5700],
  },
  // [spike] The buried gate: lamps blocked by stones, and a sandy floor with a deep seam to clear as well.
  {
    id: 29, cols: 8, rows: 8, colors: 5, moves: 23,
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
      '01111110',
      '01222210',
      '01111110',
    ],
    goals: [
      { kind: 'lamp', target: 2 },
      { kind: 'sand' },
    ],
    stars: [7500, 14300, 19000],
  },
  // [breather] The picture frame: sand around a gap in the board, a second ring outside it.
  {
    id: 30, cols: 8, rows: 9, colors: 5, moves: 24,
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
      '00111100',
      '01211210',
      '01100110',
      '01100110',
      '01100110',
      '01211210',
      '00111100',
      '00000000',
    ],
    goals: [{ kind: 'sand' }],
    stars: [4300, 8500, 13100],
  },
  // [tutorial] Chains: chained gems cannot move — match each one where it stands. Four colours keep it gentle.
  {
    id: 31, cols: 7, rows: 7, colors: 4, moves: 20,
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
  // [normal] The locked court: sand under a ring of chained gems, deepest inside the ring.
  {
    id: 32, cols: 8, rows: 8, colors: 5, moves: 25,
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
      '01111110',
      '01222210',
      '01222210',
      '01222210',
      '01222210',
      '01111110',
      '00000000',
    ],
    goals: [{ kind: 'sand' }],
    stars: [4900, 10800, 16100],
  },
  // [build-up] The chain curtain: eighteen chained gems hang in a lattice — every one has to be matched in place.
  {
    id: 33, cols: 8, rows: 8, colors: 5, moves: 20,
    pieces: [
      '........',
      '..c..c..',
      '.c.cc.c.',
      '..c..c..',
      '.c.cc.c.',
      '..c..c..',
      '...cc...',
      '........',
    ],
    goals: [{ kind: 'chain' }],
    stars: [8900, 15900, 21400],
  },
  // [spike] Lamps on chains: each lamp rests on a chained gem — break the chain before the lamp can sink.
  {
    id: 34, cols: 7, rows: 7, colors: 5, moves: 25,
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
  // [breather] The sealed prism: a prism locked inside a ring of stones — free it and the amber falls in heaps.
  {
    id: 35, cols: 7, rows: 7, colors: 5, moves: 26,
    pieces: [
      '.......',
      '.......',
      '..222..',
      '..2P2..',
      '..222..',
      '.......',
      '.......',
    ],
    goals: [{ kind: 'color', color: 1, target: 35 }],
    stars: [6200, 10000, 13200],
  },
  // [normal] The weave: thick stones and chained gems alternate in two rows.
  {
    id: 36, cols: 8, rows: 8, colors: 5, moves: 22,
    pieces: [
      '........',
      '........',
      '........',
      '.3c3c3c.',
      '.c3c3c3.',
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
  // [normal] The descent: three lamps at two heights come down a board with clipped lower corners.
  {
    id: 37, cols: 8, rows: 7, colors: 5, moves: 27,
    pieces: [
      '..L..L..',
      '........',
      '....L...',
      '........',
      '........',
      '........',
      '_......_',
    ],
    goals: [{ kind: 'lamp', target: 3 }],
    stars: [8700, 13600, 17000],
  },
  // [build-up] The hourglass: sand in both bulbs, deepest where the glass narrows.
  {
    id: 38, cols: 7, rows: 8, colors: 5, moves: 22,
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
      '0111110',
      '0122210',
      '0012100',
      '0001000',
      '0012100',
      '0122210',
      '1222221',
      '0111110',
    ],
    goals: [{ kind: 'sand' }],
    stars: [7500, 12800, 16300],
  },
  // [hard] The buried caravan: three lamps on chained gems above a deep pyramid of sand. The first hard level.
  {
    id: 39, cols: 9, rows: 9, colors: 5, moves: 23,
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
      '011111110',
    ],
    goals: [
      { kind: 'lamp', target: 3 },
      { kind: 'sand' },
    ],
    stars: [11100, 22100, 29400],
  },
  // [finale] The dune crest: three colours, a prism and a nova lying ready, a few chains and stones for show.
  {
    id: 40, cols: 8, rows: 8, colors: 5, moves: 21,
    pieces: [
      '........',
      '.c....c.',
      '........',
      '...2P...',
      '...N2...',
      '........',
      '.c....c.',
      '........',
    ],
    goals: [
      { kind: 'color', color: 0, target: 30 },
      { kind: 'color', color: 2, target: 30 },
      { kind: 'color', color: 3, target: 30 },
    ],
    stars: [3700, 7400, 10500],
  },
];
