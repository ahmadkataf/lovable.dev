/**
 * Daily reward: the 7-day strip (past days ticked, today highlighted, the rest dimmed) with the
 * reward icons, and a Claim button that grants today's reward and shows what was received.
 */
import { msUntilNextLocalDay } from '../../state/index.ts';
import type { DailyStatus, Reward } from '../../state/types.ts';
import { rewardView } from '../helpers.ts';
import type { Ui } from '../types.ts';

export function openDailyDialog(ui: Ui): Promise<void> {
  const { kit, ctx } = ui;
  const { profile, i18n, audio, platform } = ctx;
  const h = kit.el;
  const t = ui.t;

  const strip = h('div', { class: 'm-daily__strip' });
  const result = h('div', { class: 'm-daily__result' });
  const foot = h('div', { class: 'm-daily__foot' });
  const body = h('div', { class: 'm-daily' }, strip, result, kit.text(t('meta.daily.hint'), 'k-text--center k-text--muted k-text--sm'), foot);
  let justClaimed = -1;

  function rewardNode(reward: Reward, size: number): HTMLElement {
    const view = rewardView(t, i18n.num, reward);
    return h('span', { class: 'm-reward', title: view.text }, kit.icon(view.icon, size), view.amount ? h('b', { class: 'm-reward__n k-num', text: view.amount }) : null);
  }

  function status(): DailyStatus {
    try {
      return profile.daily();
    } catch {
      return { canClaim: false, cycleDay: 0, streak: 0, cycle: [] };
    }
  }

  function renderStrip(s: DailyStatus): void {
    kit.clear(strip);
    const days = s.cycle.length;
    for (let i = 0; i < days; i++) {
      const done = s.canClaim ? i < s.cycleDay : i <= s.cycleDay;
      const today = s.canClaim && i === s.cycleDay;
      const last = i === days - 1;
      const rewards = s.cycle[i] || [];
      const card = h(
        'div',
        {
          class: 'm-day' + (done ? ' m-day--done' : today ? ' m-day--today' : ' m-day--later') + (last ? ' m-day--big' : '') + (i === justClaimed ? ' m-day--pop' : ''),
          dataset: { day: i + 1 },
        },
        h('div', { class: 'm-day__label', text: today ? t('common.time.today') : t('common.time.day', { n: i + 1 }) }),
        h(
          'div',
          { class: 'm-day__rewards' },
          rewards.map((r) => rewardNode(r, last ? 38 : 32)),
        ),
        done ? h('span', { class: 'm-day__tick', 'aria-label': t('meta.daily.claimed') }, kit.icon('check', 16)) : null,
      );
      strip.appendChild(card);
    }
  }

  function renderFoot(s: DailyStatus): void {
    kit.clear(foot);
    if (s.canClaim) {
      const claim = kit.button({
        label: t('common.claim'),
        icon: 'gift',
        size: 'lg',
        block: true,
        shine: true,
        silent: true,
        onClick: () => {
          const day = status().cycleDay;
          let got: Reward[] | null = null;
          try {
            got = profile.claimDaily();
          } catch (err) {
            console.error('[daily] claim failed', err);
          }
          if (!got) {
            render();
            return;
          }
          justClaimed = day;
          try {
            audio.sfx('reward');
            platform.haptic('success');
          } catch {
            // feedback is a nicety
          }
          kit.clear(result);
          result.appendChild(h('div', { class: 'm-daily__got', text: t('meta.daily.received') }));
          result.appendChild(
            h(
              'div',
              { class: 'm-daily__gotrow' },
              got.map((r) => {
                const view = rewardView(t, i18n.num, r);
                return h('span', { class: 'm-daily__gotitem' }, kit.icon(view.icon, 30), h('span', { text: view.text }));
              }),
            ),
          );
          result.classList.add('m-daily__result--on');
          render();
        },
      });
      claim.dataset.act = 'daily-claim';
      foot.appendChild(claim);
    } else {
      const wait = kit.countdown({ remaining: () => msUntilNextLocalDay(Date.now()), label: t('meta.daily.next'), icon: 'calendar', onDone: () => render() });
      foot.appendChild(h('div', { class: 'm-daily__wait' }, wait.el));
      const ok = kit.button({ label: t('common.done'), variant: 'secondary', block: true, onClick: () => dialog.close() });
      ok.dataset.act = 'daily-done';
      foot.appendChild(ok);
    }
  }

  function render(): void {
    const s = status();
    renderStrip(s);
    renderFoot(s);
  }

  render();
  const dialog = kit.openDialog({
    title: t('meta.daily.title'),
    icon: 'gift',
    body,
    className: 'm-dialog-daily',
  });
  return dialog.closed.then(() => undefined);
}
