/**
 * Settings overlay: sound / music / vibration toggles, the language switch (applied at once,
 * everywhere), privacy options and restore purchases when they apply, privacy policy, credits &
 * licences, rate the game (Android), reset progress (double confirmation) and the app version.
 */
import type { Lang } from '../../i18n/types.ts';
import type { ListItem } from '../kit/index.ts';
import type { Ui } from '../types.ts';
import { openCreditsDialog, openPrivacyDialog } from './legal.ts';

export function openSettingsDialog(ui: Ui): Promise<void> {
  const { kit, ctx } = ui;
  const { profile, i18n, store, platform, audio } = ctx;
  const h = kit.el;
  const t = ui.t;

  const body = h('div', { class: 'm-settings' });
  let restoring = false;

  function resetProgress(): void {
    kit
      .confirm({
        title: t('meta.settings.reset1.title'),
        message: t('meta.settings.reset1.body'),
        yes: t('meta.settings.reset1.yes'),
        no: t('common.cancel'),
        danger: true,
        icon: 'trash',
      })
      .then((first) => {
        if (!first) return false;
        return kit.confirm({
          title: t('meta.settings.reset2.title'),
          message: t('meta.settings.reset2.body'),
          yes: t('meta.settings.reset2.yes'),
          no: t('common.cancel'),
          danger: true,
          icon: 'trash',
        });
      })
      .then((second) => {
        if (!second) return;
        profile.reset();
        kit.closeAll();
        ui.goTitle();
        kit.toast(t('meta.settings.resetDone'), { icon: 'check' });
      });
  }

  function render(): void {
    const settings = profile.settings();
    kit.clear(body);

    // ── toggles ──
    const toggles = h('div', { class: 'm-settings__group' });
    const sfxToggle = kit.toggle({
      checked: settings.sfx,
      label: t('meta.settings.sfx'),
      icon: settings.sfx ? 'sound' : 'soundOff',
      onChange: (on) => {
        profile.setSetting('sfx', on);
        sfxToggle.setIcon(on ? 'sound' : 'soundOff');
        if (on) {
          try {
            audio.sfx('button');
          } catch {
            // sound is a nicety
          }
        }
      },
    });
    sfxToggle.el.dataset.act = 'toggle-sfx';
    const musicToggle = kit.toggle({
      checked: settings.music,
      label: t('meta.settings.music'),
      icon: settings.music ? 'music' : 'musicOff',
      onChange: (on) => {
        profile.setSetting('music', on);
        musicToggle.setIcon(on ? 'music' : 'musicOff');
      },
    });
    musicToggle.el.dataset.act = 'toggle-music';
    const hapticsToggle = kit.toggle({
      checked: settings.haptics,
      label: t('meta.settings.haptics'),
      icon: settings.haptics ? 'haptics' : 'hapticsOff',
      onChange: (on) => {
        profile.setSetting('haptics', on);
        hapticsToggle.setIcon(on ? 'haptics' : 'hapticsOff');
        if (on) {
          try {
            platform.haptic('medium');
          } catch {
            // haptics are a nicety
          }
        }
      },
    });
    hapticsToggle.el.dataset.act = 'toggle-haptics';
    toggles.appendChild(sfxToggle.el);
    toggles.appendChild(musicToggle.el);
    toggles.appendChild(hapticsToggle.el);
    body.appendChild(toggles);

    // ── language ──
    const lang = kit.segmented<Lang>(
      [
        { value: 'en', label: 'English' },
        { value: 'ar', label: 'العربية' },
      ],
      {
        value: i18n.lang(),
        ariaLabel: t('meta.settings.language'),
        onChange: (value) => {
          profile.setSetting('lang', value);
          i18n.setLang(value);
        },
      },
    );
    lang.el.dataset.act = 'language';
    body.appendChild(h('div', { class: 'm-settings__lang' }, h('div', { class: 'm-settings__label' }, kit.icon('language', 24), h('span', { text: t('meta.settings.language') })), lang.el));

    // ── rows ──
    const rows = h('div', { class: 'm-settings__group m-settings__rows' });
    const add = (act: string, item: ListItem): void => {
      item.el.dataset.act = act;
      rows.appendChild(item.el);
    };
    let consent = false;
    let iap = false;
    try {
      consent = store.privacyOptionsRequired();
      iap = store.iapAvailable();
    } catch {
      // the store is unavailable: neither row applies
    }
    if (consent) {
      add('privacy-options', kit.listItem({ icon: 'adVideo', label: t('meta.settings.privacyOptions'), onClick: () => store.showPrivacyOptions() }));
    }
    if (iap) {
      const item = kit.listItem({
        icon: 'restore',
        label: t('meta.settings.restore'),
        disabled: restoring,
        onClick: () => {
          if (restoring) return undefined;
          restoring = true;
          item.set({ disabled: true });
          const done = (n: number, failed: boolean): void => {
            restoring = false;
            kit.toast(failed ? t('meta.shop.unavailable') : t('meta.settings.restored', { n }), { icon: failed ? 'info' : 'restore' });
            if (dialog.isOpen()) render(); // the row may have been rebuilt meanwhile: draw it enabled again
          };
          return store.restore().then(
            (n) => done(typeof n === 'number' && n > 0 ? Math.floor(n) : 0, false),
            () => done(0, true),
          );
        },
      });
      add('restore', item);
    }
    add('privacy', kit.listItem({ icon: 'shield', label: t('meta.settings.privacy'), onClick: () => void openPrivacyDialog(ui) }));
    add('credits', kit.listItem({ icon: 'info', label: t('meta.settings.credits'), onClick: () => void openCreditsDialog(ui) }));
    if (platform.info().platform === 'android') {
      add('rate', kit.listItem({ icon: 'star', label: t('meta.settings.rate'), onClick: () => platform.rateApp() }));
    }
    add('reset', kit.listItem({ icon: 'trash', label: t('meta.settings.reset'), danger: true, onClick: resetProgress }));
    body.appendChild(rows);

    const info = platform.info();
    // (a sentence, not a number: it follows the language's own direction — "الإصدار 1.0.0")
    body.appendChild(h('div', { class: 'm-settings__version', text: t('meta.settings.version', { v: info.versionName }) }));
  }

  render();
  const dialog = kit.openDialog({
    title: t('common.settings'),
    body,
    className: 'm-dialog-settings',
    onClose: () => {
      offLang();
      offStore();
    },
  });
  // the language switch re-renders this dialog in place; the screen behind is rebuilt by the shell
  const offLang = i18n.onChange(() => {
    dialog.setTitle(t('common.settings'));
    const closeButton = dialog.el.querySelector('.k-dialog__x');
    if (closeButton) closeButton.setAttribute('aria-label', t('common.close'));
    render();
  });
  dialog.el.dataset.dialog = 'settings';
  const offStore = store.onChange(() => {
    if (dialog.isOpen()) render();
  });
  return dialog.closed.then(() => undefined);
}
