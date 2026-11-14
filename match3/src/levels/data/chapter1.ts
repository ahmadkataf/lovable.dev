/**
 * Chapter 1 — Oasis (levels 1–20). The basics, one new idea at a time:
 * match → collect → beam → nova → prism → sand → double sand → stone → special + special.
 * Four colours for the first five levels, five afterwards.
 *
 * Layouts, colours and goals are designed by hand. `moves`, score targets and `stars` are fitted
 * by `node tools/levelgen/tune.ts` — change a layout, then run the tuner again.
 * Piece / floor notation: see `LevelDef` in src/engine/types.ts.
 */
import type { LevelDef } from '../../engine/types.ts';

export const CHAPTER_1: readonly LevelDef[] = [
  // First steps: a small open board, nothing but matching.
  {
    id: 1, cols: 6, rows: 6, colors: 4, moves: 14,
    tutorial: 'match',
    pieces: [
      '......',
      '......',
      '......',
      '......',
      '......',
      '......',
    ],
    goals: [{ kind: 'score', target: 2850 }],
    stars: [2850, 10800, 16600],
  },
  // Collecting: gather rubies on a slightly larger board.
  {
    id: 2, cols: 7, rows: 7, colors: 4, moves: 15,
    tutorial: 'collect',
    pieces: [
      '.......',
      '.......',
      '.......',
      '.......',
      '.......',
      '.......',
      '.......',
    ],
    goals: [{ kind: 'color', color: 0, target: 35 }],
    stars: [5900, 14900, 22100],
  },
  // The beam: a fixed start board (a = ruby … d = sapphire) — the ruby at column 3, row 2 drops into a line of four.
  {
    id: 3, cols: 7, rows: 7, colors: 4, moves: 16,
    tutorial: 'beam',
    pieces: [
      'CaCaadb',
      'CbCdbaa',
      'dCbabCC',
      'daabadC',
      'CCbdaad',
      'bbCCbad',
      'adbaCbb',
    ],
    goals: [{ kind: 'color', color: 0, target: 40 }],
    stars: [7100, 16500, 23700],
  },
  // The nova: a fixed start board — the ruby at column 4, row 4 slides left and closes an L.
  {
    id: 4, cols: 7, rows: 7, colors: 4, moves: 15,
    tutorial: 'nova',
    pieces: [
      'aadCCbb',
      'aCCdbad',
      'CababCb',
      'dbdaaba',
      'daababC',
      'aadCCdd',
      'Cddaabb',
    ],
    goals: [{ kind: 'score', target: 6350 }],
    stars: [6350, 22900, 32800],
  },
  // The prism: a fixed start board — the ruby at column 4, row 2 drops into five in a row; then trade the prism with a ruby.
  {
    id: 5, cols: 8, rows: 7, colors: 4, moves: 19,
    tutorial: 'prism',
    pieces: [
      'bbCbbddb',
      'bdabCbad',
      'aCdaabbC',
      'bdaabaad',
      'aCddCCab',
      'bbCbbdCd',
      'bddaCaba',
    ],
    goals: [{ kind: 'color', color: 0, target: 60 }],
    stars: [11700, 23600, 31000],
  },
  // The pond: the first sand, a shallow patch in the middle of the board.
  {
    id: 6, cols: 7, rows: 7, colors: 5, moves: 18,
    tutorial: 'sand',
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
      '0000000',
      '0000000',
      '0111110',
      '0111110',
      '0111110',
      '0000000',
      '0000000',
    ],
    goals: [{ kind: 'sand' }],
    stars: [4500, 7600, 11100],
  },
  // Footprints: a ring of sand on a board with clipped corners.
  {
    id: 7, cols: 8, rows: 8, colors: 5, moves: 21,
    pieces: [
      '__....__',
      '_......_',
      '........',
      '........',
      '........',
      '........',
      '_......_',
      '__....__',
    ],
    floor: [
      '00000000',
      '00111100',
      '01100110',
      '01000010',
      '01000010',
      '01100110',
      '00111100',
      '00000000',
    ],
    goals: [{ kind: 'sand' }],
    stars: [4900, 9100, 13600],
  },
  // The well: a hole in the middle, two colours to draw from around it.
  {
    id: 8, cols: 8, rows: 8, colors: 5, moves: 23,
    pieces: [
      '........',
      '........',
      '........',
      '...__...',
      '...__...',
      '........',
      '........',
      '........',
    ],
    goals: [
      { kind: 'color', color: 1, target: 24 },
      { kind: 'color', color: 3, target: 24 },
    ],
    stars: [3600, 8700, 12100],
  },
  // Deep water: sand that takes two hits, thickest at the centre.
  {
    id: 9, cols: 7, rows: 7, colors: 5, moves: 21,
    tutorial: 'sand2',
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
      '0000000',
      '0011100',
      '0112110',
      '0122210',
      '0112110',
      '0011100',
      '0000000',
    ],
    goals: [{ kind: 'sand' }],
    stars: [5300, 9500, 13100],
  },
  // Buried lanes: deep sand along both edges and the floor — the awkward places.
  {
    id: 10, cols: 8, rows: 8, colors: 5, moves: 23,
    hard: true,
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
      '00000000',
      '00000000',
      '00000000',
      '20000002',
      '20000002',
      '20000002',
      '20000002',
      '21111112',
    ],
    goals: [{ kind: 'sand' }],
    stars: [6500, 13600, 19100],
  },
  // The hourglass: a narrow waist, points only.
  {
    id: 11, cols: 7, rows: 7, colors: 5, moves: 20,
    pieces: [
      '.......',
      '.......',
      '_....._',
      '__...__',
      '_....._',
      '.......',
      '.......',
    ],
    goals: [{ kind: 'score', target: 3050 }],
    stars: [3050, 5600, 8400],
  },
  // The fire ring: the first stones — a ring around one sealed gem, and four posts.
  {
    id: 12, cols: 7, rows: 7, colors: 5, moves: 16,
    tutorial: 'stone',
    pieces: [
      '.......',
      '.1...1.',
      '..111..',
      '..1.1..',
      '..111..',
      '.1...1.',
      '.......',
    ],
    goals: [{ kind: 'stone' }],
    stars: [3300, 6400, 9600],
  },
  // Stepping stones: two staggered rows of two-layer stones.
  {
    id: 13, cols: 8, rows: 8, colors: 5, moves: 19,
    pieces: [
      '........',
      '........',
      '........',
      '2.2..2.2',
      '.2.22.2.',
      '........',
      '........',
      '........',
    ],
    goals: [{ kind: 'stone' }, { kind: 'color', color: 2, target: 24 }],
    stars: [4800, 9700, 15100],
  },
  // Buried treasure: a sand patch with stones sitting on its centre.
  {
    id: 14, cols: 8, rows: 8, colors: 5, moves: 16,
    pieces: [
      '........',
      '........',
      '........',
      '...11...',
      '...11...',
      '........',
      '........',
      '........',
    ],
    floor: [
      '00000000',
      '00000000',
      '01111110',
      '01122110',
      '01122110',
      '01111110',
      '00000000',
      '00000000',
    ],
    goals: [{ kind: 'sand' }],
    stars: [4900, 10200, 14900],
  },
  // The cut gem: an octagonal board and three colours to gather.
  {
    id: 15, cols: 8, rows: 8, colors: 5, moves: 19,
    pieces: [
      '___..___',
      '__....__',
      '_......_',
      '........',
      '........',
      '_......_',
      '__....__',
      '___..___',
    ],
    goals: [
      { kind: 'color', color: 0, target: 18 },
      { kind: 'color', color: 2, target: 18 },
      { kind: 'color', color: 4, target: 18 },
    ],
    stars: [3200, 6000, 8400],
  },
  // Crossed lights: a beam and a nova side by side — swap them and the sand cross is gone.
  {
    id: 16, cols: 7, rows: 7, colors: 5, moves: 19,
    tutorial: 'combo',
    pieces: [
      '.......',
      '.......',
      '.......',
      '..HN...',
      '.......',
      '.......',
      '.......',
    ],
    floor: [
      '0011100',
      '0011100',
      '1111111',
      '1111111',
      '1111111',
      '0011100',
      '0011100',
    ],
    goals: [{ kind: 'sand' }],
    stars: [6400, 9200, 12900],
  },
  // The vault: thick stones walled in by thin ones.
  {
    id: 17, cols: 8, rows: 8, colors: 5, moves: 18,
    pieces: [
      '........',
      '........',
      '..1111..',
      '..1331..',
      '..1331..',
      '..1111..',
      '........',
      '........',
    ],
    goals: [{ kind: 'stone' }],
    stars: [4300, 8600, 13200],
  },
  // Twin pools: two boards joined by a channel; sand in both pools and along the channel.
  {
    id: 18, cols: 9, rows: 8, colors: 5, moves: 30,
    pieces: [
      '...._....',
      '...._....',
      '...._....',
      '...._....',
      '...._....',
      '.........',
      '.........',
      '.........',
    ],
    floor: [
      '000000000',
      '000000000',
      '011000110',
      '011000110',
      '022000220',
      '000010000',
      '000010000',
      '000010000',
    ],
    goals: [{ kind: 'sand' }],
    stars: [6600, 11300, 14700],
  },
  // The tiled court: stones on a checkerboard, amber to gather between them.
  {
    id: 19, cols: 8, rows: 8, colors: 5, moves: 17,
    pieces: [
      '........',
      '........',
      '.1.1.1..',
      '..1.1.1.',
      '.1.1.1..',
      '..1.1.1.',
      '........',
      '........',
    ],
    goals: [{ kind: 'stone' }, { kind: 'color', color: 1, target: 24 }],
    stars: [4300, 9300, 14700],
  },
  // The oasis gate: a sandy court with a deep rim, stone corner posts and a keystone — and a sixth colour.
  {
    id: 20, cols: 9, rows: 9, colors: 6, moves: 21,
    hard: true,
    pieces: [
      '.........',
      '.........',
      '..2...2..',
      '.........',
      '....3....',
      '.........',
      '..2...2..',
      '.........',
      '.........',
    ],
    floor: [
      '000000000',
      '000000000',
      '002222200',
      '002111200',
      '002111200',
      '002111200',
      '002222200',
      '000000000',
      '000000000',
    ],
    goals: [{ kind: 'sand' }, { kind: 'stone' }],
    stars: [5700, 10100, 14000],
  },
];
