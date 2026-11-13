/**
 * Procedural artwork that belongs to the journey map only: the level medallions (eight-pointed
 * khatam stars with a jewel disc), the trail ornaments and the small landmarks along the trail.
 * Everything is drawn with Canvas 2D into cached data URLs, used as CSS backgrounds so 120 nodes
 * cost no canvases of their own.
 */

export type NodeSkin = 'done' | 'current' | 'locked' | 'hardDone' | 'hardCurrent' | 'hardLocked';

export type DecoKind =
  | 'post'
  | 'palm'
  | 'tent'
  | 'rock'
  | 'jars'
  | 'awning'
  | 'dome'
  | 'cypress'
  | 'crystal'
  | 'mushroom'
  | 'starlet'
  | 'comet';

const TAU = Math.PI * 2;
const INK = '#1b1547';

type Ctx = CanvasRenderingContext2D;

const cache = new Map<string, string>();

function render(key: string, px: number, box: number, paint: (ctx: Ctx) => void): string {
  const size = Math.max(8, Math.round(px));
  const id = key + '@' + size;
  const hit = cache.get(id);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  let url = '';
  if (ctx) {
    ctx.scale(size / box, size / box);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    paint(ctx);
    url = canvas.toDataURL('image/png');
  }
  cache.set(id, url);
  return url;
}

function starPath(ctx: Ctx, cx: number, cy: number, rOuter: number, rInner: number, points: number, rot: number): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = rot + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function vGrad(ctx: Ctx, y0: number, y1: number, stops: readonly string[]): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (let i = 0; i < stops.length; i++) g.addColorStop(stops.length === 1 ? 0 : i / (stops.length - 1), stops[i]!);
  return g;
}

interface Skin {
  rim: readonly string[];
  rimEdge: string;
  disc: readonly string[];
  ring: string;
  spikes: readonly string[] | null;
  gloss: number;
}

const GOLD_RIM = ['#fff6cf', '#ffd666', '#e9a93a', '#b9791f'];
const SLATE_RIM = ['#d5d1f0', '#a29dcd', '#7872ab', '#565089'];

const SKINS: Record<NodeSkin, Skin> = {
  done: { rim: GOLD_RIM, rimEdge: '#8a5a14', disc: ['#8672f5', '#5a45d6', '#352a94'], ring: '#221a66', spikes: null, gloss: 0.34 },
  current: { rim: ['#fffbe6', '#ffe27a', '#f2b33c', '#c98a22'], rimEdge: '#8a5a14', disc: ['#7dffc0', '#2fd98a', '#0f9a5c'], ring: '#07623b', spikes: null, gloss: 0.42 },
  locked: { rim: SLATE_RIM, rimEdge: '#3f3a72', disc: ['#4a4390', '#2f2a6a', '#211d52'], ring: '#17143d', spikes: null, gloss: 0.12 },
  hardDone: { rim: GOLD_RIM, rimEdge: '#8a5a14', disc: ['#ff9aa2', '#f0475f', '#b31f3c'], ring: '#6d0f25', spikes: ['#ff8a96', '#d22c48'], gloss: 0.34 },
  hardCurrent: { rim: ['#fffbe6', '#ffe27a', '#f2b33c', '#c98a22'], rimEdge: '#8a5a14', disc: ['#ffb0a6', '#ff5a5f', '#c8223f'], ring: '#6d0f25', spikes: ['#ff9aa2', '#e23a55'], gloss: 0.42 },
  hardLocked: { rim: SLATE_RIM, rimEdge: '#3f3a72', disc: ['#7a4a86', '#58305f', '#3c2046'], ring: '#24122c', spikes: ['#b98bb8', '#7f5488'], gloss: 0.12 },
};

function paintMedallion(ctx: Ctx, skin: Skin): void {
  const cx = 60;
  const cy = 58;
  const R = 47;
  const inner = R * 0.8;
  const rot = -Math.PI / 2;

  // cast shadow
  ctx.save();
  ctx.translate(0, 5);
  starPath(ctx, cx, cy, R + 3, inner + 3, 8, rot);
  ctx.fillStyle = 'rgba(10, 8, 40, 0.32)';
  ctx.strokeStyle = 'rgba(10, 8, 40, 0.32)';
  ctx.lineWidth = 6;
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // hard levels: small jewels peeking out of the valleys between the points
  if (skin.spikes) {
    for (let i = 0; i < 8; i++) {
      const a = rot + Math.PI / 8 + (i * TAU) / 8;
      const x = cx + Math.cos(a) * (R - 2.5);
      const y = cy + Math.sin(a) * (R - 2.5);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -8.5);
      ctx.lineTo(6, 0);
      ctx.lineTo(0, 7);
      ctx.lineTo(-6, 0);
      ctx.closePath();
      ctx.fillStyle = INK;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.fill();
      ctx.fillStyle = vGrad(ctx, -8, 7, skin.spikes);
      ctx.fill();
      ctx.restore();
    }
  }

  // dark outline
  starPath(ctx, cx, cy, R, inner, 8, rot);
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 9;
  ctx.fill();
  ctx.stroke();

  // metal rim
  starPath(ctx, cx, cy, R, inner, 8, rot);
  const rim = vGrad(ctx, cy - R, cy + R, skin.rim);
  ctx.fillStyle = rim;
  ctx.strokeStyle = rim;
  ctx.lineWidth = 3.5;
  ctx.fill();
  ctx.stroke();

  // bevel: a darker lower edge and a light upper edge inside the rim
  ctx.save();
  starPath(ctx, cx, cy, R, inner, 8, rot);
  ctx.clip();
  starPath(ctx, cx, cy + 2.2, R - 5.5, inner - 5, 8, rot);
  ctx.strokeStyle = skin.rimEdge;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.globalAlpha = 0.75;
  starPath(ctx, cx, cy - 1.4, R - 5.5, inner - 5, 8, rot);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();

  // jewel disc
  const r = 27.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 3.2, 0, TAU);
  ctx.fillStyle = skin.ring;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fillStyle = vGrad(ctx, cy - r, cy + r, skin.disc);
  ctx.fill();
  // inner shade at the bottom, gloss at the top
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.clip();
  const shade = ctx.createRadialGradient(cx, cy - 6, r * 0.55, cx, cy, r * 1.05);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(10, 6, 40, 0.38)');
  ctx.fillStyle = shade;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.beginPath();
  ctx.ellipse(cx, cy - r * 0.52, r * 0.78, r * 0.44, 0, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,' + skin.gloss + ')';
  ctx.fill();
  ctx.restore();
  // sparkle
  if (skin.gloss > 0.2) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    starPath(ctx, cx - 30, cy - 31, 6.5, 1.9, 4, 0);
    ctx.fill();
  }
}

/** Data URL of a level medallion, `px` device pixels wide (square). */
export function nodeSprite(skin: NodeSkin, px: number): string {
  return render('node-' + skin, px, 120, (ctx) => paintMedallion(ctx, SKINS[skin]));
}

/** A flat little khatam star (trail ornament, banner ornament). */
export function khatamSprite(px: number, color: string): string {
  return render('khatam-' + color, px, 40, (ctx) => {
    starPath(ctx, 20, 20, 15, 11.6, 8, -Math.PI / 2);
    ctx.fillStyle = INK;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.fill();
    ctx.stroke();
    starPath(ctx, 20, 20, 15, 11.6, 8, -Math.PI / 2);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(20, 20, 4.2, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fill();
  });
}

// ───────────────────────────── landmarks ─────────────────────────────

function outline(ctx: Ctx, fill: string | CanvasGradient, w = 5): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** The little oval of ground every landmark stands on, so it reads as a token on the map. */
function islet(ctx: Ctx, top: string, bottom: string, y = 84, rx = 34, ry = 9): void {
  ctx.beginPath();
  ctx.ellipse(50, y + 4, rx + 3, ry + 1, 0, 0, TAU);
  ctx.fillStyle = 'rgba(10, 8, 40, 0.28)';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(50, y, rx, ry, 0, 0, TAU);
  outline(ctx, vGrad(ctx, y - ry, y + ry, [top, bottom]), 4.5);
}

function glow(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(255, 220, 120, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

const DECO: Record<DecoKind, (ctx: Ctx) => void> = {
  /** lantern post: brass pole with a hook and a glowing lantern */
  post(ctx) {
    islet(ctx, '#f3d089', '#c99646', 88, 20, 6);
    glow(ctx, 62, 44, 30, 'rgba(255, 214, 110, 0.55)');
    // pole
    ctx.beginPath();
    ctx.moveTo(38, 88);
    ctx.lineTo(38, 26);
    ctx.quadraticCurveTo(38, 14, 50, 14);
    ctx.quadraticCurveTo(62, 14, 62, 26);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.strokeStyle = vGrad(ctx, 14, 88, ['#ffe7a3', '#d9a440', '#9a6a1e']);
    ctx.lineWidth = 4.5;
    ctx.stroke();
    // lantern
    ctx.beginPath();
    ctx.moveTo(54, 32);
    ctx.lineTo(70, 32);
    ctx.lineTo(73, 52);
    ctx.lineTo(62, 60);
    ctx.lineTo(51, 52);
    ctx.closePath();
    outline(ctx, vGrad(ctx, 32, 60, ['#fff7c9', '#ffd24d', '#ff9f2e']), 5);
    ctx.beginPath();
    ctx.moveTo(52, 32);
    ctx.lineTo(72, 32);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = '#c98f2e';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(62, 45, 3.2, 5.5, 0, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  },

  palm(ctx) {
    islet(ctx, '#f6d993', '#cf9c4c');
    // trunk
    ctx.beginPath();
    ctx.moveTo(46, 84);
    ctx.quadraticCurveTo(44, 58, 54, 36);
    ctx.lineTo(60, 38);
    ctx.quadraticCurveTo(52, 60, 56, 84);
    ctx.closePath();
    outline(ctx, vGrad(ctx, 36, 84, ['#c98a4a', '#8d5a2a']), 5);
    // fronds
    const fronds: [number, number, number][] = [
      [-0.2, 34, 12],
      [-0.9, 30, 11],
      [-1.75, 28, 11],
      [-2.5, 32, 11],
      [-3.2, 34, 12],
      [0.45, 30, 10],
      [-3.75, 28, 10],
    ];
    for (const [a, len, w] of fronds) {
      ctx.save();
      ctx.translate(57, 36);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(len * 0.5, -w, len, w * 0.35);
      ctx.quadraticCurveTo(len * 0.5, w * 0.1, 0, 0);
      ctx.closePath();
      outline(ctx, vGrad(ctx, -w, w, ['#7be0a0', '#2aa76a']), 4.5);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(55, 39, 4, 0, TAU);
    ctx.arc(61, 41, 3.6, 0, TAU);
    outline(ctx, '#b8762e', 3.5);
  },

  tent(ctx) {
    islet(ctx, '#f6d993', '#cf9c4c');
    ctx.beginPath();
    ctx.moveTo(18, 82);
    ctx.quadraticCurveTo(36, 62, 50, 30);
    ctx.quadraticCurveTo(64, 62, 82, 82);
    ctx.closePath();
    outline(ctx, vGrad(ctx, 30, 82, ['#fff3d6', '#f1d6a0']), 5);
    // stripes
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(18, 82);
    ctx.quadraticCurveTo(36, 62, 50, 30);
    ctx.quadraticCurveTo(64, 62, 82, 82);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = '#e8566a';
    for (const x of [26, 68]) {
      ctx.beginPath();
      ctx.moveTo(50, 28);
      ctx.lineTo(x - 7, 86);
      ctx.lineTo(x + 5, 86);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // door
    ctx.beginPath();
    ctx.moveTo(41, 82);
    ctx.quadraticCurveTo(50, 50, 59, 82);
    ctx.closePath();
    outline(ctx, '#3a2a7a', 4);
    // pennant
    ctx.beginPath();
    ctx.moveTo(50, 30);
    ctx.lineTo(50, 16);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(50, 15);
    ctx.lineTo(64, 20);
    ctx.lineTo(50, 25);
    ctx.closePath();
    outline(ctx, '#ffd24d', 4);
  },

  rock(ctx) {
    islet(ctx, '#f0c27a', '#c48a42');
    ctx.beginPath();
    ctx.moveTo(24, 82);
    ctx.lineTo(30, 58);
    ctx.lineTo(44, 46);
    ctx.lineTo(58, 54);
    ctx.lineTo(64, 82);
    ctx.closePath();
    outline(ctx, vGrad(ctx, 46, 82, ['#f2a66a', '#b9643a']), 5);
    ctx.beginPath();
    ctx.moveTo(54, 82);
    ctx.lineTo(60, 64);
    ctx.lineTo(72, 60);
    ctx.lineTo(80, 82);
    ctx.closePath();
    outline(ctx, vGrad(ctx, 60, 82, ['#ffc083', '#cf7a45']), 5);
    ctx.beginPath();
    ctx.moveTo(34, 60);
    ctx.lineTo(44, 52);
    ctx.lineTo(50, 58);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  },

  jars(ctx) {
    islet(ctx, '#d9b3ef', '#9d6bc9');
    const jar = (x: number, s: number, c1: string, c2: string): void => {
      ctx.save();
      ctx.translate(x, 82);
      ctx.scale(s, s);
      ctx.beginPath();
      ctx.moveTo(-7, -36);
      ctx.lineTo(7, -36);
      ctx.lineTo(6, -30);
      ctx.quadraticCurveTo(17, -22, 14, -8);
      ctx.quadraticCurveTo(12, 0, 0, 0);
      ctx.quadraticCurveTo(-12, 0, -14, -8);
      ctx.quadraticCurveTo(-17, -22, -6, -30);
      ctx.closePath();
      outline(ctx, vGrad(ctx, -36, 0, [c1, c2]), 5 / s);
      ctx.beginPath();
      ctx.moveTo(-11, -18);
      ctx.quadraticCurveTo(0, -13, 11, -18);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.restore();
    };
    jar(36, 1.05, '#7fe3d2', '#2e9c9a');
    jar(62, 0.8, '#ffd27a', '#e08a3a');
  },

  awning(ctx) {
    islet(ctx, '#d9b3ef', '#9d6bc9');
    // posts
    ctx.beginPath();
    ctx.rect(24, 44, 5, 40);
    ctx.rect(71, 44, 5, 40);
    outline(ctx, '#b8762e', 4.5);
    // counter
    ctx.beginPath();
    ctx.rect(22, 64, 56, 20);
    outline(ctx, vGrad(ctx, 64, 84, ['#c98a4a', '#8d5a2a']), 5);
    // awning with scallops
    ctx.beginPath();
    ctx.moveTo(16, 46);
    ctx.lineTo(24, 28);
    ctx.lineTo(76, 28);
    ctx.lineTo(84, 46);
    for (let i = 3; i >= 0; i--) {
      const x0 = 16 + i * 17;
      ctx.quadraticCurveTo(x0 + 8.5, 58, x0, 46);
    }
    ctx.closePath();
    outline(ctx, '#fff3d6', 5);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#2fb7a6';
    for (let i = 0; i < 4; i += 2) ctx.fillRect(16 + i * 17, 20, 17, 44);
    ctx.restore();
    // fruit
    for (const [x, c] of [
      [36, '#ff6b6b'],
      [50, '#ffd24d'],
      [64, '#b05cff'],
    ] as const) {
      ctx.beginPath();
      ctx.arc(x, 62, 5.5, 0, TAU);
      outline(ctx, c, 3.5);
    }
  },

  dome(ctx) {
    islet(ctx, '#a9b8ff', '#5b63d6');
    ctx.beginPath();
    ctx.rect(26, 60, 48, 24);
    outline(ctx, vGrad(ctx, 60, 84, ['#c9d1ff', '#8e97ee']), 5);
    ctx.beginPath();
    ctx.moveTo(28, 60);
    ctx.bezierCurveTo(22, 38, 44, 34, 50, 22);
    ctx.bezierCurveTo(56, 34, 78, 38, 72, 60);
    ctx.closePath();
    outline(ctx, vGrad(ctx, 22, 60, ['#8ff0e0', '#2bb7a8', '#178f8a']), 5);
    ctx.beginPath();
    ctx.moveTo(40, 40);
    ctx.quadraticCurveTo(36, 48, 36, 56);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2.6;
    ctx.stroke();
    // door + finial
    ctx.beginPath();
    ctx.moveTo(43, 84);
    ctx.lineTo(43, 72);
    ctx.quadraticCurveTo(50, 62, 57, 72);
    ctx.lineTo(57, 84);
    ctx.closePath();
    outline(ctx, '#ffd24d', 4);
    ctx.beginPath();
    ctx.moveTo(50, 22);
    ctx.lineTo(50, 12);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4.5;
    ctx.stroke();
    ctx.strokeStyle = '#ffd24d';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(50, 10, 3.4, 0, TAU);
    outline(ctx, '#ffd24d', 3);
  },

  cypress(ctx) {
    islet(ctx, '#a9b8ff', '#5b63d6', 86, 26, 7);
    const tree = (x: number, h: number): void => {
      ctx.beginPath();
      ctx.moveTo(x, 86 - h);
      ctx.bezierCurveTo(x + 13, 86 - h * 0.55, x + 11, 80, x, 84);
      ctx.bezierCurveTo(x - 11, 80, x - 13, 86 - h * 0.55, x, 86 - h);
      ctx.closePath();
      outline(ctx, vGrad(ctx, 86 - h, 86, ['#5fe0b0', '#1f9c7c', '#136a62']), 5);
    };
    tree(40, 62);
    tree(60, 46);
  },

  crystal(ctx) {
    islet(ctx, '#7ad9d0', '#2a8f95');
    glow(ctx, 50, 54, 34, 'rgba(120, 255, 235, 0.4)');
    const shard = (x: number, w: number, h: number, lean: number, c: readonly string[]): void => {
      ctx.beginPath();
      ctx.moveTo(x - w, 84);
      ctx.lineTo(x - w * 0.8 + lean, 84 - h * 0.7);
      ctx.lineTo(x + lean * 1.4, 84 - h);
      ctx.lineTo(x + w * 0.8 + lean, 84 - h * 0.7);
      ctx.lineTo(x + w, 84);
      ctx.closePath();
      outline(ctx, vGrad(ctx, 84 - h, 84, c), 5);
      ctx.beginPath();
      ctx.moveTo(x + lean * 1.4, 84 - h + 4);
      ctx.lineTo(x - w * 0.25 + lean * 0.4, 82);
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 2.4;
      ctx.stroke();
    };
    shard(34, 9, 38, -4, ['#d9a8ff', '#9c5cf0', '#6a35c4']);
    shard(66, 9, 34, 4, ['#d9a8ff', '#9c5cf0', '#6a35c4']);
    shard(50, 11, 58, 0, ['#c8fff6', '#55e6d6', '#1fa7b0']);
  },

  mushroom(ctx) {
    islet(ctx, '#7ad9d0', '#2a8f95', 86, 26, 7);
    glow(ctx, 50, 56, 30, 'rgba(160, 255, 220, 0.4)');
    const shroom = (x: number, s: number): void => {
      ctx.save();
      ctx.translate(x, 86);
      ctx.scale(s, s);
      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.quadraticCurveTo(-3, -14, -4, -24);
      ctx.lineTo(4, -24);
      ctx.quadraticCurveTo(3, -14, 5, 0);
      ctx.closePath();
      outline(ctx, '#e9fff8', 5 / s);
      ctx.beginPath();
      ctx.moveTo(-20, -22);
      ctx.quadraticCurveTo(-18, -44, 0, -44);
      ctx.quadraticCurveTo(18, -44, 20, -22);
      ctx.quadraticCurveTo(0, -17, -20, -22);
      ctx.closePath();
      outline(ctx, vGrad(ctx, -44, -20, ['#a8fff0', '#3fd9c6', '#1a9a9c']), 5 / s);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (const [dx, dy, r] of [
        [-8, -33, 3],
        [5, -36, 2.4],
        [10, -28, 2.6],
      ] as const) {
        ctx.beginPath();
        ctx.arc(dx, dy, r, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    };
    shroom(40, 1.05);
    shroom(64, 0.7);
  },

  starlet(ctx) {
    glow(ctx, 50, 50, 42, 'rgba(255, 232, 150, 0.45)');
    starPath(ctx, 50, 50, 26, 20, 8, -Math.PI / 2);
    outline(ctx, vGrad(ctx, 24, 76, ['#fff6cf', '#ffd666', '#e9a93a']), 5);
    ctx.beginPath();
    ctx.arc(50, 50, 9, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    starPath(ctx, 22, 26, 8, 2.3, 4, 0);
    ctx.fill();
    starPath(ctx, 80, 72, 6.5, 2, 4, 0);
    ctx.fill();
  },

  comet(ctx) {
    const tail = ctx.createLinearGradient(14, 82, 62, 36);
    tail.addColorStop(0, 'rgba(160, 220, 255, 0)');
    tail.addColorStop(1, 'rgba(200, 240, 255, 0.85)');
    ctx.beginPath();
    ctx.moveTo(12, 84);
    ctx.quadraticCurveTo(34, 50, 58, 30);
    ctx.lineTo(70, 44);
    ctx.quadraticCurveTo(40, 62, 12, 84);
    ctx.closePath();
    ctx.fillStyle = tail;
    ctx.fill();
    glow(ctx, 66, 36, 26, 'rgba(190, 235, 255, 0.6)');
    ctx.beginPath();
    ctx.arc(66, 36, 12, 0, TAU);
    outline(ctx, vGrad(ctx, 24, 48, ['#ffffff', '#bfe9ff', '#6fb8ff']), 5);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    starPath(ctx, 30, 30, 6, 1.8, 4, 0);
    ctx.fill();
    starPath(ctx, 84, 68, 7, 2.1, 4, 0);
    ctx.fill();
  },
};

/** Data URL of a trail landmark, `px` device pixels wide (square). */
export function decoSprite(kind: DecoKind, px: number): string {
  return render('deco-' + kind, px, 100, DECO[kind]);
}
