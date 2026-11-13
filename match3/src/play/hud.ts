/**
 * The DOM side of the play screen: backdrop, header panel (level, goal chips, moves medallion,
 * score + star bar, pause), the stage that holds the board canvas, the booster tray, banners and
 * the flyers that cross the HUD (lamps to their goal chip, end-bonus sparks from the moves
 * counter to the board).
 *
 * Layout is CSS (./play.css): portrait = header / board / tray, landscape = HUD beside the board.
 * Everything mirrors in Arabic except the board itself.
 */
import './play.css';
import type { ArtApi, ChapterTheme } from '../art/types.ts';
import type { GoalProgress, InLevelBooster, LevelDef } from '../engine/types.ts';
import type { I18nApi } from '../i18n/types.ts';
import type { IconName, Kit, KitButton, Progress } from '../ui/kit/index.ts';
import type { Scheduler, Timers } from './anim.ts';
import { inOutQuad, outCubic } from './ease.ts';
import type { BoardRect } from './geometry.ts';
import { isLandscape } from './geometry.ts';
import { LOW_MOVES, T } from './timing.ts';

export interface HudDeps {
  kit: Kit;
  art: ArtApi;
  i18n: I18nApi;
  sched: Scheduler;
  timers: Timers;
  /** ask for animation frames (flyers are driven by the scheduler) */
  kick(): void;
}

export interface Point {
  x: number;
  y: number;
}

export interface StageSize {
  w: number;
  h: number;
  landscape: boolean;
  compact: boolean;
}

export interface Hud {
  readonly el: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly stage: HTMLElement;
  onPause: (() => void) | null;
  onBooster: ((id: InLevelBooster) => void) | null;

  setLevel(level: LevelDef, goals: readonly GoalProgress[], theme: ChapterTheme): void;
  setMoves(n: number, bump: boolean): void;
  /** 'out' = no moves left (lost) */
  setMovesState(state: 'normal' | 'low' | 'out'): void;
  setScore(score: number, animate: boolean): void;
  setGoal(index: number, remaining: number, done: boolean, bump: boolean): void;
  /** Centre of a goal chip / of the moves numeral, relative to the screen root. */
  goalCentre(index: number): Point | null;
  movesCentre(): Point;
  /** Top-left corner of the stage relative to the screen root. */
  stageOrigin(): Point;

  setBoosters(slots: readonly { id: InLevelBooster; count: number }[]): void;
  updateBooster(id: InLevelBooster, count: number): void;
  setBoosterActive(id: InLevelBooster | null): void;

  /** Apply the orientation / compact classes and return the stage size in CSS px. */
  measure(): StageSize;
  setBoardRect(rect: BoardRect): void;
  paintBackdrop(force: boolean): void;

  goalBanner(level: LevelDef, goals: readonly GoalProgress[]): void;
  praise(text: string, tier: 1 | 2 | 3 | 4 | 'finale'): void;
  note(text: string, ms: number): void;
  chain(n: number): void;
  targeting(text: string | null, icon: IconName | null, onCancel: (() => void) | null): void;

  /** A sprite flying from a → b (root coordinates), in game time. */
  fly(icon: IconName, from: Point, to: Point, dur: number, size: number): Promise<void>;
  /** A bright spark flying from a → b. */
  orb(from: Point, to: Point, dur: number): Promise<void>;

  setFrozen(on: boolean): void;
  clearTransient(): void;
  /** Flyers and sparks crossing the HUD right now (test hook). */
  flyerCount(): number;
  goalText(goal: GoalProgress): string;
  goalIcon(goal: GoalProgress): IconName;
}

interface GoalChip {
  el: HTMLElement;
  n: HTMLElement;
  shown: string;
  done: boolean;
  /** a score goal: its number is written with thousands separators */
  score: boolean;
}

export function goalIconOf(goal: GoalProgress): IconName {
  const g = goal.goal;
  switch (g.kind) {
    case 'color':
      return ('gem' + g.color) as IconName;
    case 'lamp':
      return 'lamp';
    case 'sand':
      return 'goalSand';
    case 'stone':
      return 'goalStone';
    case 'vine':
      return 'goalVine';
    case 'chain':
      return 'goalChain';
    default:
      return 'goalScore';
  }
}

export function createHud(deps: HudDeps): Hud {
  const { kit, art, i18n, sched, timers } = deps;
  const el = kit.el;

  // ── structure ──
  const bg = el('canvas', { class: 'pl-bg', 'aria-hidden': 'true' });
  const veil = el('div', { class: 'pl-veil' });

  const levelLabel = el('div', { class: 'pl-level' });
  const goalsBox = el('div', { class: 'pl-goals' });
  const sideGoals = el('div', { class: 'pl-hud__side pl-hud__side--goals' }, levelLabel, goalsBox);

  const movesN = el('span', { class: 'pl-moves__n k-num' }, '0');
  const movesCap = el('span', { class: 'pl-moves__cap' });
  const movesBox = el('div', { class: 'pl-moves', role: 'status' }, el('div', { class: 'pl-moves__ring' }, el('div', { class: 'pl-moves__core' }, movesN, movesCap)));

  const scoreCap = el('span', { class: 'pl-score__cap' });
  const scoreN = el('span', { class: 'pl-score__n k-num' }, '0');
  const pauseBtn = kit.iconButton({
    icon: 'pause',
    ariaLabel: i18n.t('common.pause'),
    variant: 'secondary',
    size: 'sm',
    className: 'pl-pause',
    onClick: () => {
      if (hud.onPause) hud.onPause();
    },
  });
  const barBox = el('div', { class: 'pl-bar' });
  const sideScore = el('div', { class: 'pl-hud__side pl-hud__side--score' }, el('div', { class: 'pl-scorerow' }, el('div', { class: 'pl-score' }, scoreCap, scoreN), pauseBtn), barBox);

  const header = el('div', { class: 'pl-hud' }, el('div', { class: 'pl-hud__in' }, sideGoals, movesBox, sideScore));

  const canvas = el('canvas', { class: 'pl-board' });
  const over = el('div', { class: 'pl-over' });
  const stage = el('div', { class: 'pl-stage' }, canvas, over);

  const trayIn = el('div', { class: 'pl-tray__in' });
  const tray = el('div', { class: 'pl-tray pl-tray--empty' }, trayIn);

  const flyLayer = el('div', { class: 'pl-fly' });
  const root = el('div', { class: 'pl-root' }, bg, veil, el('div', { class: 'pl-grid' }, header, stage, tray), flyLayer);

  // ── state ──
  let chips: GoalChip[] = [];
  let bar: Progress | null = null;
  let shownScore = 0;
  let scoreTween = 0;
  let theme: ChapterTheme = 'oasis';
  let bgKey = '';
  let movesState: 'normal' | 'low' | 'out' = 'normal';
  const boosters: { id: InLevelBooster; wrap: HTMLElement; btn: KitButton }[] = [];
  let chainEl: HTMLElement | null = null;
  let chainTimer = 0;
  let targetEl: HTMLElement | null = null;
  const transient: HTMLElement[] = [];

  function goalText(goal: GoalProgress): string {
    const g = goal.goal;
    switch (g.kind) {
      case 'score':
        return i18n.t('goal.score', { n: g.target });
      case 'color':
        return i18n.t('goal.colorNamed', { n: g.target, gem: i18n.t('gem.' + g.color) });
      case 'lamp':
        return i18n.t('goal.lamp', { n: g.target });
      default:
        return i18n.t('goal.' + g.kind);
    }
  }

  function chipText(goal: GoalProgress, remaining: number): string {
    return goal.goal.kind === 'score' ? i18n.num(remaining) : String(remaining);
  }

  function makeChip(goal: GoalProgress, remaining: number, done: boolean, iconSize: number): GoalChip {
    const text = chipText(goal, remaining);
    const n = el('span', { class: 'pl-goal__n k-num' }, text);
    const icon = kit.icon(goalIconOf(goal), iconSize);
    icon.classList.add('pl-goal__icon');
    const chip = el('div', { class: 'pl-goal' + (done ? ' pl-goal--done' : ''), title: goalText(goal) }, icon, n, el('span', { class: 'pl-goal__tick' }, kit.icon('check', 16)));
    return { el: chip, n, shown: text, done, score: goal.goal.kind === 'score' };
  }

  function rootRect(): DOMRect {
    return root.getBoundingClientRect();
  }

  function centreOf(node: Element): Point {
    const r = node.getBoundingClientRect();
    const o = rootRect();
    return { x: r.left + r.width / 2 - o.left, y: r.top + r.height / 2 - o.top };
  }

  function bumpClass(node: HTMLElement): void {
    node.classList.remove('pl-bump');
    void node.offsetWidth;
    node.classList.add('pl-bump');
  }

  function removeLater(node: HTMLElement, ms: number, outMs: number): void {
    transient.push(node);
    timers.after(ms, () => {
      node.classList.add('pl-out');
      timers.after(outMs, () => drop(node));
    });
  }

  function drop(node: HTMLElement): void {
    if (node.parentNode) node.parentNode.removeChild(node);
    const at = transient.indexOf(node);
    if (at >= 0) transient.splice(at, 1);
  }

  /**
   * The targeting banner lies over the (dimmed) header, so it never covers a tile the player may
   * want to tap.
   */
  function placeTarget(): void {
    if (!targetEl) return;
    const r = header.getBoundingClientRect();
    const o = rootRect();
    targetEl.style.left = r.left - o.left + 'px';
    targetEl.style.top = r.top - o.top + 'px';
    targetEl.style.width = r.width + 'px';
    targetEl.style.height = r.height + 'px';
  }

  /** The eight-pointed star behind a praise word (two overlapped squares, our own motif). */
  function khatam(size: number): HTMLCanvasElement {
    const px = Math.round(size * kit.unit());
    let ratio = 1;
    try {
      ratio = Math.min(2, window.devicePixelRatio || 1);
    } catch {
      ratio = 1;
    }
    const c = el('canvas', { class: 'pl-praise__spark', 'aria-hidden': 'true' });
    c.width = Math.round(px * ratio);
    c.height = Math.round(px * ratio);
    c.style.width = px + 'px';
    c.style.height = px + 'px';
    const g = c.getContext('2d');
    if (!g) return c;
    const m = c.width / 2;
    const grad = g.createRadialGradient(m, m, 0, m, m, m);
    grad.addColorStop(0, 'rgba(255,246,220,0.95)');
    grad.addColorStop(0.45, 'rgba(245,201,90,0.55)');
    grad.addColorStop(1, 'rgba(245,201,90,0)');
    g.fillStyle = grad;
    g.translate(m, m);
    const half = m * 0.62;
    for (let i = 0; i < 2; i++) {
      g.rotate(i === 0 ? 0 : Math.PI / 4);
      g.fillRect(-half, -half, half * 2, half * 2);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    // thin rays
    g.translate(m, m);
    g.fillStyle = 'rgba(255,240,190,0.5)';
    for (let i = 0; i < 8; i++) {
      g.rotate(Math.PI / 4);
      g.beginPath();
      g.moveTo(0, -m);
      g.lineTo(m * 0.05, -m * 0.4);
      g.lineTo(-m * 0.05, -m * 0.4);
      g.closePath();
      g.fill();
    }
    return c;
  }

  const hud: Hud = {
    el: root,
    canvas,
    stage,
    onPause: null,
    onBooster: null,

    setLevel(level, goals, newTheme) {
      theme = newTheme;
      levelLabel.textContent = i18n.t('common.level', { n: level.id });
      movesCap.textContent = i18n.t('common.moves');
      scoreCap.textContent = i18n.t('common.score');
      pauseBtn.update({ ariaLabel: i18n.t('common.pause') });
      // goal chips
      kit.clear(goalsBox);
      chips = [];
      for (let i = 0; i < goals.length; i++) {
        const g = goals[i] as GoalProgress;
        const chip = makeChip(g, Math.max(0, g.target - g.current), g.done, 22);
        chips.push(chip);
        goalsBox.appendChild(chip.el);
      }
      // score bar: the third star sits just before the end of the bar
      kit.clear(barBox);
      const max = Math.max(1, Math.round(level.stars[2] / 0.93));
      bar = kit.progress({ value: 0, max, notches: level.stars, tone: 'gold', ariaLabel: i18n.t('common.score') });
      barBox.appendChild(bar.el);
      shownScore = 0;
      scoreN.textContent = '0';
      hud.setMovesState('normal');
      hud.paintBackdrop(false);
    },

    setMoves(n, bump) {
      const text = String(n);
      if (movesN.textContent !== text) {
        movesN.textContent = text;
        if (bump) bumpClass(movesBox);
      }
      movesBox.setAttribute('aria-label', i18n.t('play.aria.moves', { n }));
      if (movesState !== 'out') hud.setMovesState(n <= LOW_MOVES && n > 0 ? 'low' : 'normal');
    },

    setMovesState(state) {
      movesState = state;
      movesBox.classList.toggle('pl-moves--low', state === 'low');
      movesBox.classList.toggle('pl-moves--out', state === 'out');
    },

    setScore(score, animate) {
      if (bar) bar.set(score);
      const from = shownScore;
      shownScore = score;
      const my = ++scoreTween;
      if (!animate || from === score) {
        scoreN.textContent = i18n.num(score);
        return;
      }
      sched.run(T.hudScore, (k) => {
        if (my !== scoreTween) return;
        scoreN.textContent = i18n.num(Math.round(from + (score - from) * k));
      });
      deps.kick();
    },

    setGoal(index, remaining, done, bump) {
      const chip = chips[index];
      if (!chip) return;
      if (done && !chip.done) {
        chip.done = true;
        chip.el.classList.add('pl-goal--done');
        return;
      }
      if (!done && chip.done) {
        chip.done = false;
        chip.el.classList.remove('pl-goal--done');
      }
      const text = chip.score ? i18n.num(remaining) : String(remaining);
      if (text !== chip.shown) {
        chip.shown = text;
        chip.n.textContent = text;
        if (bump) bumpClass(chip.el);
      }
    },

    goalCentre(index) {
      const chip = chips[index];
      return chip ? centreOf(chip.el) : null;
    },

    movesCentre() {
      return centreOf(movesN);
    },

    stageOrigin() {
      const r = stage.getBoundingClientRect();
      const o = rootRect();
      return { x: r.left - o.left, y: r.top - o.top };
    },

    setBoosters(slots) {
      kit.clear(trayIn);
      boosters.length = 0;
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i] as { id: InLevelBooster; count: number };
        const id = slot.id;
        const btn = kit.iconButton({
          icon: id,
          ariaLabel: i18n.t('booster.' + id + '.name'),
          variant: 'secondary',
          size: 'lg',
          onClick: () => {
            if (hud.onBooster) hud.onBooster(id);
          },
        });
        const wrap = el('div', { class: 'pl-boost', dataset: { booster: id } }, btn);
        trayIn.appendChild(wrap);
        boosters.push({ id, wrap, btn });
        hud.updateBooster(id, slot.count);
      }
      tray.classList.toggle('pl-tray--empty', slots.length === 0);
    },

    updateBooster(id, count) {
      for (let i = 0; i < boosters.length; i++) {
        const b = boosters[i] as { id: InLevelBooster; wrap: HTMLElement; btn: KitButton };
        if (b.id !== id) continue;
        b.btn.update({ badge: count > 0 ? (count > 99 ? '99+' : String(count)) : '+', ariaLabel: i18n.t('play.aria.booster', { name: i18n.t('booster.' + id + '.name'), n: count }) });
        b.wrap.classList.toggle('pl-boost--empty', count <= 0);
      }
    },

    setBoosterActive(id) {
      for (let i = 0; i < boosters.length; i++) {
        const b = boosters[i] as { id: InLevelBooster; wrap: HTMLElement; btn: KitButton };
        b.wrap.classList.toggle('pl-boost--active', b.id === id);
      }
    },

    measure() {
      const w = root.clientWidth || 360;
      const h = root.clientHeight || 640;
      const landscape = isLandscape(w, h);
      const u = kit.unit();
      const compact = landscape ? h < 470 * u : h / w < 1.62 || h < 600 * u;
      root.classList.toggle('pl-land', landscape);
      root.classList.toggle('pl-compact', compact);
      return { w: stage.clientWidth, h: stage.clientHeight, landscape, compact };
    },

    setBoardRect(rect) {
      root.style.setProperty('--pl-bx', rect.x + 'px');
      root.style.setProperty('--pl-by', rect.y + 'px');
      root.style.setProperty('--pl-bw', rect.w + 'px');
      root.style.setProperty('--pl-bh', rect.h + 'px');
      placeTarget();
    },

    paintBackdrop(force) {
      const w = root.clientWidth;
      const h = root.clientHeight;
      if (w <= 0 || h <= 0) return;
      let ratio = 1;
      try {
        ratio = Math.min(2, window.devicePixelRatio || 1);
      } catch {
        ratio = 1;
      }
      const pw = Math.round(w * ratio);
      const ph = Math.round(h * ratio);
      const key = theme + ':' + pw + 'x' + ph;
      if (!force && key === bgKey) return;
      bgKey = key;
      bg.width = pw;
      bg.height = ph;
      const g = bg.getContext('2d');
      if (!g) return;
      try {
        art.paintBackdrop(g, theme, pw, ph);
      } catch (err) {
        if (typeof console !== 'undefined') console.error('[play] backdrop failed', err);
      }
    },

    goalBanner(level, goals) {
      const list = el('div', { class: 'pl-banner__goals' });
      for (let i = 0; i < goals.length; i++) {
        const g = goals[i] as GoalProgress;
        list.appendChild(makeChip(g, Math.max(0, g.target - g.current), false, 26).el);
      }
      const sub = goals.length === 1 ? goalText(goals[0] as GoalProgress) : i18n.t('common.goals');
      const node = el(
        'div',
        { class: 'pl-banner', role: 'status' },
        el('div', { class: 'pl-banner__in' }, el('p', { class: 'pl-banner__title' }, i18n.t('common.level', { n: level.id })), el('p', { class: 'pl-banner__sub' }, sub), list),
      );
      over.appendChild(node);
      removeLater(node, T.goalBannerIn + T.goalBannerHold, T.goalBannerOut);
    },

    praise(text, tier) {
      const node = el(
        'div',
        { class: 'pl-praise pl-praise--' + (tier === 'finale' ? 'finale' : 't' + tier), role: 'status' },
        el('div', { class: 'pl-praise__box' }, khatam(140), el('span', { class: 'pl-praise__word' }, text)),
      );
      over.appendChild(node);
      transient.push(node);
      timers.after(tier === 'finale' ? 1000 : T.praiseIn + T.praiseHold + T.praiseOut, () => drop(node));
    },

    note(text, ms) {
      const node = el('div', { class: 'pl-note', role: 'status' }, el('div', { class: 'pl-note__in' }, text));
      over.appendChild(node);
      removeLater(node, ms, 200);
    },

    chain(n) {
      if (n < 2) {
        if (chainEl) chainEl.classList.remove('pl-on');
        return;
      }
      if (!chainEl) {
        chainEl = el('div', { class: 'pl-chain', 'aria-hidden': 'true' });
        over.appendChild(chainEl);
      }
      chainEl.textContent = '×' + n;
      chainEl.classList.add('pl-on');
      bumpClass(chainEl);
      if (chainTimer) timers.cancel(chainTimer);
      chainTimer = timers.after(T.chainBadge, () => {
        chainTimer = 0;
        if (chainEl) chainEl.classList.remove('pl-on');
      });
    },

    targeting(text, icon, onCancel) {
      if (targetEl) {
        if (targetEl.parentNode) targetEl.parentNode.removeChild(targetEl);
        targetEl = null;
      }
      root.classList.toggle('pl-targeting', text !== null);
      if (text === null) return;
      const cancel = kit.button({
        label: i18n.t('common.cancel'),
        variant: 'secondary',
        size: 'sm',
        onClick: () => {
          if (onCancel) onCancel();
        },
      });
      const iconNode = icon ? kit.icon(icon, 30) : null;
      if (iconNode) iconNode.classList.add('pl-target__icon');
      targetEl = el('div', { class: 'pl-target', role: 'status' }, el('div', { class: 'pl-target__pill' }, iconNode, el('span', { class: 'pl-target__text' }, text), cancel));
      root.appendChild(targetEl);
      placeTarget();
    },

    fly(icon, from, to, dur, size) {
      const node = kit.icon(icon, size);
      node.classList.add('pl-flyer');
      const half = (size * kit.unit()) / 2;
      flyLayer.appendChild(node);
      transient.push(node);
      // a little arc: the flyer bulges sideways on its way
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const bend = Math.min(60, Math.sqrt(dx * dx + dy * dy) * 0.18);
      const place = (k: number): void => {
        const e = inOutQuad(k);
        const arc = Math.sin(Math.PI * k) * bend;
        const x = from.x + dx * e - half + (dy > 0 ? -arc : arc) * 0.5;
        const y = from.y + dy * e - half - arc * 0.3;
        const s = 1 + 0.35 * Math.sin(Math.PI * k) - 0.35 * k;
        node.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + s.toFixed(3) + ')';
      };
      place(0);
      deps.kick();
      return sched.tween(dur, place).then(() => drop(node));
    },

    orb(from, to, dur) {
      const node = el('div', { class: 'pl-orb' });
      flyLayer.appendChild(node);
      transient.push(node);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const place = (k: number): void => {
        const e = outCubic(k);
        const arc = Math.sin(Math.PI * k) * Math.min(46, Math.abs(dx) * 0.3 + 12);
        const x = from.x + dx * e;
        const y = from.y + dy * e - arc * 0.4;
        const s = 0.7 + 0.9 * Math.sin(Math.PI * Math.min(1, k * 1.1));
        node.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + s.toFixed(3) + ')';
      };
      place(0);
      deps.kick();
      return sched.tween(dur, place).then(() => drop(node));
    },

    setFrozen(on) {
      root.classList.toggle('pl-frozen', on);
    },

    clearTransient() {
      while (transient.length > 0) drop(transient[transient.length - 1] as HTMLElement);
      if (chainEl) {
        if (chainEl.parentNode) chainEl.parentNode.removeChild(chainEl);
        chainEl = null;
      }
      chainTimer = 0;
      hud.targeting(null, null, null);
      scoreTween++;
    },

    flyerCount: () => flyLayer.childNodes.length,

    goalText,
    goalIcon: goalIconOf,
  };

  return hud;
}
