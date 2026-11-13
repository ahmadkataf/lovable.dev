/**
 * Daily reward: the 7-day strip (past days ticked, today highlighted, the rest dimmed) with the
 * reward icons, and a Claim button that grants today's reward and shows what was received.
 * Once claimed, the dialog counts down to the next local midnight — and turns to the new day's
 * reward by itself when midnight passes while it is open.
 */
import { msUntilNextLocalDay } from '../../state/index.ts';
import type { DailyStatus, Reward } from '../../state/types.ts';
import { rewardView } from '../helpers.ts';
import type { Ui } from '../types.ts';

/** How long Done ignores presses after it has taken Claim's place. */
const DONE_ARM_MS = 450;

export function openDailyDialog(ui: Ui): Promise<void> {
  const { kit, ctx } = ui;
  const { profile, i18n, audio, platform } = ctx;
  const h = kit.el;
  const t = ui.t;

  const strip = h('div', { class: 'm-daily__strip' });
  const result = h('div', { class: 'm-daily__result' });
  const hint = kit.text(t('meta.daily.hint'), 'k-text--center k-text--muted k-text--sm m-daily__hint');
  const waitClock = h('span', { class: 'k-num' });
  const wait = h('div', { class: 'm-daily__wait' }, h('span', { class: 'k-countdown' }, kit.icon('calendar', 20), h('span', { class: 'k-countdown__label', text: t('meta.daily.next') }), waitClock));
  const body = h('div', { class: 'm-daily' }, strip, result, hint, wait);
  let justClaimed = -1;
  /** Done answers only from this moment on (see claimNow). */
  let doneArmedAt = 0;

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
          // two rewards share a narrow card: smaller icons, so neither covers the other
          rewards.map((r) => rewardNode(r, last ? 38 : rewards.length > 1 ? 25 : 32)),
        ),
        done ? h('span', { class: 'm-day__tick', 'aria-label': t('meta.daily.claimed') }, kit.icon('check', 16)) : null,
      );
      strip.appendChild(card);
    }
  }

  function claimNow(): void {
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
    // Done now stands where Claim was: the second tap of a double tap on Claim must not close the dialog
    doneArmedAt = Date.now() + DONE_ARM_MS;
    render();
  }

  // The dialog's footer always holds the one button that applies: Claim, or Done once claimed.
  const claimButton = kit.button({ label: t('common.claim'), icon: 'gift', size: 'lg', shine: true, silent: true, onClick: claimNow });
  claimButton.dataset.act = 'daily-claim';
  const doneButton = kit.button({
    label: t('common.done'),
    variant: 'secondary',
    onClick: () => {
      const now = Date.now();
      // (a clock that was set back must not lock the button)
      if (now < doneArmedAt && doneArmedAt - now <= DONE_ARM_MS) return;
      dialog.close();
    },
  });
  doneButton.dataset.act = 'daily-done';

  let shownCanClaim: boolean | null = null;

  function render(): void {
    const s = status();
    shownCanClaim = s.canClaim;
    renderStrip(s);
    claimButton.classList.toggle('m-hidden', !s.canClaim);
    doneButton.classList.toggle('m-hidden', s.canClaim);
    wait.classList.toggle('m-hidden', s.canClaim);
    // right after claiming, "you received …" stands where the hint was
    hint.classList.toggle('m-hidden', !s.canClaim && result.classList.contains('m-daily__result--on'));
    if (!s.canClaim) waitClock.textContent = i18n.clock(msUntilNextLocalDay(Date.now()));
  }

  /**
   * Once a second: the countdown to midnight — and at midnight the dialog turns to the new day's
   * reward by itself (also when the app comes back from the background on another day).
   */
  function tick(): number {
    const s = status();
    if (s.canClaim !== shownCanClaim) {
      if (s.canClaim) {
        // a new day: yesterday's "you received" belongs to yesterday
        justClaimed = -1;
        kit.clear(result);
        result.classList.remove('m-daily__result--on');
      }
      render();
    }
    if (s.canClaim) return 0;
    const left = msUntilNextLocalDay(Date.now());
    const text = i18n.clock(left);
    if (waitClock.textContent !== text) waitClock.textContent = text;
    return left;
  }

  render();
  const dialog = kit.openDialog({
    title: t('meta.daily.title'),
    icon: 'gift',
    body,
    buttons: [doneButton, claimButton],
    buttonLayout: 'column',
    className: 'm-dialog-daily',
    onClose: () => stopTicker(),
  });
  dialog.el.dataset.dialog = 'daily';
  const stopTicker = ui.ticker(tick);
  return dialog.closed.then(() => undefined);
}
