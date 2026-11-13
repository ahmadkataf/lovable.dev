/**
 * Blockers and the drop item: stone (3 states), chain overlay, vine, lamp, sand (2 layers).
 * Drawn in a 100×100 unit box; `px` = real device size (for shadows only).
 */
import type { Ctx } from './util.ts';
import { PAL, TAU, circle, khatam, lGrad, mulberry32, poly, rgba, rrect } from './util.ts';

const INK = '#150e2e';

function dropShadow(ctx: Ctx, px: number, strength: number): void {
  ctx.shadowColor = 'rgba(5,3,26,' + strength + ')';
  ctx.shadowBlur = px * 0.07;
  ctx.shadowOffsetY = px * 0.04;
}

function noShadow(ctx: Ctx): void {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

// ───────────────────────────── stone ─────────────────────────────

function crack(ctx: Ctx, pts: readonly number[], w: number): void {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // light lip on the lower-right of the fissure, then the fissure itself
  ctx.strokeStyle = 'rgba(255,238,200,0.55)';
  ctx.lineWidth = w * 0.7;
  ctx.beginPath();
  ctx.moveTo(pts[0] + 1.1, pts[1] + 1.1);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] + 1.1, pts[i + 1] + 1.1);
  ctx.stroke();
  ctx.strokeStyle = '#3a2210';
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.stroke();
}

/** Carved sandstone block. hp 3 = intact, 2 = cracked, 1 = crumbling. */
export function drawStone(ctx: Ctx, px: number, hp: number): void {
  const rnd = mulberry32(0x57a9e);
  const body = new Path2D();
  rrect(body, 5, 5, 90, 90, 14);

  ctx.save();
  dropShadow(ctx, px, 0.6);
  ctx.fillStyle = '#3d2614';
  ctx.fill(body);
  ctx.restore();

  ctx.save();
  ctx.clip(body);
  // bevel: lit top / left edges, shaded bottom / right edges
  ctx.fillStyle = '#8c5f36';
  ctx.fillRect(0, 0, 100, 100);
  ctx.fillStyle = '#f6dcae';
  ctx.beginPath();
  poly(ctx, [0, 0, 100, 0, 86, 14, 14, 86, 0, 100]);
  ctx.fill();
  // face
  const face = new Path2D();
  rrect(face, 13, 13, 74, 74, 8);
  ctx.fillStyle = lGrad(ctx, 14, 12, 86, 90, [
    [0, '#ecc994'],
    [0.55, '#d6aa72'],
    [1, '#bf8f58'],
  ]);
  ctx.fill(face);
  // grain
  for (let i = 0; i < 70; i++) {
    const x = 14 + rnd() * 72;
    const y = 14 + rnd() * 72;
    const r = 0.5 + rnd() * 1.1;
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(120,78,38,0.28)' : 'rgba(255,240,205,0.4)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  // carved khatam: recessed star with a shaded upper lip and a lit lower lip
  const star = new Path2D();
  khatam(star, 50, 50, 25, -Math.PI / 2);
  ctx.fillStyle = 'rgba(150,100,52,0.42)';
  ctx.fill(star);
  ctx.lineJoin = 'miter';
  ctx.save();
  ctx.translate(1.2, 1.2);
  ctx.strokeStyle = 'rgba(255,240,205,0.75)';
  ctx.lineWidth = 1.6;
  ctx.stroke(star);
  ctx.restore();
  ctx.strokeStyle = '#7a4f28';
  ctx.lineWidth = 2;
  ctx.stroke(star);
  const inner = new Path2D();
  khatam(inner, 50, 50, 11, -Math.PI / 2);
  ctx.fillStyle = 'rgba(110,70,34,0.5)';
  ctx.fill(inner);
  ctx.fillStyle = 'rgba(255,238,200,0.75)';
  ctx.beginPath();
  ctx.arc(50, 50, 3, 0, TAU);
  ctx.fill();

  if (hp <= 2) {
    crack(ctx, [64, 5, 58, 19, 63, 30, 54, 42, 57, 54, 47, 62], 3);
    crack(ctx, [58, 19, 46, 25, 40, 22], 2);
    crack(ctx, [54, 42, 68, 46, 74, 43], 2);
  }
  if (hp <= 1) {
    crack(ctx, [47, 62, 37, 72, 41, 83, 33, 95], 3.4);
    crack(ctx, [95, 60, 82, 63, 76, 74, 63, 78, 57, 54], 3);
    crack(ctx, [5, 38, 18, 42, 26, 36, 40, 22], 2.6);
    crack(ctx, [37, 72, 22, 70, 15, 76], 2.2);
    crack(ctx, [76, 74, 80, 86, 76, 95], 2.2);
    // the block is losing colour as it breaks up
    ctx.fillStyle = 'rgba(60,34,20,0.16)';
    ctx.fillRect(0, 0, 100, 100);
  }
  ctx.restore();

  // outline
  ctx.strokeStyle = '#3d2614';
  ctx.lineWidth = 2.4;
  ctx.stroke(body);

  if (hp <= 1) {
    // chunks knocked out of two corners and one edge
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    ctx.beginPath();
    poly(ctx, [100, 0, 70, 0, 74, 9, 82, 11, 86, 20, 95, 23, 100, 28]);
    poly(ctx, [0, 100, 0, 74, 8, 78, 11, 87, 20, 90, 24, 100]);
    poly(ctx, [100, 78, 92, 82, 90, 90, 84, 94, 82, 100, 100, 100]);
    ctx.fill();
    ctx.restore();
    // broken faces of the chips
    ctx.strokeStyle = '#4a2c16';
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(70.5, 5.5);
    ctx.lineTo(74, 9);
    ctx.lineTo(82, 11);
    ctx.lineTo(86, 20);
    ctx.lineTo(94.5, 23);
    ctx.moveTo(5.5, 75.5);
    ctx.lineTo(8, 78);
    ctx.lineTo(11, 87);
    ctx.lineTo(20, 90);
    ctx.lineTo(23, 94.5);
    ctx.moveTo(94.5, 80.5);
    ctx.lineTo(92, 82);
    ctx.lineTo(90, 90);
    ctx.lineTo(84, 94);
    ctx.stroke();
    // rubble
    ctx.fillStyle = '#c99a64';
    ctx.strokeStyle = '#4a2c16';
    ctx.lineWidth = 1.4;
    const bits = [88, 9, 4, 93, 16, 3, 9, 92, 3.4];
    for (let i = 0; i < bits.length; i += 3) {
      ctx.beginPath();
      poly(ctx, [bits[i] - bits[i + 2], bits[i + 1], bits[i], bits[i + 1] - bits[i + 2], bits[i] + bits[i + 2], bits[i + 1] + 1, bits[i] - 1, bits[i + 1] + bits[i + 2]]);
      ctx.fill();
      ctx.stroke();
    }
  }
}

// ───────────────────────────── chain ─────────────────────────────

function chainRun(ctx: Ctx, x0: number, y0: number, x1: number, y1: number): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  const step = 11.2;
  const n = Math.round(len / step);
  const s = len / n;
  ctx.save();
  ctx.translate(x0, y0);
  ctx.rotate(Math.atan2(dy, dx));
  // face-on links
  for (let i = 0; i <= n; i += 2) {
    const x = i * s;
    const link = new Path2D();
    rrect(link, x - 8.4, -5.4, 16.8, 10.8, 5.4);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5.4;
    ctx.stroke(link);
    ctx.strokeStyle = lGrad(ctx, 0, -6, 0, 6, [
      [0, '#aab2cc'],
      [0.5, '#6b7390'],
      [1, '#3c4158'],
    ]);
    ctx.lineWidth = 3.2;
    ctx.stroke(link);
    ctx.strokeStyle = 'rgba(232,238,255,0.8)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(x - 4.5, -5.9);
    ctx.lineTo(x + 3.5, -5.9);
    ctx.stroke();
  }
  // edge-on links threading through them
  for (let i = 1; i < n; i += 2) {
    const x = i * s;
    const bar = new Path2D();
    rrect(bar, x - 7, -2.5, 14, 5, 2.5);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.stroke(bar);
    ctx.fillStyle = lGrad(ctx, 0, -2.5, 0, 2.5, [
      [0, '#b9c0d8'],
      [0.55, '#666e8a'],
      [1, '#3c4158'],
    ]);
    ctx.fill(bar);
  }
  ctx.restore();
}

/** Chain overlay: an X of dark iron links with a small brass padlock in the middle. */
export function drawChain(ctx: Ctx, px: number): void {
  ctx.save();
  ctx.shadowColor = 'rgba(5,3,26,0.55)';
  ctx.shadowBlur = px * 0.04;
  ctx.shadowOffsetY = px * 0.025;
  chainRun(ctx, 9.5, 9.5, 90.5, 90.5);
  chainRun(ctx, 90.5, 9.5, 9.5, 90.5);
  ctx.restore();

  // padlock
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const shackle = new Path2D();
  shackle.moveTo(42.5, 49);
  shackle.lineTo(42.5, 42.5);
  shackle.arc(50, 42.5, 7.5, Math.PI, 0);
  shackle.lineTo(57.5, 49);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6.4;
  ctx.stroke(shackle);
  ctx.strokeStyle = lGrad(ctx, 40, 0, 60, 0, [
    [0, '#e3e8f6'],
    [0.5, '#9aa2bd'],
    [1, '#5a6180'],
  ]);
  ctx.lineWidth = 3.6;
  ctx.stroke(shackle);
  const lock = new Path2D();
  rrect(lock, 36.5, 47, 27, 21.5, 5);
  dropShadow(ctx, px, 0.5);
  ctx.fillStyle = INK;
  ctx.fill(lock);
  noShadow(ctx);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.stroke(lock);
  ctx.fillStyle = lGrad(ctx, 0, 47, 0, 68.5, [
    [0, '#fff0b8'],
    [0.4, PAL.gold],
    [1, '#b47d22'],
  ]);
  ctx.fill(lock);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  rrect(ctx, 39, 49, 22, 3.4, 1.7);
  ctx.fill();
  // keyhole
  ctx.fillStyle = '#3a2408';
  ctx.beginPath();
  ctx.arc(50, 56.2, 3, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  poly(ctx, [48.6, 57, 51.4, 57, 52.4, 64, 47.6, 64]);
  ctx.fill();
  ctx.restore();
}

// ───────────────────────────── vine ─────────────────────────────

function stem(ctx: Ctx, p: Path2D): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0c2812';
  ctx.lineWidth = 12.5;
  ctx.stroke(p);
  ctx.strokeStyle = lGrad(ctx, 10, 10, 90, 90, [
    [0, '#6fbf4a'],
    [0.5, '#3f9a3c'],
    [1, '#23702f'],
  ]);
  ctx.lineWidth = 8.4;
  ctx.stroke(p);
  ctx.save();
  ctx.translate(-1.5, -1.6);
  ctx.strokeStyle = 'rgba(200,245,150,0.62)';
  ctx.lineWidth = 1.8;
  ctx.stroke(p);
  ctx.restore();
}

function thorn(ctx: Ctx, x: number, y: number, ang: number, len: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const t = new Path2D();
  t.moveTo(-1, -3.6);
  t.quadraticCurveTo(len * 0.5, -1.6, len, 0.6);
  t.quadraticCurveTo(len * 0.45, 1.6, -1, 3.6);
  t.closePath();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0c2812';
  ctx.lineWidth = 2.6;
  ctx.stroke(t);
  ctx.fillStyle = lGrad(ctx, 0, 0, len, 0, [
    [0, '#8fd45a'],
    [0.45, '#f4e7ae'],
    [1, '#fff8e0'],
  ]);
  ctx.fill(t);
  ctx.restore();
}

/** Vine: a knot of thorny green stems with a tiny leaf, on a bed of dark foliage. */
export function drawVine(ctx: Ctx, px: number): void {
  // bed
  const bed = new Path2D();
  rrect(bed, 5, 5, 90, 90, 24);
  ctx.save();
  dropShadow(ctx, px, 0.5);
  ctx.fillStyle = '#0d2a18';
  ctx.fill(bed);
  ctx.restore();
  ctx.save();
  ctx.clip(bed);
  const g = ctx.createRadialGradient(46, 42, 6, 50, 50, 56);
  g.addColorStop(0, '#1f5a2e');
  g.addColorStop(1, '#0c2614');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 100, 100);
  ctx.restore();

  const loop = new Path2D();
  loop.moveTo(50, 17);
  loop.bezierCurveTo(73, 15, 86, 34, 83, 54);
  loop.bezierCurveTo(80, 75, 62, 86, 45, 83.5);
  loop.bezierCurveTo(25, 80, 14, 64, 17, 45);
  loop.bezierCurveTo(20, 28, 33, 18, 50, 17);
  loop.closePath();
  const strandA = new Path2D();
  strandA.moveTo(15, 27);
  strandA.bezierCurveTo(34, 30, 40, 51, 55, 54);
  strandA.bezierCurveTo(70, 57, 78, 69, 87, 77);
  const strandB = new Path2D();
  strandB.moveTo(25, 87);
  strandB.bezierCurveTo(31, 66, 51, 62, 58, 45);
  strandB.bezierCurveTo(63, 32, 72, 24, 84, 16);

  // thorns sit behind the stems they grow from
  const thorns = [
    50, 17, -1.75, 9, 76, 26, -0.7, 9.5, 84, 52, 0.05, 9, 71, 77, 0.95, 9.5, 45, 83.5, 1.75, 9, 21, 68, 2.6, 9.5, 17, 44, 3.3, 9, 31, 23,
    -2.35, 9.5,
  ];
  for (let i = 0; i < thorns.length; i += 4) thorn(ctx, thorns[i], thorns[i + 1], thorns[i + 2], thorns[i + 3] + 4);
  stem(ctx, loop);
  thorn(ctx, 38, 44, -2.2, 10);
  thorn(ctx, 70, 61, -0.45, 10);
  stem(ctx, strandA);
  thorn(ctx, 39, 68, 2.5, 10);
  thorn(ctx, 62, 35, 0.35, 10);
  stem(ctx, strandB);

  // tiny leaf
  ctx.save();
  ctx.translate(79, 21);
  ctx.rotate(-0.55);
  const leaf = new Path2D();
  leaf.moveTo(-9, 0);
  leaf.quadraticCurveTo(0, -9.5, 11, 0);
  leaf.quadraticCurveTo(0, 9.5, -9, 0);
  leaf.closePath();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0c2812';
  ctx.lineWidth = 2.8;
  ctx.stroke(leaf);
  ctx.fillStyle = lGrad(ctx, 0, -8, 0, 8, [
    [0, '#c9f58a'],
    [1, '#58c24a'],
  ]);
  ctx.fill(leaf);
  ctx.strokeStyle = '#2a7a30';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-7, 0);
  ctx.lineTo(9, 0);
  ctx.stroke();
  ctx.restore();
}

// ───────────────────────────── lamp ─────────────────────────────

/** Lamp: a brass oil lamp with a small flame at the spout. */
export function drawLamp(ctx: Ctx, px: number): void {
  const OUT = '#4a2c08';
  const brass = lGrad(ctx, 0, 40, 0, 90, [
    [0, '#fff3c2'],
    [0.28, PAL.gold],
    [0.68, '#c58c2c'],
    [1, '#8a5814'],
  ]);

  const body = new Path2D();
  body.moveTo(17, 59);
  body.bezierCurveTo(17, 51, 27, 47, 39, 47);
  body.lineTo(55, 47);
  body.bezierCurveTo(63, 47, 69, 51, 75, 49);
  body.bezierCurveTo(81, 47, 84, 42, 89, 39.5);
  body.lineTo(92, 44);
  body.bezierCurveTo(87, 47, 84.5, 53, 79.5, 59);
  body.bezierCurveTo(73, 69.5, 61, 77, 45, 77);
  body.bezierCurveTo(29, 77, 17, 69, 17, 59);
  body.closePath();
  const foot = new Path2D();
  poly(foot, [37, 75, 53, 75, 57, 84, 33, 84]);
  rrect(foot, 27.5, 82.5, 35, 6, 3);
  const lid = new Path2D();
  lid.moveTo(36.5, 47.5);
  lid.bezierCurveTo(36.5, 38.5, 57.5, 38.5, 57.5, 47.5);
  lid.closePath();
  circle(lid, 47, 36.6, 3.6);
  const handle = new Path2D();
  handle.moveTo(20, 52.5);
  handle.bezierCurveTo(8.5, 47.5, 5.5, 62, 12.5, 68);
  handle.bezierCurveTo(16, 70.6, 19.5, 69.6, 22, 67);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // silhouette pass with shadow
  dropShadow(ctx, px, 0.6);
  ctx.strokeStyle = OUT;
  ctx.fillStyle = OUT;
  ctx.lineWidth = 8.2;
  ctx.stroke(handle);
  ctx.lineWidth = 3;
  ctx.stroke(body);
  ctx.fill(body);
  ctx.stroke(foot);
  ctx.fill(foot);
  ctx.stroke(lid);
  ctx.fill(lid);
  noShadow(ctx);

  // handle
  ctx.strokeStyle = lGrad(ctx, 4, 48, 24, 70, [
    [0, '#ffe7a3'],
    [1, '#b47d22'],
  ]);
  ctx.lineWidth = 5;
  ctx.stroke(handle);
  // foot, body, lid
  ctx.fillStyle = lGrad(ctx, 0, 75, 0, 89, [
    [0, '#b47d22'],
    [0.55, PAL.gold],
    [1, '#9a6a1c'],
  ]);
  ctx.fill(foot);
  ctx.fillStyle = brass;
  ctx.fill(body);
  ctx.fillStyle = lGrad(ctx, 0, 33, 0, 48, [
    [0, '#fff6cf'],
    [0.6, PAL.gold],
    [1, '#c58c2c'],
  ]);
  ctx.fill(lid);

  // modelling inside the body
  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = 'rgba(110,62,10,0.35)';
  ctx.beginPath();
  ctx.ellipse(50, 84, 40, 14, 0, 0, TAU);
  ctx.fill();
  // engraved band with studs
  ctx.strokeStyle = 'rgba(120,72,14,0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(18, 61);
  ctx.quadraticCurveTo(46, 69.5, 80, 57.5);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,246,210,0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(18, 62.6);
  ctx.quadraticCurveTo(46, 71.1, 80, 59.1);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#fff6d2';
  ctx.strokeStyle = 'rgba(120,72,14,0.9)';
  ctx.lineWidth = 0.9;
  const studs = [32, 57.3, 45.5, 59.2, 59, 57.6];
  for (let i = 0; i < studs.length; i += 2) {
    ctx.beginPath();
    khatam(ctx, studs[i], studs[i + 1], 3.3, -Math.PI / 2);
    ctx.fill();
    ctx.stroke();
  }
  // gloss
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.beginPath();
  ctx.ellipse(31, 52.2, 8.5, 2.3, -0.28, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(43.5, 41.8, 3.4, 1.3, -0.35, 0, TAU);
  ctx.fill();
  ctx.restore();

  // flame
  const fx = 90.2;
  const fy = 41;
  const halo = ctx.createRadialGradient(fx, fy - 11, 0, fx, fy - 11, 19);
  halo.addColorStop(0, 'rgba(255,214,110,0.75)');
  halo.addColorStop(0.5, 'rgba(255,170,60,0.3)');
  halo.addColorStop(1, 'rgba(255,150,40,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(fx - 20, fy - 31, 30, 40);
  const flame = new Path2D();
  flame.moveTo(fx, fy);
  flame.bezierCurveTo(fx - 7.2, fy - 6, fx - 3.4, fy - 15, fx + 0.6, fy - 24);
  flame.bezierCurveTo(fx + 4.6, fy - 15, fx + 7, fy - 6, fx, fy);
  flame.closePath();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#a23a06';
  ctx.lineWidth = 2;
  ctx.stroke(flame);
  ctx.fillStyle = lGrad(ctx, 0, fy - 24, 0, fy, [
    [0, '#ff7a1a'],
    [0.6, '#ffb52e'],
    [1, '#ffe27a'],
  ]);
  ctx.fill(flame);
  const inner = new Path2D();
  inner.moveTo(fx, fy - 1);
  inner.bezierCurveTo(fx - 3.6, fy - 5, fx - 1.4, fy - 10, fx + 0.3, fy - 15);
  inner.bezierCurveTo(fx + 2.6, fy - 10, fx + 3.6, fy - 5, fx, fy - 1);
  inner.closePath();
  ctx.fillStyle = '#fffbe0';
  ctx.fill(inner);
}

// ───────────────────────────── sand ─────────────────────────────

/**
 * Sand floor overlay (drawn over the tile, under the piece).
 * 1 layer: thin and see-through. 2 layers: thick, bright, rippled, with a raised lip.
 */
export function drawSand(ctx: Ctx, layers: number): void {
  const thick = layers >= 2;
  const rnd = mulberry32(thick ? 0x5a4d2 : 0x5a4d1);
  const shape = new Path2D();
  rrect(shape, 1.2, 1.2, 97.6, 97.6, 10);

  ctx.save();
  ctx.clip(shape);
  ctx.globalAlpha = thick ? 0.95 : 0.6;
  ctx.fillStyle = lGrad(ctx, 0, 0, 100, 100, thick
    ? [
        [0, '#f7dea2'],
        [0.5, '#ecc57c'],
        [1, '#d7a557'],
      ]
    : [
        [0, '#efc67c'],
        [1, '#d09b4e'],
      ]);
  ctx.fillRect(0, 0, 100, 100);

  if (thick) {
    // wind ripples
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const y = 15 + i * 17.5;
      const ph = i * 1.7;
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass === 0 ? 'rgba(160,104,44,0.55)' : 'rgba(255,246,214,0.75)';
        ctx.lineWidth = pass === 0 ? 2 : 1.4;
        const oy = pass === 0 ? 0 : 2;
        ctx.beginPath();
        for (let x = -2; x <= 102; x += 4) {
          const yy = y + oy + Math.sin(x * 0.085 + ph) * 3.2 + Math.sin(x * 0.19 + ph * 2) * 1.1;
          if (x === -2) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
    }
  }
  // grains
  const n = thick ? 150 : 110;
  for (let i = 0; i < n; i++) {
    const x = rnd() * 100;
    const y = rnd() * 100;
    const r = 0.55 + rnd() * (thick ? 1.1 : 0.9);
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(140,90,36,0.5)' : 'rgba(255,248,220,0.7)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // edge: thin sand just fades at the border, thick sand has a lit lip and a shaded foot
  if (thick) {
    ctx.lineWidth = 5;
    ctx.strokeStyle = lGrad(ctx, 0, 0, 0, 100, [
      [0, 'rgba(255,250,225,0.9)'],
      [0.5, 'rgba(255,240,200,0.25)'],
      [1, 'rgba(120,72,24,0.75)'],
    ]);
    ctx.stroke(shape);
  } else {
    ctx.lineWidth = 3;
    ctx.strokeStyle = rgba('#7a4e1e', 0.35);
    ctx.stroke(shape);
  }
  ctx.restore();
}
