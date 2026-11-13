/**
 * Chapter 1 — Oasis (levels 1–20). The basics, one new idea at a time:
 * match → collect → beam → nova → prism → sand → deep sand → stone → special + special.
 * Four colours for the first five levels, five afterwards. The first ten levels cannot really be
 * lost; after that two gentle peaks (14 and 19) and a generous finale.
 *
 * Layouts, colours and goals are designed by hand. `moves` and `stars` (and the target of a
 * score-only level) are fitted by `node tools/levelgen/tune.ts` — change a layout, then run the
 * tuner again. The comment above each level is its brief: tier, idea, intended feel.
 * Piece / floor notation: see `LevelDef` in src/engine/types.ts.
 */
import type { LevelDef } from '../../engine/types.ts';

export const CHAPTER_1: readonly LevelDef[] = [
  // [tutorial] First steps: a small board, nothing but matching. A fixed start board (a = ruby, b = amber, C = emerald, d = sapphire); impossible to get wrong.
  {
    id: 1, cols: 6, rows: 6, colors: 4, moves: 12,
    tutorial: 'match',
    pieces: [
      'abadaa',
      'aCbdbC',
      'dadbbC',
      'daCbCa',
      'adaCCb',
      'abaabC',
    ],
    goals: [{ kind: 'score', target: 1150 }],
    stars: [1150, 9400, 15000],
  },
  // [tutorial] Collecting: gather rubies. A fixed start board whose hinted move is a match of rubies; the level ends early and the spare moves burst.
  {
    id: 2, cols: 7, rows: 6, colors: 4, moves: 20,
    tutorial: 'collect',
    pieces: [
      'ddaaCdd',
      'daabdCd',
      'bbCCaCb',
      'bCabbaC',
      'abbCaab',
      'daaCCda',
    ],
    goals: [{ kind: 'color', color: 0, target: 25 }],
    stars: [5900, 12600, 18200],
  },
  // [tutorial] The beam: a fixed start board (a = ruby … d = sapphire) — the ruby at column 3, row 2 drops into a line of four.
  {
    id: 3, cols: 7, rows: 7, colors: 4, moves: 23,
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
    goals: [{ kind: 'color', color: 0, target: 30 }],
    stars: [7700, 16500, 23200],
  },
  // [tutorial] The nova: a fixed start board whose hinted move closes an L of five. Points only.
  {
    id: 4, cols: 7, rows: 8, colors: 4, moves: 15,
    tutorial: 'nova',
    pieces: [
      'bddadCa',
      'abddaab',
      'Cbbddba',
      'adbCbCd',
      'baabbCd',
      'aCCdCbC',
      'bbCdCaC',
      'CbdCbCd',
    ],
    goals: [{ kind: 'score', target: 2000 }],
    stars: [2000, 27100, 39500],
  },
  // [tutorial] The prism: a fixed start board — the ruby at column 4, row 2 drops into five in a row; then trade the prism with a ruby.
  {
    id: 5, cols: 8, rows: 7, colors: 4, moves: 24,
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
    goals: [{ kind: 'color', color: 0, target: 30 }],
    stars: [8500, 19700, 27200],
  },
  // [tutorial] The pond: the first sand, a shallow patch in the middle of the board. A fifth colour joins. Fixed start board: the hinted move sweeps three tiles.
  {
    id: 6, cols: 7, rows: 7, colors: 5, moves: 19,
    tutorial: 'sand',
    pieces: [
      'eeaCeea',
      'eaabeaa',
      'Cdebadb',
      'dCdeeCd',
      'dbdeCab',
      'adeCede',
      'bdCbCeb',
    ],
    floor: [
      '0000000',
      '0111110',
      '0111110',
      '0111110',
      '0111110',
      '0000000',
      '0000000',
    ],
    goals: [{ kind: 'sand' }],
    stars: [4000, 8300, 11900],
  },
  // [breather] Footprints: a ring of sand on a board with clipped corners. Easy sweeping practice.
  {
    id: 7, cols: 8, rows: 8, colors: 5, moves: 22,
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
    stars: [4900, 9300, 13100],
  },
  // [breather] The well: a hole in the middle, two colours to draw from around it.
  {
    id: 8, cols: 8, rows: 8, colors: 5, moves: 25,
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
      { kind: 'color', color: 1, target: 22 },
      { kind: 'color', color: 3, target: 22 },
    ],
    stars: [4200, 9400, 13200],
  },
  // [tutorial] Deep water: sand that takes two sweeps, thickest at the centre. Fixed start board: the hinted move sweeps deep sand.
  {
    id: 9, cols: 7, rows: 7, colors: 5, moves: 17,
    tutorial: 'sand2',
    pieces: [
      'aaCbbdC',
      'CddabCC',
      'ebeaaCd',
      'bddCada',
      'ebCbCaa',
      'dCCdCae',
      'bbaCeCe',
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
    stars: [3500, 7900, 11300],
  },
  // [breather] The hourglass: a narrow waist and one colour to gather. Rounds off the first ten with an easy win.
  {
    id: 10, cols: 7, rows: 7, colors: 5, moves: 28,
    pieces: [
      '.......',
      '.......',
      '_....._',
      '__...__',
      '_....._',
      '.......',
      '.......',
    ],
    goals: [{ kind: 'color', color: 4, target: 26 }],
    stars: [4200, 8800, 11300],
  },
  // [normal] Buried lanes: sand along both edges and the floor — the awkward places, one layer deep.
  {
    id: 11, cols: 8, rows: 8, colors: 5, moves: 26,
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
      '10000001',
      '10000001',
      '10000001',
      '10000001',
      '10000001',
      '01111110',
    ],
    goals: [{ kind: 'sand' }],
    stars: [5700, 12900, 18400],
  },
  // [tutorial] The fire ring: the first stones — a ring around one sealed gem, and four harder posts. Fixed start board: the hinted move cracks a stone.
  {
    id: 12, cols: 9, rows: 7, colors: 5, moves: 13,
    tutorial: 'stone',
    pieces: [
      'beCabdaeC',
      'e2bebbd2a',
      'aea111bbC',
      'eCd1e1ebb',
      'dda111bCb',
      'd2adeed2C',
      'CaCCdedCd',
    ],
    goals: [{ kind: 'stone' }],
    stars: [2500, 6700, 11200],
  },
  // [build-up] Stepping stones: three staggered rows of two-layer stones — the board below fills only through the gaps.
  {
    id: 13, cols: 8, rows: 8, colors: 5, moves: 20,
    pieces: [
      '........',
      '........',
      '2.2..2.2',
      '.2.22.2.',
      '2.2..2.2',
      '........',
      '........',
      '........',
    ],
    goals: [{ kind: 'stone' }],
    stars: [4200, 9700, 15200],
  },
  // [spike] Buried treasure: a sand court with stones sitting on its deep centre — the first gentle peak.
  {
    id: 14, cols: 8, rows: 9, colors: 5, moves: 19,
    pieces: [
      '........',
      '........',
      '........',
      '...22...',
      '...22...',
      '........',
      '........',
      '........',
      '........',
    ],
    floor: [
      '00000000',
      '01111110',
      '01111110',
      '01122110',
      '01122110',
      '01111110',
      '01111110',
      '01111110',
      '00000000',
    ],
    goals: [{ kind: 'sand' }],
    stars: [6900, 14200, 20500],
  },
  // [breather] The tiled court: amber to gather between stones on a checkerboard; the stones crumble along the way.
  {
    id: 15, cols: 9, rows: 8, colors: 5, moves: 22,
    pieces: [
      '.........',
      '.........',
      '.1.1.1.1.',
      '..1.1.1..',
      '.1.1.1.1.',
      '..1.1.1..',
      '.........',
      '.........',
    ],
    goals: [{ kind: 'color', color: 1, target: 30 }],
    stars: [5100, 12400, 18300],
  },
  // [tutorial] Crossed lights: a beam and a nova side by side — swap them and the top layer of the sand cross is gone.
  {
    id: 16, cols: 7, rows: 7, colors: 5, moves: 18,
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
      '1122211',
      '1122211',
      '1122211',
      '0011100',
      '0011100',
    ],
    goals: [{ kind: 'sand' }],
    stars: [5700, 9900, 13600],
  },
  // [normal] The vault: thick stones walled in by thin ones.
  {
    id: 17, cols: 8, rows: 8, colors: 5, moves: 19,
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
    stars: [3600, 9200, 14000],
  },
  // [build-up] Twin pools: two boards joined by a channel; sand in both pools and along the channel.
  {
    id: 18, cols: 9, rows: 8, colors: 5, moves: 20,
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
    stars: [3800, 8400, 12100],
  },
  // [spike] The oasis gate: a sandy court with a deep rim, stone corner posts and a keystone — the chapter's peak.
  {
    id: 19, cols: 9, rows: 9, colors: 5, moves: 19,
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
    goals: [{ kind: 'sand' }],
    stars: [6800, 15800, 23500],
  },
  // [finale] The cut gem: an octagonal board, three colours to gather and a prism waiting in the middle — a generous send-off.
  {
    id: 20, cols: 8, rows: 8, colors: 5, moves: 21,
    pieces: [
      '___..___',
      '__....__',
      '_......_',
      '...P....',
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
    stars: [3300, 7500, 10000],
  },
];
