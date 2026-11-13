/**
 * Overlay manager: a stack of modal dialogs (gold-trimmed panels over a dimmed backdrop) and the
 * non-blocking toast stack.
 *
 * Both live in their own layers appended to the host (document.body), as siblings of the app
 * root, so screens can rebuild #app freely without touching an open dialog.
 *
 * While at least one dialog is open, everything else in the host is marked aria-hidden + inert and
 * keyboard focus is kept inside the top dialog (Chrome 80 has no `inert`, hence the focus trap).
 */
import type { Buttons } from './buttons.ts';
import type { KitCore } from './core.ts';
import { isThenable, now } from './core.ts';
import { detach, el, reflow, replay } from './dom.ts';
import type { ConfirmOptions, DialogButton, DialogHandle, DialogOptions, KitButton, ToastOptions } from './types.ts';

/** Exit animation length. */
const CLOSE_MS = 170;
/**
 * A closed dialog's (by then invisible) overlay keeps swallowing taps this long — also with reduced
 * motion — so the second tap of a double tap on a dialog button can never reach what is underneath.
 * Matches the kit buttons' own double-activation cooldown.
 */
const SHIELD_MS = 350;
/**
 * A new dialog ignores pointer input this long (its open animation and a moment more: a double tap
 * can be up to ~300 ms apart), so the second tap of a double tap on whatever opened it cannot land
 * on one of the dialog's buttons.
 */
const ARM_MS = 320;
/** When a closed dialog's overlay leaves the DOM. */
const REMOVE_MS = Math.max(CLOSE_MS, SHIELD_MS);
/** Backdrop taps are ignored this long after opening, so a stray tap cannot dismiss a new dialog. */
const BACKDROP_GRACE_MS = 400;
/** Below this visible body height (design units) a squeezed dialog scrolls as a whole. */
const FLOW_BELOW_UNITS = 100;
const TOAST_MAX = 3;
const TOAST_EXIT_MS = 190;

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Entry {
  root: HTMLElement;
  panel: HTMLElement;
  dismissible: boolean;
  closed: boolean;
  back: (() => void) | null;
  close: (result?: unknown) => void;
  silentClose: () => void;
}

interface ToastEntry {
  node: HTMLElement;
  text: string;
  timer: number;
  leaving: boolean;
}

export interface Overlays {
  openDialog<T = unknown>(opts: DialogOptions<T>): DialogHandle<T>;
  confirm(opts: ConfirmOptions): Promise<boolean>;
  toast(text: string, opts?: ToastOptions): void;
  closeTop(): boolean;
  closeAll(): void;
  hasOverlay(): boolean;
}

function isKitButton(b: unknown): b is KitButton {
  return typeof HTMLElement !== 'undefined' && b instanceof HTMLElement;
}

export function createOverlays(core: KitCore, buttons: Buttons, host: HTMLElement): Overlays {
  const stack: Entry[] = [];
  let layer: HTMLElement | null = null;
  let toastHost: HTMLElement | null = null;
  const toasts: ToastEntry[] = [];
  let uid = 0;

  // ───────────────────────────── background & focus ─────────────────────────────

  /** What was hidden behind the overlays, with the attributes to restore. */
  const hidden: { node: Element; aria: string | null; inert: boolean }[] = [];
  let returnFocus: Element | null = null;
  let listening = false;

  function hideBackground(): void {
    const children = host.children;
    for (let i = 0; i < children.length; i++) {
      const node = children[i] as Element;
      if (node === layer || node === toastHost) continue;
      const tag = node.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK' || tag === 'TEMPLATE') continue;
      hidden.push({ node, aria: node.getAttribute('aria-hidden'), inert: node.hasAttribute('inert') });
      node.setAttribute('aria-hidden', 'true');
      node.setAttribute('inert', '');
    }
  }

  function showBackground(): void {
    while (hidden.length) {
      const h = hidden.pop()!;
      if (h.aria === null) h.node.removeAttribute('aria-hidden');
      else h.node.setAttribute('aria-hidden', h.aria);
      if (!h.inert) h.node.removeAttribute('inert');
    }
  }

  function focusables(root: HTMLElement): HTMLElement[] {
    const out: HTMLElement[] = [];
    const list = root.querySelectorAll<HTMLElement>(FOCUSABLE);
    for (let i = 0; i < list.length; i++) {
      const node = list[i] as HTMLElement;
      if (node.getClientRects().length > 0) out.push(node);
    }
    return out;
  }

  function focusPanel(panel: HTMLElement): void {
    try {
      panel.focus({ preventScroll: true });
    } catch {
      // not focusable right now
    }
  }

  function onKeyDown(ev: KeyboardEvent): void {
    if (ev.key !== 'Tab') return;
    const top = stack[stack.length - 1];
    if (!top) return;
    const list = focusables(top.panel);
    if (list.length === 0) {
      ev.preventDefault();
      focusPanel(top.panel);
      return;
    }
    const at = list.indexOf(document.activeElement as HTMLElement);
    if (ev.shiftKey) {
      if (at <= 0) {
        ev.preventDefault();
        list[list.length - 1]!.focus();
      }
    } else if (at < 0 || at === list.length - 1) {
      ev.preventDefault();
      list[0]!.focus();
    }
  }

  function onFocusIn(ev: FocusEvent): void {
    const top = stack[stack.length - 1];
    if (!top) return;
    const target = ev.target as Node | null;
    if (target && top.root.contains(target)) return;
    focusPanel(top.panel);
  }

  /** Bring classes, aria state and listeners in line with the stack after any change. */
  function sync(): void {
    for (let i = 0; i < stack.length; i++) {
      const entry = stack[i]!;
      const under = i < stack.length - 1;
      entry.root.classList.toggle('k-under', under);
      if (under) {
        entry.root.setAttribute('aria-hidden', 'true');
        entry.root.setAttribute('inert', '');
      } else {
        entry.root.removeAttribute('aria-hidden');
        entry.root.removeAttribute('inert');
      }
    }
    if (stack.length > 0 && !listening) {
      listening = true;
      hideBackground();
      document.addEventListener('keydown', onKeyDown, true);
      document.addEventListener('focusin', onFocusIn, true);
    } else if (stack.length === 0 && listening) {
      listening = false;
      showBackground();
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocusIn, true);
      const back = returnFocus;
      returnFocus = null;
      if (back && (back as HTMLElement).isConnected && typeof (back as HTMLElement).focus === 'function') {
        try {
          (back as HTMLElement).focus({ preventScroll: true });
        } catch {
          // the element cannot take focus any more
        }
      }
    }
  }

  function ensureLayer(): HTMLElement {
    if (!layer) layer = el('div', { class: 'k-layer' });
    if (layer.parentNode !== host) host.appendChild(layer);
    // toasts always sit above dialogs
    if (toastHost && toastHost.parentNode === host && toastHost.nextSibling) host.appendChild(toastHost);
    return layer;
  }

  /** The layers only exist while they hold something: an idle screen has no kit nodes next to it. */
  function dropLayerIfEmpty(): void {
    if (layer && !layer.firstChild) detach(layer);
  }

  function dropToastHostIfEmpty(): void {
    if (toastHost && !toastHost.firstChild) detach(toastHost);
  }

  function blurInside(root: HTMLElement): void {
    const active = document.activeElement as HTMLElement | null;
    if (active && active !== document.body && root.contains(active) && typeof active.blur === 'function') {
      try {
        active.blur();
      } catch {
        // nothing to blur
      }
    }
  }

  // ───────────────────────────── dialogs ─────────────────────────────

  function openDialog<T = unknown>(opts: DialogOptions<T>): DialogHandle<T> {
    const parent = ensureLayer();
    const dismissible = opts.dismissible !== false;
    const showX = opts.closeButton !== undefined ? opts.closeButton : dismissible;
    const backdropClose = opts.backdropClose !== undefined ? opts.backdropClose : dismissible;
    const id = 'k-dialog-' + ++uid;

    // content
    const body = el('div', { class: 'k-dialog__body' });
    if (typeof opts.body === 'string') body.appendChild(el('p', { class: 'k-dialog__text', text: opts.body }));
    else body.appendChild(opts.body);
    const bodyWrap = el('div', { class: 'k-dialog__bodywrap' }, body);
    const inner = el('div', { class: 'k-dialog__inner' });

    const titleEl = el('h2', { class: 'k-title k-dialog__title', id: id + '-title' });
    const head = el('div', { class: 'k-dialog__head' }, titleEl, el('div', { class: 'k-rule', 'aria-hidden': 'true' }, el('i')));
    function setTitle(title: string): void {
      titleEl.textContent = title;
      if (title) {
        if (head.parentNode !== inner) inner.insertBefore(head, inner.firstChild);
        panel.setAttribute('aria-labelledby', titleEl.id);
      } else {
        detach(head);
        panel.removeAttribute('aria-labelledby');
      }
    }

    const panel = el(
      'div',
      {
        class: 'k-dialog' + (opts.wide ? ' k-dialog--wide' : '') + (opts.icon ? ' k-dialog--medal' : '') + (opts.className ? ' ' + opts.className : ''),
        role: 'dialog',
        'aria-modal': 'true',
        tabIndex: -1,
      },
      inner,
    );
    inner.appendChild(bodyWrap);
    panel.appendChild(el('div', { class: 'k-dialog__hint k-dialog__hint--up', 'aria-hidden': 'true' }));
    panel.appendChild(el('div', { class: 'k-dialog__hint k-dialog__hint--down', 'aria-hidden': 'true' }));
    if (opts.ariaLabel) panel.setAttribute('aria-label', opts.ariaLabel);
    setTitle(opts.title || '');

    if (opts.icon) {
      panel.appendChild(el('div', { class: 'k-medal', 'aria-hidden': 'true' }, el('div', { class: 'k-medal__core' }, core.icon(opts.icon, 38))));
    }

    const dim = el('div', { class: 'k-overlay__dim' });
    const root = el('div', { class: 'k-overlay' }, dim, panel);

    let resolveClosed: (value: T | undefined) => void = () => undefined;
    const closed = new Promise<T | undefined>((resolve) => {
      resolveClosed = resolve;
    });

    const entry: Entry = {
      root,
      panel,
      dismissible,
      closed: false,
      back: null,
      close: (result?: unknown) => finish(result as T | undefined, false),
      silentClose: () => finish(undefined, true),
    };

    let armTimer = 0;

    function finish(result: T | undefined, quiet: boolean): void {
      if (entry.closed) return;
      entry.closed = true;
      const at = stack.indexOf(entry);
      const wasTop = at >= 0 && at === stack.length - 1;
      if (at >= 0) stack.splice(at, 1);
      window.clearTimeout(armTimer);
      // k-closing also takes the panel out of hit testing: nothing in a closing dialog can be pressed
      root.classList.remove('k-open', 'k-arming');
      root.classList.add('k-closing');
      if (!opts.silent && !quiet) core.sfx('popupClose');
      // a key press must not reach a button of the dialog that is going away
      blurInside(root);
      sync();
      // the dialog underneath is the top one again: keyboard focus moves into it
      const next = stack[stack.length - 1];
      if (wasTop && next) focusPanel(next.panel);
      if (observer) observer.disconnect();
      window.removeEventListener('resize', refit);
      // The exit animation takes CLOSE_MS; the (then transparent) overlay stays on as a tap shield.
      window.setTimeout(() => {
        detach(root);
        dropLayerIfEmpty();
      }, REMOVE_MS);
      if (opts.onClose) {
        try {
          opts.onClose(result);
        } catch (err) {
          if (typeof console !== 'undefined') console.error('[kit] dialog onClose failed', err);
        }
      }
      resolveClosed(result);
    }

    const footButtons: KitButton[] = [];
    const handle: DialogHandle<T> = {
      el: panel,
      body,
      buttons: footButtons,
      close: (result?: T) => finish(result, false),
      closed,
      isOpen: () => !entry.closed,
      setTitle,
    };

    if (opts.onBack) {
      const onBack = opts.onBack;
      entry.back = () => onBack(handle);
    }

    // footer buttons
    const defs = opts.buttons || [];
    let foot: HTMLElement | null = null;
    if (defs.length > 0) {
      const column = opts.buttonLayout ? opts.buttonLayout === 'column' : defs.length > 2;
      foot = el('div', { class: 'k-dialog__foot' + (column ? ' k-dialog__foot--col' : '') });
      for (let i = 0; i < defs.length; i++) {
        const def = defs[i]!;
        const button = isKitButton(def) ? def : dialogButton(def, i === defs.length - 1);
        footButtons.push(button);
        foot.appendChild(button);
      }
      inner.appendChild(foot);
    }

    function dialogButton(def: DialogButton<T>, last: boolean): KitButton {
      return buttons.button({
        label: def.label,
        icon: def.icon,
        caption: def.caption,
        variant: def.variant || (last ? 'primary' : 'secondary'),
        size: def.size || 'md',
        disabled: def.disabled,
        badge: def.badge,
        ariaLabel: def.ariaLabel,
        shine: def.shine,
        onClick: () => {
          if (entry.closed) return undefined;
          const settle = (value: unknown): void => {
            if (value !== false && !def.keepOpen) finish(def.result, false);
          };
          const outcome = def.onClick ? def.onClick(handle) : undefined;
          if (isThenable(outcome)) return Promise.resolve(outcome).then(settle);
          settle(outcome);
          return undefined;
        },
      });
    }

    if (showX) {
      panel.appendChild(
        buttons.button({
          icon: 'close',
          round: true,
          size: 'sm',
          variant: 'secondary',
          ariaLabel: core.i18n.t('common.close'),
          className: 'k-dialog__x',
          silent: true,
          onClick: () => finish(undefined, false),
        }),
      );
    }

    // Nothing inside a dialog that has closed may still be activated (its exit animation is running):
    // the stylesheet takes the panel out of hit testing; this also covers content that opted back in.
    root.addEventListener(
      'click',
      (ev: MouseEvent) => {
        if (entry.closed && ev.isTrusted) {
          ev.stopPropagation();
          ev.preventDefault();
        }
      },
      true,
    );

    // backdrop: a tap that starts and ends outside the panel
    const openedAt = now();
    let downOutside = false;
    /** Over the panel's box? (While the panel is not hit-testable — arming — its taps land on the overlay.) */
    const overPanel = (ev: MouseEvent): boolean => {
      const r = panel.getBoundingClientRect();
      return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
    };
    root.addEventListener('pointerdown', (ev: PointerEvent) => {
      downOutside = (ev.target === root || ev.target === dim) && !overPanel(ev);
    });
    root.addEventListener('click', (ev: MouseEvent) => {
      const outside = (ev.target === root || ev.target === dim) && !overPanel(ev);
      if (!outside || !downOutside || entry.closed) return;
      downOutside = false;
      if (now() - openedAt < BACKDROP_GRACE_MS) return;
      if (backdropClose) finish(undefined, false);
      else if (!dismissible) replay(panel, 'k-nudge');
    });

    /**
     * Two buttons sit side by side — unless a label would wrap (long words, Arabic or English, on
     * a narrow phone): then they stack, main button on top. Only when the layout was not forced.
     */
    function fitButtons(): void {
      if (!foot || opts.buttonLayout || defs.length !== 2) return;
      foot.classList.remove('k-dialog__foot--col', 'k-dialog__foot--rev');
      const labels = foot.querySelectorAll<HTMLElement>('.k-btn__label');
      for (let i = 0; i < labels.length; i++) {
        const label = labels[i] as HTMLElement;
        const line = parseFloat(getComputedStyle(label).lineHeight);
        if (line > 0 && label.offsetHeight > line * 1.5) {
          foot.classList.add('k-dialog__foot--col', 'k-dialog__foot--rev');
          return;
        }
      }
    }

    /**
     * Normally the title and the buttons stay put and only the body scrolls. On a very short
     * viewport (a phone in landscape with stacked buttons) that would squeeze the body to a
     * sliver — then the whole panel content scrolls as one instead ("flow" mode).
     */
    let flow = false;
    function fitBody(): void {
      panel.classList.remove('k-dialog--flow');
      flow = false;
      const need = body.scrollHeight;
      const have = body.clientHeight;
      if (need > have + 1 && have < Math.min(need, FLOW_BELOW_UNITS * core.unit())) {
        flow = true;
        panel.classList.add('k-dialog--flow');
      }
    }

    // scroll hints
    function updateScrollHints(): void {
      const scroller = flow ? inner : body;
      const max = scroller.scrollHeight - scroller.clientHeight;
      const up = scroller.scrollTop > 2;
      const down = max - scroller.scrollTop > 2;
      bodyWrap.classList.toggle('k-can-up', !flow && up);
      bodyWrap.classList.toggle('k-can-down', !flow && down);
      panel.classList.toggle('k-can-up', flow && up);
      panel.classList.toggle('k-can-down', flow && down);
    }
    function refit(): void {
      if (entry.closed) return;
      fitButtons();
      fitBody();
      updateScrollHints();
    }
    body.addEventListener('scroll', updateScrollHints, { passive: true });
    inner.addEventListener('scroll', updateScrollHints, { passive: true });
    window.addEventListener('resize', refit);
    let observer: ResizeObserver | null = null;
    let refitQueued = false;
    if (typeof ResizeObserver === 'function') {
      // content changed size (text set later, fonts arriving): re-fit on the next frame
      observer = new ResizeObserver(() => {
        if (refitQueued) return;
        refitQueued = true;
        requestAnimationFrame(() => {
          refitQueued = false;
          refit();
        });
      });
      if (body.firstElementChild) observer.observe(body.firstElementChild);
      // … and when the room for it changed (a title set later, buttons that re-stacked)
      observer.observe(body);
      if (foot) observer.observe(foot);
    }

    // show
    if (stack.length === 0) returnFocus = document.activeElement;
    stack.push(entry);
    root.classList.add('k-arming');
    parent.appendChild(root);
    // focus first, then hide the background: nothing that is aria-hidden may still hold the focus
    focusPanel(panel);
    sync();
    refit();
    reflow(root);
    root.classList.add('k-open');
    armTimer = window.setTimeout(() => root.classList.remove('k-arming'), ARM_MS);
    if (!opts.silent) core.sfx('popupOpen');
    return handle;
  }

  function closeTop(): boolean {
    const top = stack[stack.length - 1];
    if (!top) return false;
    if (top.back) top.back();
    else if (top.dismissible) top.close(undefined);
    else replay(top.panel, 'k-nudge');
    return true;
  }

  function closeAll(): void {
    for (let i = stack.length - 1; i >= 0; i--) {
      const entry = stack[i];
      if (entry) entry.silentClose();
    }
  }

  function confirm(opts: ConfirmOptions): Promise<boolean> {
    return openDialog<boolean>({
      title: opts.title,
      icon: opts.icon,
      body: opts.message,
      buttons: [
        { label: opts.no, variant: 'secondary', result: false },
        { label: opts.yes, variant: opts.danger ? 'danger' : 'primary', result: true },
      ],
    }).closed.then((result) => result === true);
  }

  // ───────────────────────────── toasts ─────────────────────────────

  function ensureToastHost(): HTMLElement {
    if (!toastHost) toastHost = el('div', { class: 'k-toasts', role: 'status', 'aria-live': 'polite' });
    if (toastHost.parentNode !== host || toastHost.nextSibling) host.appendChild(toastHost);
    return toastHost;
  }

  function removeToast(entry: ToastEntry): void {
    if (entry.leaving) return;
    entry.leaving = true;
    window.clearTimeout(entry.timer);
    entry.node.classList.remove('k-in');
    entry.node.classList.add('k-out');
    window.setTimeout(
      () => {
        // FLIP: the toasts below glide up into the gap instead of jumping
        const rest: { node: HTMLElement; top: number }[] = [];
        for (const other of toasts) {
          if (other !== entry && !other.leaving) rest.push({ node: other.node, top: other.node.getBoundingClientRect().top });
        }
        detach(entry.node);
        const at = toasts.indexOf(entry);
        if (at >= 0) toasts.splice(at, 1);
        dropToastHostIfEmpty();
        for (const r of rest) {
          const delta = r.top - r.node.getBoundingClientRect().top;
          if (Math.abs(delta) < 0.5) continue;
          r.node.classList.add('k-shift');
          r.node.style.transform = 'translateY(' + delta + 'px)';
          reflow(r.node);
          r.node.classList.remove('k-shift');
          r.node.style.transform = '';
        }
      },
      core.reducedMotion() ? 0 : TOAST_EXIT_MS,
    );
  }

  function toast(text: string, opts?: ToastOptions): void {
    const parent = ensureToastHost();
    const duration = opts && typeof opts.duration === 'number' ? opts.duration : Math.min(6000, 1900 + text.length * 45);

    // The same message again: restart its clock instead of stacking a copy.
    for (const existing of toasts) {
      if (existing.text === text && !existing.leaving) {
        window.clearTimeout(existing.timer);
        existing.timer = window.setTimeout(() => removeToast(existing), duration);
        replay(existing.node, 'k-toast--again');
        return;
      }
    }

    const node = el('div', { class: 'k-toast' });
    if (opts && opts.icon) {
      const c = core.icon(opts.icon, 26);
      c.classList.add('k-toast__icon');
      node.appendChild(c);
    }
    node.appendChild(el('span', { class: 'k-toast__text', text }));
    const entry: ToastEntry = { node, text, timer: 0, leaving: false };
    toasts.push(entry);
    parent.appendChild(node);
    reflow(node);
    node.classList.add('k-in');
    entry.timer = window.setTimeout(() => removeToast(entry), duration);

    let live = 0;
    for (const t of toasts) if (!t.leaving) live++;
    for (let i = 0; live > TOAST_MAX && i < toasts.length; i++) {
      const t = toasts[i]!;
      if (!t.leaving) {
        removeToast(t);
        live--;
      }
    }
  }

  return {
    openDialog,
    confirm,
    toast,
    closeTop,
    closeAll,
    hasOverlay: () => stack.length > 0,
  };
}
