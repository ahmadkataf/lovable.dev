/**
 * Lives dialog: how many lives, the countdown to the next one, "refill all" for coins and — when a
 * rewarded ad is ready — "+1 life" for watching it. Updates once a second while it is open.
 */
import * as econ from '../../state/index.ts';
import { rewardedLeft } from '../helpers.ts';
import type { Ui } from '../types.ts';

export function openLivesDialog(ui: Ui): Promise<void> {
  const { kit, ctx } = ui;
  const { profile, i18n, store, audio } = ctx;
  const h = kit.el;
  const t = ui.t;

  const countEl = h('span', { class: 'm-lives__count k-num' });
  const heart = h('div', { class: 'm-lives__heart' }, kit.icon('heart', 92), countEl);
  const pips = h('div', { class: 'm-lives__pips', 'aria-hidden': 'true' });
  const status = h('div', { class: 'm-lives__status' });
  const clock = h('b', { class: 'm-lives__clock k-num' });
  const regenMinutes = Math.round(econ.LIFE_REGEN_MS / 60000);
  const hint = kit.text(t('meta.lives.regen', { n: regenMinutes }), 'k-text--center k-text--muted k-text--sm');
  const body = h('div', { class: 'm-lives' }, heart, pips, status, hint);

  const price = econ.REFILL_LIVES_PRICE;

  function sfx(name: 'reward' | 'coin'): void {
    try {
      audio.sfx(name);
    } catch {
      // sound is a nicety
    }
  }

  const refillButton = kit.priceButton({
    price: i18n.num(price),
    label: t('meta.lives.refill'),
    icon: 'coin',
    variant: 'primary',
    block: true,
    onClick: () => {
      if (profile.refillLives()) {
        sfx('reward');
        kit.toast(t('meta.lives.refilled'), { icon: 'heart' });
        dialog.close();
        return;
      }
      const info = profile.lives();
      if (info.count >= info.max) return;
      kit.toast(t('common.notEnoughCoins'), { icon: 'coin' });
      if (ui.feature('shop')) void ctx.nav.openShop();
    },
  });
  refillButton.dataset.act = 'lives-refill';

  const adButton = kit.adButton({
    label: t('meta.lives.ad'),
    caption: t('meta.ad.watch'),
    rewardIcon: 'heart',
    block: true,
    onClick: () => {
      adButton.update({ loading: true });
      return store.showRewarded('freeLife').then(
        (outcome) => {
          adButton.update({ loading: false });
          if (outcome === 'earned') {
            if (profile.addLife()) {
              sfx('reward');
              kit.toast(t('meta.lives.gotOne'), { icon: 'heart' });
            } else {
              // the last life came back by itself while the ad was playing
              kit.toast(t('meta.lives.full'), { icon: 'heart' });
            }
          } else if (outcome === 'dismissed') {
            kit.toast(t('meta.ad.closed'), { icon: 'adVideo' });
          } else {
            kit.toast(t('meta.ad.none'), { icon: 'adVideo' });
          }
          if (dialog.isOpen()) render();
        },
        () => {
          adButton.update({ loading: false });
          kit.toast(t('meta.ad.none'), { icon: 'adVideo' });
          if (dialog.isOpen()) render();
        },
      );
    },
  });
  adButton.dataset.act = 'lives-ad';

  const actions = h('div', { class: 'm-lives__actions' }, refillButton, adButton);
  body.appendChild(actions);

  let lastCount = -1;
  let shownFull: boolean | null = null;
  let titleKey = '';

  /** Draws the current state; returns the time left on the countdown (0 when the lives are full). */
  function render(): number {
    const info = profile.lives();
    const full = info.count >= info.max;
    if (info.count !== lastCount) {
      lastCount = info.count;
      countEl.textContent = String(info.count);
      kit.clear(pips);
      for (let i = 0; i < info.max; i++) pips.appendChild(h('i', { class: i < info.count ? 'on' : '' }));
    }
    heart.classList.toggle('m-lives__heart--empty', info.count <= 0);
    if (full !== shownFull) {
      shownFull = full;
      kit.clear(status);
      if (full) {
        status.appendChild(h('span', { text: t('meta.lives.full') }));
      } else {
        status.appendChild(h('span', { class: 'm-lives__label', text: t('meta.lives.next') }));
        status.appendChild(clock);
      }
    }
    if (!full) {
      const text = i18n.clock(info.nextInMs);
      if (clock.textContent !== text) clock.textContent = text;
    }
    refillButton.update({ disabled: full });
    refillButton.classList.toggle('m-hidden', full);
    let adOk = false;
    try {
      const left = rewardedLeft(store, 'freeLife');
      adOk = !full && ui.feature('rewardedAds') && store.rewardedReady() && (left === null || left > 0);
    } catch {
      adOk = false;
    }
    adButton.classList.toggle('m-hidden', !adOk);
    actions.classList.toggle('m-hidden', full);
    const key = info.count <= 0 ? 'meta.lives.outTitle' : 'common.lives';
    if (key !== titleKey) {
      titleKey = key;
      dialog.setTitle(t(key));
    }
    return full ? 0 : info.nextInMs;
  }

  const dialog = kit.openDialog({
    title: t('common.lives'),
    body,
    className: 'm-dialog-lives',
    onClose: () => {
      stopTicker();
      unsubscribe();
      unwatch();
    },
  });
  dialog.el.dataset.dialog = 'lives';
  const unsubscribe = profile.subscribe(() => void render());
  const unwatch = store.onChange(() => void render());
  // follows the countdown second by second; stands still while the app is in the background
  const stopTicker = ui.ticker(render);
  return dialog.closed.then(() => undefined);
}
