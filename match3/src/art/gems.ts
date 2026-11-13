/**
 * The six gems and their special variants (beam / nova) plus the prism.
 * Everything is drawn in a 100×100 unit box (the caller scales the context); `px` is the real
 * device size, used only for things the transform does not scale (shadow blur / offset).
 *
 * Silhouettes (docs/DESIGN.md §3): 0 ruby = round brilliant, 1 amber = hexagon,
 * 2 emerald = stepped rounded square, 3 sapphire = teardrop, 4 amethyst = trillion,
 * 5 moonstone = kite.
 */
import type { Color } from '../engine/types.ts';
import type { Ctx } from './util.ts';
import { PAL, TAU, circle, khatamPts, lGrad, mix, ngon, poly, rgba, roundPoly, sparkle } from './util.ts';

export interface GemTone {
  /** rim / deepest shadow */
  deep: string;
  dark: string;
  /** the colour's identity hue (DESIGN table) */
  base: string;
  light: string;
  /** near-white tint for facets and glints */
  pale: string;
}

export const GEM_TONES: readonly GemTone[] = [
  { deep: '#6a0624', dark: '#c40d38', base: '#ff3350', light: '#ff7480', pale: '#ffd9d6' },
  { deep: '#7c3400', dark: '#ea7200', base: '#ffa21a', light: '#ffcd40', pale: '#fff4c4' },
  { deep: '#05482d', dark: '#0b9852', base: '#1fd072', light: '#66f09c', pale: '#d6ffe2' },
  { deep: '#0b1f80', dark: '#184ee0', base: '#2f80ff', light: '#6cb0ff', pale: '#dcecff' },
  { deep: '#400a8a', dark: '#8022e2', base: '#b150ff', light: '#d08cff', pale: '#f4e2ff' },
  { deep: '#12668c', dark: '#34b2da', base: '#84ecff', light: '#c4f9ff', pale: '#ffffff' },
];

export const GEM_COLORS: readonly string[] = ['#ff4d5e', '#ffa630', '#2fd17c', '#3d8bff', '#b05cff', '#8ff0ff'];

interface Facet {
  pts: number[];
  /** -1 … 1: negative = in shadow, positive = catching the light */
  s: number;
}

interface GemShape {
  cx: number;
  cy: number;
  /** rough half-extent of the silhouette (used to convert unit insets into scale factors) */
  size: number;
  outline(p: Path2D): void;
  facets: Facet[];
  table: number[];
  tableRound: number;
  /** specular spot: x, y, rx, ry, rotation */
  spec: [number, number, number, number, number];
  /** small companion glint: x, y, r */
  dot: [number, number, number];
}

// Light comes from the top-left.
const LX = -0.6;
const LY = -0.8;

function facet(cx: number, cy: number, pts: number[], bias: number): Facet {
  let x = 0;
  let y = 0;
  const n = pts.length >> 1;
  for (let i = 0; i < n; i++) {
    x += pts[2 * i];
    y += pts[2 * i + 1];
  }
  const dx = x / n - cx;
  const dy = y / n - cy;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  let s = ((dx * LX + dy * LY) / d) * 0.72 + bias;
  if (s > 1) s = 1;
  if (s < -1) s = -1;
  return { pts, s };
}

function scalePts(pts: readonly number[], cx: number, cy: number, k: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < pts.length; i += 2) out.push(cx + (pts[i] - cx) * k, cy + (pts[i + 1] - cy) * k);
  return out;
}

/** Quads between two rings of corresponding points. */
function ringFacets(cx: number, cy: number, outer: readonly number[], inner: readonly number[], bias: (i: number) => number): Facet[] {
  const n = outer.length >> 1;
  const out: Facet[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    out.push(
      facet(
        cx,
        cy,
        [outer[2 * i], outer[2 * i + 1], outer[2 * j], outer[2 * j + 1], inner[2 * j], inner[2 * j + 1], inner[2 * i], inner[2 * i + 1]],
        bias(i),
      ),
    );
  }
  return out;
}

function withMidpoints(pts: readonly number[], cx: number, cy: number, push: number): number[] {
  const n = pts.length >> 1;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    out.push(pts[2 * i], pts[2 * i + 1]);
    const mx = (pts[2 * i] + pts[2 * j]) / 2;
    const my = (pts[2 * i + 1] + pts[2 * j + 1]) / 2;
    const dx = mx - cx;
    const dy = my - cy;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    out.push(mx + (dx / d) * push, my + (dy / d) * push);
  }
  return out;
}

// ───────────────────────────── shapes ─────────────────────────────
//
// Every silhouette is sized so its longer side spans about 86% of the cell and is centred a little
// above the middle (y ≈ 48.5), which leaves room for the cast shadow underneath.

function rubyShape(): GemShape {
  const cx = 50;
  const cy = 48.5;
  const R = 42.5;
  const rt = 17.5;
  const ra = 29;
  const ro = R + 3;
  const facets: Facet[] = [];
  const A = (deg: number, r: number): [number, number] => {
    const a = (deg * Math.PI) / 180;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  for (let k = 0; k < 8; k++) {
    const t0 = A(22.5 + 45 * k, rt);
    const t1 = A(22.5 + 45 * (k + 1), rt);
    const a0 = A(45 * k, ra);
    const a1 = A(45 * (k + 1), ra);
    const g0 = A(22.5 + 45 * k, ro);
    const gPrev = A(22.5 + 45 * (k - 1), ro);
    const m0 = A(45 * k, ro);
    // star facet on the table edge t0–t1
    facets.push(facet(cx, cy, [t0[0], t0[1], t1[0], t1[1], a1[0], a1[1]], 0.22));
    // kite (bezel) facet around t0
    facets.push(facet(cx, cy, [t0[0], t0[1], a0[0], a0[1], g0[0], g0[1], a1[0], a1[1]], k % 2 === 0 ? 0.1 : -0.12));
    // girdle facet between two kites
    facets.push(facet(cx, cy, [a0[0], a0[1], gPrev[0], gPrev[1], m0[0], m0[1], g0[0], g0[1]], k % 2 === 0 ? -0.16 : 0));
  }
  return {
    cx,
    cy,
    size: R,
    outline: (p) => circle(p, cx, cy, R),
    facets,
    table: ngon(cx, cy, rt, 8, Math.PI / 8),
    tableRound: 0.6,
    spec: [31.5, 25.5, 6.6, 3.9, -0.72],
    dot: [24.2, 35.2, 1.9],
  };
}

function amberShape(): GemShape {
  const cx = 50;
  const cy = 48.5;
  const stretch = (pts: number[]): number[] => {
    for (let i = 1; i < pts.length; i += 2) pts[i] = cy + (pts[i] - cy) * 1.07;
    return pts;
  };
  const outer = stretch(ngon(cx, cy, 45, 6, 0));
  const big = stretch(ngon(cx, cy, 49, 6, 0));
  const mid = stretch(ngon(cx, cy, 33.5, 6, 0));
  const table = stretch(ngon(cx, cy, 21.5, 6, 0));
  const facets = ringFacets(cx, cy, big, mid, (i) => (i % 2 === 0 ? 0.05 : -0.07)).concat(
    ringFacets(cx, cy, mid, table, (i) => (i % 2 === 0 ? -0.04 : 0.16)),
  );
  return {
    cx,
    cy,
    size: 42,
    outline: (p) => roundPoly(p, outer, 7),
    facets,
    table,
    tableRound: 1.8,
    spec: [34.5, 22.5, 7.4, 3.8, -0.42],
    dot: [24, 32, 1.9],
  };
}

function emeraldShape(): GemShape {
  const cx = 50;
  const cy = 48.5;
  const sq = (h: number): number[] => [cx - h, cy - h, cx + h, cy - h, cx + h, cy + h, cx - h, cy + h];
  const outer = sq(39.5);
  const big = sq(43.5);
  const mid = sq(29.5);
  const table = sq(19);
  // top / left steps catch the light, bottom / right steps fall into shade
  const facets = ringFacets(cx, cy, big, mid, (i) => (i === 0 || i === 3 ? 0.1 : -0.14)).concat(ringFacets(cx, cy, mid, table, (i) => (i === 0 || i === 3 ? 0.24 : 0)));
  return {
    cx,
    cy,
    size: 39.5,
    outline: (p) => roundPoly(p, outer, 15),
    facets,
    table,
    tableRound: 4,
    spec: [28.5, 23, 7.2, 3.7, -0.6],
    dot: [20.6, 32.6, 1.9],
  };
}

function sapphireShape(): GemShape {
  const cx = 50;
  const cy = 55.5;
  // points around the drop, clockwise from the apex
  const ring = [50, 5, 62, 24, 78, 39, 86, 56, 76.5, 80, 50, 92, 23.5, 80, 14, 56, 22, 39, 38, 24];
  const big = scalePts(ring, cx, cy, 1.12);
  const table = scalePts(ring, cx, cy + 1.5, 0.45);
  const facets = ringFacets(cx, cy, big, table, (i) => (i % 2 === 0 ? 0.08 : -0.08));
  return {
    cx,
    cy,
    size: 38,
    outline: (p) => {
      p.moveTo(46.4, 10);
      p.quadraticCurveTo(50, 2.4, 53.6, 10);
      p.bezierCurveTo(60, 24.5, 85.5, 36, 85.5, 56);
      p.arc(50, 56, 35.5, 0, Math.PI);
      p.bezierCurveTo(14.5, 36, 40, 24.5, 46.4, 10);
      p.closePath();
    },
    facets,
    table,
    tableRound: 3.2,
    spec: [31.5, 42.5, 6.4, 3.7, -0.98],
    dot: [24.6, 52.6, 1.8],
  };
}

function amethystShape(): GemShape {
  // trillion, apex down: the mass sits high, the opposite of the sapphire's drop
  const V = [5.5, 12.5, 94.5, 12.5, 50, 93.5];
  const cx = 50;
  const cy = 40.5;
  const bulge = 4.6;
  const corner = 15;
  const outerPts = withMidpoints(V, cx, cy, bulge + 3);
  const table = scalePts(withMidpoints(V, cx, cy, 1.5), cx, cy + 0.5, 0.42);
  const facets = ringFacets(cx, cy, scalePts(outerPts, cx, cy, 1.1), table, (i) => (i % 2 === 0 ? 0.1 : -0.08));
  return {
    cx,
    cy,
    size: 40,
    outline: (p) => {
      // rounded corners (quadratic through each vertex) joined by slightly convex sides
      const n = 3;
      const inX: number[] = [];
      const inY: number[] = [];
      const outX: number[] = [];
      const outY: number[] = [];
      for (let i = 0; i < n; i++) {
        const vx = V[2 * i];
        const vy = V[2 * i + 1];
        const px = V[2 * ((i + n - 1) % n)];
        const py = V[2 * ((i + n - 1) % n) + 1];
        const nx = V[2 * ((i + 1) % n)];
        const ny = V[2 * ((i + 1) % n) + 1];
        const dp = Math.sqrt((px - vx) * (px - vx) + (py - vy) * (py - vy));
        const dn = Math.sqrt((nx - vx) * (nx - vx) + (ny - vy) * (ny - vy));
        inX.push(vx + ((px - vx) / dp) * corner);
        inY.push(vy + ((py - vy) / dp) * corner);
        outX.push(vx + ((nx - vx) / dn) * corner);
        outY.push(vy + ((ny - vy) / dn) * corner);
      }
      p.moveTo(outX[0], outY[0]);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const mx = (outX[i] + inX[j]) / 2;
        const my = (outY[i] + inY[j]) / 2;
        const dx = mx - cx;
        const dy = my - cy;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        p.quadraticCurveTo(mx + (dx / d) * bulge * 2, my + (dy / d) * bulge * 2, inX[j], inY[j]);
        p.quadraticCurveTo(V[2 * j], V[2 * j + 1], outX[j], outY[j]);
      }
      p.closePath();
    },
    facets,
    table,
    tableRound: 2.8,
    spec: [30.5, 20.5, 7.6, 3.5, -0.16],
    dot: [20.6, 27.6, 1.8],
  };
}

function moonstoneShape(): GemShape {
  const V = [50, 1.5, 91.5, 46, 50, 95, 8.5, 46];
  const cx = 50;
  const cy = 47;
  const outerPts = withMidpoints(V, cx, cy, 0);
  const table = scalePts(outerPts, cx, cy, 0.4);
  const facets = ringFacets(cx, cy, scalePts(outerPts, cx, cy, 1.1), table, (i) => (i % 2 === 0 ? 0.08 : -0.05));
  return {
    cx,
    cy,
    size: 38,
    outline: (p) => roundPoly(p, V, 8),
    facets,
    table,
    tableRound: 2.2,
    spec: [37.5, 25.5, 6.6, 3.3, -0.84],
    dot: [29.4, 35.4, 1.7],
  };
}

const SHAPES: (BuiltShape | undefined)[] = [];
const BUILDERS: readonly (() => GemShape)[] = [rubyShape, amberShape, emeraldShape, sapphireShape, amethystShape, moonstoneShape];

interface BuiltShape extends GemShape {
  path: Path2D;
  /** a huge rectangle plus the outline: clipped with the even-odd rule it means "outside the gem" */
  inverse: Path2D;
  tablePath: Path2D;
}

function shapeOf(color: Color): BuiltShape {
  let s = SHAPES[color];
  if (!s) {
    const raw = BUILDERS[color]();
    const path = new Path2D();
    raw.outline(path);
    const inverse = new Path2D();
    inverse.rect(-300, -300, 700, 700);
    raw.outline(inverse);
    const tablePath = new Path2D();
    roundPoly(tablePath, raw.table, raw.tableRound);
    s = { cx: raw.cx, cy: raw.cy, size: raw.size, outline: raw.outline, facets: raw.facets, table: raw.table, tableRound: raw.tableRound, spec: raw.spec, dot: raw.dot, path, inverse, tablePath };
    SHAPES[color] = s;
  }
  return s;
}

/** Silhouette of a gem as a path in the 100-unit box. */
export function gemOutline(color: Color): Path2D {
  return shapeOf(color).path;
}

// ───────────────────────────── painting ─────────────────────────────

/** Thickness of the dark rim, in units of the 100-box. */
const RIM = 3.1;
/** How far the stone's side wall shows below its face, and how much the whole piece is raised to make room. */
const DEPTH = 3;
const LIFT = 1.6;

function scaleAbout(ctx: Ctx, cx: number, cy: number, k: number): void {
  ctx.translate(cx, cy);
  ctx.scale(k, k);
  ctx.translate(-cx, -cy);
}

/**
 * Restrict drawing to a crescent that hugs one side of the silhouette: inside the outline shrunk
 * by `k`, but outside that same shrunk outline pushed by (dx, dy). The caller wraps this in save/restore.
 */
function clipCrescent(ctx: Ctx, sh: BuiltShape, k: number, dx: number, dy: number): void {
  scaleAbout(ctx, sh.cx, sh.cy, k);
  ctx.clip(sh.path);
  ctx.translate(dx / k, dy / k);
  ctx.clip(sh.inverse, 'evenodd');
  ctx.translate(-dx / k, -dy / k);
  scaleAbout(ctx, sh.cx, sh.cy, 1 / k);
}

/** A plain gem filling the 100-unit box (with room for its shadow). */
export function drawGem(ctx: Ctx, color: Color, px: number, shadow: boolean = true): void {
  const tone = GEM_TONES[color];
  const sh = shapeOf(color);
  const outline = sh.path;

  ctx.save();
  ctx.translate(0, -LIFT);

  // cast shadow under the whole piece, then the "thickness": the silhouette extruded a little
  // downwards so the gem sits on the board like a chunky cut stone rather than a flat sticker
  ctx.save();
  if (shadow) {
    ctx.shadowColor = 'rgba(6,3,28,0.6)';
    ctx.shadowBlur = px * 0.05;
    ctx.shadowOffsetY = px * 0.03;
  }
  ctx.fillStyle = tone.deep;
  ctx.translate(0, DEPTH);
  ctx.fill(outline);
  ctx.restore();
  ctx.save();
  ctx.translate(0, DEPTH);
  ctx.clip(outline);
  ctx.fillStyle = lGrad(ctx, 10, 0, 90, 0, [
    [0, mix(tone.dark, tone.deep, 0.25)],
    [0.5, mix(tone.dark, tone.deep, 0.5)],
    [1, mix(tone.dark, tone.deep, 0.8)],
  ]);
  ctx.fillRect(0, 0, 100, 100);
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = tone.deep;
  ctx.stroke(outline);
  ctx.restore();
  ctx.fillStyle = tone.deep;
  ctx.fill(outline);

  ctx.save();
  ctx.clip(outline);

  // body: saturated all the way through — light where the lamp hits, deep in the far corner
  const body = ctx.createRadialGradient(sh.cx - 15, sh.cy - 22, 2, sh.cx - 4, sh.cy - 6, 62);
  body.addColorStop(0, tone.light);
  body.addColorStop(0.3, tone.base);
  body.addColorStop(0.62, tone.base);
  body.addColorStop(1, tone.dark);
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, 100, 100);

  // facets: flat colour planes that stay inside the gem's own hue (never grey, never white)
  for (let i = 0; i < sh.facets.length; i++) {
    const f = sh.facets[i];
    const s = f.s;
    if (s >= 0) {
      ctx.globalAlpha = Math.min(0.85, 0.2 + s * 0.9);
      ctx.fillStyle = tone.light;
    } else {
      ctx.globalAlpha = Math.min(0.8, 0.12 - s * 0.95);
      ctx.fillStyle = tone.dark;
    }
    ctx.beginPath();
    poly(ctx, f.pts);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // facet seams: thin, quiet
  ctx.lineJoin = 'round';
  ctx.lineWidth = 0.75;
  ctx.strokeStyle = rgba(tone.pale, 0.26);
  ctx.beginPath();
  for (let i = 0; i < sh.facets.length; i++) poly(ctx, sh.facets[i].pts);
  ctx.stroke();

  // light pooling low in the stone, opposite the lamp: this is what makes it read as glass
  const pool = ctx.createRadialGradient(sh.cx + 14, sh.cy + 22, 0, sh.cx + 14, sh.cy + 22, 26);
  pool.addColorStop(0, rgba(tone.light, 0.5));
  pool.addColorStop(1, rgba(tone.light, 0));
  ctx.fillStyle = pool;
  ctx.fillRect(0, 0, 100, 100);

  // table: the flat top face — the calmest plane, one clean step brighter than the crown
  ctx.fillStyle = lGrad(ctx, sh.cx - 18, sh.cy - 20, sh.cx + 16, sh.cy + 18, [
    [0, mix(tone.light, tone.pale, 0.35)],
    [0.45, mix(tone.base, tone.light, 0.55)],
    [1, tone.base],
  ]);
  ctx.fill(sh.tablePath);
  // two narrow glints sliding across the table
  ctx.save();
  ctx.clip(sh.tablePath);
  ctx.translate(sh.cx, sh.cy);
  ctx.rotate(-0.72);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(-40, -2.2, 80, 5);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(-40, 5.6, 80, 2.2);
  ctx.restore();
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = rgba(tone.pale, 0.72);
  ctx.stroke(sh.tablePath);

  // bevel: a bright line just inside the rim on the lit side, a soft one on the far side
  ctx.lineWidth = (RIM + 1.3) * 2;
  ctx.strokeStyle = lGrad(ctx, 16, 6, 84, 92, [
    [0, 'rgba(255,255,255,0.88)'],
    [0.36, rgba(tone.pale, 0.4)],
    [0.6, rgba(tone.light, 0)],
    [1, rgba(tone.light, 0.55)],
  ]);
  ctx.stroke(outline);
  // rim: the gem's own darkest tone, a chunky line that holds the shape on any background
  ctx.lineWidth = RIM * 2;
  ctx.strokeStyle = lGrad(ctx, 0, 6, 0, 94, [
    [0, mix(tone.deep, tone.dark, 0.3)],
    [1, tone.deep],
  ]);
  ctx.stroke(outline);
  ctx.restore();

  // glassy crescent of gloss along the lit side: crisp, fairly narrow, fading as it turns away
  ctx.save();
  clipCrescent(ctx, sh, 1 - (RIM + 3) / sh.size, 5.6, 7.2);
  ctx.fillStyle = lGrad(ctx, 20, 10, 62, 66, [
    [0, 'rgba(255,255,255,0.86)'],
    [0.55, 'rgba(255,255,255,0.5)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  ctx.fillRect(0, 0, 100, 100);
  ctx.restore();
  // reflected light along the far side
  ctx.save();
  clipCrescent(ctx, sh, 1 - (RIM + 2) / sh.size, -3.6, -4.4);
  ctx.fillStyle = lGrad(ctx, 34, 28, 84, 92, [
    [0, rgba(tone.pale, 0)],
    [0.5, rgba(tone.pale, 0.2)],
    [1, rgba(tone.pale, 0.62)],
  ]);
  ctx.fillRect(0, 0, 100, 100);
  ctx.restore();

  // specular spot and its little companion
  ctx.save();
  ctx.translate(sh.spec[0], sh.spec[1]);
  ctx.rotate(sh.spec[4]);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(0, 0, sh.spec[2], sh.spec[3], 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.arc(sh.dot[0], sh.dot[1], sh.dot[2], 0, TAU);
  ctx.fill();
  ctx.restore();
}

function centred(ctx: Ctx, k: number, cy: number): void {
  ctx.translate(50, cy);
  ctx.scale(k, k);
  ctx.translate(-50, -50);
}

/** Double-headed arrow of light along the x axis through (50, 50). */
function drawStreak(ctx: Ctx, px: number): void {
  const sh = 3.9; // shaft half thickness
  const hh = 10.5; // head half height
  const x0 = 4.4; // tip (leaves room for the halo inside the sprite)
  const x1 = 16; // back of the head
  const p = new Path2D();
  p.moveTo(x0, 50);
  p.lineTo(x1, 50 - hh);
  p.lineTo(x1 - 2.2, 50 - sh);
  p.lineTo(100 - x1 + 2.2, 50 - sh);
  p.lineTo(100 - x1, 50 - hh);
  p.lineTo(100 - x0, 50);
  p.lineTo(100 - x1, 50 + hh);
  p.lineTo(100 - x1 + 2.2, 50 + sh);
  p.lineTo(x1 - 2.2, 50 + sh);
  p.lineTo(x1, 50 + hh);
  p.closePath();

  ctx.save();
  // wide soft glow of the streak
  const g = ctx.createLinearGradient(0, 50 - 15, 0, 50 + 15);
  g.addColorStop(0, 'rgba(255,214,96,0)');
  g.addColorStop(0.5, 'rgba(255,226,130,0.6)');
  g.addColorStop(1, 'rgba(255,214,96,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(7, 50);
  ctx.quadraticCurveTo(50, 50 - 30, 93, 50);
  ctx.quadraticCurveTo(50, 50 + 30, 7, 50);
  ctx.fill();

  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(255,205,80,0.95)';
  ctx.shadowBlur = px * 0.04;
  ctx.strokeStyle = '#6a3f06';
  ctx.lineWidth = 2.6;
  ctx.stroke(p);
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = lGrad(ctx, 0, 50 - hh, 0, 50 + hh, [
    [0, '#ffc02e'],
    [0.32, '#ffe58f'],
    [0.5, '#ffffff'],
    [0.68, '#ffe58f'],
    [1, '#ffc02e'],
  ]);
  ctx.fill(p);
  // hot core
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(10.5, 50);
  ctx.lineTo(89.5, 50);
  ctx.stroke();
  ctx.restore();
}

/** Beam: the gem crossed by a white-gold streak of light with arrow heads (H = row, V = column). */
export function drawBeam(ctx: Ctx, color: Color, px: number, vertical: boolean): void {
  ctx.save();
  centred(ctx, 0.92, 50.5);
  drawGem(ctx, color, px * 0.92);
  ctx.restore();
  ctx.save();
  if (vertical) {
    ctx.translate(50, 50);
    ctx.rotate(Math.PI / 2);
    ctx.translate(-50, -50);
  }
  drawStreak(ctx, px);
  ctx.restore();
}

/** Nova: the gem inside a golden ring with four spark points. */
export function drawNova(ctx: Ctx, color: Color, px: number): void {
  const tone = GEM_TONES[color];
  const R = 40.5;
  // aura
  const aura = ctx.createRadialGradient(50, 50, 8, 50, 50, 47);
  aura.addColorStop(0, rgba(tone.light, 0.05));
  aura.addColorStop(0.7, rgba(tone.light, 0.42));
  aura.addColorStop(0.86, rgba(PAL.goldLight, 0.3));
  aura.addColorStop(1, rgba(PAL.gold, 0));
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, 100, 100);

  // ring
  ctx.save();
  const ring = new Path2D();
  circle(ring, 50, 50, R);
  ctx.shadowColor = 'rgba(255,205,80,0.9)';
  ctx.shadowBlur = px * 0.055;
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#5a3606';
  ctx.stroke(ring);
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 4.6;
  ctx.strokeStyle = lGrad(ctx, 20, 8, 80, 92, [
    [0, '#fff6cf'],
    [0.4, PAL.gold],
    [0.75, '#e2a02c'],
    [1, PAL.goldLight],
  ]);
  ctx.stroke(ring);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(50, 50, R + 1.1, Math.PI * 1.02, Math.PI * 1.48);
  ctx.stroke();
  ctx.restore();

  // gem
  ctx.save();
  centred(ctx, 0.78, 51);
  drawGem(ctx, color, px * 0.78);
  ctx.restore();

  // four spark points on the ring
  ctx.save();
  ctx.lineJoin = 'round';
  const d = R * Math.SQRT1_2;
  for (let i = 0; i < 4; i++) {
    const sx = 50 + (i === 0 || i === 3 ? -d : d);
    const sy = 50 + (i < 2 ? -d : d);
    const sp = new Path2D();
    sparkle(sp, sx, sy, 9.8, 0.2);
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#5a3606';
    ctx.stroke(sp);
    ctx.fillStyle = '#fffbe8';
    ctx.fill(sp);
    ctx.fillStyle = PAL.gold;
    const core = new Path2D();
    sparkle(core, sx, sy, 4.4, 0.3);
    ctx.fill(core);
  }
  ctx.restore();
}

// rainbow made of the game's own six gem hues (no conic gradients in Chrome 80: thin wedges instead)
const PRISM_WHEEL: readonly string[] = ['#ff3d55', '#ff9a1f', '#ffe040', '#22cf74', '#3fe0f0', '#2f7dff', '#a64dff', '#ff4fb0'];

/** Prism: eight-pointed khatam star with a rainbow sheen and a white core. */
export function drawPrism(ctx: Ctx, px: number): void {
  const cx = 50;
  const cy = 49;
  const R = 44;
  const pts = khatamPts(cx, cy, R, -Math.PI / 2);
  const star = new Path2D();
  roundPoly(star, pts, 1.6);

  ctx.save();
  ctx.shadowColor = 'rgba(4,2,22,0.7)';
  ctx.shadowBlur = px * 0.055;
  ctx.shadowOffsetY = px * 0.04;
  ctx.fillStyle = '#4a2c08';
  ctx.fill(star);
  ctx.restore();

  ctx.save();
  ctx.clip(star);
  // rainbow wedges
  const N = 72;
  const m = PRISM_WHEEL.length;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * m;
    const k = Math.floor(t);
    ctx.fillStyle = mix(PRISM_WHEEL[k % m], PRISM_WHEEL[(k + 1) % m], t - k);
    const a0 = -Math.PI / 2 + (i / N) * TAU - 0.002;
    const a1 = -Math.PI / 2 + ((i + 1) / N) * TAU + 0.012;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a0) * 60, cy + Math.sin(a0) * 60);
    ctx.lineTo(cx + Math.cos(a1) * 60, cy + Math.sin(a1) * 60);
    ctx.closePath();
    ctx.fill();
  }
  // folded-star facets: one half of every point in shade, the other in light
  for (let i = 0; i < 8; i++) {
    const tip = 2 * i;
    const prev = (tip + 15) % 16;
    const next = (tip + 1) % 16;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(pts[2 * prev], pts[2 * prev + 1]);
    ctx.lineTo(pts[2 * tip], pts[2 * tip + 1]);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(30,10,70,0.24)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(pts[2 * tip], pts[2 * tip + 1]);
    ctx.lineTo(pts[2 * next], pts[2 * next + 1]);
    ctx.closePath();
    ctx.fill();
  }
  // seams
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    ctx.moveTo(cx, cy);
    ctx.lineTo(pts[2 * i], pts[2 * i + 1]);
  }
  ctx.stroke();
  // white core
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.56);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(0.3, 'rgba(255,255,255,0.92)');
  core.addColorStop(0.62, 'rgba(255,255,255,0.34)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, 100, 100);
  // inner octagon: the table of the star
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  poly(ctx, ngon(cx, cy, R * 0.4, 8, Math.PI / 8));
  ctx.stroke();
  // sheen
  ctx.fillStyle = lGrad(ctx, 0, 4, 0, 52, [
    [0, 'rgba(255,255,255,0.26)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  ctx.beginPath();
  ctx.ellipse(40, 20, 40, 28, -0.3, 0, TAU);
  ctx.fill();
  // gold rim
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6.4;
  ctx.strokeStyle = '#4a2c08';
  ctx.stroke(star);
  ctx.lineWidth = 4.2;
  ctx.strokeStyle = lGrad(ctx, 20, 6, 80, 94, [
    [0, '#fff8d8'],
    [0.45, PAL.gold],
    [1, '#d9962a'],
  ]);
  ctx.stroke(star);
  ctx.restore();

  // glint
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  sparkle(ctx, 37, 34, 7.5, 0.22);
  ctx.fill();
}
