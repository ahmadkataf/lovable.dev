/**
 * Board geometry and gesture maths. Pure (no DOM): unit-tested under Node.
 * All lengths are CSS pixels unless a name says otherwise.
 */
import type { Pos } from '../engine/types.ts';
import { DRAG_COMMIT, DRAG_MAX } from './timing.ts';

export interface BoardRect {
  /** top-left corner of cell (0,0) inside the stage */
  x: number;
  y: number;
  /** side of one cell */
  cell: number;
  w: number;
  h: number;
}

/**
 * The largest board of `cols` × `rows` square cells that fits a stage of `stageW` × `stageH`,
 * leaving `pad` free on every side, centred. The cell size is snapped down to a whole number of
 * device pixels so tiles stay crisp.
 */
export function fitBoard(stageW: number, stageH: number, cols: number, rows: number, pad: number, dpr: number, maxCell: number): BoardRect {
  const availW = Math.max(1, stageW - pad * 2);
  const availH = Math.max(1, stageH - pad * 2);
  let cell = Math.min(availW / cols, availH / rows);
  if (cell > maxCell) cell = maxCell;
  const ratio = dpr > 0 ? dpr : 1;
  cell = Math.floor(cell * ratio) / ratio;
  if (cell < 1 / ratio) cell = 1 / ratio;
  const w = cell * cols;
  const h = cell * rows;
  const snap = (v: number): number => Math.round(v * ratio) / ratio;
  return { x: snap((stageW - w) / 2), y: snap((stageH - h) / 2), cell, w, h };
}

/** The cell under a point of the stage (whole cells, never the sprite outline); null outside the board. */
export function cellAtPoint(rect: BoardRect, cols: number, rows: number, x: number, y: number): Pos | null {
  const c = Math.floor((x - rect.x) / rect.cell);
  const r = Math.floor((y - rect.y) / rect.cell);
  if (c < 0 || r < 0 || c >= cols || r >= rows) return null;
  return { c, r };
}

/** Centre of a cell in stage coordinates. */
export function cellCentre(rect: BoardRect, c: number, r: number): { x: number; y: number } {
  return { x: rect.x + (c + 0.5) * rect.cell, y: rect.y + (r + 0.5) * rect.cell };
}

export interface Drag {
  /** unit step along the dominant axis: (±1, 0) or (0, ±1); (0, 0) while the finger has not moved */
  dc: number;
  dr: number;
  /** displacement along that axis in cells, 0..DRAG_MAX */
  amount: number;
  /** released now, would the swap commit? */
  commit: boolean;
}

/**
 * A drag of (dx, dy) px from where the finger went down: the gem follows along the dominant axis
 * only, clamped to one cell, and commits at 45 % of a cell.
 */
export function dragOf(dx: number, dy: number, cell: number, out?: Drag): Drag {
  const d = out || { dc: 0, dr: 0, amount: 0, commit: false };
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax === 0 && ay === 0) {
    d.dc = 0;
    d.dr = 0;
    d.amount = 0;
    d.commit = false;
    return d;
  }
  if (ax >= ay) {
    d.dc = dx > 0 ? 1 : -1;
    d.dr = 0;
    d.amount = Math.min(DRAG_MAX, ax / cell);
  } else {
    d.dc = 0;
    d.dr = dy > 0 ? 1 : -1;
    d.amount = Math.min(DRAG_MAX, ay / cell);
  }
  d.commit = d.amount >= DRAG_COMMIT;
  return d;
}

export function isAdjacent(a: Pos, b: Pos): boolean {
  return Math.abs(a.c - b.c) + Math.abs(a.r - b.r) === 1;
}

export function samePos(a: Pos | null, b: Pos | null): boolean {
  return a !== null && b !== null && a.c === b.c && a.r === b.r;
}

/** Device-pixel ratio used for the board canvas: the real one, at least 1, at most `cap`. */
export function cappedDpr(dpr: number, cap: number): number {
  if (!(dpr > 0)) return 1;
  return dpr < 1 ? 1 : dpr > cap ? cap : dpr;
}

/** Landscape arrangement (HUD beside the board) when the screen is clearly wider than tall. */
export function isLandscape(w: number, h: number): boolean {
  return w > h * 1.15;
}
