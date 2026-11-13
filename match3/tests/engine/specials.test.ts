import { describe, expect, it } from 'vitest';
import type { Fx, Hit, Pos, Snapshot, Step } from '../../src/engine/index.ts';
import { P, board, cellOf, checkTurn, pieceOf, stepTypes, stepsOf } from './helpers.ts';

// DESIGN §2.4 / §2.5 — what specials do, chain reactions, and the six swap combos.

type Clear = Extract<Step, { type: 'clear' }>;
type Activate = Extract<Step, { type: 'activate' }>;
const key = (p: Pos): string => `${p.c},${p.r}`;
const keys = (ps: Pos[]): string[] => ps.map(key).sort();
const hitKeys = (hits: Hit[]): string[] => hits.map((h) => key(h.at)).sort();
const C3 = { colors: 3 };

/** Cells of the board satisfying a predicate on (dc, dr) relative to `at` — the reference shape of an effect. */
function shape(s: Snapshot, at: Pos, inside: (dc: number, dr: number) => boolean): string[] {
  const out: string[] = [];
  for (let r = 0; r < s.rows; r++) {
    for (let c = 0; c < s.cols; c++) {
      if (cellOf(s, c, r).exists && inside(Math.abs(c - at.c), Math.abs(r - at.r))) out.push(`${c},${r}`);
    }
  }
  return out.sort();
}

function filler(cols: number, rows: number): string[] {
  const out: string[] = [];
  for (let r = 0; r < rows; r++) out.push(new Array(cols).fill('~').join(' '));
  return out;
}

function put(rows: string[], c: number, r: number, token: string): void {
  const cells = (rows[r] as string).split(' ');
  cells[c] = token;
  rows[r] = cells.join(' ');
}

describe('single specials', () => {
  it('beamH hits every cell of its row, across holes', () => {
    const g = board(['~ ~ ~ ~ ~ ~', 'fH ~ ~ _ ~ ~', '~ ~ ~ ~ ~ ~'], C3);
    const before = g.snapshot();
    const res = g.useBooster('hammer', P(0, 1));
    expect(stepTypes(res.steps).startsWith('booster clear activate clear fall')).toBe(true);
    const [hammer, blast] = stepsOf(res.steps, 'clear') as [Clear, Clear];
    expect(hammer.hits).toHaveLength(1);
    expect(hammer.hits[0]).toMatchObject({ at: P(0, 1), cause: 'booster', result: 'activated', kind: 'beamH', color: 5 });
    expect(hammer.score).toBe(20);
    const fx = (stepsOf(res.steps, 'activate')[0] as Activate).fx;
    expect(fx).toHaveLength(1);
    expect(fx[0]).toMatchObject({ kind: 'beamH', at: P(0, 1), color: 5 });
    expect(keys(fx[0]!.targets)).toEqual(['0,1', '1,1', '2,1', '4,1', '5,1']);
    expect(hitKeys(blast.hits)).toEqual(['1,1', '2,1', '4,1', '5,1']);
    expect(blast.hits.every((h) => h.cause === 'blast' && h.result === 'removed')).toBe(true);
    expect(blast.score).toBe(80);
    checkTurn(g, before, res, 'booster', undefined, false);
  });

  it('beamV hits every cell of its column', () => {
    const g = board(['~ ~ ~', '~ ~ ~', '~ eV ~', '~ ~ ~', '~ ~ ~'], C3);
    const res = g.useBooster('hammer', P(1, 2));
    const fx = stepsOf(res.steps, 'activate')[0]!.fx[0]!;
    expect(fx).toMatchObject({ kind: 'beamV', at: P(1, 2), color: 4 });
    expect(keys(fx.targets)).toEqual(['1,0', '1,1', '1,2', '1,3', '1,4']);
    expect(hitKeys(stepsOf(res.steps, 'clear')[1]!.hits)).toEqual(['1,0', '1,1', '1,3', '1,4']);
  });

  it('nova hits the 13-cell diamond of radius 2', () => {
    const rows = filler(7, 7);
    put(rows, 3, 3, 'dN');
    const g = board(rows, C3);
    const before = g.snapshot();
    const res = g.useBooster('hammer', P(3, 3));
    const fx = stepsOf(res.steps, 'activate')[0]!.fx[0]!;
    expect(fx).toMatchObject({ kind: 'nova', at: P(3, 3), color: 3 });
    expect(fx.targets).toHaveLength(13);
    expect(keys(fx.targets)).toEqual(shape(before, P(3, 3), (dc, dr) => dc + dr <= 2));
    const blast = stepsOf(res.steps, 'clear')[1]!;
    expect(blast.hits).toHaveLength(12); // the centre is already empty
    expect(blast.score).toBe(12 * 20);
    expect(blast.popups).toEqual([{ at: P(3, 3), value: 240 }]);
    checkTurn(g, before, res, 'booster', undefined, false);
  });

  it('nova in a corner is clipped to the board', () => {
    const rows = filler(5, 5);
    put(rows, 0, 0, 'dN');
    const res = board(rows, C3).useBooster('hammer', P(0, 0));
    const fx = stepsOf(res.steps, 'activate')[0]!.fx[0]!;
    expect(keys(fx.targets)).toEqual(['0,0', '0,1', '0,2', '1,0', '1,1', '2,0']);
  });

  it('a prism set off by a hit clears the most common colour', () => {
    const g = board([
      'd e d e d',
      'e d e d e',
      'd e P e d',
      'e d e f e', // one d replaced: 11 d, 12 e
      'd e d e d',
    ]);
    const before = g.snapshot();
    const res = g.useBooster('hammer', P(2, 2));
    expect(stepsOf(res.steps, 'clear')[0]!.hits[0]).toMatchObject({ result: 'activated', kind: 'prism', color: -1 });
    const fx = stepsOf(res.steps, 'activate')[0]!.fx[0]!;
    expect(fx).toMatchObject({ kind: 'prism', at: P(2, 2), color: 4 });
    expect(fx.targets).toHaveLength(12);
    for (const t of fx.targets) expect(pieceOf(before, t.c, t.r)?.color).toBe(4);
    const blast = stepsOf(res.steps, 'clear')[1]!;
    expect(blast.hits).toHaveLength(12);
    expect(blast.hits.every((h) => h.color === 4 && h.result === 'removed')).toBe(true);
  });

  it('prism colour ties go to the lowest colour', () => {
    const res = board(['d e d e d', 'e d e d e', 'd e P e d', 'e d e d e', 'd e d e d']).useBooster('hammer', P(2, 2));
    expect(stepsOf(res.steps, 'activate')[0]!.fx[0]!.color).toBe(3);
  });

  it('a prism with no gems left to clear still fires (and reaches nothing)', () => {
    const res = board(['P 1 1', '1 1 1']).useBooster('hammer', P(0, 0));
    const fx = stepsOf(res.steps, 'activate')[0]!.fx[0]!;
    expect(fx).toMatchObject({ kind: 'prism', color: -1, targets: [] });
  });
});

describe('chain reactions', () => {
  it('beam → nova → prism: each fires in its own wave, in order, before any gravity', () => {
    const g = board(
      [
        '~ ~ ~ ~ ~ ~ ~',
        'fH f ~ ~ ~ dN ~',
        '~ ~ f ~ ~ ~ ~',
        '~ ~ ~ ~ ~ P ~',
        '~ ~ ~ ~ ~ ~ ~',
      ],
      C3,
    );
    const before = g.snapshot();
    const res = g.swap(P(2, 2), P(2, 1));
    expect(stepTypes(res.steps).startsWith('swap clear activate clear activate clear activate clear fall')).toBe(true);
    const clears = stepsOf(res.steps, 'clear');
    const acts = stepsOf(res.steps, 'activate');
    for (let k = 0; k < 4; k++) expect(clears[k]!.cascade).toBe(1);

    // wave 1: the match sets the beam off
    expect(clears[0]!.hits.find((h) => h.kind === 'beamH')).toMatchObject({ at: P(0, 1), result: 'activated', cause: 'match' });
    // wave 2: the beam sweeps row 1 and sets the nova off
    expect(acts[0]!.fx.map((f) => [f.kind, key(f.at)])).toEqual([['beamH', '0,1']]);
    expect(hitKeys(clears[1]!.hits)).toEqual(['3,1', '4,1', '5,1', '6,1']);
    expect(clears[1]!.hits.find((h) => h.kind === 'nova')).toMatchObject({ at: P(5, 1), result: 'activated', cause: 'blast' });
    // wave 3: the nova's diamond reaches the prism
    expect(acts[1]!.fx.map((f) => [f.kind, key(f.at), f.color])).toEqual([['nova', '5,1', 3]]);
    expect(keys(acts[1]!.fx[0]!.targets)).toEqual(shape(before, P(5, 1), (dc, dr) => dc + dr <= 2));
    expect(hitKeys(clears[2]!.hits)).toEqual(['4,0', '4,2', '5,0', '5,2', '5,3', '6,0', '6,2']);
    expect(clears[2]!.hits.find((h) => h.kind === 'prism')).toMatchObject({ at: P(5, 3), result: 'activated' });
    // wave 4: the prism clears one colour
    expect(acts[2]!.fx.map((f) => [f.kind, key(f.at)])).toEqual([['prism', '5,3']]);
    const color = acts[2]!.fx[0]!.color;
    expect(color).toBeGreaterThanOrEqual(0);
    expect(clears[3]!.hits.length).toBeGreaterThan(0);
    expect(clears[3]!.hits.every((h) => h.color === color)).toBe(true);
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  it('specials set off by the same blast fire together in the next wave; each fires once', () => {
    const g = board(['~ ~ ~ ~ ~', 'fH ~ eV ~ dV', '~ ~ ~ ~ ~'], C3);
    const before = g.snapshot();
    const res = g.useBooster('hammer', P(0, 1));
    expect(stepTypes(res.steps).startsWith('booster clear activate clear activate clear fall')).toBe(true);
    const acts = stepsOf(res.steps, 'activate');
    expect(acts[0]!.fx.map((f) => f.kind)).toEqual(['beamH']);
    expect(acts[1]!.fx.map((f) => [f.kind, key(f.at), f.color])).toEqual([
      ['beamV', '2,1', 4],
      ['beamV', '4,1', 3],
    ]);
    // three specials existed, three effects fired in total (before the first fall)
    const firstFall = res.steps.findIndex((s) => s.type === 'fall');
    const fired = res.steps.slice(0, firstFall).filter((s) => s.type === 'activate') as Activate[];
    expect(fired.reduce((n, a) => n + a.fx.length, 0)).toBe(3);
    checkTurn(g, before, res, 'booster', undefined, false);
  });

  it('a cell reached by two effects of the same wave is hit by both', () => {
    const g = board(
      [
        '~ ~ ~ ~ ~',
        '~ ~ 3 ~ ~',
        'fH eN ~ dN ~',
        '~ ~ ~ ~ ~',
        '~ ~ ~ ~ ~',
      ],
      { colors: 3, floor: ['00000', '00000', '00200', '00000', '00000'] },
    );
    const before = g.snapshot();
    const stoneId = pieceOf(before, 2, 1)!.id;
    const res = g.useBooster('hammer', P(0, 2));
    const acts = stepsOf(res.steps, 'activate');
    expect(acts[1]!.fx.map((f) => f.kind)).toEqual(['nova', 'nova']);
    // both diamonds contain the stone at (2,1) and the sandy cell at (2,2)
    for (const fx of acts[1]!.fx) {
      expect(keys(fx.targets)).toContain('2,1');
      expect(keys(fx.targets)).toContain('2,2');
    }
    // the wave in which both novas fire is the third clear step (hammer, beam, novas)
    const wave = stepsOf(res.steps, 'clear')[2]!;
    const stoneHits = wave.hits.filter((h) => h.pieceId === stoneId);
    expect(stoneHits.map((h) => [h.result, h.hpLeft])).toEqual([
      ['damaged', 2],
      ['damaged', 1],
    ]);
    // the beam already cleared the gem on (2,2) and one sand layer; the two novas take the rest:
    // the first removes the last layer, the second finds nothing left to hit
    const beamWave = stepsOf(res.steps, 'clear')[1]!;
    expect(beamWave.hits.find((h) => h.at.c === 2 && h.at.r === 2)).toMatchObject({ result: 'removed', sandLeft: 1 });
    expect(wave.hits.filter((h) => h.at.c === 2 && h.at.r === 2)).toEqual([
      { at: P(2, 2), cause: 'blast', result: 'none', pieceId: null, kind: null, color: -1, sandLeft: 0 },
    ]);
    // one popup per nova, and together they account for the whole wave
    expect(wave.popups.map((p) => `${p.at.c},${p.at.r}`)).toEqual(['1,2', '3,2']);
    expect(wave.popups.reduce((n, p) => n + p.value, 0)).toBe(wave.score);
    checkTurn(g, before, res, 'booster', undefined, false);
  });

  it('a special in the crossfire of two effects still fires only once', () => {
    // hammer the corner nova → it sets off the column beam at (2,0) and the row beam at (0,2),
    // which fire together and cross on the nova at (2,2)
    const g = board(['dN ~ eV ~ ~', '~ ~ ~ ~ ~', 'fH ~ dN ~ ~', '~ ~ ~ ~ ~', '~ ~ ~ ~ ~'], C3);
    const before = g.snapshot();
    const centre = pieceOf(before, 2, 2)!;
    const res = g.useBooster('hammer', P(0, 0));
    expect(stepTypes(res.steps).startsWith('booster clear activate clear activate clear activate clear fall')).toBe(true);
    const acts = stepsOf(res.steps, 'activate');
    expect(acts[0]!.fx.map((f) => [f.kind, key(f.at)])).toEqual([['nova', '0,0']]);
    expect(acts[1]!.fx.map((f) => [f.kind, key(f.at)])).toEqual([
      ['beamV', '2,0'],
      ['beamH', '0,2'],
    ]);
    for (const fx of acts[1]!.fx) expect(keys(fx.targets)).toContain('2,2');
    // the first beam sets the centre nova off and removes it; the second finds the cell empty
    const crossing = stepsOf(res.steps, 'clear')[2]!;
    expect(crossing.hits.filter((h) => h.at.c === 2 && h.at.r === 2)).toEqual([
      { at: P(2, 2), cause: 'blast', result: 'activated', pieceId: centre.id, kind: 'nova', color: 3 },
    ]);
    expect(acts[2]!.fx.map((f) => [f.kind, key(f.at)])).toEqual([['nova', '2,2']]);
    checkTurn(g, before, res, 'booster', undefined, false);
  });
});

describe('swap combos', () => {
  it('prism + gem: every gem-like piece of that colour is hit; the prism is used up', () => {
    const rows = [
      '~ ~ ~ ~ ~ ~',
      '~ f ~ ~ fN ~',
      '~ ~ P f ~ ~',
      '~ f* ~ ~ ~ ~',
      '~ ~ ~ ~ 2 ~',
    ];
    const g = board(rows, C3);
    const before = g.snapshot();
    const prismId = pieceOf(before, 2, 2)!.id;
    const res = g.swap(P(2, 2), P(3, 2));
    expect(res.accepted).toBe(true);
    expect(res.snapshot.movesLeft).toBe(before.movesLeft - 1);
    expect(stepTypes(res.steps).startsWith('swap activate clear activate clear fall')).toBe(true);
    const fx = stepsOf(res.steps, 'activate')[0]!.fx;
    expect(fx).toHaveLength(1);
    expect(fx[0]).toMatchObject({ kind: 'prism', at: P(3, 2), color: 5 });
    expect(keys(fx[0]!.targets)).toEqual(['1,1', '1,3', '2,2', '4,1']);
    const clear = stepsOf(res.steps, 'clear')[0]!;
    const byCell = new Map(clear.hits.map((h) => [key(h.at), h]));
    expect(byCell.size).toBe(5);
    expect(byCell.get('3,2')).toMatchObject({ pieceId: prismId, kind: 'prism', result: 'activated', cause: 'blast' });
    expect(byCell.get('2,2')).toMatchObject({ kind: 'gem', result: 'removed' });
    expect(byCell.get('1,1')).toMatchObject({ kind: 'gem', result: 'removed' });
    expect(byCell.get('4,1')).toMatchObject({ kind: 'nova', result: 'activated' });
    expect(byCell.get('1,3')).toMatchObject({ kind: 'gem', result: 'unchained' });
    expect(clear.score).toBe(20 + 20 + 20 + 20 + 40);
    expect(clear.popups).toEqual([{ at: P(3, 2), value: 120 }]);
    // the nova of that colour goes off in the next wave
    expect(stepsOf(res.steps, 'activate')[1]!.fx.map((f) => [f.kind, key(f.at)])).toEqual([['nova', '4,1']]);
    checkTurn(g, before, res, 'swap', undefined, false);

    // dragging the gem onto the prism instead centres the effect on the prism's old cell
    const other = board(rows, C3).swap(P(3, 2), P(2, 2));
    const fx2 = stepsOf(other.steps, 'activate')[0]!.fx[0]!;
    expect(fx2).toMatchObject({ kind: 'prism', at: P(2, 2), color: 5 });
    const prismHit = stepsOf(other.steps, 'clear')[0]!.hits.find((h) => h.kind === 'prism')!;
    expect(prismHit.at).toEqual(P(3, 2));
  });

  for (const partner of ['H', 'N'] as const) {
    it(`prism + ${partner === 'H' ? 'beam' : 'nova'}: every plain gem of the colour becomes one, then they all fire`, () => {
      const g = board(
        [
          '~ ~ ~ ~ ~ ~',
          '~ e ~ ~ e ~',
          `~ ~ P e${partner} ~ ~`,
          '~ e* ~ ~ ~ ~',
          '~ ~ ~ e ~ ~',
        ],
        C3,
      );
      const before = g.snapshot();
      const res = g.swap(P(2, 2), P(3, 2));
      expect(stepTypes(res.steps).startsWith('swap transform activate clear activate clear fall')).toBe(true);

      const transform = stepsOf(res.steps, 'transform')[0]!;
      expect(transform.reason).toBe('prismCombo');
      expect(transform.score).toBe(0);
      expect(keys(transform.changes.map((c) => c.at))).toEqual(['1,1', '3,4', '4,1']); // not the chained one
      for (const change of transform.changes) {
        expect(change.piece.id).toBe(pieceOf(before, change.at.c, change.at.r)!.id); // ids are kept
        expect(change.piece.color).toBe(4);
        if (partner === 'N') expect(change.piece.kind).toBe('nova');
        else expect(['beamH', 'beamV']).toContain(change.piece.kind);
      }

      const acts = stepsOf(res.steps, 'activate');
      expect(acts[0]!.fx).toHaveLength(1);
      expect(acts[0]!.fx[0]).toMatchObject({ kind: 'prism', at: P(3, 2), color: 4 });
      expect(keys(acts[0]!.fx[0]!.targets)).toEqual(['1,1', '1,3', '2,2', '3,4', '4,1']);

      const clear = stepsOf(res.steps, 'clear')[0]!;
      const results = clear.hits.map((h) => `${key(h.at)}:${h.result}`).sort();
      expect(results).toEqual(['1,1:activated', '1,3:unchained', '2,2:activated', '3,2:activated', '3,4:activated', '4,1:activated']);

      // all four specials of that colour fire together
      const second = acts[1]!.fx;
      expect(keys(second.map((f) => f.at))).toEqual(['1,1', '2,2', '3,4', '4,1']);
      for (const f of second) {
        expect(f.color).toBe(4);
        if (partner === 'N') expect(f.kind).toBe('nova');
        else expect(['beamH', 'beamV']).toContain(f.kind);
      }
      checkTurn(g, before, res, 'swap', undefined, false);
    });
  }

  it('prism + prism: every cell of the board is hit exactly once', () => {
    const g = board(['~ ~ ~ ~', '~ P P ~', '~ 2 fN ~', 'L e* 0 ~', '~ ~ ~ ~'], { colors: 3, floor: ['2000', '0100', '0100', '1010', '0000'] });
    const before = g.snapshot();
    const res = g.swap(P(1, 1), P(2, 1));
    expect(stepTypes(res.steps).startsWith('swap activate clear activate clear')).toBe(true);
    const fx = stepsOf(res.steps, 'activate')[0]!.fx;
    expect(fx).toHaveLength(1);
    expect(fx[0]).toMatchObject({ kind: 'prismAll', at: P(2, 1), color: -1 });
    expect(fx[0]!.targets).toHaveLength(20);
    const clear = stepsOf(res.steps, 'clear')[0]!;
    const byCell = new Map(clear.hits.map((h) => [key(h.at), h]));
    expect(byCell.size).toBe(clear.hits.length); // no cell twice
    expect(clear.hits).toHaveLength(20); // every cell has a piece or sand
    expect(byCell.get('1,1')).toMatchObject({ kind: 'prism', result: 'activated', sandLeft: 0 });
    expect(byCell.get('2,1')).toMatchObject({ kind: 'prism', result: 'activated' });
    expect(byCell.get('1,2')).toMatchObject({ kind: 'stone', result: 'damaged', hpLeft: 1 });
    expect(byCell.get('1,2')!.sandLeft).toBeUndefined(); // the stone shields its sand
    expect(byCell.get('2,2')).toMatchObject({ kind: 'nova', result: 'activated' });
    expect(byCell.get('0,3')).toMatchObject({ kind: 'lamp', result: 'none', sandLeft: 0 });
    expect(byCell.get('1,3')).toMatchObject({ result: 'unchained' });
    expect(byCell.get('2,3')).toMatchObject({ pieceId: null, kind: null, result: 'none', sandLeft: 0 });
    expect(byCell.get('0,0')).toMatchObject({ kind: 'gem', result: 'removed', sandLeft: 1 });
    expect(clear.popups).toEqual([{ at: P(2, 1), value: clear.score }]);
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  const comboCases: { name: string; a: string; b: string; kind: Fx['kind']; inside: (dc: number, dr: number) => boolean; count: number }[] = [
    { name: 'beam + beam → cross (row and column)', a: 'fH', b: 'eV', kind: 'cross', inside: (dc, dr) => dc === 0 || dr === 0, count: 17 },
    { name: 'beam + nova → bigCross (three rows and three columns)', a: 'fV', b: 'eN', kind: 'bigCross', inside: (dc, dr) => dc <= 1 || dr <= 1, count: 45 },
    { name: 'nova + beam → bigCross', a: 'fN', b: 'eH', kind: 'bigCross', inside: (dc, dr) => dc <= 1 || dr <= 1, count: 45 },
    {
      name: 'nova + nova → bigNova (5×5 plus the four tips)',
      a: 'fN',
      b: 'eN',
      kind: 'bigNova',
      inside: (dc, dr) => (dc <= 2 && dr <= 2) || (dc === 3 && dr === 0) || (dc === 0 && dr === 3),
      count: 29,
    },
  ];
  for (const cc of comboCases) {
    it(cc.name, () => {
      const rows = filler(9, 9);
      put(rows, 3, 4, cc.a);
      put(rows, 4, 4, cc.b);
      const g = board(rows, C3);
      const before = g.snapshot();
      const idA = pieceOf(before, 3, 4)!.id;
      const idB = pieceOf(before, 4, 4)!.id;
      const res = g.swap(P(3, 4), P(4, 4));
      expect(res.accepted).toBe(true);
      expect(stepTypes(res.steps).startsWith('swap activate clear fall')).toBe(true);
      const fx = stepsOf(res.steps, 'activate')[0]!.fx;
      expect(fx).toHaveLength(1);
      // centred on the destination cell, coloured like the piece that was dragged there
      expect(fx[0]).toMatchObject({ kind: cc.kind, at: P(4, 4), color: 5 });
      expect(fx[0]!.targets).toHaveLength(cc.count);
      expect(keys(fx[0]!.targets)).toEqual(shape(before, P(4, 4), cc.inside));
      const clear = stepsOf(res.steps, 'clear')[0]!;
      expect(hitKeys(clear.hits)).toEqual(keys(fx[0]!.targets));
      // both partners are used up by the combo and do not fire on their own
      expect(clear.hits.find((h) => h.pieceId === idA)).toMatchObject({ at: P(4, 4), result: 'activated' });
      expect(clear.hits.find((h) => h.pieceId === idB)).toMatchObject({ at: P(3, 4), result: 'activated' });
      expect(clear.hits.filter((h) => h.result === 'removed')).toHaveLength(cc.count - 2);
      expect(clear.score).toBe(cc.count * 20);
      expect(clear.popups).toEqual([{ at: P(4, 4), value: cc.count * 20 }]);
      checkTurn(g, before, res, 'swap', undefined, false);
    });
  }

  it('a combo is centred on the cell the player dragged to, and clipped at the edges', () => {
    const rows = filler(5, 5);
    put(rows, 0, 0, 'fN');
    put(rows, 1, 0, 'eN');
    const g = board(rows, C3);
    const before = g.snapshot();
    const res = g.swap(P(1, 0), P(0, 0));
    const fx = stepsOf(res.steps, 'activate')[0]!.fx[0]!;
    expect(fx).toMatchObject({ kind: 'bigNova', at: P(0, 0), color: 4 });
    expect(keys(fx.targets)).toEqual(shape(before, P(0, 0), (dc, dr) => (dc <= 2 && dr <= 2) || (dc === 3 && dr === 0) || (dc === 0 && dr === 3)));
    expect(fx.targets).toHaveLength(11);
  });

  it('specials reached by a combo fire afterwards (chain reaction)', () => {
    const rows = filler(7, 7);
    put(rows, 2, 3, 'fH');
    put(rows, 3, 3, 'eV');
    put(rows, 3, 0, 'dN'); // in the column of the cross
    const res = board(rows, C3).swap(P(2, 3), P(3, 3));
    expect(stepTypes(res.steps).startsWith('swap activate clear activate clear fall')).toBe(true);
    expect(stepsOf(res.steps, 'activate')[1]!.fx.map((f) => [f.kind, key(f.at)])).toEqual([['nova', '3,0']]);
  });
});
