/**
 * Shared plumbing of the kit's component files: the injected services plus a few helpers that
 * every component needs (icons in design units, feedback, the pressed state).
 */
import type { ArtApi } from '../../art/types.ts';
import type { AudioApi, SfxName, SfxOptions } from '../../audio/types.ts';
import type { I18nApi } from '../../i18n/types.ts';
import type { HapticKind, PlatformApi } from '../../platform/types.ts';
import type { IconName } from './types.ts';

/** Bounds of the design unit --k-u; keep in sync with `--k-u` in kit.css. */
export const UNIT_MIN = 0.9375;
export const UNIT_MAX = 1.375;
export const UNIT_PER_VMIN_PX = 0.002778;

/** A press shows for at least this long, so even the quickest tap gives visible feedback. */
const MIN_PRESS_MS = 90;

export interface KitCore {
  readonly art: ArtApi;
  readonly audio: AudioApi;
  readonly i18n: I18nApi;
  readonly platform: PlatformApi;
  /** Canvas icon `size` design units wide (crisp at the current unit and device pixel ratio). */
  icon(key: IconName, size: number): HTMLCanvasElement;
  unit(): number;
  reducedMotion(): boolean;
  /** Sound that can never throw into UI code. */
  sfx(name: SfxName, opts?: SfxOptions): void;
  haptic(kind: HapticKind): void;
  /** The standard press feedback: 'button' sound + light haptic. */
  tap(): void;
  /** Give `node` the `k-pressed` class while it is held (pointer, Enter, Space). */
  pressable(node: HTMLElement): void;
}

export function currentUnit(): number {
  let w = 360;
  let h = 640;
  try {
    w = window.innerWidth || w;
    h = window.innerHeight || h;
  } catch {
    // no window: design size
  }
  const u = Math.min(w, h) * UNIT_PER_VMIN_PX;
  return u < UNIT_MIN ? UNIT_MIN : u > UNIT_MAX ? UNIT_MAX : u;
}

export function prefersReducedMotion(): boolean {
  try {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function now(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}

export function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && typeof (value as { then?: unknown }).then === 'function';
}

export function createCore(deps: { art: ArtApi; audio: AudioApi; i18n: I18nApi; platform: PlatformApi }): KitCore {
  const { art, audio, i18n, platform } = deps;

  function sfx(name: SfxName, opts?: SfxOptions): void {
    try {
      audio.sfx(name, opts);
    } catch {
      // sound is a nicety
    }
  }

  function haptic(kind: HapticKind): void {
    try {
      platform.haptic(kind);
    } catch {
      // haptics are a nicety
    }
  }

  function pressable(node: HTMLElement): void {
    let downAt = 0;
    let timer = 0;
    const isDisabled = (): boolean => (node as HTMLButtonElement).disabled === true;
    const press = (): void => {
      if (isDisabled()) return;
      if (timer) {
        clearTimeout(timer);
        timer = 0;
      }
      downAt = now();
      node.classList.add('k-pressed');
    };
    const release = (): void => {
      if (!node.classList.contains('k-pressed') || timer) return;
      const held = now() - downAt;
      if (held >= MIN_PRESS_MS) {
        node.classList.remove('k-pressed');
      } else {
        timer = window.setTimeout(() => {
          timer = 0;
          node.classList.remove('k-pressed');
        }, MIN_PRESS_MS - held);
      }
    };
    node.addEventListener('pointerdown', (ev: PointerEvent) => {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      press();
    });
    node.addEventListener('pointerup', release);
    node.addEventListener('pointercancel', release);
    node.addEventListener('pointerleave', release);
    node.addEventListener('keydown', (ev: KeyboardEvent) => {
      if ((ev.key === ' ' || ev.key === 'Enter') && !ev.repeat) press();
    });
    node.addEventListener('keyup', release);
    node.addEventListener('blur', release);
  }

  return {
    art,
    audio,
    i18n,
    platform,

    icon(key: IconName, size: number): HTMLCanvasElement {
      const px = Math.max(1, Math.round(size * currentUnit()));
      const canvas = art.icon(key, px);
      // Sized in design units so it follows the layout if the window is resized later.
      const css = 'calc(var(--k-u) * ' + size + ')';
      canvas.style.width = css;
      canvas.style.height = css;
      canvas.classList.add('k-icon');
      return canvas;
    },

    unit: currentUnit,
    reducedMotion: prefersReducedMotion,
    sfx,
    haptic,

    tap(): void {
      try {
        audio.unlock();
      } catch {
        // stays locked until the next gesture
      }
      sfx('button');
      haptic('light');
    },

    pressable,
  };
}
