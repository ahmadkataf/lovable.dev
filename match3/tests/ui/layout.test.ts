import { describe, expect, it } from 'vitest';
import {
  BANNER_HEIGHT,
  BANNER_LIFT,
  METRICS,
  litCount,
  naturalHeight,
  nodePos,
  scrollFor,
  sectionHeight,
  smoothPath,
  smoothPieces,
  spanCount,
  swing,
  trailPoints,
} from '../../src/ui/map/layout.ts';
import type { SectionGeo } from '../../src/ui/map/layout.ts';

const m = METRICS;

function geo(from: number, to: number, isLast = false, foot = 0, extra = 0): SectionGeo {
  return { span: { from, to }, height: naturalHeight(to - from + 1, m, foot, isLast) + extra, foot };
}

describe('map layout', () => {
  it('counts the levels of a span', () => {
    expect(spanCount({ from: 1, to: 20 })).toBe(20);
    expect(spanCount({ from: 21, to: 21 })).toBe(1);
    expect(spanCount({ from: 5, to: 4 })).toBe(0);
  });

  it('a section is as tall as its banner, its nodes and its head room', () => {
    expect(sectionHeight(20, m, false)).toBe(m.bannerZone + 20 * m.step + m.headZone);
    expect(sectionHeight(20, m, true)).toBe(sectionHeight(20, m, false) + m.capZone);
    expect(naturalHeight(20, m, 90, false)).toBe(sectionHeight(20, m, false) + 90);
    expect(sectionHeight(-3, m, false)).toBe(m.bannerZone + m.headZone);
  });

  it('the banner fits into the banner zone, below the first node', () => {
    const firstNodeBottom = m.bannerZone + m.step / 2 - 43; // the current node is 86 units tall
    expect(BANNER_LIFT + BANNER_HEIGHT).toBeLessThan(firstNodeBottom - 10);
  });

  it('the trail swings within its amplitude and never jumps between neighbours', () => {
    for (let id = 1; id <= 400; id++) {
      const v = swing(id);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
      // neighbouring nodes must not collide: 68-unit nodes, `step` apart vertically
      const dx = Math.abs(swing(id + 1) - v) * m.amp;
      expect(Math.hypot(dx, m.step)).toBeGreaterThan(86);
      expect(dx).toBeLessThan(m.amp * 1.2);
    }
  });

  it('the trail uses both sides of the screen', () => {
    let min = 1;
    let max = -1;
    for (let id = 1; id <= 40; id++) {
      min = Math.min(min, swing(id));
      max = Math.max(max, swing(id));
    }
    expect(min).toBeLessThan(-0.6);
    expect(max).toBeGreaterThan(0.6);
  });

  it('nodes are measured from the bottom of their section and mirror in RTL', () => {
    const g = geo(21, 40, false, 0);
    const first = nodePos(21, g, m, false);
    const second = nodePos(22, g, m, false);
    expect(first.y).toBe(m.bannerZone + m.step / 2);
    expect(second.y - first.y).toBe(m.step);
    expect(nodePos(21, g, m, true).x).toBeCloseTo(-first.x, 10);
    expect(nodePos(21, g, m, true).y).toBe(first.y);
    // the first chapter keeps clear of the tray
    expect(nodePos(1, geo(1, 20, false, 96), m, false).y).toBe(96 + m.bannerZone + m.step / 2);
  });

  it('every node stays inside the track box', () => {
    const g = geo(1, 20);
    for (let id = 1; id <= 20; id++) {
      const p = nodePos(id, g, m, false);
      expect(Math.abs(p.x) + 43).toBeLessThanOrEqual(m.trackWidth / 2);
    }
  });

  it('neighbouring sections draw the same point at their seam', () => {
    const a = geo(1, 20, false, 90, 0);
    const b = geo(21, 40, false, 0, 37); // taller than natural (padded to the viewport)
    const c = geo(41, 60, true);
    const ptsA = trailPoints(a, null, b, m, false);
    const ptsB = trailPoints(b, a, c, m, false);
    expect(ptsA.length).toBe(21);
    expect(ptsB.length).toBe(22);
    expect(ptsA.map((p) => p.level)).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
    // A's last own node, seen from B: below B's bottom edge by exactly its distance from A's top
    const lastA = ptsA[19]!;
    const fromB = ptsB[0]!;
    expect(fromB.level).toBe(20);
    expect(fromB.x).toBeCloseTo(lastA.x, 6);
    expect(fromB.y - b.height).toBeCloseTo(lastA.y, 6);
    // B's first node, seen from A: above A's top edge
    const firstB = ptsB[1]!;
    const fromA = ptsA[20]!;
    expect(fromA.level).toBe(21);
    expect(fromA.x).toBeCloseTo(firstB.x, 6);
    expect(fromA.y).toBeCloseTo(firstB.y - b.height, 6);
    // the two pieces across the seam describe the same segment (only shifted by the section height)
    const pieceA = smoothPieces(ptsA)[20]!;
    const pieceB = smoothPieces(ptsB)[1]!;
    const endA = pieceA.split(' ').slice(-2).map(Number);
    const endB = pieceB.split(' ').slice(-2).map(Number);
    expect(endA[0]).toBeCloseTo(endB[0]!, 1);
    expect(endA[1]! + b.height).toBeCloseTo(endB[1]!, 0);
  });

  it('smooth paths start with a move and add one curve per further point', () => {
    expect(smoothPath([])).toBe('');
    expect(smoothPath([{ x: 1, y: 2 }])).toBe('');
    expect(smoothPieces([{ x: 1, y: 2 }])).toEqual(['M1 2']);
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 20 },
      { x: 0, y: 40 },
      { x: 10, y: 60 },
    ];
    const pieces = smoothPieces(pts);
    expect(pieces.length).toBe(4);
    expect(pieces[0]).toBe('M0 0');
    expect(pieces[3]!.endsWith('10 60')).toBe(true);
    expect(smoothPath(pts)).toBe(pieces.join(''));
    // a prefix of the pieces is a prefix of the curve: the lit part lies exactly on the full trail
    expect(smoothPath(pts).indexOf(pieces.slice(0, 3).join(''))).toBe(0);
    expect(/NaN|undefined/.test(smoothPath(pts))).toBe(false);
  });

  it('the lit part of a trail ends at the frontier', () => {
    const b = geo(21, 40);
    const pts = trailPoints(b, geo(1, 20), geo(41, 60, true), m, false);
    expect(litCount(pts, 0)).toBe(0);
    expect(litCount(pts, 20)).toBe(1);
    expect(litCount(pts, 25)).toBe(6);
    expect(litCount(pts, 40)).toBe(21);
    expect(litCount(pts, 999)).toBe(22);
  });

  it('scroll targets are clamped to the world', () => {
    expect(scrollFor(1000, 600, 5000, 0.6)).toBe(640);
    expect(scrollFor(100, 600, 5000, 0.6)).toBe(0);
    expect(scrollFor(4990, 600, 5000, 0.6)).toBe(4400);
    expect(scrollFor(100, 600, 300, 0.6)).toBe(0);
  });
});
