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

  /**
   * Apply the orientation / compact classes and return the stage size in CSS px.
   * `aspect` = rows / columns of the board (how tall a full-width board would be).
   */
  measure(aspect: number): StageSize;
  /**
   * Tell the HUD where the board is. In portrait the header and the tray take the width of the
   * board's frame (on tablets they would otherwise float, narrower than the board); returns true
   * when that changed the height of either, so the stage must be measured again.
   */
  setBoardRect(rect: BoardRect): boolean;
  /**
   * Landscape: extra space (CSS px) on both outer sides of the layout, so the side panel and a
   * height-limited board sit together in the middle of a wide screen instead of a band of
   * backdrop between them. 0 = none.
   */
  setSideInset(px: number): void;
  /**
   * Portrait, a tall screen whose board is limited by the width: `spare` CSS px of height the
   * board cannot use. The tray grows into part of it (and names its boosters). 0 = back to normal. Measure again afterwards.
   */
  setTall(spare: number): void;
  /** Portrait: CSS px taken off the bottom of the stage, so the board stands nearer the header. */
  setLift(px: number): void;
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
  /** Drop every flyer / spark in flight (their tweens were cut short). */
  clearFlyers(): void;
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

/** How much a portrait tablet's header and tray may grow beyond the kit's largest unit. */
const HUD_GROW_MAX = 1.4;
/** How much a tall phone's tray may grow into height the board cannot use. */
const HUD_TALL_MAX = 1.25;

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
  sharpen(pauseBtn, 'pause');
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
  let scoreSize = 0;
  let scoreLen = -1;
  let tallGrow = 1;
  let bgKey = '';
  let movesState: 'normal' | 'low' | 'out' = 'normal';
  const boosters: { id: InLevelBooster; wrap: HTMLElement; btn: KitButton }[] = [];
  let chainEl: HTMLElement | null = null;
  let chainTimer = 0;
  let targetEl: HTMLElement | null = null;
  const transient: HTMLElement[] = [];

  /**
   * Writes the score numeral. A longer number (a 6-digit finale score on a 320 px phone) steps the
   * font down until it fits its box, so it never runs under the pause button or, in Arabic, the
   * moves medallion. The fit reads layout only when the number of characters changes (a few times
   * a level), not on every frame of a count-up.
   */
  function writeScore(value: number): void {
    const text = i18n.num(value);
    scoreN.textContent = text;
    if (text.length !== scoreLen) {
      scoreLen = text.length;
      fitScore();
    }
  }

  function setScoreSize(size: number): void {
    if (size === scoreSize) return;
    scoreSize = size;
    scoreN.classList.toggle('pl-score__n--s1', size === 1);
    scoreN.classList.toggle('pl-score__n--s2', size === 2);
    scoreN.classList.toggle('pl-score__n--s3', size === 3);
  }

  function fitScore(): void {
    setScoreSize(0);
    const box = scoreN.clientWidth;
    if (box <= 0) {
      scoreLen = -1; // not laid out yet: fit again at the next write or measure()
      return;
    }
    let size = 0;
    while (size < 3 && scoreN.scrollWidth > box + 0.5) setScoreSize(++size);
  }

  /**
   * The kit draws an icon for the kit's own unit; the header and the tray may grow up to
   * HUD_GROW_MAX× (measure()), which would stretch it. Redraw the icon canvas inside `node` with
   * that head-room (same CSS size, more pixels).
   */
  function sharpen(node: HTMLElement, key: IconName): void {
    const old = node.querySelector('canvas.k-icon') as HTMLCanvasElement | null;
    if (!old || !old.parentNode) return;
    const m = /\*\s*([\d.]+)\)/.exec(old.style.width);
    const size = m ? Number(m[1]) : 0;
    if (!(size > 0)) return;
    const icon = art.icon(key, Math.round(size * kit.unit() * HUD_GROW_MAX));
    icon.style.width = old.style.width;
    icon.style.height = old.style.height;
    icon.className = old.className;
    old.parentNode.replaceChild(icon, old);
  }

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
    // drawn with head-room: on a portrait tablet the header grows up to HUD_GROW_MAX× (measure())
    const icon = art.icon(goalIconOf(goal), Math.round(iconSize * kit.unit() * HUD_GROW_MAX));
    icon.style.width = icon.style.height = 'calc(var(--k-u) * ' + iconSize + ')';
    icon.classList.add('k-icon', 'pl-goal__icon');
    const chip = el('div', { class: 'pl-goal' + (done ? ' pl-goal--done' : ''), title: goalText(goal) }, icon, n, el('span', { class: 'pl-goal__tick' }, hiIcon('check', 16)));
    return { el: chip, n, shown: text, done, score: goal.goal.kind === 'score' };
  }

  /** an icon drawn with the header's growth head-room */
  function hiIcon(key: IconName, size: number): HTMLCanvasElement {
    const icon = art.icon(key, Math.round(size * kit.unit() * HUD_GROW_MAX));
    icon.style.width = icon.style.height = 'calc(var(--k-u) * ' + size + ')';
    icon.classList.add('k-icon');
    return icon;
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
    // (gradients live in the coordinate space they are used in: everything is drawn round the origin)
    g.translate(m, m);
    // long and short rays, alternating
    const light = g.createRadialGradient(0, 0, 0, 0, 0, m);
    light.addColorStop(0, 'rgba(255,255,255,0.95)');
    light.addColorStop(0.4, 'rgba(255,236,170,0.7)');
    light.addColorStop(1, 'rgba(245,201,90,0)');
    g.fillStyle = light;
    const n = 16;
    for (let i = 0; i < n; i++) {
      const len = m * (i % 2 === 0 ? 1 : 0.7);
      const half = (Math.PI / n) * (i % 2 === 0 ? 0.42 : 0.3);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(-half) * len, Math.sin(-half) * len);
      g.lineTo(Math.cos(half) * len, Math.sin(half) * len);
      g.closePath();
      g.fill();
      g.rotate((Math.PI * 2) / n);
    }
    // the eight-pointed star itself: two overlapped squares of soft gold light
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, m * 0.9);
    grad.addColorStop(0, 'rgba(255,246,220,0.95)');
    grad.addColorStop(0.5, 'rgba(245,201,90,0.6)');
    grad.addColorStop(1, 'rgba(245,201,90,0)');
    g.fillStyle = grad;
    const half = m * 0.5;
    for (let i = 0; i < 2; i++) {
      g.fillRect(-half, -half, half * 2, half * 2);
      g.rotate(Math.PI / 4);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
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
      // three or four goals: two even columns of smaller chips (an odd last one centred), so the
      // header keeps the height it has with one or two and the board does not change size
      goalsBox.classList.toggle('pl-goals--many', goals.length >= 3);
      sideGoals.classList.toggle('pl-hud__side--many', goals.length >= 3);
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
      writeScore(0);
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
        writeScore(score);
        return;
      }
      sched.run(T.hudScore, (k) => {
        if (my !== scoreTween) return;
        writeScore(Math.round(from + (score - from) * k));
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
        // the name under the button is shown only on tall screens (.pl-tall)
        sharpen(btn, id);
        const wrap = el('div', { class: 'pl-boost', dataset: { booster: id } }, btn, el('span', { class: 'pl-boost__name', 'aria-hidden': 'true' }, i18n.t('booster.' + id + '.name')));
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

    measure(aspect) {
      const w = root.clientWidth || 360;
      const h = root.clientHeight || 640;
      const landscape = isLandscape(w, h);
      const u = kit.unit();
      root.classList.toggle('pl-land', landscape);
      // On a portrait tablet the kit's unit stops growing (1.375 px) while the board keeps
      // filling the width: the header and the tray grow with the column instead (up to 1.4×), so
      // they do not sit phone-sized in a wide, empty band. Measured on the screen width, which
      // the board does not change, so the fit below cannot loop.
      const grow = landscape ? 1 : Math.max(1, Math.min(HUD_GROW_MAX, (w - 12 * u) / (392 * u)));
      const hu = grow > 1.02 ? Math.round(u * grow * 1000) / 1000 + 'px' : '';
      if (header.style.getPropertyValue('--k-u') !== hu) header.style.setProperty('--k-u', hu);
      // A tall phone (20:9) with a width-limited board grows the tray as well, by setTall()
      // (index.ts). Only the tray: the header's width is the screen's, so a larger unit would
      // squeeze its score and goals.
      const tgrow = landscape ? 1 : Math.max(grow, tallGrow);
      const tu = tgrow > 1.02 ? Math.round(u * tgrow * 1000) / 1000 + 'px' : '';
      if (tray.style.getPropertyValue('--k-u') !== tu) tray.style.setProperty('--k-u', tu);
      let compact: boolean;
      if (landscape) {
        compact = h < 470 * u;
        root.classList.toggle('pl-compact', compact);
      } else {
        // Portrait: the full-size header and tray, unless they would cost the board some of its
        // width (a squat screen, or a board taller than wide) — then the compact ones.
        root.classList.remove('pl-compact');
        const need = stage.clientWidth * (aspect > 0 ? aspect : 1);
        compact = stage.clientHeight < need || h < 600 * u;
        if (compact) root.classList.add('pl-compact');
      }
      fitScore();
      return { w: stage.clientWidth, h: stage.clientHeight, landscape, compact };
    },

    setBoardRect(rect) {
      root.style.setProperty('--pl-bx', rect.x + 'px');
      root.style.setProperty('--pl-by', rect.y + 'px');
      root.style.setProperty('--pl-bw', rect.w + 'px');
      root.style.setProperty('--pl-bh', rect.h + 'px');
      // the outer edge of the gold frame (board-view draws it about an eighth of a cell outside)
      const col = Math.round(rect.w + 2 * (rect.cell * 0.125 + 1.5));
      let changed = false;
      if (root.classList.contains('pl-land')) {
        // beside the board the header and tray have no width cap: nothing to measure
        root.style.setProperty('--pl-colw', col + 'px');
      } else {
        const before = header.offsetHeight + tray.offsetHeight;
        root.style.setProperty('--pl-colw', col + 'px');
        changed = header.offsetHeight + tray.offsetHeight !== before;
      }
      // the lowest point the cascade counter may ride up to (in the stage's coordinates): below
      // the header in portrait, the top of the screen in landscape
      const st = stage.getBoundingClientRect();
      const top = root.classList.contains('pl-land') ? rootRect().top : header.getBoundingClientRect().bottom;
      root.style.setProperty('--pl-hb', Math.round(top - st.top) + 'px');
      placeTarget();
      fitScore();
      return changed;
    },

    setTall(spare) {
      // a share of the spare height goes to a larger tray (at most 1.25×, with the booster
      // names shown under the buttons); the rest the caller puts under the board
      let g = 1;
      if (spare > 0) {
        const base = tray.offsetHeight;
        if (base > 0) g = Math.min(HUD_TALL_MAX, 1 + (spare * 0.25) / base);
      }
      tallGrow = Math.round(g * 1000) / 1000;
      root.classList.toggle('pl-tall', spare > 0);
    },

    setLift(px) {
      const v = px > 0.5 ? Math.round(px) + 'px' : '';
      if (root.style.getPropertyValue('--pl-ly') !== v) root.style.setProperty('--pl-ly', v);
    },

    setSideInset(px) {
      const v = px > 0.5 ? Math.round(px) + 'px' : '';
      if (root.style.getPropertyValue('--pl-lx') !== v) root.style.setProperty('--pl-lx', v);
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
        list.appendChild(makeChip(g, Math.max(0, g.target - g.current), false, 34).el);
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
        el('div', { class: 'pl-praise__box' }, khatam(140), el('span', { class: 'pl-praise__word', 'data-text': text }, text)),
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
      if (!chainEl) chainEl = el('div', { class: 'pl-chain', 'aria-hidden': 'true' });
      // landscape: in the side panel by the moves medallion; portrait: on the board's top edge
      const side = root.classList.contains('pl-land');
      const parent = side ? movesBox : over;
      if (chainEl.parentNode !== parent) parent.appendChild(chainEl);
      chainEl.classList.toggle('pl-chain--side', side);
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
      // a count-up cut short lands on its final number (the win dialog opens over the header
      // while the last count-up of the finale is still running)
      scoreTween++;
      writeScore(shownScore);
    },

    clearFlyers() {
      while (flyLayer.firstChild) drop(flyLayer.firstChild as HTMLElement);
    },

    flyerCount: () => flyLayer.childNodes.length,

    goalText,
    goalIcon: goalIconOf,
  };

  return hud;
}
