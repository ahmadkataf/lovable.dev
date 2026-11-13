/**
 * Public types of the UI kit (src/ui/kit). The overview with every signature is at the top of
 * ./index.ts; this file holds the option / handle shapes.
 */
import type { ArtApi, IconKey, SpriteKey } from '../../art/types.ts';
import type { AudioApi } from '../../audio/types.ts';
import type { I18nApi } from '../../i18n/types.ts';
import type { PlatformApi } from '../../platform/types.ts';
import type { Child, ElProps } from './dom.ts';

/** Anything the art module can draw as an icon: UI icons and board sprites (gems, lamp, prism …). */
export type IconName = IconKey | SpriteKey;

export interface KitDeps {
  art: ArtApi;
  audio: AudioApi;
  i18n: I18nApi;
  platform: PlatformApi;
  /**
   * The app root that gets the global behaviour (no text selection, no tap highlight, no callout,
   * no overscroll, no double-tap zoom) and the kit's typography. Default: `#app`.
   */
  root?: HTMLElement;
  /** Where the overlay and toast layers are appended (as siblings of the app root). Default: `document.body`. */
  host?: HTMLElement;
}

// ───────────────────────────── buttons ─────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonOptions {
  label?: string;
  /** Drawn before the label; alone (with `round`) it makes an icon button. */
  icon?: IconName;
  /** Default 'primary' (gold). */
  variant?: ButtonVariant;
  /** Default 'md'. sm 46 · md 57 · lg 70 design units tall; every size has a ≥ 48 px touch target. */
  size?: ButtonSize;
  /**
   * Called once per activation (tap, click, Enter/Space). A second activation within `cooldown`
   * ms is ignored; when the handler returns a Promise the button ignores presses until it settles.
   */
  onClick?: (ev: MouseEvent) => unknown;
  disabled?: boolean;
  /** Small bubble on the top end corner (a count, "!"). null / '' hides it. */
  badge?: string | number | null;
  /** Required for icon-only buttons. */
  ariaLabel?: string;
  /** Icon-only circle. */
  round?: boolean;
  /** Fill the container's width. */
  block?: boolean;
  /** A smaller second line under the label. */
  caption?: string;
  className?: string;
  /** No 'button' sound / haptic (for buttons whose action has its own sound). */
  silent?: boolean;
  /** Minimum time between two activations, ms. Default 350. */
  cooldown?: number;
}

export interface ButtonPatch {
  label?: string;
  caption?: string | null;
  icon?: IconName | null;
  badge?: string | number | null;
  disabled?: boolean;
  /** Shows a spinner instead of the content and blocks activation (the button keeps its size). */
  loading?: boolean;
  ariaLabel?: string;
  /** Price buttons only: the price string. */
  price?: string;
}

/** A real <button> with one extra method. */
export interface KitButton extends HTMLButtonElement {
  /** Change label / caption / icon / badge / disabled / loading (/ price) in place. */
  update(patch: ButtonPatch): void;
}

export interface IconButtonOptions {
  icon: IconName;
  ariaLabel: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  onClick?: (ev: MouseEvent) => unknown;
  disabled?: boolean;
  badge?: string | number | null;
  className?: string;
  silent?: boolean;
}

export interface PriceButtonOptions {
  /** The store's localised price string ("US$0.99", "٣٫٩٩ ر.س") or a coin amount ("90"). Shown big. */
  price: string;
  /** Small caption above the price ("Buy"). */
  label?: string;
  /** Icon before the texts (e.g. 'coin' for coin prices). */
  icon?: IconName;
  /** Default 'success' (green). */
  variant?: ButtonVariant;
  size?: ButtonSize;
  onClick?: (ev: MouseEvent) => unknown;
  disabled?: boolean;
  loading?: boolean;
  ariaLabel?: string;
  block?: boolean;
  className?: string;
}

export interface AdButtonOptions {
  /** The reward, stated on the button ("+5 moves", "+25"). */
  label: string;
  /** Small second line ("Watch a video"). */
  caption?: string;
  /** Icon of the reward shown after the video badge (e.g. 'coin', 'heart'). */
  rewardIcon?: IconName;
  size?: ButtonSize;
  onClick?: (ev: MouseEvent) => unknown;
  disabled?: boolean;
  loading?: boolean;
  /** e.g. how many are left today. */
  badge?: string | number | null;
  ariaLabel?: string;
  block?: boolean;
  className?: string;
}

// ───────────────────────────── overlays ─────────────────────────────

export interface DialogButton<T = unknown> {
  label?: string;
  icon?: IconName;
  /** Default: the last button is 'primary', the others 'secondary'. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  caption?: string;
  disabled?: boolean;
  badge?: string | number | null;
  ariaLabel?: string;
  /** What `closed` resolves with when this button closes the dialog. */
  result?: T;
  /**
   * Runs before the dialog closes. Return `false` (or a Promise of `false`) to keep it open;
   * a rejected Promise keeps it open too.
   */
  onClick?: (dialog: DialogHandle<T>) => unknown;
  /** Never close the dialog from this button (close it yourself with `dialog.close()`). */
  keepOpen?: boolean;
}

export interface DialogOptions<T = unknown> {
  title?: string;
  /** Shown in a star medallion on the top edge. */
  icon?: IconName;
  /** A string becomes a centred paragraph (line breaks are kept). */
  body: Node | string;
  /** Footer buttons; ready-made kit buttons (price / ad buttons) are placed as they are. */
  buttons?: readonly (DialogButton<T> | KitButton)[];
  /**
   * Default true: Back, the ✕ button and a tap on the backdrop close it (`closed` resolves with
   * undefined). false: no ✕, and Back / backdrop taps are swallowed (the panel gives a little nudge).
   */
  dismissible?: boolean;
  /** Called once when the dialog closes, whatever closed it. */
  onClose?: (result: T | undefined) => void;
  className?: string;
  /** Wider panel (480 instead of 340 design units) for shops and grids. */
  wide?: boolean;
  /** Show the ✕ button. Default: same as `dismissible`. */
  closeButton?: boolean;
  /** Close on a backdrop tap. Default: same as `dismissible`. */
  backdropClose?: boolean;
  /** Default: side by side for up to two buttons, stacked for more. */
  buttonLayout?: 'row' | 'column';
  /** Custom Back-button behaviour for this dialog (replaces "close if dismissible"). */
  onBack?: (dialog: DialogHandle<T>) => void;
  /** No open / close sounds. */
  silent?: boolean;
  /** Accessible name when there is no title. */
  ariaLabel?: string;
}

export interface DialogHandle<T = unknown> {
  /** The panel element (role="dialog"). */
  readonly el: HTMLElement;
  /** The scrolling content container. */
  readonly body: HTMLElement;
  /** Close with an optional result. Safe to call twice. */
  close(result?: T): void;
  /** Resolves when the dialog is closed (at once — it does not wait for the exit animation). */
  readonly closed: Promise<T | undefined>;
  isOpen(): boolean;
  setTitle(title: string): void;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  /** Label of the confirming button. */
  yes: string;
  /** Label of the cancelling button. */
  no: string;
  /** The confirming button is red (destructive actions). */
  danger?: boolean;
  icon?: IconName;
}

export interface ToastOptions {
  icon?: IconName;
  /** ms on screen. Default grows with the text length (about 2–6 s). */
  duration?: number;
}

// ───────────────────────────── widgets ─────────────────────────────

export interface ChipOptions {
  icon: IconName;
  text: string | number;
  /** Makes the chip a button (e.g. coins → shop). */
  onClick?: (ev: MouseEvent) => unknown;
  /** Show a small "+" at the end (use with onClick). */
  plus?: boolean;
  ariaLabel?: string;
  className?: string;
}

export interface Chip {
  readonly el: HTMLElement;
  /** Change the text; bumps when it changed unless `bump` is false. */
  set(text: string | number, bump?: boolean): void;
  bump(): void;
}

export interface ProgressOptions {
  value: number;
  max: number;
  /** Star notches at these values (same scale as `value`), e.g. the three star thresholds. */
  notches?: readonly number[];
  tone?: 'gold' | 'success' | 'info';
  ariaLabel?: string;
  className?: string;
}

export interface Progress {
  readonly el: HTMLElement;
  set(value: number, max?: number): void;
}

export interface StarRowOptions {
  /** Width of a side star in design units. Default 40. */
  size?: number;
  /** Number of star slots. Default 3. */
  max?: number;
  /** Pop the earned stars in one after the other. */
  animate?: boolean;
  /** Play the 'star' sound with each pop. Default: same as `animate`. */
  sound?: boolean;
}

export interface StarRow {
  readonly el: HTMLElement;
  set(count: number, animate?: boolean): void;
}

export interface ToggleOptions {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  icon?: IconName;
  disabled?: boolean;
}

export interface Toggle {
  readonly el: HTMLButtonElement;
  get(): boolean;
  /** Set without calling onChange. */
  set(checked: boolean): void;
  setIcon(icon: IconName | null): void;
  setLabel(label: string): void;
  setDisabled(disabled: boolean): void;
}

export interface SegmentedItem<V extends string = string> {
  value: V;
  label?: string;
  icon?: IconName;
  ariaLabel?: string;
}

export interface SegmentedOptions<V extends string = string> {
  value: V;
  onChange: (value: V) => void;
  ariaLabel?: string;
}

export interface Segmented<V extends string = string> {
  readonly el: HTMLElement;
  get(): V;
  /** Select without calling onChange. */
  set(value: V): void;
}

export interface CountdownOptions {
  /** Target time (epoch ms) … */
  until?: number;
  /** … or a function returning the remaining ms (e.g. profile.msToNextLife). */
  remaining?: () => number;
  /** Called once when the countdown reaches zero. */
  onDone?: () => void;
  icon?: IconName;
  /** Text before the clock ("Next life in"). */
  label?: string;
  /** Default: i18n.clock ("mm:ss", "h:mm:ss"). */
  format?: (ms: number) => string;
  className?: string;
}

export interface Countdown {
  readonly el: HTMLElement;
  /** Stop ticking (also happens by itself once the element has left the document). */
  stop(): void;
}

// ───────────────────────────── shop ─────────────────────────────

export type RibbonTone = 'popular' | 'best' | 'new';

export interface OfferCardOptions {
  /** Artwork: an icon / sprite key, or any node (e.g. a composed stack of icons). */
  art: IconName | Node;
  title: string;
  subtitle?: string;
  /** Price string for the button (store price or coin amount). */
  price: string;
  /** Small caption on the price button ("Buy"). */
  priceLabel?: string;
  /** Icon on the price button (e.g. 'coin' when the price is in coins). */
  priceIcon?: IconName;
  /** Price button colour. Default 'success'. */
  variant?: ButtonVariant;
  /** Corner ribbon; the text is yours ("Popular", "Best value"). */
  ribbon?: { text: string; tone?: RibbonTone } | null;
  /** Quantity badge on the artwork ("×3", "+500"). */
  quantity?: string | number | null;
  /** Owned: the price button is replaced by a tick and `ownedText`. */
  owned?: boolean;
  ownedText?: string;
  /** 'tile' (default): artwork on top, for grids. 'row': artwork · texts · price, full width. */
  layout?: 'tile' | 'row';
  /** Gold frame and glow. */
  featured?: boolean;
  onBuy: (card: OfferCard) => unknown;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

export interface OfferCardPatch {
  title?: string;
  subtitle?: string | null;
  price?: string;
  owned?: boolean;
  ownedText?: string;
  disabled?: boolean;
  loading?: boolean;
  quantity?: string | number | null;
  ribbon?: { text: string; tone?: RibbonTone } | null;
}

export interface OfferCard {
  readonly el: HTMLElement;
  /** The price button (kept even while the card shows the owned state). */
  readonly button: KitButton;
  update(patch: OfferCardPatch): void;
}

export interface QtyOptions {
  /** Pin to the bottom end corner of the nearest positioned ancestor. */
  corner?: boolean;
  tone?: 'ink' | 'gold';
}

export interface Qty {
  readonly el: HTMLElement;
  set(text: string | number, bump?: boolean): void;
}

// ───────────────────────────── the kit ─────────────────────────────

export interface SafeInsets {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface Kit {
  // dom
  el<K extends keyof HTMLElementTagNameMap>(tag: K, props?: ElProps | Child, ...children: Child[]): HTMLElementTagNameMap[K];
  clear<T extends Node>(node: T): T;
  icon(key: IconName, size: number): HTMLCanvasElement;
  /** Current value of the design unit --k-u in CSS px (1 on a 360-px phone … 1.375 on tablets). */
  unit(): number;
  reducedMotion(): boolean;

  // buttons
  button(opts: ButtonOptions): KitButton;
  iconButton(opts: IconButtonOptions): KitButton;
  priceButton(opts: PriceButtonOptions): KitButton;
  adButton(opts: AdButtonOptions): KitButton;

  // overlays
  openDialog<T = unknown>(opts: DialogOptions<T>): DialogHandle<T>;
  confirm(opts: ConfirmOptions): Promise<boolean>;
  toast(text: string, opts?: ToastOptions): void;
  closeTop(): boolean;
  closeAll(): void;
  hasOverlay(): boolean;

  // widgets
  chip(opts: ChipOptions): Chip;
  progress(opts: ProgressOptions): Progress;
  starRow(count: number, opts?: StarRowOptions): StarRow;
  toggle(opts: ToggleOptions): Toggle;
  segmented<V extends string>(items: readonly SegmentedItem<V>[], opts: SegmentedOptions<V>): Segmented<V>;
  tweenNumber(node: Element, from: number, to: number, ms: number, format?: (n: number) => string): Promise<void>;
  countdown(opts: CountdownOptions): Countdown;
  screen(className?: string): HTMLDivElement;
  panel(className?: string | null, ...children: Child[]): HTMLDivElement;
  title(text: string, size?: 'sm' | 'md' | 'lg'): HTMLHeadingElement;
  text(text: string, className?: string): HTMLParagraphElement;
  rule(): HTMLElement;
  spinner(): HTMLElement;

  // shop
  offerCard(opts: OfferCardOptions): OfferCard;
  ribbon(text: string, tone?: RibbonTone): HTMLElement;
  qty(text: string | number, opts?: QtyOptions): Qty;
  ownedTick(text?: string): HTMLElement;

  // environment
  setSafeInsets(insets: SafeInsets): void;
  fontsReady(): Promise<void>;
}
