/**
 * Geometry of the journey map (pure, unit-tested). All lengths are design units (1 unit = 1 px on
 * a 360-px-wide phone). The journey is drawn bottom-up: level 1 sits at the bottom of the world,
 * chapters are stacked upwards, and inside a chapter everything is measured from the section's
 * bottom edge so extra height (short test chapters on tall screens) simply becomes more sky.
 */

export interface MapMetrics {
  /** Vertical distance between two neighbouring nodes. */
  step: number;
  /** Space under the first node of a chapter: holds the chapter banner. */
  bannerZone: number;
  /** Space above the last node of a chapter. */
  headZone: number;
  /** Horizontal swing of the trail around the centre line. */
  amp: number;
  /** Extra space above the last chapter: the "more levels are on the way" plaque. */
  capZone: number;
  /** Width of the trail's drawing box (centred). */
  trackWidth: number;
}

export const METRICS: MapMetrics = {
  step: 104,
  bannerZone: 172,
  headZone: 70,
  amp: 98,
  capZone: 78,
  trackWidth: 360,
};

/** Height of the chapter banner and its distance from the bottom of the banner zone. */
export const BANNER_HEIGHT = 104;
export const BANNER_LIFT = 30;

export interface Span {
  from: number;
  to: number;
}

export interface Pt {
  x: number;
  y: number;
}

/** Number of levels in a chapter (0 for a malformed span). */
export function spanCount(span: Span): number {
  const n = Math.floor(span.to) - Math.floor(span.from) + 1;
  return n > 0 ? n : 0;
}

/** Height of a chapter's section. */
export function sectionHeight(count: number, m: MapMetrics, isLast: boolean): number {
  return m.bannerZone + Math.max(0, count) * m.step + m.headZone + (isLast ? m.capZone : 0);
}

/**
 * Sideways position of a level on the trail, −1 … 1. A slow main wave with a small second one on
 * top, driven by the global level number so the trail runs on smoothly from chapter to chapter.
 */
export function swing(levelId: number): number {
  const a = (levelId - 1) * 0.86;
  const v = 0.82 * Math.sin(a) + 0.18 * Math.sin(a * 2.37 + 1.1);
  return v > 1 ? 1 : v < -1 ? -1 : v;
}

/** A chapter's section as laid out: its level span and its resolved sizes. */
export interface SectionGeo {
  span: Span;
  /** Total height of the section. */
  height: number;
  /** Extra space under the banner zone (the first chapter keeps clear of the bottom tray). */
  foot: number;
}

/** The height a chapter needs: foot + banner zone + its nodes + head zone (+ the cap above the last chapter). */
export function naturalHeight(count: number, m: MapMetrics, foot: number, isLast: boolean): number {
  return Math.max(0, foot) + sectionHeight(count, m, isLast);
}

/** Centre of a level's node: x from the centre line (mirrored when `rtl`), y up from the section's bottom edge. */
export function nodePos(levelId: number, geo: SectionGeo, m: MapMetrics, rtl: boolean): Pt {
  const i = levelId - geo.span.from;
  const x = swing(levelId) * m.amp;
  return { x: rtl ? -x : x, y: geo.foot + m.bannerZone + (i + 0.5) * m.step };
}

function r1(n: number): string {
  return String(Math.round(n * 10) / 10);
}

/**
 * A smooth curve through the points (Catmull-Rom converted to cubic Béziers) as SVG path pieces:
 * piece 0 is the "M" of the first point, piece i (i ≥ 1) the "C" that leads to point i. Joining
 * the first k + 1 pieces draws the curve up to point k with exactly the shape of the full curve.
 */
export function smoothPieces(points: readonly Pt[]): string[] {
  const n = points.length;
  if (n < 1) return [];
  const out: string[] = ['M' + r1(points[0]!.x) + ' ' + r1(points[0]!.y)];
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2 < n ? i + 2 : n - 1]!;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    out.push('C' + r1(c1x) + ' ' + r1(c1y) + ' ' + r1(c2x) + ' ' + r1(c2y) + ' ' + r1(p2.x) + ' ' + r1(p2.y));
  }
  return out;
}

/** SVG path data of the smooth curve through all the points ('' for fewer than two). */
export function smoothPath(points: readonly Pt[]): string {
  return points.length < 2 ? '' : smoothPieces(points).join('');
}

export interface TrailPt extends Pt {
  /** The level whose node sits at this point. */
  level: number;
}

/**
 * The points a chapter's trail runs through, in the section's own drawing coordinates (origin at
 * the top-left of a `trackWidth`-wide box centred in the section, y down): the previous chapter's
 * last node (below the section), its own nodes, and the next chapter's first node (above), so
 * neighbouring sections draw the same curve across the seam.
 */
export function trailPoints(cur: SectionGeo, prev: SectionGeo | null, next: SectionGeo | null, m: MapMetrics, rtl: boolean): TrailPt[] {
  const pts: TrailPt[] = [];
  const cx = m.trackWidth / 2;
  if (prev && spanCount(prev.span) > 0) {
    const p = nodePos(prev.span.to, prev, m, rtl);
    pts.push({ x: cx + p.x, y: cur.height + (prev.height - p.y), level: prev.span.to });
  }
  for (let id = cur.span.from; id <= cur.span.to; id++) {
    const p = nodePos(id, cur, m, rtl);
    pts.push({ x: cx + p.x, y: cur.height - p.y, level: id });
  }
  if (next && spanCount(next.span) > 0) {
    const p = nodePos(next.span.from, next, m, rtl);
    pts.push({ x: cx + p.x, y: -p.y, level: next.span.from });
  }
  return pts;
}

/** How many leading trail points belong to levels ≤ `upTo` (the lit part of the trail). */
export function litCount(points: readonly TrailPt[], upTo: number): number {
  let n = 0;
  while (n < points.length && points[n]!.level <= upTo) n++;
  return n;
}

/** Scroll offset that puts a point `y` (px from the top of the world) at `anchor` (0..1) of the viewport, clamped. */
export function scrollFor(y: number, viewport: number, worldHeight: number, anchor: number): number {
  const max = Math.max(0, worldHeight - viewport);
  const top = y - viewport * anchor;
  return top < 0 ? 0 : top > max ? max : top;
}
