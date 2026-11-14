/**
 * Level intro: "Level N" (with the "hard level" tag or, on a replay, the stars already won), the
 * goals as icon + sentence, the Caravan (win streak) and its gift, the start boosters as toggles,
 * and one primary button: Play.
 * Play needs a life (once the lives system is unlocked): with none left it opens the lives dialog.
 */
import type { LevelDef, StartBoosters } from '../../engine/types.ts';
import type { StartBoosterId } from '../../state/types.ts';
import { START_BOOSTER_IDS, boosterIcon, boosterList, goalIcon, goalText } from '../helpers.ts';
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

  // Two groups: what the level asks (moves, lives, goals) and what the player brings (Caravan,
  // boosters). Stacked on a phone held upright; side by side on a short landscape screen (meta.css).
  const main = h('div', { class: 'm-intro__col m-intro__col--main' });
  const side = h('div', { class: 'm-intro__col m-intro__col--side' });
  const body = h('div', { class: 'm-intro' }, main, side);
  const selected: StartBoosters = {};
  let launched = false;

  function sfx(name: 'select' | 'coin'): void {
    try {
      audio.sfx(name);
    } catch {
      // sound is a nicety
    }
  }

  // ── moves and lives (once that system is unlocked) ──
  const livesText = h('span', { class: 'k-num' });
  const livesPill = ui.feature('lives') ? h('div', { class: 'm-pill m-pill--lives' }, kit.icon('heart', 20), livesText) : null;
  /** Returns the time left until the next life (0 = full, or nothing to show). */
  function renderLives(): number {
    if (!livesPill) return 0;
    const info = profile.lives();
    const text = info.count + '/' + info.max;
    if (livesText.textContent !== text) livesText.textContent = text;
    livesPill.classList.toggle('m-pill--empty', info.count <= 0);
    livesPill.setAttribute('aria-label', t('meta.map.aria.lives', { n: info.count }));
    return info.count >= info.max ? 0 : info.nextInMs;
  }
  main.appendChild(h('div', { class: 'm-intro__meta' }, h('div', { class: 'm-pill' }, kit.icon('moves', 20), h('span', { text: t('meta.intro.moves', { n: level.moves }) })), livesPill));

  // ── goals ──
  const goals = h('div', { class: 'm-goals' });
  for (const goal of level.goals) {
    goals.appendChild(h('div', { class: 'm-goal' }, h('span', { class: 'm-goal__icon' }, kit.icon(goalIcon(goal), 30)), h('span', { class: 'm-goal__text', text: goalText(t, goal) })));
  }
  main.appendChild(goals);

  // ── Caravan: the streak as three steps; what it brings for this level, or how to get it going ──
  let gift: StartBoosters = {};
  if (ui.feature('caravan')) {
    const wins = profile.caravan();
    gift = profile.caravanBoosters();
    const ids = boosterList(gift);
    const steps = h('span', { class: 'm-caravan__steps', 'aria-hidden': 'true' });
    for (let i = 1; i <= 3; i++) steps.appendChild(h('i', { class: i <= wins ? 'on' : '' }));
    const head = h('div', { class: 'm-caravan__head' }, h('b', { text: t('meta.caravan.name') }), steps);
    const box = h('div', { class: 'm-caravan' + (ids.length > 0 ? ' m-caravan--on' : ''), 'aria-label': wins > 0 ? t('meta.caravan.wins', { n: wins }) : undefined }, head);
    if (ids.length > 0) {
      const icons = h('span', { class: 'm-caravan__gifts' }, h('span', { class: 'm-caravan__free', text: t('meta.caravan.brings') }));
      for (const id of ids) icons.appendChild(h('span', { class: 'm-caravan__gift', title: t('booster.' + id + '.name') }, kit.icon(boosterIcon(id), 28)));
      head.appendChild(icons);
    } else {
      box.appendChild(h('div', { class: 'm-caravan__hint', text: t('meta.caravan.hint') }));
    }
    side.appendChild(box);
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
    tile.qty.set(count > 0 ? i18n.num(count) : '+', false);
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
            if (!offer.isOpen()) return;
            if (profile.buyBooster(id)) {
              selected[id] = true;
              renderTile(tile);
              sfx('coin');
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
    if (launched) return;
    if (selected[tile.id]) {
      delete selected[tile.id];
    } else if (profile.boosterCount(tile.id) > 0) {
      selected[tile.id] = true;
    } else {
      offerToBuy(tile);
      return;
    }
    sfx('select');
    renderTile(tile);
  }

  if (available.length > 0) {
    const row = h('div', { class: 'm-boosts' });
    for (const id of available) {
      const qty = kit.qty('0', { corner: true, tone: 'gold' });
      const el = h(
        'button',
        { type: 'button', class: 'm-boost', dataset: { booster: id }, 'aria-label': t('booster.' + id + '.name') },
        h('span', { class: 'm-boost__art' }, kit.icon(boosterIcon(id), 42), qty.el, h('span', { class: 'm-boost__tick', 'aria-hidden': 'true' }, kit.icon('check', 14))),
        h('span', { class: 'm-boost__name', text: t('booster.' + id + '.name') }),
      );
      const tile: Tile = { id, el, qty };
      el.addEventListener('click', () => toggle(tile));
      tiles.push(tile);
      renderTile(tile);
      row.appendChild(el);
    }
    side.appendChild(h('div', { class: 'm-intro__boosters' }, h('div', { class: 'm-intro__label', text: t('meta.intro.boosters') }), row));
  }

  // nothing to bring yet (an early level): one group only, also in landscape
  if (!side.firstChild) {
    body.removeChild(side);
    body.classList.add('m-intro--one');
  }
  const oneColumn = !body.contains(side);

  // ── Play ──
  function play(): void {
    if (launched) return;
    if (ui.feature('lives') && profile.lives().count <= 0) {
      kit.toast(t('meta.lives.need'), { icon: 'heart' });
      void ui.openLives();
      return;
    }
    // what the Caravan brings is decided now, not when the dialog was opened
    const caravan = ui.feature('caravan') ? profile.caravanBoosters() : {};
    launched = true;
    // the chosen boosters leave the inventory only if the level really starts (see Ui.startLevel)
    if (!ui.startLevel(level.id, selected, caravan)) launched = false;
  }

  const playButton = kit.button({ label: t('common.play'), icon: 'play', size: 'lg', block: true, shine: true, onClick: play });
  playButton.dataset.act = 'intro-play';

  const unsubscribe = profile.subscribe(() => {
    renderLives();
    for (const tile of tiles) {
      // a booster that ran out elsewhere cannot stay selected
      if (selected[tile.id] && profile.boosterCount(tile.id) <= 0 && !launched) delete selected[tile.id];
      renderTile(tile);
    }
  });
  let stopTicker: (() => void) | null = null;

  const dialog = kit.openDialog({
    title: t('common.level', { n: level.id }),
    icon: level.goals.length > 0 ? goalIcon(level.goals[0]!) : 'play',
    body,
    buttons: [playButton],
    className: 'm-dialog-intro',
    onClose: () => {
      unsubscribe();
      if (stopTicker) stopTicker();
      stopTicker = null;
      window.removeEventListener('resize', fadeAll);
    },
  });
  dialog.el.dataset.dialog = 'intro';
  if (oneColumn) dialog.el.classList.add('m-dialog-intro--one');

  // Side by side, each group scrolls on its own when it is too tall: its bottom edge then fades out,
  // so it is plain that there is more below (see meta.css, level intro in landscape).
  // Stacked (a phone held upright), the whole body scrolls instead, and fades the same way.
  const cols = [main, side];
  const more = (el: HTMLElement): boolean => el.clientHeight > 0 && el.scrollHeight - el.scrollTop - el.clientHeight > 2;
  function fade(col: HTMLElement): void {
    col.classList.toggle('m-intro__col--more', more(col));
  }
  function fadeBody(): void {
    dialog.body.classList.toggle('m-intro--more', more(dialog.body));
  }
  function fadeAll(): void {
    for (const col of cols) fade(col);
    fadeBody();
  }
  for (const col of cols) col.addEventListener('scroll', () => fade(col), { passive: true });
  dialog.body.addEventListener('scroll', fadeBody, { passive: true });
  window.addEventListener('resize', fadeAll);
  window.requestAnimationFrame(fadeAll);
  // (the dialog grows into place: measure again once it has landed)
  window.setTimeout(() => {
    if (dialog.isOpen()) fadeAll();
  }, 360);

  // Under the title, in place of the ornament: the "hard level" tag, or the stars won so far and the best score.
  const head = dialog.el.querySelector('.k-dialog__head');
  const record = profile.record(level.id);
  if (head && (level.hard || record)) {
    const extra = h('div', { class: 'm-intro__head' });
    if (level.hard) extra.appendChild(h('div', { class: 'm-tag m-tag--hard' }, h('i', { class: 'm-tag__gem' }), h('span', { text: t('meta.intro.hard') })));
    if (record) {
      extra.appendChild(
        h('div', { class: 'm-best', 'aria-label': t('meta.intro.best') + ': ' + i18n.num(record.best) }, kit.starRow(record.stars, { size: 24 }).el, h('span', { class: 'm-best__text' }, h('span', { text: t('meta.intro.best') }), h('b', { class: 'k-num', text: i18n.num(record.best) }))),
      );
    }
    head.appendChild(extra);
    dialog.el.classList.add('m-dialog-intro--tagged');
  }

  // lives come back with time, which the profile does not announce: follow the countdown
  if (livesPill && dialog.isOpen()) stopTicker = ui.ticker(renderLives);
  else renderLives();
  return dialog;
}
