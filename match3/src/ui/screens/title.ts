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
  const caption = (): string | null => (isFirstRun() ? null : ui.t('common.level', { n: focusLevel(profile.highestUnlocked(), ui.world.levels.length) }));

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

  root.appendChild(backdrop);
  root.appendChild(el('div', { class: 'm-title__top' }, settingsButton));
  root.appendChild(el('div', { class: 'm-title__mid' }, logoBox));
  root.appendChild(el('div', { class: 'm-title__bottom' }, playButton));

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
    const room = h - 190 * unit;
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
        if (!disposed) playButton.update({ caption: caption() });
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
