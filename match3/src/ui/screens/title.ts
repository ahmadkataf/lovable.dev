/**
 * Title screen: the first chapter's backdrop, the logo in the current language, one large Play
 * button and the settings button.
 */
import { focusLevel } from '../helpers.ts';
import { paintBackdropCanvas } from './backdrop.ts';
import type { Screen, Ui } from '../types.ts';

export function createTitleScreen(ui: Ui): Screen {
  const { kit, ctx } = ui;
  const { profile, i18n, art } = ctx;
  const el = kit.el;

  const root = kit.screen('m-title' + (ui.flags.still ? ' m-still' : ''));
  const backdrop = el('div', { class: 'm-title__bg', 'aria-hidden': 'true' });
  const logoBox = el('div', { class: 'm-title__logo' });
  const theme = ui.world.chapters.length > 0 ? ui.world.chapters[0]!.theme : 'oasis';
  const palette = art.palette(theme);
  backdrop.style.background = 'linear-gradient(180deg, ' + palette.bgTop + ' 0%, ' + palette.bgBottom + ' 100%)';

  /** The very first launch goes straight into level 1: no map detour, no pop-ups. */
  const isFirstRun = (): boolean => profile.highestUnlocked() <= 1 && profile.record(1) === null;
  /** "Level N" under Play names the level the journey has reached — nothing on a first run or when every level is won. */
  const caption = (): string | null => {
    if (isFirstRun()) return null;
    const next = focusLevel(profile.highestUnlocked(), ui.world.levels.length);
    // every level won: say so, rather than nothing
    return profile.record(next) ? ui.t('meta.title.complete') : ui.t('common.level', { n: next });
  };
  /** The stars collected so far, out of all there are (not on a first run). */
  const starsText = el('span', { class: 'k-num' });
  const starsPill = el('div', { class: 'm-title__stars' }, kit.icon('star', 22), starsText);
  function renderStars(): void {
    const first = isFirstRun();
    starsPill.classList.toggle('m-hidden', first);
    if (first) return;
    const text = i18n.num(profile.totalStars()) + '/' + i18n.num(ui.world.levels.length * 3);
    if (starsText.textContent !== text) starsText.textContent = text;
    starsPill.setAttribute('aria-label', ui.t('meta.map.aria.stars', { n: profile.totalStars() }));
  }
  renderStars();

  const playButton = kit.button({
    label: ui.t('common.play'),
    icon: 'play',
    size: 'lg',
    shine: true,
    caption: caption() || undefined,
    className: 'm-title__play',
    onClick: () => {
      // judged at the moment of the press: the progress may have been reset while this screen was up
      if (isFirstRun()) ctx.nav.toPlay(1, {});
      else ctx.nav.toMap();
    },
  });
  playButton.dataset.act = 'play';

  const settingsButton = kit.iconButton({
    icon: 'settings',
    ariaLabel: ui.t('common.settings'),
    variant: 'secondary',
    onClick: () => ctx.nav.openSettings(),
  });
  settingsButton.dataset.act = 'settings';

  // a few stars that twinkle in the sky above the logo (positions in % of the screen, size, delay)
  const sparkles = el('div', { class: 'm-title__sparkles', 'aria-hidden': 'true' });
  const SPARKLES: readonly (readonly [number, number, number, number])[] = [
    [13, 11, 16, 0],
    [72, 7, 12, 1.3],
    [31, 24, 10, 2.2],
    [90, 27, 15, 0.7],
    [7, 36, 11, 2.9],
    [58, 17, 9, 3.6],
    [45, 5, 13, 1.9],
  ];
  for (const [x, y, size, delay] of SPARKLES) {
    const star = el('i');
    star.style.left = x + '%';
    star.style.top = y + '%';
    star.style.width = star.style.height = 'calc(var(--k-u) * ' + size + ')';
    star.style.animationDelay = delay + 's';
    sparkles.appendChild(star);
  }

  root.appendChild(backdrop);
  root.appendChild(sparkles);
  root.appendChild(el('div', { class: 'm-title__top' }, settingsButton));
  root.appendChild(el('div', { class: 'm-title__mid' }, logoBox));
  root.appendChild(el('div', { class: 'm-title__bottom' }, playButton, starsPill));

  let disposed = false;
  let resizeTimer = 0;
  let lastSize = '';
  let unsubscribe: (() => void) | null = null;

  function layout(): void {
    if (disposed) return;
    const w = root.clientWidth;
    const h = root.clientHeight;
    if (w < 1 || h < 1) return;
    const key = w + 'x' + h;
    if (key === lastSize) return;
    lastSize = key;
    // backdrop
    kit.clear(backdrop);
    const canvas = paintBackdropCanvas(art, theme, w, h);
    if (canvas) backdrop.appendChild(canvas);
    // logo: as wide as the screen allows, but never taller than the room above the button
    const unit = kit.unit();
    // (Play, the stars under it and the margins; on a short landscape screen the stars stand beside Play — meta.css)
    const room = h - (w > h && h <= 520 ? 190 : 236) * unit;
    const width = Math.max(120, Math.min(w * 0.84, 330 * unit, room / 0.9));
    kit.clear(logoBox);
    const logo = art.logo(Math.round(width), i18n.lang());
    logo.classList.add('m-title__logoimg');
    logoBox.appendChild(logo);
  }

  function onResize(): void {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(layout, 120);
  }

  return {
    el: root,
    shown(): void {
      layout();
      window.addEventListener('resize', onResize);
      // "Level N" under Play follows the profile (a reset from the settings turns it back into a first run)
      unsubscribe = profile.subscribe(() => {
        if (disposed) return;
        playButton.update({ caption: caption() });
        renderStars();
      });
    },
    dispose(): void {
      disposed = true;
      window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      if (unsubscribe) unsubscribe();
      unsubscribe = null;
    },
  };
}
