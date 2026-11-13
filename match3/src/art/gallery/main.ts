/**
 * Dev-only art gallery (gallery.html). Shows every sprite, icon, backdrop and the logo so the
 * artwork can be reviewed and screenshotted (tools/art-shots.cjs). Not imported by the game.
 */
import '@fontsource-variable/baloo-bhaijaan-2/index.css';
import { ICON_KEYS, SPRITE_KEYS, createArt } from '../index.ts';
import type { ChapterTheme, SpriteKey } from '../types.ts';

const art = createArt();
const root = document.getElementById('root') as HTMLElement;
const DPR = Math.min(3, window.devicePixelRatio || 1);
const THEMES: ChapterTheme[] = ['oasis', 'dunes', 'bazaar', 'palace', 'caverns', 'stars'];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function section(shot: string, title: string, bare: boolean = false): HTMLElement {
  root.appendChild(el('h2', '', title));
  const s = el('section', bare ? 'bare' : '');
  s.setAttribute('data-shot', shot);
  root.appendChild(s);
  return s;
}

/** Canvas of w×h DEVICE pixels shown 1:1 on screen (optionally magnified with nearest-neighbour). */
function deviceCanvas(w: number, h: number, zoom: number = 1): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.style.width = (w * zoom) / DPR + 'px';
  c.style.height = (h * zoom) / DPR + 'px';
  if (zoom !== 1) c.className = 'px';
  return c;
}

function ctxOf(c: HTMLCanvasElement): CanvasRenderingContext2D {
  return c.getContext('2d') as CanvasRenderingContext2D;
}

// ───────────────────────────── (a) gems & specials ─────────────────────────────

const GEM_ROWS: SpriteKey[][] = [
  ['gem0', 'gem1', 'gem2', 'gem3', 'gem4', 'gem5', 'prism'],
  ['beamH0', 'beamH1', 'beamH2', 'beamH3', 'beamH4', 'beamH5', 'lamp'],
  ['beamV0', 'beamV1', 'beamV2', 'beamV3', 'beamV4', 'beamV5', 'vine'],
  ['nova0', 'nova1', 'nova2', 'nova3', 'nova4', 'nova5', 'stone3'],
];

function gemSheet(px: number, zoom: number, rows: SpriteKey[][] = GEM_ROWS): HTMLCanvasElement {
  const cols = rows[0].length;
  const c = deviceCanvas(cols * px, rows.length * px, zoom);
  const g = ctxOf(c);
  for (let r = 0; r < rows.length; r++) {
    for (let i = 0; i < cols; i++) {
      g.drawImage(art.sprite((r + i) % 2 === 0 ? 'tileA' : 'tileB', px), i * px, r * px);
      g.drawImage(art.sprite(rows[r][i], px), i * px, r * px);
    }
  }
  return c;
}

function gems(): void {
  const sizes = [36, 48, 64, 96];
  for (let i = 0; i < sizes.length; i++) {
    const s = section('gems-' + sizes[i], 'Gems & specials at ' + sizes[i] + ' px (device pixels, 1:1)');
    s.appendChild(gemSheet(sizes[i], 1));
  }
  const z36 = section('gems-36-zoom', 'Gems & specials at 36 px, magnified ×4');
  z36.appendChild(gemSheet(36, 4));
  const z40 = section('gems-40-zoom', 'Gems & specials at 40 px, magnified ×4');
  z40.appendChild(gemSheet(40, 4));
  const big = section('gems-160', 'Gems at 160 px (detail)');
  big.appendChild(gemSheet(160, 1, [GEM_ROWS[0]]));
  const big2 = section('specials-160', 'Specials at 160 px (detail)');
  big2.appendChild(gemSheet(160, 1, [['beamH0', 'beamV3', 'nova1', 'nova5', 'beamH5', 'nova4', 'beamV2']]));
  const grey = section('gems-grey', 'Greyscale check: silhouettes must still differ (48 px ×3, 96 px)');
  const a = gemSheet(48, 3, [GEM_ROWS[0]]);
  a.className += ' grey';
  grey.appendChild(a);
  const b = gemSheet(96, 1, GEM_ROWS);
  b.className += ' grey';
  b.style.marginTop = '8px';
  grey.appendChild(b);

  const cvd = section('gems-cvd', 'Colour-vision check (simulated): normal / protan / deutan, 64 px');
  const modes = ['', 'protan', 'deutan'];
  for (let i = 0; i < modes.length; i++) {
    const c = gemSheet(64, 1.5, [GEM_ROWS[0]]);
    c.className = modes[i];
    c.style.marginBottom = '6px';
    cvd.appendChild(c);
  }
}

// ───────────────────────────── (b) mock board ─────────────────────────────

const BOARD_PIECES = [
  'gem0 gem1 gem2 gem3 gem4 gem5 prism lamp',
  'beamH0 beamV1 nova2 gem3 beamH4 beamV5 gem0 gem1',
  'gem2 stone3 stone2 stone1 gem4 vine vine gem5',
  'nova3 gem4 gem5* gem0* gem1 vine gem2 beamH3',
  'gem5 gem0 gem1 nova4 beamV2 gem3 gem4* gem5',
  'gem1 gem2* gem3 gem4 gem5 nova0 gem1 beamV3',
  'gem0 lamp gem2 nova5 gem0 gem1 nova1 gem2',
  'gem3 gem4 lamp gem5 beamH1 gem2 gem3 gem4',
];
const BOARD_SAND = ['00000000', '00000000', '00000000', '00012000', '00112200', '01122110', '11222211', '22221111'];

function drawBoard(g: CanvasRenderingContext2D, x0: number, y0: number, cell: number, frame: string): void {
  const n = 8;
  const pad = Math.round(cell * 0.09);
  const size = n * cell;
  // panel + thin gold frame
  const r = cell * 0.26;
  const px = x0 - pad;
  const py = y0 - pad;
  const ps = size + pad * 2;
  g.save();
  g.beginPath();
  g.moveTo(px + r, py);
  g.arcTo(px + ps, py, px + ps, py + ps, r);
  g.arcTo(px + ps, py + ps, px, py + ps, r);
  g.arcTo(px, py + ps, px, py, r);
  g.arcTo(px, py, px + ps, py, r);
  g.closePath();
  g.shadowColor = 'rgba(5,3,26,0.6)';
  g.shadowBlur = cell * 0.3;
  g.shadowOffsetY = cell * 0.08;
  g.fillStyle = '#17143f';
  g.fill();
  g.shadowColor = 'transparent';
  g.lineWidth = Math.max(2, cell * 0.045);
  g.strokeStyle = frame;
  g.stroke();
  g.restore();

  for (let row = 0; row < n; row++) {
    const cells = BOARD_PIECES[row].split(' ');
    for (let col = 0; col < n; col++) {
      const x = x0 + col * cell;
      const y = y0 + row * cell;
      g.drawImage(art.sprite((row + col) % 2 === 0 ? 'tileA' : 'tileB', cell), x, y);
      const sand = BOARD_SAND[row].charAt(col);
      if (sand === '1') g.drawImage(art.sprite('sand1', cell), x, y);
      if (sand === '2') g.drawImage(art.sprite('sand2', cell), x, y);
      if (row === n - 1) g.drawImage(art.sprite('exit', cell), x, y);
      if (row === 4 && (col === 0 || col === 1)) g.drawImage(art.sprite('hint', cell), x, y);
      let key = cells[col];
      const chained = key.charAt(key.length - 1) === '*';
      if (chained) key = key.slice(0, -1);
      g.drawImage(art.sprite(key as SpriteKey, cell), x, y);
      if (chained) g.drawImage(art.sprite('chain', cell), x, y);
      if (row === 1 && col === 3) g.drawImage(art.sprite('select', cell), x, y);
    }
  }
}

function board(): void {
  const cell = 92;
  const s = section('board', 'Mock board (cell ' + cell + ' px)');
  const c = deviceCanvas(8 * cell + 40, 8 * cell + 40);
  drawBoard(ctxOf(c), 20, 20, cell, art.palette('oasis').frame);
  s.appendChild(c);

  const small = section('board-small', 'Mock board at a small-phone cell size (40 px, 1:1 and ×2)');
  const row = el('div', 'row');
  const c2 = deviceCanvas(8 * 40 + 20, 8 * 40 + 20);
  drawBoard(ctxOf(c2), 10, 10, 40, art.palette('oasis').frame);
  row.appendChild(c2);
  const c3 = deviceCanvas(8 * 40 + 20, 8 * 40 + 20, 2);
  drawBoard(ctxOf(c3), 10, 10, 40, art.palette('oasis').frame);
  row.appendChild(c3);
  small.appendChild(row);

  // blockers & board furniture, large
  const det = section('blockers', 'Blockers and board furniture at 128 px (on tiles, with a gem where it belongs)');
  const keys: (SpriteKey | string)[] = ['stone3', 'stone2', 'stone1', 'vine', 'lamp', 'gem2+chain', 'sand1', 'sand2', 'sand1+gem1', 'sand2+gem5', 'exit', 'exit+gem3', 'select+gem0', 'hint+gem4', 'tileA', 'tileB'];
  const P = 128;
  const perRow = 8;
  const dc = deviceCanvas(perRow * P, Math.ceil(keys.length / perRow) * P);
  const g = ctxOf(dc);
  for (let i = 0; i < keys.length; i++) {
    const x = (i % perRow) * P;
    const y = Math.floor(i / perRow) * P;
    g.drawImage(art.sprite((i + Math.floor(i / perRow)) % 2 === 0 ? 'tileA' : 'tileB', P), x, y);
    const parts = keys[i].split('+');
    // floor overlays first, then the piece, then overlays that sit on top
    const order = ['sand1', 'sand2', 'exit'];
    const top = ['chain', 'select'];
    for (let k = 0; k < parts.length; k++) if (order.indexOf(parts[k]) >= 0) g.drawImage(art.sprite(parts[k] as SpriteKey, P), x, y);
    for (let k = 0; k < parts.length; k++) if (parts[k] === 'hint') g.drawImage(art.sprite('hint', P), x, y);
    for (let k = 0; k < parts.length; k++) {
      const p = parts[k];
      if (order.indexOf(p) < 0 && top.indexOf(p) < 0 && p !== 'hint' && p !== 'tileA' && p !== 'tileB') g.drawImage(art.sprite(p as SpriteKey, P), x, y);
    }
    for (let k = 0; k < parts.length; k++) if (top.indexOf(parts[k]) >= 0) g.drawImage(art.sprite(parts[k] as SpriteKey, P), x, y);
  }
  det.appendChild(dc);
}

// ───────────────────────────── (c) icons ─────────────────────────────

function icons(): void {
  const sizes = [20, 28, 40];
  const s = section('icons', 'Icons at 20 / 28 / 40 CSS px on the indigo UI background');
  for (let k = 0; k < sizes.length; k++) {
    const wrap = el('div', 'ui');
    wrap.style.marginBottom = '8px';
    const grid = el('div', 'icons');
    grid.style.gridTemplateColumns = 'repeat(' + (sizes[k] >= 40 ? 12 : 16) + ', auto)';
    for (let i = 0; i < ICON_KEYS.length; i++) {
      const cell = el('div', 'cell');
      cell.appendChild(art.icon(ICON_KEYS[i], sizes[k]));
      if (sizes[k] >= 40) cell.appendChild(el('span', '', ICON_KEYS[i]));
      grid.appendChild(cell);
    }
    wrap.appendChild(grid);
    s.appendChild(wrap);
  }

  const s2 = section('icons-zoom', 'Icons at 20 CSS px, magnified ×3 (pixel check)');
  const wrap2 = el('div', 'ui');
  const grid2 = el('div', 'icons');
  grid2.style.gridTemplateColumns = 'repeat(12, auto)';
  for (let i = 0; i < ICON_KEYS.length; i++) {
    const src = art.icon(ICON_KEYS[i], 20);
    src.style.width = '60px';
    src.style.height = '60px';
    src.className = 'px';
    grid2.appendChild(src);
  }
  wrap2.appendChild(grid2);
  s2.appendChild(wrap2);

  const s3 = section('icons-surfaces', 'Icons at 28 CSS px on a gold button, a violet panel and night (via iconUrl <img>)');
  const bgs = ['gold', 'violet', ''];
  for (let b = 0; b < bgs.length; b++) {
    const wrap = el('div', bgs[b]);
    wrap.style.marginBottom = '8px';
    if (!bgs[b]) wrap.style.padding = '8px';
    const grid = el('div', 'icons');
    grid.style.gridTemplateColumns = 'repeat(16, auto)';
    for (let i = 0; i < ICON_KEYS.length; i++) {
      const img = el('img');
      img.src = art.iconUrl(ICON_KEYS[i], 28);
      img.width = 28;
      img.height = 28;
      grid.appendChild(img);
    }
    wrap.appendChild(grid);
    s3.appendChild(wrap);
  }

  const s4 = section('icons-sprites', 'Sprites used as icons: icon(spriteKey, 32)');
  const wrap4 = el('div', 'ui');
  const grid4 = el('div', 'icons');
  grid4.style.gridTemplateColumns = 'repeat(19, auto)';
  for (let i = 0; i < SPRITE_KEYS.length; i++) grid4.appendChild(art.icon(SPRITE_KEYS[i], 32));
  wrap4.appendChild(grid4);
  s4.appendChild(wrap4);
}

// ───────────────────────────── (d) backdrops ─────────────────────────────

const timings: Record<string, number> = {};

function backdropCanvas(theme: ChapterTheme, cssW: number, cssH: number): HTMLCanvasElement {
  const c = deviceCanvas(Math.round(cssW * DPR), Math.round(cssH * DPR));
  art.paintBackdrop(ctxOf(c), theme, c.width, c.height);
  return c;
}

function backdrops(): void {
  const W = 412;
  const H = 915;
  for (let i = 0; i < THEMES.length; i++) {
    const s = section('backdrop-' + THEMES[i], 'Backdrop: ' + THEMES[i] + ' (412×915)', true);
    s.appendChild(backdropCanvas(THEMES[i], W, H));
  }
  // contact sheet
  const sheet = section('backdrops', 'All six backdrops side by side', true);
  const row = el('div', 'row');
  row.style.flexWrap = 'nowrap';
  for (let i = 0; i < THEMES.length; i++) {
    const c = backdropCanvas(THEMES[i], W, H);
    c.style.width = W / 2 + 'px';
    c.style.height = H / 2 + 'px';
    c.style.marginRight = '4px';
    c.style.marginBottom = '0';
    row.appendChild(c);
  }
  sheet.appendChild(row);

  // phone mock: backdrop + board + a hint of HUD, for every theme
  const mock = section('phone', 'Phone mock (412×915): board composited on each backdrop', true);
  const mrow = el('div', 'row');
  mrow.style.flexWrap = 'nowrap';
  for (let i = 0; i < THEMES.length; i++) {
    const c = backdropCanvas(THEMES[i], W, H);
    const g = ctxOf(c);
    const cell = Math.floor(((W - 24) * DPR) / 8);
    const bx = Math.round((c.width - cell * 8) / 2);
    const by = Math.round(c.height * 0.3);
    drawBoard(g, bx, by, cell, art.palette(THEMES[i]).frame);
    // HUD placeholders: a row of icons so the scale relationship is visible
    const hud: ('heart' | 'coin' | 'moves' | 'star' | 'pause')[] = ['heart', 'coin', 'moves', 'star', 'pause'];
    for (let k = 0; k < hud.length; k++) g.drawImage(art.icon(hud[k], 30), Math.round((20 + k * 76) * DPR), Math.round(54 * DPR));
    const boosters: ('hammer' | 'freeSwap' | 'shuffle')[] = ['hammer', 'freeSwap', 'shuffle'];
    for (let k = 0; k < boosters.length; k++) g.drawImage(art.icon(boosters[k], 44), Math.round((84 + k * 100) * DPR), Math.round(770 * DPR));
    c.style.width = W / 2 + 'px';
    c.style.height = H / 2 + 'px';
    c.style.marginRight = '4px';
    c.style.marginBottom = '0';
    if (i === 0) {
      const one = section('phone-oasis', 'Phone mock, full size (oasis)', true);
      const full = backdropCanvas('oasis', W, H);
      ctxOf(full).drawImage(c, 0, 0);
      one.appendChild(full);
    }
    mrow.appendChild(c);
  }
  mock.appendChild(mrow);

  // landscape / tablet sanity + paint cost at the largest phone size
  const land = section('backdrops-landscape', 'Landscape 915×412 (scaled ½)', true);
  const lrow = el('div', 'row');
  for (let i = 0; i < THEMES.length; i++) {
    const c = backdropCanvas(THEMES[i], 915, 412);
    c.style.width = 915 / 2.5 + 'px';
    c.style.height = 412 / 2.5 + 'px';
    c.style.marginRight = '4px';
    lrow.appendChild(c);
  }
  land.appendChild(lrow);

  const big = document.createElement('canvas');
  big.width = 1440;
  big.height = 3120;
  const bg = ctxOf(big);
  for (let i = 0; i < THEMES.length; i++) {
    const t0 = performance.now();
    art.paintBackdrop(bg, THEMES[i], 1440, 3120);
    bg.getImageData(0, 0, 1, 1); // force the raster to finish
    timings[THEMES[i]] = Math.round(performance.now() - t0);
  }
  const perf = section('perf', 'paintBackdrop at 1440×3120 (ms)');
  perf.appendChild(el('div', '', JSON.stringify(timings)));
}

// ───────────────────────────── (e) logo & emblem ─────────────────────────────

function logos(): void {
  const s = section('logo', 'Logo (320 CSS px wide): English and Arabic, on night and on a backdrop');
  const row = el('div', 'row');
  row.appendChild(art.logo(320, 'en'));
  row.appendChild(art.logo(320, 'ar'));
  s.appendChild(row);
  const row2 = el('div', 'row');
  const langs: ('en' | 'ar')[] = ['en', 'ar'];
  for (let i = 0; i < 2; i++) {
    const wrap = el('div');
    wrap.style.position = 'relative';
    const bgc = backdropCanvas(i === 0 ? 'oasis' : 'palace', 340, 320);
    wrap.appendChild(bgc);
    const lg = art.logo(300, langs[i]);
    lg.style.position = 'absolute';
    lg.style.left = '20px';
    lg.style.top = '20px';
    wrap.appendChild(lg);
    row2.appendChild(wrap);
  }
  s.appendChild(row2);
  const row3 = el('div', 'row');
  row3.appendChild(art.logo(160, 'en'));
  row3.appendChild(art.logo(160, 'ar'));
  s.appendChild(row3);

  const e = section('emblem', 'Emblem at 48 / 96 / 192 / 512 device px (1:1), 48 px ×4, and with the 66% safe zone');
  const erow = el('div', 'row');
  const sizes = [48, 96, 192, 512];
  for (let i = 0; i < sizes.length; i++) {
    const src = art.emblem(sizes[i]);
    src.style.width = sizes[i] / DPR + 'px';
    src.style.height = sizes[i] / DPR + 'px';
    erow.appendChild(src);
  }
  const z = art.emblem(48);
  z.style.width = (48 * 4) / DPR + 'px';
  z.style.height = (48 * 4) / DPR + 'px';
  z.className = 'px';
  erow.appendChild(z);
  // safe-zone overlay + launcher-style masks on an indigo background
  const guide = deviceCanvas(384, 384);
  const gg = ctxOf(guide);
  gg.fillStyle = '#231f5c';
  gg.fillRect(0, 0, 384, 384);
  gg.drawImage(art.emblem(384), 0, 0);
  gg.strokeStyle = 'rgba(90,255,160,0.9)';
  gg.lineWidth = 2;
  gg.setLineDash([6, 6]);
  gg.strokeRect(384 * 0.17, 384 * 0.17, 384 * 0.66, 384 * 0.66);
  erow.appendChild(guide);
  const masks = ['circle', 'squircle'];
  for (let i = 0; i < masks.length; i++) {
    // adaptive icon: 108 dp layer, the middle 72 dp is what a launcher shows
    const m = deviceCanvas(192, 192);
    const mg = ctxOf(m);
    mg.save();
    mg.beginPath();
    if (i === 0) mg.arc(96, 96, 96, 0, Math.PI * 2);
    else {
      const r = 52;
      mg.moveTo(r, 0);
      mg.arcTo(192, 0, 192, 192, r);
      mg.arcTo(192, 192, 0, 192, r);
      mg.arcTo(0, 192, 0, 0, r);
      mg.arcTo(0, 0, 192, 0, r);
    }
    mg.clip();
    mg.fillStyle = '#231f5c';
    mg.fillRect(0, 0, 192, 192);
    const layer = 192 * 1.5;
    mg.drawImage(art.emblem(Math.round(layer)), (192 - layer) / 2, (192 - layer) / 2);
    mg.restore();
    erow.appendChild(m);
  }
  e.appendChild(erow);
}

// ───────────────────────────── self-checks ─────────────────────────────

interface CheckResult {
  ok: boolean;
  failures: string[];
  notes: string[];
}

/** Alpha coverage of a canvas: total painted pixels and painted pixels on the outermost ring. */
function coverage(c: HTMLCanvasElement): { painted: number; edge: number; edgeMax: number } {
  const g = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let painted = 0;
  let edge = 0;
  let edgeMax = 0;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const a = d[(y * c.width + x) * 4 + 3];
      if (a > 8) painted++;
      if (x === 0 || y === 0 || x === c.width - 1 || y === c.height - 1) {
        if (a > 40) edge++;
        if (a > edgeMax) edgeMax = a;
      }
    }
  }
  return { painted, edge, edgeMax };
}

function hashCanvas(c: HTMLCanvasElement): number {
  const g = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let h = 2166136261;
  for (let i = 0; i < d.length; i += 7) h = Math.imul(h ^ d[i], 16777619);
  return h >>> 0;
}

function checks(): CheckResult {
  const failures: string[] = [];
  const notes: string[] = [];
  const fullBleed = ['tileA', 'tileB', 'sand2', 'exit'];
  // every sprite renders, is cached, and (unless full-bleed by design) does not touch its border
  for (let i = 0; i < SPRITE_KEYS.length; i++) {
    const k = SPRITE_KEYS[i];
    const sizes = [36, 96];
    for (let j = 0; j < sizes.length; j++) {
      const c = art.sprite(k, sizes[j]);
      if (c.width !== sizes[j] || c.height !== sizes[j]) failures.push(k + ': wrong size ' + c.width + 'x' + c.height);
      if (art.sprite(k, sizes[j]) !== c) failures.push(k + ': not cached');
      const cov = coverage(c);
      if (cov.painted < sizes[j] * sizes[j] * 0.04) failures.push(k + '@' + sizes[j] + ': looks empty');
      if (fullBleed.indexOf(k) < 0 && cov.edge > 0) failures.push(k + '@' + sizes[j] + ': ' + cov.edge + ' opaque border pixels (clipped?) max alpha ' + cov.edgeMax);
      else if (fullBleed.indexOf(k) < 0 && cov.edgeMax > 16) notes.push(k + '@' + sizes[j] + ': faint border alpha ' + cov.edgeMax);
    }
  }
  // every icon renders at 20 CSS px with the right backing size, and iconUrl is a stable PNG data URL
  for (let i = 0; i < ICON_KEYS.length; i++) {
    const k = ICON_KEYS[i];
    const c = art.icon(k, 20);
    if (c.width !== Math.round(20 * DPR)) failures.push(k + ': icon backing ' + c.width + ' for dpr ' + DPR);
    if (c.style.width !== '20px') failures.push(k + ': icon css width ' + c.style.width);
    if (art.icon(k, 20) === c) failures.push(k + ': icon() must return a new canvas');
    const cov = coverage(c);
    if (cov.painted < c.width * c.width * 0.08) failures.push(k + ': icon looks empty');
    if (cov.edge > 0) failures.push(k + ': icon touches its border (' + cov.edge + ' px)');
    const u = art.iconUrl(k, 20);
    if (u.indexOf('data:image/png') !== 0 || u !== art.iconUrl(k, 20)) failures.push(k + ': bad iconUrl');
  }
  if (ICON_KEYS.length !== 48) notes.push('icon count = ' + ICON_KEYS.length);
  // backdrops are deterministic and fill the whole canvas
  for (let i = 0; i < THEMES.length; i++) {
    const a = document.createElement('canvas');
    a.width = 206;
    a.height = 458;
    const b = document.createElement('canvas');
    b.width = 206;
    b.height = 458;
    art.paintBackdrop(ctxOf(a), THEMES[i], 206, 458);
    art.paintBackdrop(ctxOf(b), THEMES[i], 206, 458);
    if (hashCanvas(a) !== hashCanvas(b)) failures.push('backdrop ' + THEMES[i] + ' is not deterministic');
    const cov = coverage(a);
    if (cov.painted !== 206 * 458) failures.push('backdrop ' + THEMES[i] + ' leaves ' + (206 * 458 - cov.painted) + ' transparent pixels');
    const p = art.palette(THEMES[i]);
    if (!/^#[0-9a-f]{6}$/i.test(p.bgTop + '') || !/^#[0-9a-f]{6}$/i.test(p.bgBottom) || !p.accent || !p.frame) failures.push('palette ' + THEMES[i]);
  }
  // gem colours match the design table
  const want = ['#ff4d5e', '#ffa630', '#2fd17c', '#3d8bff', '#b05cff', '#8ff0ff'];
  for (let i = 0; i < 6; i++) if (art.gemColor(i as 0 | 1 | 2 | 3 | 4 | 5) !== want[i]) failures.push('gemColor ' + i);
  // logo / emblem sizes
  const lg = art.logo(200, 'ar');
  if (lg.width !== Math.round(200 * DPR) || lg.style.width !== '200px') failures.push('logo size ' + lg.width + ' / ' + lg.style.width);
  const em = art.emblem(96);
  if (em.width !== 96 || em.height !== 96) failures.push('emblem size');
  // emblem: the star and jewel must stay inside the middle 66%; outside it only the plate may appear
  const e2 = art.emblem(200);
  const eg = e2.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  const ed = eg.getImageData(0, 0, 200, 200).data;
  let goldOutside = 0;
  for (let y = 0; y < 200; y++) {
    for (let x = 0; x < 200; x++) {
      const dx = x - 100;
      const dy = y - 100;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r > 68 && r < 84) {
        const o = (y * 200 + x) * 4;
        // strongly gold pixel between the safe zone and the rim = star spilling out
        if (ed[o] > 215 && ed[o + 1] > 170 && ed[o + 2] < 130) goldOutside++;
      }
    }
  }
  if (goldOutside > 40) failures.push('emblem: gold content outside the safe zone (' + goldOutside + ' px)');
  if (earlyLogo) {
    const late = art.logo(240, 'ar');
    if (hashCanvas(earlyLogo) !== hashCanvas(late)) failures.push('logo requested before the font loaded did not repaint itself');
    notes.push('font loaded when the early logo was requested: ' + fontReadyAtStart);
  }
  // cost of drawing every sprite once at a large phone cell size, and every icon at dpr 3
  const fresh = createArt();
  const t0 = performance.now();
  for (let i = 0; i < SPRITE_KEYS.length; i++) fresh.sprite(SPRITE_KEYS[i], 132);
  const t1 = performance.now();
  for (let i = 0; i < ICON_KEYS.length; i++) fresh.sprite(ICON_KEYS[i] as unknown as SpriteKey, 84);
  const t2 = performance.now();
  notes.push('render all ' + SPRITE_KEYS.length + ' sprites @132px: ' + Math.round(t1 - t0) + ' ms; all ' + ICON_KEYS.length + ' icons @84px: ' + Math.round(t2 - t1) + ' ms');
  return { ok: failures.length === 0, failures, notes };
}

function showChecks(): void {
  const r = checks();
  const s = section('checks', 'Self-checks');
  const pre = el('pre', '', (r.ok ? 'ALL CHECKS PASSED' : 'FAILURES:\n' + r.failures.join('\n')) + (r.notes.length ? '\n\nnotes:\n' + r.notes.join('\n') : ''));
  pre.className = 'report';
  pre.style.color = r.ok ? '#3ecf8e' : '#ff5d6c';
  pre.style.margin = '0';
  s.appendChild(pre);
  (window as unknown as { __galleryChecks: CheckResult }).__galleryChecks = r;
}

// a logo requested before the font has loaded: it must repaint itself once the font arrives
let earlyLogo: HTMLCanvasElement | null = null;
let fontReadyAtStart = true;

async function main(): Promise<void> {
  fontReadyAtStart = document.fonts.check('800 40px "Baloo Bhaijaan 2 Variable"', 'جوهرة');
  earlyLogo = art.logo(240, 'ar');
  try {
    await Promise.all([document.fonts.load('800 40px "Baloo Bhaijaan 2 Variable"', 'Jawhara جوهرة'), document.fonts.load('600 20px "Baloo Bhaijaan 2 Variable"', 'Gem لعبة')]);
    await document.fonts.ready;
  } catch (err) {
    console.warn('font load failed', err);
  }
  const only = new URLSearchParams(location.search).get('only');
  const parts: Record<string, () => void> = { gems, board, icons, backdrops, logos, checks: showChecks };
  const names = Object.keys(parts);
  for (let i = 0; i < names.length; i++) {
    if (only && only.split(',').indexOf(names[i]) < 0) continue;
    try {
      parts[names[i]]();
    } catch (err) {
      const pre = el('pre', '', 'ERROR in ' + names[i] + ': ' + (err instanceof Error ? err.stack || err.message : String(err)));
      pre.style.color = '#ff5d6c';
      root.appendChild(pre);
      console.error(err);
    }
  }
  const w = window as unknown as { __galleryReady: boolean; __galleryTimings: Record<string, number> };
  w.__galleryTimings = timings;
  w.__galleryReady = true;
}

void main();
