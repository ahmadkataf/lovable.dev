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
import { PAL, TAU, circle, hexToRgb, khatamPts, lGrad, mix, ngon, poly, rgba, roundPoly, sparkle } from './util.ts';

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
  { deep: '#6a0823', dark: '#c0163a', base: '#ff4d5e', light: '#ff7b82', pale: '#ffdcd8' },
  { deep: '#7c3a00', dark: '#dd7400', base: '#ffa630', light: '#ffc955', pale: '#fff2c4' },
  { deep: '#065536', dark: '#0f9c58', base: '#2fd17c', light: '#69ec9f', pale: '#d9ffe4' },
  { deep: '#0e2788', dark: '#1d5ae0', base: '#3d8bff', light: '#74b1ff', pale: '#dcedff' },
  { deep: '#440f8c', dark: '#812de0', base: '#b05cff', light: '#cb90ff', pale: '#f2e0ff' },
  { deep: '#17688c', dark: '#3fb4d6', base: '#8ff0ff', light: '#c2f8ff', pale: '#ffffff' },
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
  outline(p: Path2D): void;
  facets: Facet[];
  table: number[];
  tableRound: number;
  /** specular spot: x, y, rx, ry, rotation */
  spec: [number, number, number, number, number];
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

function rubyShape(): GemShape {
  const cx = 50;
  const cy = 49.5;
  const R = 38.5;
  const rt = 15.5;
  const ra = 26;
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
    facets.push(facet(cx, cy, [t0[0], t0[1], t1[0], t1[1], a1[0], a1[1]], 0.26));
    // kite (bezel) facet around t0
    facets.push(facet(cx, cy, [t0[0], t0[1], a0[0], a0[1], g0[0], g0[1], a1[0], a1[1]], k % 2 === 0 ? 0.12 : -0.14));
    // girdle facet between two kites
    facets.push(facet(cx, cy, [a0[0], a0[1], gPrev[0], gPrev[1], m0[0], m0[1], g0[0], g0[1]], k % 2 === 0 ? -0.2 : -0.02));
  }
  return {
    cx,
    cy,
    outline: (p) => circle(p, cx, cy, R),
    facets,
    table: ngon(cx, cy, rt, 8, Math.PI / 8),
    tableRound: 0.5,
    spec: [36, 31, 8, 4.6, -0.7],
  };
}

function amberShape(): GemShape {
  const cx = 50;
  const cy = 50;
  const stretch = (pts: number[]): number[] => {
    for (let i = 1; i < pts.length; i += 2) pts[i] = cy + (pts[i] - cy) * 1.05;
    return pts;
  };
  const outer = stretch(ngon(cx, cy, 42.5, 6, 0));
  const big = stretch(ngon(cx, cy, 46, 6, 0));
  const mid = stretch(ngon(cx, cy, 31.5, 6, 0));
  const table = stretch(ngon(cx, cy, 20.5, 6, 0));
  const facets = ringFacets(cx, cy, big, mid, (i) => (i % 2 === 0 ? 0.06 : -0.08)).concat(
    ringFacets(cx, cy, mid, table, (i) => (i % 2 === 0 ? -0.05 : 0.2)),
  );
  return {
    cx,
    cy,
    outline: (p) => roundPoly(p, outer, 5),
    facets,
    table,
    tableRound: 1.5,
    spec: [36, 30, 9, 4.4, -0.5],
  };
}

function emeraldShape(): GemShape {
  const cx = 50;
  const cy = 50;
  const sq = (h: number): number[] => [cx - h, cy - h, cx + h, cy - h, cx + h, cy + h, cx - h, cy + h];
  const outer = sq(33.5);
  const big = sq(37);
  const mid = sq(25);
  const table = sq(16);
  const facets = ringFacets(cx, cy, big, mid, () => 0).concat(ringFacets(cx, cy, mid, table, () => 0.16));
  return {
    cx,
    cy,
    outline: (p) => roundPoly(p, outer, 13),
    facets,
    table,
    tableRound: 3.5,
    spec: [33, 28.5, 8.5, 4, -0.55],
  };
}

function sapphireShape(): GemShape {
  const cx = 50;
  const cy = 59;
  // points around the drop, clockwise from the apex
  const ring = [50, 6, 61, 24, 75, 42, 81.5, 61, 73, 82, 50, 91.5, 27, 82, 18.5, 61, 25, 42, 39, 24];
  const big = scalePts(ring, cx, cy, 1.1);
  const table = scalePts(ring, cx, cy + 1, 0.46);
  const facets = ringFacets(cx, cy, big, table, (i) => (i % 2 === 0 ? 0.1 : -0.1));
  return {
    cx,
    cy,
    outline: (p) => {
      p.moveTo(47.2, 9.6);
      p.quadraticCurveTo(50, 4.6, 52.8, 9.6);
      p.bezierCurveTo(58, 23, 81.5, 39, 81.5, 60);
      p.arc(50, 60, 31.5, 0, Math.PI);
      p.bezierCurveTo(18.5, 39, 42, 23, 47.2, 9.6);
      p.closePath();
    },
    facets,
    table,
    tableRound: 3,
    spec: [35, 47, 7.5, 4.2, -0.95],
  };
}

function amethystShape(): GemShape {
  // trillion, apex down: the mass sits high, the opposite of the sapphire's drop
  const V = [7.5, 15.5, 92.5, 15.5, 50, 93];
  const cx = 50;
  const cy = 42;
  const bulge = 4.2;
  const corner = 13;
  const outerPts = withMidpoints(V, cx, cy, bulge + 3);
  const table = scalePts(withMidpoints(V, cx, cy, 1.5), cx, cy + 0.5, 0.43);
  const facets = ringFacets(cx, cy, scalePts(outerPts, cx, cy, 1.08), table, (i) => (i % 2 === 0 ? 0.12 : -0.1));
  return {
    cx,
    cy,
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
    tableRound: 2.5,
    spec: [33, 26, 9, 4, -0.2],
  };
}

function moonstoneShape(): GemShape {
  const V = [50, 4.5, 86.5, 45, 50, 95.5, 13.5, 45];
  const cx = 50;
  const cy = 47;
  const outerPts = withMidpoints(V, cx, cy, 0);
  const table = scalePts(outerPts, cx, cy, 0.4);
  const facets = ringFacets(cx, cy, scalePts(outerPts, cx, cy, 1.1), table, (i) => (i % 2 === 0 ? 0.1 : -0.06));
  return {
    cx,
    cy,
    outline: (p) => roundPoly(p, V, 6),
    facets,
    table,
    tableRound: 2,
    spec: [39, 30, 7.5, 3.6, -0.85],
  };
}

const SHAPES: (GemShape | undefined)[] = [];
const BUILDERS: readonly (() => GemShape)[] = [rubyShape, amberShape, emeraldShape, sapphireShape, amethystShape, moonstoneShape];

function shapeOf(color: Color): GemShape {
  let s = SHAPES[color];
  if (!s) {
    s = BUILDERS[color]();
    SHAPES[color] = s;
  }
  return s;
}

/** Silhouette of a gem as a path in the 100-unit box (also used by icons and the emblem). */
export function gemOutline(color: Color): Path2D {
  const p = new Path2D();
  shapeOf(color).outline(p);
  return p;
}

// ───────────────────────────── painting ─────────────────────────────

/** A plain gem filling the 100-unit box (with room for its shadow). */
export function drawGem(ctx: Ctx, color: Color, px: number, shadow: boolean = true): void {
  const tone = GEM_TONES[color];
  const sh = shapeOf(color);
  const outline = new Path2D();
  sh.outline(outline);

  // soft drop shadow + rim colour
  ctx.save();
  if (shadow) {
    ctx.shadowColor = 'rgba(4,2,22,0.72)';
    ctx.shadowBlur = px * 0.075;
    ctx.shadowOffsetY = px * 0.05;
  }
  ctx.fillStyle = tone.deep;
  ctx.fill(outline);
  ctx.restore();

  ctx.save();
  ctx.clip(outline);

  // body: saturated all the way through, light top-left, deep bottom-right
  ctx.fillStyle = lGrad(ctx, 20, 10, 82, 94, [
    [0, tone.light],
    [0.3, tone.base],
    [0.68, tone.base],
    [1, tone.dark],
  ]);
  ctx.fillRect(0, 0, 100, 100);

  // facets: lit ones take the light tone (stays colourful), shaded ones the deep tone
  const lit = hexToRgb(tone.light);
  const pale = hexToRgb(tone.pale);
  const deep = hexToRgb(tone.deep);
  for (let i = 0; i < sh.facets.length; i++) {
    const f = sh.facets[i];
    const s = f.s;
    if (s >= 0.55) ctx.fillStyle = 'rgba(' + pale[0] + ',' + pale[1] + ',' + pale[2] + ',' + ((s - 0.3) * 0.62).toFixed(3) + ')';
    else if (s >= 0) ctx.fillStyle = 'rgba(' + lit[0] + ',' + lit[1] + ',' + lit[2] + ',' + (s * 0.8).toFixed(3) + ')';
    else ctx.fillStyle = 'rgba(' + deep[0] + ',' + deep[1] + ',' + deep[2] + ',' + (-s * 0.5).toFixed(3) + ')';
    ctx.beginPath();
    poly(ctx, f.pts);
    ctx.fill();
  }
  // facet seams: thin, quiet
  ctx.lineJoin = 'round';
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = rgba(tone.pale, 0.24);
  ctx.beginPath();
  for (let i = 0; i < sh.facets.length; i++) poly(ctx, sh.facets[i].pts);
  ctx.stroke();

  // table: the flat top face — the calmest plane, lit from its top-left corner
  const table = new Path2D();
  roundPoly(table, sh.table, sh.tableRound);
  ctx.fillStyle = lGrad(ctx, sh.cx - 17, sh.cy - 19, sh.cx + 15, sh.cy + 17, [
    [0, tone.pale],
    [0.28, tone.light],
    [1, tone.base],
  ]);
  ctx.fill(table);
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = rgba(tone.pale, 0.7);
  ctx.stroke(table);

  // light gathering in the lower-right of the stone
  const bounce = ctx.createRadialGradient(sh.cx + 16, sh.cy + 20, 0, sh.cx + 16, sh.cy + 20, 26);
  bounce.addColorStop(0, rgba(tone.light, 0.55));
  bounce.addColorStop(1, rgba(tone.light, 0));
  ctx.fillStyle = bounce;
  ctx.fillRect(0, 0, 100, 100);

  // glossy sheen over the upper-left
  ctx.fillStyle = lGrad(ctx, 0, sh.cy - 44, 0, sh.cy - 4, [
    [0, 'rgba(255,255,255,0.36)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  ctx.beginPath();
  ctx.ellipse(sh.cx - 10, sh.cy - 33, 34, 24, -0.32, 0, TAU);
  ctx.fill();

  // rim: dark edge, then a bright bevel that fades towards the lower right
  ctx.lineWidth = 5.4;
  ctx.strokeStyle = rgba(tone.deep, 0.95);
  ctx.stroke(outline);
  ctx.lineWidth = 2;
  ctx.strokeStyle = lGrad(ctx, 18, 8, 78, 88, [
    [0, 'rgba(255,255,255,0.8)'],
    [0.42, rgba(tone.light, 0.4)],
    [0.8, rgba(tone.light, 0)],
  ]);
  ctx.stroke(outline);
  ctx.restore();

  // specular spot
  ctx.save();
  ctx.translate(sh.spec[0], sh.spec[1]);
  ctx.rotate(sh.spec[4]);
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.beginPath();
  ctx.ellipse(0, 0, sh.spec[2], sh.spec[3], 0, 0, TAU);
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
  const x0 = 1.6; // tip
  const x1 = 14; // back of the head
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
  ctx.moveTo(4, 50);
  ctx.quadraticCurveTo(50, 50 - 30, 96, 50);
  ctx.quadraticCurveTo(50, 50 + 30, 4, 50);
  ctx.fill();

  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(255,205,80,0.95)';
  ctx.shadowBlur = px * 0.08;
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
  ctx.moveTo(8, 50);
  ctx.lineTo(92, 50);
  ctx.stroke();
  ctx.restore();
}

/** Beam: the gem crossed by a white-gold streak of light with arrow heads (H = row, V = column). */
export function drawBeam(ctx: Ctx, color: Color, px: number, vertical: boolean): void {
  ctx.save();
  centred(ctx, 0.87, 50);
  drawGem(ctx, color, px * 0.87);
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
  const R = 41.5;
  // aura
  const aura = ctx.createRadialGradient(50, 50, 8, 50, 50, 48);
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
  ctx.shadowBlur = px * 0.08;
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
  centred(ctx, 0.72, 50);
  drawGem(ctx, color, px * 0.72);
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
const PRISM_WHEEL: readonly string[] = ['#ff4d5e', '#ffa630', '#ffe45c', '#2fd17c', '#5fe9f2', '#3d8bff', '#b05cff', '#ff5fb4'];

/** Prism: eight-pointed khatam star with a rainbow sheen and a white core. */
export function drawPrism(ctx: Ctx, px: number): void {
  const cx = 50;
  const cy = 50;
  const R = 45;
  const pts = khatamPts(cx, cy, R, -Math.PI / 2);
  const star = new Path2D();
  roundPoly(star, pts, 1.6);

  ctx.save();
  ctx.shadowColor = 'rgba(5,3,26,0.62)';
  ctx.shadowBlur = px * 0.07;
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
  sparkle(ctx, 37, 35, 7.5, 0.22);
  ctx.fill();
}
