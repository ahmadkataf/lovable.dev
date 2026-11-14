/**
 * In-app legal texts: the privacy policy (short and plain, both languages) and "Credits &
 * licences" with the SIL Open Font License notice of the bundled typeface.
 */
import { BRAND } from '../../app/brand.ts';
// The licence file that ships with the font package: copyright line + the standard OFL 1.1 text.
import OFL_TEXT from '../../../node_modules/@fontsource-variable/baloo-bhaijaan-2/LICENSE?raw';
import type { Ui } from '../types.ts';

const PRIVACY_SECTIONS = ['none', 'save', 'pay', 'ads', 'kids', 'contact'] as const;

export function openPrivacyDialog(ui: Ui): Promise<void> {
  const { kit, ctx } = ui;
  const h = kit.el;
  const t = ui.t;
  const game = BRAND.name[ctx.i18n.lang()];

  const body = h('div', { class: 'm-legal k-selectable' });
  body.appendChild(kit.text(t('meta.privacy.intro', { game }), 'k-text--muted m-legal__intro'));
  for (const key of PRIVACY_SECTIONS) {
    body.appendChild(h('h3', { class: 'm-legal__h', text: t('meta.privacy.' + key + '.title') }));
    body.appendChild(kit.text(t('meta.privacy.' + key + '.body', { game }), 'm-legal__p'));
  }
  const dialog = kit.openDialog({
    title: t('meta.settings.privacy'),
    body,
    wide: true,
    className: 'm-dialog-legal',
    buttons: [{ label: t('common.close'), variant: 'secondary' }],
  });
  dialog.el.dataset.dialog = 'privacy';
  return dialog.closed.then(() => undefined);
}

export function openCreditsDialog(ui: Ui): Promise<void> {
  const { kit, ctx } = ui;
  const h = kit.el;
  const t = ui.t;
  const lang = ctx.i18n.lang();

  const emblem = ctx.art.emblem(Math.round(72 * kit.unit() * Math.min(3, window.devicePixelRatio || 1)));
  emblem.classList.add('m-legal__emblem');
  const body = h('div', { class: 'm-legal k-selectable' });
  body.appendChild(
    h(
      'div',
      { class: 'm-legal__brand' },
      emblem,
      h('div', { class: 'm-legal__name', text: BRAND.name[lang] }),
      h('div', { class: 'm-legal__tag', text: BRAND.tagline[lang] }),
    ),
  );
  body.appendChild(kit.text(t('meta.credits.game'), 'k-text--center m-legal__p'));
  body.appendChild(kit.text(t('meta.credits.made'), 'k-text--center k-text--muted m-legal__p'));
  body.appendChild(h('h3', { class: 'm-legal__h', text: t('meta.credits.font.title') }));
  body.appendChild(kit.text(t('meta.credits.font.body'), 'm-legal__p'));
  body.appendChild(kit.text(t('meta.credits.licenceNote'), 'k-text--muted k-text--sm m-legal__p'));
  body.appendChild(h('pre', { class: 'm-legal__licence', dir: 'ltr', lang: 'en', text: String(OFL_TEXT).trim() }));
  const dialog = kit.openDialog({
    title: t('meta.settings.credits'),
    body,
    wide: true,
    className: 'm-dialog-legal',
    buttons: [{ label: t('common.close'), variant: 'secondary' }],
  });
  dialog.el.dataset.dialog = 'credits';
  return dialog.closed.then(() => undefined);
}
