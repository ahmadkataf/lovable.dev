/**
 * The journey map: every level on one winding caravan trail, level 1 at the bottom, scrolling up
 * to progress. Each chapter is a section with its own painted backdrop (pinned behind the trail
 * while the section crosses the screen), a banner at its start and small landmarks along the way.
 * Only the sections near the viewport hold their backdrop canvas and nodes.
 *
 * Top bar: lives · coins · stars · settings. Bottom tray: Home · Shop · Daily gift.
 */
import type { ChapterTheme } from '../../art/types.ts';
import { focusLevel, levelById, nodeState } from '../helpers.ts';
import type { Chip, KitButton } from '../kit/index.ts';
import { METRICS, litCount, naturalHeight, nodePos, scrollFor, smoothPieces, spanCount, trailPoints } from '../map/layout.ts';
import type { SectionGeo, TrailPt } from '../map/layout.ts';
import { decoSprite, khatamSprite, nodeSprite } from '../map/sprites.ts';
import type { DecoKind, NodeSkin } from '../map/sprites.ts';
import type { ChapterInfo, Screen, Ui } from '../types.ts';
import { paintBackdropCanvas } from './backdrop.ts';

export interface WonInfo {
  level: number;
  /** Best stars now. */
  stars: number;
  /** Best stars before this win (0 = never won before). */
  starsBefore: number;
  /** The win unlocked the next level (or finished the journey). */
  firstClear: boolean;
}

export interface MapOptions {
  /** Level to scroll to (default: the level just won, else the current level). */
  focusLevel?: number;
  /** Celebrate this win, then open the next level's intro. */
  won?: WonInfo;
  /** Restore this scroll position (0 = top … 1 = bottom) instead of focusing a level. */
  scrollRatio?: number;
  /** Automatic pop-ups (new booster, daily reward) are allowed. */
  auto: boolean;
  /** The daily reward may be offered by itself this time. */
  offerDaily: boolean;
  onDailyOffered(): void;
}

export interface MapScreen extends Screen {
  /** Current scroll position, 0 = top … 1 = bottom. */
  scrollRatio(): number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Where the focused node sits in the viewport (0 = top, 1 = bottom): comfortably above the tray. */
const FOCUS_ANCHOR = 0.6;

const THEME_DECO: Record<ChapterTheme, readonly DecoKind[]> = {
  oasis: ['palm', 'post', 'tent', 'palm'],
  dunes: ['rock', 'tent', 'post', 'palm'],
  bazaar: ['awning', 'jars', 'post', 'jars'],
  palace: ['dome', 'cypress', 'post', 'cypress'],
  caverns: ['crystal', 'mushroom', 'post', 'crystal'],
  stars: ['starlet', 'comet', 'starlet', 'post'],
};

interface NodeView {
  level: number;
  hard: boolean;
  el: HTMLButtonElement;
  stars: HTMLElement[];
}

interface Section {
  ch: ChapterInfo;
  geo: SectionGeo;
  isLast: boolean;
  el: HTMLElement;
  bg: HTMLElement;
  content: HTMLElement;
  /** px, measured after layout */
  top: number;
  heightPx: number;
  built: boolean;
  nodes: NodeView[];
  points: TrailPt[];
  pieces: string[];
  lit: SVGPathElement | null;
  litGlow: SVGPathElement | null;
  svg: SVGSVGElement | null;
  bannerStars: HTMLElement | null;
}

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const name of Object.keys(attrs)) node.setAttribute(name, attrs[name]!);
  return node;
}

export function createMapScreen(ui: Ui, opts: MapOptions): MapScreen {
  const { kit, ctx, world } = ui;
  const { profile, i18n, art, audio, platform } = ctx;
  const h = kit.el;
  const m = METRICS;
  const rtl = i18n.isRtl();
  const levelCount = world.levels.length;

  const root = kit.screen('m-map' + (ui.flags.still ? ' m-still' : ''));
  const scroller = h('div', { class: 'm-map__scroll k-scroll' });
  const worldEl = h('div', { class: 'm-map__world' });
  const fx = h('div', { class: 'm-map__fx', 'aria-hidden': 'true' });
  scroller.appendChild(worldEl);

  // ───────────────────────────── what the map shows ─────────────────────────────
  // During a win celebration the map first shows the state BEFORE the win and then plays forward.

  let celebrating = false;
  let viewFrontier = profile.highestUnlocked();
  const starOverride: Record<number, number> = Object.create(null);

  function realStars(level: number): number {
    const record = profile.record(level);
    return record ? record.stars : 0;
  }

  function viewStars(level: number): number {
    const o = starOverride[level];
    return typeof o === 'number' ? o : realStars(level);
  }

  const won = opts.won && opts.won.stars > 0 ? opts.won : null;
  if (won) {
    starOverride[won.level] = won.starsBefore;
    if (won.firstClear) viewFrontier = won.level;
  }

  // ───────────────────────────── top bar ─────────────────────────────

  const showLives = ui.feature('lives');
  const showShop = ui.feature('shop');
  const showDaily = ui.feature('daily');

  let livesChip: Chip | null = null;
  let livesCount: HTMLElement | null = null;
  if (showLives) {
    livesChip = kit.chip({ icon: 'heart', text: '', onClick: () => ui.openLives(), className: 'm-chip m-chip--lives' });
    livesCount = h('span', { class: 'm-chip__count k-num' });
    livesChip.el.appendChild(livesCount);
    livesChip.el.dataset.act = 'lives';
  }

  let shownCoins = profile.coins();
  const coinsChip = kit.chip({
    icon: 'coin',
    text: i18n.num(shownCoins),
    plus: showShop,
    onClick: showShop ? () => ctx.nav.openShop() : undefined,
    className: 'm-chip m-chip--coins',
    ariaLabel: ui.t('meta.map.aria.coins', { n: shownCoins }),
  });
  coinsChip.el.dataset.act = 'coins';

  let shownStars = profile.totalStars();
  const starsChip = kit.chip({ icon: 'star', text: i18n.num(shownStars), className: 'm-chip m-chip--stars', ariaLabel: ui.t('meta.map.aria.stars', { n: shownStars }) });

  const settingsButton = kit.iconButton({
    icon: 'settings',
    ariaLabel: ui.t('common.settings'),
    variant: 'secondary',
    size: 'sm',
    onClick: () => ctx.nav.openSettings(),
  });
  settingsButton.dataset.act = 'settings';

  const topBar = h(
    'header',
    { class: 'm-top' },
    h('div', { class: 'm-top__panel' }, livesChip ? livesChip.el : null, coinsChip.el, starsChip.el, h('span', { class: 'm-top__gap' }), settingsButton),
  );

  // ───────────────────────────── bottom tray ─────────────────────────────

  function trayButton(act: string, icon: 'home' | 'shop' | 'gift', label: string, onClick: () => unknown): KitButton {
    const b = kit.button({ label, variant: 'secondary', className: 'm-traybtn', onClick });
    // a large icon above the label (the kit's own button icons sit beside the label)
    const content = b.querySelector('.k-btn__content');
    if (content) content.insertBefore(kit.icon(icon, 34), content.firstChild);
    b.dataset.act = act;
    return b;
  }

  const homeButton = trayButton('home', 'home', ui.t('meta.map.home'), () => ui.goTitle());
  const shopButton = showShop ? trayButton('shop', 'shop', ui.t('common.shop'), () => ctx.nav.openShop()) : null;
  const dailyButton = showDaily ? trayButton('daily', 'gift', ui.t('meta.map.daily'), () => ui.openDaily()) : null;
  const tray = h('footer', { class: 'm-tray' }, h('div', { class: 'm-tray__panel' }, homeButton, shopButton, dailyButton));

  root.appendChild(scroller);
  root.appendChild(topBar);
  root.appendChild(tray);

  // ───────────────────────────── world ─────────────────────────────

  let sections: Section[] = [];
  let unit = 1;
  let viewW = 0;
  let viewH = 0;
  let marker: HTMLElement | null = null;
  let disposed = false;
  let paused = false;

  function sectionOf(level: number): Section | null {
    for (const s of sections) if (level >= s.ch.from && level <= s.ch.to) return s;
    return null;
  }

  /** Centre of a level's node in world pixels (x from the left edge, y from the top). */
  function nodeCentre(level: number): { x: number; y: number } | null {
    const s = sectionOf(level);
    if (!s) return null;
    const p = nodePos(level, s.geo, m, rtl);
    return { x: viewW / 2 + p.x * unit, y: s.top + s.heightPx - p.y * unit };
  }

  function u(n: number): string {
    return 'calc(var(--k-u) * ' + Math.round(n * 100) / 100 + ')';
  }

  function skinOf(state: 'done' | 'current' | 'locked', hard: boolean): NodeSkin {
    if (hard) return state === 'done' ? 'hardDone' : state === 'current' ? 'hardCurrent' : 'hardLocked';
    return state;
  }

  function applyNode(v: NodeView): void {
    const stars = viewStars(v.level);
    const state = nodeState(v.level, viewFrontier, stars);
    const keep = v.el.classList.contains('m-node--pop') ? ' m-node--pop' : '';
    v.el.className = 'm-node m-node--' + state + ' m-skin-' + skinOf(state, v.hard) + (v.hard ? ' m-node--hard' : '') + keep;
    for (let i = 0; i < v.stars.length; i++) v.stars[i]!.classList.toggle('on', i < stars);
    v.el.setAttribute(
      'aria-label',
      state === 'done'
        ? ui.t('meta.map.aria.done', { n: v.level, stars })
        : state === 'current'
          ? ui.t('meta.map.aria.current', { n: v.level })
          : ui.t('meta.map.aria.locked', { n: v.level }),
    );
  }

  function setLit(s: Section): void {
    if (!s.lit || !s.litGlow) return;
    const n = litCount(s.points, viewFrontier);
    const d = n >= 2 ? s.pieces.slice(0, n).join('') : '';
    s.lit.setAttribute('d', d);
    s.litGlow.setAttribute('d', d);
  }

  function chapterStars(ch: ChapterInfo): number {
    let sum = 0;
    for (let id = ch.from; id <= ch.to; id++) sum += viewStars(id);
    return sum;
  }

  function buildSection(s: Section): void {
    if (s.built) return;
    s.built = true;
    const ch = s.ch;
    const count = spanCount(ch);

    // backdrop (pinned while the section crosses the screen)
    const canvas = paintBackdropCanvas(art, ch.theme, viewW, viewH);
    if (canvas) s.bg.appendChild(canvas);

    // trail
    const W = m.trackWidth;
    const H = s.geo.height;
    const svg = svgEl('svg', { class: 'm-trail', viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    svg.style.height = u(H);
    const full = s.pieces.join('');
    if (s.points.length >= 2) {
      svg.appendChild(svgEl('path', { class: 'm-trail__bed', d: full }));
      svg.appendChild(svgEl('path', { class: 'm-trail__dots', d: full }));
    }
    s.litGlow = svgEl('path', { class: 'm-trail__glow', d: '' });
    s.lit = svgEl('path', { class: 'm-trail__lit', d: '' });
    svg.appendChild(s.litGlow);
    svg.appendChild(s.lit);
    s.svg = svg;
    s.content.appendChild(svg);
    setLit(s);

    // landmarks: on the open side of the trail, every few nodes
    const kinds = THEME_DECO[ch.theme] || THEME_DECO.oasis;
    let k = 0;
    for (let id = ch.from; id <= ch.to; id++) {
      const p = nodePos(id, s.geo, m, rtl);
      if (Math.abs(p.x) < m.amp * 0.42) continue;
      if ((id - ch.from) % 2 !== 0) continue;
      const kind = kinds[k % kinds.length]!;
      k++;
      const side = p.x > 0 ? -1 : 1;
      const deco = h('i', { class: 'm-deco m-deco--' + kind });
      deco.style.left = 'calc(50% + ' + u(side * (112 + (k % 2) * 10)) + ')';
      deco.style.bottom = u(p.y + ((k % 3) - 1) * 10);
      s.content.appendChild(deco);
    }

    // chapter banner at the section's start
    const locked = ch.from > viewFrontier;
    const starsEl = h('span', { class: 'm-banner__stars k-num', text: chapterStars(ch) + '/' + count * 3 });
    s.bannerStars = starsEl;
    const banner = h(
      'div',
      { class: 'm-banner' + (locked ? ' m-banner--locked' : '') },
      h('i', { class: 'm-banner__orn m-banner__orn--a' }),
      h('i', { class: 'm-banner__orn m-banner__orn--b' }),
      h(
        'div',
        { class: 'm-banner__in' },
        h('div', { class: 'm-banner__kicker', text: ui.t('meta.map.chapter', { n: ch.index + 1 }) }),
        h('div', { class: 'm-banner__name', text: ui.t(ch.nameKey) }),
        h('div', { class: 'm-banner__meta' }, kit.icon(locked ? 'lock' : 'star', 16), starsEl),
      ),
    );
    banner.style.bottom = u(s.geo.foot + (m.bannerZone - 104) / 2);
    s.content.appendChild(banner);

    // the cap above the last chapter
    if (s.isLast) {
      const cap = h('div', { class: 'm-cap' }, kit.icon('map', 26), h('span', { text: ui.t('meta.map.comingSoon') }));
      const lastNode = nodePos(ch.to, s.geo, m, rtl);
      cap.style.bottom = u(lastNode.y + m.step * 0.5 + m.headZone + 4);
      s.content.appendChild(cap);
    }

    // nodes
    for (let id = ch.from; id <= ch.to; id++) {
      const def = levelById(world.levels, id);
      const p = nodePos(id, s.geo, m, rtl);
      const starEls = [h('i'), h('i'), h('i')];
      const btn = h(
        'button',
        { type: 'button', class: 'm-node', dataset: { level: id } },
        h('span', { class: 'm-node__halo' }),
        h('span', { class: 'm-node__face' }, h('span', { class: 'm-node__num k-num', text: String(id) })),
        h('span', { class: 'm-node__stars' }, starEls),
      );
      btn.style.left = 'calc(50% + ' + u(p.x) + ')';
      btn.style.bottom = u(p.y);
      const view: NodeView = { level: id, hard: !!(def && def.hard), el: btn, stars: starEls };
      applyNode(view);
      s.nodes.push(view);
      s.content.appendChild(btn);
    }
  }

  function dropSection(s: Section): void {
    if (!s.built) return;
    s.built = false;
    kit.clear(s.bg);
    kit.clear(s.content);
    s.nodes = [];
    s.lit = null;
    s.litGlow = null;
    s.svg = null;
    s.bannerStars = null;
  }

  function updateAlive(): void {
    if (disposed) return;
    const top = scroller.scrollTop;
    const bottom = top + viewH;
    for (const s of sections) {
      const a = s.top;
      const b = s.top + s.heightPx;
      const near = b >= top - viewH * 0.9 && a <= bottom + viewH * 0.9;
      const far = b < top - viewH * 2.5 || a > bottom + viewH * 2.5;
      if (near) buildSection(s);
      else if (far) dropSection(s);
    }
  }

  function nodeView(level: number): NodeView | null {
    const s = sectionOf(level);
    if (!s) return null;
    buildSection(s);
    for (const v of s.nodes) if (v.level === level) return v;
    return null;
  }

  function refreshNodes(): void {
    for (const s of sections) {
      if (!s.built) continue;
      for (const v of s.nodes) applyNode(v);
      setLit(s);
      if (s.bannerStars) s.bannerStars.textContent = chapterStars(s.ch) + '/' + spanCount(s.ch) * 3;
    }
    placeMarker(false);
  }

  /** The lantern marker stands on the current level (the first one not yet won). */
  function markerLevel(): number {
    if (viewFrontier < 1 || viewFrontier > levelCount) return 0;
    return viewStars(viewFrontier) > 0 ? 0 : viewFrontier;
  }

  function placeMarker(glide: boolean): void {
    if (!marker) return;
    const level = markerLevel();
    const c = level ? nodeCentre(level) : null;
    if (!c) {
      marker.style.display = 'none';
      return;
    }
    marker.style.display = '';
    marker.classList.toggle('m-marker--glide', glide);
    marker.style.transform = 'translate(' + Math.round(c.x) + 'px,' + Math.round(c.y) + 'px)';
  }

  function build(restoreRatio: number | null): void {
    unit = kit.unit();
    viewW = scroller.clientWidth;
    viewH = scroller.clientHeight;
    if (viewW < 1 || viewH < 1) return;
    root.style.setProperty('--m-vh', viewH + 'px');

    // sprites as CSS variables: one image per node skin, shared by all nodes
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const nodePx = Math.ceil(84 * unit * dpr);
    const skins: NodeSkin[] = ['done', 'current', 'locked', 'hardDone', 'hardCurrent', 'hardLocked'];
    for (const skin of skins) root.style.setProperty('--m-skin-' + skin, 'url(' + nodeSprite(skin, nodePx) + ')');
    const smallPx = Math.ceil(20 * unit * dpr);
    root.style.setProperty('--m-star-on', 'url(' + art.iconUrl('star', Math.ceil(20 * unit)) + ')');
    root.style.setProperty('--m-star-off', 'url(' + art.iconUrl('starEmpty', Math.ceil(20 * unit)) + ')');
    root.style.setProperty('--m-lock', 'url(' + art.iconUrl('lock', Math.ceil(30 * unit)) + ')');
    root.style.setProperty('--m-khatam', 'url(' + khatamSprite(smallPx, '#ffd666') + ')');
    const decoPx = Math.ceil(72 * unit * Math.min(2, dpr));
    const used: Record<string, true> = Object.create(null);
    for (const ch of world.chapters) for (const kind of THEME_DECO[ch.theme] || THEME_DECO.oasis) used[kind] = true;
    for (const kind of Object.keys(used)) root.style.setProperty('--m-deco-' + kind, 'url(' + decoSprite(kind as DecoKind, decoPx) + ')');

    // sections, last chapter on top
    kit.clear(worldEl);
    sections = [];
    const chapters = world.chapters;
    const minUnits = Math.ceil(viewH / unit);
    const footUnits = Math.ceil((tray.offsetHeight + 10) / unit);
    const geos: SectionGeo[] = chapters.map((ch, i) => {
      const isLast = i === chapters.length - 1;
      const foot = i === 0 ? footUnits : 0;
      const natural = naturalHeight(spanCount(ch), m, foot, isLast) + (isLast ? Math.ceil(topBar.offsetHeight / unit) : 0);
      return { span: { from: ch.from, to: ch.to }, height: Math.max(natural, minUnits), foot };
    });
    for (let i = chapters.length - 1; i >= 0; i--) {
      const ch = chapters[i]!;
      const geo = geos[i]!;
      const palette = art.palette(ch.theme);
      const bg = h('div', { class: 'm-sec__bg' });
      bg.style.background = 'linear-gradient(180deg, ' + palette.bgTop + ' 0%, ' + palette.bgBottom + ' 100%)';
      const content = h('div', { class: 'm-sec__content' });
      const el = h('section', { class: 'm-sec m-sec--' + ch.theme }, bg, content);
      el.style.height = u(geo.height);
      el.style.setProperty('--m-accent', palette.accent);
      const points = trailPoints(geo, i > 0 ? geos[i - 1]! : null, i < chapters.length - 1 ? geos[i + 1]! : null, m, rtl);
      sections.push({
        ch,
        geo,
        isLast: i === chapters.length - 1,
        el,
        bg,
        content,
        top: 0,
        heightPx: 0,
        built: false,
        nodes: [],
        points,
        pieces: smoothPieces(points),
        lit: null,
        litGlow: null,
        svg: null,
        bannerStars: null,
      });
      worldEl.appendChild(el);
    }
    // the marker layer sits above every section
    kit.clear(fx);
    marker = h('div', { class: 'm-marker' }, h('div', { class: 'm-marker__bob' }, h('div', { class: 'm-marker__pin' }, kit.icon('lamp', 30))));
    fx.appendChild(marker);
    worldEl.appendChild(fx);

    for (const s of sections) {
      s.top = s.el.offsetTop;
      s.heightPx = s.el.offsetHeight;
    }

    // scroll position
    const max = Math.max(0, scroller.scrollHeight - viewH);
    if (restoreRatio !== null) {
      scroller.scrollTop = Math.round(max * restoreRatio);
    } else {
      const target = won ? won.level : typeof opts.focusLevel === 'number' ? opts.focusLevel : focusLevel(viewFrontier, levelCount);
      const c = nodeCentre(Math.max(1, Math.min(levelCount, Math.floor(target))));
      if (c) scroller.scrollTop = Math.round(scrollFor(c.y, viewH, scroller.scrollHeight, FOCUS_ANCHOR));
    }
    updateAlive();
    placeMarker(false);
  }

  // ───────────────────────────── interaction ─────────────────────────────

  worldEl.addEventListener('click', (ev: MouseEvent) => {
    const target = ev.target as Element | null;
    const node = target && target.closest ? (target.closest('.m-node') as HTMLElement | null) : null;
    if (!node) return;
    if (celebrating) {
      finishCelebration();
      return;
    }
    const level = Number(node.dataset.level);
    if (!(level >= 1)) return;
    if (level > profile.highestUnlocked()) {
      node.classList.remove('m-node--deny');
      void node.offsetWidth;
      node.classList.add('m-node--deny');
      try {
        audio.sfx('invalid');
      } catch {
        // sound is a nicety
      }
      kit.toast(ui.t('meta.map.lockedToast', { n: level - 1 }), { icon: 'lock' });
      return;
    }
    try {
      audio.unlock();
      audio.sfx('button');
      platform.haptic('light');
    } catch {
      // feedback is a nicety
    }
    ctx.nav.openLevelIntro(level);
  });

  let scrollQueued = false;
  scroller.addEventListener(
    'scroll',
    () => {
      if (scrollQueued) return;
      scrollQueued = true;
      window.requestAnimationFrame(() => {
        scrollQueued = false;
        updateAlive();
      });
    },
    { passive: true },
  );

  // a tap anywhere skips the celebration
  root.addEventListener('pointerdown', () => {
    if (celebrating && celebrationStarted) window.setTimeout(finishCelebration, 0);
  });

  // ───────────────────────────── live values ─────────────────────────────

  let coinTween = 0;

  function refreshCoins(): void {
    const target = profile.coins();
    if (target === shownCoins) return;
    const from = shownCoins;
    shownCoins = target;
    coinsChip.el.setAttribute('aria-label', ui.t('meta.map.aria.coins', { n: target }));
    window.cancelAnimationFrame(coinTween);
    if (kit.reducedMotion() || paused) {
      coinsChip.set(i18n.num(target));
      return;
    }
    const t0 = performance.now();
    const step = (now: number): void => {
      const p = Math.min(1, (now - t0) / 600);
      const eased = 1 - Math.pow(1 - p, 3);
      coinsChip.set(i18n.num(Math.round(from + (target - from) * eased)), false);
      if (p < 1 && !disposed) coinTween = window.requestAnimationFrame(step);
      else coinsChip.bump();
    };
    coinTween = window.requestAnimationFrame(step);
  }

  function refreshLives(): void {
    if (!livesChip || !livesCount) return;
    const info = profile.lives();
    const text = info.count >= info.max ? ui.t('common.full') : i18n.clock(info.nextInMs);
    livesChip.set(text, false);
    if (livesCount.textContent !== String(info.count)) {
      const first = livesCount.textContent === '';
      livesCount.textContent = String(info.count);
      if (!first) livesChip.bump();
    }
    livesChip.el.classList.toggle('m-chip--empty', info.count <= 0);
    livesChip.el.setAttribute('aria-label', ui.t('meta.map.aria.lives', { n: info.count }));
  }

  function refreshDailyBadge(): void {
    if (!dailyButton) return;
    let can = false;
    try {
      can = profile.daily().canClaim;
    } catch {
      can = false;
    }
    dailyButton.update({ badge: can ? '!' : null });
  }

  function refreshProfile(): void {
    if (disposed) return;
    refreshCoins();
    refreshLives();
    refreshDailyBadge();
    const stars = profile.totalStars();
    if (stars !== shownStars) {
      shownStars = stars;
      starsChip.set(i18n.num(stars));
      starsChip.el.setAttribute('aria-label', ui.t('meta.map.aria.stars', { n: stars }));
    }
    if (!celebrating) {
      const frontier = profile.highestUnlocked();
      if (frontier !== viewFrontier) viewFrontier = frontier;
      refreshNodes();
    }
  }

  let ticker = 0;
  function startTicker(): void {
    stopTicker();
    if (disposed || paused) return;
    ticker = window.setInterval(() => {
      refreshLives();
      refreshDailyBadge();
    }, 1000);
  }
  function stopTicker(): void {
    if (ticker) window.clearInterval(ticker);
    ticker = 0;
  }

  // ───────────────────────────── win celebration ─────────────────────────────

  let celebrationStarted = false;
  let celebrationTimers: number[] = [];
  let afterCelebration: (() => void) | null = null;
  let litOverlay: SVGPathElement[] = [];

  function later(ms: number, fn: () => void): void {
    celebrationTimers.push(
      window.setTimeout(() => {
        if (!disposed && celebrating) fn();
      }, ms),
    );
  }

  function sfx(name: 'star' | 'goalDone' | 'reward', step?: number): void {
    try {
      audio.sfx(name, step ? { step } : undefined);
    } catch {
      // sound is a nicety
    }
  }

  function sparkle(level: number): void {
    const c = nodeCentre(level);
    if (!c) return;
    const burst = h('div', { class: 'm-burst' });
    burst.style.transform = 'translate(' + Math.round(c.x) + 'px,' + Math.round(c.y) + 'px)';
    for (let i = 0; i < 8; i++) {
      const p = h('i');
      p.style.setProperty('--m-a', i * 45 + 'deg');
      burst.appendChild(p);
    }
    fx.appendChild(burst);
    window.setTimeout(() => {
      if (burst.parentNode) burst.parentNode.removeChild(burst);
    }, 900);
  }

  /** Draw the trail piece from `level` to the next one as a line of light that runs along it. */
  function lightSegment(level: number): void {
    for (const s of sections) {
      if (!s.built || !s.svg) continue;
      let at = -1;
      for (let i = 0; i < s.points.length - 1; i++) if (s.points[i]!.level === level) at = i;
      if (at < 0) continue;
      const a = s.points[at]!;
      const d = 'M' + a.x + ' ' + a.y + s.pieces[at + 1]!;
      const path = svgEl('path', { class: 'm-trail__run', d });
      s.svg.appendChild(path);
      let len = 200;
      try {
        len = path.getTotalLength();
      } catch {
        // keep the estimate
      }
      path.style.strokeDasharray = len + ' ' + len;
      path.style.strokeDashoffset = String(len);
      void path.getBoundingClientRect();
      path.classList.add('m-trail__run--go');
      path.style.strokeDashoffset = '0';
      litOverlay.push(path);
    }
  }

  function finishCelebration(): void {
    if (!celebrating) return;
    celebrating = false;
    for (const id of celebrationTimers) window.clearTimeout(id);
    celebrationTimers = [];
    for (const path of litOverlay) if (path.parentNode) path.parentNode.removeChild(path);
    litOverlay = [];
    for (const key of Object.keys(starOverride)) delete starOverride[Number(key)];
    viewFrontier = profile.highestUnlocked();
    refreshNodes();
    const after = afterCelebration;
    afterCelebration = null;
    if (after) after();
  }

  function celebrate(w: WonInfo): void {
    celebrating = true;
    celebrationStarted = false;
    const next = w.level + 1;
    const hasNext = next <= levelCount;
    afterCelebration = () => {
      if (disposed) return;
      if (w.firstClear && !hasNext) {
        kit.openDialog({
          title: ui.t('meta.map.finished.title'),
          icon: 'trophy',
          body: ui.t('meta.map.finished.body'),
          buttons: [{ label: ui.t('common.ok'), variant: 'primary' }],
        });
        return;
      }
      if (hasNext && next <= profile.highestUnlocked()) {
        const c = nodeCentre(next);
        if (c && w.firstClear) {
          try {
            scroller.scrollTo({ top: scrollFor(c.y, viewH, scroller.scrollHeight, FOCUS_ANCHOR), behavior: kit.reducedMotion() ? 'auto' : 'smooth' });
          } catch {
            scroller.scrollTop = scrollFor(c.y, viewH, scroller.scrollHeight, FOCUS_ANCHOR);
          }
        }
        ctx.nav.openLevelIntro(next);
      }
    };

    const node = nodeView(w.level);
    if (hasNext) nodeView(next);
    if (!node || kit.reducedMotion()) {
      finishCelebration();
      return;
    }

    let t = 420;
    later(t - 60, () => {
      celebrationStarted = true;
    });
    // 1. the new stars pop onto the node
    for (let i = w.starsBefore; i < w.stars; i++) {
      const index = i;
      later(t, () => {
        starOverride[w.level] = index + 1;
        node.el.classList.add('m-node--showstars');
        const star = node.stars[index];
        if (star) {
          star.classList.add('on', 'pop');
        }
        sfx('star', index + 1);
      });
      t += 260;
    }
    // 2. the node turns into a finished one
    later(t, () => {
      node.el.classList.add('m-node--pop');
      if (w.firstClear) {
        starOverride[w.level] = w.stars;
        const state = 'done';
        node.el.classList.remove('m-node--current', 'm-skin-current', 'm-skin-hardCurrent');
        node.el.classList.add('m-node--' + state, 'm-skin-' + skinOf(state, node.hard));
      }
    });
    if (!w.firstClear || !hasNext) {
      later(t + 520, finishCelebration);
      return;
    }
    t += 300;
    // 3. the trail lights up and the lantern travels to the next level
    later(t, () => {
      lightSegment(w.level);
      viewFrontier = next;
      placeMarker(true);
    });
    t += 880;
    // 4. the next level opens
    later(t, () => {
      const nextNode = nodeView(next);
      if (nextNode) {
        applyNode(nextNode);
        nextNode.el.classList.add('m-node--pop');
      }
      sparkle(next);
      sfx('goalDone');
      try {
        platform.haptic('success');
      } catch {
        // haptics are a nicety
      }
    });
    t += 620;
    later(t, finishCelebration);
  }

  // ───────────────────────────── lifecycle ─────────────────────────────

  let unsubscribe: (() => void) | null = null;
  let resizeTimer = 0;
  let lastSize = '';

  function onResize(): void {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (disposed) return;
      const key = scroller.clientWidth + 'x' + scroller.clientHeight + '@' + kit.unit();
      if (key === lastSize) return;
      lastSize = key;
      const max = Math.max(1, scroller.scrollHeight - scroller.clientHeight);
      const ratio = scroller.scrollTop / max;
      if (celebrating) finishCelebration();
      build(ratio);
    }, 140);
  }

  function autoPopups(): void {
    if (!opts.auto || disposed || kit.hasOverlay()) return;
    // At most one automatic dialog per return to the map: a new booster first, else the daily reward.
    void ui.showUnlocks();
    if (kit.hasOverlay()) return;
    if (!opts.offerDaily || !showDaily) return;
    let can = false;
    try {
      can = profile.daily().canClaim;
    } catch {
      can = false;
    }
    if (!can) return;
    opts.onDailyOffered();
    window.setTimeout(() => {
      if (!disposed && !kit.hasOverlay()) void ui.openDaily();
    }, 450);
  }

  return {
    el: root,

    shown(): void {
      build(typeof opts.scrollRatio === 'number' ? opts.scrollRatio : null);
      lastSize = scroller.clientWidth + 'x' + scroller.clientHeight + '@' + kit.unit();
      refreshLives();
      refreshDailyBadge();
      unsubscribe = profile.subscribe(refreshProfile);
      window.addEventListener('resize', onResize);
      startTicker();
      if (won) celebrate(won);
      else autoPopups();
    },

    dispose(): void {
      disposed = true;
      celebrating = false;
      for (const id of celebrationTimers) window.clearTimeout(id);
      celebrationTimers = [];
      stopTicker();
      window.clearTimeout(resizeTimer);
      window.cancelAnimationFrame(coinTween);
      window.removeEventListener('resize', onResize);
      if (unsubscribe) unsubscribe();
      unsubscribe = null;
    },

    handleBack(): boolean {
      if (celebrating) {
        finishCelebration();
        return true;
      }
      return false;
    },

    setPaused(value: boolean): void {
      paused = value;
      if (value) stopTicker();
      else {
        refreshLives();
        refreshDailyBadge();
        startTicker();
      }
    },

    scrollRatio(): number {
      const max = scroller.scrollHeight - scroller.clientHeight;
      return max > 0 ? scroller.scrollTop / max : 1;
    },
  };
}
