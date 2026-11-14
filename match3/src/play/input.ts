/**
 * Pointer input on the board canvas (Pointer Events: touch and mouse alike).
 *
 * Drag is primary: the gem follows the finger along the dominant axis, clamped to one cell, and
 * the swap commits on RELEASE when it was dragged at least 45 % of a cell — dragging back cancels.
 * Tap-tap works too. Hit-testing uses whole cells. While the board resolves, gestures are still
 * read (mode 'buffer') so one swipe can be queued; nothing is shown for them.
 *
 * This file only recognises gestures; what they do is decided by the screen (./index.ts).
 */
import type { Pos } from '../engine/types.ts';
import type { Drag } from './geometry.ts';
import { dragOf } from './geometry.ts';

export type InputMode = 'live' | 'buffer' | 'off';

export interface InputHost {
  mode(): InputMode;
  /** The cell under a viewport point, or null outside the board / on a hole. */
  cellAt(clientX: number, clientY: number): Pos | null;
  /** Side of a cell in CSS px. */
  cellSize(): number;
  /** Finger down on a cell (live mode only). Return false to ignore the gesture. */
  down(cell: Pos): boolean;
  /** The finger moved while holding `cell`: direction (unit step) and amount in cells (live mode only). */
  drag(cell: Pos, dc: number, dr: number, amount: number): void;
  /** Released: `swipe` is the neighbour the gem was dropped on, or null for a tap / cancelled drag. */
  up(cell: Pos, swipe: Pos | null, wasDrag: boolean, mode: InputMode): void;
  /** Gesture aborted (pointer cancelled, mode switched off). */
  cancel(cell: Pos): void;
  /** Any touch at all (cancels the idle hint, skips the finale …). */
  touch(): void;
}

/** A drag only starts once the finger has moved this share of a cell (below it, it is a tap). */
const DRAG_START = 0.14;

export function attachInput(canvas: HTMLCanvasElement, host: InputHost): () => void {
  let pointer = -1;
  let cell: Pos | null = null;
  let x0 = 0;
  let y0 = 0;
  let dragging = false;
  let mode: InputMode = 'off';
  const drag: Drag = { dc: 0, dr: 0, amount: 0, commit: false };

  function release(target: Element, id: number): void {
    try {
      if (target.hasPointerCapture && target.hasPointerCapture(id)) target.releasePointerCapture(id);
    } catch {
      // capture may already be gone
    }
  }

  function onDown(ev: PointerEvent): void {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    host.touch();
    if (pointer !== -1) return;
    const m = host.mode();
    if (m === 'off') return;
    const at = host.cellAt(ev.clientX, ev.clientY);
    if (!at) return;
    if (m === 'live' && !host.down(at)) return;
    ev.preventDefault();
    pointer = ev.pointerId;
    cell = at;
    x0 = ev.clientX;
    y0 = ev.clientY;
    dragging = false;
    mode = m;
    try {
      canvas.setPointerCapture(ev.pointerId);
    } catch {
      // not fatal: moves outside the canvas are simply not seen
    }
  }

  function onMove(ev: PointerEvent): void {
    if (ev.pointerId !== pointer || !cell) return;
    ev.preventDefault();
    dragOf(ev.clientX - x0, ev.clientY - y0, host.cellSize(), drag);
    if (!dragging && drag.amount >= DRAG_START) dragging = true;
    if (dragging && mode === 'live') host.drag(cell, drag.dc, drag.dr, drag.amount);
  }

  function onUp(ev: PointerEvent): void {
    if (ev.pointerId !== pointer || !cell) return;
    ev.preventDefault();
    const at = cell;
    dragOf(ev.clientX - x0, ev.clientY - y0, host.cellSize(), drag);
    const wasDrag = dragging;
    const swipe = wasDrag && drag.commit ? { c: at.c + drag.dc, r: at.r + drag.dr } : null;
    pointer = -1;
    cell = null;
    dragging = false;
    release(canvas, ev.pointerId);
    host.up(at, swipe, wasDrag, mode);
  }

  function onCancel(ev: PointerEvent): void {
    if (ev.pointerId !== pointer || !cell) return;
    const at = cell;
    pointer = -1;
    cell = null;
    dragging = false;
    release(canvas, ev.pointerId);
    host.cancel(at);
  }

  function block(ev: Event): void {
    ev.preventDefault();
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  // belt and braces against scrolling / zooming / text selection on old WebViews
  canvas.addEventListener('touchstart', block, { passive: false });
  canvas.addEventListener('touchmove', block, { passive: false });
  canvas.addEventListener('selectstart', block);
  canvas.addEventListener('dragstart', block);

  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onCancel);
    canvas.removeEventListener('touchstart', block);
    canvas.removeEventListener('touchmove', block);
    canvas.removeEventListener('selectstart', block);
    canvas.removeEventListener('dragstart', block);
  };
}
