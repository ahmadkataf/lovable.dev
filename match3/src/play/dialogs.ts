/**
 * Dialogs of the play screen, built with the UI kit: tutorial tip, pause, confirm, buy-a-booster,
 * win and lose. They contain no game logic — the screen (./index.ts) passes numbers in and gets
 * the player's choice back through callbacks.
 */
import type { ArtApi } from '../art/types.ts';
import type { SfxName, SfxOptions } from '../audio/types.ts';
import type { GoalProgress, InLevelBooster } from '../engine/types.ts';
import type { I18nApi } from '../i18n/types.ts';
import type { Settings } from '../state/types.ts';
import type { DialogHandle, IconName, Kit, KitButton } from '../ui/kit/index.ts';
import type { Timers } from './anim.ts';
import { goalIconOf } from './hud.ts';
import { T } from './timing.ts';
import type { TipId } from './tutorial.ts';
import { drawTip } from './tutorial.ts';

export interface DialogDeps {
  kit: Kit;
  i18n: I18nApi;
  art: ArtApi;
  timers: Timers;
  sfx(name: SfxName, opts?: SfxOptions): void;
  /** every dialog the screen opens is registered, so stop() can close them all */
  track<T>(dialog: DialogHandle<T>): DialogHandle<T>;
}

/** Buttons ignore input for a moment after a result dialog opens (no accidental purchase). */
function lockButtons(deps: DialogDeps, dialog: DialogHandle<unknown>): void {
  dialog.el.classList.add('pl-locked');
  deps.timers.after(T.dialogLock, () => dialog.el.classList.remove('pl-locked'));
}

/** Names a dialog and its footer buttons for tests (`data-pl="pause"`, `data-action="quit"`). */
function tag<T>(dialog: DialogHandle<T>, name: string, actions?: readonly string[]): DialogHandle<T> {
  dialog.el.dataset.pl = name;
  if (actions) {
    for (let i = 0; i < actions.length && i < dialog.buttons.length; i++) (dialog.buttons[i] as KitButton).dataset.action = actions[i] as string;
  }
  return dialog;
}

function missingChip(kit: Kit, i18n: I18nApi, goal: GoalProgress): HTMLElement {
  const left = Math.max(0, goal.target - goal.current);
  const icon = kit.icon(goalIconOf(goal), 26);
  icon.classList.add('pl-goal__icon');
  return kit.el('div', { class: 'pl-goal' }, icon, kit.el('span', { class: 'pl-goal__n k-num' }, goal.goal.kind === 'score' ? i18n.num(left) : String(left)));
}

// ───────────────────────────── tutorial tip ─────────────────────────────

export function openTip(deps: DialogDeps, id: TipId): DialogHandle<void> {
  const { kit, i18n } = deps;
  const width = Math.round(Math.min(280, Math.max(200, (window.innerWidth || 360) - 96)));
  const body = kit.el('div', { class: 'pl-dlg' }, drawTip(deps.art, id, width), kit.el('p', { class: 'pl-dlg__text' }, i18n.t('play.tut.' + id + '.text')));
  return tag(
    deps.track(
      kit.openDialog<void>({
        title: i18n.t('play.tut.' + id + '.title'),
        body,
        buttons: [{ label: i18n.t('play.tut.ok'), variant: 'primary' }],
        closeButton: false,
      }),
    ),
    'tip',
    ['ok'],
  );
}

// ───────────────────────────── confirm ─────────────────────────────

export function openConfirm(deps: DialogDeps, opts: { title: string; lines: string[]; warn?: string[]; yes: string; no: string; icon?: IconName }): Promise<boolean> {
  const { kit } = deps;
  const body = kit.el('div', { class: 'pl-dlg' });
  for (let i = 0; i < opts.lines.length; i++) body.appendChild(kit.el('p', { class: 'pl-dlg__text' }, opts.lines[i] as string));
  if (opts.warn && opts.warn.length > 0) body.appendChild(kit.el('p', { class: 'pl-dlg__warn' }, opts.warn.join(' ')));
  const dialog = tag(
    deps.track(
      kit.openDialog<boolean>({
        title: opts.title,
        icon: opts.icon,
        body,
        buttons: [
          { label: opts.yes, variant: 'danger', result: true },
          { label: opts.no, variant: 'primary', result: false },
        ],
      }),
    ),
    'confirm',
    ['yes', 'no'],
  );
  return dialog.closed.then((result) => result === true);
}

// ───────────────────────────── pause ─────────────────────────────

export type PauseChoice = 'resume' | 'restart' | 'quit';

export function openPause(
  deps: DialogDeps,
  opts: { settings: Readonly<Settings>; onSetting: (key: 'sfx' | 'music' | 'haptics', value: boolean) => void },
): DialogHandle<PauseChoice> {
  const { kit, i18n } = deps;
  const sound = kit.toggle({
    checked: opts.settings.sfx,
    label: i18n.t('play.pause.sound'),
    icon: opts.settings.sfx ? 'sound' : 'soundOff',
    onChange: (on) => {
      opts.onSetting('sfx', on);
      sound.setIcon(on ? 'sound' : 'soundOff');
    },
  });
  const music = kit.toggle({
    checked: opts.settings.music,
    label: i18n.t('play.pause.music'),
    icon: opts.settings.music ? 'music' : 'musicOff',
    onChange: (on) => {
      opts.onSetting('music', on);
      music.setIcon(on ? 'music' : 'musicOff');
    },
  });
  const haptics = kit.toggle({
    checked: opts.settings.haptics,
    label: i18n.t('play.pause.haptics'),
    icon: opts.settings.haptics ? 'haptics' : 'hapticsOff',
    onChange: (on) => {
      opts.onSetting('haptics', on);
      haptics.setIcon(on ? 'haptics' : 'hapticsOff');
    },
  });
  sound.el.dataset.setting = 'sfx';
  music.el.dataset.setting = 'music';
  haptics.el.dataset.setting = 'haptics';
  const body = kit.el('div', { class: 'pl-dlg' }, kit.el('div', { class: 'pl-pause__toggles' }, sound.el, music.el, haptics.el));
  return tag(
    deps.track(
      kit.openDialog<PauseChoice>({
        title: i18n.t('play.pause.title'),
        icon: 'pause',
        body,
        buttonLayout: 'column',
        buttons: [
          { label: i18n.t('common.resume'), icon: 'play', variant: 'primary', result: 'resume' },
          { label: i18n.t('play.pause.restart'), icon: 'retry', variant: 'secondary', result: 'restart' },
          { label: i18n.t('play.pause.quit'), icon: 'map', variant: 'secondary', result: 'quit' },
        ],
      }),
    ),
    'pause',
    ['resume', 'restart', 'quit'],
  );
}

// ───────────────────────────── buy a booster ─────────────────────────────

export type BuyChoice = 'bought' | 'shop';

export function openBuyBooster(
  deps: DialogDeps,
  opts: { id: InLevelBooster; price: number; coins: number; showShop: boolean; onBuy: () => boolean },
): DialogHandle<BuyChoice> {
  const { kit, i18n } = deps;
  const name = i18n.t('booster.' + opts.id + '.name');
  const poor = opts.coins < opts.price;
  const body = kit.el(
    'div',
    { class: 'pl-dlg' },
    kit.el('p', { class: 'pl-dlg__note' }, i18n.t('booster.' + opts.id + '.desc')),
    kit.el('p', { class: 'pl-dlg__text' }, i18n.t(poor ? 'play.buy.poor' : 'play.buy.text')),
  );
  let dialog: DialogHandle<BuyChoice> | null = null;
  const buy = kit.priceButton({
    label: i18n.t('common.buy'),
    price: i18n.num(opts.price),
    icon: 'coin',
    variant: 'success',
    block: true,
    disabled: poor,
    onClick: () => {
      if (opts.onBuy() && dialog) dialog.close('bought');
    },
  });
  buy.dataset.action = 'buy';
  const buttons: KitButton[] = [];
  if (opts.showShop) {
    const shop = kit.button({ label: i18n.t('play.buy.shop'), icon: 'shop', variant: 'secondary', block: true, onClick: () => dialog && dialog.close('shop') });
    shop.dataset.action = 'shop';
    buttons.push(shop);
  }
  buttons.push(buy);
  dialog = tag(deps.track(kit.openDialog<BuyChoice>({ title: i18n.t('play.buy.title', { name }), icon: opts.id, body, buttons, buttonLayout: 'column' })), 'buy');
  dialog.el.dataset.booster = opts.id;
  return dialog;
}

// ───────────────────────────── win ─────────────────────────────

export interface WinOptions {
  stars: 1 | 2 | 3;
  score: number;
  newBest: boolean;
  coins: number;
  /** show the "double coins" video button */
  canDouble: boolean;
  /** resolves true when the reward was earned and the coins were added */
  onDouble: () => Promise<boolean>;
  onNext: () => void;
  onMap: () => void;
}

export function openWin(deps: DialogDeps, opts: WinOptions): DialogHandle<void> {
  const { kit, i18n, timers } = deps;
  const row = kit.starRow(0, { size: 54, animate: false, sound: false });
  const scoreN = kit.el('span', { class: 'pl-win__scoren k-num' }, '0');
  const coinsN = kit.el('span', { class: 'pl-win__coinsn' }, '‎+' + i18n.num(opts.coins));
  const coinsRow = kit.el('div', { class: 'pl-win__coins', 'aria-label': i18n.t('play.win.coins', { n: opts.coins }) }, kit.icon('coin', 26), coinsN);
  const body = kit.el(
    'div',
    { class: 'pl-dlg pl-win' },
    kit.el('div', { class: 'pl-win__stars' }, row.el),
    kit.el('div', { class: 'pl-win__score' }, kit.el('span', { class: 'pl-win__scorecap' }, i18n.t('common.score')), scoreN, opts.newBest ? kit.el('span', { class: 'pl-win__best' }, i18n.t('play.win.newBest')) : null),
    opts.coins > 0 ? coinsRow : null,
  );

  let dialog: DialogHandle<void> | null = null;
  let left = false;
  /** a rewarded video is being asked for / shown: nothing else may happen until it has answered */
  let watching = false;
  const leave = (fn: () => void): void => {
    if (left || watching) return;
    left = true;
    if (dialog) dialog.close();
    fn();
  };

  const buttons: KitButton[] = [];
  if (opts.canDouble && opts.coins > 0) {
    const ad = kit.adButton({
      label: i18n.t('play.win.double'),
      caption: i18n.t('play.win.watch'),
      rewardIcon: 'coin',
      block: true,
      onClick: () => {
        if (left || watching) return undefined;
        watching = true;
        const done = (earned: boolean): void => {
          watching = false;
          if (!earned) return;
          ad.update({ disabled: true, label: i18n.t('play.win.doubled'), caption: null });
          coinsN.textContent = '‎+' + i18n.num(opts.coins * 2);
          coinsRow.classList.remove('pl-bump');
          void coinsRow.offsetWidth;
          coinsRow.classList.add('pl-bump');
        };
        return opts.onDouble().then(done, () => done(false));
      },
    });
    ad.dataset.action = 'double';
    buttons.push(ad);
  }
  const map = kit.button({ label: i18n.t('play.win.map'), icon: 'map', variant: 'secondary', block: true, onClick: () => leave(opts.onMap) });
  map.dataset.action = 'map';
  const next = kit.button({ label: i18n.t('common.next'), icon: 'next', variant: 'primary', size: 'lg', block: true, onClick: () => leave(opts.onNext) });
  next.dataset.action = 'next';
  buttons.push(next, map);

  dialog = deps.track(
    kit.openDialog<void>({
      title: i18n.t('play.win.title'),
      icon: 'trophy',
      body,
      buttons,
      buttonLayout: 'column',
      dismissible: false,
      silent: true,
      onBack: () => leave(opts.onMap),
    }),
  );
  tag(dialog, 'win');
  lockButtons(deps, dialog);

  // stars slam in one by one, then the score counts up
  for (let i = 1; i <= opts.stars; i++) {
    timers.after(200 + (i - 1) * T.star, () => {
      row.set(i, false);
      deps.sfx('star', { step: i });
    });
  }
  timers.after(160, () => {
    void kit.tweenNumber(scoreN, 0, opts.score, T.scoreCount);
  });
  if (opts.coins > 0) timers.after(200 + opts.stars * T.star, () => deps.sfx('coin'));
  return dialog;
}

// ───────────────────────────── lose ─────────────────────────────

export interface LoseOptions {
  goals: readonly GoalProgress[];
  /** false = the board can never have a move again: no continue offers */
  canContinue: boolean;
  /** coin price of the next continue; null = no more continues in this attempt */
  price: number | null;
  coinMoves: number;
  /** the "+n moves for a video" offer is available */
  adOffer: boolean;
  adMoves: number;
  coins: () => number;
  /** current win streak (0 = none): giving up resets it */
  caravan: number;
  showShop: boolean;
  /** returns true when the continue was bought (the dialog closes) */
  onCoins: () => boolean;
  /** resolves true when the video was watched and the moves were granted */
  onAd: () => Promise<boolean>;
  onShop: () => Promise<void>;
  onRetry: () => void;
  onGiveUp: () => void;
}

export function openLose(deps: DialogDeps, opts: LoseOptions): DialogHandle<void> {
  const { kit, i18n } = deps;
  const body = kit.el('div', { class: 'pl-dlg' });
  if (opts.canContinue) {
    body.appendChild(kit.el('p', { class: 'pl-dlg__text' }, i18n.t('play.lose.missing')));
    const chips = kit.el('div', { class: 'pl-dlg__goals' });
    for (let i = 0; i < opts.goals.length; i++) {
      const g = opts.goals[i] as GoalProgress;
      if (!g.done) chips.appendChild(missingChip(kit, i18n, g));
    }
    body.appendChild(chips);
  } else {
    body.appendChild(kit.el('p', { class: 'pl-dlg__text' }, i18n.t('play.lose.stuck')));
  }
  const warn = [i18n.t('play.lose.lifeNote')];
  if (opts.caravan > 0) warn.push(i18n.t('play.lose.caravan', { n: opts.caravan }));
  body.appendChild(kit.el('p', { class: 'pl-dlg__warn' }, warn.join(' ')));

  let dialog: DialogHandle<void> | null = null;
  let done = false;
  /** a rewarded video is being asked for / shown: every other choice waits for its answer */
  let watching = false;
  const finish = (fn: () => void): void => {
    if (done || watching) return;
    done = true;
    if (dialog) dialog.close();
    fn();
  };

  const stack = kit.el('div', { class: 'pl-dlg__stack' });
  let coinBtn: KitButton | null = null;
  let poorNote: HTMLElement | null = null;
  let shopBtn: KitButton | null = null;
  const refresh = (): void => {
    if (!coinBtn || opts.price === null) return;
    const poor = opts.coins() < opts.price;
    coinBtn.update({ disabled: poor });
    if (poorNote) poorNote.style.display = poor ? '' : 'none';
    if (shopBtn) shopBtn.style.display = poor ? '' : 'none';
  };

  if (opts.canContinue && opts.price !== null) {
    coinBtn = kit.priceButton({
      label: i18n.t('play.lose.moves', { n: opts.coinMoves }),
      price: i18n.num(opts.price),
      icon: 'coin',
      variant: 'success',
      size: 'lg',
      block: true,
      onClick: () => {
        if (done || watching) return;
        if (opts.onCoins()) {
          done = true;
          if (dialog) dialog.close();
        } else refresh();
      },
    });
    coinBtn.dataset.action = 'continue';
    stack.appendChild(coinBtn);
    poorNote = kit.el('p', { class: 'pl-dlg__note' }, i18n.t('play.lose.poor'));
    stack.appendChild(poorNote);
    if (opts.showShop) {
      shopBtn = kit.button({
        label: i18n.t('play.lose.shop'),
        icon: 'shop',
        variant: 'secondary',
        size: 'sm',
        block: true,
        onClick: () => (done || watching ? undefined : opts.onShop().then(refresh, refresh)),
      });
      shopBtn.dataset.action = 'shop';
      stack.appendChild(shopBtn);
    }
  }
  if (opts.canContinue && opts.adOffer) {
    const ad = kit.adButton({
      label: i18n.t('play.lose.moves', { n: opts.adMoves }),
      caption: i18n.t('play.win.watch'),
      block: true,
      onClick: () => {
        if (done || watching) return undefined;
        watching = true;
        const answer = (earned: boolean): void => {
          watching = false;
          if (earned && !done) {
            done = true;
            if (dialog) dialog.close();
          }
        };
        return opts.onAd().then(answer, () => answer(false));
      },
    });
    ad.dataset.action = 'adContinue';
    stack.appendChild(ad);
  }
  const retry = kit.button({ label: i18n.t('common.retry'), icon: 'retry', variant: 'secondary', block: true, onClick: () => finish(opts.onRetry) });
  retry.dataset.action = 'retry';
  const giveUp = kit.button({ label: i18n.t('play.lose.giveUp'), variant: 'secondary', block: true, onClick: () => finish(opts.onGiveUp) });
  giveUp.dataset.action = 'giveUp';
  stack.appendChild(retry);
  stack.appendChild(giveUp);
  body.appendChild(stack);
  refresh();

  dialog = deps.track(
    kit.openDialog<void>({
      title: i18n.t(opts.canContinue ? 'play.lose.title' : 'play.lose.stuckTitle'),
      icon: 'moves',
      body,
      dismissible: false,
      silent: true,
    }),
  );
  tag(dialog, 'lose');
  lockButtons(deps, dialog);
  return dialog;
}
