/**
 * Shop pieces: offer cards (artwork, texts, price button, optional corner ribbon and quantity
 * badge, owned state), plus the ribbon, quantity badge and owned tick on their own.
 */
import type { Buttons } from './buttons.ts';
import type { KitCore } from './core.ts';
import { detach, el, replay } from './dom.ts';
import type { OfferCard, OfferCardOptions, OfferCardPatch, Qty, QtyOptions, RibbonTone } from './types.ts';

export interface Shop {
  offerCard(opts: OfferCardOptions): OfferCard;
  ribbon(text: string, tone?: RibbonTone): HTMLElement;
  qty(text: string | number, opts?: QtyOptions): Qty;
  ownedTick(text?: string): HTMLElement;
}

export function createShop(core: KitCore, buttons: Buttons): Shop {
  function ribbon(text: string, tone?: RibbonTone): HTMLElement {
    return el('div', { class: 'k-ribbon k-ribbon--' + (tone || 'popular') }, el('span', { text }));
  }

  function qty(text: string | number, opts?: QtyOptions): Qty {
    const node = el('span', {
      class: 'k-qty' + (opts && opts.corner ? ' k-qty--corner' : '') + (opts && opts.tone === 'gold' ? ' k-qty--gold' : ''),
      text: String(text),
    });
    return {
      el: node,
      set(next: string | number, bump?: boolean): void {
        const value = String(next);
        if (node.textContent === value) return;
        node.textContent = value;
        if (bump !== false) replay(node, 'k-bump');
      },
    };
  }

  function ownedTick(text?: string): HTMLElement {
    return el(
      'span',
      { class: 'k-owned' + (text ? '' : ' k-owned--bare') },
      el('span', { class: 'k-owned__tick', 'aria-hidden': 'true' }, core.icon('check', 16)),
      text ? el('span', { text }) : null,
    );
  }

  function offerCard(opts: OfferCardOptions): OfferCard {
    const row = opts.layout === 'row';
    const state = {
      owned: opts.owned === true,
      ownedText: opts.ownedText !== undefined ? opts.ownedText : core.i18n.t('common.owned'),
      disabled: opts.disabled === true,
      loading: opts.loading === true,
    };

    const art = el('div', { class: 'k-offer__art' });
    art.appendChild(typeof opts.art === 'string' ? core.icon(opts.art, row ? 56 : 68) : opts.art);
    const titleEl = el('div', { class: 'k-offer__title', text: opts.title });
    const subEl = el('div', { class: 'k-offer__sub' });
    const texts = el('div', { class: 'k-offer__texts' }, titleEl);
    const action = el('div', { class: 'k-offer__action' });
    const node = el(
      'div',
      { class: 'k-offer k-offer--' + (row ? 'row' : 'tile') + (opts.featured ? ' k-offer--featured' : '') + (opts.className ? ' ' + opts.className : '') },
      art,
      texts,
      action,
    );

    const button = buttons.priceButton({
      price: opts.price,
      label: opts.priceLabel,
      icon: opts.priceIcon,
      variant: opts.variant,
      size: 'sm',
      onClick: () => opts.onBuy(card),
    });

    let ribbonEl: HTMLElement | null = null;
    let qtyHandle: Qty | null = null;
    let ownedEl: HTMLElement | null = null;

    function setSubtitle(text: string | null | undefined): void {
      if (text) {
        subEl.textContent = text;
        if (subEl.parentNode !== texts) texts.appendChild(subEl);
      } else {
        detach(subEl);
      }
    }

    function setRibbon(r: OfferCardOptions['ribbon']): void {
      if (ribbonEl) detach(ribbonEl);
      ribbonEl = null;
      if (r && r.text) {
        ribbonEl = ribbon(r.text, r.tone);
        node.insertBefore(ribbonEl, node.firstChild);
      }
    }

    function setQuantity(q: string | number | null | undefined): void {
      const text = q === null || q === undefined ? '' : String(q);
      if (text === '') {
        if (qtyHandle) detach(qtyHandle.el);
        qtyHandle = null;
      } else if (qtyHandle) {
        qtyHandle.set(text);
      } else {
        qtyHandle = qty(text, { corner: true });
        art.appendChild(qtyHandle.el);
      }
    }

    function renderAction(): void {
      node.classList.toggle('k-is-owned', state.owned);
      if (state.owned) {
        detach(button);
        if (ownedEl) detach(ownedEl);
        ownedEl = ownedTick(state.ownedText);
        action.appendChild(ownedEl);
      } else {
        if (ownedEl) detach(ownedEl);
        ownedEl = null;
        if (button.parentNode !== action) action.appendChild(button);
      }
      button.update({ disabled: state.disabled, loading: state.loading });
    }

    const card: OfferCard = {
      el: node,
      button,
      update(patch: OfferCardPatch): void {
        if (patch.title !== undefined) titleEl.textContent = patch.title;
        if (patch.subtitle !== undefined) setSubtitle(patch.subtitle);
        if (patch.price !== undefined) button.update({ price: patch.price });
        if (patch.quantity !== undefined) setQuantity(patch.quantity);
        if (patch.ribbon !== undefined) setRibbon(patch.ribbon);
        if (patch.owned !== undefined) state.owned = patch.owned === true;
        if (patch.ownedText !== undefined) state.ownedText = patch.ownedText;
        if (patch.disabled !== undefined) state.disabled = patch.disabled === true;
        if (patch.loading !== undefined) state.loading = patch.loading === true;
        if (patch.owned !== undefined || patch.ownedText !== undefined || patch.disabled !== undefined || patch.loading !== undefined) renderAction();
      },
    };

    setSubtitle(opts.subtitle);
    setRibbon(opts.ribbon);
    setQuantity(opts.quantity);
    renderAction();
    return card;
  }

  return { offerCard, ribbon, qty, ownedTick };
}
