/**
 * Board renderer: one Canvas, devicePixelRatio-aware (capped at 3), redrawn only while something
 * animates. It owns the VISUAL model of the board — where each piece is drawn right now — plus
 * particles and effects. It knows nothing about rules: the step player (./player.ts) moves the
 * pieces and asks for effects, the engine's snapshot is the truth it is reconciled with.
 *
 * Coordinates: everything visual is stored in CELL units (x = column, y = row, 1 = one cell), so a
 * resize or rotation in the middle of an animation needs no fixing up. Device pixels appear only
 * inside draw().
 *
 * Hot path rules (step / draw): no allocations, no closures, cached sprites and glow textures only.
 */
import type { ArtApi, SpriteKey } from '../art/types.ts';
import type { Color, Piece, PieceKind, Pos, Snapshot } from '../engine/types.ts';
import type { BoardRect } from './geometry.ts';
import { cappedDpr, fitBoard } from './geometry.ts';
import { FEEDBACK } from './feedback.ts';

export interface VPiece {
  id: number;
  kind: PieceKind;
  color: number;
  hp: number;
  chained: boolean;
  /** cell position (top-left of the cell it is drawn in) */
  x: number;
  y: number;
  /** extra offset in cells (drag, hint bounce, wobble) */
  ox: number;
  oy: number;
  sx: number;
  sy: number;
  rot: number;
  alpha: number;
  /** 0..1 additive white-ish glow on top of the sprite */
  flash: number;
  /** drawn in the top pass */
  lift: boolean;
  /** row above which the piece is not drawn (pieces entering from above); NO_CLIP = none */
  clipTop: number;
  /** alpha of the chain overlay (1 while chained) */
  chainAlpha: number;
  /** leaving the board: ignored by reconcile and hit-testing */
  dying: boolean;
  img: HTMLCanvasElement | null;
}

export const NO_CLIP = -99;

/** Indexes into the particle / glow palette. 0..5 are the gem colours. */
export const PAL_GOLD = 6;
export const PAL_WHITE = 7;
export const PAL_STONE = 8;
export const PAL_LEAF = 9;
export const PAL_IRON = 10;
export const PAL_SAND = 11;
const PAL_SIZE = 12;

export const SHAPE_SHARD = 0;
export const SHAPE_DOT = 1;
export const SHAPE_CHUNK = 2;
export const SHAPE_SPARK = 3;
const SHAPE_COUNT = 4;

const MAX_PARTICLES = 160;
const DPR_CAP = 3;
const FONT = '"Baloo Bhaijaan 2 Variable", "Baloo Bhaijaan 2", system-ui, sans-serif';

interface BeamFx {
  /** centre of the firing cell, in cells */
  x: number;
  y: number;
  horizontal: boolean;
  t: number;
  sweep: number;
  dur: number;
  color: number;
  /** thickness in cells */
  thick: number;
  /** how far the heads travel to the low / high side, in cells */
  lo: number;
  hi: number;
  /** spark emission accumulator */
  emit: number;
}

interface RingFx {
  x: number;
  y: number;
  t: number;
  dur: number;
  r0: number;
  r1: number;
  color: number;
  alpha: number;
  delay: number;
}

interface RayFx {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** control point of the arc */
  cx: number;
  cy: number;
  t: number;
  dur: number;
  delay: number;
  color: number;
}

interface PopupFx {
  x: number;
  y: number;
  t: number;
  dur: number;
  fade: number;
  delay: number;
  img: HTMLCanvasElement;
  /** size in cells */
  w: number;
  h: number;
}

interface GhostFx {
  img: HTMLCanvasElement;
  x: number;
  y: number;
  t: number;
  dur: number;
  delay: number;
  s0: number;
  s1: number;
  a0: number;
  a1: number;
  r0: number;
  r1: number;
  dx: number;
  dy: number;
  additive: boolean;
}

interface GlowFx {
  x: number;
  y: number;
  t: number;
  dur: number;
  delay: number;
  s0: number;
  s1: number;
  alpha: number;
  color: number;
}

export interface BoardView {
  readonly canvas: HTMLCanvasElement;
  /** Take a settled snapshot: cells, floor and one sprite per piece. */
  setBoard(snapshot: Snapshot, lampLevel: boolean): void;
  /** Size the canvas for a stage of this many CSS px and re-fit the board. */
  layout(stageW: number, stageH: number, pad: number, maxCell: number): void;
  rect(): BoardRect;
  cols(): number;
  rows(): number;
  exists(c: number, r: number): boolean;
  /** Row of the spawner cell of a column (pieces enter above it). */
  spawnRow(c: number): number;
  bottomRow(c: number): number;
  sandAt(c: number, r: number): number;
  setSand(c: number, r: number, layers: number): void;

  pieces(): readonly VPiece[];
  piece(id: number): VPiece | null;
  /** id of the piece standing on a cell in the LOGICAL grid, or -1. */
  idAt(c: number, r: number): number;
  pieceAt(c: number, r: number): VPiece | null;
  setGrid(c: number, r: number, id: number): void;
  addPiece(piece: Piece, c: number, r: number): VPiece;
  /** Change kind / colour / hp / chain of a piece and refresh its sprite. */
  morph(vp: VPiece, piece: Piece): void;
  refreshSprite(vp: VPiece): void;
  removePiece(vp: VPiece): void;
  /** Compare with a settled snapshot; rebuilds from it on any difference. Returns the differences found. */
  reconcile(snapshot: Snapshot): string[];
  /** Throw the visual state away and rebuild it from a settled snapshot. */
  reset(snapshot: Snapshot): void;

  // effects (cell coordinates)
  burst(x: number, y: number, color: number, count: number, speed: number, shape: number, opts?: BurstOpts): void;
  beam(x: number, y: number, horizontal: boolean, color: number, thick: number, sweep: number): void;
  ring(x: number, y: number, r0: number, r1: number, dur: number, color: number, alpha?: number, delay?: number): void;
  glow(x: number, y: number, s0: number, s1: number, dur: number, color: number, alpha?: number, delay?: number): void;
  ray(x0: number, y0: number, x1: number, y1: number, dur: number, delay: number, color: number): void;
  popup(x: number, y: number, value: number, dur: number, fade: number, delay: number, big: boolean): void;
  ghost(key: SpriteKey | 'hammer', x: number, y: number, dur: number, opts?: GhostOpts): void;
  flash(alpha: number, dur: number): void;
  shake(px: number, dur: number): void;
  setDim(alpha: number): void;

  setSelection(pos: Pos | null): void;
  setHintCells(a: Pos | null, b: Pos | null): void;
  setHand(a: Pos | null, b: Pos | null): void;
  setTargeting(on: boolean): void;
  setReducedEffects(on: boolean): void;
  setLowEnd(on: boolean): void;

  /** Advance effects and particles by `dt` ms of game time. */
  step(dt: number): void;
  draw(): void;
  /** True while effects, particles or looping highlights need frames. */
  animating(): boolean;
  /** Next draw() is needed even if nothing animates (state changed). */
  invalidate(): void;
  dirty(): boolean;
  clearEffects(): void;
  particleCount(): number;
}

export interface BurstOpts {
  /** direction bias in radians and spread (default: all around) */
  angle?: number;
  spread?: number;
  /** particle size in cells */
  size?: number;
  life?: number;
  gravity?: number;
  additive?: boolean;
}

export interface GhostOpts {
  delay?: number;
  s0?: number;
  s1?: number;
  a0?: number;
  a1?: number;
  r0?: number;
  r1?: number;
  dx?: number;
  dy?: number;
  additive?: boolean;
}

function spriteKeyOf(kind: PieceKind, color: number, hp: number): SpriteKey {
  const c = (color >= 0 && color <= 5 ? color : 0) as Color;
  switch (kind) {
    case 'gem':
      return ('gem' + c) as SpriteKey;
    case 'beamH':
      return ('beamH' + c) as SpriteKey;
    case 'beamV':
      return ('beamV' + c) as SpriteKey;
    case 'nova':
      return ('nova' + c) as SpriteKey;
    case 'prism':
      return 'prism';
    case 'lamp':
      return 'lamp';
    case 'vine':
      return 'vine';
    case 'stone':
      return hp >= 3 ? 'stone3' : hp === 2 ? 'stone2' : 'stone1';
  }
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function createBoardView(canvas: HTMLCanvasElement, art: ArtApi): BoardView {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

  // ── board model ──
  let nCols = 0;
  let nRows = 0;
  let cellExists = new Uint8Array(0);
  let cellSand = new Uint8Array(0);
  let cellExit = new Uint8Array(0);
  let grid = new Int32Array(0);
  let spawnRows = new Int8Array(0);
  let bottomRows = new Int8Array(0);
  let lampLevel = false;
  const list: VPiece[] = [];
  const byId = new Map<number, VPiece>();

  // ── layout ──
  let rect: BoardRect = { x: 0, y: 0, cell: 40, w: 0, h: 0 };
  let dpr = 1;
  /** cell size, board origin and canvas size in device px */
  let cs = 40;
  let bx = 0;
  let by = 0;
  let cw = 0;
  let ch = 0;
  let floor: HTMLCanvasElement | null = null;
  let floorMargin = 0;
  let floorDirty = true;
  let needsDraw = true;

  // ── sprites & textures (rebuilt when the cell size changes) ──
  let chainImg: HTMLCanvasElement | null = null;
  let selectImg: HTMLCanvasElement | null = null;
  let hintImg: HTMLCanvasElement | null = null;
  let handImg: HTMLCanvasElement | null = null;
  let hammerImg: HTMLCanvasElement | null = null;
  let ringImg: HTMLCanvasElement | null = null;
  const glowTex: (HTMLCanvasElement | null)[] = [];
  const streakTex: (HTMLCanvasElement | null)[] = [];
  const partTex: (HTMLCanvasElement | null)[] = [];
  const palette: string[] = [];
  for (let i = 0; i < 6; i++) palette.push(art.gemColor(i as Color));
  palette[PAL_GOLD] = '#ffd76a';
  palette[PAL_WHITE] = '#ffffff';
  palette[PAL_STONE] = '#d89a6a';
  palette[PAL_LEAF] = '#49d877';
  palette[PAL_IRON] = '#aab0c8';
  palette[PAL_SAND] = '#f0d49a';

  // ── particles (structure of arrays) ──
  const pX = new Float32Array(MAX_PARTICLES);
  const pY = new Float32Array(MAX_PARTICLES);
  const pVx = new Float32Array(MAX_PARTICLES);
  const pVy = new Float32Array(MAX_PARTICLES);
  const pLife = new Float32Array(MAX_PARTICLES);
  const pMax = new Float32Array(MAX_PARTICLES);
  const pSize = new Float32Array(MAX_PARTICLES);
  const pRot = new Float32Array(MAX_PARTICLES);
  const pVr = new Float32Array(MAX_PARTICLES);
  const pGrav = new Float32Array(MAX_PARTICLES);
  const pTex = new Uint8Array(MAX_PARTICLES);
  const pAdd = new Uint8Array(MAX_PARTICLES);
  let pCount = 0;
  let particleCap: number = FEEDBACK.maxParticles;

  // ── effects ──
  const beams: BeamFx[] = [];
  const rings: RingFx[] = [];
  const rays: RayFx[] = [];
  const popups: PopupFx[] = [];
  const ghosts: GhostFx[] = [];
  const glows: GlowFx[] = [];
  let flashAlpha = 0;
  let flashT = 0;
  let flashDur = 0;
  let shakeAmp = 0;
  let shakeT = 0;
  let shakeDur = 0;
  let dim = 0;
  let reduced = false;

  // ── highlights ──
  let selC = -1;
  let selR = -1;
  let hintAC = -1;
  let hintAR = -1;
  let hintBC = -1;
  let hintBR = -1;
  let handAC = -1;
  let handAR = -1;
  let handBC = -1;
  let handBR = -1;
  let targeting = false;
  /** free-running clock for looping highlights, ms */
  let loopT = 0;

  /** Reused options of the sparks a beam sheds (no allocation per emission). */
  const sparkOpts: BurstOpts = { angle: 0, spread: 1.6, size: 0.2, life: 320, gravity: 0, additive: true };

  // cheap deterministic noise for particles (no Math.random in tests is not required, but this is faster)
  let seed = 0x2f6e2b1;
  function rnd(): number {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) % 100000) / 100000;
  }

  // ───────────────────────────── textures ─────────────────────────────

  function resetTextures(): void {
    glowTex.length = 0;
    streakTex.length = 0;
    partTex.length = 0;
    for (let i = 0; i < PAL_SIZE; i++) {
      glowTex.push(null);
      streakTex.push(null);
    }
    for (let i = 0; i < PAL_SIZE * SHAPE_COUNT; i++) partTex.push(null);
    chainImg = art.sprite('chain', cs);
    selectImg = art.sprite('select', cs);
    hintImg = art.sprite('hint', cs);
    handImg = null;
    hammerImg = null;
    ringImg = null;
    for (let i = 0; i < list.length; i++) refreshSprite(list[i] as VPiece);
  }

  function rgb(hex: string): [number, number, number] {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function glowOf(color: number): HTMLCanvasElement {
    const i = color >= 0 && color < PAL_SIZE ? color : PAL_WHITE;
    let tex = glowTex[i];
    if (!tex) {
      const size = Math.max(16, Math.round(cs * 1.2));
      tex = makeCanvas(size, size);
      const g = tex.getContext('2d') as CanvasRenderingContext2D;
      const c = rgb(palette[i] as string);
      const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.18, 'rgba(' + Math.min(255, c[0] + 90) + ',' + Math.min(255, c[1] + 90) + ',' + Math.min(255, c[2] + 90) + ',0.95)');
      grad.addColorStop(0.5, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.42)');
      grad.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      glowTex[i] = tex;
    }
    return tex;
  }

  /** A horizontal light streak: white-hot core, coloured halo, soft ends. */
  function streakOf(color: number): HTMLCanvasElement {
    const i = color >= 0 && color < PAL_SIZE ? color : PAL_GOLD;
    let tex = streakTex[i];
    if (!tex) {
      const w = 64;
      const h = Math.max(16, Math.round(cs * 1.4));
      tex = makeCanvas(w, h);
      const g = tex.getContext('2d') as CanvasRenderingContext2D;
      const c = rgb(palette[i] as string);
      const grad = g.createLinearGradient(0, 0, 0, h);
      const col = c[0] + ',' + c[1] + ',' + c[2];
      grad.addColorStop(0, 'rgba(' + col + ',0)');
      grad.addColorStop(0.24, 'rgba(' + col + ',0.38)');
      grad.addColorStop(0.4, 'rgba(255,236,170,0.95)');
      grad.addColorStop(0.5, 'rgba(255,255,255,1)');
      grad.addColorStop(0.6, 'rgba(255,236,170,0.95)');
      grad.addColorStop(0.76, 'rgba(' + col + ',0.38)');
      grad.addColorStop(1, 'rgba(' + col + ',0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      streakTex[i] = tex;
    }
    return tex;
  }

  function particleTex(color: number, shape: number): HTMLCanvasElement {
    const ci = color >= 0 && color < PAL_SIZE ? color : PAL_WHITE;
    const si = shape >= 0 && shape < SHAPE_COUNT ? shape : 0;
    const key = ci * SHAPE_COUNT + si;
    let tex = partTex[key];
    if (!tex) {
      const size = Math.max(8, Math.round(cs * 0.36));
      tex = makeCanvas(size, size);
      const g = tex.getContext('2d') as CanvasRenderingContext2D;
      const hex = palette[ci] as string;
      const c = rgb(hex);
      const light = 'rgb(' + Math.min(255, c[0] + 110) + ',' + Math.min(255, c[1] + 110) + ',' + Math.min(255, c[2] + 110) + ')';
      const dark = 'rgb(' + Math.round(c[0] * 0.55) + ',' + Math.round(c[1] * 0.55) + ',' + Math.round(c[2] * 0.55) + ')';
      const m = size / 2;
      g.lineJoin = 'round';
      if (si === SHAPE_SHARD) {
        // a faceted little diamond
        g.beginPath();
        g.moveTo(m, size * 0.04);
        g.lineTo(size * 0.86, m);
        g.lineTo(m, size * 0.96);
        g.lineTo(size * 0.14, m);
        g.closePath();
        g.fillStyle = hex;
        g.fill();
        g.beginPath();
        g.moveTo(m, size * 0.04);
        g.lineTo(size * 0.86, m);
        g.lineTo(m, m);
        g.closePath();
        g.fillStyle = light;
        g.fill();
        g.beginPath();
        g.moveTo(m, size * 0.96);
        g.lineTo(size * 0.14, m);
        g.lineTo(m, m);
        g.closePath();
        g.fillStyle = dark;
        g.fill();
      } else if (si === SHAPE_DOT) {
        const grad = g.createRadialGradient(m, m, 0, m, m, m);
        grad.addColorStop(0, light);
        grad.addColorStop(0.55, hex);
        grad.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, size, size);
      } else if (si === SHAPE_CHUNK) {
        g.beginPath();
        g.moveTo(size * 0.2, size * 0.14);
        g.lineTo(size * 0.82, size * 0.2);
        g.lineTo(size * 0.9, size * 0.66);
        g.lineTo(size * 0.5, size * 0.9);
        g.lineTo(size * 0.1, size * 0.62);
        g.closePath();
        g.fillStyle = hex;
        g.fill();
        g.lineWidth = Math.max(1, size * 0.07);
        g.strokeStyle = dark;
        g.stroke();
        g.beginPath();
        g.moveTo(size * 0.2, size * 0.14);
        g.lineTo(size * 0.82, size * 0.2);
        g.lineTo(size * 0.5, size * 0.46);
        g.closePath();
        g.fillStyle = light;
        g.globalAlpha = 0.7;
        g.fill();
        g.globalAlpha = 1;
      } else {
        // four-point sparkle
        g.beginPath();
        const k = size * 0.09;
        g.moveTo(m, 0);
        g.quadraticCurveTo(m + k, m - k, size, m);
        g.quadraticCurveTo(m + k, m + k, m, size);
        g.quadraticCurveTo(m - k, m + k, 0, m);
        g.quadraticCurveTo(m - k, m - k, m, 0);
        g.closePath();
        g.fillStyle = light;
        g.fill();
      }
      partTex[key] = tex;
    }
    return tex;
  }

  function ringTexture(): HTMLCanvasElement {
    if (!ringImg) {
      const size = 256;
      ringImg = makeCanvas(size, size);
      const g = ringImg.getContext('2d') as CanvasRenderingContext2D;
      const grad = g.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size / 2);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.55, 'rgba(255,240,190,0.16)');
      grad.addColorStop(0.8, 'rgba(255,250,225,0.95)');
      grad.addColorStop(0.9, 'rgba(255,228,150,0.6)');
      grad.addColorStop(1, 'rgba(255,220,130,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
    }
    return ringImg;
  }

  /** The tutorial pointer: our own simple pointing hand (cream glove, indigo outline, gold cuff). */
  function handTexture(): HTMLCanvasElement {
    if (!handImg) {
      const size = Math.max(24, Math.round(cs * 1.15));
      handImg = makeCanvas(size, size);
      const g = handImg.getContext('2d') as CanvasRenderingContext2D;
      const u = size / 100;
      g.lineJoin = 'round';
      g.lineCap = 'round';
      const body = (): void => {
        g.beginPath();
        // index finger pointing up-left (tip near 22,10)
        g.moveTo(14 * u, 16 * u);
        g.quadraticCurveTo(14 * u, 6 * u, 23 * u, 6 * u);
        g.quadraticCurveTo(32 * u, 6 * u, 32 * u, 16 * u);
        g.lineTo(32 * u, 40 * u);
        // knuckles of the folded fingers
        g.quadraticCurveTo(40 * u, 32 * u, 46 * u, 41 * u);
        g.quadraticCurveTo(54 * u, 35 * u, 59 * u, 45 * u);
        g.quadraticCurveTo(69 * u, 41 * u, 71 * u, 54 * u);
        g.lineTo(70 * u, 74 * u);
        g.quadraticCurveTo(68 * u, 90 * u, 52 * u, 90 * u);
        g.lineTo(36 * u, 90 * u);
        g.quadraticCurveTo(24 * u, 90 * u, 17 * u, 78 * u);
        // thumb
        g.lineTo(5 * u, 58 * u);
        g.quadraticCurveTo(1 * u, 48 * u, 10 * u, 48 * u);
        g.lineTo(14 * u, 52 * u);
        g.closePath();
      };
      g.shadowColor = 'rgba(6,4,26,0.5)';
      g.shadowBlur = 6 * u;
      g.shadowOffsetY = 3 * u;
      body();
      g.fillStyle = '#fff6dc';
      g.fill();
      g.shadowColor = 'transparent';
      g.lineWidth = 5 * u;
      g.strokeStyle = '#231f5c';
      body();
      g.stroke();
      // cuff
      g.beginPath();
      g.moveTo(30 * u, 91 * u);
      g.lineTo(58 * u, 91 * u);
      g.lineWidth = 9 * u;
      g.strokeStyle = '#231f5c';
      g.stroke();
      g.lineWidth = 4.5 * u;
      g.strokeStyle = '#f5c95a';
      g.stroke();
    }
    return handImg;
  }

  function hammerTexture(): HTMLCanvasElement {
    if (!hammerImg) {
      // art.icon returns a fresh canvas at css size × its own dpr; ask for one about a cell wide.
      const css = Math.max(12, Math.round((cs / dpr) * 1.1));
      hammerImg = art.icon('hammer', css);
    }
    return hammerImg;
  }

  // ───────────────────────────── board model ─────────────────────────────

  function idx(c: number, r: number): number {
    return r * nCols + c;
  }

  function refreshSprite(vp: VPiece): void {
    vp.img = art.sprite(spriteKeyOf(vp.kind, vp.color, vp.hp), cs);
  }

  function makePiece(piece: Piece, c: number, r: number): VPiece {
    const vp: VPiece = {
      id: piece.id,
      kind: piece.kind,
      color: piece.color,
      hp: piece.hp,
      chained: piece.chained,
      x: c,
      y: r,
      ox: 0,
      oy: 0,
      sx: 1,
      sy: 1,
      rot: 0,
      alpha: 1,
      flash: 0,
      lift: false,
      clipTop: NO_CLIP,
      chainAlpha: piece.chained ? 1 : 0,
      dying: false,
      img: null,
    };
    refreshSprite(vp);
    return vp;
  }

  function setBoard(snapshot: Snapshot, isLampLevel: boolean): void {
    nCols = snapshot.cols;
    nRows = snapshot.rows;
    lampLevel = isLampLevel;
    const n = nCols * nRows;
    cellExists = new Uint8Array(n);
    cellSand = new Uint8Array(n);
    cellExit = new Uint8Array(n);
    grid = new Int32Array(n);
    spawnRows = new Int8Array(nCols);
    bottomRows = new Int8Array(nCols);
    list.length = 0;
    byId.clear();
    for (let c = 0; c < nCols; c++) {
      spawnRows[c] = 0;
      bottomRows[c] = nRows - 1;
      let foundSpawner = false;
      let foundTop = false;
      for (let r = 0; r < nRows; r++) {
        const cell = snapshot.cells[idx(c, r)];
        if (!cell || !cell.exists) continue;
        if (!foundTop) {
          foundTop = true;
          if (!foundSpawner) spawnRows[c] = r;
        }
        if (cell.spawner && !foundSpawner) {
          foundSpawner = true;
          spawnRows[c] = r;
        }
        bottomRows[c] = r;
      }
    }
    for (let i = 0; i < n; i++) {
      const cell = snapshot.cells[i];
      grid[i] = -1;
      if (!cell) continue;
      cellExists[i] = cell.exists ? 1 : 0;
      cellSand[i] = cell.sand;
      cellExit[i] = cell.exit ? 1 : 0;
      if (cell.exists && cell.piece) {
        const vp = makePiece(cell.piece, i % nCols, Math.floor(i / nCols));
        list.push(vp);
        byId.set(vp.id, vp);
        grid[i] = vp.id;
      }
    }
    floorDirty = true;
    needsDraw = true;
  }

  function reconcile(snapshot: Snapshot): string[] {
    const problems: string[] = [];
    const n = nCols * nRows;
    if (snapshot.cols !== nCols || snapshot.rows !== nRows) problems.push('board size');
    let alive = 0;
    for (let i = 0; i < list.length; i++) if (!(list[i] as VPiece).dying) alive++;
    let expected = 0;
    for (let i = 0; i < n && problems.length < 6; i++) {
      const cell = snapshot.cells[i];
      if (!cell) continue;
      const c = i % nCols;
      const r = Math.floor(i / nCols);
      if ((cellSand[i] as number) !== cell.sand) problems.push('sand at ' + c + ',' + r + ': shown ' + cellSand[i] + ', engine ' + cell.sand);
      const piece = cell.exists ? cell.piece : null;
      if (!piece) {
        if ((grid[i] as number) !== -1) problems.push('ghost piece ' + grid[i] + ' at ' + c + ',' + r);
        continue;
      }
      expected++;
      const vp = byId.get(piece.id);
      if (!vp || vp.dying) {
        problems.push('missing piece ' + piece.id + ' (' + piece.kind + ') at ' + c + ',' + r);
        continue;
      }
      if ((grid[i] as number) !== piece.id) problems.push('grid at ' + c + ',' + r + ': ' + grid[i] + ' ≠ ' + piece.id);
      if (vp.kind !== piece.kind || vp.color !== piece.color || vp.hp !== piece.hp || vp.chained !== piece.chained) {
        problems.push('piece ' + piece.id + ' differs: shown ' + vp.kind + '/' + vp.color + '/' + vp.hp + ', engine ' + piece.kind + '/' + piece.color + '/' + piece.hp);
      }
      if (Math.abs(vp.x - c) > 0.01 || Math.abs(vp.y - r) > 0.01) problems.push('piece ' + piece.id + ' drawn at ' + vp.x.toFixed(2) + ',' + vp.y.toFixed(2) + ' instead of ' + c + ',' + r);
    }
    if (problems.length === 0 && alive !== expected) problems.push('piece count: shown ' + alive + ', engine ' + expected);
    if (problems.length > 0) setBoard(snapshot, lampLevel);
    needsDraw = true;
    return problems;
  }

  function addPiece(piece: Piece, c: number, r: number): VPiece {
    const old = byId.get(piece.id);
    if (old) removePiece(old);
    const vp = makePiece(piece, c, r);
    list.push(vp);
    byId.set(vp.id, vp);
    needsDraw = true;
    return vp;
  }

  function morph(vp: VPiece, piece: Piece): void {
    vp.kind = piece.kind;
    vp.color = piece.color;
    vp.hp = piece.hp;
    vp.chained = piece.chained;
    vp.chainAlpha = piece.chained ? 1 : 0;
    refreshSprite(vp);
    needsDraw = true;
  }

  function removePiece(vp: VPiece): void {
    const at = list.indexOf(vp);
    if (at >= 0) {
      list[at] = list[list.length - 1] as VPiece;
      list.length--;
    }
    if (byId.get(vp.id) === vp) byId.delete(vp.id);
    needsDraw = true;
  }

  // ───────────────────────────── layout ─────────────────────────────

  function layout(stageW: number, stageH: number, pad: number, maxCell: number): void {
    let ratio = 1;
    try {
      ratio = window.devicePixelRatio || 1;
    } catch {
      ratio = 1;
    }
    dpr = cappedDpr(ratio, DPR_CAP);
    const w = Math.max(1, Math.round(stageW * dpr));
    const h = Math.max(1, Math.round(stageH * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    canvas.style.width = stageW + 'px';
    canvas.style.height = stageH + 'px';
    cw = w;
    ch = h;
    rect = fitBoard(stageW, stageH, Math.max(1, nCols), Math.max(1, nRows), pad, dpr, maxCell);
    const newCs = Math.max(1, Math.round(rect.cell * dpr));
    bx = Math.round(rect.x * dpr);
    by = Math.round(rect.y * dpr);
    if (newCs !== cs || glowTex.length === 0) {
      cs = newCs;
      resetTextures();
    }
    floorDirty = true;
    needsDraw = true;
  }

  function has(c: number, r: number): boolean {
    return c >= 0 && r >= 0 && c < nCols && r < nRows && cellExists[idx(c, r)] === 1;
  }

  /**
   * One cell's share of the board outline, grown by `grow` on its free sides only (so neighbours
   * join without a seam) and rounded only where two free sides meet.
   */
  function cellOutline(g: CanvasRenderingContext2D, m: number, c: number, r: number, grow: number, radius: number): void {
    const freeL = !has(c - 1, r);
    const freeR = !has(c + 1, r);
    const freeT = !has(c, r - 1);
    const freeB = !has(c, r + 1);
    const x0 = m + c * cs - (freeL ? grow : 1);
    const x1 = m + (c + 1) * cs + (freeR ? grow : 1);
    const y0 = m + r * cs - (freeT ? grow : 1);
    const y1 = m + (r + 1) * cs + (freeB ? grow : 1);
    const tl = freeL && freeT ? radius : 0;
    const tr = freeR && freeT ? radius : 0;
    const br = freeR && freeB ? radius : 0;
    const bl = freeL && freeB ? radius : 0;
    g.moveTo(x0 + tl, y0);
    g.lineTo(x1 - tr, y0);
    if (tr > 0) g.arcTo(x1, y0, x1, y0 + tr, tr);
    g.lineTo(x1, y1 - br);
    if (br > 0) g.arcTo(x1, y1, x1 - br, y1, br);
    g.lineTo(x0 + bl, y1);
    if (bl > 0) g.arcTo(x0, y1, x0, y1 - bl, bl);
    g.lineTo(x0, y0 + tl);
    if (tl > 0) g.arcTo(x0, y0, x0 + tl, y0, tl);
    g.closePath();
  }

  function outline(g: CanvasRenderingContext2D, m: number, grow: number, radius: number): void {
    g.beginPath();
    for (let r = 0; r < nRows; r++) {
      for (let c = 0; c < nCols; c++) {
        if (cellExists[idx(c, r)]) cellOutline(g, m, c, r, grow, radius);
      }
    }
  }

  /** Tiles, frame, exit markers and sand, drawn once and blitted every frame. */
  function renderFloor(): void {
    floorDirty = false;
    floorMargin = Math.ceil(cs * 0.34);
    const w = nCols * cs + floorMargin * 2;
    const h = nRows * cs + floorMargin * 2;
    if (!floor) floor = makeCanvas(w, h);
    if (floor.width !== w || floor.height !== h) {
      floor.width = w;
      floor.height = h;
    }
    const g = floor.getContext('2d') as CanvasRenderingContext2D;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, h);
    const m = floorMargin;
    const frame = Math.max(2.5, cs * 0.095);
    const line = Math.max(1, cs * 0.03);
    const radius = cs * 0.26;

    // 1. soft drop shadow + dark outline
    g.save();
    g.shadowColor = 'rgba(4,2,20,0.6)';
    g.shadowBlur = cs * 0.22;
    g.shadowOffsetY = cs * 0.09;
    g.fillStyle = '#0f0c30';
    outline(g, m, frame + line, radius + frame + line);
    g.fill();
    g.restore();

    // 2. gold frame
    const gold = g.createLinearGradient(0, m, 0, m + nRows * cs);
    gold.addColorStop(0, '#fff0bd');
    gold.addColorStop(0.28, '#f5c95a');
    gold.addColorStop(0.68, '#c9973a');
    gold.addColorStop(1, '#f3c556');
    g.fillStyle = gold;
    outline(g, m, frame, radius + frame);
    g.fill();
    // 3. dark inner line between frame and tiles
    g.fillStyle = '#17134a';
    outline(g, m, line * 1.2, radius + line * 1.2);
    g.fill();

    // 4. tiles, exit markers, sand — clipped to the rounded playfield
    g.save();
    outline(g, m, 0, radius);
    g.clip();
    const tileA = art.sprite('tileA', cs);
    const tileB = art.sprite('tileB', cs);
    const exit = lampLevel ? art.sprite('exit', cs) : null;
    const sand1 = art.sprite('sand1', cs);
    const sand2 = art.sprite('sand2', cs);
    for (let r = 0; r < nRows; r++) {
      for (let c = 0; c < nCols; c++) {
        const i = idx(c, r);
        if (!cellExists[i]) continue;
        const x = m + c * cs;
        const y = m + r * cs;
        g.drawImage((c + r) % 2 === 0 ? tileA : tileB, x, y, cs, cs);
        if (exit && cellExit[i]) g.drawImage(exit, x, y, cs, cs);
        const sand = cellSand[i] as number;
        if (sand >= 2) g.drawImage(sand2, x, y, cs, cs);
        else if (sand === 1) g.drawImage(sand1, x, y, cs, cs);
      }
    }
    g.restore();
  }

  // ───────────────────────────── effects ─────────────────────────────

  function burst(x: number, y: number, color: number, count: number, speed: number, shape: number, opts?: BurstOpts): void {
    const angle = opts && opts.angle !== undefined ? opts.angle : 0;
    const spread = opts && opts.spread !== undefined ? opts.spread : Math.PI * 2;
    const size = opts && opts.size !== undefined ? opts.size : 0.22;
    const life = opts && opts.life !== undefined ? opts.life : FEEDBACK.particleLife;
    const gravity = opts && opts.gravity !== undefined ? opts.gravity : 6;
    const additive = opts && opts.additive ? 1 : 0;
    const tex = (color >= 0 && color < PAL_SIZE ? color : PAL_WHITE) * SHAPE_COUNT + shape;
    particleTex(color, shape);
    for (let k = 0; k < count; k++) {
      if (pCount >= particleCap || pCount >= MAX_PARTICLES) return;
      const i = pCount++;
      const a = angle + (rnd() - 0.5) * spread;
      const v = speed * (0.45 + rnd() * 0.75);
      pX[i] = x + (rnd() - 0.5) * 0.18;
      pY[i] = y + (rnd() - 0.5) * 0.18;
      pVx[i] = Math.cos(a) * v;
      pVy[i] = Math.sin(a) * v - (gravity > 0 ? 0.8 : 0);
      pMax[i] = life * (0.6 + rnd() * 0.4);
      pLife[i] = pMax[i] as number;
      pSize[i] = size * (0.7 + rnd() * 0.6);
      pRot[i] = rnd() * 6.283;
      pVr[i] = (rnd() - 0.5) * 14;
      pGrav[i] = gravity;
      pTex[i] = tex;
      pAdd[i] = additive;
    }
  }

  function beam(x: number, y: number, horizontal: boolean, color: number, thick: number, sweep: number): void {
    const lo = horizontal ? x : y;
    const hi = horizontal ? nCols - x : nRows - y;
    beams.push({ x, y, horizontal, t: 0, sweep, dur: sweep + 160, color, thick, lo: lo + 0.3, hi: hi + 0.3, emit: 0 });
  }

  function ring(x: number, y: number, r0: number, r1: number, dur: number, color: number, alpha?: number, delay?: number): void {
    if (reduced && r1 > 3) return;
    rings.push({ x, y, t: 0, dur, r0, r1, color, alpha: alpha === undefined ? 1 : alpha, delay: delay || 0 });
  }

  function glow(x: number, y: number, s0: number, s1: number, dur: number, color: number, alpha?: number, delay?: number): void {
    glows.push({ x, y, t: 0, dur, delay: delay || 0, s0, s1, alpha: alpha === undefined ? 1 : alpha, color });
  }

  function ray(x0: number, y0: number, x1: number, y1: number, dur: number, delay: number, color: number): void {
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    // bend sideways, alternating, a little upward: an arc rather than a straight line
    const side = (rays.length & 1) === 0 ? 1 : -1;
    const bend = Math.min(1.6, 0.35 + len * 0.22) * side;
    rays.push({ x0, y0, x1, y1, cx: mx + (-dy / len) * bend, cy: my + (dx / len) * bend - 0.35, t: 0, dur, delay, color });
  }

  function popup(x: number, y: number, value: number, dur: number, fade: number, delay: number, big: boolean): void {
    const text = String(value);
    const fontPx = Math.max(11 * dpr, Math.round(cs * (big ? 0.56 : 0.42)));
    const padPx = Math.ceil(fontPx * 0.3);
    const font = '800 ' + fontPx + 'px ' + FONT;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = font;
    const tw = Math.ceil(ctx.measureText(text).width);
    ctx.restore();
    const img = makeCanvas(tw + padPx * 2, fontPx + padPx * 2);
    const g = img.getContext('2d') as CanvasRenderingContext2D;
    g.font = font;
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    g.lineJoin = 'round';
    g.lineWidth = Math.max(2, fontPx * 0.26);
    g.strokeStyle = '#231f5c';
    const tx = img.width / 2;
    const ty = img.height / 2 + fontPx * 0.06;
    g.strokeText(text, tx, ty);
    const grad = g.createLinearGradient(0, padPx, 0, padPx + fontPx);
    grad.addColorStop(0, '#fffbe6');
    grad.addColorStop(1, big ? '#ffc94a' : '#ffe7a3');
    g.fillStyle = grad;
    g.fillText(text, tx, ty);
    popups.push({ x, y, t: 0, dur, fade, delay, img, w: img.width / cs, h: img.height / cs });
  }

  function ghost(key: SpriteKey | 'hammer', x: number, y: number, dur: number, opts?: GhostOpts): void {
    const img = key === 'hammer' ? hammerTexture() : art.sprite(key, cs);
    const o = opts || {};
    ghosts.push({
      img,
      x,
      y,
      t: 0,
      dur,
      delay: o.delay || 0,
      s0: o.s0 === undefined ? 1 : o.s0,
      s1: o.s1 === undefined ? 1 : o.s1,
      a0: o.a0 === undefined ? 1 : o.a0,
      a1: o.a1 === undefined ? 0 : o.a1,
      r0: o.r0 || 0,
      r1: o.r1 || 0,
      dx: o.dx || 0,
      dy: o.dy || 0,
      additive: !!o.additive,
    });
  }

  function flash(alpha: number, dur: number): void {
    if (reduced) return;
    flashAlpha = alpha;
    flashT = 0;
    flashDur = dur;
  }

  function shake(px: number, dur: number): void {
    if (reduced) return;
    if (shakeT < shakeDur && shakeAmp * (1 - shakeT / shakeDur) > px) return;
    shakeAmp = px;
    shakeT = 0;
    shakeDur = dur;
  }

  function clearEffects(): void {
    beams.length = 0;
    rings.length = 0;
    rays.length = 0;
    popups.length = 0;
    ghosts.length = 0;
    glows.length = 0;
    pCount = 0;
    flashDur = 0;
    shakeDur = 0;
    shakeT = 0;
    needsDraw = true;
  }

  // ───────────────────────────── step ─────────────────────────────

  function step(dt: number): void {
    loopT += dt;
    const sec = dt / 1000;

    // particles
    let i = 0;
    while (i < pCount) {
      const life = (pLife[i] as number) - dt;
      if (life <= 0) {
        const last = --pCount;
        if (i !== last) {
          pX[i] = pX[last] as number;
          pY[i] = pY[last] as number;
          pVx[i] = pVx[last] as number;
          pVy[i] = pVy[last] as number;
          pLife[i] = pLife[last] as number;
          pMax[i] = pMax[last] as number;
          pSize[i] = pSize[last] as number;
          pRot[i] = pRot[last] as number;
          pVr[i] = pVr[last] as number;
          pGrav[i] = pGrav[last] as number;
          pTex[i] = pTex[last] as number;
          pAdd[i] = pAdd[last] as number;
        }
        continue;
      }
      pLife[i] = life;
      pVy[i] = (pVy[i] as number) + (pGrav[i] as number) * sec;
      pX[i] = (pX[i] as number) + (pVx[i] as number) * sec;
      pY[i] = (pY[i] as number) + (pVy[i] as number) * sec;
      pRot[i] = (pRot[i] as number) + (pVr[i] as number) * sec;
      i++;
    }

    // beams (also shed sparks behind their heads)
    for (let k = beams.length - 1; k >= 0; k--) {
      const b = beams[k] as BeamFx;
      b.t += dt;
      if (b.t >= b.dur) {
        beams[k] = beams[beams.length - 1] as BeamFx;
        beams.length--;
        continue;
      }
      if (b.t < b.sweep) {
        b.emit += dt;
        while (b.emit >= 14) {
          b.emit -= 14;
          const p = b.t / b.sweep;
          const lo = -b.lo * p;
          const hi = b.hi * p;
          for (let side = 0; side < 2; side++) {
            const d = side === 0 ? lo : hi;
            const hx = b.horizontal ? b.x + d : b.x;
            const hy = b.horizontal ? b.y : b.y + d;
            sparkOpts.angle = b.horizontal ? Math.PI / 2 : 0;
            burst(hx, hy, rnd() < 0.5 ? PAL_GOLD : b.color, 1, 2.2, rnd() < 0.5 ? SHAPE_SPARK : SHAPE_DOT, sparkOpts);
            if (rnd() < 0.5) {
              sparkOpts.angle = b.horizontal ? -Math.PI / 2 : Math.PI;
              burst(hx, hy, PAL_WHITE, 1, 2.2, SHAPE_SPARK, sparkOpts);
            }
          }
        }
      }
    }
    for (let k = rings.length - 1; k >= 0; k--) {
      const r = rings[k] as RingFx;
      r.t += dt;
      if (r.t - r.delay >= r.dur) {
        rings[k] = rings[rings.length - 1] as RingFx;
        rings.length--;
      }
    }
    for (let k = glows.length - 1; k >= 0; k--) {
      const g = glows[k] as GlowFx;
      g.t += dt;
      if (g.t - g.delay >= g.dur) {
        glows[k] = glows[glows.length - 1] as GlowFx;
        glows.length--;
      }
    }
    for (let k = rays.length - 1; k >= 0; k--) {
      const r = rays[k] as RayFx;
      r.t += dt;
      if (r.t - r.delay >= r.dur + 90) {
        rays[k] = rays[rays.length - 1] as RayFx;
        rays.length--;
      }
    }
    for (let k = popups.length - 1; k >= 0; k--) {
      const p = popups[k] as PopupFx;
      p.t += dt;
      if (p.t - p.delay >= p.dur) {
        popups.splice(k, 1);
      }
    }
    for (let k = ghosts.length - 1; k >= 0; k--) {
      const g = ghosts[k] as GhostFx;
      g.t += dt;
      if (g.t - g.delay >= g.dur) {
        ghosts.splice(k, 1);
      }
    }
    if (flashT < flashDur) flashT += dt;
    if (shakeT < shakeDur) shakeT += dt;
  }

  function animating(): boolean {
    return (
      pCount > 0 ||
      beams.length > 0 ||
      rings.length > 0 ||
      rays.length > 0 ||
      popups.length > 0 ||
      ghosts.length > 0 ||
      glows.length > 0 ||
      flashT < flashDur ||
      shakeT < shakeDur ||
      selC >= 0 ||
      hintAC >= 0 ||
      handAC >= 0 ||
      targeting
    );
  }

  // ───────────────────────────── draw ─────────────────────────────

  let offX = 0;
  let offY = 0;

  function drawPiece(p: VPiece): void {
    const img = p.img;
    if (!img || p.alpha <= 0.01 || p.sx <= 0.01 || p.sy <= 0.01) return;
    const w = cs * p.sx;
    const h = cs * p.sy;
    const cx = bx + (p.x + p.ox + 0.5) * cs;
    const cy = by + (p.y + p.oy + 0.5) * cs;
    ctx.globalAlpha = p.alpha > 1 ? 1 : p.alpha;
    if (p.clipTop !== NO_CLIP) {
      const top = by + p.clipTop * cs;
      const y0 = cy - h / 2;
      if (y0 + h <= top) return;
      if (y0 < top) {
        const cut = top - y0;
        const srcCut = (cut / h) * img.height;
        ctx.drawImage(img, 0, srcCut, img.width, img.height - srcCut, cx - w / 2, top, w, h - cut);
        return;
      }
    }
    if (p.rot !== 0) {
      const cos = Math.cos(p.rot);
      const sin = Math.sin(p.rot);
      ctx.setTransform(cos, sin, -sin, cos, cx + offX, cy + offY);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      if (p.chainAlpha > 0.01 && chainImg) {
        ctx.globalAlpha = p.alpha * p.chainAlpha;
        ctx.drawImage(chainImg, -w / 2, -h / 2, w, h);
      }
      ctx.setTransform(1, 0, 0, 1, offX, offY);
    } else {
      ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
      if (p.chainAlpha > 0.01 && chainImg) {
        ctx.globalAlpha = p.alpha * p.chainAlpha;
        ctx.drawImage(chainImg, cx - w / 2, cy - h / 2, w, h);
      }
    }
    if (p.flash > 0.01) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = p.flash > 1 ? 1 : p.flash;
      ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function draw(): void {
    needsDraw = false;
    if (nCols === 0 || cw === 0) return;
    if (floorDirty) renderFloor();

    offX = 0;
    offY = 0;
    if (shakeT < shakeDur) {
      const k = 1 - shakeT / shakeDur;
      const a = shakeAmp * k * dpr;
      offX = Math.round(Math.sin(shakeT * 0.085) * a);
      offY = Math.round(Math.cos(shakeT * 0.11 + 1.3) * a * 0.8);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, cw, ch);
    ctx.setTransform(1, 0, 0, 1, offX, offY);

    if (floor) ctx.drawImage(floor, bx - floorMargin, by - floorMargin);

    // targeting: a breathing gold veil over the board
    if (targeting) {
      ctx.globalAlpha = 0.1 + 0.07 * Math.sin(loopT * 0.006);
      ctx.fillStyle = '#ffe7a3';
      for (let i = 0; i < cellExists.length; i++) {
        if (cellExists[i] === 1) ctx.fillRect(bx + (i % nCols) * cs, by + Math.floor(i / nCols) * cs, cs, cs);
      }
      ctx.globalAlpha = 1;
    }

    // hint halos under the pieces
    if (hintAC >= 0 && hintImg) {
      const pulse = 0.65 + 0.35 * Math.sin(loopT * 0.012);
      ctx.globalAlpha = pulse;
      const s = cs * (1.04 + 0.05 * Math.sin(loopT * 0.012));
      ctx.drawImage(hintImg, bx + (hintAC + 0.5) * cs - s / 2, by + (hintAR + 0.5) * cs - s / 2, s, s);
      ctx.drawImage(hintImg, bx + (hintBC + 0.5) * cs - s / 2, by + (hintBR + 0.5) * cs - s / 2, s, s);
    }

    // pieces: resting ones first, lifted ones on top
    const n = list.length;
    let lifted = 0;
    for (let i = 0; i < n; i++) {
      const p = list[i] as VPiece;
      if (p.lift) {
        lifted++;
        continue;
      }
      drawPiece(p);
    }
    if (lifted > 0) {
      for (let i = 0; i < n; i++) {
        const p = list[i] as VPiece;
        if (p.lift) drawPiece(p);
      }
    }
    ctx.globalAlpha = 1;

    // selection ring
    if (selC >= 0 && selectImg) {
      const s = cs * (1.06 + 0.045 * Math.sin(loopT * 0.009));
      ctx.globalAlpha = 1;
      ctx.drawImage(selectImg, bx + (selC + 0.5) * cs - s / 2, by + (selR + 0.5) * cs - s / 2, s, s);
    }

    // dim (lost)
    if (dim > 0.005) {
      ctx.globalAlpha = dim;
      ctx.fillStyle = '#0a0828';
      ctx.fillRect(-offX, -offY, cw, ch);
      ctx.globalAlpha = 1;
    }

    // ── additive light ──
    ctx.globalCompositeOperation = 'lighter';

    for (let k = 0; k < glows.length; k++) {
      const g = glows[k] as GlowFx;
      const t = g.t - g.delay;
      if (t < 0) continue;
      const p = t / g.dur;
      const s = (g.s0 + (g.s1 - g.s0) * (1 - (1 - p) * (1 - p))) * cs;
      ctx.globalAlpha = g.alpha * (1 - p * p);
      ctx.drawImage(glowOf(g.color), bx + g.x * cs - s / 2, by + g.y * cs - s / 2, s, s);
    }

    for (let k = 0; k < beams.length; k++) {
      const b = beams[k] as BeamFx;
      const p = b.t < b.sweep ? b.t / b.sweep : 1;
      const e = 1 - (1 - p) * (1 - p);
      const fade = b.t < b.sweep ? 1 : 1 - (b.t - b.sweep) / (b.dur - b.sweep);
      const lo = b.lo * e;
      const hi = b.hi * e;
      const thick = b.thick * cs * (0.75 + 0.25 * fade) * (b.t < 60 ? 0.4 + (b.t / 60) * 0.6 : 1);
      const tex = streakOf(b.color);
      const cxp = bx + b.x * cs;
      const cyp = by + b.y * cs;
      ctx.globalAlpha = fade;
      if (b.horizontal) {
        ctx.drawImage(tex, cxp - lo * cs, cyp - thick / 2, (lo + hi) * cs, thick);
      } else {
        ctx.setTransform(0, 1, -1, 0, cxp + offX, cyp + offY);
        ctx.drawImage(tex, -lo * cs, -thick / 2, (lo + hi) * cs, thick);
        ctx.setTransform(1, 0, 0, 1, offX, offY);
      }
      if (b.t < b.sweep) {
        // the two racing heads
        const head = glowOf(PAL_WHITE);
        const hs = cs * (1.5 + b.thick * 0.5);
        ctx.globalAlpha = 1;
        if (b.horizontal) {
          ctx.drawImage(head, cxp - lo * cs - hs / 2, cyp - hs / 2, hs, hs);
          ctx.drawImage(head, cxp + hi * cs - hs / 2, cyp - hs / 2, hs, hs);
        } else {
          ctx.drawImage(head, cxp - hs / 2, cyp - lo * cs - hs / 2, hs, hs);
          ctx.drawImage(head, cxp - hs / 2, cyp + hi * cs - hs / 2, hs, hs);
        }
      }
    }

    if (rings.length > 0) {
      const tex = ringTexture();
      for (let k = 0; k < rings.length; k++) {
        const r = rings[k] as RingFx;
        const t = r.t - r.delay;
        if (t < 0) continue;
        const p = t / r.dur;
        const e = 1 - (1 - p) * (1 - p) * (1 - p);
        const rad = (r.r0 + (r.r1 - r.r0) * e) * cs;
        ctx.globalAlpha = r.alpha * (1 - p) * (1 - p * 0.4);
        ctx.drawImage(tex, bx + r.x * cs - rad, by + r.y * cs - rad, rad * 2, rad * 2);
        if (r.color !== PAL_WHITE) {
          const halo = glowOf(r.color);
          ctx.globalAlpha = r.alpha * (1 - p) * 0.5;
          ctx.drawImage(halo, bx + r.x * cs - rad * 1.1, by + r.y * cs - rad * 1.1, rad * 2.2, rad * 2.2);
        }
      }
    }

    for (let k = 0; k < rays.length; k++) {
      const r = rays[k] as RayFx;
      const t = r.t - r.delay;
      if (t < 0) continue;
      const head = t >= r.dur ? 1 : t / r.dur;
      const tailFade = t >= r.dur ? 1 - (t - r.dur) / 90 : 1;
      const tex = glowOf(r.color);
      for (let s = 0; s < 9; s++) {
        const q = head - s * 0.045;
        if (q < 0) break;
        const u = 1 - q;
        const x = u * u * r.x0 + 2 * u * q * r.cx + q * q * r.x1;
        const y = u * u * r.y0 + 2 * u * q * r.cy + q * q * r.y1;
        const size = cs * (0.72 - s * 0.055);
        ctx.globalAlpha = (1 - s / 9) * tailFade;
        ctx.drawImage(tex, bx + x * cs - size / 2, by + y * cs - size / 2, size, size);
      }
    }

    if (flashT < flashDur) {
      ctx.globalAlpha = flashAlpha * (1 - flashT / flashDur);
      ctx.fillStyle = '#fff6dc';
      for (let i = 0; i < cellExists.length; i++) {
        if (cellExists[i] === 1) ctx.fillRect(bx + (i % nCols) * cs, by + Math.floor(i / nCols) * cs, cs, cs);
      }
    }

    // ── particles ──
    let additive = true;
    for (let i = 0; i < pCount; i++) {
      const tex = partTex[pTex[i] as number];
      if (!tex) continue;
      const wantAdd = pAdd[i] === 1;
      if (wantAdd !== additive) {
        additive = wantAdd;
        ctx.globalCompositeOperation = additive ? 'lighter' : 'source-over';
      }
      const k = (pLife[i] as number) / (pMax[i] as number);
      const size = (pSize[i] as number) * cs * (0.5 + 0.5 * k);
      ctx.globalAlpha = k < 0.5 ? k * 2 : 1;
      const cos = Math.cos(pRot[i] as number);
      const sin = Math.sin(pRot[i] as number);
      ctx.setTransform(cos, sin, -sin, cos, bx + (pX[i] as number) * cs + offX, by + (pY[i] as number) * cs + offY);
      ctx.drawImage(tex, -size / 2, -size / 2, size, size);
    }
    ctx.setTransform(1, 0, 0, 1, offX, offY);
    ctx.globalCompositeOperation = 'source-over';

    // ── sprite ghosts (sand fading, chain snapping, the hammer) ──
    for (let k = 0; k < ghosts.length; k++) {
      const g = ghosts[k] as GhostFx;
      const t = g.t - g.delay;
      if (t < 0) continue;
      const p = t / g.dur;
      const s = (g.s0 + (g.s1 - g.s0) * p) * cs;
      const rot = g.r0 + (g.r1 - g.r0) * p;
      ctx.globalAlpha = Math.max(0, g.a0 + (g.a1 - g.a0) * p);
      if (g.additive) ctx.globalCompositeOperation = 'lighter';
      const x = bx + (g.x + g.dx * p) * cs;
      const y = by + (g.y + g.dy * p) * cs;
      if (rot !== 0) {
        const cos = Math.cos(rot);
        const sin = Math.sin(rot);
        ctx.setTransform(cos, sin, -sin, cos, x + offX, y + offY);
        ctx.drawImage(g.img, -s / 2, -s / 2, s, s);
        ctx.setTransform(1, 0, 0, 1, offX, offY);
      } else {
        ctx.drawImage(g.img, x - s / 2, y - s / 2, s, s);
      }
      if (g.additive) ctx.globalCompositeOperation = 'source-over';
    }

    // ── score popups ──
    for (let k = 0; k < popups.length; k++) {
      const p = popups[k] as PopupFx;
      const t = p.t - p.delay;
      if (t < 0) continue;
      const q = t / p.dur;
      const rise = 0.5 * (1 - (1 - q) * (1 - q));
      const popIn = t < 110 ? 0.5 + (t / 110) * 0.7 : t < 190 ? 1.2 - ((t - 110) / 80) * 0.2 : 1;
      const left = p.dur - t;
      ctx.globalAlpha = left < p.fade ? left / p.fade : 1;
      const w = p.w * cs * popIn;
      const h = p.h * cs * popIn;
      ctx.drawImage(p.img, bx + p.x * cs - w / 2, by + (p.y - rise) * cs - h / 2, w, h);
    }
    ctx.globalAlpha = 1;

    // ── tutorial hand ──
    if (handAC >= 0) {
      const period = 1500;
      const t = (loopT % period) / period;
      // rest on a, glide to b, hold, fade
      const move = t < 0.22 ? 0 : t < 0.62 ? (t - 0.22) / 0.4 : 1;
      const e = move < 0.5 ? 2 * move * move : 1 - Math.pow(-2 * move + 2, 2) / 2;
      const alpha = t < 0.1 ? t / 0.1 : t > 0.86 ? (1 - t) / 0.14 : 1;
      const press = t < 0.22 ? 1 - (t / 0.22) * 0.12 : 0.88;
      const hx = handAC + (handBC - handAC) * e + 0.5;
      const hy = handAR + (handBR - handAR) * e + 0.5;
      const img = handTexture();
      const s = img.width * press;
      ctx.globalAlpha = alpha;
      // the fingertip (22 %, 8 % of the texture) touches the piece centre
      ctx.drawImage(img, bx + hx * cs - s * 0.22, by + hy * cs - s * 0.08, s, s);
      ctx.globalAlpha = 1;
    }
  }

  return {
    canvas,
    setBoard,
    layout,
    rect: () => rect,
    cols: () => nCols,
    rows: () => nRows,
    exists: (c, r) => c >= 0 && r >= 0 && c < nCols && r < nRows && cellExists[idx(c, r)] === 1,
    spawnRow: (c) => (c >= 0 && c < nCols ? (spawnRows[c] as number) : 0),
    bottomRow: (c) => (c >= 0 && c < nCols ? (bottomRows[c] as number) : nRows - 1),
    sandAt: (c, r) => cellSand[idx(c, r)] || 0,
    setSand(c, r, layers) {
      cellSand[idx(c, r)] = layers;
      floorDirty = true;
      needsDraw = true;
    },
    pieces: () => list,
    piece: (id) => byId.get(id) || null,
    idAt: (c, r) => (c >= 0 && r >= 0 && c < nCols && r < nRows ? (grid[idx(c, r)] as number) : -1),
    pieceAt(c, r) {
      if (c < 0 || r < 0 || c >= nCols || r >= nRows) return null;
      const id = grid[idx(c, r)] as number;
      return id === -1 ? null : byId.get(id) || null;
    },
    setGrid(c, r, id) {
      grid[idx(c, r)] = id;
    },
    addPiece,
    morph,
    refreshSprite,
    removePiece,
    reconcile,
    reset(snapshot) {
      setBoard(snapshot, lampLevel);
    },
    burst,
    beam,
    ring,
    glow,
    ray,
    popup,
    ghost,
    flash,
    shake,
    setDim(alpha) {
      if (dim !== alpha) {
        dim = alpha;
        needsDraw = true;
      }
    },
    setSelection(pos) {
      selC = pos ? pos.c : -1;
      selR = pos ? pos.r : -1;
      needsDraw = true;
    },
    setHintCells(a, b) {
      hintAC = a && b ? a.c : -1;
      hintAR = a && b ? a.r : -1;
      hintBC = a && b ? b.c : -1;
      hintBR = a && b ? b.r : -1;
      needsDraw = true;
    },
    setHand(a, b) {
      handAC = a && b ? a.c : -1;
      handAR = a && b ? a.r : -1;
      handBC = a && b ? b.c : -1;
      handBR = a && b ? b.r : -1;
      needsDraw = true;
    },
    setTargeting(on) {
      targeting = on;
      needsDraw = true;
    },
    setReducedEffects(on) {
      reduced = on;
    },
    setLowEnd(on) {
      particleCap = on ? FEEDBACK.maxParticlesLow : FEEDBACK.maxParticles;
    },
    step,
    draw,
    animating,
    invalidate() {
      needsDraw = true;
    },
    dirty: () => needsDraw,
    clearEffects,
    particleCount: () => pCount,
  };
}
