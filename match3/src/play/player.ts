/**
 * Step player: plays a turn's transcript (TurnResult.steps) strictly in order on the board view,
 * with the timings of ./timing.ts, and keeps sound, haptics and the HUD in step with what is on
 * screen. When the script ends the view is reconciled with the engine's snapshot — the engine is
 * the truth; any difference is snapped away (and reported in dev builds).
 *
 * What each step means for the board is defined by src/engine/replay.ts; this file mirrors it.
 */
import type { SfxName, SfxOptions } from '../audio/types.ts';
import type { CreatedSpecial, Fx, Hit, Piece, Pos, Snapshot, Step } from '../engine/types.ts';
import type { HapticKind } from '../platform/types.ts';
import type { Scheduler } from './anim.ts';
import type { BoardView, VPiece } from './board-view.ts';
import { NO_CLIP, PAL_GOLD, PAL_IRON, PAL_LEAF, PAL_SAND, PAL_STONE, PAL_WHITE, SHAPE_CHUNK, SHAPE_DOT, SHAPE_SHARD, SHAPE_SPARK } from './board-view.ts';
import { hop, inOutQuad, inQuad, outBack, outCubic, outQuad } from './ease.ts';
import type { GoalTracker } from './feedback.ts';
import { FEEDBACK, HAPTICS, createSound, fxSound, isComboFx } from './feedback.ts';
import { T, cascadeScale, columnDelay, fallDuration, finaleFlights, prismRayDelay, transformDelay } from './timing.ts';

export interface PlayerHost {
  sfx(name: SfxName, opts?: SfxOptions): void;
  haptic(kind: HapticKind): void;
  /** make sure the frame loop runs */
  kick(): void;
  /** the moves counter loses one (visual) */
  spendMove(): void;
  /** points gained by a wave (visual running score) */
  addScore(points: number): void;
  /** goal `index` moved (the tracker is already updated); x, y = where on the board, in cells */
  goalChanged(index: number, x: number, y: number, fly: boolean): void;
  /** cascade number of the wave that starts now */
  cascade(n: number): void;
  /** "no more moves — shuffling" */
  shuffling(): void;
  /** finale: a spark from the moves counter to a cell (cell coordinates); resolves on arrival */
  flyMove(x: number, y: number, dur: number): Promise<void>;
  /** a short half-speed moment for the biggest blasts */
  slowMo(ms: number): void;
  tracker(): GoalTracker;
  dev: boolean;
}

export interface PlayOptions {
  /** a valid 'swap' step costs a move (false for the free-swap booster) */
  swapCostsMove: boolean;
  /** extra speed factor, read continuously (finale compression); > 1 = faster */
  speed?: () => number;
  /** ms the end-bonus flights may take in total */
  finaleBudget?: number;
}

export interface StepPlayer {
  play(steps: readonly Step[], snapshot: Snapshot, opts: PlayOptions): Promise<void>;
  /** Jump to the settled state of the running transcript and resolve its promise. */
  finishNow(): void;
  /** Forget the running transcript (its promise never resolves). */
  cancel(): void;
  busy(): boolean;
  /** Level start: the pieces drop into the empty board. */
  dropIn(): Promise<void>;
}

interface Sounded {
  sand: boolean;
  stone: boolean;
  stoneBreak: boolean;
  chain: boolean;
  vine: boolean;
  flyers: number;
}

const one = (): number => 1;

export function createStepPlayer(view: BoardView, sched: Scheduler, host: PlayerHost): StepPlayer {
  let token = 0;
  let current: { resolve: () => void; snapshot: Snapshot } | null = null;
  let cascade = 1;
  let speed: () => number = one;
  let finaleBudget = 2400;
  /** ms after the launch of the running effects at which each cell is reached */
  const arrival = new Map<number, number>();
  /** specials that were hit and wait for their own 'activate' step, by cell */
  const armed = new Map<number, VPiece>();
  let lastSwapB: Pos | null = null;
  let lastFlash = -1e9;

  function d(ms: number): number {
    const s = speed();
    return (ms * cascadeScale(cascade)) / (s > 0 ? s : 1);
  }

  function cellIndex(c: number, r: number): number {
    return r * view.cols() + c;
  }

  function colorOf(vp: { kind: string; color: number }): number {
    if (vp.color >= 0) return vp.color;
    if (vp.kind === 'stone') return PAL_STONE;
    if (vp.kind === 'vine') return PAL_LEAF;
    return PAL_GOLD;
  }

  /**
   * A step takes a piece over: whatever cosmetic tween was playing on it (pick-up, snap-back,
   * wobble, landing squash) lets go, and its drag offset becomes part of its position.
   */
  function fold(vp: VPiece): void {
    vp.tw++;
    vp.x += vp.ox;
    vp.y += vp.oy;
    vp.ox = 0;
    vp.oy = 0;
  }

  function flashOnce(alpha: number): void {
    if (sched.time - lastFlash < T.flashGap) return;
    lastFlash = sched.time;
    view.flash(alpha, T.flash);
  }

  // ───────────────────────────── piece exits ─────────────────────────────

  /** shards per gem cleared by a blast: fewer when a blast clears many, so the particle budget reaches them all */
  let blastShards = 5;

  /** `inBlast`: the gem is one of many cleared by an effect that brings its own light — keep it modest. */
  function pop(vp: VPiece, x: number, y: number, inBlast: boolean): void {
    vp.dying = true;
    vp.tw++;
    const grow = d(T.popGrow);
    const shrink = d(T.popShrink);
    const s0 = vp.sx;
    const color = colorOf(vp);
    const shards = inBlast ? blastShards : FEEDBACK.particlesPerGem;
    sched.run(grow, (k) => {
      const s = s0 + (1.15 - s0) * k;
      vp.sx = s;
      vp.sy = s;
      vp.flash = (inBlast ? 0.5 : 0.75) * k;
    }, outQuad);
    sched.run(
      shrink,
      (k) => {
        const s = 1.15 * (1 - k);
        vp.sx = s;
        vp.sy = s;
        vp.alpha = 1 - 0.4 * k;
        if (k >= 1) view.removePiece(vp);
      },
      inQuad,
      grow,
    );
    sched.after(grow, () => {
      // the gem bursts: faceted shards fly, a ring of its colour snaps outward, its tile lights up
      view.burst(x, y, color, shards, 4.8, SHAPE_SHARD, { size: 0.3 });
      view.tileFlash(Math.floor(x), Math.floor(y), 260, color, inBlast ? 0.4 : 0.55);
      if (inBlast) {
        view.glow(x, y, 0.5, 1.5, 200, color, 0.35);
      } else {
        view.ring(x, y, 0.22, 0.82, 210, color, 0.8);
        view.flare(x, y, 1.25, 190, 0.85);
        view.glow(x, y, 0.5, 1.8, 220, color, 0.7);
      }
    });
  }

  /** A special used up by an effect: it flares and is gone. */
  function spend(vp: VPiece, x: number, y: number): void {
    vp.dying = true;
    vp.lift = true;
    const s0 = vp.sx;
    const color = colorOf(vp);
    view.burst(x, y, color, 6, 5, SHAPE_SHARD, { size: 0.28 });
    view.flare(x, y, 1.9, 220, 0.9);
    sched.run(d(150), (k) => {
      const s = s0 + 0.55 * k;
      vp.sx = s;
      vp.sy = s;
      vp.alpha = 1 - k;
      vp.flash = 1;
      if (k >= 1) view.removePiece(vp);
    }, outQuad);
  }

  function arm(vp: VPiece, cell: number): void {
    vp.dying = true;
    vp.lift = true;
    armed.set(cell, vp);
    sched.run(d(120), (k) => {
      const s = 1 + 0.2 * k;
      vp.sx = s;
      vp.sy = s;
      vp.flash = 0.8 * k;
    }, outQuad);
  }

  function converge(vp: VPiece, to: Pos): void {
    vp.dying = true;
    vp.lift = true;
    const x0 = vp.x;
    const y0 = vp.y;
    sched.run(d(T.converge), (k) => {
      vp.x = x0 + (to.c - x0) * k;
      vp.y = y0 + (to.r - y0) * k;
      const s = 1 - 0.35 * k;
      vp.sx = s;
      vp.sy = s;
      vp.flash = 0.9 * k;
      if (k >= 1) view.removePiece(vp);
    }, inQuad);
  }

  function crumble(vp: VPiece, x: number, y: number, color: number, shape: number, count: number): void {
    vp.dying = true;
    view.burst(x, y, color, count, 5.2, shape, { size: 0.3, gravity: 10, life: 400 });
    view.burst(x, y, PAL_SAND, 3, 2.2, SHAPE_DOT, { size: 0.3, gravity: 1, life: 360 });
    sched.run(d(150), (k) => {
      const s = 1 + 0.12 * hop(Math.min(1, k * 2)) - 0.6 * k * k;
      vp.sx = s;
      vp.sy = s;
      vp.alpha = 1 - k;
      if (k >= 1) view.removePiece(vp);
    });
  }

  function punch(vp: VPiece, amount: number, ms: number): void {
    const my = ++vp.tw;
    sched.run(d(ms), (k) => {
      if (vp.dying || vp.tw !== my) return;
      const s = 1 + amount * hop(k);
      vp.sx = s;
      vp.sy = s;
    });
  }

  // ───────────────────────────── hits ─────────────────────────────

  function applyHit(hit: Hit, made: CreatedSpecial | undefined, nextFx: Set<number> | null, sounded: Sounded): void {
    const c = hit.at.c;
    const r = hit.at.r;
    const x = c + 0.5;
    const y = r + 0.5;
    const cell = cellIndex(c, r);
    const vp = hit.pieceId !== null ? view.piece(hit.pieceId) : null;

    if (hit.sandLeft !== undefined) {
      view.setSand(c, r, hit.sandLeft);
      view.ghost(hit.sandLeft === 0 ? 'sand1' : 'sand2', x, y, 220, { a0: 0.85, a1: 0, s0: 1, s1: 1.18 });
      view.burst(x, y + 0.15, PAL_SAND, 6, 3, SHAPE_DOT, { size: 0.24, gravity: 2.5, life: 380 });
      if (!sounded.sand) {
        sounded.sand = true;
        host.sfx('sand');
      }
    }

    switch (hit.result) {
      case 'removed':
        view.setGrid(c, r, -1);
        if (!vp) break;
        if (made) converge(vp, made.at);
        else if (vp.kind === 'stone') {
          crumble(vp, x, y, PAL_STONE, SHAPE_CHUNK, 10);
          if (!sounded.stoneBreak) {
            sounded.stoneBreak = true;
            host.sfx('stoneBreak');
          }
        } else if (vp.kind === 'vine') {
          crumble(vp, x, y, PAL_LEAF, SHAPE_SHARD, 9);
          if (!sounded.vine) {
            sounded.vine = true;
            host.sfx('vine');
          }
        } else pop(vp, x, y, hit.cause === 'blast');
        break;
      case 'activated':
        view.setGrid(c, r, -1);
        if (!vp) break;
        if (nextFx !== null && nextFx.has(cell)) arm(vp, cell);
        else spend(vp, x, y);
        break;
      case 'damaged':
        if (vp) {
          vp.hp = hit.hpLeft === undefined ? vp.hp : hit.hpLeft;
          view.refreshSprite(vp);
          punch(vp, 0.14, 170);
          view.burst(x, y, PAL_STONE, 5, 4, SHAPE_CHUNK, { size: 0.24, gravity: 10, life: 360 });
        }
        if (!sounded.stone) {
          sounded.stone = true;
          host.sfx('stone');
        }
        break;
      case 'unchained':
        if (vp) {
          vp.chained = false;
          const a0 = vp.chainAlpha;
          sched.run(d(140), (k) => {
            vp.chainAlpha = a0 * (1 - k);
          });
          punch(vp, 0.16, 200);
          view.ghost('chain', x, y, 280, { a0: 0.95, a1: 0, s0: 1, s1: 1.6, r0: 0, r1: 0.35 });
          view.burst(x, y, PAL_IRON, 8, 4.6, SHAPE_CHUNK, { size: 0.2, gravity: 9, life: 380 });
        }
        if (!sounded.chain) {
          sounded.chain = true;
          host.sfx('chain');
        }
        break;
      default:
        if (vp && vp.kind === 'lamp' && hit.cause === 'blast') punch(vp, 0.1, 160);
        break;
    }

    const changed = host.tracker().hit(hit);
    for (let i = 0; i < changed.length; i++) {
      const fly = sounded.flyers < 6;
      if (fly) sounded.flyers++;
      host.goalChanged(changed[i] as number, x, y, fly);
    }
  }

  function spawnSpecial(made: CreatedSpecial): void {
    const vp = view.addPiece(made.piece, made.at.c, made.at.r);
    view.setGrid(made.at.c, made.at.r, made.piece.id);
    const x = made.at.c + 0.5;
    const y = made.at.r + 0.5;
    vp.sx = 0;
    vp.sy = 0;
    vp.flash = 1;
    vp.lift = true;
    sched.run(d(T.createPop), (k) => {
      const s = k < 0.55 ? (k / 0.55) * 1.14 : 1.14 - ((k - 0.55) / 0.45) * 0.14;
      vp.sx = s;
      vp.sy = s;
      if (k >= 1) vp.lift = false;
    });
    sched.run(d(T.createFlash + 120), (k) => {
      vp.flash = 1 - k;
    });
    // a new special is born: a burst of rays, a star of light, a ring in its colour, gold sparks
    const grand = made.piece.kind === 'prism' ? 1.35 : made.piece.kind === 'nova' ? 1.15 : 1;
    view.glow(x, y, 0.8, 2.6 * grand, 260, PAL_WHITE, 0.9);
    view.rays(x, y, 0.8, 2.8 * grand, 320, 0.75);
    view.flare(x, y, 2.3 * grand, 280, 1);
    view.ring(x, y, 0.3, 1.5 * grand, 260, colorOf(vp), 0.85);
    view.burst(x, y, PAL_GOLD, 8, 3.6, SHAPE_SPARK, { size: 0.38, gravity: 0, additive: true, life: 400 });
    view.tileFlash(made.at.c, made.at.r, 320, PAL_GOLD, 0.7);
    host.sfx(createSound(made.piece.kind));
    host.haptic(HAPTICS.create as HapticKind);
  }

  // ───────────────────────────── effects ─────────────────────────────

  function arrive(c: number, r: number, t: number): void {
    const i = cellIndex(c, r);
    const old = arrival.get(i);
    if (old === undefined || t < old) arrival.set(i, t);
  }

  /** Time at which a beam head that eases out over `sweep` reaches `dist` of its `extent`. */
  function beamTime(dist: number, extent: number, sweep: number): number {
    const frac = extent > 0 ? Math.min(1, dist / extent) : 1;
    return (1 - Math.sqrt(1 - frac)) * sweep;
  }

  function ringTime(dist: number, radius: number, dur: number): number {
    const frac = radius > 0 ? Math.min(1, dist / radius) : 1;
    return (1 - Math.cbrt(1 - frac)) * dur * 0.85;
  }

  /** Every tile an effect reaches lights up as the effect arrives there. */
  function lightTiles(targets: readonly Pos[], color: number, alpha: number): void {
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i] as Pos;
      view.tileFlash(t.c, t.r, d(240), color, alpha, arrival.get(cellIndex(t.c, t.r)) || 0);
    }
  }

  function launch(fx: Fx): void {
    const cols = view.cols();
    const rows = view.rows();
    const ac = fx.at.c;
    const ar = fx.at.r;
    const x = ac + 0.5;
    const y = ar + 0.5;
    const color = fx.color >= 0 ? fx.color : PAL_GOLD;
    const targets = fx.targets;
    const sweep = d(T.beamSweep);
    const hTime = (t: Pos): number => beamTime(Math.abs(t.c - ac), (t.c < ac ? ac : cols - 1 - ac) + 0.8, sweep);
    const vTime = (t: Pos): number => beamTime(Math.abs(t.r - ar), (t.r < ar ? ar : rows - 1 - ar) + 0.8, sweep);

    arrive(ac, ar, 0);
    switch (fx.kind) {
      case 'beamH':
      case 'beamV': {
        // a lance of light: a star flashes where it fires, two heads race to the board's edges
        const horizontal = fx.kind === 'beamH';
        view.beam(x, y, horizontal, color, 1.2, sweep);
        view.glow(x, y, 0.8, 2.8, d(240), PAL_WHITE, 0.95);
        view.flare(x, y, 3.4, d(300), 1, 0, horizontal ? 0 : Math.PI / 2);
        view.ring(x, y, 0.3, 1.3, d(240), color, 0.8);
        view.burst(x, y, PAL_GOLD, 6, 5, SHAPE_SPARK, { size: 0.36, gravity: 0, additive: true, life: 360 });
        for (let i = 0; i < targets.length; i++) {
          const t = targets[i] as Pos;
          arrive(t.c, t.r, horizontal ? hTime(t) : vTime(t));
        }
        lightTiles(targets, color, 0.7);
        view.framePulse(0.55, 380);
        view.shake(FEEDBACK.shakeSmall, T.shakeSmall);
        break;
      }
      case 'cross':
      case 'bigCross': {
        const big = fx.kind === 'bigCross';
        if (big) {
          // three rows and three columns, each its own racing streak
          for (let k = -1; k <= 1; k++) {
            const a = k === 0 ? 1 : 0.72;
            if (ar + k >= 0 && ar + k < rows) view.beam(x, y + k, true, color, 1.25, sweep, a);
            if (ac + k >= 0 && ac + k < cols) view.beam(x + k, y, false, color, 1.25, sweep, a);
          }
        } else {
          view.beam(x, y, true, color, 1.6, sweep);
          view.beam(x, y, false, color, 1.6, sweep);
        }
        view.glow(x, y, 1, big ? 5 : 4, d(300), color, 0.8);
        view.rays(x, y, 1.4, big ? 8.5 : 6.5, d(T.bigBlast), 0.85);
        view.flare(x, y, big ? 5.5 : 4.4, d(340), 1);
        view.ring(x, y, 0.4, big ? 4.6 : 3.2, d(T.bigBlast), color, 0.95);
        view.burst(x, y, PAL_GOLD, 12, 7, SHAPE_SPARK, { size: 0.4, gravity: 0, additive: true, life: 400 });
        for (let i = 0; i < targets.length; i++) {
          const t = targets[i] as Pos;
          const inRow = Math.abs(t.r - ar) <= (big ? 1 : 0);
          const inCol = Math.abs(t.c - ac) <= (big ? 1 : 0);
          const th = inRow ? hTime(t) : Infinity;
          const tv = inCol ? vTime(t) : Infinity;
          const tt = Math.min(th, tv);
          arrive(t.c, t.r, tt === Infinity ? 0 : tt);
        }
        lightTiles(targets, color, 0.75);
        view.framePulse(1, 520);
        view.shake(FEEDBACK.shakeBig, T.shakeBig);
        flashOnce(0.2);
        host.slowMo(T.slowMo);
        break;
      }
      case 'nova':
      case 'bigNova': {
        // a burst: rays stab outward, one bold shock wave rolls over the cells, debris flies
        const big = fx.kind === 'bigNova';
        const radius = big ? 4.6 : 2.9;
        const dur = d(big ? T.bigBlast : T.novaBlast);
        view.glow(x, y, 1, big ? radius * 1.15 : radius * 1.5, dur * 0.9, PAL_WHITE, big ? 0.85 : 0.95);
        view.rays(x, y, 1.2, radius * 2.5, dur, big ? 0.95 : 0.85);
        view.flare(x, y, big ? 5 : 3.6, dur * 0.9, 1);
        view.ring(x, y, 0.3, radius, dur, color, 1);
        view.burst(x, y, color, big ? 20 : 12, big ? 9 : 6.5, SHAPE_CHUNK, { size: 0.3, gravity: 5, life: 400 });
        view.burst(x, y, PAL_GOLD, big ? 10 : 6, big ? 8 : 5.5, SHAPE_SPARK, { size: 0.38, gravity: 0, additive: true, life: 380 });
        if (big) {
          view.ring(x, y, 0.5, radius * 1.25, dur * 1.2, PAL_GOLD, 0.7, dur * 0.3);
          flashOnce(0.22);
          host.slowMo(T.slowMo);
        }
        for (let i = 0; i < targets.length; i++) {
          const t = targets[i] as Pos;
          arrive(t.c, t.r, ringTime(Math.hypot(t.c - ac, t.r - ar), radius, dur));
        }
        lightTiles(targets, color, 0.75);
        view.framePulse(big ? 1 : 0.6, big ? 520 : 400);
        view.shake(big ? FEEDBACK.shakeBig : FEEDBACK.shakeSmall, big ? T.shakeBig : T.shakeSmall);
        break;
      }
      case 'prism': {
        // the prism sends a comet of light to every gem of the colour, one after the other
        const flight = d(T.prismFlight);
        view.glow(x, y, 1, 3.4, d(360), PAL_WHITE, 1);
        view.rays(x, y, 1, 4.2, d(420), 0.9);
        view.flare(x, y, 3.2, d(360), 1);
        view.ring(x, y, 0.3, 1.8, d(300), color, 0.9);
        for (let i = 0; i < targets.length; i++) {
          const t = targets[i] as Pos;
          const delay = d(prismRayDelay(i, targets.length));
          const rayColor = fx.color >= 0 ? fx.color : i % 6;
          view.ray(x, y, t.c + 0.5, t.r + 0.5, flight, delay, rayColor);
          view.flare(t.c + 0.5, t.r + 0.5, 1.5, 200, 0.95, delay + flight);
          arrive(t.c, t.r, delay + flight);
        }
        lightTiles(targets, color, 0.7);
        view.framePulse(0.6, 420);
        view.shake(FEEDBACK.shakeSmall, T.shakeSmall);
        break;
      }
      case 'prismAll': {
        // two prisms: a wave of light rolls over the whole board
        const dur = d(T.prismAllWave);
        let radius = 1;
        for (let i = 0; i < targets.length; i++) {
          const t = targets[i] as Pos;
          const dist = Math.hypot(t.c - ac, t.r - ar);
          if (dist > radius) radius = dist;
        }
        radius += 0.8;
        view.glow(x, y, 1, 4.2, dur * 0.7, PAL_WHITE, 0.9);
        view.rays(x, y, 1.5, radius * 2.4, dur * 0.9, 1);
        view.flare(x, y, 6, dur * 0.7, 1);
        view.ring(x, y, 0.4, radius, dur, PAL_GOLD, 1);
        for (let k = 0; k < 6; k++) view.burst(x, y, k, 4, 9, SHAPE_SHARD, { size: 0.3, gravity: 2, life: 400 });
        for (let i = 0; i < targets.length; i++) {
          const t = targets[i] as Pos;
          arrive(t.c, t.r, ringTime(Math.hypot(t.c - ac, t.r - ar), radius, dur));
        }
        // each ring of tiles in another gem colour: the wave is a rainbow
        for (let i = 0; i < targets.length; i++) {
          const t = targets[i] as Pos;
          const ringNo = Math.round(Math.hypot(t.c - ac, t.r - ar));
          view.tileFlash(t.c, t.r, d(300), ringNo % 6, 0.85, arrival.get(cellIndex(t.c, t.r)) || 0);
        }
        view.framePulse(1, 620);
        view.shake(FEEDBACK.shakeBig, T.shakeBig);
        flashOnce(0.25);
        host.slowMo(T.slowMo);
        break;
      }
    }
  }

  // ───────────────────────────── steps ─────────────────────────────

  async function doSwap(step: { a: Pos; b: Pos; valid: boolean }, costsMove: boolean): Promise<void> {
    lastSwapB = step.b;
    const a = view.pieceAt(step.a.c, step.a.r);
    const b = view.pieceAt(step.b.c, step.b.r);
    if (!a || !b) return;
    fold(a);
    fold(b);
    a.lift = true;
    b.lift = false;
    const ax = a.x;
    const ay = a.y;
    const bx = b.x;
    const by = b.y;
    // either piece may still be enlarged from being picked up or tapped: both ease back to size
    const asx = a.sx;
    const asy = a.sy;
    const bsx = b.sx;
    const bsy = b.sy;
    const out = (k: number): void => {
      a.x = ax + (step.b.c - ax) * k;
      a.y = ay + (step.b.r - ay) * k;
      b.x = bx + (step.a.c - bx) * k;
      b.y = by + (step.a.r - by) * k;
      a.sx = asx + (1 - asx) * k;
      a.sy = asy + (1 - asy) * k;
      b.sx = bsx + (1 - bsx) * k;
      b.sy = bsy + (1 - bsy) * k;
    };
    if (step.valid) {
      host.sfx('swap');
      host.haptic(HAPTICS.swap as HapticKind);
      await sched.tween(d(T.swap), out, outCubic);
      a.x = step.b.c;
      a.y = step.b.r;
      b.x = step.a.c;
      b.y = step.a.r;
      a.sx = 1;
      a.sy = 1;
      b.sx = 1;
      b.sy = 1;
      a.lift = false;
      view.setGrid(step.a.c, step.a.r, b.id);
      view.setGrid(step.b.c, step.b.r, a.id);
      if (costsMove) host.spendMove();
      return;
    }
    host.sfx('invalid');
    host.haptic(HAPTICS.invalid as HapticKind);
    await sched.tween(d(T.invalidOut), out, outQuad);
    await sched.tween(
      d(T.invalidBack),
      (k) => {
        a.x = step.b.c + (step.a.c - step.b.c) * k;
        a.y = step.b.r + (step.a.r - step.b.r) * k;
        b.x = step.a.c + (step.b.c - step.a.c) * k;
        b.y = step.a.r + (step.b.r - step.a.r) * k;
      },
      inOutQuad,
    );
    a.x = step.a.c;
    a.y = step.a.r;
    b.x = step.b.c;
    b.y = step.b.r;
    a.sx = 1;
    a.sy = 1;
    b.sx = 1;
    b.sy = 1;
    a.lift = false;
    const dx = step.b.c - step.a.c;
    const dy = step.b.r - step.a.r;
    // a small wobble along the swap axis (cosmetic: does not hold the turn up, and lets go the
    // moment the player picks either piece up again)
    const ta = ++a.tw;
    const tb = ++b.tw;
    sched.run(d(T.invalidWobble * 2), (k) => {
      const w = Math.sin(k * Math.PI * 4) * 0.07 * (1 - k);
      if (a.tw === ta && !a.dying) {
        a.ox = dx * w;
        a.oy = dy * w;
      }
      if (b.tw === tb && !b.dying) {
        b.ox = -dx * w;
        b.oy = -dy * w;
      }
    });
  }

  async function doActivate(step: { fx: Fx[] }): Promise<void> {
    const wind = d(T.specialWindup);
    for (let i = 0; i < step.fx.length; i++) {
      const fx = step.fx[i] as Fx;
      const vp = armed.get(cellIndex(fx.at.c, fx.at.r)) || view.pieceAt(fx.at.c, fx.at.r);
      if (!vp) continue;
      vp.lift = true;
      const s0 = vp.sx;
      sched.run(wind, (k) => {
        const s = s0 + (1.3 - s0) * k;
        vp.sx = s;
        vp.sy = s;
        vp.flash = k;
      }, outQuad);
    }
    await sched.wait(wind);
    arrival.clear();
    let combo = false;
    let sound: SfxName | null = null;
    for (let i = 0; i < step.fx.length; i++) {
      const fx = step.fx[i] as Fx;
      launch(fx);
      const cell = cellIndex(fx.at.c, fx.at.r);
      const vp = armed.get(cell);
      if (vp) {
        armed.delete(cell);
        spend(vp, fx.at.c + 0.5, fx.at.r + 0.5);
      }
      if (isComboFx(fx.kind)) combo = true;
      const s = fxSound(fx.kind);
      if (sound === null || s === 'bigCombo' || (s === 'nova' && sound === 'beam')) sound = s;
    }
    if (sound) host.sfx(sound);
    if (step.fx.length >= 4 && sound !== 'bigCombo') host.sfx('bigCombo', { volume: 0.7 });
    host.haptic((combo ? HAPTICS.combo : HAPTICS.blast) as HapticKind);
  }

  async function doClear(step: Extract<Step, { type: 'clear' }>, index: number, steps: readonly Step[]): Promise<void> {
    cascade = step.cascade;
    host.cascade(step.cascade);
    const next = steps[index + 1];
    let nextFx: Set<number> | null = null;
    if (next && next.type === 'activate') {
      nextFx = new Set<number>();
      for (let i = 0; i < next.fx.length; i++) nextFx.add(cellIndex((next.fx[i] as Fx).at.c, (next.fx[i] as Fx).at.r));
    }
    let merging: Map<number, CreatedSpecial> | null = null;
    for (let i = 0; i < step.created.length; i++) {
      const made = step.created[i] as CreatedSpecial;
      if (!merging) merging = new Map<number, CreatedSpecial>();
      for (let k = 0; k < made.from.length; k++) merging.set(cellIndex((made.from[k] as Pos).c, (made.from[k] as Pos).r), made);
    }
    const sounded: Sounded = { sand: false, stone: false, stoneBreak: false, chain: false, vine: false, flyers: 0 };
    // the particle budget is shared by the whole wave
    blastShards = step.hits.length <= 14 ? 5 : step.hits.length <= 28 ? 3 : 2;
    let hasMatch = false;
    let ripple = 0;
    let end = 0;
    const popLen = d(T.popGrow + T.popShrink);
    for (let i = 0; i < step.hits.length; i++) {
      const hit = step.hits[i] as Hit;
      const cell = cellIndex(hit.at.c, hit.at.r);
      const made = merging !== null && hit.cause === 'match' && hit.result === 'removed' ? merging.get(cell) : undefined;
      let delay = 0;
      if (hit.cause === 'blast') delay = arrival.get(cell) || 0;
      else if (hit.cause === 'match') {
        hasMatch = true;
        if (!made) delay = (ripple < 8 ? ripple : 8) * d(T.matchRipple);
        ripple++;
      } else if (hit.cause === 'adjacent') delay = d(T.popGrow);
      const len = made ? d(T.converge) : popLen;
      if (delay + len > end) end = delay + len;
      if (delay <= 0) applyHit(hit, made, nextFx, sounded);
      else sched.after(delay, () => applyHit(hit, made, nextFx, sounded));
    }
    if (hasMatch) host.sfx('match', { step: step.cascade });
    if (hasMatch && step.cascade >= 3) host.haptic(HAPTICS.cascade as HapticKind);
    // a chain in full swing: the frame of the board glows brighter with every step
    if (hasMatch && step.cascade >= 2) view.framePulse(Math.min(1, 0.25 + 0.15 * step.cascade), 340);
    if (step.score > 0) host.addScore(step.score);
    for (let i = 0; i < step.popups.length; i++) {
      const p = step.popups[i] as { at: Pos; value: number };
      const delay = arrival.get(cellIndex(p.at.c, p.at.r)) || 0;
      view.popup(p.at.c + 0.5, p.at.r + 0.35, p.value, T.scorePopup, T.scorePopupFade, delay + d(T.popGrow), p.value >= 300 || step.cascade >= 3);
    }
    for (let i = 0; i < step.created.length; i++) {
      const made = step.created[i] as CreatedSpecial;
      const at = d(T.converge) * 0.8;
      sched.after(at, () => spawnSpecial(made));
      if (at + d(T.createPop) * 0.6 > end) end = at + d(T.createPop) * 0.6;
    }
    await sched.wait(end);
    arrival.clear();
  }

  /** Touch-down: the piece squashes onto its cell, rebounds a little taller, and settles. */
  function land(vp: VPiece): void {
    vp.clipTop = NO_CLIP;
    const my = ++vp.tw;
    sched.run(T.landSquash, (k) => {
      if (vp.dying || vp.tw !== my) return;
      // one and a half swings of a damped wave: down (squash), up (stretch), rest
      const w = k >= 1 ? 0 : Math.sin(k * Math.PI * 1.5) * (1 - k) * 1.35;
      vp.sy = 1 - 0.13 * w;
      vp.sx = 1 + 0.08 * w;
      vp.oy = w > 0 ? 0.065 * w : 0.03 * w;
    });
  }

  async function doFall(step: Extract<Step, { type: 'fall' }>): Promise<void> {
    // column stagger: the columns that move, left to right
    const moving: number[] = [];
    const mark = (c: number): void => {
      if (moving.indexOf(c) < 0) moving.push(c);
    };
    for (let i = 0; i < step.moves.length; i++) mark((step.moves[i] as { to: Pos }).to.c);
    for (let i = 0; i < step.spawns.length; i++) mark((step.spawns[i] as { to: Pos }).to.c);
    moving.sort((p, q) => p - q);
    const delayOf = (c: number): number => d(columnDelay(moving.indexOf(c), moving.length));

    let end = 0;
    let first = Infinity;
    // logical grid: everything lifts, then everything lands
    for (let i = 0; i < step.moves.length; i++) {
      const m = step.moves[i] as { id: number; from: Pos; to: Pos };
      if (view.idAt(m.from.c, m.from.r) === m.id) view.setGrid(m.from.c, m.from.r, -1);
    }
    for (let i = 0; i < step.moves.length; i++) {
      const m = step.moves[i] as { id: number; from: Pos; to: Pos };
      view.setGrid(m.to.c, m.to.r, m.id);
      const vp = view.piece(m.id);
      if (!vp) continue;
      fold(vp);
      const x0 = m.from.c;
      const y0 = m.from.r;
      const dist = Math.max(1, Math.abs(m.to.r - m.from.r));
      const dur = d(fallDuration(dist));
      const delay = delayOf(m.to.c);
      vp.x = x0;
      vp.y = y0;
      vp.sx = 1;
      vp.sy = 1;
      sched.run(
        dur,
        (k) => {
          vp.y = y0 + (m.to.r - y0) * k;
          vp.x = x0 + (m.to.c - x0) * Math.min(1, k * 1.6);
          if (k >= 1) land(vp);
        },
        inQuad,
        delay,
      );
      if (delay + dur > end) end = delay + dur;
      if (delay + dur < first) first = delay + dur;
    }
    for (let i = 0; i < step.spawns.length; i++) {
      const s = step.spawns[i] as { piece: Piece; from: Pos; to: Pos };
      const top = view.spawnRow(s.from.c);
      const y0 = top + s.from.r;
      const x0 = s.from.c;
      const vp = view.addPiece(s.piece, x0, y0);
      view.setGrid(s.to.c, s.to.r, s.piece.id);
      vp.clipTop = top;
      const dist = Math.max(1, s.to.r - y0);
      const dur = d(fallDuration(dist));
      const delay = delayOf(s.to.c);
      sched.run(
        dur,
        (k) => {
          vp.y = y0 + (s.to.r - y0) * k;
          vp.x = x0 + (s.to.c - x0) * Math.min(1, k * 1.6);
          if (k >= 1) land(vp);
        },
        inQuad,
        delay,
      );
      if (delay + dur > end) end = delay + dur;
      if (delay + dur < first) first = delay + dur;
    }
    if (first !== Infinity) sched.after(first, () => host.sfx('land'));
    await sched.wait(end);
  }

  async function doCollect(step: Extract<Step, { type: 'collect' }>): Promise<void> {
    host.sfx('lamp');
    if (step.score > 0) host.addScore(step.score);
    const dur = d(T.collectSlide);
    for (let i = 0; i < step.lamps.length; i++) {
      const lamp = step.lamps[i] as { id: number; at: Pos };
      view.setGrid(lamp.at.c, lamp.at.r, -1);
      const vp = view.piece(lamp.id);
      const x = lamp.at.c + 0.5;
      const y = lamp.at.r + 0.5;
      view.glow(x, y + 0.3, 1, 3, dur + 160, PAL_GOLD, 1);
      view.rays(x, y + 0.2, 0.8, 3.2, dur + 120, 0.8);
      view.flare(x, y + 0.2, 2.6, dur + 60, 1);
      view.tileFlash(lamp.at.c, lamp.at.r, dur + 160, PAL_GOLD, 0.8);
      view.burst(x, y + 0.4, PAL_GOLD, 8, 3.5, SHAPE_SPARK, { size: 0.36, gravity: 0, additive: true, life: 400 });
      view.popup(x, y - 0.2, Math.round(step.score / Math.max(1, step.lamps.length)), T.scorePopup, T.scorePopupFade, 0, true);
      if (vp) {
        vp.dying = true;
        vp.lift = true;
        const y0 = vp.y;
        sched.run(dur, (k) => {
          vp.y = y0 + 0.75 * k;
          vp.flash = 0.8 * k;
          vp.alpha = k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45;
          const s = 1 - 0.25 * k;
          vp.sx = s;
          vp.sy = s;
          if (k >= 1) view.removePiece(vp);
        }, inQuad);
      }
      const tracker = host.tracker();
      const changed = tracker.lamp(1);
      for (let k = 0; k < changed.length; k++) host.goalChanged(changed[k] as number, x, y + 0.6, true);
    }
    await sched.wait(dur);
  }

  function morphPop(vp: VPiece, piece: Piece, x: number, y: number): void {
    view.morph(vp, piece);
    vp.flash = 1;
    vp.lift = true;
    sched.run(d(T.transformPop), (k) => {
      const s = 1 + 0.38 * (1 - k) * Math.cos(k * Math.PI * 0.5);
      vp.sx = s;
      vp.sy = s;
      vp.flash = 1 - k;
      if (k >= 1) vp.lift = false;
    }, outQuad);
    view.glow(x, y, 0.6, 2.2, 240, PAL_WHITE, 0.9);
    view.flare(x, y, 2, 240, 1);
    view.tileFlash(Math.floor(x), Math.floor(y), 280, PAL_GOLD, 0.7);
    view.burst(x, y, PAL_GOLD, 5, 3.2, SHAPE_SPARK, { size: 0.34, gravity: 0, additive: true, life: 360 });
  }

  async function doTransform(step: Extract<Step, { type: 'transform' }>): Promise<void> {
    const n = step.changes.length;
    if (n === 0) return;
    if (step.reason === 'endBonus') {
      const flights = finaleFlights(n, finaleBudget);
      const each = step.score / n;
      let last: Promise<void> | null = null;
      for (let i = 0; i < n; i++) {
        const change = step.changes[i] as { at: Pos; piece: Piece };
        const flight = (flights[i] as number) / speed();
        const x = change.at.c + 0.5;
        const y = change.at.r + 0.5;
        host.spendMove();
        host.sfx('match', { step: Math.min(12, i + 2), volume: 0.8 });
        last = host.flyMove(x, y, flight).then(() => {
          const vp = view.piece(change.piece.id);
          if (vp) morphPop(vp, change.piece, x, y);
          view.popup(x, y - 0.3, Math.round(each), T.scorePopup, T.scorePopupFade, 0, false);
          host.addScore(Math.round(each));
          host.sfx('createBeam', { volume: 0.6 });
        });
        // the next spark leaves before this one lands
        await sched.wait(flight * 0.55);
      }
      if (last) await last;
      await sched.wait(d(160));
      return;
    }
    if (step.reason === 'recolor') {
      for (let i = 0; i < n; i++) {
        const change = step.changes[i] as { at: Pos; piece: Piece };
        const vp = view.piece(change.piece.id);
        if (!vp) continue;
        let done = false;
        sched.run(d(T.recolor), (k) => {
          vp.sx = Math.abs(Math.cos(k * Math.PI));
          if (!done && k >= 0.5) {
            done = true;
            view.morph(vp, change.piece);
          }
          if (k >= 1) vp.sx = 1;
        });
      }
      await sched.wait(d(T.recolor));
      return;
    }
    // prism + beam / nova: rays from the prism turn the gems into specials one after the other
    const from = lastSwapB;
    const flight = d(120);
    let end = 0;
    for (let i = 0; i < n; i++) {
      const change = step.changes[i] as { at: Pos; piece: Piece };
      const delay = d(transformDelay(i, n));
      const x = change.at.c + 0.5;
      const y = change.at.r + 0.5;
      if (from) view.ray(from.c + 0.5, from.r + 0.5, x, y, flight, delay, change.piece.color >= 0 ? change.piece.color : PAL_GOLD);
      sched.after(delay + flight, () => {
        const vp = view.piece(change.piece.id);
        if (vp) morphPop(vp, change.piece, x, y);
        if (i % 3 === 0) host.sfx(createSound(change.piece.kind), { volume: 0.7 });
      });
      if (delay + flight > end) end = delay + flight;
    }
    host.sfx('prism');
    if (step.score > 0) host.addScore(step.score);
    await sched.wait(end + d(T.transformPop));
  }

  async function doGrow(step: Extract<Step, { type: 'grow' }>): Promise<void> {
    host.sfx('vineGrow');
    const old = step.replacedId !== null ? view.piece(step.replacedId) : null;
    if (old) {
      old.dying = true;
      sched.run(d(T.grow * 0.6), (k) => {
        const s = 1 - 0.5 * k;
        old.sx = s;
        old.sy = s;
        old.alpha = 1 - k;
        if (k >= 1) view.removePiece(old);
      });
    }
    const vp = view.addPiece(step.piece, step.at.c, step.at.r);
    view.setGrid(step.at.c, step.at.r, step.piece.id);
    const dx = step.from.c - step.at.c;
    const dy = step.from.r - step.at.r;
    vp.sx = 0.1;
    vp.sy = 0.1;
    vp.ox = dx * 0.5;
    vp.oy = dy * 0.5;
    const source = view.pieceAt(step.from.c, step.from.r);
    if (source) punch(source, 0.14, 240);
    view.burst(step.at.c + 0.5, step.at.r + 0.5, PAL_LEAF, 6, 2.6, SHAPE_SHARD, { size: 0.22, gravity: 3, life: 400 });
    await sched.tween(
      d(T.grow),
      (k) => {
        const s = 0.1 + 0.9 * k;
        vp.sx = s;
        vp.sy = s;
        vp.ox = dx * 0.5 * (1 - Math.min(1, k));
        vp.oy = dy * 0.5 * (1 - Math.min(1, k));
      },
      outBack,
    );
    vp.sx = 1;
    vp.sy = 1;
    vp.ox = 0;
    vp.oy = 0;
  }

  async function doShuffle(step: Extract<Step, { type: 'shuffle' }>, byBooster: boolean): Promise<void> {
    // the banner explains a shuffle the player did not ask for
    if (!byBooster) host.shuffling();
    host.sfx('shuffle');
    const cx = view.cols() / 2 - 0.5;
    const cy = view.rows() / 2 - 0.5;
    for (let i = 0; i < step.moves.length; i++) {
      const m = step.moves[i] as { id: number; from: Pos; to: Pos };
      if (view.idAt(m.from.c, m.from.r) === m.id) view.setGrid(m.from.c, m.from.r, -1);
    }
    for (let i = 0; i < step.moves.length; i++) {
      const m = step.moves[i] as { id: number; from: Pos; to: Pos };
      view.setGrid(m.to.c, m.to.r, m.id);
      const vp = view.piece(m.id);
      if (!vp) continue;
      fold(vp);
      const x0 = m.from.c;
      const y0 = m.from.r;
      vp.lift = true;
      sched.run(
        d(T.shuffle),
        (k) => {
          // glide to the new cell while swirling a little around the board centre
          const px = x0 + (m.to.c - x0) * k;
          const py = y0 + (m.to.r - y0) * k;
          const swirl = Math.sin(Math.PI * k) * 0.55;
          vp.x = px - (py - cy) * swirl * 0.5 + (cx - px) * swirl * 0.35;
          vp.y = py + (px - cx) * swirl * 0.5 + (cy - py) * swirl * 0.35;
          vp.rot = Math.sin(Math.PI * k) * 0.7 * (i % 2 === 0 ? 1 : -1);
          const s = 1 - 0.22 * Math.sin(Math.PI * k);
          vp.sx = s;
          vp.sy = s;
          if (k >= 1) {
            vp.x = m.to.c;
            vp.y = m.to.r;
            vp.rot = 0;
            vp.sx = 1;
            vp.sy = 1;
            vp.lift = false;
          }
        },
        inOutQuad,
        (i % 5) * 12,
      );
    }
    await sched.wait(d(T.shuffle) + 60);
  }

  async function doBooster(step: Extract<Step, { type: 'booster' }>): Promise<void> {
    host.sfx('booster');
    if (step.booster !== 'hammer' || !step.at) return;
    const x = step.at.c + 0.5;
    const y = step.at.r + 0.5;
    const swing = d(T.hammer * 0.62);
    // the hammer swings down from the upper right and strikes the cell
    view.ghost('hammer', x + 0.55, y - 0.6, swing, { a0: 1, a1: 1, s0: 1.25, s1: 1.1, r0: 0.9, r1: -0.5, dx: -0.3, dy: 0.35 });
    await sched.wait(swing);
    view.ghost('hammer', x + 0.25, y - 0.25, d(T.hammer * 0.5), { a0: 1, a1: 0, s0: 1.1, s1: 1.2, r0: -0.5, r1: -0.2 });
    view.glow(x, y, 0.8, 2.6, 220, PAL_WHITE, 1);
    view.flare(x, y, 2.6, 240, 1);
    view.ring(x, y, 0.2, 1.4, 240, PAL_GOLD, 0.9);
    view.tileFlash(step.at.c, step.at.r, 260, PAL_GOLD, 0.8);
    view.burst(x, y, PAL_GOLD, 8, 5, SHAPE_SPARK, { size: 0.36, gravity: 0, additive: true, life: 360 });
    view.shake(FEEDBACK.shakeSmall, T.shakeSmall);
    host.haptic(HAPTICS.blast as HapticKind);
  }

  async function run(steps: readonly Step[], opts: PlayOptions, my: number): Promise<void> {
    cascade = 1;
    arrival.clear();
    armed.clear();
    let shuffleBooster = false;
    for (let i = 0; i < steps.length; i++) {
      if (my !== token) return;
      const step = steps[i] as Step;
      host.kick();
      switch (step.type) {
        case 'swap':
          await doSwap(step, opts.swapCostsMove);
          break;
        case 'activate':
          await doActivate(step);
          break;
        case 'clear':
          await doClear(step, i, steps);
          break;
        case 'fall':
          await doFall(step);
          cascade++;
          break;
        case 'collect':
          await doCollect(step);
          break;
        case 'transform':
          await doTransform(step);
          break;
        case 'grow':
          await doGrow(step);
          break;
        case 'shuffle':
          await doShuffle(step, shuffleBooster);
          shuffleBooster = false;
          break;
        case 'booster':
          if (step.booster === 'shuffle') shuffleBooster = true;
          await doBooster(step);
          break;
        case 'status':
          break;
      }
    }
  }

  function settle(my: number): void {
    if (my !== token || !current) return;
    const cur = current;
    current = null;
    // specials that were armed but never got their effect (should not happen): drop them
    armed.forEach((vp) => view.removePiece(vp));
    armed.clear();
    const problems = view.reconcile(cur.snapshot);
    if (problems.length > 0 && host.dev && typeof console !== 'undefined') {
      console.warn('[play] the board on screen differed from the engine and was snapped to it:\n  ' + problems.join('\n  '));
    }
    cur.resolve();
  }

  return {
    play(steps, snapshot, opts) {
      const my = ++token;
      speed = opts.speed || one;
      finaleBudget = opts.finaleBudget || 2400;
      return new Promise<void>((resolve) => {
        current = { resolve, snapshot };
        host.kick();
        run(steps, opts, my).then(
          () => settle(my),
          (err) => {
            if (typeof console !== 'undefined') console.error('[play] step player failed', err);
            if (my === token && current) {
              const cur = current;
              current = null;
              view.clearEffects();
              view.reset(cur.snapshot);
              cur.resolve();
            }
          },
        );
      });
    },

    finishNow() {
      if (!current) return;
      const cur = current;
      current = null;
      token++;
      sched.clear();
      armed.clear();
      arrival.clear();
      view.clearEffects();
      view.reset(cur.snapshot);
      cur.resolve();
    },

    cancel() {
      token++;
      current = null;
      armed.clear();
      arrival.clear();
    },

    busy: () => current !== null,

    dropIn() {
      const rows = view.rows();
      const list = view.pieces();
      let end = 0;
      for (let i = 0; i < list.length; i++) {
        const vp = list[i] as VPiece;
        const c = Math.round(vp.x);
        const r = Math.round(vp.y);
        const top = view.spawnRow(c);
        const y0 = top - 1.2 - (rows - 1 - r) * 0.15;
        const delay = c * 20 + (rows - 1 - r) * 22;
        const dur = 260 + (r - top) * 14;
        vp.y = y0;
        vp.clipTop = top;
        sched.run(
          dur,
          (k) => {
            vp.y = y0 + (r - y0) * k;
            if (k >= 1) {
              vp.y = r;
              land(vp);
            }
          },
          inQuad,
          delay,
        );
        if (delay + dur > end) end = delay + dur;
      }
      host.kick();
      return sched.wait(Math.min(end, T.dropIn + 200));
    },
  };
}
