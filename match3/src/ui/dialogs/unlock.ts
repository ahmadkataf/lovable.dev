/**
 * "New booster" introduction: shown when the player reaches a booster's unlock level. The gift has
 * already been granted by the profile; this dialog says what it is and what it does.
 */
import type { BoosterId } from '../../state/types.ts';
import { boosterIcon } from '../helpers.ts';
import type { Ui } from '../types.ts';

export function openUnlockDialog(ui: Ui, gifts: readonly { id: BoosterId; amount: number }[]): Promise<void> {
  const { kit, ctx } = ui;
  const h = kit.el;
  const t = ui.t;

  function show(index: number): Promise<void> {
    const gift = gifts[index];
    if (!gift) return Promise.resolve();
    const body = h(
      'div',
      { class: 'm-unlock' },
      h('div', { class: 'm-unlock__art' }, h('i', { class: 'm-unlock__rays', 'aria-hidden': 'true' }), kit.icon(boosterIcon(gift.id), 84), h('b', { class: 'm-unlock__qty k-num', text: '×' + ctx.i18n.num(gift.amount) })),
      h('div', { class: 'm-unlock__name', text: t('booster.' + gift.id + '.name') }),
      kit.text(t('booster.' + gift.id + '.desc'), 'k-text--center'),
      h('div', { class: 'm-unlock__gift' }, kit.icon('gift', 22), h('span', { text: t('meta.unlock.gift') })),
    );
    try {
      ctx.audio.sfx('reward');
    } catch {
      // sound is a nicety
    }
    const dialog = kit.openDialog({
      title: t('meta.unlock.title'),
      body,
      className: 'm-dialog-unlock',
      silent: true,
      buttons: [{ label: t('meta.unlock.ok'), variant: 'primary' }],
    });
    dialog.el.dataset.dialog = 'unlock';
    return dialog.closed.then(() => show(index + 1));
  }

  return show(0);
}
