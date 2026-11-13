import { describe, expect, it } from 'vitest';
import { cappedDpr, cellAtPoint, cellCentre, dragOf, fitBoard, isAdjacent, isLandscape, samePos } from '../../src/play/geometry.ts';

describe('fitBoard', () => {
  it('fills the width of a portrait stage and centres the board', () => {
    const r = fitBoard(360, 430, 9, 9, 8, 2, 200);
    expect(r.cell).toBe(38);
    expect(r.w).toBe(342);
    expect(r.x).toBe(9);
    expect(r.y).toBe(44);
  });

  it('is limited by the height in landscape', () => {
    const r = fitBoard(400, 340, 9, 9, 6, 1, 200);
    expect(r.cell).toBe(36);
    expect(r.h).toBe(324);
    expect(r.y).toBe(8);
  });

  it('snaps the cell to whole device pixels and respects the cap', () => {
    const r = fitBoard(355, 600, 9, 9, 7, 3, 200);
    expect(Math.round(r.cell * 3)).toBeCloseTo(r.cell * 3, 6);
    expect(r.cell * 9).toBeLessThanOrEqual(355 - 14);
    expect(fitBoard(1000, 1000, 5, 5, 0, 1, 112).cell).toBe(112);
  });

  it('never returns a zero cell', () => {
    expect(fitBoard(0, 0, 9, 9, 10, 2, 100).cell).toBeGreaterThan(0);
  });
});

describe('hit testing', () => {
  const rect = { x: 10, y: 50, cell: 40, w: 360, h: 360 };
  it('uses whole cells', () => {
    expect(cellAtPoint(rect, 9, 9, 10, 50)).toEqual({ c: 0, r: 0 });
    expect(cellAtPoint(rect, 9, 9, 49.9, 89.9)).toEqual({ c: 0, r: 0 });
    expect(cellAtPoint(rect, 9, 9, 50, 90)).toEqual({ c: 1, r: 1 });
    expect(cellAtPoint(rect, 9, 9, 369, 409)).toEqual({ c: 8, r: 8 });
  });
  it('is null outside the board', () => {
    expect(cellAtPoint(rect, 9, 9, 9, 60)).toBeNull();
    expect(cellAtPoint(rect, 9, 9, 370, 60)).toBeNull();
    expect(cellAtPoint(rect, 9, 9, 60, 410)).toBeNull();
  });
  it('gives cell centres', () => {
    expect(cellCentre(rect, 0, 0)).toEqual({ x: 30, y: 70 });
    expect(cellCentre(rect, 8, 8)).toEqual({ x: 350, y: 390 });
  });
});

describe('dragOf', () => {
  it('follows the dominant axis only', () => {
    expect(dragOf(30, 5, 40)).toMatchObject({ dc: 1, dr: 0 });
    expect(dragOf(-30, 5, 40)).toMatchObject({ dc: -1, dr: 0 });
    expect(dragOf(4, -22, 40)).toMatchObject({ dc: 0, dr: -1 });
    expect(dragOf(4, 22, 40)).toMatchObject({ dc: 0, dr: 1 });
  });
  it('commits at 45 % of a cell and clamps to one cell', () => {
    expect(dragOf(17.9, 0, 40).commit).toBe(false);
    expect(dragOf(18, 0, 40).commit).toBe(true);
    expect(dragOf(200, 0, 40).amount).toBe(1);
    expect(dragOf(10, 0, 40).amount).toBeCloseTo(0.25, 6);
  });
  it('dragging back cancels', () => {
    expect(dragOf(0, 0, 40)).toEqual({ dc: 0, dr: 0, amount: 0, commit: false });
    expect(dragOf(3, 1, 40).commit).toBe(false);
  });
  it('reuses the object it is given', () => {
    const out = { dc: 9, dr: 9, amount: 9, commit: true };
    expect(dragOf(0, -40, 40, out)).toBe(out);
    expect(out).toEqual({ dc: 0, dr: -1, amount: 1, commit: true });
  });
});

describe('small helpers', () => {
  it('adjacency is orthogonal', () => {
    expect(isAdjacent({ c: 1, r: 1 }, { c: 2, r: 1 })).toBe(true);
    expect(isAdjacent({ c: 1, r: 1 }, { c: 1, r: 0 })).toBe(true);
    expect(isAdjacent({ c: 1, r: 1 }, { c: 2, r: 2 })).toBe(false);
    expect(isAdjacent({ c: 1, r: 1 }, { c: 1, r: 1 })).toBe(false);
    expect(samePos({ c: 1, r: 1 }, { c: 1, r: 1 })).toBe(true);
    expect(samePos(null, { c: 1, r: 1 })).toBe(false);
  });
  it('caps the device pixel ratio at 3', () => {
    expect(cappedDpr(4, 3)).toBe(3);
    expect(cappedDpr(2.625, 3)).toBe(2.625);
    expect(cappedDpr(0.5, 3)).toBe(1);
    expect(cappedDpr(NaN, 3)).toBe(1);
  });
  it('landscape only when clearly wider than tall', () => {
    expect(isLandscape(640, 360)).toBe(true);
    expect(isLandscape(360, 640)).toBe(false);
    expect(isLandscape(800, 760)).toBe(false);
    expect(isLandscape(1280, 800)).toBe(true);
  });
});
