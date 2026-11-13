/**
 * Tutorial tips: for each tip id a tiny illustrative board, drawn from the real sprites, that
 * shows the pattern (which gem to slide where, what lights up, what it makes).
 * The texts are in src/i18n/strings/play.ts (`play.tut.<id>.title` / `.text`).
 */
import type { ArtApi, SpriteKey } from '../art/types.ts';

export const TIP_IDS = ['match', 'collect', 'beam', 'nova', 'prism', 'combo', 'sand', 'sand2', 'stone', 'lamp', 'chain', 'vine'] as const;
export type TipId = (typeof TIP_IDS)[number];

export function isTipId(id: string | undefined): id is TipId {
  return id !== undefined && (TIP_IDS as readonly string[]).indexOf(id) >= 0;
}

/** Profile key under which a tip is remembered as seen. */
export function tipSeenKey(id: string): string {
  return 'tut.' + id;
}

interface TipArt {
  /**
   * Rows of space-separated tokens: a sprite key, optionally prefixed with "k:" for a chained
   * piece; "." = empty tile; "_" = no tile.
   */
  rows: string[];
  /** Sand layers per cell, same shape ("0" / "1" / "2"). */
  floor?: string[];
  /** Exit markers on the bottom row. */
  exits?: boolean;
  /** The swipe to make: from cell → to cell [c, r]. */
  arrow?: [number, number, number, number];
  /** Cells that light up. */
  glow?: [number, number][];
  /** What the move makes (drawn large beside the board). */
  result?: SpriteKey;
}

const ARTS: Record<TipId, TipArt> = {
  match: {
    rows: ['gem1 gem0 gem2 gem4', 'gem0 gem3 gem0 gem2', 'gem2 gem4 gem1 gem3'],
    arrow: [1, 0, 1, 1],
    glow: [
      [0, 1],
      [1, 1],
      [2, 1],
    ],
  },
  collect: {
    rows: ['gem1 gem3 gem2 gem4', 'gem0 gem0 gem4 gem0', 'gem2 gem4 gem3 gem1'],
    arrow: [3, 1, 2, 1],
    glow: [
      [0, 1],
      [1, 1],
      [2, 1],
    ],
  },
  beam: {
    rows: ['gem3 gem1 gem2 gem4', 'gem2 gem2 gem0 gem2', 'gem4 gem0 gem3 gem1'],
    arrow: [2, 0, 2, 1],
    glow: [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ],
    result: 'beamV2',
  },
  nova: {
    rows: ['gem0 gem1 gem3 gem2', 'gem1 gem2 gem3 gem0', 'gem3 gem3 gem4 gem3'],
    arrow: [3, 2, 2, 2],
    glow: [
      [2, 0],
      [2, 1],
      [0, 2],
      [1, 2],
      [2, 2],
    ],
    result: 'nova3',
  },
  prism: {
    rows: ['gem1 gem0 gem4 gem2 gem3', 'gem4 gem4 gem1 gem4 gem4', 'gem2 gem3 gem0 gem1 gem0'],
    arrow: [2, 0, 2, 1],
    glow: [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 1],
    ],
    result: 'prism',
  },
  combo: {
    rows: ['gem2 gem4 gem1 gem3', 'gem1 beamH0 nova3 gem2', 'gem4 gem3 gem2 gem0'],
    arrow: [1, 1, 2, 1],
    glow: [
      [1, 1],
      [2, 1],
    ],
  },
  sand: {
    rows: ['gem2 gem1 gem4 gem3', 'gem0 gem0 gem1 gem0', 'gem3 gem4 gem2 gem1'],
    floor: ['0000', '1111', '1111'],
    arrow: [2, 0, 2, 1],
    glow: [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ],
  },
  sand2: {
    rows: ['gem2 gem1 gem4 gem3', 'gem0 gem0 gem1 gem0', 'gem3 gem4 gem2 gem1'],
    floor: ['0000', '2222', '1221'],
    arrow: [2, 0, 2, 1],
    glow: [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ],
  },
  stone: {
    rows: ['gem2 gem4 gem1 stone3', 'gem1 gem1 gem3 gem1', 'gem4 stone2 gem2 stone1'],
    arrow: [2, 0, 2, 1],
    glow: [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ],
  },
  lamp: {
    rows: ['gem2 lamp gem4', 'gem1 gem3 gem0', 'gem3 gem1 gem3', 'gem4 gem3 gem2'],
    exits: true,
    arrow: [1, 3, 1, 2],
    glow: [
      [0, 2],
      [1, 2],
      [2, 2],
    ],
  },
  chain: {
    rows: ['gem3 gem4 gem1 gem0', 'gem1 k:gem1 gem2 gem1', 'gem0 gem2 gem4 gem3'],
    arrow: [2, 0, 2, 1],
    glow: [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ],
  },
  vine: {
    rows: ['gem3 gem0 gem2 vine', 'gem2 gem2 gem4 gem2', 'gem0 vine gem3 vine'],
    arrow: [2, 0, 2, 1],
    glow: [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ],
  },
};

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.arcTo(x + w, y, x + w, y + r, r);
  g.lineTo(x + w, y + h - r);
  g.arcTo(x + w, y + h, x + w - r, y + h, r);
  g.lineTo(x + r, y + h);
  g.arcTo(x, y + h, x, y + h - r, r);
  g.lineTo(x, y + r);
  g.arcTo(x, y, x + r, y, r);
  g.closePath();
}

function arrowPath(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, width: number): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const head = width * 2.4;
  const hx = x1 - ux * head;
  const hy = y1 - uy * head;
  g.beginPath();
  g.moveTo(x0 + nx * width * 0.5, y0 + ny * width * 0.5);
  g.lineTo(hx + nx * width * 0.5, hy + ny * width * 0.5);
  g.lineTo(hx + nx * width * 1.35, hy + ny * width * 1.35);
  g.lineTo(x1, y1);
  g.lineTo(hx - nx * width * 1.35, hy - ny * width * 1.35);
  g.lineTo(hx - nx * width * 0.5, hy - ny * width * 0.5);
  g.lineTo(x0 - nx * width * 0.5, y0 - ny * width * 0.5);
  g.closePath();
}

/**
 * The illustration of a tip: a canvas `cssW` CSS px wide (height follows the little board).
 * Built from the same sprites the board uses.
 */
export function drawTip(art: ArtApi, id: TipId, cssW: number): HTMLCanvasElement {
  const spec = ARTS[id];
  let ratio = 1;
  try {
    ratio = Math.min(3, window.devicePixelRatio || 1);
  } catch {
    ratio = 1;
  }
  const grid = spec.rows.map((row) => row.split(' '));
  const rows = grid.length;
  const cols = (grid[0] as string[]).length;
  const hasResult = !!spec.result;
  const pad = 10;
  // room for the board, and beside it the result
  const boardShare = hasResult ? 0.64 : 1;
  const cell = Math.floor(Math.min(((cssW - pad * 2) * boardShare) / cols, 56));
  const boardW = cell * cols;
  const boardH = cell * rows;
  const resultW = hasResult ? Math.min(cssW - pad * 2 - boardW, cell * 2.4) : 0;
  const totalW = boardW + resultW;
  const cssH = boardH + pad * 2;
  const canvas = document.createElement('canvas');
  canvas.className = 'pl-tip__art';
  canvas.width = Math.round(cssW * ratio);
  canvas.height = Math.round(cssH * ratio);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.setAttribute('aria-hidden', 'true');
  const g = canvas.getContext('2d');
  if (!g) return canvas;
  g.scale(ratio, ratio);

  // backing
  const back = g.createLinearGradient(0, 0, 0, cssH);
  back.addColorStop(0, '#1a1650');
  back.addColorStop(1, '#100d36');
  g.fillStyle = back;
  g.fillRect(0, 0, cssW, cssH);

  const ox = Math.round((cssW - totalW) / 2);
  const oy = pad;
  const px = Math.round(cell * ratio);
  const draw = (key: SpriteKey, c: number, r: number, scale?: number): void => {
    const s = cell * (scale || 1);
    g.drawImage(art.sprite(key, px), ox + c * cell + (cell - s) / 2, oy + r * cell + (cell - s) / 2, s, s);
  };

  // frame
  g.fillStyle = '#f5c95a';
  roundRect(g, ox - 3, oy - 3, boardW + 6, boardH + 6, 9);
  g.fill();
  g.save();
  roundRect(g, ox, oy, boardW, boardH, 6);
  g.clip();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const token = (grid[r] as string[])[c] as string;
      if (token === '_') continue;
      draw((c + r) % 2 === 0 ? 'tileA' : 'tileB', c, r);
      if (spec.exits && r === rows - 1) draw('exit', c, r);
      const sand = spec.floor ? (spec.floor[r] as string).charAt(c) : '0';
      if (sand === '1') draw('sand1', c, r);
      else if (sand === '2') draw('sand2', c, r);
    }
  }
  if (spec.glow) {
    for (let i = 0; i < spec.glow.length; i++) {
      const cellPos = spec.glow[i] as [number, number];
      draw('hint', cellPos[0], cellPos[1], 1.08);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let token = (grid[r] as string[])[c] as string;
      if (token === '_' || token === '.') continue;
      const chained = token.indexOf('k:') === 0;
      if (chained) token = token.slice(2);
      draw(token as SpriteKey, c, r);
      if (chained) draw('chain', c, r);
    }
  }
  g.restore();

  // the swipe
  if (spec.arrow) {
    const a = spec.arrow;
    const x0 = ox + (a[0] + 0.5) * cell;
    const y0 = oy + (a[1] + 0.5) * cell;
    const x1 = ox + (a[2] + 0.5) * cell;
    const y1 = oy + (a[3] + 0.5) * cell;
    // start a little off the centre so the gem stays visible
    const sx = x0 + (x1 - x0) * 0.18;
    const sy = y0 + (y1 - y0) * 0.18;
    const ex = x0 + (x1 - x0) * 0.86;
    const ey = y0 + (y1 - y0) * 0.86;
    const w = Math.max(5, cell * 0.16);
    g.lineJoin = 'round';
    arrowPath(g, sx, sy, ex, ey, w);
    g.lineWidth = Math.max(3, cell * 0.1);
    g.strokeStyle = '#231f5c';
    g.stroke();
    g.fillStyle = '#fff6dc';
    g.fill();
  }

  // what it makes
  if (spec.result) {
    const rx = ox + boardW;
    const midY = oy + boardH / 2;
    const w = Math.max(4, cell * 0.12);
    g.lineJoin = 'round';
    arrowPath(g, rx + resultW * 0.1, midY, rx + resultW * 0.42, midY, w);
    g.lineWidth = Math.max(2.5, cell * 0.08);
    g.strokeStyle = '#231f5c';
    g.stroke();
    g.fillStyle = '#f5c95a';
    g.fill();
    const size = Math.min(resultW * 0.56, cell * 1.35);
    const rpx = Math.round(size * ratio);
    const cx = rx + resultW * 0.72;
    const glow = g.createRadialGradient(cx, midY, 0, cx, midY, size * 0.8);
    glow.addColorStop(0, 'rgba(255,240,190,0.6)');
    glow.addColorStop(1, 'rgba(255,240,190,0)');
    g.fillStyle = glow;
    g.fillRect(cx - size, midY - size, size * 2, size * 2);
    g.drawImage(art.sprite(spec.result, rpx), cx - size / 2, midY - size / 2, size, size);
  }
  return canvas;
}
