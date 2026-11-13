/**
 * Level intro: "Level N", the goals as icon + sentence, the best result when replaying, the
 * Caravan (win streak) and its gift, the start boosters as toggles, and one primary button: Play.
 * Play needs a life (once the lives system is unlocked): with none left it opens the lives dialog.
 */
import type { LevelDef, StartBoosters } from '../../engine/types.ts';
import type { StartBoosterId } from '../../state/types.ts';
import { START_BOOSTER_IDS, boosterIcon, boosterList, goalIcon, goalText, mergeBoosters } from '../helpers.ts';
import type { DialogHandle, Qty } from '../kit/index.ts';
import type { Ui } from '../types.ts';

interface Tile {
  id: StartBoosterId;
  el: HTMLButtonElement;
  qty: Qty;
}

export function openIntroDialog(ui: Ui, level: LevelDef): DialogHandle<unknown> {
  const { kit, ctx } = ui;
  const { profile, i18n, audio } = ctx;
  const h = kit.el;
  const t = ui.t;

  const body = h('div', { class: 'm-intro' });
  const selected: StartBoosters = {};

  // ── hard tag ──
  if (level.hard) {
    body.appendChild(h('div', { class: 'm-tag m-tag--hard' }, h('i', { class: 'm-tag__gem' }), h('span', { text: t('meta.intro.hard') })));
  }

  // ── goals ──
  const goals = h('div', { class: 'm-goals' });
  for (const goal of level.goals) {
    goals.appendChild(h('div', { class: 'm-goal' }, h('span', { class: 'm-goal__icon' }, kit.icon(goalIcon(goal), 34)), h('span', { class: 'm-goal__text', text: goalText(t, goal) })));
  }
  goals.appendChild(
    h('div', { class: 'm-goal m-goal--moves' }, h('span', { class: 'm-goal__icon' }, kit.icon('moves', 30)), h('span', { class: 'm-goal__text', text: t('meta.intro.moves', { n: level.moves }) })),
  );
  body.appendChild(goals);

  // ── best result (replay) ──
  const record = profile.record(level.id);
  if (record) {
    body.appendChild(
      h(
        'div',
        { class: 'm-best' },
        kit.starRow(record.stars, { size: 30 }).el,
        h('div', { class: 'm-best__text' }, h('span', { text: t('meta.intro.best') }), h('b', { class: 'k-num', text: i18n.num(record.best) })),
      ),
    );
  }

  // ── Caravan ──
  let gift: StartBoosters = {};
  if (ui.feature('caravan')) {
    let wins = 0;
    try {
      wins = typeof profile.caravan === 'function' ? profile.caravan() || 0 : 0;
      gift = (typeof profile.caravanBoosters === 'function' ? profile.caravanBoosters() : null) || {};
    } catch {
      gift = {};
    }
    const ids = boosterList(gift);
    const steps = h('div', { class: 'm-caravan__steps', 'aria-hidden': 'true' });
    for (let i = 1; i <= 3; i++) steps.appendChild(h('i', { class: i <= wins ? 'on' : '' }));
    const box = h(
      'div',
      { class: 'm-caravan' + (ids.length > 0 ? ' m-caravan--on' : '') },
      h('div', { class: 'm-caravan__head' }, h('b', { text: t('meta.caravan.name') }), steps, wins > 0 ? h('span', { class: 'm-caravan__wins', text: t('meta.caravan.wins', { n: wins }) }) : null),
    );
    if (ids.length > 0) {
      const icons = h('div', { class: 'm-caravan__gifts' });
      for (const id of ids) icons.appendChild(h('span', { class: 'm-caravan__gift', title: t('booster.' + id + '.name') }, kit.icon(boosterIcon(id), 30)));
      box.appendChild(h('div', { class: 'm-caravan__row' }, h('span', { class: 'm-caravan__text', text: t('meta.caravan.brings') }), icons));
    } else {
      box.appendChild(h('div', { class: 'm-caravan__text m-caravan__text--hint', text: t('meta.caravan.hint') }));
    }
    body.appendChild(box);
  }

  // ── start boosters ──
  const tiles: Tile[] = [];
  const available = START_BOOSTER_IDS.filter((id) => ui.boosterUnlocked(id));

  function renderTile(tile: Tile): void {
    const count = profile.boosterCount(tile.id);
    const on = selected[tile.id] === true;
    tile.el.classList.toggle('m-boost--on', on);
    tile.el.classList.toggle('m-boost--none', count <= 0 && !on);
    tile.el.setAttribute('aria-pressed', on ? 'true' : 'false');
    tile.qty.set(count > 0 ? String(count) : '+', false);
  }

  function offerToBuy(tile: Tile): void {
    const id = tile.id;
    const price = profile.boosterPrice(id);
    const name = t('booster.' + id + '.name');
    const offer = kit.openDialog({
      title: name,
      icon: boosterIcon(id),
      body: h('div', { class: 'm-buyone' }, kit.text(t('booster.' + id + '.desc'), 'k-text--center'), kit.text(t('meta.intro.buyHint'), 'k-text--center k-text--muted k-text--sm')),
      buttons: [
        { label: t('common.cancel'), variant: 'secondary' },
        kit.priceButton({
          price: i18n.num(price),
          label: t('common.buy'),
          icon: 'coin',
          variant: 'primary',
          onClick: () => {
            if (profile.buyBooster(id)) {
              selected[id] = true;
              try {
                audio.sfx('coin');
              } catch {
                // sound is a nicety
              }
              offer.close();
              return;
            }
            kit.toast(t('common.notEnoughCoins'), { icon: 'coin' });
            offer.close();
            if (ui.feature('shop')) void ctx.nav.openShop();
          },
        }),
      ],
    });
  }

  function toggle(tile: Tile): void {
    if (selected[tile.id]) {
      delete selected[tile.id];
    } else if (profile.boosterCount(tile.id) > 0) {
      selected[tile.id] = true;
    } else {
      offerToBuy(tile);
      return;
    }
    try {
      audio.sfx('select');
    } catch {
      // sound is a nicety
    }
    renderTile(tile);
  }

  if (available.length > 0) {
    const row = h('div', { class: 'm-boosts' });
    for (const id of available) {
      const qty = kit.qty('0', { corner: true, tone: 'gold' });
      const el = h(
        'button',
        { type: 'button', class: 'm-boost', dataset: { booster: id }, 'aria-label': t('booster.' + id + '.name') },
        h('span', { class: 'm-boost__art' }, kit.icon(boosterIcon(id), 44), qty.el, h('span', { class: 'm-boost__tick', 'aria-hidden': 'true' }, kit.icon('check', 14))),
        h('span', { class: 'm-boost__name', text: t('booster.' + id + '.name') }),
      );
      const tile: Tile = { id, el, qty };
      el.addEventListener('click', () => toggle(tile));
      tiles.push(tile);
      renderTile(tile);
      row.appendChild(el);
    }
    body.appendChild(h('div', { class: 'm-intro__label', text: t('meta.intro.boosters') }));
    body.appendChild(row);
  }

  // ── Play ──
  function play(): void {
    if (ui.feature('lives') && profile.lives().count <= 0) {
      kit.toast(t('meta.lives.need'), { icon: 'heart' });
      void ui.openLives();
      return;
    }
    const chosen: StartBoosters = {};
    for (const id of boosterList(selected)) {
      if (profile.takeBooster(id)) chosen[id] = true;
    }
    let caravan: StartBoosters = {};
    try {
      caravan = (typeof profile.caravanBoosters === 'function' && ui.feature('caravan') ? profile.caravanBoosters() : null) || {};
    } catch {
      caravan = {};
    }
    launched = true;
    ctx.nav.toPlay(level.id, mergeBoosters(chosen, caravan));
  }

  let launched = false;
  const playButton = kit.button({ label: t('common.play'), icon: 'play', size: 'lg', block: true, shine: true, onClick: play });
  playButton.dataset.act = 'intro-play';

  const unsubscribe = profile.subscribe(() => {
    for (const tile of tiles) {
      // a booster that ran out elsewhere cannot stay selected
      if (selected[tile.id] && profile.boosterCount(tile.id) <= 0 && !launched) delete selected[tile.id];
      renderTile(tile);
    }
  });

  const dialog = kit.openDialog({
    title: t('common.level', { n: level.id }),
    icon: level.goals.length > 0 ? goalIcon(level.goals[0]!) : 'play',
    body,
    buttons: [playButton],
    className: 'm-dialog-intro' + (level.hard ? ' m-dialog-intro--hard' : ''),
    onClose: () => unsubscribe(),
  });
  return dialog;
}
