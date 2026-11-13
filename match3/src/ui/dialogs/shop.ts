/**
 * Shop overlay. Sections, top to bottom:
 *  - real-money offers when the store is available: starter pack and "remove ads" (hidden once
 *    owned), then the coin packs with the store's own price strings;
 *  - "Free coins" for watching a rewarded ad, when ads are available;
 *  - the boosters, bought with coins.
 * Everything follows the profile and the store live while the dialog is open.
 */
import type { ProductDef, ProductId, ProductInfo, PurchaseOutcome } from '../../monetize/types.ts';
import * as econ from '../../state/index.ts';
import type { BoosterId, Reward } from '../../state/types.ts';
import { SHOP_BOOSTER_IDS, boosterIcon, coinPackArt, coinsIn, pickNumber, rewardView, rewardedLeft, splitProducts } from '../helpers.ts';
import type { KitButton, OfferCard } from '../kit/index.ts';
import type { Ui } from '../types.ts';

type Product = { def: ProductDef; info: ProductInfo };

/** Coins granted by one "free coins" ad: from the economy constants (docs/DESIGN.md §7: 50). */
export function freeCoinsAmount(): number {
  return pickNumber(econ, ['FREE_COINS_AD_REWARD', 'AD_FREE_COINS', 'FREE_COINS_REWARD', 'REWARDED_COINS', 'AD_COINS_REWARD', 'FREE_COINS_PER_AD', 'AD_REWARD_COINS'], 50);
}

export function openShopDialog(ui: Ui): Promise<void> {
  const { kit, ctx } = ui;
  const { profile, i18n, store, audio } = ctx;
  const h = kit.el;
  const t = ui.t;

  let open = true;
  let shownCoins = profile.coins();
  const balance = kit.chip({ icon: 'coin', text: i18n.num(shownCoins), className: 'm-shop__balance' });
  const moneyBox = h('div', { class: 'm-shop__money' });
  const freeBox = h('div', { class: 'm-shop__free' });
  const boosterBox = h('div', { class: 'm-shop__boosters' });
  const body = h('div', { class: 'm-shop' }, h('div', { class: 'm-shop__head' }, balance.el), moneyBox, freeBox, boosterBox);

  function sfx(name: 'purchase' | 'coin' | 'reward' | 'invalid'): void {
    try {
      audio.sfx(name);
    } catch {
      // sound is a nicety
    }
  }

  function heading(text: string): HTMLElement {
    return h('div', { class: 'm-shop__title' }, h('i', { class: 'm-orn' }), h('span', { text }), h('i', { class: 'm-orn' }));
  }

  // ───────────────────────────── coin balance ─────────────────────────────

  let tweening = false;
  function refreshBalance(): void {
    const target = profile.coins();
    if (target === shownCoins || tweening) return;
    const from = shownCoins;
    shownCoins = target;
    if (target < from || kit.reducedMotion()) {
      balance.set(i18n.num(target));
      return;
    }
    tweening = true;
    const text = balance.el.querySelector('.k-chip__text');
    const done = (): void => {
      tweening = false;
      balance.set(i18n.num(shownCoins), false);
      balance.bump();
      if (profile.coins() !== shownCoins) refreshBalance();
    };
    if (text) kit.tweenNumber(text, from, target, 700).then(done, done);
    else done();
  }

  /** A few coins fly from where they were earned up to the balance. */
  function flyCoins(from: Element | null): void {
    if (!from || kit.reducedMotion()) return;
    const a = from.getBoundingClientRect();
    const b = balance.el.getBoundingClientRect();
    if (a.width === 0 || b.width === 0) return;
    const layer = dialog.el.parentElement || document.body;
    for (let i = 0; i < 7; i++) {
      const coin = h('div', { class: 'm-fly' }, kit.icon('coin', 26));
      const x0 = a.left + a.width / 2 + (Math.random() - 0.5) * a.width * 0.5;
      const y0 = a.top + a.height / 2 + (Math.random() - 0.5) * a.height * 0.4;
      coin.style.left = x0 + 'px';
      coin.style.top = y0 + 'px';
      coin.style.transitionDelay = i * 55 + 'ms';
      layer.appendChild(coin);
      void coin.offsetWidth;
      coin.style.transform = 'translate(' + (b.left + 14 - x0) + 'px,' + (b.top + b.height / 2 - y0) + 'px) scale(0.7)';
      coin.style.opacity = '0.2';
      window.setTimeout(
        () => {
          if (coin.parentNode) coin.parentNode.removeChild(coin);
        },
        700 + i * 55,
      );
    }
  }

  // ───────────────────────────── real money ─────────────────────────────

  function rewardsText(rewards: readonly Reward[]): string {
    const parts: string[] = [];
    for (const r of rewards) parts.push(rewardView(t, i18n.num, r).text);
    return parts.join(i18n.isRtl() ? '، ' : ', ');
  }

  function outcomeFeedback(outcome: PurchaseOutcome, card: OfferCard): void {
    switch (outcome) {
      case 'purchased':
        sfx('purchase');
        flyCoins(card.el.querySelector('.k-offer__art'));
        kit.toast(t('meta.shop.purchased'), { icon: 'check' });
        break;
      case 'pending':
        kit.toast(t('meta.shop.pending'), { icon: 'info', duration: 6000 });
        break;
      case 'cancelled':
        break;
      case 'alreadyOwned':
        kit.toast(t('meta.shop.alreadyOwned'), { icon: 'check' });
        break;
      case 'unavailable':
        kit.toast(t('meta.shop.unavailable'), { icon: 'info' });
        break;
      default:
        kit.toast(t('meta.shop.error'), { icon: 'info' });
    }
  }

  function buyProduct(id: ProductId, card: OfferCard): Promise<void> {
    card.update({ loading: true });
    const settle = (outcome: PurchaseOutcome): void => {
      if (!open) {
        // the dialog was closed while the store sheet was up: still tell the player what happened
        if (outcome === 'purchased') {
          sfx('purchase');
          kit.toast(t('meta.shop.purchased'), { icon: 'check' });
        } else if (outcome === 'pending') {
          kit.toast(t('meta.shop.pending'), { icon: 'info', duration: 6000 });
        }
        return;
      }
      card.update({ loading: false });
      outcomeFeedback(outcome, card);
      refreshBalance();
      renderMoney();
    };
    return store.buy(id).then(settle, (err: unknown) => {
      console.error('[shop] purchase failed', err);
      settle('error');
    });
  }

  let moneyKey = '';

  function renderMoney(): void {
    let products: Product[] = [];
    let available = false;
    let ads = false;
    try {
      available = store.iapAvailable();
      products = available ? store.products() : [];
      ads = store.adsAvailable();
    } catch (err) {
      console.error('[shop] store failed', err);
    }
    const { packs, starter, removeAds } = splitProducts(products);
    const showStarter = starter && !store.owns('starter_pack') ? starter : null;
    // "remove ads" only where there are ads to remove, and not for someone who already has them off
    const showRemove = removeAds && ads && !store.owns('remove_ads') && !store.owns('starter_pack') ? removeAds : null;
    // rebuild only when something visible changed (a rebuild would interrupt a press)
    const key = [available, ads, showStarter ? showStarter.info.price : '-', showRemove ? showRemove.info.price : '-', packs.map((p) => p.def.id + '=' + p.info.price).join(';'), i18n.lang()].join('|');
    if (key === moneyKey) return;
    moneyKey = key;
    kit.clear(moneyBox);
    if (!available || (packs.length === 0 && !showStarter && !showRemove)) return;

    if (showStarter || showRemove) {
      moneyBox.appendChild(heading(t('meta.shop.offers')));
      const list = h('div', { class: 'm-shop__rows' });
      if (showStarter) {
        const product = showStarter;
        const extra = product.def.removesAds && ads ? (i18n.isRtl() ? '، ' : ', ') + t('meta.shop.noAdsIncluded') : '';
        const card = kit.offerCard({
          art: 'gift',
          title: t('meta.shop.starter'),
          subtitle: rewardsText(product.def.grants) + extra,
          price: product.info.price,
          layout: 'row',
          featured: true,
          onBuy: (c) => buyProduct(product.def.id, c),
        });
        card.el.dataset.product = product.def.id;
        list.appendChild(card.el);
      }
      if (showRemove) {
        const product = showRemove;
        const card = kit.offerCard({
          art: 'noAds',
          title: t('meta.shop.removeAds'),
          subtitle: t('meta.shop.removeAdsSub'),
          price: product.info.price,
          layout: 'row',
          onBuy: (c) => buyProduct(product.def.id, c),
        });
        card.el.dataset.product = product.def.id;
        list.appendChild(card.el);
      }
      moneyBox.appendChild(list);
    }

    if (packs.length > 0) {
      moneyBox.appendChild(heading(t('meta.shop.coinPacks')));
      const grid = h('div', { class: 'k-grid2 m-shop__grid' });
      packs.forEach((product, index) => {
        const coins = coinsIn(product.def.grants);
        const badge = product.def.badge;
        const card = kit.offerCard({
          art: coinPackArt(packs.length > 1 ? index / (packs.length - 1) : 1),
          title: t('meta.shop.coins', { n: coins }),
          price: product.info.price,
          ribbon: badge ? { text: t('meta.shop.badge.' + badge), tone: badge } : null,
          featured: badge === 'best',
          onBuy: (c) => buyProduct(product.def.id, c),
        });
        card.el.dataset.product = product.def.id;
        // an odd number of packs: the largest one spans the row
        if (packs.length % 2 === 1 && index === packs.length - 1) card.el.classList.add('m-shop__wide');
        grid.appendChild(card.el);
      });
      moneyBox.appendChild(grid);
    }
    if (ads) moneyBox.appendChild(kit.text(t('meta.shop.payerNote'), 'k-text--center k-text--muted k-text--sm m-shop__note'));
  }

  // ───────────────────────────── free coins (rewarded ad) ─────────────────────────────

  let freeButton: KitButton | null = null;
  let freeLeftEl: HTMLElement | null = null;
  let freeBusy = false;

  function freeState(): { show: boolean; left: number | null; ready: boolean } {
    try {
      return { show: store.adsAvailable() && ui.feature('rewardedAds'), left: rewardedLeft(store, 'freeCoins'), ready: store.rewardedReady() };
    } catch {
      return { show: false, left: 0, ready: false };
    }
  }

  function renderFree(): void {
    const state = freeState();
    if (!state.show) {
      kit.clear(freeBox);
      freeButton = null;
      freeLeftEl = null;
      return;
    }
    const amount = freeCoinsAmount();
    if (!freeButton || !freeLeftEl || !freeBox.firstChild) {
      kit.clear(freeBox);
      freeLeftEl = h('div', { class: 'k-offer__sub' });
      freeButton = kit.adButton({
        label: '+' + i18n.num(amount),
        caption: t('meta.ad.watch'),
        rewardIcon: 'coin',
        size: 'sm',
        onClick: () => watchForCoins(),
      });
      freeButton.dataset.act = 'free-coins';
      freeBox.appendChild(heading(t('meta.shop.free')));
      freeBox.appendChild(
        h(
          'div',
          { class: 'k-offer k-offer--row m-shop__freecard' },
          h('div', { class: 'k-offer__art' }, kit.icon('coinPile', 56)),
          h('div', { class: 'k-offer__texts' }, h('div', { class: 'k-offer__title', text: t('meta.shop.coins', { n: amount }) }), freeLeftEl),
          h('div', { class: 'k-offer__action' }, freeButton),
        ),
      );
    }
    freeLeftEl.textContent = state.left === null ? t('meta.ad.watch') : t('meta.ad.left', { n: state.left });
    freeButton.update({ disabled: freeBusy || !state.ready || state.left === 0, loading: freeBusy });
  }

  function watchForCoins(): Promise<void> {
    freeBusy = true;
    renderFree();
    const amount = freeCoinsAmount();
    const finish = (outcome: string): void => {
      freeBusy = false;
      if (outcome === 'earned') {
        profile.addCoins(amount);
        sfx('coin');
        if (open) flyCoins(freeBox.querySelector('.k-offer__art'));
        kit.toast(t('meta.shop.freeGot', { n: amount }), { icon: 'coin' });
      } else if (outcome === 'dismissed') {
        kit.toast(t('meta.ad.closed'), { icon: 'adVideo' });
      } else {
        kit.toast(t('meta.ad.none'), { icon: 'adVideo' });
      }
      if (open) {
        renderFree();
        refreshBalance();
      }
    };
    return store.showRewarded('freeCoins').then(finish, () => finish('unavailable'));
  }

  // ───────────────────────────── boosters ─────────────────────────────

  const boosterCards: { id: BoosterId; card: OfferCard }[] = [];

  function renderBoosters(): void {
    kit.clear(boosterBox);
    boosterCards.length = 0;
    boosterBox.appendChild(heading(t('common.boosters')));
    const ids = SHOP_BOOSTER_IDS.filter((id) => ui.boosterUnlocked(id));
    if (ids.length === 0) {
      boosterBox.appendChild(kit.text(t('meta.shop.boostersLocked'), 'k-text--center k-text--muted m-shop__empty'));
      return;
    }
    const list = h('div', { class: 'm-shop__rows' });
    for (const id of ids) {
      const name = t('booster.' + id + '.name');
      const card = kit.offerCard({
        art: boosterIcon(id),
        title: name,
        subtitle: t('booster.' + id + '.desc'),
        price: i18n.num(profile.boosterPrice(id)),
        priceIcon: 'coin',
        variant: 'primary',
        layout: 'row',
        quantity: '×' + i18n.num(profile.boosterCount(id)),
        onBuy: () => {
          if (profile.buyBooster(id)) {
            sfx('coin');
            kit.toast(t('meta.shop.boosterBought', { name }), { icon: boosterIcon(id), duration: 1600 });
          } else {
            sfx('invalid');
            kit.toast(t('common.notEnoughCoins'), { icon: 'coin' });
          }
        },
      });
      card.el.dataset.booster = id;
      boosterCards.push({ id, card });
      list.appendChild(card.el);
    }
    boosterBox.appendChild(list);
    patchBoosters();
  }

  function patchBoosters(): void {
    const coins = profile.coins();
    for (const { id, card } of boosterCards) {
      card.update({ quantity: '×' + i18n.num(profile.boosterCount(id)), disabled: coins < profile.boosterPrice(id) });
    }
  }

  // ───────────────────────────── lifecycle ─────────────────────────────

  const dialog = kit.openDialog({
    title: t('common.shop'),
    body,
    wide: true,
    className: 'm-dialog-shop',
    onClose: () => {
      open = false;
      unsubscribe();
      unwatch();
    },
  });

  const unsubscribe = profile.subscribe(() => {
    if (!open) return;
    refreshBalance();
    patchBoosters();
  });
  const unwatch = store.onChange(() => {
    if (!open) return;
    renderMoney();
    renderFree();
  });

  renderMoney();
  renderFree();
  renderBoosters();
  return dialog.closed.then(() => undefined);
}
