/**
 * UI kit — the design system every screen is built from (docs/DESIGN.md §3 "UI").
 * Gold-trimmed indigo panels, raised jewel buttons, bouncy but short motion, Arabic + Latin.
 *
 *   import { createKit, fontsReady, setSafeInsets } from './ui/kit/index.ts';
 *   const kit = createKit({ art, audio, i18n, platform });
 *   platform.setBackHandler(() => kit.closeTop() || screenHandlesBack());
 *
 * Importing this file pulls in ./kit.css (tokens as CSS variables, all `k-` classes, the bundled
 * "Baloo Bhaijaan 2 Variable" font — Arabic and Latin subsets only).
 *
 * ── Sizing ────────────────────────────────────────────────────────────────────────────────────
 * Everything is sized in the design unit `--k-u`: 1 px on a 360-px-wide phone, growing with the
 * smaller viewport side up to 1.375 on tablets, never below 0.9375 (320 px). Write
 * `calc(var(--k-u) * 16)` in screen CSS to scale along with the kit. Sizes passed to the kit
 * (`icon(key, 24)`, `starRow(3, { size: 40 })`) are in the same unit.
 * Safe areas: use `var(--safe-top|right|bottom|left)` (never env() directly); the Android wrapper
 * feeds the real insets through `setSafeInsets`.
 *
 * ── What createKit does once ─────────────────────────────────────────────────────────────────
 * Adds class `k-app` to the app root (`#app`): a fixed full-viewport box with text selection, tap
 * highlight, long-press callout, overscroll and double-tap / pinch zoom switched off, and the
 * kit's typography. Overlays and toasts live in their own layers appended to <body>.
 *
 * ── Surface (types in ./types.ts) ────────────────────────────────────────────────────────────
 * DOM
 *   el(tag, props?, ...children)        hyperscript: el('div', { class: 'x', onclick: fn }, 'text', node)
 *   clear(node)                         remove all children
 *   icon(key, size)                     <canvas> of an art icon / sprite, `size` design units wide
 *   unit()                              current --k-u in px;   reducedMotion()
 *
 * Buttons — all return KitButton = HTMLButtonElement & { update({ label, caption, icon, badge,
 * disabled, loading, ariaLabel, price }) }. Pressed-state animation, 'button' sound + light haptic
 * on activation, ≥ 48 px touch target, double activation guarded (350 ms cooldown; while an
 * onClick Promise is pending the button ignores presses).
 *   button({ label?, icon?, variant?, size?, onClick?, disabled?, badge?, ariaLabel?, round?,
 *            block?, caption?, className?, silent?, cooldown?, shine? })
 *       variant: 'primary' (gold, default) | 'secondary' (violet) | 'ghost' | 'danger' | 'success'
 *       size:    'sm' | 'md' (default) | 'lg'
 *   iconButton({ icon, ariaLabel, variant?, size?, onClick?, disabled?, badge? })      round, icon only
 *   priceButton({ price, label?, icon?, variant?, size?, onClick?, disabled?, loading?, block? })
 *       small caption over a big price; `update({ price, loading })`
 *   adButton({ label, caption?, rewardIcon?, size?, onClick?, disabled?, loading?, badge?, block? })
 *       opt-in rewarded video: video badge + the reward text
 *
 * Overlays — a stack of modal dialogs; focus and pointer events are blocked underneath.
 *   openDialog({ title?, icon?, body, buttons?, dismissible?, onClose?, className?, wide?,
 *                closeButton?, backdropClose?, buttonLayout?, onBack?, silent?, ariaLabel? })
 *       → { el, body, buttons, close(result?), closed: Promise<result | undefined>, isOpen(), setTitle() }
 *       buttons: [{ label, icon?, variant?, result?, onClick?(dialog) (return false to stay open),
 *                   keepOpen?, disabled?, … }] or ready-made kit buttons
 *       'popupOpen' / 'popupClose' sounds; the body scrolls inside when taller than the viewport
 *       (on a very short viewport — a phone in landscape — the whole panel scrolls instead).
 *       Double-tap safety: a new dialog takes no pointer input for its first 320 ms (class
 *       `k-arming`: the second tap of a double tap on its opener cannot hit one of its buttons), a
 *       closing dialog takes none at all, and its transparent overlay (class `k-closing`) stays in
 *       the DOM for 350 ms as a tap shield, so the second tap cannot reach the screen underneath.
 *       Tests: wait for `.k-overlay:not(.k-closing)` / no `.k-overlay` rather than fixed times.
 *   confirm({ title, message, yes, no, danger?, icon? }) → Promise<boolean>   (Back / ✕ ⇒ false)
 *   toast(text, { icon?, duration? })   non-blocking, stacked (max 3), auto-dismiss
 *   closeTop() → boolean                Back button: closes the top dialog if it is dismissible;
 *                                       returns true whenever a dialog is open (false = nothing to close)
 *   closeAll()                          drop every dialog silently (navigation)
 *   hasOverlay() → boolean
 *   The dialog layer (.k-layer) and the toast layer (.k-toasts) exist in the DOM only while they
 *   hold something. Keyboard focus is trapped in the top dialog and goes back to the dialog
 *   underneath / the opener when it closes.
 *
 * Widgets
 *   chip({ icon, text, onClick?, plus?, ariaLabel? }) → { el, set(text, bump?), bump() }
 *   progress({ value, max, notches?, tone? })        → { el, set(value, max?) }   notches = star marks;
 *       a growing value gets a short sheen (at most one per 700 ms, however often set() is called)
 *   starRow(count, { size?, max?, animate?, sound? }) → { el, set(count, animate?) }
 *   toggle({ checked, onChange, label, icon?, disabled? }) → { el, get(), set(), setIcon(), setLabel(), setDisabled() }
 *   segmented(items, { value, onChange, ariaLabel? }) → { el, get(), set() }   items: [{ value, label?, icon? }]
 *   tweenNumber(node, from, to, ms, format?) → Promise<void>      counts with i18n.num by default
 *   countdown({ until | remaining, onDone?, icon?, label?, format? }) → { el, stop() }
 *   listItem({ label, icon?, value?, onClick?, danger?, disabled?, noChevron? }) → { el, set({ label, value, disabled }) }
 *       a settings-style row; with onClick it is a button with a chevron
 *   screen(className?) → <div class="k-screen">   full-screen flex column with safe-area padding
 *   panel(className?, ...children) → gold-trimmed static panel (children go into its inner box)
 *   title(text, size?) · text(text, className?) · rule() · spinner()
 *
 * Shop (docs/DESIGN.md §7)
 *   offerCard({ art, title, subtitle?, price, priceLabel?, priceIcon?, variant?, ribbon?, quantity?,
 *               owned?, ownedText?, layout?, featured?, onBuy, disabled?, loading? })
 *       → { el, button, update({ price, owned, loading, disabled, title, subtitle, quantity, ribbon }) }
 *   ribbon(text, tone?) · qty(text, { corner?, tone? }) → { el, set() } · ownedTick(text?)
 *
 * Environment
 *   setSafeInsets({ top, right, bottom, left })   px, sets --safe-* on :root
 *   fontsReady() → Promise<void>                  both font subsets loaded (or gave up after 4 s)
 *
 * CSS helper classes: k-row / k-col (+ k-gap-4|12|16, k-center, k-wrap, k-grow), k-grid2 / k-grid3,
 * k-scroll, k-title, k-text (+ --muted, --sm, --center, --gold), k-num (LTR numbers), k-selectable.
 * `k-still` on any ancestor (e.g. <html>) freezes the endless call-to-action animations of `shine`
 * buttons — for screenshots and visual tests.
 *
 * ── Motion ───────────────────────────────────────────────────────────────────────────────────
 * Transform / opacity only, 120–250 ms (350 at most), all of it off under prefers-reduced-motion:
 * buttons dip and spring back, `shine` buttons get a light sweep and a slow breath, dialogs pop in
 * and their footer buttons rise in behind them (settled 340 ms after opening), chips / badges /
 * quantities bump when they change, stars pop one by one, the progress bar gets a sheen when it
 * grows, toggles and segmented thumbs spring across.
 *
 * ── Browser floor ────────────────────────────────────────────────────────────────────────────
 * Chrome / Android WebView 80. `node tools/kit-shots.cjs check` audits kit.css against a vetted
 * property list and runs every behaviour check with newer APIs deleted and `inert` neutralised.
 */
import './kit.css';
import type { Child, ElProps } from './dom.ts';
import { clear, el } from './dom.ts';
import { createButtons } from './buttons.ts';
import { createCore } from './core.ts';
import { createOverlays } from './overlay.ts';
import { createShop } from './shop.ts';
import type { Kit, KitDeps, SafeInsets } from './types.ts';
import { createWidgets } from './widgets.ts';

export { clear, el } from './dom.ts';
export type { Child, ElProps } from './dom.ts';
export type * from './types.ts';

const FONT_FAMILY = '"Baloo Bhaijaan 2 Variable"';
const FONT_TIMEOUT_MS = 4000;

let fontsPromise: Promise<void> | null = null;

/**
 * Resolves once the bundled UI font is usable in both scripts (Latin and Arabic are separate
 * files). Never rejects: after 4 s, or without the Font Loading API, it resolves anyway and the
 * fallback font shows.
 */
export function fontsReady(): Promise<void> {
  if (fontsPromise) return fontsPromise;
  fontsPromise = new Promise<void>((resolve) => {
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      resolve();
    };
    try {
      const fonts = document.fonts;
      if (!fonts || typeof fonts.load !== 'function') {
        finish();
        return;
      }
      const spec = '700 16px ' + FONT_FAMILY;
      Promise.all([fonts.load(spec, 'Aa0'), fonts.load(spec, 'أبجد')]).then(finish, finish);
      setTimeout(finish, FONT_TIMEOUT_MS);
    } catch {
      finish();
    }
  });
  return fontsPromise;
}

/**
 * Set the safe-area insets (CSS px) the layout pads with: `--safe-top` … `--safe-left` on :root.
 * Sides left out keep their value (initially `env(safe-area-inset-*)`).
 */
export function setSafeInsets(insets: SafeInsets): void {
  let style: CSSStyleDeclaration;
  try {
    style = document.documentElement.style;
  } catch {
    return;
  }
  const sides = ['top', 'right', 'bottom', 'left'] as const;
  for (const side of sides) {
    const value = insets[side];
    if (typeof value === 'number' && isFinite(value)) style.setProperty('--safe-' + side, (value > 0 ? value : 0) + 'px');
  }
}

function installGlobalBehaviour(root: HTMLElement | null, host: HTMLElement): void {
  const doc = document.documentElement;
  if (doc.getAttribute('data-k-global') === '1') return;
  doc.setAttribute('data-k-global', '1');
  // Keyboard focus rings only while the keyboard is being used.
  document.addEventListener(
    'keydown',
    (ev: KeyboardEvent) => {
      if (ev.key === 'Tab') doc.classList.add('k-kbd');
    },
    true,
  );
  document.addEventListener('pointerdown', () => doc.classList.remove('k-kbd'), true);
  // A long-press must not open the browser's context menu / image callout inside the game.
  // (A real mouse right-click is left alone: it only exists on a developer's desktop.)
  document.addEventListener('contextmenu', (ev: MouseEvent) => {
    const target = ev.target as Node | null;
    if (!target) return;
    const pointerType = (ev as PointerEvent).pointerType;
    const source = (ev as MouseEvent & { sourceCapabilities?: { firesTouchEvents?: boolean } | null }).sourceCapabilities;
    const fromMouse = pointerType ? pointerType === 'mouse' : !!source && source.firesTouchEvents === false;
    if (fromMouse) return;
    if ((root && root.contains(target)) || (target as Element).closest?.('.k-layer, .k-toasts')) ev.preventDefault();
  });
  // A drag must never pick up an icon or a piece of text as a "ghost".
  host.addEventListener('dragstart', (ev: DragEvent) => ev.preventDefault());
}

export function createKit(deps: KitDeps): Kit {
  const host = deps.host || document.body;
  const root = deps.root || document.getElementById('app');
  if (root && root !== document.body) root.classList.add('k-app');
  installGlobalBehaviour(root, host);

  const core = createCore(deps);
  const buttons = createButtons(core);
  const overlays = createOverlays(core, buttons, host);
  const widgets = createWidgets(core);
  const shop = createShop(core, buttons);

  return {
    el: <K extends keyof HTMLElementTagNameMap>(tag: K, props?: ElProps | Child, ...children: Child[]) => el(tag, props, ...children),
    clear,
    icon: core.icon,
    unit: core.unit,
    reducedMotion: core.reducedMotion,

    button: buttons.button,
    iconButton: buttons.iconButton,
    priceButton: buttons.priceButton,
    adButton: buttons.adButton,

    openDialog: overlays.openDialog,
    confirm: overlays.confirm,
    toast: overlays.toast,
    closeTop: overlays.closeTop,
    closeAll: overlays.closeAll,
    hasOverlay: overlays.hasOverlay,

    chip: widgets.chip,
    progress: widgets.progress,
    starRow: widgets.starRow,
    toggle: widgets.toggle,
    segmented: widgets.segmented,
    tweenNumber: widgets.tweenNumber,
    countdown: widgets.countdown,
    listItem: widgets.listItem,
    screen: widgets.screen,
    panel: widgets.panel,
    title: widgets.title,
    text: widgets.text,
    rule: widgets.rule,
    spinner: widgets.spinner,

    offerCard: shop.offerCard,
    ribbon: shop.ribbon,
    qty: shop.qty,
    ownedTick: shop.ownedTick,

    setSafeInsets,
    fontsReady,
  };
}
