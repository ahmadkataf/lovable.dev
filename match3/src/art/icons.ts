/**
 * UI icons: crisp vector shapes in the UI palette (gold / cream, a few semantic accents), drawn on a
 * 24×24 unit grid. Every shape gets a thin ink (night-indigo) outline so the icons stay readable on
 * indigo panels AND on gold buttons. No text glyphs, no emoji.
 */
import type { IconKey } from './types.ts';
import type { Ctx } from './util.ts';
import { PAL, TAU, khatamPts, poly, roundPoly, rrect, starPts, vGrad } from './util.ts';
import { drawPrism } from './gems.ts';

const INK = PAL.night;
/** ink outline thickness, in grid units */
const OUT = 1.1;

interface Op {
  p: Path2D | null;
  /** 0 = fill, otherwise stroke width */
  w: number;
  paint: string;
  outlined: boolean;
  custom: ((ctx: Ctx) => void) | null;
}

interface Pen {
  /** real size of the icon in device pixels */
  px: number;
  fill(p: Path2D, paint: string, outlined?: boolean): void;
  stroke(p: Path2D, w: number, paint: string, outlined?: boolean): void;
  /** Everything drawn after this call sits on top of (and is outlined against) what came before. */
  layer(): void;
  custom(fn: (ctx: Ctx) => void): void;
}

function paintOf(ctx: Ctx, name: string): string | CanvasGradient {
  switch (name) {
    case 'gold':
      return vGrad(ctx, 2.5, 21.5, [
        [0, '#fff3c4'],
        [0.45, '#f9d470'],
        [1, '#e0a438'],
      ]);
    case 'cream':
      return vGrad(ctx, 2.5, 21.5, [
        [0, '#ffffff'],
        [1, '#ffeec4'],
      ]);
    case 'brass':
      return vGrad(ctx, 2.5, 21.5, [
        [0, '#dba640'],
        [1, '#a06c1c'],
      ]);
    case 'red':
      return vGrad(ctx, 2.5, 21.5, [
        [0, '#ff9ca6'],
        [0.5, '#ff5d6c'],
        [1, '#d63257'],
      ]);
    case 'green':
      return vGrad(ctx, 2.5, 21.5, [
        [0, '#b4f07e'],
        [0.5, '#5cc44c'],
        [1, '#2f8f3a'],
      ]);
    case 'iron':
      return vGrad(ctx, 2.5, 21.5, [
        [0, '#e6eaf8'],
        [0.5, '#98a1c0'],
        [1, '#5a6186'],
      ]);
    case 'sand':
      return vGrad(ctx, 6, 21, [
        [0, '#fbe8b4'],
        [1, '#d9a658'],
      ]);
    case 'stone':
      return vGrad(ctx, 3, 21, [
        [0, '#f2d4a0'],
        [1, '#bd8c56'],
      ]);
    default:
      return name;
  }
}

function flush(ctx: Ctx, ops: Op[]): void {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (let i = 0; i < ops.length; i++) {
    const o = ops[i];
    if (!o.outlined || !o.p) continue;
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    if (o.w === 0) {
      ctx.lineWidth = OUT * 2;
      ctx.fill(o.p);
      ctx.stroke(o.p);
    } else {
      ctx.lineWidth = o.w + OUT * 2;
      ctx.stroke(o.p);
    }
  }
  for (let i = 0; i < ops.length; i++) {
    const o = ops[i];
    if (o.custom) {
      o.custom(ctx);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      continue;
    }
    if (!o.p) continue;
    const paint = paintOf(ctx, o.paint);
    if (o.w === 0) {
      ctx.fillStyle = paint;
      ctx.fill(o.p);
    } else {
      ctx.strokeStyle = paint;
      ctx.lineWidth = o.w;
      ctx.stroke(o.p);
    }
  }
  ops.length = 0;
}

// ───────────────────────────── path helpers ─────────────────────────────

function D(d: string): Path2D {
  return new Path2D(d);
}

function C(cx: number, cy: number, r: number): Path2D {
  const p = new Path2D();
  p.arc(cx, cy, r, 0, TAU);
  p.closePath();
  return p;
}

function RR(x: number, y: number, w: number, h: number, r: number): Path2D {
  const p = new Path2D();
  rrect(p, x, y, w, h, r);
  return p;
}

function PP(pts: readonly number[], round: number = 0): Path2D {
  const p = new Path2D();
  if (round > 0) roundPoly(p, pts, round);
  else poly(p, pts);
  return p;
}

/** Rounded rectangle of size w×h centred on (cx, cy), rotated by `ang`. */
function RRot(cx: number, cy: number, w: number, h: number, r: number, ang: number): Path2D {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const hw = w / 2;
  const hh = h / 2;
  const pts = [-hw, -hh, hw, -hh, hw, hh, -hw, hh];
  const out: number[] = [];
  for (let i = 0; i < 8; i += 2) out.push(cx + pts[i] * c - pts[i + 1] * s, cy + pts[i] * s + pts[i + 1] * c);
  return PP(out, r);
}

/** Solid arrow head whose tip is at (x, y) pointing along `ang`. */
function head(x: number, y: number, ang: number, len: number, half: number): Path2D {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const bx = x - c * len;
  const by = y - s * len;
  return PP([x, y, bx - s * half, by + c * half, bx + s * half, by - c * half], 0.5);
}

function gear(cx: number, cy: number, ro: number, rr: number, teeth: number): Path2D {
  const p = new Path2D();
  const step = TAU / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step - Math.PI / 2;
    const w1 = step * 0.16;
    const w2 = step * 0.27;
    const x0 = cx + Math.cos(a - w2) * rr;
    const y0 = cy + Math.sin(a - w2) * rr;
    if (i === 0) p.moveTo(x0, y0);
    else p.lineTo(x0, y0);
    p.lineTo(cx + Math.cos(a - w1) * ro, cy + Math.sin(a - w1) * ro);
    p.lineTo(cx + Math.cos(a + w1) * ro, cy + Math.sin(a + w1) * ro);
    p.lineTo(cx + Math.cos(a + w2) * rr, cy + Math.sin(a + w2) * rr);
    p.arc(cx, cy, rr, a + w2, a + step - w2);
  }
  p.closePath();
  return p;
}

function scallop(cx: number, cy: number, r: number, amp: number, lobes: number): Path2D {
  const p = new Path2D();
  const n = lobes * 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr = r + Math.cos(a * lobes) * amp;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  p.closePath();
  return p;
}

const STAR5 = (cx: number, cy: number, ro: number, ri: number): Path2D => PP(starPts(cx, cy, ro, ri, 5, -Math.PI / 2));
const KH = (cx: number, cy: number, r: number): Path2D => PP(khatamPts(cx, cy, r, -Math.PI / 2));

const HI = 'rgba(255,255,255,0.55)';
const HI_SOFT = 'rgba(255,255,255,0.32)';
const SHADE = 'rgba(150,88,10,0.38)';

// ───────────────────────────── shared pieces ─────────────────────────────

function coin(g: Pen, cx: number, cy: number, r: number): void {
  g.fill(C(cx, cy, r), 'gold');
  g.stroke(C(cx, cy, r * 0.72), r * 0.11, '#c88d24', false);
  g.fill(KH(cx, cy, r * 0.5), '#fff8dc', false);
  const arc = new Path2D();
  arc.arc(cx, cy, r * 0.88, Math.PI * 1.08, Math.PI * 1.45);
  g.stroke(arc, r * 0.1, 'rgba(255,255,255,0.85)', false);
}

function speaker(g: Pen): void {
  const body = D('M3.3 9.3 H6.9 L11.8 5 V19 L6.9 14.7 H3.3 Z');
  g.fill(body, 'gold');
  g.stroke(body, 1.2, 'gold');
  g.stroke(D('M7.2 9.6 V14.4'), 0.9, SHADE, false);
}

function notes(g: Pen): void {
  g.fill(D('M8.6 4.9 L19.9 2.8 V6.6 L8.6 8.7 Z'), 'gold');
  g.stroke(D('M9.55 7 V17.2'), 1.9, 'gold');
  g.stroke(D('M18.95 5 V15.4'), 1.9, 'gold');
  g.fill(RRot(7.3, 17.5, 6, 4.6, 2.2, -0.35), 'gold');
  g.fill(RRot(16.7, 15.7, 6, 4.6, 2.2, -0.35), 'gold');
}

function phone(g: Pen): void {
  g.fill(RR(7.6, 3.2, 8.8, 17.6, 2.2), 'gold');
  g.fill(RR(9.3, 5.6, 5.4, 10.4, 0.8), '#3a2a7a', false);
  g.fill(C(12, 18.3, 1), INK, false);
}

function slash(g: Pen): void {
  g.layer();
  g.stroke(D('M4.2 4.2 L19.8 19.8'), 2.5, 'red');
}

function swapArrows(g: Pen, x0: number, x1: number, yTop: number, yBot: number, w: number, hl: number): void {
  g.stroke(D('M' + x0 + ' ' + yTop + ' H' + (x1 - hl * 0.7)), w, 'gold');
  g.fill(head(x1 + 0.6, yTop, 0, hl, hl * 0.86), 'gold');
  g.stroke(D('M' + x1 + ' ' + yBot + ' H' + (x0 + hl * 0.7)), w, 'gold');
  g.fill(head(x0 - 0.6, yBot, Math.PI, hl, hl * 0.86), 'gold');
}

function screen(g: Pen): void {
  g.fill(RR(2.6, 4.6, 18.8, 14.8, 3.4), 'gold');
  g.fill(RR(4.6, 6.6, 14.8, 10.8, 1.8), '#3a2a7a', false);
  g.fill(PP([9.7, 8.4, 15.6, 12, 9.7, 15.6], 0.7), 'cream', false);
}

// ───────────────────────────── the icons ─────────────────────────────

type IconFn = (g: Pen) => void;

const ICONS: Record<IconKey, IconFn> = {
  heart(g) {
    g.fill(
      D(
        'M12 20.7 C6.1 16.3 2.5 12.7 2.5 8.6 C2.5 5.6 4.8 3.3 7.6 3.3 C9.4 3.3 11 4.2 12 5.8 C13 4.2 14.6 3.3 16.4 3.3 C19.2 3.3 21.5 5.6 21.5 8.6 C21.5 12.7 17.9 16.3 12 20.7 Z',
      ),
      'red',
    );
    g.stroke(D('M5.4 8.6 C5.4 6.9 6.6 5.8 8 5.8'), 1.5, 'rgba(255,255,255,0.8)', false);
  },
  coin(g) {
    coin(g, 12, 12, 9.5);
  },
  star(g) {
    const s = STAR5(12, 12.7, 10.2, 5);
    g.fill(s, 'gold');
    g.stroke(s, 1.5, 'gold');
    g.fill(PP([12, 2.5, 12, 12.7, 2.3, 9.55, 9.06, 8.65]), HI_SOFT, false);
    g.fill(PP([12, 12.7, 21.7, 9.55, 18, 20.95, 12, 17.7]), 'rgba(170,96,10,0.22)', false);
  },
  starEmpty(g) {
    const s = STAR5(12, 12.7, 10.2, 5);
    g.fill(s, '#2c2468');
    g.stroke(s, 1.5, '#2c2468');
    g.stroke(STAR5(12, 12.7, 9.6, 4.7), 1.2, '#7d74b8', false);
  },
  moves(g) {
    swapArrows(g, 3.6, 19.4, 8.1, 15.9, 2.7, 4.6);
  },
  score(g) {
    const d = PP([6.6, 3.8, 17.4, 3.8, 22, 9.6, 12, 21, 2, 9.6], 0.8);
    g.fill(d, 'gold');
    g.fill(PP([6.6, 3.8, 9.1, 9.6, 2, 9.6]), HI, false);
    g.fill(PP([12, 3.8, 14.9, 9.6, 9.1, 9.6]), HI_SOFT, false);
    g.fill(PP([14.9, 9.6, 22, 9.6, 12, 21]), SHADE, false);
    g.stroke(D('M2.6 9.6 H21.4 M6.6 4.2 L9.1 9.6 L12 4.2 L14.9 9.6 L17.4 4.2 M9.1 9.6 L12 20.2 L14.9 9.6'), 0.95, '#8a5a12', false);
  },
  settings(g) {
    g.fill(gear(12, 12, 10.2, 7.5, 8), 'gold');
    g.stroke(gear(12, 12, 10.2, 7.5, 8), 0.8, 'gold');
    g.fill(C(12, 12, 3.3), INK, false);
    g.stroke(C(12, 12, 5.2), 0.8, SHADE, false);
  },
  pause(g) {
    g.fill(RR(5.4, 4.2, 4.8, 15.6, 1.7), 'gold');
    g.fill(RR(13.8, 4.2, 4.8, 15.6, 1.7), 'gold');
  },
  play(g) {
    g.fill(PP([7, 3.6, 20.2, 12, 7, 20.4], 2), 'gold');
  },
  close(g) {
    g.stroke(D('M6.2 6.2 L17.8 17.8 M17.8 6.2 L6.2 17.8'), 3.3, 'gold');
  },
  back(g) {
    g.stroke(D('M19.6 12 H6.4'), 3.1, 'gold');
    g.stroke(D('M11.2 5.4 L4.6 12 L11.2 18.6'), 3.1, 'gold');
  },
  lock(g) {
    g.stroke(D('M7.9 10.6 V7.7 A4.1 4.1 0 0 1 16.1 7.7 V10.6'), 2.5, 'iron');
    g.layer();
    g.fill(RR(4.5, 9.9, 15, 11.2, 2.8), 'gold');
    g.fill(RR(6, 11.2, 12, 1.6, 0.8), HI, false);
    g.fill(C(12, 14.6, 1.8), INK, false);
    g.fill(PP([11.1, 15.2, 12.9, 15.2, 13.5, 18.6, 10.5, 18.6]), INK, false);
  },
  check(g) {
    g.stroke(D('M4.8 12.8 L9.8 17.6 L19.4 6.6'), 3.5, 'gold');
  },
  plus(g) {
    g.stroke(D('M12 4.8 V19.2 M4.8 12 H19.2'), 3.5, 'gold');
  },
  info(g) {
    g.stroke(C(12, 12, 9), 2.2, 'gold');
    g.fill(C(12, 7.7, 1.55), 'gold');
    g.stroke(D('M12 11.4 V16.8'), 2.7, 'gold');
  },
  home(g) {
    const house = D('M12 3 L21.6 11.3 H18.8 V20.4 H5.2 V11.3 H2.4 Z');
    g.fill(house, 'gold');
    g.stroke(house, 1.2, 'gold');
    // pointed-arch doorway
    g.fill(D('M9.7 20.6 V15.6 Q9.7 13.2 12 12.2 Q14.3 13.2 14.3 15.6 V20.6 Z'), INK, false);
  },
  retry(g) {
    const arc = new Path2D();
    arc.arc(12, 12.5, 7.5, -0.52, Math.PI * 1.5, false);
    g.stroke(arc, 2.7, 'gold');
    g.fill(head(17.2, 5, 0.12, 5.6, 4.2), 'gold');
  },
  next(g) {
    g.stroke(D('M4.4 12 H17.6'), 3.1, 'gold');
    g.stroke(D('M12.8 5.4 L19.4 12 L12.8 18.6'), 3.1, 'gold');
  },
  shop(g) {
    // bazaar stall: striped scalloped awning over a counter with a doorway
    g.fill(RR(4.6, 9.4, 14.8, 11.2, 1.2), 'gold');
    g.fill(D('M9.8 20.8 V15.4 Q9.8 13.4 12 12.6 Q14.2 13.4 14.2 15.4 V20.8 Z'), INK, false);
    g.layer();
    const awning = D('M5 3.4 H19 L21.6 8.6 A3.2 3.2 0 0 1 15.2 8.6 A3.2 3.2 0 0 1 8.8 8.6 A3.2 3.2 0 0 1 2.4 8.6 Z');
    g.fill(awning, 'red');
    g.fill(D('M9.7 3.4 H14.3 L15.2 8.6 A3.2 3.2 0 0 1 8.8 8.6 Z'), 'cream', false);
  },
  gift(g) {
    g.fill(D('M12 7.4 C10.4 2.4 4.6 3.2 6 6.2 C6.8 7.6 9.6 7.6 12 7.4 Z'), 'red');
    g.fill(D('M12 7.4 C13.6 2.4 19.4 3.2 18 6.2 C17.2 7.6 14.4 7.6 12 7.4 Z'), 'red');
    g.layer();
    g.fill(RR(4.3, 11.2, 15.4, 9.8, 1.4), 'gold');
    g.fill(RR(2.8, 7.2, 18.4, 4.6, 1.3), 'gold');
    g.fill(D('M10.5 7.2 H13.5 V21 H10.5 Z'), 'red', false);
    g.stroke(D('M4.6 11.9 H19.4'), 0.9, SHADE, false);
  },
  calendar(g) {
    g.fill(RR(3.2, 5, 17.6, 16, 2.8), 'cream');
    g.fill(D('M3.2 9.8 V7.8 A2.8 2.8 0 0 1 6 5 H18 A2.8 2.8 0 0 1 20.8 7.8 V9.8 Z'), 'red', false);
    const dots = [7.6, 13.3, 12, 13.3, 16.4, 13.3, 7.6, 17.3, 12, 17.3];
    for (let i = 0; i < dots.length; i += 2) g.fill(C(dots[i], dots[i + 1], 1.25), '#b8862e', false);
    g.fill(KH(16.4, 17.3, 2.1), '#e09a1e', false);
    g.layer();
    g.stroke(D('M8 3.2 V6.6'), 1.9, 'gold');
    g.stroke(D('M16 3.2 V6.6'), 1.9, 'gold');
  },
  trophy(g) {
    g.stroke(D('M7 5.4 H4.2 V6.8 A3.6 3.6 0 0 0 7.8 10.4'), 1.7, 'gold');
    g.stroke(D('M17 5.4 H19.8 V6.8 A3.6 3.6 0 0 1 16.2 10.4'), 1.7, 'gold');
    g.fill(D('M10.9 13.4 H13.1 V17.4 H10.9 Z'), 'gold');
    g.fill(RR(7.2, 17, 9.6, 3.8, 1.1), 'gold');
    g.fill(D('M6.6 3.2 H17.4 V9 A5.4 5.4 0 0 1 6.6 9 Z'), 'gold');
    g.fill(KH(12, 8.2, 2.7), '#fffaf0', false);
    g.stroke(D('M8.2 4.6 V8.6'), 1, HI, false);
  },
  map(g) {
    const m = D('M2.8 6.2 L9 3.8 L15 6.2 L21.2 3.8 V17.8 L15 20.2 L9 17.8 L2.8 20.2 Z');
    g.fill(m, 'gold');
    g.stroke(m, 1, 'gold');
    g.fill(D('M9 3.8 L15 6.2 V20.2 L9 17.8 Z'), 'rgba(255,255,255,0.4)', false);
    g.stroke(D('M9 4.4 V17.4 M15 6.6 V19.6'), 0.8, SHADE, false);
    g.stroke(D('M5.6 15.6 L8.4 13.4 M10.6 12.2 L13.2 12.8'), 1.3, '#8a5a12', false);
    g.fill(C(17.8, 10.2, 2.1), 'red', false);
    g.fill(C(17.8, 10.2, 0.8), '#fff', false);
  },
  sound(g) {
    speaker(g);
    g.stroke(D('M14.8 8.7 A4.6 4.6 0 0 1 14.8 15.3'), 2.1, 'gold');
    g.stroke(D('M17.6 5.6 A8.8 8.8 0 0 1 17.6 18.4'), 2.1, 'gold');
  },
  soundOff(g) {
    speaker(g);
    g.stroke(D('M15.2 9.2 L20.8 14.8 M20.8 9.2 L15.2 14.8'), 2.3, 'red');
  },
  music(g) {
    notes(g);
  },
  musicOff(g) {
    notes(g);
    slash(g);
  },
  haptics(g) {
    phone(g);
    g.stroke(D('M5 7.6 L3.4 9.8 L5 12 L3.4 14.2 L5 16.4'), 1.7, 'gold');
    g.stroke(D('M19 7.6 L20.6 9.8 L19 12 L20.6 14.2 L19 16.4'), 1.7, 'gold');
  },
  hapticsOff(g) {
    phone(g);
    slash(g);
  },
  language(g) {
    g.fill(C(12, 12, 9.3), '#3a2a7a');
    g.stroke(D('M12 2.8 C7.6 6.6 7.6 17.4 12 21.2 C16.4 17.4 16.4 6.6 12 2.8 M3 12 H21 M4.8 7.4 H19.2 M4.8 16.6 H19.2'), 1.3, 'gold', false);
    g.stroke(C(12, 12, 9.2), 2, 'gold', false);
  },
  shield(g) {
    const s = D('M12 2.6 L20.2 5.4 V11.4 C20.2 16.4 16.8 19.8 12 21.6 C7.2 19.8 3.8 16.4 3.8 11.4 V5.4 Z');
    g.fill(s, 'gold');
    g.fill(D('M12 2.6 L20.2 5.4 V11.4 C20.2 16.4 16.8 19.8 12 21.6 Z'), SHADE, false);
    g.stroke(D('M8 11.8 L11 14.8 L16.2 8.8'), 2.2, INK, false);
  },
  trash(g) {
    g.stroke(D('M9.4 5.8 V4 H14.6 V5.8'), 1.8, 'gold');
    g.fill(D('M6 8.4 H18 L17 21 H7 Z'), 'gold');
    g.stroke(D('M4.2 6.6 H19.8'), 2.4, 'gold');
    g.stroke(D('M9.8 11.2 V17.8 M14.2 11.2 V17.8'), 1.4, '#8a5a12', false);
  },

  hammer(g) {
    g.stroke(D('M4.6 19.8 L12.8 11.6'), 3, 'brass');
    g.layer();
    const h = RRot(15, 9.4, 12.4, 6.6, 1.5, Math.PI / 4);
    g.fill(h, 'gold');
    g.fill(RRot(12.3, 6.7, 2.2, 6.6, 0.6, Math.PI / 4), HI, false);
    g.stroke(D('M15.9 5.6 L18.9 8.6'), 1, SHADE, false);
  },
  freeSwap(g) {
    // two pieces trading places under one double-headed arc
    g.stroke(D('M6.4 9.4 C6.4 3.4 17.6 3.4 17.6 9.4'), 2.3, 'gold');
    g.fill(head(6.4, 11.6, Math.PI / 2, 4.4, 3.5), 'gold');
    g.fill(head(17.6, 11.6, Math.PI / 2, 4.4, 3.5), 'gold');
    g.layer();
    g.fill(C(6.4, 17, 4.3), 'red');
    g.stroke(D('M4.2 16 C4.4 14.8 5.4 14.2 6.4 14.2'), 1, 'rgba(255,255,255,0.75)', false);
    g.fill(PP([17.6, 12.2, 22.3, 17, 17.6, 21.8, 12.9, 17], 0.7), '#7fe6f5');
    g.fill(PP([17.6, 13.6, 20.9, 17, 17.6, 17, 14.3, 17]), 'rgba(255,255,255,0.5)', false);
  },
  shuffle(g) {
    g.stroke(D('M2.8 7 H6.4 C11 7 12.6 17 17.2 17 H18.6'), 2.4, 'gold');
    g.fill(head(22, 17, 0, 4.4, 3.7), 'gold');
    g.layer();
    g.stroke(D('M2.8 17 H6.4 C11 17 12.6 7 17.2 7 H18.6'), 2.4, 'gold');
    g.fill(head(22, 7, 0, 4.4, 3.7), 'gold');
  },
  extraMoves(g) {
    swapArrows(g, 3.4, 16.2, 12.6, 18.6, 2.3, 3.7);
    g.layer();
    g.fill(C(17.4, 6.6, 5), 'cream');
    g.stroke(D('M17.4 3.9 V9.3 M14.7 6.6 H20.1'), 1.9, '#b0451c', false);
  },
  prismBooster(g) {
    g.custom((ctx) => {
      ctx.save();
      ctx.scale(0.24, 0.24);
      drawPrism(ctx, g.px);
      ctx.restore();
    });
  },
  beamNova(g) {
    // a beam of light (double arrow) passing behind a nova ring with its jewel
    g.stroke(D('M5 12 H19'), 2.8, 'cream');
    g.fill(head(0.8, 12, Math.PI, 5.6, 4.9), 'cream');
    g.fill(head(23.2, 12, 0, 5.6, 4.9), 'cream');
    g.layer();
    g.fill(C(12, 12, 6.2), '#3a2a7a');
    g.stroke(C(12, 12, 5.4), 2.1, 'gold', false);
    g.fill(PP([12, 8.9, 15.1, 12, 12, 15.1, 8.9, 12], 0.4), '#ff5d6c', false);
    g.fill(PP([12, 9.9, 14, 12, 12, 12, 10, 12]), 'rgba(255,255,255,0.5)', false);
  },

  goalScore(g) {
    g.fill(scallop(12, 12, 9.3, 0.9, 10), 'gold');
    g.stroke(C(12, 12, 6.9), 0.9, '#c88d24', false);
    const s = STAR5(12, 12.3, 5.4, 2.5);
    g.fill(s, '#fffaf0', false);
    g.stroke(s, 0.6, '#fffaf0', false);
  },
  goalSand(g) {
    const dune = D('M1.8 19.8 C5.2 19 7 12.4 10.2 8.4 C11.6 6.8 13.2 7 14.2 8.8 C16.6 13.2 18.6 19 22.2 19.8 Z');
    g.fill(dune, 'sand');
    g.stroke(dune, 1, 'sand');
    g.fill(D('M12.2 7.6 C13.4 7.4 13.8 8.2 14.2 8.8 C16.6 13.2 18.6 19 22.2 19.8 H13 C15.2 16.4 10.6 12.6 12.2 7.6 Z'), 'rgba(150,92,30,0.35)', false);
    g.stroke(D('M5.8 17.6 C7.4 16.6 8.6 17.8 10.2 16.8 M8.4 13.6 C9.4 13 10 13.8 11 13.2'), 0.9, 'rgba(140,84,24,0.75)', false);
    g.fill(C(17.6, 5.2, 0.9), 'sand');
    g.fill(C(20.4, 8.2, 0.75), 'sand');
    g.fill(C(5.6, 8.6, 0.75), 'sand');
  },
  goalStone(g) {
    g.fill(RR(3, 3, 18, 18, 3.4), 'stone');
    g.stroke(D('M5 18.4 V7.2 A2.2 2.2 0 0 1 7.2 5 H18.4'), 1.3, 'rgba(255,246,220,0.8)', false);
    g.stroke(D('M19.3 6.8 V17 A2.3 2.3 0 0 1 17 19.3 H6.8'), 1.3, 'rgba(120,76,36,0.6)', false);
    g.stroke(KH(12, 12, 4.6), 1, '#8a5a30', false);
    g.stroke(D('M14.6 3.4 L13.2 7 L15.4 9.4 M9.4 20.4 L10.6 17.4 L8.8 15.4'), 1.1, '#4a2c16', false);
  },
  goalVine(g) {
    g.fill(PP([9.6, 4.8, 8.2, 1.9, 11.6, 3.9], 0.3), 'cream');
    g.fill(PP([19.6, 8.2, 22.6, 7, 20.6, 10.4], 0.3), 'cream');
    g.fill(PP([4.2, 12.6, 1.4, 11.2, 3.4, 14.6], 0.3), 'cream');
    g.fill(PP([15.8, 16.4, 17.6, 19.2, 14.2, 17.6], 0.3), 'cream');
    g.stroke(D('M4.4 20.6 C2.8 11 8 4.4 14 4.4 C18.2 4.4 20.6 7.4 20.6 10.6 C20.6 14 18.2 16 15.4 16 C12.8 16 11.2 14.4 11.2 12.4 C11.2 10.8 12.4 9.8 13.8 9.8'), 2.7, 'green');
    g.layer();
    g.fill(D('M4.4 20.6 C5 17.6 7.4 16.6 10 17.4 C9.4 20 7 21.4 4.4 20.6 Z'), '#a6ee7a');
  },
  goalChain(g) {
    const a = -Math.PI / 4;
    const ringA = RRot(6.9, 17.1, 9.4, 6.2, 3.1, a);
    const ringB = RRot(17.1, 6.9, 9.4, 6.2, 3.1, a);
    g.stroke(ringA, 2.1, 'iron');
    g.stroke(ringB, 2.1, 'iron');
    g.layer();
    g.stroke(D('M9.3 14.7 L14.7 9.3'), 2.7, 'iron');
  },

  adVideo(g) {
    screen(g);
  },
  noAds(g) {
    screen(g);
    slash(g);
  },
  coinPile(g) {
    coin(g, 7.6, 9, 5.6);
    g.layer();
    coin(g, 16.6, 9.6, 5.6);
    g.layer();
    coin(g, 12, 15.4, 6.2);
  },
  coinChest(g) {
    // open lid, coins heaped inside
    g.fill(D('M3.6 9.6 C3.6 5 7 2.6 12 2.6 C17 2.6 20.4 5 20.4 9.6 Z'), 'brass');
    g.stroke(D('M5.8 9 C5.8 6.2 8.2 4.6 12 4.6 C15.8 4.6 18.2 6.2 18.2 9'), 1, 'rgba(255,240,190,0.75)', false);
    g.layer();
    g.fill(C(8.4, 10.4, 2.5), 'gold');
    g.fill(C(15.6, 10.4, 2.5), 'gold');
    g.fill(C(12, 9.6, 2.9), 'gold');
    g.layer();
    g.fill(RR(2.8, 11.2, 18.4, 9.8, 1.6), 'brass');
    g.fill(D('M2.8 11.2 H21.2 V13.6 H2.8 Z M6 11.2 H8.2 V21 H6 Z M15.8 11.2 H18 V21 H15.8 Z'), 'gold', false);
    g.fill(RR(10.3, 12.4, 3.4, 4.4, 0.9), 'cream', false);
    g.fill(C(12, 14.4, 0.8), INK, false);
  },
  restore(g) {
    const arc = new Path2D();
    arc.arc(12, 12.5, 7.5, Math.PI + 0.52, -Math.PI * 0.5, true);
    g.stroke(arc, 2.6, 'gold');
    g.fill(head(6.8, 5, Math.PI - 0.12, 5.6, 4.2), 'gold');
    g.stroke(D('M8.8 12.8 L11.2 15.2 L15.4 10.2'), 2.1, 'cream');
  },
};

export const ICON_KEYS: readonly IconKey[] = Object.keys(ICONS) as IconKey[];

export function isIconKey(key: string): key is IconKey {
  return Object.prototype.hasOwnProperty.call(ICONS, key);
}

/** Draw an icon into a context that is already scaled so the icon box is 24×24 units. */
export function drawIcon(ctx: Ctx, key: IconKey, px: number): void {
  const ops: Op[] = [];
  const pen: Pen = {
    px,
    fill(p, paint, outlined = true) {
      ops.push({ p, w: 0, paint, outlined, custom: null });
    },
    stroke(p, w, paint, outlined = true) {
      ops.push({ p, w, paint, outlined, custom: null });
    },
    layer() {
      flush(ctx, ops);
    },
    custom(fn) {
      ops.push({ p: null, w: 0, paint: '', outlined: false, custom: fn });
    },
  };
  ctx.save();
  ICONS[key](pen);
  flush(ctx, ops);
  ctx.restore();
}
