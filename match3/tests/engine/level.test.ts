import { describe, expect, it } from 'vitest';
import { Game, parseLevel, pieceSpecFor, validateLevel, type LevelDef } from '../../src/engine/index.ts';
import { picture, refHasMatch, refValidMoves } from './helpers.ts';

const good = (): LevelDef => ({
  id: 1,
  cols: 7,
  rows: 7,
  colors: 5,
  moves: 20,
  pieces: ['.......', '.......', '.......', '.......', '.......', '.......', '.......'],
  goals: [{ kind: 'score', target: 1000 }],
  stars: [1000, 2000, 3000],
});

/** validateLevel must report a problem matching `pattern` for the level produced by `change`. */
function expectProblem(change: (level: LevelDef) => void, pattern: RegExp): void {
  const level = good();
  change(level);
  const problems = validateLevel(level);
  expect(problems.some((p) => pattern.test(p)), `expected a problem matching ${String(pattern)} in ${JSON.stringify(problems)}`).toBe(true);
}

describe('validateLevel', () => {
  it('accepts a plain level', () => {
    expect(validateLevel(good())).toEqual([]);
  });

  it('accepts a level that uses every feature and every legal character', () => {
    const level: LevelDef = {
      id: 42,
      cols: 9,
      rows: 9,
      colors: 6,
      moves: 30,
      pieces: ['__.....__', '_...L..._', '..c...c..', '.1.2.3.v.', '..H.V.N..', '....P....', 'abCdef...', '...ABDEF.', '_......._'],
      floor: ['000000000', '001111100', '002222200', '000000000', '000000000', '000000000', '000000000', '000000000', '000000000'],
      goals: [{ kind: 'sand' }, { kind: 'stone' }, { kind: 'vine' }, { kind: 'chain' }, { kind: 'lamp', target: 2 }, { kind: 'color', color: 5, target: 20 }, { kind: 'score', target: 500 }],
      stars: [3000, 6000, 9000],
      lamps: { total: 3, maxOnBoard: 2, everyMoves: 3 },
      hard: true,
      tutorial: 'lamps',
    };
    expect(validateLevel(level)).toEqual([]);
    // and the engine starts it cleanly
    const s = new Game(level, { seed: 3 }).snapshot();
    expect(s.status).toBe('playing');
    expect(refHasMatch(s)).toBe(false);
    expect(refValidMoves(s).length).toBeGreaterThan(0);
    expect(picture(s)[6]!.split(' ').slice(0, 6)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(picture(s)[7]!.split(' ').slice(3, 8)).toEqual(['a', 'b', 'd', 'e', 'f']);
  });

  it('checks ids, dimensions, colours and moves', () => {
    expectProblem((l) => (l.id = 0), /id must be a positive integer/);
    expectProblem((l) => (l.cols = 0), /cols must be an integer from 1 to 9/);
    expectProblem((l) => (l.cols = 10), /cols must be/);
    expectProblem((l) => (l.rows = 2.5), /rows must be/);
    expectProblem((l) => (l.colors = 2), /colors must be an integer from 3 to 6/);
    expectProblem((l) => (l.colors = 7), /colors must be/);
    expectProblem((l) => (l.moves = 0), /moves must be a positive integer/);
    expectProblem((l) => (l.moves = 3.5), /moves must be/);
  });

  it('checks the shape and characters of the piece and floor layers', () => {
    expectProblem((l) => l.pieces.pop(), /pieces has 6 rows, expected 7/);
    expectProblem((l) => (l.pieces[2] = '......'), /pieces row 2 has 6 characters, expected 7/);
    expectProblem((l) => (l.pieces[3] = '...x...'), /pieces row 3, column 3: illegal character 'x'/);
    expectProblem((l) => (l.pieces[3] = '...4...'), /illegal character '4'/);
    expectProblem((l) => (l.pieces = 'nope' as never), /pieces must be an array/);
    expectProblem((l) => (l.floor = ['0000000']), /floor has 1 rows, expected 7/);
    expectProblem((l) => (l.floor = new Array<string>(7).fill('000000')), /floor row 0 has 6 characters/);
    expectProblem((l) => (l.floor = new Array<string>(7).fill('0003000')), /floor row 0, column 3: illegal character '3'/);
    expectProblem((l) => {
      l.pieces[0] = '_......';
      l.floor = ['1000000', '0000000', '0000000', '0000000', '0000000', '0000000', '0000000'];
    }, /sand on a hole/);
    expectProblem((l) => (l.pieces[0] = '.....F.'), /fixed colour 'F' is outside the level's 5 colours/);
  });

  it('checks the stars', () => {
    expectProblem((l) => (l.stars = [1000, 1000, 3000]), /stars must be strictly ascending/);
    expectProblem((l) => (l.stars = [3000, 2000, 1000]), /strictly ascending/);
    expectProblem((l) => (l.stars = [0, 2000, 3000]), /three positive integers/);
    expectProblem((l) => (l.stars = [1000, 2000] as never), /three positive integers/);
    expectProblem((l) => (l.stars = [1000.5, 2000, 3000]), /three positive integers/);
  });

  it('checks that the goals fit the board', () => {
    expectProblem((l) => (l.goals = []), /at least one goal/);
    expectProblem((l) => (l.goals = [{ kind: 'sand' }]), /sand goal, but the floor has no sand/);
    expectProblem((l) => (l.goals = [{ kind: 'stone' }]), /stone goal, but the board has no stones/);
    expectProblem((l) => (l.goals = [{ kind: 'vine' }]), /vine goal, but the board has no vines/);
    expectProblem((l) => (l.goals = [{ kind: 'chain' }]), /chain goal, but the board has no chained/);
    expectProblem((l) => (l.goals = [{ kind: 'lamp', target: 1 }]), /lamp goal, but no lamps/);
    expectProblem((l) => {
      l.goals = [{ kind: 'lamp', target: 4 }];
      l.lamps = { total: 3, maxOnBoard: 1, everyMoves: 2 };
    }, /lamp goal wants 4 lamps but only 3 will ever exist/);
    expectProblem((l) => (l.goals = [{ kind: 'lamp', target: 0 }]), /lamp goal: target must be a positive integer/);
    expectProblem((l) => (l.goals = [{ kind: 'color', color: 5, target: 10 }]), /colour 5 does not spawn/);
    expectProblem((l) => (l.goals = [{ kind: 'color', color: 1, target: 0 }]), /colour goal: target must be a positive integer/);
    expectProblem((l) => (l.goals = [{ kind: 'score', target: 900 }]), /score-only level's target must equal the one-star score/);
    expectProblem((l) => (l.goals = [{ kind: 'score', target: -5 }]), /score goal: target must be a positive integer/);
    expectProblem((l) => (l.goals = [{ kind: 'color', color: 1, target: 5 }, { kind: 'color', color: 1, target: 9 }]), /duplicate goal 'color:1'/);
    expectProblem((l) => (l.goals = [{ kind: 'gems' } as never]), /unknown goal/);
    // the things each goal needs make it valid
    const sand = good();
    sand.floor = ['0000000', '0011100', '0000000', '0000000', '0000000', '0000000', '0000000'];
    sand.goals = [{ kind: 'sand' }];
    expect(validateLevel(sand)).toEqual([]);
    const mixed = good();
    mixed.pieces[3] = '.1.c.v.';
    mixed.goals = [{ kind: 'stone' }, { kind: 'chain' }, { kind: 'vine' }, { kind: 'score', target: 250 }, { kind: 'color', color: 0, target: 12 }, { kind: 'color', color: 1, target: 12 }];
    expect(validateLevel(mixed)).toEqual([]);
  });

  it('checks lamp settings and that lamps can leave the board', () => {
    expectProblem((l) => (l.lamps = { total: 0, maxOnBoard: 1, everyMoves: 1 }), /lamps.total must be a positive integer/);
    expectProblem((l) => (l.lamps = { total: 2, maxOnBoard: 0, everyMoves: 1 }), /lamps.maxOnBoard must be a positive integer/);
    expectProblem((l) => (l.lamps = { total: 2, maxOnBoard: 1, everyMoves: -1 }), /lamps.everyMoves must be a non-negative integer/);
    expectProblem((l) => {
      l.pieces[6] = '...L...';
      l.goals = [{ kind: 'lamp', target: 1 }];
    }, /lamp at column 3, row 6 starts on an exit cell/);
    expectProblem((l) => {
      l.pieces[1] = '...L...';
      l.pieces[3] = '..._...';
      l.goals = [{ kind: 'lamp', target: 1 }];
    }, /lamp at column 3, row 1 has a hole between it and the exit/);
    expectProblem((l) => {
      l.pieces[3] = '_______';
      l.pieces[4] = '.......';
      l.goals = [{ kind: 'lamp', target: 2 }];
      l.lamps = { total: 2, maxOnBoard: 1, everyMoves: 1 };
    }, /no column runs without a gap/);
    const ok = good();
    ok.pieces[1] = '..L.L..';
    ok.goals = [{ kind: 'lamp', target: 3 }];
    ok.lamps = { total: 4, maxOnBoard: 2, everyMoves: 0 };
    expect(validateLevel(ok)).toEqual([]);
    // lamps placed in the level alone are enough for a lamp goal
    const placed = good();
    placed.pieces[1] = '..L.L..';
    placed.goals = [{ kind: 'lamp', target: 2 }];
    expect(validateLevel(placed)).toEqual([]);
  });

  it('finds cells that no spawner can ever feed', () => {
    const level = good();
    level.cols = 3;
    level.rows = 3;
    level.pieces = ['...', '__.', '...'];
    expect(validateLevel(level)).toEqual(['cell column 0, row 2 can never be refilled (no spawner feeds it)']);
    // a hole in the middle of a column is fine: the cells under it are fed diagonally
    const fine = good();
    fine.pieces[2] = '..._...';
    expect(validateLevel(fine)).toEqual([]);
    // so are missing column tops and bottoms
    const ragged = good();
    ragged.pieces[0] = '_.._.._';
    ragged.pieces[6] = '._..._.';
    expect(validateLevel(ragged)).toEqual([]);
  });

  it('checks the start position', () => {
    expectProblem((l) => (l.pieces[0] = 'aaa....'), /fixed colours already form a match/);
    expectProblem((l) => {
      l.cols = 3;
      l.rows = 3;
      l.colors = 3;
      l.pieces = ['abC', 'bCa', 'Cab'];
    }, /the fixed start position has no valid move/);
    expectProblem((l) => {
      l.cols = 2;
      l.rows = 2;
      l.pieces = ['..', '..'];
    }, /no move can ever be made on this board/);
    expectProblem((l) => {
      l.pieces = ['3333333', '3333333', '3333333', '3.3.3.3', '3333333', '3333333', '3333333'];
    }, /no move can ever be made/);
    // a fully fixed tutorial board with a move is fine
    const tutorial = good();
    tutorial.cols = 4;
    tutorial.rows = 3;
    tutorial.colors = 3;
    tutorial.pieces = ['abCa', 'aabC', 'bCab'];
    expect(validateLevel(tutorial)).toEqual([]);
  });

  it('reports several problems at once and never throws on garbage', () => {
    const level = good();
    level.colors = 9;
    level.moves = -1;
    level.stars = [5, 4, 3];
    level.goals = [];
    expect(validateLevel(level).length).toBeGreaterThanOrEqual(4);
    expect(() => validateLevel({} as never)).not.toThrow();
    expect(validateLevel({} as never).length).toBeGreaterThan(3);
    expect(() => validateLevel({ ...good(), goals: [null] } as never)).not.toThrow();
    expect(() => validateLevel({ ...good(), pieces: [1, 2, 3, 4, 5, 6, 7] } as never)).not.toThrow();
  });

  it('is deterministic', () => {
    const level = good();
    level.pieces = ['3333333', '3333333', '33...33', '33...33', '33...33', '3333333', '3333333'];
    expect(validateLevel(level)).toEqual(validateLevel(level));
  });
});

describe('parseLevel', () => {
  it('maps every character of the piece layer', () => {
    expect(pieceSpecFor('_')).toBe('hole');
    expect(pieceSpecFor('.')).toMatchObject({ kind: 'gem', chained: false });
    expect(pieceSpecFor('c')).toMatchObject({ kind: 'gem', chained: true }); // always the chained gem …
    expect(pieceSpecFor('C')).toEqual({ kind: 'gem', color: 2, hp: 1, chained: false }); // … fixed colour 2 is 'C'
    expect(['a', 'b', 'd', 'e', 'f'].map((ch) => (pieceSpecFor(ch) as { color: number }).color)).toEqual([0, 1, 3, 4, 5]);
    expect(['A', 'B', 'C', 'D', 'E', 'F'].map((ch) => (pieceSpecFor(ch) as { color: number }).color)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(['1', '2', '3'].map((ch) => pieceSpecFor(ch))).toEqual([
      { kind: 'stone', color: -1, hp: 1, chained: false },
      { kind: 'stone', color: -1, hp: 2, chained: false },
      { kind: 'stone', color: -1, hp: 3, chained: false },
    ]);
    expect(pieceSpecFor('v')).toEqual({ kind: 'vine', color: -1, hp: 1, chained: false });
    expect(pieceSpecFor('L')).toEqual({ kind: 'lamp', color: -1, hp: 1, chained: false });
    expect(pieceSpecFor('P')).toEqual({ kind: 'prism', color: -1, hp: 1, chained: false });
    expect(['H', 'V', 'N'].map((ch) => (pieceSpecFor(ch) as { kind: string }).kind)).toEqual(['beamH', 'beamV', 'nova']);
    for (const bad of ['x', '4', '0', ' ', 'G', 'g', '', 'ab']) expect(pieceSpecFor(bad)).toBeNull();
  });

  it('marks the top cell of each column as spawner and the bottom cell as exit', () => {
    const level = good();
    level.cols = 4;
    level.rows = 4;
    level.pieces = ['_..L', '.._.', '....', '._..'];
    level.floor = ['0120', '0000', '0000', '2001'];
    const p = parseLevel(level);
    const flags = (list: boolean[]): string[] => [0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => (list[r * 4 + c] ? 'x' : '.')).join(''));
    expect(flags(p.exists)).toEqual(['.xxx', 'xx.x', 'xxxx', 'x.xx']);
    expect(flags(p.spawner)).toEqual(['.xxx', 'x...', '....', '....']);
    expect(flags(p.exit)).toEqual(['....', '....', '.x..', 'x.xx']);
    expect(p.sand).toEqual([0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 1]);
    expect(p.specs[3]).toMatchObject({ kind: 'lamp' });
    expect(p.specs[0]).toBeNull();
    // the Game exposes the same structure
    const s = new Game(level, { seed: 1 }).snapshot();
    expect(flags(s.cells.map((c) => c.exists))).toEqual(flags(p.exists));
    expect(flags(s.cells.map((c) => c.spawner))).toEqual(flags(p.spawner));
    expect(flags(s.cells.map((c) => c.exit))).toEqual(flags(p.exit));
    expect(s.cells.map((c) => c.sand)).toEqual(p.sand);
    for (const cell of s.cells) if (!cell.exists) expect(cell).toEqual({ exists: false, piece: null, sand: 0, exit: false, spawner: false });
  });

  it('is tolerant: the Game never crashes on a malformed level', () => {
    const broken = { id: 1, cols: 4, rows: 3, colors: 4, moves: 5, pieces: ['..x', '....'], goals: [{ kind: 'score', target: 10 }], stars: [10, 20, 30] } as LevelDef;
    const p = parseLevel(broken);
    expect(p.exists).toEqual([true, true, true, false, true, true, true, true, false, false, false, false]);
    expect(() => new Game(broken, { seed: 1 }).snapshot()).not.toThrow();
    expect(() => new Game({ ...broken, cols: 0 }, { seed: 1 }).snapshot()).not.toThrow();
    expect(new Game({ ...broken, cols: 0 }, { seed: 1 }).snapshot().status).toBe('lost');
    expect(() => new Game({ ...broken, pieces: undefined as never, goals: undefined as never }, { seed: 1 }).validMoves()).not.toThrow();
  });
});
