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
  step: 92,
  bannerZone: 168,
  headZone: 64,
  amp: 98,
  capZone: 210,
  trackWidth: 360,
};

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
  const a = (levelId - 1) * 0.93;
  const v = 0.82 * Math.sin(a) + 0.18 * Math.sin(a * 2.37 + 1.1);
  return v > 1 ? 1 : v < -1 ? -1 : v;
}

/** Centre of a level's node: x from the centre line (mirrored when `rtl`), y up from the section's bottom edge. */
export function nodePos(levelId: number, span: Span, m: MapMetrics, rtl: boolean): Pt {
  const i = levelId - span.from;
  const x = swing(levelId) * m.amp;
  return { x: rtl ? -x : x, y: m.bannerZone + (i + 0.5) * m.step };
}

/** The same point in the coordinates of the section's trail drawing (origin top-left of the track box). */
export function trackPoint(levelId: number, span: Span, m: MapMetrics, rtl: boolean, isLast: boolean): Pt {
  const p = nodePos(levelId, span, m, rtl);
  const h = sectionHeight(spanCount(span), m, isLast);
  return { x: m.trackWidth / 2 + p.x, y: h - p.y };
}

function r1(n: number): string {
  return String(Math.round(n * 10) / 10);
}

/**
 * SVG path data of a smooth curve through the points (Catmull-Rom converted to cubic Béziers).
 * Fewer than two points give an empty string.
 */
export function smoothPath(points: readonly Pt[]): string {
  const n = points.length;
  if (n < 2) return '';
  let d = 'M' + r1(points[0]!.x) + ' ' + r1(points[0]!.y);
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2 < n ? i + 2 : n - 1]!;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += 'C' + r1(c1x) + ' ' + r1(c1y) + ' ' + r1(c2x) + ' ' + r1(c2y) + ' ' + r1(p2.x) + ' ' + r1(p2.y);
  }
  return d;
}

/**
 * The points a chapter's trail runs through, in its own drawing coordinates: one point below the
 * section (the previous chapter's last node), its own nodes, and one above (the next chapter's
 * first node), so neighbouring sections draw the same curve across the seam.
 * `upTo` limits the trail to levels ≤ upTo (the lit part); the result may be empty.
 */
export function trailPoints(
  chapter: Span,
  prev: Span | null,
  next: Span | null,
  m: MapMetrics,
  rtl: boolean,
  isLast: boolean,
  upTo: number,
): Pt[] {
  const pts: Pt[] = [];
  const h = sectionHeight(spanCount(chapter), m, isLast);
  const cx = m.trackWidth / 2;
  if (prev && spanCount(prev) > 0 && prev.to <= upTo) {
    // the previous chapter's last node lies headZone + step/2 under this section's bottom edge
    const x = swing(prev.to) * m.amp;
    pts.push({ x: cx + (rtl ? -x : x), y: h + m.headZone + m.step / 2 });
  }
  for (let id = chapter.from; id <= chapter.to && id <= upTo; id++) {
    pts.push(trackPoint(id, chapter, m, rtl, isLast));
  }
  if (next && spanCount(next) > 0 && next.from <= upTo) {
    const x = swing(next.from) * m.amp;
    // the next chapter's first node lies bannerZone + step/2 above this section's top edge
    pts.push({ x: cx + (rtl ? -x : x), y: -(m.bannerZone + m.step / 2) });
  }
  return pts;
}

/** Scroll offset that puts a point `y` (px from the top of the world) at `anchor` (0..1) of the viewport, clamped. */
export function scrollFor(y: number, viewport: number, worldHeight: number, anchor: number): number {
  const max = Math.max(0, worldHeight - viewport);
  const top = y - viewport * anchor;
  return top < 0 ? 0 : top > max ? max : top;
}

/** Indices of the sections that intersect [top − margin, bottom + margin]; `tops`/`heights` in px, any order. */
export function sectionsNear(tops: readonly number[], heights: readonly number[], top: number, bottom: number, margin: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < tops.length; i++) {
    const a = tops[i]!;
    const b = a + heights[i]!;
    if (b >= top - margin && a <= bottom + margin) out.push(i);
  }
  return out;
}
