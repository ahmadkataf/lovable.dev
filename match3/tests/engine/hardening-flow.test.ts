/**
 * Hardening, part 2 — hand-built boards for docs/DESIGN.md §2.6 – §2.12: gravity and diagonal
 * feeding (checked against a flood fill written here), lamps, vines, shuffles, goals / winning /
 * losing, the end bonus, addMoves, boosters, score arithmetic, rejected calls and determinism.
 *
 * Expectations come from the design text. Every call also runs through the independent Referee
 * of ./hardening-kit.ts. Notation: see `build()` in the kit.
 */
import { describe, expect, it } from 'vitest';
import { Game, SCORE, validateLevel } from '../../src/engine/index.ts';
import type { CellView, LevelDef, Piece, Pos, Snapshot, Step, TurnResult } from '../../src/engine/index.ts';
import {
  Audit,
  Referee,
  at,
  audit,
  build,
  cellAt,
  cellsOf,
  clearsOf,
  dice,
  hitCells,
  hitList,
  perform,
  picture,
  pieceAt,
  posKey,
  quietRun,
  refHasMatch,
  refMoves,
  stepTypes,
  stepsOf,
  type BuildOpts,
  type Call,
} from './hardening-kit.ts';

const D = 3;

const isFixed = (p: Piece | null): boolean => p !== null && (p.chained || p.kind === 'stone' || p.kind === 'vine');
const isSpecial = (p: Piece | null): boolean => p !== null && (p.kind === 'beamH' || p.kind === 'beamV' || p.kind === 'nova' || p.kind === 'prism');

/**
 * §2.6, written here from the design text: the cells a new piece can reach. A piece enters on a
 * spawner cell and from any cell it holds it can go straight down or diagonally down — through
 * existing cells that hold no immovable piece. Breadth-first from the spawners.
 */
function reachable(s: Snapshot): Set<string> {
  const open = (c: number, r: number): boolean => {
    if (c < 0 || r < 0 || c >= s.cols || r >= s.rows) return false;
    const cell = s.cells[r * s.cols + c];
    return cell.exists && !isFixed(cell.piece);
  };
  const seen = new Set<string>();
  const queue: Pos[] = [];
  for (let r = 0; r < s.rows; r++) {
    for (let c = 0; c < s.cols; c++) {
      if (s.cells[r * s.cols + c].spawner && open(c, r)) {
        seen.add(`${c},${r}`);
        queue.push(at(c, r));
      }
    }
  }
  while (queue.length > 0) {
    const p = queue.shift() as Pos;
    for (const dc of [0, -1, 1]) {
      const n = at(p.c + dc, p.r + 1);
      if (!open(n.c, n.r) || seen.has(posKey(n))) continue;
      seen.add(posKey(n));
      queue.push(n);
    }
  }
  return seen;
}

function emptyCells(s: Snapshot): string[] {
  const out: string[] = [];
  s.cells.forEach((cell, i) => {
    if (cell.exists && cell.piece === null) out.push(`${i % s.cols},${Math.floor(i / s.cols)}`);
  });
  return out.sort();
}

const ids = (s: Snapshot): number[] => s.cells.filter((cell) => cell.piece !== null).map((cell) => (cell.piece as Piece).id);

function expectUnchanged(before: Snapshot, res: TurnResult): void {
  expect(res.accepted).toBe(false);
  expect(JSON.stringify(res.snapshot)).toBe(JSON.stringify(before));
}

describe('§2.6 gravity and refill', () => {
  it('pieces fall straight down; the fall step lists each moved piece once with its final cell; one spawn per missing piece', () => {
    const rows = ['~  ~  ~', '~  ~  ~', '~  E  ~', '~  F  ~'];
    const { t, res } = quietRun(rows, {}, { op: 'hammer', at: at(1, 3) }, (r) => stepTypes(r.steps) === 'booster clear fall');
    const before = build(rows).snapshot();
    const fall = stepsOf(res.steps, 'fall')[0];
    const moves = fall.moves.map((m) => `${m.id}:${m.from.c},${m.from.r}>${m.to.c},${m.to.r}`).sort();
    const idAt = (c: number, r: number): number => (pieceAt(before, c, r) as Piece).id;
    expect(moves).toEqual([`${idAt(1, 0)}:1,0>1,1`, `${idAt(1, 1)}:1,1>1,2`, `${idAt(1, 2)}:1,2>1,3`].sort());
    expect(fall.spawns.length).toBe(1);
    expect(fall.spawns[0].from).toEqual(at(1, -1));
    expect(fall.spawns[0].to).toEqual(at(1, 0));
    const spawned = fall.spawns[0].piece;
    expect(spawned.kind).toBe('gem');
    expect([0, 1, 2]).toContain(spawned.color);
    expect(spawned.chained).toBe(false);
    expect(spawned.hp).toBe(1);
    expect(spawned.id).toBeGreaterThan(Math.max(...ids(before)));
    expect(pieceAt(t.snap, 1, 3)?.color).toBe(4); // the E landed on the bottom cell
    expect(emptyCells(t.snap)).toEqual([]);
  });

  it('new pieces stack above the spawner: from.r = -1 lands lowest, -2 above it, …', () => {
    const rows = ['~  ~  ~', '~  E| ~', '~  ~  ~', '~  ~  ~', '~  ~  ~'];
    const { res } = quietRun(rows, {}, { op: 'hammer', at: at(1, 1) }, (r) => stepTypes(r.steps) === 'booster clear activate clear fall');
    const fall = stepsOf(res.steps, 'fall')[0];
    expect(fall.moves).toEqual([]);
    const spawns = fall.spawns.map((s) => `${s.from.c},${s.from.r}>${s.to.c},${s.to.r}`).sort();
    expect(spawns).toEqual(['1,-1>1,4', '1,-2>1,3', '1,-3>1,2', '1,-4>1,1', '1,-5>1,0'].sort());
    expect(new Set(fall.spawns.map((s) => s.piece.id)).size).toBe(5);
  });

  it('a column under an open spawner is fed straight down only — never from the side', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const t = new Audit(build(['~  ~  ~  ~  ~', '~  ~  D  ~  ~', 'D  D  ~  ~  ~', '~  ~  ~  ~  ~'], { seed }));
      const res = t.swap(at(2, 1), at(2, 2));
      for (const fall of stepsOf(res.steps, 'fall')) {
        for (const m of fall.moves) expect(m.from.c).toBe(m.to.c);
        for (const s of fall.spawns) expect(s.from.c).toBe(s.to.c);
      }
      expect(emptyCells(res.snapshot)).toEqual([]);
    }
  });

  it('stones, vines and chained pieces never move; the cells under them are fed diagonally', () => {
    const rows = ['~  S3 ~  V  ~  D# ~', '~  ~  ~  ~  ~  ~  ~', '~  ~  ~  ~  ~  ~  ~', 'E- ~  ~  ~  ~  ~  ~'];
    let quiet = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const t = new Audit(build(rows, { seed }));
      const before = t.snap;
      const res = t.hammer(at(0, 3));
      const after = res.snapshot;
      const firstFall = stepsOf(res.steps, 'fall')[0];
      const blockers = [1, 3, 5].map((c) => (pieceAt(before, c, 0) as Piece).id);
      for (const m of firstFall.moves) expect(blockers).not.toContain(m.id);
      // columns 1, 3 and 5 cannot spawn (their spawner cell is blocked): every piece that entered them came in diagonally
      for (const s of firstFall.spawns) expect([0, 2, 4, 6]).toContain(s.from.c);
      const sideways = firstFall.moves.filter((m) => m.from.c !== m.to.c).length + firstFall.spawns.filter((s) => s.from.c !== s.to.c).length;
      expect(sideways).toBeGreaterThanOrEqual(3);
      expect(emptyCells(after)).toEqual([]);
      // no fall step of the turn ever lists a stone, a vine or a chained piece
      const fixedIds = new Set<number>(blockers);
      for (const fall of stepsOf(res.steps, 'fall')) for (const m of fall.moves) expect(fixedIds.has(m.id)).toBe(false);
      if (clearsOf(res).length !== 2) continue; // an accidental cascade may have damaged the blockers
      quiet++;
      for (const c of [1, 3, 5]) expect(pieceAt(after, c, 0)).toEqual(pieceAt(before, c, 0));
    }
    expect(quiet).toBeGreaterThan(5);
  });

  it('pieces do not pass through a hole: the cell under it is fed from the neighbour columns, the piece above stays', () => {
    const rows = ['~  ~  ~', '~  _  ~', '~  ~  ~', '~  ~  ~'];
    let left = 0;
    let right = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const t = new Audit(build(rows, { seed }));
      const before = t.snap;
      const res = t.hammer(at(1, 3));
      const fall = stepsOf(res.steps, 'fall')[0];
      // (1,2) dropped to (1,3); the gap at (1,2) is filled from (0,1) or (2,1)
      const top = pieceAt(before, 1, 0) as Piece;
      expect(fall.moves.some((m) => m.id === top.id)).toBe(false);
      const into = [...fall.moves, ...fall.spawns.map((s) => ({ id: s.piece.id, from: s.from, to: s.to }))].filter((m) => posKey(m.to) === '1,2');
      expect(into.length).toBe(1);
      expect([0, 2]).toContain(into[0].from.c);
      if (into[0].from.c === 0) left++;
      else right++;
      expect(emptyCells(res.snapshot)).toEqual([]);
    }
    // both sides are used ("upper-left or upper-right")
    expect(left).toBeGreaterThan(5);
    expect(right).toBeGreaterThan(5);
  });

  it('with one side blocked the cell is fed from the other side', () => {
    const rows = ['~  ~  ~', 'S3 _  ~', '~  ~  ~', '~  ~  ~'];
    for (let seed = 1; seed <= 10; seed++) {
      const t = new Audit(build(rows, { seed }));
      const res = t.hammer(at(1, 3));
      const fall = stepsOf(res.steps, 'fall')[0];
      const into = [...fall.moves, ...fall.spawns.map((s) => ({ id: s.piece.id, from: s.from, to: s.to }))].filter((m) => posKey(m.to) === '1,2');
      expect(into.length).toBe(1);
      expect(into[0].from.c).toBe(2);
    }
  });

  it('a cell nothing can reach stays empty, and the game goes on', () => {
    const t = audit(['~  S3 S3 S3 ~', '~  S3 ~  S3 ~', '~  ~  ~  ~  ~', '~  ~  D  ~  ~', 'D  D  ~  ~  ~']);
    const res = t.hammer(at(2, 1));
    expect(stepTypes(res.steps)).toBe('booster clear');
    expect(emptyCells(res.snapshot)).toEqual(['2,1']);
    expect(res.snapshot.status).toBe('playing');
    expect(t.game.canSwap(at(2, 1), at(2, 2))).toBe(false);
    // hammering the empty cell again has nothing to hit
    const before = t.snap;
    expectUnchanged(before, t.hammer(at(2, 1)));
    // the rest of the board still plays
    const next = t.swap(at(2, 3), at(2, 4));
    expect(next.accepted).toBe(true);
    expect(pieceAt(next.snapshot, 2, 1)).toBeNull();
  });

  // Layouts for the flood-fill check. 'P P' in the top row is the trigger: prism + prism hits every cell once,
  // which removes every gem and leaves only stones (S2 / S3 survive one hit; S1 is destroyed and opens a path).
  const layouts: { name: string; rows: string[] }[] = [
    {
      name: 'shelf with one gap: everything below is fed through it, diagonally',
      rows: ['P  P  ?  ?  ?  ?  ?', '?  ?  ?  ?  ?  ?  ?', 'S3 S3 S3 ?  S3 S3 S3', '?  ?  ?  ?  ?  ?  ?', '?  ?  ?  ?  ?  ?  ?', '?  ?  ?  ?  ?  ?  ?', '?  ?  ?  ?  ?  ?  ?'],
    },
    {
      name: 'the funnel is too narrow for the corners: a cell two columns from the gap in the row right under the shelf',
      rows: ['P  P  ?  ?  ?  ?  ?', 'S3 S3 S3 ?  S3 S3 S3', '?  ?  ?  ?  ?  ?  ?', '?  ?  ?  ?  ?  ?  ?', '?  ?  ?  ?  ?  ?  ?'],
    },
    {
      name: 'holes instead of stones, two gaps',
      rows: ['P  P  ?  ?  ?  ?  ?  ?  ?', '?  ?  ?  ?  ?  ?  ?  ?  ?', '_  ?  _  _  _  _  _  ?  _', '?  ?  ?  ?  ?  ?  ?  ?  ?', '?  ?  ?  ?  ?  ?  ?  ?  ?', '?  ?  ?  ?  ?  ?  ?  ?  ?'],
    },
    {
      name: 'sealed pocket: stone roof and stone walls',
      rows: ['P  P  ?  ?  ?  ?  ?', '?  S3 S3 S3 S3 S3 ?', '?  S3 ?  ?  ?  S3 ?', '?  S3 ?  ?  ?  S3 ?', '?  ?  ?  ?  ?  ?  ?', '?  ?  ?  ?  ?  ?  ?'],
    },
    {
      name: 'zig-zag of stones and holes',
      rows: [
        'P  P  ?  ?  ?  ?  ?  ?',
        'S3 S3 S3 S3 S3 S3 ?  ?',
        '?  ?  ?  ?  ?  ?  ?  _',
        '?  _  S3 S3 S3 S3 S3 S3',
        '?  ?  ?  ?  ?  ?  ?  ?',
        '_  _  _  S3 _  _  ?  _',
        '?  ?  ?  ?  ?  ?  ?  ?',
        '?  ?  ?  ?  ?  ?  ?  ?',
      ],
    },
    {
      name: 'columns whose top is missing spawn into their first cell; a stone lid blocks a column',
      rows: ['P  P  _  _  ?  S3 ?', '?  ?  ?  _  ?  ?  ?', '?  ?  ?  ?  ?  ?  ?', 'S3 ?  ?  ?  ?  ?  S3', '?  ?  ?  ?  ?  ?  ?', '?  S3 S3 ?  S3 S3 ?', '?  ?  ?  ?  ?  ?  ?'],
    },
    {
      name: 'S1 stones are destroyed by the blast and open the way',
      rows: ['P  P  ?  ?  ?  ?', 'S3 S3 S1 S3 S3 S3', '?  ?  ?  ?  ?  ?', '?  ?  ?  ?  ?  ?'],
    },
    {
      name: 'a board split in two by a wall of holes: each half has its own spawners',
      rows: ['P  P  ?  _  ?  ?  ?', '?  ?  ?  _  S3 S3 S3', '?  ?  ?  _  ?  ?  ?', '?  ?  ?  _  ?  ?  ?'],
    },
  ];

  function checkFill(s: Snapshot, label: string, wipedClean: boolean): void {
    const flow = reachable(s);
    for (let r = 0; r < s.rows; r++) {
      for (let c = 0; c < s.cols; c++) {
        const cell = s.cells[r * s.cols + c];
        if (!cell.exists || isFixed(cell.piece)) continue;
        const key = `${c},${r}`;
        if (flow.has(key)) expect(cell.piece, `${label}: ${key} can be reached from a spawner and must be filled\n${picture(s).join('\n')}`).not.toBeNull();
        else if (wipedClean) expect(cell.piece, `${label}: nothing can reach ${key}, it must be empty\n${picture(s).join('\n')}`).toBeNull();
      }
    }
  }

  for (const layout of layouts) {
    it(`flood fill — ${layout.name}`, () => {
      for (let seed = 1; seed <= 6; seed++) {
        const t = new Audit(build(layout.rows, { seed, colors: 4 }));
        const res = t.swap(at(0, 0), at(1, 0));
        expect(res.accepted).toBe(true);
        checkFill(res.snapshot, `${layout.name} (seed ${seed})`, true);
        // nothing hangs: no empty cell has a movable piece above or diagonally above it
        const s = res.snapshot;
        for (const key of emptyCells(s)) {
          const [c, r] = key.split(',').map(Number);
          for (const dc of [-1, 0, 1]) {
            if (r === 0 || c + dc < 0 || c + dc >= s.cols) continue;
            const above = s.cells[(r - 1) * s.cols + c + dc];
            expect(above.piece === null || isFixed(above.piece), `${layout.name}: ${key} is empty under a movable piece`).toBe(true);
          }
        }
      }
    });
  }

  it('flood fill — the layouts above really contain unreachable cells and diagonal feeding', () => {
    const pocket = new Audit(build(layouts[3].rows, { seed: 1, colors: 4 })).swap(at(0, 0), at(1, 0)).snapshot;
    // the sealed room, plus the shadow it casts: (2,4) (3,4) (4,4) and (3,5) have nothing movable above them either
    expect(emptyCells(pocket)).toEqual(cellsOf('2,2 3,2 4,2 2,3 3,3 4,3 2,4 3,4 4,4 3,5'));
    const funnel = new Audit(build(layouts[1].rows, { seed: 1, colors: 4 })).swap(at(0, 0), at(1, 0)).snapshot;
    // under the shelf only the cone below the gap fills: row 2 gets columns 2..4, row 3 columns 1..5, row 4 everything
    expect(emptyCells(funnel)).toEqual(cellsOf('0,2 1,2 5,2 6,2 0,3 6,3'));
  });

  it('flood fill — 150 random hole / stone layouts, wiped by prism + prism', () => {
    const d = dice(4242);
    let unreachable = 0;
    let sideways = 0;
    for (let n = 0; n < 150; n++) {
      const cols = 4 + d.int(6);
      const height = 4 + d.int(6);
      const rows: string[] = [];
      for (let r = 0; r < height; r++) {
        const cells: string[] = [];
        for (let c = 0; c < cols; c++) {
          if (r === 0 && c < 2) cells.push('P');
          else if (r > 0 && d.chance(0.2)) cells.push(d.chance(0.5) ? '_' : d.pick(['S1', 'S2', 'S3', 'S3']));
          else cells.push('?');
        }
        rows.push(cells.join(' '));
      }
      const t = new Audit(build(rows, { seed: n + 1, colors: 3 + d.int(4) }));
      const res = t.swap(at(0, 0), at(1, 0));
      expect(res.accepted).toBe(true);
      checkFill(res.snapshot, `random layout ${n}: ${rows.join(' / ')}`, true);
      unreachable += emptyCells(res.snapshot).length;
      for (const fall of stepsOf(res.steps, 'fall')) sideways += fall.moves.filter((m) => m.from.c !== m.to.c).length + fall.spawns.filter((s) => s.from.c !== s.to.c).length;
    }
    expect(unreachable).toBeGreaterThan(20);
    expect(sideways).toBeGreaterThan(300);
  });

  it('flood fill — with chained pieces and vines as blockers, after every single hammer blow', () => {
    const rows = [
      '?  ?  ?  ?  ?  ?  ?',
      '?# ?# ?# ?  ?# ?# ?#',
      '?  ?  ?  ?  ?  ?  ?',
      '?  V  V  V  V  V  ?',
      '?  ?  ?  ?  ?  ?  ?',
      '?  ?  ?  ?  ?  ?  ?',
    ];
    const t = new Audit(build(rows, { seed: 9, colors: 5, startShuffle: true }));
    const d = dice(3);
    for (let n = 0; n < 60 && t.snap.status === 'playing'; n++) {
      const s = t.snap;
      const filled: Pos[] = [];
      s.cells.forEach((cell, i) => {
        if (cell.piece !== null && cell.piece.kind !== 'lamp') filled.push(at(i % s.cols, Math.floor(i / s.cols)));
      });
      const res = t.hammer(d.pick(filled));
      expect(res.accepted).toBe(true);
      checkFill(res.snapshot, `hammer ${n}`, false);
    }
  });
});

describe('§2.6 lamps', () => {
  const lampGoal = (target: number): BuildOpts => ({ goals: [{ kind: 'lamp', target }] });

  it('a lamp that comes to rest on an exit is collected (500 points), then gravity runs again', () => {
    const rows = ['~  ~  ~', '~  L  ~', '~  F  ~'];
    const { t, res } = quietRun(rows, { goals: [{ kind: 'lamp', target: 2 }] }, { op: 'hammer', at: at(1, 2) }, (r) => stepTypes(r.steps) === 'booster clear fall collect fall');
    const lamp = pieceAt(build(rows).snapshot(), 1, 1) as Piece;
    const collect = stepsOf(res.steps, 'collect')[0];
    expect(collect.lamps).toEqual([{ id: lamp.id, at: at(1, 2) }]);
    expect(collect.score).toBe(SCORE.lamp);
    expect(collect.score).toBe(500);
    expect(res.snapshot.score).toBe(20 + 500);
    expect(res.snapshot.goals[0]).toMatchObject({ current: 1, target: 2, done: false });
    expect(t.snap.cells.some((cell) => cell.piece?.kind === 'lamp')).toBe(false);
    expect(emptyCells(t.snap)).toEqual([]);
    // the fall after the collect counts as a fall: later waves would be cascade 3
    expect(stepsOf(res.steps, 'fall').length).toBe(2);
  });

  it('delivering the last lamp wins a lamp level at once', () => {
    const rows = ['~  ~  ~', '~  L  ~', '~  F  ~'];
    const { res } = quietRun(rows, lampGoal(1), { op: 'hammer', at: at(1, 2) }, (r) => stepTypes(r.steps) === 'booster clear fall collect fall status');
    expect(res.steps[res.steps.length - 1]).toEqual({ type: 'status', status: 'won' });
    expect(res.snapshot.status).toBe('won');
    expect(res.snapshot.goals[0]).toMatchObject({ current: 1, target: 1, done: true });
    expect(res.snapshot.movesLeft).toBe(30);
  });

  it('the exit is the bottom-most existing cell of the column (here: above a missing bottom cell)', () => {
    const rows = ['~  ~  ~', '~  L  ~', '~  F  ~', '~  _  ~'];
    const start = build(rows).snapshot();
    expect(cellAt(start, 1, 2).exit).toBe(true);
    expect(cellAt(start, 1, 1).exit).toBe(false);
    expect(cellAt(start, 0, 3).exit).toBe(true);
    expect(cellAt(start, 0, 2).exit).toBe(false);
    expect(start.cells.filter((cell) => cell.exit).length).toBe(3);
    expect(start.cells.filter((cell) => cell.spawner).map((_, i) => i).length).toBe(3);
    const res = audit(rows, lampGoal(1)).hammer(at(1, 2));
    expect(stepsOf(res.steps, 'collect').length).toBe(1);
    expect(stepsOf(res.steps, 'collect')[0].lamps[0].at).toEqual(at(1, 2));
  });

  it('a lamp resting above a hole in the middle of its column is not on an exit: no collect', () => {
    const rows = ['~  ~  ~', '~  L  ~', '~  F  ~', '~  _  ~', '~  ~  ~'];
    const t = audit(rows, lampGoal(1));
    const lamp = pieceAt(t.snap, 1, 1) as Piece;
    const res = t.hammer(at(1, 2));
    expect(stepsOf(res.steps, 'collect').length).toBe(0);
    expect(pieceAt(res.snapshot, 1, 2)?.id).toBe(lamp.id);
    expect(res.snapshot.status).toBe('playing');
  });

  it('a lamp that starts on an exit (a level mistake) is simply collected in the first turn', () => {
    const t = audit(['~  ~  D  ~', 'D  D  ~  ~', '~  ~  ~  L'], lampGoal(2));
    const res = t.swap(at(2, 0), at(2, 1));
    expect(stepsOf(res.steps, 'collect').length).toBe(1);
    expect(res.snapshot.goals[0].current).toBe(1);
  });

  it('lamps drop in per LevelDef.lamps: never more than maxOnBoard, at least everyMoves apart, total respected', () => {
    for (const cfg of [
      { total: 3, maxOnBoard: 1, everyMoves: 2 },
      { total: 4, maxOnBoard: 2, everyMoves: 0 },
      { total: 2, maxOnBoard: 2, everyMoves: 5 },
      { total: 6, maxOnBoard: 3, everyMoves: 1 },
    ]) {
      for (let seed = 1; seed <= 6; seed++) {
        const level: LevelDef = {
          id: 1,
          cols: 6,
          rows: 6,
          colors: 4,
          moves: 200,
          pieces: new Array<string>(6).fill('......'),
          goals: [{ kind: 'lamp', target: cfg.total }],
          stars: [100, 200, 300],
          lamps: cfg,
        };
        const game = new Game(level, { seed });
        const referee = new Referee(level, game.snapshot());
        const d = dice(seed * 7);
        let moves = 0;
        const spawnMoves: number[] = [];
        let delivered = 0;
        while (game.snapshot().status === 'playing' && moves < 150) {
          const move = d.pick(game.validMoves());
          const before = game.snapshot();
          const call: Call = { op: 'swap', a: move.a, b: move.b };
          const res = perform(game, call);
          referee.check(before, call, res, game);
          moves++;
          // replay the turn step by step to count the lamps on the board at every moment
          let onBoard = before.cells.filter((cell) => cell.piece?.kind === 'lamp').length;
          for (const step of res.steps) {
            if (step.type === 'fall') {
              for (const s of step.spawns) {
                if (s.piece.kind !== 'lamp') continue;
                // "A new lamp is spawned when fewer than maxOnBoard are on the board"
                expect(onBoard).toBeLessThan(cfg.maxOnBoard);
                onBoard++;
                spawnMoves.push(moves);
                // it enters at the top of its column
                expect(s.to).toEqual(at(s.from.c, 0));
              }
            } else if (step.type === 'collect') {
              onBoard -= step.lamps.length;
              delivered += step.lamps.length;
            }
          }
          expect(onBoard).toBeLessThanOrEqual(cfg.maxOnBoard);
        }
        // with no lamp placed in the level the first one comes with the first refill
        expect(spawnMoves[0]).toBe(1);
        for (let k = 1; k < spawnMoves.length; k++) expect(spawnMoves[k] - spawnMoves[k - 1]).toBeGreaterThanOrEqual(cfg.everyMoves);
        expect(spawnMoves.length).toBeLessThanOrEqual(cfg.total);
        if (game.snapshot().status === 'won') {
          expect(delivered).toBe(cfg.total);
          expect(spawnMoves.length).toBe(cfg.total);
        }
      }
    }
  });

  it('lamps placed in the level count towards `total`, and the first extra lamp waits `everyMoves` moves', () => {
    const base: LevelDef = {
      id: 1,
      cols: 6,
      rows: 7,
      colors: 5,
      moves: 60,
      pieces: ['L....L', '......', '......', '......', '......', '......', '......'],
      goals: [{ kind: 'score', target: 1e9 }],
      stars: [1e9, 2e9, 3e9],
    };
    for (let seed = 1; seed <= 8; seed++) {
      for (const cfg of [
        { total: 2, maxOnBoard: 5, everyMoves: 0 },
        { total: 3, maxOnBoard: 5, everyMoves: 4 },
      ]) {
        const level = { ...base, lamps: cfg };
        const game = new Game(level, { seed });
        const referee = new Referee(level, game.snapshot());
        const d = dice(seed);
        const spawnMoves: number[] = [];
        for (let move = 1; move <= 40 && game.snapshot().status === 'playing'; move++) {
          const m = d.pick(game.validMoves());
          const before = game.snapshot();
          const call: Call = { op: 'swap', a: m.a, b: m.b };
          const res = perform(game, call);
          referee.check(before, call, res, game);
          for (const fall of stepsOf(res.steps, 'fall')) for (const s of fall.spawns) if (s.piece.kind === 'lamp') spawnMoves.push(move);
        }
        if (cfg.total === 2) expect(spawnMoves).toEqual([]);
        else {
          expect(spawnMoves.length).toBeLessThanOrEqual(1);
          for (const m of spawnMoves) expect(m).toBeGreaterThanOrEqual(4);
        }
      }
    }
  });

  it('a spawned lamp only enters columns that run without a gap down to their exit', () => {
    const level: LevelDef = {
      id: 1,
      cols: 5,
      rows: 6,
      colors: 4,
      moves: 100,
      pieces: ['.....', '.....', '._.._', '.....', '.....', '.....'],
      goals: [{ kind: 'lamp', target: 8 }],
      stars: [100, 200, 300],
      lamps: { total: 8, maxOnBoard: 3, everyMoves: 0 },
    };
    let seen = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const game = new Game(level, { seed });
      const referee = new Referee(level, game.snapshot());
      const d = dice(seed);
      for (let move = 0; move < 60 && game.snapshot().status === 'playing'; move++) {
        const m = d.pick(game.validMoves());
        const before = game.snapshot();
        const call: Call = { op: 'swap', a: m.a, b: m.b };
        const res = perform(game, call);
        referee.check(before, call, res, game);
        for (const fall of stepsOf(res.steps, 'fall')) {
          for (const s of fall.spawns) {
            if (s.piece.kind !== 'lamp') continue;
            seen++;
            expect([0, 2, 3]).toContain(s.from.c);
          }
        }
      }
    }
    expect(seen).toBeGreaterThan(20);
  });
});

describe('§2.7 vines', () => {
  const growOf = (res: TurnResult): Extract<Step, { type: 'grow' }>[] => stepsOf(res.steps, 'grow');

  it('after a move that destroys no vine, one vine spreads into an orthogonally adjacent plain gem', () => {
    const rows = ['~  ~  ~  ~  ~', '~  ~  D  ~  ~', 'D  D  ~  ~  ~', '~  ~  ~  ~  ~', '~  ~  ~  ~  V'];
    const targets = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const probe = build(rows, { seed });
      const r = probe.swap(at(2, 1), at(2, 2));
      if (clearsOf(r).length !== 1) continue; // an accidental cascade might reach the vine
      const t = new Audit(build(rows, { seed }));
      const res = t.swap(at(2, 1), at(2, 2));
      const grows = growOf(res);
      expect(grows.length).toBe(1);
      const grow = grows[0];
      // after the board settled: the grow step is the last step of the turn
      expect(res.steps[res.steps.length - 1]).toBe(grow);
      expect(grow.from).toEqual(at(4, 4));
      expect(['3,4', '4,3']).toContain(posKey(grow.at));
      targets.add(posKey(grow.at));
      expect(grow.piece.kind).toBe('vine');
      expect(grow.piece.color).toBe(-1);
      expect(grow.piece.hp).toBe(1);
      expect(grow.piece.chained).toBe(false);
      expect(grow.replacedId).not.toBeNull();
      // the eaten gem was a plain gem that stood there just before
      const eaten = pieceAt(res.snapshot, grow.at.c, grow.at.r) as Piece;
      expect(eaten.id).toBe(grow.piece.id);
      expect(ids(res.snapshot)).not.toContain(grow.replacedId);
      expect(res.snapshot.cells.filter((cell) => cell.piece?.kind === 'vine').length).toBe(2);
    }
    // "a random … adjacent plain gem": both neighbours are chosen over a few seeds
    expect(targets.size).toBe(2);
  });

  it('no vine spreads in a turn that destroyed one', () => {
    const rows = ['~  ~  ~  ~  ~', '~  ~  D  ~  ~', 'D  D  ~  V  ~', '~  ~  ~  ~  ~', 'V  ~  ~  ~  ~'];
    for (let seed = 1; seed <= 10; seed++) {
      const t = new Audit(build(rows, { seed }));
      const res = t.swap(at(2, 1), at(2, 2));
      const first = clearsOf(res)[0];
      expect(first.hits.filter((h) => h.kind === 'vine').map((h) => `${h.cause}:${h.result}`)).toEqual(['adjacent:removed']);
      expect(growOf(res)).toEqual([]);
    }
  });

  it('boosters are not moves: no vine spreads after a hammer, a free swap or a shuffle', () => {
    const rows = ['~  ~  ~  ~  ~', '~  ~  ~  ~  ~', '~  ~  ~  ~  ~', '~  ~  ~  ~  ~', 'V  ~  ~  ~  ~'];
    for (let seed = 1; seed <= 6; seed++) {
      const t = new Audit(build(rows, { seed }));
      expect(growOf(t.hammer(at(4, 0)))).toEqual([]);
      expect(growOf(t.freeSwap(at(3, 1), at(4, 1)))).toEqual([]);
      expect(growOf(t.shuffle())).toEqual([]);
      expect(t.snap.cells.filter((cell) => cell.piece?.kind === 'vine').length).toBe(1);
    }
  });

  it('a vine spreads into plain gems only — never into a chained gem, a special, a lamp, a stone or a prism', () => {
    // The match is made in the top row, so nothing around the vines moves.
    const rows = ['D  D  ~  ~  ~  ~  ~', '~  ~  D  ~  ~  ~  ~', '~  ~  ~  ~  ~  ~  ~', '~  ~  L  ~  ~  P  ~', '~  E# V  D- S1 V  D*', '~  ~  S1 ~  ~  E# ~'];
    let turns = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const probe = build(rows, { seed });
      if (clearsOf(probe.swap(at(2, 1), at(2, 0))).length !== 1) continue;
      const t = new Audit(build(rows, { seed }));
      const res = t.swap(at(2, 1), at(2, 0));
      expect(growOf(res)).toEqual([]);
      expect(res.snapshot.cells.filter((cell) => cell.piece?.kind === 'vine').length).toBe(2);
      turns++;
    }
    expect(turns).toBeGreaterThan(5);
  });

  it('a level without vines never has a grow step', () => {
    const t = audit(['~  ~  D  ~', 'D  D  ~  ~', '~  ~  ~  ~']);
    expect(growOf(t.swap(at(2, 0), at(2, 1)))).toEqual([]);
  });

  it('a vine cut with a booster counts for the move that follows it; the move after that feeds the vines again', () => {
    const rows = ['~  ~  ~  ~  ~  ~', '~  ~  D  ~  ~  ~', 'D  D  ~  ~  ~  ~', '~  ~  ~  ~  ~  ~', '~  ~  ~  ~  ~  ~', 'V  ~  ~  ~  ~  V'];
    let checked = 0;
    let grewLater = 0;
    for (let seed = 1; seed <= 60 && checked < 10; seed++) {
      const probe = build(rows, { seed });
      if (clearsOf(probe.useBooster('hammer', at(5, 5))).length !== 1) continue;
      if (clearsOf(probe.swap(at(2, 1), at(2, 2))).length !== 1) continue;
      const t = new Audit(build(rows, { seed }));
      const cut = t.hammer(at(5, 5));
      expect(hitList(clearsOf(cut)[0])).toEqual(['5,5:booster:removed']);
      expect(growOf(cut)).toEqual([]);
      // the player's next move: a vine was destroyed since the last move, so nothing spreads
      const res = t.swap(at(2, 1), at(2, 2));
      expect(res.accepted).toBe(true);
      expect(growOf(res)).toEqual([]);
      expect(res.snapshot.cells.filter((cell) => cell.piece?.kind === 'vine').length).toBe(1);
      checked++;
      // one more move without cutting: now the remaining vine spreads again
      const move = t.game.hint();
      if (move === null) continue;
      const next = t.swap(move.a, move.b);
      const cutAgain = clearsOf(next).some((c) => c.hits.some((h) => h.kind === 'vine'));
      expect(growOf(next).length).toBe(cutAgain ? 0 : 1);
      if (!cutAgain) grewLater++;
    }
    expect(checked).toBeGreaterThanOrEqual(5);
    expect(grewLater).toBeGreaterThanOrEqual(3);
  });

  it('without the booster the same move lets the vine spread (control for the test above)', () => {
    const rows = ['~  ~  ~  ~  ~  ~', '~  ~  D  ~  ~  ~', 'D  D  ~  ~  ~  ~', '~  ~  ~  ~  ~  ~', '~  ~  ~  ~  ~  ~', 'V  ~  ~  ~  ~  V'];
    let checked = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const probe = build(rows, { seed });
      if (clearsOf(probe.swap(at(2, 1), at(2, 2))).length !== 1) continue;
      const res = new Audit(build(rows, { seed })).swap(at(2, 1), at(2, 2));
      expect(growOf(res).length).toBe(1);
      checked++;
    }
    expect(checked).toBeGreaterThan(5);
  });

  it('the vine goal counts destroyed vines against the number the level started with', () => {
    const rows = ['~  ~  ~  ~  ~', '~  ~  D  ~  ~', 'D  D  ~  V  ~', '~  ~  ~  ~  ~', 'V  ~  ~  ~  ~'];
    const t = audit(rows, { goals: [{ kind: 'vine' }] });
    expect(t.snap.goals[0]).toMatchObject({ current: 0, target: 2, done: false });
    const res = t.swap(at(2, 1), at(2, 2));
    expect(res.snapshot.goals[0].current).toBeGreaterThanOrEqual(1);
    expect(res.snapshot.goals[0].target).toBe(2);
    if (res.snapshot.status === 'playing') {
      const vine = res.snapshot.cells.findIndex((cell) => cell.piece?.kind === 'vine');
      const last = t.hammer(at(vine % 5, Math.floor(vine / 5)));
      expect(last.snapshot.goals[0]).toMatchObject({ current: 2, target: 2, done: true });
      expect(last.snapshot.status).toBe('won');
    }
  });
});

describe('§2.8 no moves left: shuffle', () => {
  const colourCounts = (s: Snapshot): number[] => {
    const counts = [0, 0, 0, 0, 0, 0];
    for (const cell of s.cells) if (cell.piece !== null && cell.piece.color >= 0) counts[cell.piece.color]++;
    return counts;
  };

  it('a level that would start stuck is shuffled before the first snapshot: no match, a valid move, same gems', () => {
    const rows = new Array<string>(6).fill('~  ~  ~  ~  ~  ~');
    const stuck = build(rows).snapshot();
    expect(refMoves(stuck)).toEqual([]);
    for (let seed = 1; seed <= 10; seed++) {
      const start = build(rows, { seed, startShuffle: true }).snapshot();
      expect(start.status).toBe('playing');
      expect(refHasMatch(start)).toBe(false);
      expect(refMoves(start).length).toBeGreaterThan(0);
      expect(colourCounts(start)).toEqual(colourCounts(stuck));
      expect(ids(start).sort((x, y) => x - y)).toEqual(ids(stuck).sort((x, y) => x - y));
    }
  });

  it('a turn that leaves the board stuck ends with a shuffle step: only plain gems trade places', () => {
    const rows = ['~  ~  S1 ~  ~', '~  ~  ~  ~  ~', '~  ~  ~  ~  ~', '~  ~  ~  ~  ~', '~  ~  ~  ~  ~'];
    const { res } = quietRun(rows, {}, { op: 'hammer', at: at(2, 0) }, (r) => r.steps.some((s) => s.type === 'shuffle'));
    expect(stepTypes(res.steps)).toBe('booster clear fall shuffle');
    const shuffle = stepsOf(res.steps, 'shuffle')[0];
    expect(shuffle.moves.length).toBeGreaterThan(0);
    expect(new Set(shuffle.moves.map((m) => m.id)).size).toBe(shuffle.moves.length);
    expect(shuffle.moves.map((m) => posKey(m.from)).sort()).toEqual(shuffle.moves.map((m) => posKey(m.to)).sort());
    for (const m of shuffle.moves) expect(posKey(m.from)).not.toBe(posKey(m.to));
    expect(refHasMatch(res.snapshot)).toBe(false);
    expect(refMoves(res.snapshot).length).toBeGreaterThan(0);
    expect(res.snapshot.status).toBe('playing');
    expect(res.snapshot.movesLeft).toBe(30);
  });

  it('immovable and special pieces keep their cells in a shuffle; the booster result looks different, has no match and has a move', () => {
    const rows = [
      '~  ~  D# ~  L  ~  ~',
      '~  S2 ~  ~  ~  E- ~',
      '~  ~  ~  V  ~  ~  ~',
      'P  ~  ~  ~  ~  F* ~',
      '~  ~  ~  E|# ~ ~  ~',
      '~  ~  ~  ~  ~  ~  ~',
    ];
    for (let seed = 1; seed <= 12; seed++) {
      const t = new Audit(build(rows, { seed }));
      const before = t.snap;
      const res = t.shuffle();
      expect(res.accepted).toBe(true);
      expect(stepTypes(res.steps)).toBe('booster shuffle');
      expect(res.steps[0]).toEqual({ type: 'booster', booster: 'shuffle', at: null });
      const after = res.snapshot;
      before.cells.forEach((cell, i) => {
        const p = cell.piece as Piece;
        if (p.kind !== 'gem' || p.chained) expect(after.cells[i].piece).toEqual(p);
      });
      const shuffle = stepsOf(res.steps, 'shuffle')[0];
      for (const m of shuffle.moves) {
        const p = pieceAt(before, m.from.c, m.from.r) as Piece;
        expect(p.id).toBe(m.id);
        expect(p.kind).toBe('gem');
        expect(p.chained).toBe(false);
      }
      expect(picture(after)).not.toEqual(picture(before));
      expect(refHasMatch(after)).toBe(false);
      expect(refMoves(after).length).toBeGreaterThan(0);
      expect(after.movesLeft).toBe(before.movesLeft);
      expect(after.score).toBe(before.score);
      expect(colourCounts(after)).toEqual(colourCounts(before));
    }
  });

  it('when no rearrangement can give a move the gems are recoloured instead (transform "recolor")', () => {
    // nine gems, no colour three times: no permutation can ever contain a move
    const rows = ['A  A  B', 'B  C  C', 'D  D  E', 'S3 S3 S3'];
    const stuck = build(rows, { colors: 5 }).snapshot();
    expect(refMoves(stuck)).toEqual([]);
    for (let seed = 1; seed <= 10; seed++) {
      const t = new Audit(build(rows, { colors: 5, seed }));
      const res = t.shuffle();
      expect(res.accepted).toBe(true);
      expect(stepTypes(res.steps)).toBe('booster shuffle transform');
      const tr = stepsOf(res.steps, 'transform')[0];
      expect(tr.reason).toBe('recolor');
      expect(tr.score).toBe(0);
      expect(tr.changes.length).toBeGreaterThan(0);
      for (const ch of tr.changes) {
        const old = pieceAt(stuck, ch.at.c, ch.at.r) as Piece;
        expect(ch.piece.id).toBe(old.id);
        expect(ch.piece.kind).toBe('gem');
        expect(ch.piece.color).not.toBe(old.color);
        expect(ch.piece.color).toBeGreaterThanOrEqual(0);
        expect(ch.piece.color).toBeLessThan(5);
      }
      expect(refHasMatch(res.snapshot)).toBe(false);
      expect(refMoves(res.snapshot).length).toBeGreaterThan(0);
    }
    // the same happens automatically at level start
    const start = build(rows, { colors: 5, startShuffle: true }).snapshot();
    expect(start.status).toBe('playing');
    expect(refMoves(start).length).toBeGreaterThan(0);
  });

  it('a board on which no move can ever exist ends the level: lost, cannot continue, addMoves refused', () => {
    // at level start
    const dead = build(['A  B', 'B  A'], { startShuffle: true });
    expect(dead.snapshot().status).toBe('lost');
    expect(dead.snapshot().canContinue).toBe(false);
    expect(dead.validMoves()).toEqual([]);
    expect(dead.hint()).toBeNull();
    const before = dead.snapshot();
    for (const res of [dead.addMoves(5), dead.swap(at(0, 0), at(1, 0)), dead.useBooster('shuffle'), dead.useBooster('hammer', at(0, 0)), dead.endBonus()]) {
      expectUnchanged(before, res);
      expect(res.steps).toEqual([]);
    }
    // after a turn, with moves left
    const t = audit(['A  B', 'B  A'], { moves: 9 });
    const res = t.hammer(at(0, 0));
    expect(res.steps[res.steps.length - 1]).toEqual({ type: 'status', status: 'lost' });
    expect(res.steps.some((s) => s.type === 'shuffle')).toBe(false);
    expect(res.snapshot.status).toBe('lost');
    expect(res.snapshot.movesLeft).toBe(9);
    expect(res.snapshot.canContinue).toBe(false);
    const lost = t.snap;
    expectUnchanged(lost, t.addMoves(5));
    // a score-only level whose target is already reached is won instead
    const w = audit(['A  B', 'B  A'], { moves: 9, goals: [{ kind: 'score', target: 10 }], stars: [10, 20, 30] });
    const won = w.hammer(at(0, 0));
    expect(won.snapshot.status).toBe('won');
    expect(won.snapshot.canContinue).toBeUndefined();
  });

  it('"dead" is never a sampling accident: one usable move among many unusable ones is always found', () => {
    // A sea of chained gems; beams next to lamps offer dozens of places where a move could exist
    // "if the colours were right" (they never are: no chained gem has a beam's colour). The only way
    // out is to recolour the plain E on (0,6) to A, so that it can step between the two chained A's
    // of column 1. An earlier version sampled 48 candidates and gave the board up when the sample
    // missed that one: with seeds 24, 109, 379, 487, 576 and 600 the level started lost.
    const rows = [
      'E- L  C# A# B# C# A# B# E|',
      'B# L  D| B# C# A# B# C# L',
      'C# D- L  F| A# L  D- L  E-',
      'E| L  E- A# B# D- A# D| C#',
      'B# C# A# B# C# A# E| L  A#',
      'C# A# B# C# A# B# C# D- B#',
      'E  F  C# A# B# C# E| L  F|',
      'B# A# A# B# C# F- L  F- L',
      'C# A# B# C# A# B# E- L  D-',
    ];
    const stuck = build(rows, { colors: 6 }).snapshot();
    expect(refHasMatch(stuck)).toBe(false);
    expect(refMoves(stuck)).toEqual([]);
    for (const seed of [24, 109, 379, 487, 576, 600, ...Array.from({ length: 60 }, (_, k) => k + 1)]) {
      const start = build(rows, { colors: 6, seed, startShuffle: true }).snapshot();
      expect(start.status, `seed ${seed}`).toBe('playing');
      expect(refHasMatch(start)).toBe(false);
      expect(refMoves(start).length).toBeGreaterThan(0);
      // only plain gems were touched
      stuck.cells.forEach((cell, i) => {
        const p = cell.piece as Piece;
        if (p.kind !== 'gem' || p.chained) expect(start.cells[i].piece).toEqual(p);
      });
    }
    // the same through the shuffle booster and through the end-of-turn check
    const t = audit(rows, { colors: 6, seed: 24 });
    const res = t.shuffle();
    expect(res.accepted).toBe(true);
    expect(refMoves(res.snapshot).length).toBeGreaterThan(0);
  });

  it('the turn that uses up the last move still shuffles a stuck board, so addMoves() resumes on a playable one', () => {
    let seen = 0;
    for (let seed = 1; seed <= 400 && seen < 3; seed++) {
      const level: LevelDef = { id: 1, cols: 4, rows: 4, colors: 6, moves: 1, pieces: ['....', '....', '....', '....'], goals: [{ kind: 'score', target: 1e9 }], stars: [1e9, 2e9, 3e9] };
      const game = new Game(level, { seed });
      const t = new Audit(game, {});
      const move = game.validMoves()[0];
      const res = t.swap(move.a, move.b);
      expect(res.snapshot.status).toBe('lost');
      expect(res.snapshot.canContinue).toBe(true);
      expect(refMoves(res.snapshot).length).toBeGreaterThan(0);
      if (!res.steps.some((s) => s.type === 'shuffle')) continue;
      seen++;
      const types = stepTypes(res.steps);
      expect(types.endsWith('shuffle status') || types.endsWith('shuffle transform status')).toBe(true);
      const again = t.addMoves(2);
      expect(again.accepted).toBe(true);
      expect(again.steps).toEqual([{ type: 'status', status: 'playing' }]);
      expect(again.snapshot.movesLeft).toBe(2);
      expect(game.validMoves().length).toBeGreaterThan(0);
    }
    expect(seen).toBe(3);
  });
});

describe('§2.9 goals, winning and losing', () => {
  const stoneBoard = ['~  ~  D  ~', 'D  D  ~  ~', '~  S1 ~  ~', '~  ~  ~  ~'];

  it('the level is won as soon as every goal is done after a turn settles — with moves to spare', () => {
    const t = audit(stoneBoard, { goals: [{ kind: 'stone' }], moves: 5, stars: [5000, 6000, 7000] });
    expect(t.snap.goals).toEqual([{ goal: { kind: 'stone' }, current: 0, target: 1, done: false }]);
    const res = t.swap(at(2, 0), at(2, 1));
    expect(res.steps[res.steps.length - 1]).toEqual({ type: 'status', status: 'won' });
    expect(stepsOf(res.steps, 'status').length).toBe(1);
    expect(res.snapshot.status).toBe('won');
    expect(res.snapshot.movesLeft).toBe(4);
    expect(res.snapshot.goals[0]).toMatchObject({ current: 1, target: 1, done: true });
    // "minimum 1 star for a won level" although the score is below stars[0]
    expect(res.snapshot.score).toBeLessThan(5000);
    expect(res.snapshot.stars).toBe(1);
    expect(res.snapshot.canContinue).toBeUndefined();
    // nothing more can be played
    const won = t.snap;
    for (const r of [t.swap(at(0, 0), at(1, 0)), t.hammer(at(0, 0)), t.freeSwap(at(0, 0), at(1, 0)), t.shuffle(), t.addMoves(3)]) {
      expectUnchanged(won, r);
      expect(r.steps).toEqual([]);
    }
    expect(t.game.validMoves()).toEqual([]);
    expect(t.game.hint()).toBeNull();
    expect(t.game.canSwap(at(0, 0), at(1, 0))).toBe(false);
  });

  it('a booster turn can win the level too', () => {
    const t = audit(stoneBoard, { goals: [{ kind: 'stone' }], moves: 5 });
    const res = t.hammer(at(1, 2));
    expect(res.snapshot.status).toBe('won');
    expect(res.snapshot.movesLeft).toBe(5);
    expect(res.steps[res.steps.length - 1]).toEqual({ type: 'status', status: 'won' });
  });

  it('every goal must be done: a stone goal plus an unmet score goal keeps the level going', () => {
    const t = audit(stoneBoard, { goals: [{ kind: 'stone' }, { kind: 'score', target: 1e9 }], moves: 5 });
    const res = t.swap(at(2, 0), at(2, 1));
    expect(res.snapshot.status).toBe('playing');
    expect(res.snapshot.goals.map((g) => g.done)).toEqual([true, false]);
    expect(stepsOf(res.steps, 'status')).toEqual([]);
  });

  it('a score-only level is decided when the moves run out: reaching the target early does not end it', () => {
    const rows = ['~  ~  D  ~', 'D  D  ~  ~', '~  ~  ~  ~', '~  ~  ~  ~'];
    const t = audit(rows, { goals: [{ kind: 'score', target: 50 }], stars: [50, 5000, 9000], moves: 2 });
    const first = t.swap(at(2, 0), at(2, 1));
    expect(first.snapshot.score).toBeGreaterThanOrEqual(60);
    expect(first.snapshot.goals[0].done).toBe(true);
    expect(first.snapshot.status).toBe('playing');
    expect(first.snapshot.movesLeft).toBe(1);
    const move = t.game.hint() as { a: Pos; b: Pos };
    const second = t.swap(move.a, move.b);
    expect(second.snapshot.movesLeft).toBe(0);
    expect(second.snapshot.status).toBe('won');
    expect(second.steps[second.steps.length - 1]).toEqual({ type: 'status', status: 'won' });
    // boosters do not end it either
    const u = audit(rows, { goals: [{ kind: 'score', target: 10 }], stars: [10, 5000, 9000], moves: 2 });
    const hammered = u.hammer(at(0, 0));
    expect(hammered.snapshot.goals[0].done).toBe(true);
    expect(hammered.snapshot.status).toBe('playing');
  });

  it('out of moves with goals unmet: lost; addMoves(n) resumes with exactly n moves', () => {
    const rows = ['~  ~  D  ~', 'D  D  ~  ~', '~  ~  ~  ~', '~  ~  ~  ~'];
    const t = audit(rows, { goals: [{ kind: 'score', target: 1e9 }], moves: 1 });
    const res = t.swap(at(2, 0), at(2, 1));
    expect(res.snapshot.status).toBe('lost');
    expect(res.snapshot.movesLeft).toBe(0);
    expect(res.snapshot.canContinue).toBe(true);
    expect(res.steps[res.steps.length - 1]).toEqual({ type: 'status', status: 'lost' });
    const lost = t.snap;
    // nothing but addMoves works now, and only with a positive whole number
    for (const r of [t.swap(at(0, 0), at(1, 0)), t.hammer(at(0, 0)), t.shuffle(), t.endBonus()]) expectUnchanged(lost, r);
    for (const n of [0, -3, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = t.addMoves(n);
      expectUnchanged(lost, r);
      expect(r.steps).toEqual([]);
    }
    expectUnchanged(lost, t.game.addMoves(undefined as unknown as number));
    expectUnchanged(lost, t.game.addMoves('5' as unknown as number));
    const more = t.addMoves(5);
    expect(more.accepted).toBe(true);
    expect(more.steps).toEqual([{ type: 'status', status: 'playing' }]);
    expect(more.snapshot.status).toBe('playing');
    expect(more.snapshot.movesLeft).toBe(5);
    expect(more.snapshot.canContinue).toBeUndefined();
    expect(JSON.stringify(more.snapshot.cells)).toBe(JSON.stringify(lost.cells));
    expect(more.snapshot.score).toBe(lost.score);
    // while playing addMoves is refused
    const playing = t.snap;
    expectUnchanged(playing, t.addMoves(5));
    expect(t.game.validMoves().length).toBeGreaterThan(0);
  });

  it('stars follow the score thresholds (>=), and a lost level can have 0 stars', () => {
    const rows = ['~  ~  D  ~  ~', 'D  D  ~  D  ~', '~  ~  ~  ~  ~'];
    for (const [stars, want] of [
      [[141, 200, 300], 0],
      [[140, 200, 300], 1],
      [[100, 140, 300], 2],
      [[100, 120, 140], 3],
    ] as [[number, number, number], number][]) {
      const { res } = quietRun(rows, { stars, moves: 5 }, { op: 'swap', a: at(2, 0), b: at(2, 1) }, (r) => r.snapshot.score === 140);
      expect(res.snapshot.stars).toBe(want);
    }
  });

  it('colour goal: every gem-like piece of the colour that leaves the board counts — specials included', () => {
    const rows = ['~  ~  D  ~  ~', 'D- D  ~  D  ~', '~  ~  ~  ~  ~'];
    const t = audit(rows, { goals: [{ kind: 'color', color: D, target: 6 }] });
    const res = t.swap(at(2, 0), at(2, 1));
    // D- D D D leave (4); the new beam made by the match stays on the board and does not count yet
    expect(res.snapshot.goals[0].current).toBe(4);
    expect(res.snapshot.goals[0].target).toBe(6);
    const beam = res.snapshot.cells.findIndex((cell) => cell.piece?.kind === 'beamV' && cell.piece.color === D);
    expect(beam).toBeGreaterThanOrEqual(0);
    const fired = t.hammer(at(beam % 5, Math.floor(beam / 5)));
    expect(fired.snapshot.goals[0].current).toBe(5);
  });

  it('chain and sand goals count from the initial board', () => {
    const rows = ['~  ~  D  ~  ~', 'D# D  ~  D  ~', '~  ~  ~  E# ~'];
    const t = audit(rows, { goals: [{ kind: 'chain' }, { kind: 'sand' }], floor: ['00000', '22000', '00000'] });
    expect(t.snap.goals.map((g) => `${g.current}/${g.target}`)).toEqual(['0/2', '0/4']);
    const res = t.swap(at(2, 0), at(2, 1));
    // the chain at (0,1) broke and its cell lost one sand layer; (1,1) lost one as well
    expect(res.snapshot.goals.map((g) => `${g.current}/${g.target}`)).toEqual(['1/2', '2/4']);
    expect(res.snapshot.status).toBe('playing');
  });
});

describe('§2.9 end bonus', () => {
  const stoneBoard = ['~  ~  D  ~  ~', 'D  D  ~  ~  ~', '~  S1 ~  ~  ~', '~  ~  ~  ~  ~', '~  ~  ~  ~  ~'];

  it('each remaining move turns a plain gem into a beam and pays 250; then every special fires; movesLeft ends at 0', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const t = new Audit(build(stoneBoard, { goals: [{ kind: 'stone' }], moves: 5, stars: [100, 200, 300], seed }));
      const won = t.swap(at(2, 0), at(2, 1));
      expect(won.snapshot.status).toBe('won');
      expect(won.snapshot.movesLeft).toBe(4);
      const before = t.snap;
      const res = t.endBonus();
      expect(res.accepted).toBe(true);
      const tr = res.steps[0] as Extract<Step, { type: 'transform' }>;
      expect(tr.type).toBe('transform');
      expect(tr.reason).toBe('endBonus');
      expect(tr.score).toBe(4 * SCORE.endBonusPerMove);
      expect(tr.score).toBe(1000);
      expect(tr.changes.length).toBe(4);
      expect(new Set(tr.changes.map((c) => posKey(c.at))).size).toBe(4);
      for (const ch of tr.changes) {
        const old = pieceAt(before, ch.at.c, ch.at.r) as Piece;
        expect(old.kind).toBe('gem');
        expect(old.chained).toBe(false);
        expect(ch.piece.id).toBe(old.id);
        expect(ch.piece.color).toBe(old.color);
        expect(['beamH', 'beamV']).toContain(ch.piece.kind);
      }
      // all specials on the board fire together in the wave that follows
      const act = res.steps[1] as Extract<Step, { type: 'activate' }>;
      expect(act.type).toBe('activate');
      const specialsBefore = before.cells.filter((cell) => isSpecial(cell.piece) && !(cell.piece as Piece).chained).length;
      expect(act.fx.length).toBe(4 + specialsBefore);
      expect(res.snapshot.movesLeft).toBe(0);
      expect(res.snapshot.status).toBe('won');
      expect(res.snapshot.score).toBeGreaterThan(before.score + 1000);
      expect(res.snapshot.stars).toBe(3);
      // the board is stable afterwards and no special is left
      expect(res.snapshot.cells.some((cell) => isSpecial(cell.piece) && !(cell.piece as Piece).chained)).toBe(false);
      expect(refHasMatch(res.snapshot)).toBe(false);
      // only once
      const done = t.snap;
      expectUnchanged(done, t.endBonus());
    }
  });

  it('is refused while playing or lost', () => {
    const t = audit(stoneBoard, { goals: [{ kind: 'score', target: 1e9 }], moves: 1 });
    const playing = t.snap;
    const r = t.endBonus();
    expectUnchanged(playing, r);
    expect(r.steps).toEqual([]);
    t.swap(at(2, 0), at(2, 1));
    expect(t.snap.status).toBe('lost');
    const lost = t.snap;
    expectUnchanged(lost, t.endBonus());
  });

  it('pays for every remaining move even when the board has fewer plain gems than moves', () => {
    const t = audit(['~  ~  D  ~', 'D  D  ~  ~', '~  S1 ~  ~'], { goals: [{ kind: 'stone' }], moves: 40 });
    const won = t.swap(at(2, 0), at(2, 1));
    expect(won.snapshot.status).toBe('won');
    const before = t.snap;
    const plain = before.cells.filter((cell) => cell.piece?.kind === 'gem' && !cell.piece.chained).length;
    expect(plain).toBeLessThan(39);
    const res = t.endBonus();
    const tr = res.steps[0] as Extract<Step, { type: 'transform' }>;
    expect(tr.changes.length).toBe(plain);
    expect(tr.score).toBe(39 * 250);
    expect(res.snapshot.movesLeft).toBe(0);
  });

  it('with no move left and no special on the board it changes nothing but is still accepted once', () => {
    const rows = ['~  ~  D  ~', 'D  D  ~  ~', '~  S1 ~  ~', '~  ~  ~  ~'];
    const { t, res } = quietRun(rows, { goals: [{ kind: 'stone' }], moves: 1 }, { op: 'swap', a: at(2, 0), b: at(2, 1) }, (r) => !r.snapshot.cells.some((cell) => isSpecial(cell.piece)));
    expect(res.snapshot.status).toBe('won');
    const before = t.snap;
    const bonus = t.endBonus();
    expect(bonus.accepted).toBe(true);
    expect(bonus.steps).toEqual([]);
    expect(JSON.stringify(bonus.snapshot)).toBe(JSON.stringify(before));
    expectUnchanged(before, t.endBonus());
  });

  it('chained specials do not fire in the end bonus unless a blast frees them first', () => {
    const rows = ['~  ~  D  ~  ~', 'D  D  ~  ~  ~', '~  S1 ~  ~  ~', '~  ~  ~  ~  ~', '~  ~  ~  ~  E-#'];
    const { t } = quietRun(rows, { goals: [{ kind: 'stone' }], moves: 1 }, { op: 'swap', a: at(2, 0), b: at(2, 1) }, (r) => !r.snapshot.cells.some((cell) => isSpecial(cell.piece) && !(cell.piece as Piece).chained));
    const before = t.snap;
    const chained = pieceAt(before, 4, 4) as Piece;
    expect(chained.chained).toBe(true);
    const bonus = t.endBonus();
    expect(bonus.steps).toEqual([]);
    expect(pieceAt(bonus.snapshot, 4, 4)).toEqual(chained);
  });
});

describe('§2.10 score arithmetic', () => {
  it('constants', () => {
    expect(SCORE).toMatchObject({ gem: 20, cascadeCap: 8, beam: 60, nova: 120, prism: 200, sandLayer: 40, stoneLayer: 40, chain: 40, vine: 40, lamp: 500, endBonusPerMove: 250 });
  });

  it('a hand-computed turn: 60 (cascade 1) + 3 × 40 (cascade 2) + 4 × 60 + 60 beam (cascade 3)', () => {
    // E E E (made by the swap) clears; the F above drops between F F (cascade 2); that lets D D drop onto D D (cascade 3).
    const rows = [
      '~  ~  ~  ~  ~  ~',
      '~  ~  ~  ~  ~  ~',
      '~  ~  F  ~  ~  ~',
      'D  E  ~  ~  ~  ~',
      'D  ~  E  ~  ~  ~',
      'F  F  E  ~  ~  ~',
      'D  ~  ~  ~  ~  ~',
      'D  ~  ~  ~  ~  ~',
    ];
    const probe = build(rows);
    expect(refHasMatch(probe.snapshot())).toBe(false);
    const { res } = quietRun(rows, {}, { op: 'swap', a: at(1, 3), b: at(2, 3) }, (r) => {
      const c = clearsOf(r);
      return c.length === 3 && c[0].hits.length === 3 && c[1].hits.length === 3 && c[2].hits.length === 4;
    });
    const [one, two, three] = clearsOf(res);
    expect(hitCells(one)).toEqual(cellsOf('2,3 2,4 2,5'));
    expect(one.cascade).toBe(1);
    expect(one.score).toBe(60);
    expect(hitCells(two)).toEqual(cellsOf('0,5 1,5 2,5'));
    expect(two.cascade).toBe(2);
    expect(two.score).toBe(120);
    expect(hitCells(three)).toEqual(cellsOf('0,4 0,5 0,6 0,7'));
    expect(three.cascade).toBe(3);
    expect(three.score).toBe(4 * 60 + 60);
    expect(three.created[0].piece.kind).toBe('beamH');
    expect(res.snapshot.score).toBe(60 + 120 + 300);
    expect(stepTypes(res.steps)).toBe('swap clear fall clear fall clear fall');
  });

  it('the cascade multiplier stops at 8: gems cleared in cascade 9 and later still score 8 × 20', () => {
    // Long cascades on a three-colour board; the Referee recomputes every wave's score from the rules.
    const level: LevelDef = { id: 1, cols: 9, rows: 9, colors: 3, moves: 500, pieces: new Array<string>(9).fill('.........'), goals: [{ kind: 'score', target: 1e12 }], stars: [1e12, 2e12, 3e12] };
    let deep = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const game = new Game(level, { seed });
      const referee = new Referee(level, game.snapshot());
      const d = dice(seed);
      for (let n = 0; n < 60; n++) {
        const move = d.pick(game.validMoves());
        const before = game.snapshot();
        const call: Call = { op: 'swap', a: move.a, b: move.b };
        const res = perform(game, call);
        referee.check(before, call, res, game);
        let running = before.score;
        for (const step of res.steps) {
          if (step.type !== 'clear') continue;
          // the score of a wave of plain gems is a multiple of 20 × min(cascade, 8)
          const mult = Math.min(step.cascade, 8);
          let want = 0;
          for (const h of step.hits) {
            if (h.result === 'removed' && h.kind === 'gem') want += 20 * mult;
            else if (h.result === 'activated') want += 20 * mult;
          }
          for (const made of step.created) want += made.piece.kind === 'prism' ? 200 : made.piece.kind === 'nova' ? 120 : 60;
          expect(step.score).toBe(want);
          running += step.score;
          if (step.cascade >= 9 && step.hits.length > 0) deep++;
        }
        expect(res.snapshot.score).toBe(running);
      }
    }
    expect(deep).toBeGreaterThan(10);
  });
});

describe('§2.11 boosters', () => {
  it('hammer: one hit with cause "booster", never costs a move, refused when there is nothing to hit', () => {
    const t = audit(['~  ~  ~  ~  ~', '~  E# ~  0  _', '~  ~  L  ~  ~', '~  ~  ~  ~  ~'], { floor: ['00000', '00010', '00100', '00000'], moves: 3 });
    const start = t.snap;
    // refused: hole, outside the board, garbage
    for (const where of [at(4, 1), at(5, 0), at(-1, 0), at(0, 4), at(0.5, 0)]) {
      const r = t.hammer(where);
      expectUnchanged(start, r);
      expect(r.steps).toEqual([]);
    }
    expectUnchanged(start, t.game.useBooster('hammer'));
    expectUnchanged(start, t.game.useBooster('nonsense' as 'hammer', at(0, 0)));
    // an empty cell with sand: the sand goes (and then the pieces above drop into the cell)
    const b = t.hammer(at(3, 1));
    expect(clearsOf(b)[0].hits).toEqual([{ at: at(3, 1), cause: 'booster', result: 'none', pieceId: null, kind: null, color: -1, sandLeft: 0 }]);
    expect(clearsOf(b)[0].score).toBe(40);
    expect(b.steps[2].type).toBe('fall');
    // a chained gem: the chain breaks, the gem stays
    const a = t.hammer(at(1, 1));
    expect(a.steps[0]).toEqual({ type: 'booster', booster: 'hammer', at: at(1, 1) });
    expect(hitList(clearsOf(a)[0])).toEqual(['1,1:booster:unchained']);
    expect(clearsOf(a)[0].score).toBe(40);
    expect(pieceAt(a.snapshot, 1, 1)?.chained).toBe(false);
    expect(a.snapshot.movesLeft).toBe(3);
    // a lamp on sand: only the sand is hit; then the lamp has nothing left to hit
    const lampAt = at(2, 2);
    expect(pieceAt(t.snap, 2, 2)?.kind).toBe('lamp');
    expect(cellAt(t.snap, 2, 2).sand).toBe(1);
    const c = t.hammer(lampAt);
    expect(clearsOf(c)[0].hits).toEqual([{ at: lampAt, cause: 'booster', result: 'none', pieceId: pieceAt(t.snap, 2, 2)?.id, kind: 'lamp', color: -1, sandLeft: 0 }]);
    expect(stepTypes(c.steps)).toBe('booster clear');
    const before = t.snap;
    expectUnchanged(before, t.hammer(lampAt));
    expect(t.snap.movesLeft).toBe(3);
  });

  it('freeSwap: any two adjacent swappable pieces trade places without needing a match, then the board resolves', () => {
    const t = audit(['~  ~  ~  ~  ~', '~  ~  ~  ~  ~', '~  ~  ~  ~  ~'], { moves: 3 });
    expect(t.game.canSwap(at(0, 0), at(1, 0))).toBe(false);
    const before = t.snap;
    const res = t.freeSwap(at(0, 0), at(1, 0));
    expect(res.accepted).toBe(true);
    expect(res.steps[0]).toEqual({ type: 'booster', booster: 'freeSwap', at: at(0, 0) });
    expect(res.steps[1]).toEqual({ type: 'swap', a: at(0, 0), b: at(1, 0), valid: true });
    expect(pieceAt(res.snapshot, 0, 0)?.id).toBe(pieceAt(before, 1, 0)?.id);
    expect(pieceAt(res.snapshot, 1, 0)?.id).toBe(pieceAt(before, 0, 0)?.id);
    expect(res.snapshot.movesLeft).toBe(3);
  });

  it('freeSwap: a match it makes resolves like a swap (special on the swapped cell), still without costing a move', () => {
    const t = audit(['~  ~  D  ~  ~', 'D  D  ~  D  ~', '~  ~  ~  ~  ~'], { moves: 3 });
    const res = t.freeSwap(at(2, 0), at(2, 1));
    expect(stepTypes(res.steps.slice(0, 3))).toBe('booster swap clear');
    const first = clearsOf(res)[0];
    expect(first.created[0].at).toEqual(at(2, 1));
    expect(first.created[0].piece.kind).toBe('beamV');
    expect(res.snapshot.movesLeft).toBe(3);
  });

  it('freeSwap: refused for immovable pieces, empty cells, holes, non-adjacent cells and identical gems', () => {
    const t = audit(['A  A  S1 ~  V  ~', '~  D# ~  0  ~  _', 'L  L  ~  ~  ~  ~'], { moves: 3 });
    const start = t.snap;
    const refused: [Pos, Pos][] = [
      [at(0, 0), at(1, 0)], // identical gems: nothing would change
      [at(0, 2), at(1, 2)], // two lamps
      [at(1, 0), at(2, 0)], // stone
      [at(3, 0), at(4, 0)], // vine
      [at(1, 1), at(0, 1)], // chained
      [at(3, 1), at(2, 1)], // empty cell
      [at(4, 1), at(5, 1)], // hole
      [at(0, 0), at(2, 0)], // not adjacent
      [at(0, 0), at(1, 1)], // diagonal
      [at(0, 0), at(0, -1)],
    ];
    for (const [a, b] of refused) {
      const r = t.freeSwap(a, b);
      expectUnchanged(start, r);
      expect(r.steps).toEqual([]);
    }
    expectUnchanged(start, t.game.useBooster('freeSwap', at(0, 0)));
    // a lamp may be moved with it
    const ok = t.freeSwap(at(0, 2), at(0, 1));
    expect(ok.accepted).toBe(true);
  });

  it('freeSwap of two specials is a combo; with a prism it is a prism combo', () => {
    const t = audit(['~  ~  ~  ~  ~', '~  D- E| ~  ~', '~  ~  ~  ~  ~', '~  ~  ~  ~  ~', '~  ~  ~  ~  ~'], { moves: 3 });
    const res = t.freeSwap(at(1, 1), at(2, 1));
    expect(stepTypes(res.steps.slice(0, 4))).toBe('booster swap activate clear');
    expect(stepsOf(res.steps, 'activate')[0].fx[0].kind).toBe('cross');
    expect(res.snapshot.movesLeft).toBe(3);
  });

  it('start boosters: +3 moves; one prism; one beam and one nova — on plain gems, on a playable board', () => {
    const level: LevelDef = {
      id: 1,
      cols: 8,
      rows: 8,
      colors: 5,
      moves: 20,
      pieces: ['........', '..c..c..', '........', '.1....1.', '........', '...vv...', '........', '........'],
      goals: [{ kind: 'score', target: 1000 }],
      stars: [1000, 2000, 3000],
    };
    const count = (s: Snapshot, pred: (p: Piece) => boolean): number => s.cells.filter((cell) => cell.piece !== null && pred(cell.piece)).length;
    for (let seed = 1; seed <= 30; seed++) {
      const plain = new Game(level, { seed }).snapshot();
      expect(plain.movesLeft).toBe(20);
      expect(count(plain, isSpecial)).toBe(0);
      const extra = new Game(level, { seed, boosters: { extraMoves: true } }).snapshot();
      expect(extra.movesLeft).toBe(23);
      expect(JSON.stringify(extra.cells)).toBe(JSON.stringify(plain.cells));
      const prism = new Game(level, { seed, boosters: { prism: true } }).snapshot();
      expect(count(prism, (p) => p.kind === 'prism')).toBe(1);
      expect(count(prism, isSpecial)).toBe(1);
      const both = new Game(level, { seed, boosters: { beamNova: true } }).snapshot();
      expect(count(both, (p) => p.kind === 'beamH' || p.kind === 'beamV')).toBe(1);
      expect(count(both, (p) => p.kind === 'nova')).toBe(1);
      expect(count(both, isSpecial)).toBe(2);
      const all = new Game(level, { seed, boosters: { beamNova: true, prism: true, extraMoves: true } }).snapshot();
      expect(count(all, isSpecial)).toBe(3);
      expect(all.movesLeft).toBe(23);
      for (const s of [prism, both, all]) {
        expect(refHasMatch(s)).toBe(false);
        expect(refMoves(s).length).toBeGreaterThan(0);
        expect(s.status).toBe('playing');
        // the boosters replaced plain gems: blockers and chains are where the level put them
        s.cells.forEach((cell: CellView, i: number) => {
          const was = plain.cells[i].piece as Piece;
          const now = cell.piece as Piece;
          if (was.kind !== 'gem' || was.chained) expect(now).toEqual(was);
          else if (now.kind !== 'gem') expect(now.chained).toBe(false);
        });
      }
    }
  });
});

describe('rejected calls and determinism (§2.12)', () => {
  const level: LevelDef = {
    id: 1,
    cols: 7,
    rows: 7,
    colors: 4,
    moves: 12,
    pieces: ['.......', '.c...c.', '...L...', '.1.v.1.', '.......', '.......', '.......'],
    floor: ['0000000', '0000000', '0011100', '0011100', '0000000', '0000000', '0000000'],
    goals: [{ kind: 'sand' }, { kind: 'lamp', target: 2 }],
    stars: [3000, 6000, 9000],
    lamps: { total: 3, maxOnBoard: 1, everyMoves: 2 },
  };

  function play(seed: number, botSeed: number, noise: boolean): string[] {
    const game = new Game(level, { seed });
    const bot = dice(botSeed);
    const junk = dice(999);
    const out: string[] = [];
    for (let n = 0; n < 40; n++) {
      if (noise) {
        // calls that must all be refused in this state, in between the real ones
        const before = JSON.stringify(game.snapshot());
        const status = game.snapshot().status;
        const refused: TurnResult[] = [
          game.swap(at(junk.int(9) - 1, junk.int(9) - 1), at(junk.int(9) - 1, junk.int(9) - 1)),
          game.useBooster('hammer', at(-1, junk.int(3))),
          game.useBooster('freeSwap', at(0, 0), at(2, 2)),
          status === 'playing' ? game.addMoves(3) : game.useBooster('shuffle'),
          status === 'won' ? game.addMoves(3) : game.endBonus(),
        ];
        game.hint();
        game.validMoves();
        game.canSwap(at(0, 0), at(1, 0));
        game.snapshot();
        for (const r of refused) {
          if (r.accepted) throw new Error('the noise call was accepted');
          expect(JSON.stringify(r.snapshot)).toBe(before);
        }
      }
      const status = game.snapshot().status;
      let res: TurnResult;
      if (status === 'won') {
        res = game.endBonus();
        out.push(JSON.stringify(res));
        break;
      } else if (status === 'lost') {
        res = game.addMoves(3);
        if (!res.accepted) break;
      } else {
        const moves = game.validMoves();
        const move = bot.pick(moves);
        res = bot.chance(0.15) ? game.useBooster('hammer', move.a) : game.swap(move.a, move.b);
      }
      out.push(JSON.stringify(res));
    }
    return out;
  }

  it('same level + seed + inputs give byte-identical results; another seed gives another game', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const a = play(seed, 5, false);
      const b = play(seed, 5, false);
      expect(b).toEqual(a);
      expect(a.length).toBeGreaterThan(5);
    }
    expect(play(1, 5, false)).not.toEqual(play(2, 5, false));
  });

  it('refused calls and queries leave no trace: the game continues exactly as if they had never been made', () => {
    for (let seed = 1; seed <= 8; seed++) expect(play(seed, 5, true)).toEqual(play(seed, 5, false));
  });

  it('a refused shuffle booster does not disturb the random sequence either', () => {
    // two specials offer a move, but the only two plain gems are alike: no shuffle can change the board
    const rows = ['D- E|', 'A  A'];
    const a = build(rows, { seed: 5 });
    const b = build(rows, { seed: 5 });
    const before = a.snapshot();
    const refused = a.useBooster('shuffle');
    expectUnchanged(before, refused);
    expect(refused.steps).toEqual([]);
    expect(JSON.stringify(a.swap(at(0, 0), at(1, 0)))).toBe(JSON.stringify(b.swap(at(0, 0), at(1, 0))));
  });

  it('snapshots are deep copies: changing one never changes the game', () => {
    const game = new Game(level, { seed: 3 });
    const snap = game.snapshot();
    const text = JSON.stringify(snap);
    for (const cell of snap.cells) {
      if (cell.piece) {
        cell.piece.color = 0;
        cell.piece.kind = 'prism';
        cell.piece.chained = false;
      }
      cell.sand = 0;
    }
    snap.goals[0].current = 99;
    (snap.goals[0].goal as { kind: string }).kind = 'score';
    snap.movesLeft = 0;
    expect(JSON.stringify(game.snapshot())).toBe(text);
    const move = game.validMoves()[0];
    const res = game.swap(move.a, move.b);
    const after = JSON.stringify(game.snapshot());
    expect(JSON.stringify(res.snapshot)).toBe(after);
    res.snapshot.cells.length = 0;
    for (const step of res.steps) if (step.type === 'fall') for (const s of step.spawns) s.piece.color = 5;
    expect(JSON.stringify(game.snapshot())).toBe(after);
    expect(game.level).toBe(level);
  });

  it('a level with no moves cannot be played: it starts lost (addMoves resumes), never with negative moves', () => {
    for (const moves of [0, -4, Number.NaN]) {
      const game = new Game({ ...level, moves }, { seed: 1 });
      const s = game.snapshot();
      expect(s.movesLeft).toBe(0);
      expect(s.status).toBe('lost');
      expect(s.canContinue).toBe(true);
      expect(game.validMoves()).toEqual([]);
      const res = game.addMoves(2);
      expect(res.accepted).toBe(true);
      expect(res.snapshot.status).toBe('playing');
      expect(res.snapshot.movesLeft).toBe(2);
    }
    // the extraMoves booster gives such a level three moves
    const boosted = new Game({ ...level, moves: 0 }, { seed: 1, boosters: { extraMoves: true } });
    expect(boosted.snapshot().status).toBe('playing');
    expect(boosted.snapshot().movesLeft).toBe(3);
  });
});

describe('validateLevel agrees with the engine', () => {
  it('"can never be refilled" is reported for exactly the cells a flood fill through the holes cannot reach', () => {
    const d = dice(555);
    let flagged = 0;
    let clean = 0;
    for (let n = 0; n < 400; n++) {
      const cols = 3 + d.int(7);
      const height = 3 + d.int(7);
      const holes = 0.05 + d.next() * 0.3;
      const pieces: string[] = [];
      for (let r = 0; r < height; r++) {
        let line = '';
        for (let c = 0; c < cols; c++) line += d.chance(holes) ? '_' : '.';
        pieces.push(line);
      }
      if (!pieces.some((row) => row.includes('.'))) continue;
      const level: LevelDef = { id: n + 1, cols, rows: height, colors: 5, moves: 10, pieces, goals: [{ kind: 'score', target: 100 }], stars: [100, 200, 300] };
      const problems = validateLevel(level);
      const reported = problems
        .map((p) => /^cell column (\d+), row (\d+) can never be refilled/.exec(p))
        .filter((m): m is RegExpExecArray => m !== null)
        .map((m) => `${m[1]},${m[2]}`)
        .sort();
      // the same question asked of the engine's own start snapshot (no blockers: only holes matter)
      const start = new Game(level, { seed: 1 }).snapshot();
      const flow = reachable(start);
      const unreachable: string[] = [];
      start.cells.forEach((cell, i) => {
        const key = `${i % cols},${Math.floor(i / cols)}`;
        if (cell.exists && !flow.has(key)) unreachable.push(key);
      });
      expect(reported, pieces.join(' / ')).toEqual(unreachable.sort());
      if (unreachable.length > 0) flagged++;
      else clean++;
      // a level the validator accepts starts playable, whatever the seed
      if (problems.length === 0) {
        for (let seed = 1; seed <= 5; seed++) {
          const s = new Game(level, { seed }).snapshot();
          if (s.status !== 'playing' || refHasMatch(s) || refMoves(s).length === 0) throw new Error(`valid level starts badly (seed ${seed}): ${pieces.join(' / ')}`);
        }
      }
    }
    expect(flagged).toBeGreaterThan(50);
    expect(clean).toBeGreaterThan(50);
  });
});
