/**
 * Buttons: the raised "gem" button in five variants and three sizes, the round icon button, the
 * price button and the watch-a-video button. All of them are real <button> elements.
 */
import type { KitCore } from './core.ts';
import { isThenable, now } from './core.ts';
import { el, replay } from './dom.ts';
import type {
  AdButtonOptions,
  ButtonOptions,
  ButtonPatch,
  ButtonSize,
  IconButtonOptions,
  IconName,
  KitButton,
  PriceButtonOptions,
} from './types.ts';

const DEFAULT_COOLDOWN_MS = 350;

/** Icon size (design units) per button size: [with a label, icon-only]. */
const ICON_SIZE: Record<ButtonSize, [number, number]> = {
  sm: [22, 24],
  md: [28, 30],
  lg: [34, 38],
};

interface BuildOptions extends ButtonOptions {
  /** 'price': caption above a big price; 'ad': gold-rimmed video button. */
  kind?: 'price' | 'ad';
  price?: string;
  loading?: boolean;
  /** Second icon after the texts (ad buttons: the reward). */
  icon2?: IconName;
}

export interface Buttons {
  button(opts: ButtonOptions): KitButton;
  iconButton(opts: IconButtonOptions): KitButton;
  priceButton(opts: PriceButtonOptions): KitButton;
  adButton(opts: AdButtonOptions): KitButton;
}

export function createButtons(core: KitCore): Buttons {
  function build(opts: BuildOptions): KitButton {
    const size: ButtonSize = opts.size || 'md';
    const variant = opts.variant || 'primary';
    const kind = opts.kind;
    const round = opts.round === true;
    const cooldown = typeof opts.cooldown === 'number' ? opts.cooldown : DEFAULT_COOLDOWN_MS;

    const state = {
      label: opts.label || '',
      caption: opts.caption || '',
      icon: opts.icon || null,
      badge: opts.badge,
      disabled: opts.disabled === true,
      loading: opts.loading === true,
      price: opts.price || '',
    };

    const content = el('span', { class: 'k-btn__content' });
    const spin = el('span', { class: 'k-spinner k-btn__spin', 'aria-hidden': 'true' });
    const face = el('span', { class: 'k-btn__face' }, content, spin);
    const btn = el(
      'button',
      {
        type: 'button',
        class:
          'k-btn k-btn--' +
          (kind === 'ad' ? 'ad' : variant) +
          ' k-btn--' +
          size +
          (round ? ' k-btn--round' : '') +
          (opts.block ? ' k-btn--block' : '') +
          (kind === 'price' ? ' k-btn--price' : '') +
          (opts.shine ? ' k-btn--shine' : '') +
          (opts.className ? ' ' + opts.className : ''),
      },
      face,
    ) as KitButton;
    let badgeEl: HTMLElement | null = null;

    function renderContent(): void {
      while (content.firstChild) content.removeChild(content.firstChild);
      const hasText = !round && (state.label !== '' || state.caption !== '' || state.price !== '');
      if (state.icon) {
        const c = core.icon(state.icon, ICON_SIZE[size][hasText ? 0 : 1]);
        c.classList.add('k-btn__icon');
        content.appendChild(c);
      }
      if (!hasText) return;
      const texts = el('span', { class: 'k-btn__texts' });
      if (kind === 'price') {
        // caption first, then the price; the price keeps its own direction (see .k-price)
        if (state.label) texts.appendChild(el('span', { class: 'k-btn__cap', text: state.label }));
        texts.appendChild(el('span', { class: 'k-btn__label k-price', text: state.price }));
      } else {
        if (state.label) texts.appendChild(el('span', { class: 'k-btn__label', text: state.label }));
        if (state.caption) texts.appendChild(el('span', { class: 'k-btn__cap', text: state.caption }));
      }
      content.appendChild(texts);
      if (opts.icon2) {
        const c = core.icon(opts.icon2, ICON_SIZE[size][0]);
        c.classList.add('k-btn__icon2');
        content.appendChild(c);
      }
    }

    function renderBadge(): void {
      const value = state.badge;
      const text = value === null || value === undefined ? '' : String(value);
      if (text === '') {
        if (badgeEl && badgeEl.parentNode) badgeEl.parentNode.removeChild(badgeEl);
        badgeEl = null;
        return;
      }
      if (!badgeEl) {
        // a badge that turns up on a button already on screen pops in
        badgeEl = el('span', { class: 'k-badge' + (btn.isConnected ? ' k-bump' : ''), text });
        btn.appendChild(badgeEl);
      } else if (badgeEl.textContent !== text) {
        badgeEl.textContent = text;
        replay(badgeEl, 'k-bump');
      }
    }

    function renderState(): void {
      btn.disabled = state.disabled || state.loading;
      btn.classList.toggle('k-loading', state.loading);
      if (state.loading) btn.setAttribute('aria-busy', 'true');
      else btn.removeAttribute('aria-busy');
      if (state.disabled || state.loading) btn.classList.remove('k-pressed');
    }

    function renderAria(label: string | undefined): void {
      if (label) btn.setAttribute('aria-label', label);
    }

    renderContent();
    renderBadge();
    renderState();
    renderAria(opts.ariaLabel);
    core.pressable(btn);

    // ── activation, guarded against double taps and against a handler that is still running ──
    let lockedUntil = 0;
    let busy = false;
    btn.addEventListener('click', (ev: MouseEvent) => {
      if (btn.disabled || state.loading || busy) return;
      const t = now();
      if (t < lockedUntil) return;
      lockedUntil = t + cooldown;
      if (!opts.silent) core.tap();
      if (!opts.onClick) return;
      let result: unknown;
      try {
        result = opts.onClick(ev);
      } catch (err) {
        if (typeof console !== 'undefined') console.error('[kit] button handler failed', err);
        return;
      }
      if (isThenable(result)) {
        busy = true;
        const done = (): void => {
          busy = false;
        };
        result.then(done, (err: unknown) => {
          busy = false;
          if (typeof console !== 'undefined') console.error('[kit] button handler failed', err);
        });
      }
    });

    btn.update = (patch: ButtonPatch): void => {
      let content_ = false;
      if (patch.label !== undefined && patch.label !== state.label) {
        state.label = patch.label;
        content_ = true;
      }
      if (patch.caption !== undefined && (patch.caption || '') !== state.caption) {
        state.caption = patch.caption || '';
        content_ = true;
      }
      if (patch.icon !== undefined && patch.icon !== state.icon) {
        state.icon = patch.icon;
        content_ = true;
      }
      if (patch.price !== undefined && patch.price !== state.price) {
        state.price = patch.price;
        content_ = true;
      }
      if (content_) renderContent();
      if (patch.badge !== undefined) {
        state.badge = patch.badge;
        renderBadge();
      }
      if (patch.disabled !== undefined) state.disabled = patch.disabled === true;
      if (patch.loading !== undefined) state.loading = patch.loading === true;
      if (patch.disabled !== undefined || patch.loading !== undefined) renderState();
      if (patch.ariaLabel !== undefined) renderAria(patch.ariaLabel);
    };

    return btn;
  }

  return {
    button: (opts) => build(opts),

    iconButton: (opts) =>
      build({
        icon: opts.icon,
        ariaLabel: opts.ariaLabel,
        variant: opts.variant || 'secondary',
        size: opts.size,
        onClick: opts.onClick,
        disabled: opts.disabled,
        badge: opts.badge,
        className: opts.className,
        silent: opts.silent,
        round: true,
      }),

    priceButton: (opts) =>
      build({
        kind: 'price',
        price: opts.price,
        label: opts.label,
        icon: opts.icon,
        variant: opts.variant || 'success',
        size: opts.size,
        onClick: opts.onClick,
        disabled: opts.disabled,
        loading: opts.loading,
        ariaLabel: opts.ariaLabel,
        block: opts.block,
        className: opts.className,
      }),

    adButton: (opts) =>
      build({
        kind: 'ad',
        icon: 'adVideo',
        icon2: opts.rewardIcon,
        label: opts.label,
        caption: opts.caption,
        size: opts.size,
        onClick: opts.onClick,
        disabled: opts.disabled,
        loading: opts.loading,
        badge: opts.badge,
        ariaLabel: opts.ariaLabel,
        block: opts.block,
        className: opts.className,
      }),
  };
}
