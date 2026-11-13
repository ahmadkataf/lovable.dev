import { describe, expect, it } from 'vitest';
import { DRAG_COMMIT, T, cascadeScale, columnDelay, fallDuration, finaleFlights, hintDelay, prismRayDelay, transformDelay } from '../../src/play/timing.ts';

describe('timing table', () => {
  it('follows the responsiveness budget', () => {
    expect(T.swap).toBe(160);
    expect(T.invalidOut).toBe(130);
    expect(T.invalidBack).toBe(130);
    expect(T.popGrow + T.popShrink).toBe(180);
    expect(DRAG_COMMIT).toBe(0.45);
    // a simple 3-match: swap + pop + a short fall leaves the board interactive in well under a second
    expect(T.swap + T.popGrow + T.popShrink + fallDuration(3)).toBeLessThanOrEqual(900);
  });

  it('fall duration grows as n^0.6', () => {
    expect(fallDuration(1)).toBe(90);
    expect(fallDuration(3)).toBe(174);
    expect(fallDuration(6)).toBe(264);
    expect(fallDuration(8)).toBe(313);
    expect(fallDuration(0)).toBe(0);
    expect(fallDuration(-2)).toBe(0);
  });

  it('cascades speed up by 0.92 per step down to 0.6', () => {
    expect(cascadeScale(1)).toBe(1);
    expect(cascadeScale(0)).toBe(1);
    expect(cascadeScale(2)).toBeCloseTo(0.92, 5);
    expect(cascadeScale(3)).toBeCloseTo(0.8464, 5);
    expect(cascadeScale(30)).toBe(0.6);
    for (let c = 1; c < 20; c++) expect(cascadeScale(c + 1)).toBeLessThanOrEqual(cascadeScale(c));
  });

  it('column stagger is 20 ms per column, 100 ms in total at most', () => {
    expect(columnDelay(0, 9)).toBe(0);
    expect(columnDelay(1, 3)).toBe(20);
    expect(columnDelay(2, 3)).toBe(40);
    expect(columnDelay(8, 9)).toBe(100);
    expect(columnDelay(4, 9)).toBe(50);
    expect(columnDelay(3, 1)).toBe(0);
  });

  it('prism rays and transforms all start within their cap', () => {
    expect(prismRayDelay(0, 40)).toBe(0);
    expect(prismRayDelay(3, 5)).toBe(90);
    expect(prismRayDelay(39, 40)).toBeLessThanOrEqual(T.prismRaysMax);
    expect(transformDelay(19, 20)).toBeLessThanOrEqual(T.transformMax);
    expect(transformDelay(2, 4)).toBe(68);
  });

  it('finale flights shrink by 10 % each, never below the floor, and fit the budget', () => {
    expect(finaleFlights(3, 5000)).toEqual([200, 180, 162]);
    const many = finaleFlights(30, 100000);
    expect(many[0]).toBe(200);
    expect(Math.min(...many)).toBe(T.finaleFlightFloor);
    const squeezed = finaleFlights(40, 2200);
    expect(squeezed.length).toBe(40);
    expect(squeezed.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(2200 + 40);
    expect(finaleFlights(0, 1000)).toEqual([]);
  });

  it('hints come sooner on the first ten levels', () => {
    expect(hintDelay(1)).toBe(3000);
    expect(hintDelay(10)).toBe(3000);
    expect(hintDelay(11)).toBe(5000);
  });
});
