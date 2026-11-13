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
    goals: [{ kind: 'score', target: 1500 }],
    stars: [1500, 3000, 4500],
  },
  // Collecting: gather rubies on a slightly larger board.
  {
    id: 2, cols: 7, rows: 7, colors: 4, moves: 16,
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
    stars: [1500, 3000, 4500],
  },
  // The beam: four rubies are one swap away from a line of four.
  {
    id: 3, cols: 7, rows: 7, colors: 4, moves: 16,
    tutorial: 'beam',
    pieces: [
      '.......',
      '.......',
      '...a...',
      'daabad.',
      '...d...',
      '.......',
      '.......',
    ],
    goals: [{ kind: 'color', color: 0, target: 40 }],
    stars: [1500, 3000, 4500],
  },
  // The nova: an L of rubies waits to be closed.
  {
    id: 4, cols: 7, rows: 7, colors: 4, moves: 15,
    tutorial: 'nova',
    pieces: [
      '.......',
      '...d...',
      '...a...',
      '...a...',
      'daaba..',
      '.......',
      '.......',
    ],
    goals: [{ kind: 'score', target: 2000 }],
    stars: [2000, 3500, 5000],
  },
  // The prism: five in a row, then trade it with a ruby.
  {
    id: 5, cols: 8, rows: 7, colors: 4, moves: 16,
    tutorial: 'prism',
    pieces: [
      '........',
      '........',
      '....a...',
      '.daabaad',
      '........',
      '........',
      '........',
    ],
    goals: [{ kind: 'color', color: 0, target: 60 }],
    stars: [2000, 4000, 6000],
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
    stars: [1500, 3000, 4500],
  },
  // Footprints: a ring of sand on a board with clipped corners.
  {
    id: 7, cols: 8, rows: 8, colors: 5, moves: 20,
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
    stars: [1500, 3000, 4500],
  },
  // The well: a hole in the middle, two colours to draw from around it.
  {
    id: 8, cols: 8, rows: 8, colors: 5, moves: 22,
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
    stars: [2000, 4000, 6000],
  },
  // Deep water: sand that takes two hits, thickest at the centre.
  {
    id: 9, cols: 7, rows: 7, colors: 5, moves: 24,
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
    stars: [2000, 4000, 6000],
  },
  // Buried lanes: deep sand along both edges and the floor — the awkward places.
  {
    id: 10, cols: 8, rows: 8, colors: 5, moves: 26,
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
    stars: [2000, 4000, 6000],
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
    goals: [{ kind: 'score', target: 2500 }],
    stars: [2500, 4000, 6000],
  },
  // The fire ring: the first stones — a ring around one sealed gem, and four posts.
  {
    id: 12, cols: 7, rows: 7, colors: 5, moves: 20,
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
    stars: [1500, 3000, 4500],
  },
  // Stepping stones: two staggered rows of two-layer stones.
  {
    id: 13, cols: 8, rows: 8, colors: 5, moves: 24,
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
    stars: [2000, 4000, 6000],
  },
  // Buried treasure: a sand patch with stones sitting on its centre.
  {
    id: 14, cols: 8, rows: 8, colors: 5, moves: 24,
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
    stars: [2000, 4000, 6000],
  },
  // The cut gem: an octagonal board and three colours to gather.
  {
    id: 15, cols: 8, rows: 8, colors: 5, moves: 24,
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
    stars: [2000, 4000, 6000],
  },
  // Crossed lights: a beam and a nova side by side — swap them and the sand cross is gone.
  {
    id: 16, cols: 7, rows: 7, colors: 5, moves: 15,
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
    stars: [2000, 4000, 6000],
  },
  // The vault: thick stones walled in by thin ones.
  {
    id: 17, cols: 8, rows: 8, colors: 5, moves: 28,
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
    stars: [2000, 4000, 6000],
  },
  // Twin pools: two boards joined by a channel; sand in both pools and along the channel.
  {
    id: 18, cols: 9, rows: 8, colors: 5, moves: 26,
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
    stars: [2000, 4000, 6000],
  },
  // The tiled court: stones on a checkerboard, amber to gather between them.
  {
    id: 19, cols: 8, rows: 8, colors: 5, moves: 24,
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
    stars: [2000, 4000, 6000],
  },
  // The oasis gate: a frame of sand, deep on the inside, with stone corner posts and a keystone.
  {
    id: 20, cols: 9, rows: 9, colors: 5, moves: 28,
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
      '011111110',
      '012222210',
      '012000210',
      '012000210',
      '012000210',
      '012222210',
      '011111110',
      '000000000',
    ],
    goals: [{ kind: 'sand' }, { kind: 'stone' }],
    stars: [3000, 5000, 7000],
  },
];
