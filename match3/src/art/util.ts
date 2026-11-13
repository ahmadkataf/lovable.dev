/**
 * Small drawing helpers shared by all art files. Nothing here touches the DOM at import time,
 * so the art module can be imported under Node (unit tests of other modules).
 */

export const TAU = Math.PI * 2;

/** UI palette tokens (docs/DESIGN.md §3). */
export const PAL = {
  night: '#14123a',
  indigo: '#231f5c',
  violet: '#3a2a7a',
  gold: '#f5c95a',
  goldLight: '#ffe7a3',
  brass: '#b8862e',
  brassDark: '#6e4a14',
  cream: '#fff6dc',
  muted: '#c9c2e6',
  success: '#3ecf8e',
  danger: '#ff5d6c',
  info: '#5ab8ff',
} as const;

export type Ctx = CanvasRenderingContext2D;

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.charAt(0) === '#' ? hex.slice(1) : hex;
  if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `#rrggbb` + alpha → `rgba(...)`. */
export function rgba(hex: string, a: number): string {
  const c = hexToRgb(hex);
  return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + Math.round(clamp01(a) * 1000) / 1000 + ')';
}

function hex2(n: number): string {
  const s = Math.round(n < 0 ? 0 : n > 255 ? 255 : n).toString(16);
  return s.length < 2 ? '0' + s : s;
}

/** Linear mix of two `#rrggbb` colours; t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return '#' + hex2(lerp(ca[0], cb[0], t)) + hex2(lerp(ca[1], cb[1], t)) + hex2(lerp(ca[2], cb[2], t));
}

export function lighten(hex: string, t: number): string {
  return mix(hex, '#ffffff', t);
}

export function darken(hex: string, t: number): string {
  return mix(hex, '#000000', t);
}

/** Deterministic PRNG (mulberry32). Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a string hash → uint32 (seeds for per-sprite textures). */
export function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function ctx2d(c: HTMLCanvasElement): Ctx {
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available');
  return ctx;
}

/** devicePixelRatio, clamped to 1..3 (1 outside a browser). */
export function dpr(): number {
  const r = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
  return r < 1 ? 1 : r > 3 ? 3 : r;
}

type PathLike = Path2D | Ctx;

/** Closed polygon through flat [x0, y0, x1, y1, …] points. */
export function poly(p: PathLike, pts: readonly number[]): void {
  p.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]);
  p.closePath();
}

/** Closed polygon with every corner rounded by radius r (ctx.roundRect does not exist in Chrome 80). */
export function roundPoly(p: PathLike, pts: readonly number[], r: number): void {
  const n = pts.length >> 1;
  const lx = pts[2 * (n - 1)];
  const ly = pts[2 * (n - 1) + 1];
  p.moveTo((lx + pts[0]) / 2, (ly + pts[1]) / 2);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const x1 = pts[2 * i];
    const y1 = pts[2 * i + 1];
    p.arcTo(x1, y1, (x1 + pts[2 * j]) / 2, (y1 + pts[2 * j + 1]) / 2, r);
  }
  p.closePath();
}

/** Rounded rectangle. */
export function rrect(p: PathLike, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  p.moveTo(x + rr, y);
  p.lineTo(x + w - rr, y);
  p.arcTo(x + w, y, x + w, y + rr, rr);
  p.lineTo(x + w, y + h - rr);
  p.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  p.lineTo(x + rr, y + h);
  p.arcTo(x, y + h, x, y + h - rr, rr);
  p.lineTo(x, y + rr);
  p.arcTo(x, y, x + rr, y, rr);
  p.closePath();
}

/** Regular polygon points (flat array), first vertex at angle `rot` (radians, 0 = +x). */
export function ngon(cx: number, cy: number, r: number, n: number, rot: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i * TAU) / n;
    out.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return out;
}

/** Star polygon points: n tips at radius ro, n valleys at radius ri; first tip at angle `rot`. */
export function starPts(cx: number, cy: number, ro: number, ri: number, n: number, rot: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n;
    const r = i % 2 === 0 ? ro : ri;
    out.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return out;
}

/** Valley radius of a khatam (two overlapped squares) relative to its tip radius. */
export const KHATAM_INNER = Math.SQRT1_2 / Math.cos(Math.PI / 8);

/**
 * Khatam — the eight-pointed star made of two overlapped squares, the game's signature motif.
 * `rot` = angle of the first tip (use -PI/2 for a tip pointing up, PI/8 for flat-topped).
 */
export function khatamPts(cx: number, cy: number, r: number, rot: number): number[] {
  return starPts(cx, cy, r, r * KHATAM_INNER, 8, rot);
}

export function khatam(p: PathLike, cx: number, cy: number, r: number, rot: number): void {
  poly(p, khatamPts(cx, cy, r, rot));
}

/** Four-pointed sparkle with concave sides. */
export function sparkle(p: PathLike, cx: number, cy: number, r: number, waist: number): void {
  const w = r * waist;
  p.moveTo(cx, cy - r);
  p.quadraticCurveTo(cx + w, cy - w, cx + r, cy);
  p.quadraticCurveTo(cx + w, cy + w, cx, cy + r);
  p.quadraticCurveTo(cx - w, cy + w, cx - r, cy);
  p.quadraticCurveTo(cx - w, cy - w, cx, cy - r);
  p.closePath();
}

export function circle(p: PathLike, cx: number, cy: number, r: number): void {
  p.moveTo(cx + r, cy);
  p.arc(cx, cy, r, 0, TAU);
  p.closePath();
}

/** Soft radial glow (cheap: one gradient fill, no blur filter). */
export function glow(ctx: Ctx, x: number, y: number, r: number, color: string, alpha: number): void {
  if (r <= 0 || alpha <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.45, rgba(color, alpha * 0.38));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Vertical linear gradient from colour stops [[offset, colour], …]. */
export function vGrad(ctx: Ctx, y0: number, y1: number, stops: readonly (readonly [number, string])[]): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
  return g;
}

export function lGrad(
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: readonly (readonly [number, string])[],
): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
  return g;
}
