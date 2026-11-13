/**
 * The play screen: everything the player sees and touches while playing a level.
 *
 *   const play = createPlayScreen(ctx, { kit });   // `kit` optional: one is created when missing
 *   root.appendChild(play.el);  play.start(level, boosters);
 *
 * Pieces of this module:
 *   timing.ts     the one table of durations          feedback.ts  praise tiers, live goal counters
 *   board-view.ts canvas renderer + effects           player.ts    plays a turn's Step transcript
 *   input.ts      drag / tap gestures                 hud.ts       header, tray, banners, flyers
 *   dialogs.ts    tip / pause / win / lose dialogs    tutorial.ts  tip illustrations
 *
 * Flow: start → board drops in (+ goal banner, + tutorial tip once) → play ⇄ turns → won: finale
 * (end bonus, skippable) → win dialog → map │ lost: lose dialog (continue / retry / give up).
 * The engine (src/engine) is the single source of truth; this screen only shows it.
 *
 * Test hooks (dev builds or `?debug=1` only): `window.__play`, URL `seed=<n>` and `fast=1`.
 */
import type { AppContext, PlayScreen } from '../app/types.ts';
import type { SfxName, SfxOptions } from '../audio/types.ts';
import { Game } from '../engine/index.ts';
import type { InLevelBooster, LevelDef, Pos, Snapshot, StartBoosters, TurnResult } from '../engine/types.ts';
import { chapterOf } from '../levels/index.ts';
import type { HapticKind } from '../platform/types.ts';
import * as econ from '../state/econ.ts';
import { createKit } from '../ui/kit/index.ts';
import type { DialogHandle, IconName, Kit } from '../ui/kit/index.ts';
import { Scheduler, Timers } from './anim.ts';
import { createBoardView } from './board-view.ts';
import type { VPiece } from './board-view.ts';
import type { DialogDeps } from './dialogs.ts';
import { openBuyBooster, openConfirm, openLose, openPause, openTip, openWin } from './dialogs.ts';
import { outQuad } from './ease.ts';
import type { GoalTracker } from './feedback.ts';
import { FEEDBACK, FINALE_KEY, PRAISE_KEYS, createGoalTracker, praiseTier, turnStats } from './feedback.ts';
import { cellAtPoint, isAdjacent, samePos } from './geometry.ts';
import { createHud } from './hud.ts';
import type { InputMode } from './input.ts';
import { attachInput } from './input.ts';
import type { PlayOptions } from './player.ts';
import { createStepPlayer } from './player.ts';
import { EARLY_LEVELS, FAST_FACTOR, INVALID_FOR_HINT, LOW_MOVES, T, hintDelay } from './timing.ts';
import { isTipId, tipSeenKey } from './tutorial.ts';

export interface PlayDeps {
  /** The app's UI kit. When omitted the screen creates its own. */
  kit?: Kit;
}

type State = 'intro' | 'play' | 'finale' | 'won' | 'lost';

interface Session {
  level: LevelDef;
  boosters: StartBoosters;
  game: Game;
  /** last settled snapshot */
  snap: Snapshot;
  tracker: GoalTracker;
  state: State;
  /** a turn is animating (input is buffered, not acted on) */
  busy: boolean;
  movesShown: number;
  /** real moves or boosters used in this attempt (leaving after the first one costs a life) */
  movesMade: number;
  continues: number;
  adUsed: boolean;
  lifeTaken: boolean;
  invalidStreak: number;
  bestCascade: number;
  lowCue: boolean;
  targeting: InLevelBooster | null;
  selection: Pos | null;
  buffered: { a: Pos; b: Pos; at: number } | null;
  hintTimer: number;
  hintOffTimer: number;
  hintPieces: VPiece[];
  hand: boolean;
  finaleRunning: boolean;
  finaleStart: number;
}

const IN_LEVEL: readonly InLevelBooster[] = ['hammer', 'freeSwap', 'shuffle'];
const FREEZE_APP = 1;
const FREEZE_DIALOG = 2;

function isDebug(): boolean {
  try {
    if (import.meta.env && import.meta.env.DEV) return true;
  } catch {
    // no import.meta.env outside Vite
  }
  try {
    return new URLSearchParams(window.location.search).get('debug') === '1';
  } catch {
    return false;
  }
}

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}

/** Moves granted by the rewarded-video continue: from the economy table when it names one, else 3 (DESIGN §7). */
function adContinueMoves(): number {
  const table = econ as unknown as Record<string, unknown>;
  const names = ['AD_CONTINUE_MOVES', 'REWARDED_CONTINUE_MOVES', 'CONTINUE_MOVES_AD', 'CONTINUE_AD_MOVES'];
  for (let i = 0; i < names.length; i++) {
    const v = table[names[i] as string];
    if (typeof v === 'number' && v > 0) return Math.floor(v);
  }
  return 3;
}

export function createPlayScreen(ctx: AppContext, deps?: PlayDeps): PlayScreen {
  const kit: Kit = (deps && deps.kit) || createKit({ art: ctx.art, audio: ctx.audio, i18n: ctx.i18n, platform: ctx.platform });
  const { i18n, profile } = ctx;
  const debug = isDebug();
  let fast = false;
  let seedParam: number | null = null;
  if (debug) {
    try {
      const q = new URLSearchParams(window.location.search);
      fast = q.get('fast') === '1';
      const s = q.get('seed');
      if (s !== null && s !== '' && isFinite(Number(s))) seedParam = Math.floor(Number(s));
    } catch {
      // no URL: defaults
    }
  }
  const speedFactor = fast ? FAST_FACTOR : 1;
  /** Real-time waits of the level flow shrink with `fast=1` too. */
  const rt = (ms: number): number => ms / speedFactor;

  const sched = new Scheduler();
  const timers = new Timers({
    set: (fn, ms) => window.setTimeout(fn, ms),
    clear: (handle) => window.clearTimeout(handle as number),
    now: nowMs,
  });

  let session: Session | null = null;
  let gen = 0;
  let attempt = 0;
  let raf = 0;
  let lastTs = 0;
  let frozen = 0;
  let slowLeft = 0;
  let hintToken = 0;
  const own: DialogHandle<unknown>[] = [];
  /** turns played to the end since the screen was created (test hook) */
  let turnsDone = 0;
  let pauseOpen = false;
  let detachGlobal: (() => void) | null = null;

  // frame statistics (dev overlay / tests) and the low-end switch
  const perf = { frames: 0, total: 0, worst: 0, winFrames: 0, winTotal: 0, lowEnd: false };

  // ───────────────────────────── services ─────────────────────────────

  function sfx(name: SfxName, opts?: SfxOptions): void {
    try {
      ctx.audio.sfx(name, opts);
    } catch {
      // sound is a nicety
    }
  }

  function haptic(kind: HapticKind): void {
    try {
      if (profile.settings().haptics) ctx.platform.haptic(kind);
    } catch {
      // so are haptics
    }
  }

  function reducedEffects(): boolean {
    if (kit.reducedMotion()) return true;
    const s = profile.settings() as unknown as Record<string, unknown>;
    return s.reduceEffects === true;
  }

  sched.onSchedule = kick;
  const hud = createHud({ kit, art: ctx.art, i18n, sched, timers, kick });
  const view = createBoardView(hud.canvas, ctx.art);

  const dialogDeps: DialogDeps = {
    kit,
    i18n,
    art: ctx.art,
    timers,
    sfx,
    track<T>(dialog: DialogHandle<T>): DialogHandle<T> {
      own.push(dialog as DialogHandle<unknown>);
      void dialog.closed.then(() => {
        const at = own.indexOf(dialog as DialogHandle<unknown>);
        if (at >= 0) own.splice(at, 1);
      });
      return dialog;
    },
  };

  // ───────────────────────────── frame loop ─────────────────────────────

  function kick(): void {
    if (raf !== 0 || frozen !== 0 || !session) return;
    lastTs = nowMs();
    raf = requestAnimationFrame(frame);
  }

  function frame(ts: number): void {
    raf = 0;
    if (frozen !== 0 || !session) return;
    let dt = ts - lastTs;
    lastTs = ts;
    if (!(dt > 0)) dt = 0;
    if (dt > 50) dt = 50;
    const t0 = debug ? nowMs() : 0;

    let gameDt = dt * speedFactor;
    if (slowLeft > 0) {
      slowLeft -= dt;
      gameDt *= 0.5;
    }
    sched.step(gameDt);
    view.step(gameDt);
    view.draw();

    // measured frame interval → low-end mode (fewer particles) when it stays above 22 ms
    if (dt > 0) {
      perf.frames++;
      perf.total += dt;
      if (dt > perf.worst) perf.worst = dt;
      perf.winFrames++;
      perf.winTotal += dt;
      if (perf.winTotal >= FEEDBACK.lowEndWindow) {
        const mean = perf.winTotal / perf.winFrames;
        if (!perf.lowEnd && mean > FEEDBACK.lowEndFrame) {
          perf.lowEnd = true;
          view.setLowEnd(true);
        }
        perf.winFrames = 0;
        perf.winTotal = 0;
      }
    }
    if (debug) work.total += nowMs() - t0;
    if (debug) work.frames++;

    if (sched.active() || view.animating() || view.dirty()) raf = requestAnimationFrame(frame);
  }
  /** CPU time spent inside frame() (dev only). */
  const work = { frames: 0, total: 0 };

  function freeze(reason: number): void {
    const was = frozen;
    frozen |= reason;
    if (was !== 0) return;
    if (raf !== 0) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    timers.pause();
    hud.setFrozen(true);
  }

  function unfreeze(reason: number): void {
    if ((frozen & reason) === 0) return;
    frozen &= ~reason;
    if (frozen !== 0) return;
    timers.resume();
    hud.setFrozen(false);
    kick();
  }

  /** Forget a freeze without restarting anything that belongs to a level that is being torn down. */
  function dropFreeze(reason: number): void {
    if ((frozen & reason) === 0) return;
    frozen &= ~reason;
    if (frozen !== 0) return;
    timers.resume();
    hud.setFrozen(false);
  }

  // ───────────────────────────── layout ─────────────────────────────

  function relayout(): void {
    if (!session) return;
    const size = hud.measure();
    if (size.w < 8 || size.h < 8) return;
    const u = kit.unit();
    view.layout(size.w, size.h, Math.round(7 * u), 112 * u);
    hud.setBoardRect(view.rect());
    hud.paintBackdrop(false);
    view.draw();
    kick();
  }

  function attachGlobal(): void {
    if (detachGlobal) return;
    const onResize = (): void => relayout();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(onResize);
      observer.observe(hud.el);
    }
    const unsubscribe = profile.subscribe(() => {
      if (!session) return;
      for (let i = 0; i < IN_LEVEL.length; i++) hud.updateBooster(IN_LEVEL[i] as InLevelBooster, profile.boosterCount(IN_LEVEL[i] as InLevelBooster));
    });
    // a tap anywhere skips the finale
    const onTap = (): void => {
      const s = session;
      if (s && s.state === 'finale' && s.finaleRunning) player.finishNow();
    };
    hud.el.addEventListener('pointerdown', onTap);
    detachGlobal = () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      if (observer) observer.disconnect();
      unsubscribe();
      hud.el.removeEventListener('pointerdown', onTap);
      detachGlobal = null;
    };
  }

  // ───────────────────────────── HUD in step with the animation ─────────────────────────────

  function cellToRoot(x: number, y: number): { x: number; y: number } {
    const rect = view.rect();
    const origin = hud.stageOrigin();
    return { x: origin.x + rect.x + x * rect.cell, y: origin.y + rect.y + y * rect.cell };
  }

  function showMoves(n: number, bump: boolean): void {
    const s = session;
    if (!s) return;
    s.movesShown = n;
    hud.setMoves(n, bump);
    if (n > LOW_MOVES) s.lowCue = false;
    else if (n > 0 && !s.lowCue && s.state === 'play') {
      s.lowCue = true;
      sfx('movesLow');
    }
  }

  function syncHud(snap: Snapshot): void {
    const s = session;
    if (!s) return;
    s.tracker.sync(snap.goals, snap.score);
    hud.setScore(snap.score, true);
    showMoves(snap.movesLeft, false);
    for (let i = 0; i < snap.goals.length; i++) {
      const g = snap.goals[i];
      if (g) hud.setGoal(i, Math.max(0, g.target - g.current), g.done, false);
    }
  }

  const player = createStepPlayer(view, sched, {
    sfx,
    haptic,
    kick,
    dev: debug,
    tracker: () => (session as Session).tracker,
    spendMove() {
      const s = session;
      if (s) showMoves(Math.max(0, s.movesShown - 1), true);
    },
    addScore(points) {
      const s = session;
      if (!s) return;
      const changed = s.tracker.addScore(points);
      hud.setScore(s.tracker.score, true);
      for (let i = 0; i < changed.length; i++) {
        const gi = changed[i] as number;
        hud.setGoal(gi, s.tracker.remaining(gi), s.tracker.done(gi), false);
      }
    },
    goalChanged(index, x, y, fly) {
      const s = session;
      if (!s) return;
      const remaining = s.tracker.remaining(index);
      const done = s.tracker.done(index);
      const goal = s.snap.goals[index];
      const kind = goal ? goal.goal.kind : 'score';
      const to = fly && kind !== 'sand' && kind !== 'score' && goal ? hud.goalCentre(index) : null;
      if (!to || !goal) {
        hud.setGoal(index, remaining, done, true);
        return;
      }
      const my = gen;
      void hud.fly(hud.goalIcon(goal), cellToRoot(x, y), to, T.flyToChip, 26).then(() => {
        if (my === gen) hud.setGoal(index, remaining, done, true);
      });
    },
    cascade(n) {
      hud.chain(n);
    },
    shuffling() {
      hud.note(i18n.t('play.shuffle'), T.shuffleBanner);
    },
    flyMove(x, y, dur) {
      return hud.orb(hud.movesCentre(), cellToRoot(x, y), dur);
    },
    slowMo(ms) {
      if (!reducedEffects()) slowLeft = ms;
    },
  });

  // ───────────────────────────── selection, hint, hand ─────────────────────────────

  function canPick(pos: Pos): boolean {
    const vp = view.pieceAt(pos.c, pos.r);
    return !!vp && !vp.dying && !vp.chained && vp.kind !== 'stone' && vp.kind !== 'vine';
  }

  function scaleTo(vp: VPiece, target: number, ms: number): void {
    const from = vp.sx;
    sched.run(ms, (k) => {
      if (vp.dying) return;
      const s = from + (target - from) * k;
      vp.sx = s;
      vp.sy = s;
    }, outQuad);
    kick();
  }

  function clearSelection(): void {
    const s = session;
    if (!s || !s.selection) return;
    const vp = view.pieceAt(s.selection.c, s.selection.r);
    if (vp && !vp.dying) {
      vp.lift = false;
      scaleTo(vp, 1, T.touchResponse);
    }
    s.selection = null;
    view.setSelection(null);
    kick();
  }

  function select(pos: Pos): void {
    const s = session;
    if (!s) return;
    if (s.selection && !samePos(s.selection, pos)) clearSelection();
    s.selection = pos;
    view.setSelection(pos);
    const vp = view.pieceAt(pos.c, pos.r);
    if (vp) {
      vp.lift = true;
      scaleTo(vp, 1.12, T.touchResponse);
    }
    kick();
  }

  function cancelHint(): void {
    const s = session;
    hintToken++;
    if (!s) return;
    if (s.hintTimer) timers.cancel(s.hintTimer);
    if (s.hintOffTimer) timers.cancel(s.hintOffTimer);
    s.hintTimer = 0;
    s.hintOffTimer = 0;
    for (let i = 0; i < s.hintPieces.length; i++) {
      const vp = s.hintPieces[i] as VPiece;
      vp.ox = 0;
      vp.oy = 0;
    }
    if (s.hintPieces.length > 0) {
      s.hintPieces.length = 0;
      view.setHintCells(null, null);
      kick();
    }
  }

  function isIdle(): boolean {
    const s = session;
    return !!s && s.state === 'play' && !s.busy && !player.busy();
  }

  function armHint(delay?: number): void {
    const s = session;
    if (!s) return;
    cancelHint();
    if (!isIdle() || s.targeting) return;
    s.hintTimer = timers.after(delay === undefined ? hintDelay(s.level.id) : delay, showHint);
  }

  function showHint(): void {
    const s = session;
    if (!s) return;
    s.hintTimer = 0;
    if (!isIdle() || s.selection || s.targeting || kit.hasOverlay()) {
      armHint();
      return;
    }
    let move = s.level.id <= EARLY_LEVELS ? s.game.hint() : null;
    if (!move) {
      // later levels: any valid move — the hint is help, not the best move
      const all = s.game.validMoves();
      move = all.length > 0 ? (all[Math.floor(Math.random() * all.length)] as { a: Pos; b: Pos }) : s.game.hint();
    }
    if (!move) return;
    const a = view.pieceAt(move.a.c, move.a.r);
    const b = view.pieceAt(move.b.c, move.b.r);
    if (!a || !b) return;
    const dx = move.b.c - move.a.c;
    const dy = move.b.r - move.a.r;
    const my = ++hintToken;
    s.hintPieces.length = 0;
    s.hintPieces.push(a, b);
    view.setHintCells(move.a, move.b);
    // two hops toward each other
    sched.run(T.hintBounce, (k) => {
      if (my !== hintToken) return;
      const w = Math.abs(Math.sin(k * Math.PI * 2)) * 0.17;
      a.ox = dx * w;
      a.oy = dy * w;
      b.ox = -dx * w;
      b.oy = -dy * w;
    });
    kick();
    s.hintOffTimer = timers.after(1500, () => {
      s.hintOffTimer = 0;
      if (my !== hintToken) return;
      a.ox = 0;
      a.oy = 0;
      b.ox = 0;
      b.oy = 0;
      s.hintPieces.length = 0;
      view.setHintCells(null, null);
      kick();
    });
    s.hintTimer = timers.after(T.hintRepeat, showHint);
  }

  function hideHand(): void {
    const s = session;
    if (!s || !s.hand) return;
    s.hand = false;
    view.setHand(null, null);
    kick();
  }

  function showHand(): void {
    const s = session;
    if (!s) return;
    const move = s.game.hint();
    if (!move) return;
    s.hand = true;
    view.setHand(move.a, move.b);
    view.setHintCells(move.a, move.b);
    const a = view.pieceAt(move.a.c, move.a.r);
    const b = view.pieceAt(move.b.c, move.b.r);
    s.hintPieces.length = 0;
    if (a) s.hintPieces.push(a);
    if (b) s.hintPieces.push(b);
    kick();
  }

  // ───────────────────────────── turns ─────────────────────────────

  function runTurn(res: TurnResult, opts: PlayOptions): void {
    const s = session;
    if (!s) return;
    const my = gen;
    s.busy = true;
    cancelHint();
    void player.play(res.steps, res.snapshot, opts).then(() => {
      if (my !== gen || !session) return;
      afterTurn(res);
    });
  }

  function afterTurn(res: TurnResult): void {
    const s = session;
    if (!s) return;
    const snap = res.snapshot;
    s.snap = snap;
    turnsDone++;
    syncHud(snap);
    hud.chain(0);
    const stats = turnStats(res.steps);
    if (stats.maxCascade > s.bestCascade) s.bestCascade = stats.maxCascade;
    const tier = praiseTier(stats.maxCascade, stats.pieces);
    if (tier > 0 && snap.status === 'playing' && s.state === 'play') {
      hud.praise(i18n.t(PRAISE_KEYS[tier - 1] as string), tier as 1 | 2 | 3 | 4);
      sfx('praise', { step: tier });
      if (tier >= 3 && !reducedEffects()) view.shake(FEEDBACK.shakeBig, T.shakeBig);
      kick();
    }
    s.busy = false;
    if (s.state !== 'play') return;
    if (snap.status === 'won') {
      onWon();
      return;
    }
    if (snap.status === 'lost') {
      onLost();
      return;
    }
    if (!runBuffered()) {
      if (s.invalidStreak >= INVALID_FOR_HINT) {
        s.invalidStreak = 0;
        armHint(60);
      } else armHint();
    }
  }

  /** The swipe made while the board was resolving: run it if it is still valid, else drop it silently. */
  function runBuffered(): boolean {
    const s = session;
    if (!s || !s.buffered) return false;
    const b = s.buffered;
    s.buffered = null;
    if (nowMs() - b.at > rt(T.bufferExpiry)) return false;
    if (s.targeting) return false;
    if (!s.game.canSwap(b.a, b.b)) return false;
    return attemptSwap(b.a, b.b);
  }

  function nudge(pos: Pos): void {
    const vp = view.pieceAt(pos.c, pos.r);
    if (!vp) return;
    sched.run(T.invalidWobble * 2, (k) => {
      vp.ox = Math.sin(k * Math.PI * 4) * 0.06 * (1 - k);
    });
    kick();
  }

  function attemptSwap(a: Pos, b: Pos): boolean {
    const s = session;
    if (!s || s.state !== 'play') return false;
    if (!view.exists(a.c, a.r) || !view.exists(b.c, b.r) || !isAdjacent(a, b)) return false;
    if (s.busy) {
      s.buffered = { a, b, at: nowMs() };
      return false;
    }
    clearSelection();
    cancelHint();
    if (s.targeting === 'freeSwap') return useTargeted('freeSwap', a, b);
    if (s.targeting) return false;
    const res = s.game.swap(a, b);
    if (!res.accepted) {
      s.invalidStreak++;
      if (res.steps.length > 0) runTurn(res, { swapCostsMove: false });
      else {
        sfx('invalid');
        haptic('error');
        nudge(a);
        afterInvalid();
      }
      return false;
    }
    s.invalidStreak = 0;
    s.movesMade++;
    hideHand();
    runTurn(res, { swapCostsMove: true });
    return true;
  }

  function afterInvalid(): void {
    const s = session;
    if (!s) return;
    if (s.invalidStreak >= INVALID_FOR_HINT) {
      s.invalidStreak = 0;
      armHint(60);
    } else armHint();
  }

  // ───────────────────────────── boosters ─────────────────────────────

  function refreshBoosters(): void {
    const slots: { id: InLevelBooster; count: number }[] = [];
    for (let i = 0; i < IN_LEVEL.length; i++) {
      const id = IN_LEVEL[i] as InLevelBooster;
      if (profile.boosterUnlocked && profile.boosterUnlocked(id) === false) continue;
      slots.push({ id, count: profile.boosterCount(id) });
    }
    hud.setBoosters(slots);
  }

  function exitTargeting(): void {
    const s = session;
    if (!s || !s.targeting) return;
    s.targeting = null;
    hud.targeting(null, null, null);
    hud.setBoosterActive(null);
    view.setTargeting(false);
    kick();
    armHint();
  }

  function enterTargeting(id: InLevelBooster): void {
    const s = session;
    if (!s) return;
    s.targeting = id;
    hud.targeting(i18n.t('play.target.' + id), id as IconName, exitTargeting);
    hud.setBoosterActive(id);
    view.setTargeting(true);
    sfx('select');
    kick();
  }

  function useTargeted(id: InLevelBooster, a: Pos, b?: Pos): boolean {
    const s = session;
    if (!s || s.busy) return false;
    const res = s.game.useBooster(id, a, b);
    if (!res.accepted) {
      kit.toast(i18n.t(id === 'hammer' ? 'play.booster.noEffect' : 'play.booster.noSwap'));
      if (res.steps.length > 0) runTurn(res, { swapCostsMove: false });
      else {
        sfx('invalid');
        haptic('error');
        nudge(a);
      }
      return false;
    }
    profile.takeBooster(id);
    s.movesMade++;
    hideHand();
    exitTargeting();
    cancelHint();
    runTurn(res, { swapCostsMove: false });
    return true;
  }

  function onBooster(id: InLevelBooster): void {
    const s = session;
    if (!s || s.state !== 'play' || s.busy || player.busy()) return;
    cancelHint();
    clearSelection();
    if (s.targeting) {
      const same = s.targeting === id;
      exitTargeting();
      if (same) return;
    }
    if (profile.boosterCount(id) <= 0) {
      offerBooster(id);
      return;
    }
    if (id === 'shuffle') {
      const res = s.game.useBooster('shuffle');
      if (!res.accepted) {
        kit.toast(i18n.t('play.booster.noShuffle'));
        armHint();
        return;
      }
      profile.takeBooster('shuffle');
      s.movesMade++;
      runTurn(res, { swapCostsMove: false });
      return;
    }
    enterTargeting(id);
  }

  function shopVisible(): boolean {
    return !(profile.featureUnlocked && profile.featureUnlocked('shop') === false);
  }

  function rewardedOk(): boolean {
    if (profile.featureUnlocked && profile.featureUnlocked('rewardedAds') === false) return false;
    try {
      return ctx.store.rewardedReady();
    } catch {
      return false;
    }
  }

  function offerBooster(id: InLevelBooster): void {
    const my = gen;
    const dialog = openBuyBooster(dialogDeps, {
      id,
      price: profile.boosterPrice(id),
      coins: profile.coins(),
      showShop: shopVisible(),
      onBuy: () => {
        if (!profile.buyBooster(id)) return false;
        sfx('purchase');
        return true;
      },
    });
    void dialog.closed.then((choice) => {
      if (my !== gen || !session) return;
      if (choice === 'bought') onBooster(id);
      else if (choice === 'shop') void ctx.nav.openShop().then(() => my === gen && armHint());
      else armHint();
    });
  }

  // ───────────────────────────── win ─────────────────────────────

  function finaleSpeed(): number {
    const s = session;
    if (!s) return 1;
    const elapsed = (nowMs() - s.finaleStart) * speedFactor;
    return elapsed < 2600 ? 1 : elapsed < 3600 ? 1.7 : 2.8;
  }

  function onWon(): void {
    const s = session;
    if (!s) return;
    const my = gen;
    s.state = 'finale';
    s.busy = true;
    s.buffered = null;
    clearSelection();
    cancelHint();
    hideHand();
    if (s.targeting) exitTargeting();
    sfx('goalDone');
    haptic('success');
    hud.praise(i18n.t(FINALE_KEY), 'finale');
    kick();
    timers.after(rt(T.finaleBanner), () => {
      if (my !== gen || !session) return;
      const res = s.game.endBonus();
      if (!res.accepted || res.steps.length === 0) {
        if (res.accepted) s.snap = res.snapshot;
        showWin();
        return;
      }
      s.finaleRunning = true;
      s.finaleStart = nowMs();
      // whatever happens, the finale is over after 5 s
      const cap = timers.after(rt(T.finaleMax), () => player.finishNow());
      void player.play(res.steps, res.snapshot, { swapCostsMove: false, speed: finaleSpeed, finaleBudget: 2200 }).then(() => {
        timers.cancel(cap);
        if (my !== gen || !session) return;
        s.finaleRunning = false;
        s.snap = res.snapshot;
        syncHud(res.snapshot);
        hud.chain(0);
        const stats = turnStats(res.steps);
        if (stats.maxCascade > s.bestCascade) s.bestCascade = stats.maxCascade;
        showWin();
      });
    });
  }

  function leave(action: () => void, interstitial: boolean): void {
    const my = gen;
    const go = (): void => {
      if (my !== gen) return;
      action();
    };
    if (!interstitial) {
      go();
      return;
    }
    let shown: Promise<unknown>;
    try {
      shown = ctx.store.maybeShowInterstitial();
    } catch {
      shown = Promise.resolve(false);
    }
    void Promise.resolve(shown).then(go, go);
  }

  function showWin(): void {
    const s = session;
    if (!s) return;
    const my = gen;
    s.state = 'won';
    const snap = s.snap;
    const stars = (snap.stars < 1 ? 1 : snap.stars > 3 ? 3 : snap.stars) as 1 | 2 | 3;
    const summary = profile.recordWin(s.level.id, stars, snap.score, s.bestCascade);
    const id = s.level.id;
    const hasNext = id < ctx.levels.length;
    sfx('win');
    openWin(dialogDeps, {
      stars,
      score: snap.score,
      newBest: summary.newBest && !summary.firstClear,
      coins: summary.coinsEarned,
      canDouble: summary.coinsEarned > 0 && rewardedOk(),
      onDouble: () =>
        ctx.store.showRewarded('doubleReward').then(
          (outcome) => {
            if (my !== gen) return false;
            if (outcome === 'earned') {
              profile.addCoins(summary.coinsEarned);
              sfx('reward');
              return true;
            }
            if (outcome === 'unavailable') kit.toast(i18n.t('play.noVideo'));
            return false;
          },
          () => false,
        ),
      onNext: () =>
        leave(() => {
          ctx.nav.toMap({ justWon: id });
          if (hasNext) ctx.nav.openLevelIntro(id + 1);
        }, true),
      onMap: () => leave(() => ctx.nav.toMap({ justWon: id }), true),
    });
  }

  // ───────────────────────────── lose ─────────────────────────────

  function takeLife(): void {
    const s = session;
    if (!s || s.lifeTaken) return;
    s.lifeTaken = true;
    profile.loseLife();
    sfx('lifeLost');
  }

  function continuePrice(used: number): number | null {
    if (profile.continuePrice) return profile.continuePrice(used);
    const prices = econ.CONTINUE_PRICES;
    return used >= 0 && used < prices.length ? (prices[used] as number) : null;
  }

  function onLost(): void {
    const s = session;
    if (!s) return;
    const my = gen;
    s.state = 'lost';
    s.busy = true;
    s.buffered = null;
    clearSelection();
    cancelHint();
    hideHand();
    if (s.targeting) exitTargeting();
    hud.setMovesState('out');
    sfx('lose');
    sched.run(T.loseDim, (k) => view.setDim(0.4 * k));
    kick();
    timers.after(rt(T.loseDim), () => {
      if (my === gen && session) showLose();
    });
  }

  function resumeAfterContinue(res: TurnResult): void {
    const s = session;
    if (!s) return;
    s.state = 'play';
    s.lowCue = true;
    hud.setMovesState('normal');
    const from = 0.4;
    sched.run(200, (k) => view.setDim(from * (1 - k)));
    runTurn(res, { swapCostsMove: false });
  }

  function showLose(): void {
    const s = session;
    if (!s) return;
    const my = gen;
    const snap = s.snap;
    const canContinue = snap.canContinue !== false;
    const price = continuePrice(s.continues);
    const coinMoves = econ.CONTINUE_MOVES;
    const adMoves = adContinueMoves();
    openLose(dialogDeps, {
      goals: snap.goals,
      canContinue,
      price,
      coinMoves,
      adOffer: !s.adUsed && rewardedOk(),
      adMoves,
      coins: () => profile.coins(),
      caravan: (profile.caravan && profile.caravan()) || 0,
      showShop: shopVisible(),
      onCoins: () => {
        if (my !== gen || price === null || s.state !== 'lost') return false;
        if (s.game.snapshot().canContinue === false) return false;
        if (!profile.spendCoins(price)) return false;
        const res = s.game.addMoves(coinMoves);
        if (!res.accepted) {
          profile.addCoins(price);
          return false;
        }
        s.continues++;
        sfx('purchase');
        resumeAfterContinue(res);
        return true;
      },
      onAd: () =>
        ctx.store.showRewarded('extraMoves').then(
          (outcome) => {
            if (my !== gen || s.state !== 'lost') return false;
            if (outcome !== 'earned') {
              if (outcome === 'unavailable') kit.toast(i18n.t('play.noVideo'));
              return false;
            }
            const res = s.game.addMoves(adMoves);
            if (!res.accepted) return false;
            s.adUsed = true;
            sfx('reward');
            resumeAfterContinue(res);
            return true;
          },
          () => false,
        ),
      onShop: () => ctx.nav.openShop(),
      onRetry: () => {
        if (my !== gen) return;
        retry();
      },
      onGiveUp: () => {
        if (my !== gen) return;
        takeLife();
        leave(() => ctx.nav.toMap({ focusLevel: s.level.id }), true);
      },
    });
  }

  /** A failed or abandoned attempt costs its life, then the level restarts — or the map explains there are none left. */
  function retry(): void {
    const s = session;
    if (!s) return;
    const level = s.level;
    takeLife();
    if (profile.lives().count > 0) {
      attempt++;
      begin(level, {}, true);
    } else {
      ctx.nav.toMap({ focusLevel: level.id });
      ctx.nav.openLevelIntro(level.id);
    }
  }

  // ───────────────────────────── pause ─────────────────────────────

  function leaveWarnings(): string[] {
    const warn = [i18n.t('play.costLife')];
    const caravan = (profile.caravan && profile.caravan()) || 0;
    if (caravan > 0) warn.push(i18n.t('play.caravanReset', { n: caravan }));
    return warn;
  }

  function openPauseDialog(): void {
    const s = session;
    if (!s || pauseOpen || (s.state !== 'play' && s.state !== 'intro')) return;
    const my = gen;
    pauseOpen = true;
    clearSelection();
    cancelHint();
    if (s.targeting) exitTargeting();
    freeze(FREEZE_DIALOG);
    const dialog = openPause(dialogDeps, {
      settings: profile.settings(),
      onSetting: (key, value) => {
        profile.setSetting(key, value);
        if (key === 'sfx') ctx.audio.setSfxEnabled(value);
        else if (key === 'music') ctx.audio.setMusicEnabled(value);
        else if (value) haptic('light');
      },
    });
    void dialog.closed.then((choice) => {
      pauseOpen = false;
      if (my !== gen || !session) return;
      if (choice !== 'restart' && choice !== 'quit') {
        unfreeze(FREEZE_DIALOG);
        armHint();
        return;
      }
      const costly = s.movesMade > 0;
      const restart = choice === 'restart';
      const act = (): void => {
        if (my !== gen || !session) return;
        unfreeze(FREEZE_DIALOG);
        if (costly) takeLife();
        if (restart) {
          if (!costly) {
            attempt++;
            begin(s.level, s.boosters, true);
          } else if (profile.lives().count > 0) {
            attempt++;
            begin(s.level, {}, true);
          } else {
            ctx.nav.toMap({ focusLevel: s.level.id });
            ctx.nav.openLevelIntro(s.level.id);
          }
        } else {
          // never an interstitial on a way out through Back / quit
          ctx.nav.toMap({ focusLevel: s.level.id });
        }
      };
      if (!costly) {
        act();
        return;
      }
      void openConfirm(dialogDeps, {
        title: i18n.t(restart ? 'play.restart.title' : 'play.quit.title'),
        lines: [i18n.t(restart ? 'play.restart.text' : 'play.quit.text')],
        warn: leaveWarnings(),
        yes: i18n.t(restart ? 'play.restart.yes' : 'play.quit.yes'),
        no: i18n.t('play.stay'),
        icon: 'heart',
      }).then((yes) => {
        if (my !== gen || !session) return;
        if (yes) act();
        else {
          unfreeze(FREEZE_DIALOG);
          armHint();
        }
      });
    });
  }

  // ───────────────────────────── input ─────────────────────────────

  let dragOther: VPiece | null = null;
  let dragPiece: VPiece | null = null;

  function resetDrag(animated: boolean): void {
    const a = dragPiece;
    const b = dragOther;
    dragPiece = null;
    dragOther = null;
    const settle = (vp: VPiece | null): void => {
      if (!vp || vp.dying) return;
      if (!animated) {
        vp.ox = 0;
        vp.oy = 0;
        return;
      }
      const ox = vp.ox;
      const oy = vp.oy;
      sched.run(T.snapBack, (k) => {
        vp.ox = ox * (1 - k);
        vp.oy = oy * (1 - k);
      }, outQuad);
    };
    settle(a);
    settle(b);
    kick();
  }

  attachInput(hud.canvas, {
    mode(): InputMode {
      const s = session;
      if (!s || frozen !== 0 || s.state !== 'play') return 'off';
      return s.busy || player.busy() ? 'buffer' : 'live';
    },
    cellAt(clientX, clientY) {
      const box = hud.canvas.getBoundingClientRect();
      const pos = cellAtPoint(view.rect(), view.cols(), view.rows(), clientX - box.left, clientY - box.top);
      return pos && view.exists(pos.c, pos.r) ? pos : null;
    },
    cellSize: () => view.rect().cell,
    touch() {
      const s = session;
      if (!s) return;
      try {
        ctx.audio.unlock();
      } catch {
        // nothing to unlock
      }
      if (isIdle()) armHint();
      else cancelHint();
    },
    down(cell) {
      const s = session;
      if (!s) return false;
      if (s.targeting === 'hammer') return true;
      if (!canPick(cell)) {
        // a tap on a blocker or an empty tile just drops the selection
        clearSelection();
        armHint();
        return false;
      }
      const vp = view.pieceAt(cell.c, cell.r);
      if (vp && !(s.selection && samePos(s.selection, cell))) {
        vp.lift = true;
        scaleTo(vp, 1.12, T.touchResponse);
        sfx('select');
      }
      return true;
    },
    drag(cell, dc, dr, amount) {
      const s = session;
      if (!s || s.targeting === 'hammer') return;
      const vp = view.pieceAt(cell.c, cell.r);
      if (!vp || vp.dying) return;
      const tc = cell.c + dc;
      const tr = cell.r + dr;
      const other = view.exists(tc, tr) ? view.pieceAt(tc, tr) : null;
      const partner = other && !other.dying && canPick({ c: tc, r: tr }) ? other : null;
      if (dragOther && dragOther !== partner) {
        dragOther.ox = 0;
        dragOther.oy = 0;
      }
      dragPiece = vp;
      dragOther = partner;
      // against an edge, a hole or a blocker the gem only leans a little
      const a = partner ? amount : Math.min(amount, 0.16);
      vp.ox = dc * a;
      vp.oy = dr * a;
      if (partner) {
        partner.ox = -dc * a;
        partner.oy = -dr * a;
      }
      view.invalidate();
      kick();
    },
    up(cell, swipe, wasDrag, mode) {
      const s = session;
      if (!s || s.state !== 'play') {
        resetDrag(false);
        return;
      }
      if (mode === 'buffer') {
        // made while the board was resolving: remember one swipe, show nothing
        if (swipe && view.exists(swipe.c, swipe.r)) s.buffered = { a: cell, b: swipe, at: nowMs() };
        return;
      }
      if (s.busy) {
        resetDrag(true);
        return;
      }
      if (s.targeting === 'hammer') {
        useTargeted('hammer', cell);
        return;
      }
      const vp = view.pieceAt(cell.c, cell.r);
      if (wasDrag) {
        if (swipe && view.exists(swipe.c, swipe.r) && canPick(swipe)) {
          // keep the offsets: the swap animation starts from where the finger let go
          dragPiece = null;
          dragOther = null;
          attemptSwap(cell, swipe);
        } else {
          resetDrag(true);
          if (vp && !(s.selection && samePos(s.selection, cell))) {
            vp.lift = false;
            scaleTo(vp, 1, T.snapBack);
          }
          armHint();
        }
        return;
      }
      // a tap
      const sel = s.selection;
      if (sel && samePos(sel, cell)) {
        clearSelection();
        armHint();
      } else if (sel && isAdjacent(sel, cell)) {
        attemptSwap(sel, cell);
      } else {
        select(cell);
        armHint();
      }
    },
    cancel(cell) {
      resetDrag(true);
      const s = session;
      const vp = view.pieceAt(cell.c, cell.r);
      if (s && vp && !(s.selection && samePos(s.selection, cell))) {
        vp.lift = false;
        scaleTo(vp, 1, T.snapBack);
      }
    },
  });

  hud.onPause = () => openPauseDialog();
  hud.onBooster = (id) => onBooster(id);

  // ───────────────────────────── level flow ─────────────────────────────

  function teardown(): void {
    gen++;
    player.cancel();
    sched.clear();
    timers.clear();
    if (raf !== 0) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    const open = own.slice();
    for (let i = 0; i < open.length; i++) (open[i] as DialogHandle<unknown>).close();
    own.length = 0;
    pauseOpen = false;
    hud.clearTransient();
    view.clearEffects();
    view.setSelection(null);
    view.setHintCells(null, null);
    view.setHand(null, null);
    view.setTargeting(false);
    view.setDim(0);
    dragPiece = null;
    dragOther = null;
    dropFreeze(FREEZE_DIALOG);
    slowLeft = 0;
    session = null;
  }

  function begin(level: LevelDef, boosters: StartBoosters, isRetry: boolean): void {
    teardown();
    const my = gen;
    const seed = seedParam !== null ? seedParam + attempt : (Math.floor(Math.random() * 0x7fffffff) ^ (Date.now() & 0x7fffffff)) >>> 0;
    const game = new Game(level, { seed, boosters });
    const snap = game.snapshot();
    const s: Session = {
      level,
      boosters,
      game,
      snap,
      tracker: createGoalTracker(snap.goals, snap.score),
      state: 'intro',
      busy: true,
      movesShown: snap.movesLeft,
      movesMade: 0,
      continues: 0,
      adUsed: false,
      lifeTaken: false,
      invalidStreak: 0,
      bestCascade: 0,
      lowCue: false,
      targeting: null,
      selection: null,
      buffered: null,
      hintTimer: 0,
      hintOffTimer: 0,
      hintPieces: [],
      hand: false,
      finaleRunning: false,
      finaleStart: 0,
    };
    session = s;
    try {
      profile.recordAttempt();
    } catch (err) {
      if (typeof console !== 'undefined') console.error('[play] recordAttempt failed', err);
    }
    attachGlobal();
    view.setReducedEffects(reducedEffects());
    view.setLowEnd(perf.lowEnd);
    hud.setLevel(level, snap.goals, chapterOf(level.id).theme);
    hud.setMoves(snap.movesLeft, false);
    hud.setScore(snap.score, false);
    refreshBoosters();
    const lampLevel = !!level.lamps || level.goals.some((g) => g.kind === 'lamp');
    view.setBoard(snap, lampLevel);
    relayout();
    try {
      ctx.audio.music('level');
    } catch {
      // music is a nicety
    }
    sfx('levelStart');

    const tip = level.tutorial;
    const showTip = !isRetry && isTipId(tip) && !profile.hasSeen(tipSeenKey(tip));
    if (!isRetry) hud.goalBanner(level, snap.goals);
    void player.dropIn().then(() => {
      if (my !== gen || !session) return;
      const ready = (guide: boolean): void => {
        if (my !== gen || !session) return;
        s.state = 'play';
        s.busy = false;
        if (s.movesShown <= LOW_MOVES) showMoves(s.movesShown, false);
        if (guide) showHand();
        else if (!runBuffered()) armHint();
      };
      if (!showTip || !isTipId(tip)) {
        ready(false);
        return;
      }
      // the goal banner leaves first, then the tip explains the new thing
      timers.after(rt(T.goalBannerIn + T.goalBannerHold + T.goalBannerOut) - rt(T.dropIn), () => {
        if (my !== gen || !session) return;
        const dialog = openTip(dialogDeps, tip);
        void dialog.closed.then(() => {
          if (my !== gen || !session) return;
          profile.markSeen(tipSeenKey(tip));
          ready(tip === 'match');
        });
      });
    });
  }

  // ───────────────────────────── test hooks ─────────────────────────────

  if (debug) {
    const hooks = {
      snapshot: () => (session ? session.game.snapshot() : null),
      isIdle: () => isIdle() && frozen === 0,
      hint: () => (session ? session.game.hint() : null),
      swap: (a: Pos, b: Pos) => attemptSwap(a, b),
      cell: (c: number, r: number) => {
        const box = hud.canvas.getBoundingClientRect();
        const rect = view.rect();
        return { x: box.left + rect.x + (c + 0.5) * rect.cell, y: box.top + rect.y + (r + 0.5) * rect.cell };
      },
      status: () => (session ? session.game.snapshot().status : 'none'),
      state: () => (session ? session.state : 'none'),
      level: () => (session ? session.level.id : 0),
      /** turns (moves, boosters, rejected swaps) whose animation has finished */
      turns: () => turnsDone,
      validMoves: () => (session ? session.game.validMoves() : []),
      shown: () => (session ? { moves: session.movesShown, score: session.tracker.score, cell: view.rect().cell } : null),
      perf: () => ({
        frames: perf.frames,
        meanInterval: perf.frames > 0 ? perf.total / perf.frames : 0,
        worstInterval: perf.worst,
        meanWork: work.frames > 0 ? work.total / work.frames : 0,
        lowEnd: perf.lowEnd,
        particles: view.particleCount(),
      }),
      loop: () => ({ running: raf !== 0, tweens: sched.count(), timers: timers.count(), dialogs: own.length, frozen }),
      finish: () => player.finishNow(),
    };
    (window as unknown as { __play: typeof hooks }).__play = hooks;
  }

  // ───────────────────────────── public surface ─────────────────────────────

  return {
    el: hud.el,
    start(level, boosters) {
      attempt = 0;
      begin(level, boosters || {}, false);
    },
    stop() {
      teardown();
      if (detachGlobal) detachGlobal();
    },
    handleBack() {
      const s = session;
      if (!s) return false;
      if (s.targeting) {
        exitTargeting();
        return true;
      }
      if (kit.hasOverlay()) {
        kit.closeTop();
        return true;
      }
      if (s.state === 'finale') {
        if (s.finaleRunning) player.finishNow();
        return true;
      }
      if (s.state === 'play' || s.state === 'intro') openPauseDialog();
      return true;
    },
    setPaused(paused) {
      if (paused) freeze(FREEZE_APP);
      else unfreeze(FREEZE_APP);
    },
  };
}
