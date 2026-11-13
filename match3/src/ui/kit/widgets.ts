/**
 * Small widgets: counter chips, progress bar, star row, toggle, segmented control, number tween,
 * countdown text and the static containers (screen, panel, title, rule, spinner).
 */
import type { KitCore } from './core.ts';
import { isThenable, now } from './core.ts';
import type { Child } from './dom.ts';
import { el, replay } from './dom.ts';
import type {
  Chip,
  ChipOptions,
  Countdown,
  CountdownOptions,
  IconName,
  Progress,
  ProgressOptions,
  Segmented,
  SegmentedItem,
  SegmentedOptions,
  StarRow,
  StarRowOptions,
  Toggle,
  ToggleOptions,
} from './types.ts';

/** Delay between two stars popping in (keep in sync with .k-stars--animate in kit.css). */
const STAR_STEP_MS = 260;
const STAR_FIRST_MS = 120;

export interface Widgets {
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
}

function clamp01(x: number): number {
  return x > 0 ? (x < 1 ? x : 1) : 0;
}

export function createWidgets(core: KitCore): Widgets {
  // ───────────────────────────── chip ─────────────────────────────

  function chip(opts: ChipOptions): Chip {
    const clickable = typeof opts.onClick === 'function';
    const textEl = el('span', { class: 'k-chip__text', text: String(opts.text) });
    const iconEl = core.icon(opts.icon, 36);
    iconEl.classList.add('k-chip__icon');
    const node = el(
      clickable ? 'button' : 'div',
      {
        class: 'k-chip' + (clickable ? ' k-chip--button' : '') + (opts.plus ? ' k-chip--plus' : '') + (opts.className ? ' ' + opts.className : ''),
        'aria-label': opts.ariaLabel,
      },
      el('span', { class: 'k-chip__in' }, iconEl, textEl, opts.plus ? el('span', { class: 'k-chip__plus', 'aria-hidden': 'true' }, core.icon('plus', 16)) : null),
    );
    if (clickable) {
      const btn = node as HTMLButtonElement;
      btn.type = 'button';
      core.pressable(btn);
      let lockedUntil = 0;
      let busy = false;
      btn.addEventListener('click', (ev: MouseEvent) => {
        const t = now();
        if (busy || t < lockedUntil) return;
        lockedUntil = t + 350;
        core.tap();
        let result: unknown;
        try {
          result = opts.onClick!(ev);
        } catch (err) {
          if (typeof console !== 'undefined') console.error('[kit] chip handler failed', err);
          return;
        }
        if (isThenable(result)) {
          busy = true;
          const done = (): void => {
            busy = false;
          };
          result.then(done, done);
        }
      });
    }
    const bump = (): void => replay(node, 'k-bump');
    return {
      el: node,
      set(text: string | number, doBump?: boolean): void {
        const next = String(text);
        if (textEl.textContent === next) return;
        textEl.textContent = next;
        if (doBump !== false) bump();
      },
      bump,
    };
  }

  // ───────────────────────────── progress ─────────────────────────────

  function progress(opts: ProgressOptions): Progress {
    const notches = opts.notches || [];
    const fill = el('div', { class: 'k-progress__fill' });
    const track = el('div', { class: 'k-progress__track' }, fill);
    const node = el(
      'div',
      {
        class:
          'k-progress' +
          (notches.length ? ' k-progress--notched' : '') +
          (opts.tone && opts.tone !== 'gold' ? ' k-progress--' + opts.tone : '') +
          (opts.className ? ' ' + opts.className : ''),
        role: 'progressbar',
        'aria-valuemin': '0',
        'aria-label': opts.ariaLabel,
      },
      track,
    );
    const marks: HTMLElement[] = [];
    for (let i = 0; i < notches.length; i++) {
      const full = core.icon('star', 24);
      full.classList.add('k-on-icon');
      const mark = el('div', { class: 'k-progress__notch', 'aria-hidden': 'true' }, core.icon('starEmpty', 24), full);
      marks.push(mark);
      node.appendChild(mark);
    }
    let max = 1;
    function set(value: number, newMax?: number): void {
      if (typeof newMax === 'number') max = newMax;
      const top = max > 0 ? max : 1;
      const v = value > 0 ? (value < top ? value : top) : 0;
      node.style.setProperty('--k-p', String(Math.round((v / top) * 10000) / 10000));
      node.setAttribute('aria-valuemax', String(top));
      node.setAttribute('aria-valuenow', String(Math.round(v)));
      for (let i = 0; i < marks.length; i++) {
        const at = notches[i]!;
        marks[i]!.style.setProperty('--k-at', String(clamp01(at / top)));
        marks[i]!.classList.toggle('k-on', value >= at);
      }
    }
    set(opts.value, opts.max);
    return { el: node, set };
  }

  // ───────────────────────────── stars ─────────────────────────────

  function starRow(count: number, opts?: StarRowOptions): StarRow {
    const size = (opts && opts.size) || 40;
    const max = (opts && opts.max) || 3;
    const arc = max === 3;
    const sound = opts && opts.sound !== undefined ? opts.sound : !!(opts && opts.animate);
    const node = el('div', { class: 'k-stars' + (arc ? ' k-stars--arc' : ''), role: 'img', style: { '--k-star': 'calc(var(--k-u) * ' + size + ')' } });
    const stars: HTMLElement[] = [];
    for (let i = 0; i < max; i++) {
      const s = arc && i === 1 ? Math.round(size * 1.28) : size;
      const full = core.icon('star', s);
      full.classList.add('k-on-icon');
      const star = el('span', { class: 'k-star', style: { '--k-i': String(i) } }, core.icon('starEmpty', s), full);
      stars.push(star);
      node.appendChild(star);
    }
    let timers: number[] = [];
    function set(n: number, animate?: boolean): void {
      const earned = n > 0 ? (n < max ? Math.floor(n) : max) : 0;
      for (const t of timers) window.clearTimeout(t);
      timers = [];
      node.setAttribute('aria-label', earned + ' / ' + max);
      const run = animate === true && !core.reducedMotion();
      node.classList.remove('k-stars--animate');
      for (let i = 0; i < max; i++) stars[i]!.classList.toggle('k-on', i < earned);
      if (!run) return;
      // restart the pop animation, and time the sounds with it
      void node.offsetWidth;
      node.classList.add('k-stars--animate');
      if (sound) {
        for (let i = 0; i < earned; i++) {
          const step = i + 1;
          timers.push(window.setTimeout(() => core.sfx('star', { step }), STAR_FIRST_MS + i * STAR_STEP_MS + 150));
        }
      }
    }
    set(count, opts ? opts.animate : false);
    return { el: node, set };
  }

  // ───────────────────────────── toggle ─────────────────────────────

  function toggle(opts: ToggleOptions): Toggle {
    let checked = opts.checked === true;
    let iconEl: HTMLElement | null = null;
    const labelEl = el('span', { class: 'k-toggle__label', text: opts.label });
    // A <button> is never the flex container itself (unreliable before Chrome 83): one wrapper inside.
    const row = el('span', { class: 'k-toggle__in' }, labelEl, el('span', { class: 'k-switch', 'aria-hidden': 'true' }, el('span', { class: 'k-switch__knob' })));
    const node = el('button', { type: 'button', class: 'k-toggle', role: 'switch' }, row);
    function render(): void {
      node.classList.toggle('k-on', checked);
      node.setAttribute('aria-checked', checked ? 'true' : 'false');
    }
    function setIcon(icon: IconName | null): void {
      if (iconEl && iconEl.parentNode) iconEl.parentNode.removeChild(iconEl);
      iconEl = null;
      if (icon) {
        iconEl = core.icon(icon, 28);
        iconEl.classList.add('k-toggle__icon');
        row.insertBefore(iconEl, row.firstChild);
      }
    }
    if (opts.icon) setIcon(opts.icon);
    node.disabled = opts.disabled === true;
    render();
    core.pressable(node);
    node.addEventListener('click', () => {
      if (node.disabled) return;
      checked = !checked;
      render();
      core.tap();
      try {
        opts.onChange(checked);
      } catch (err) {
        if (typeof console !== 'undefined') console.error('[kit] toggle handler failed', err);
      }
    });
    return {
      el: node,
      get: () => checked,
      set(value: boolean): void {
        checked = value === true;
        render();
      },
      setIcon,
      setLabel(label: string): void {
        labelEl.textContent = label;
      },
      setDisabled(disabled: boolean): void {
        node.disabled = disabled === true;
      },
    };
  }

  // ───────────────────────────── segmented ─────────────────────────────

  function segmented<V extends string>(items: readonly SegmentedItem<V>[], opts: SegmentedOptions<V>): Segmented<V> {
    let value = opts.value;
    const thumb = el('span', { class: 'k-seg__thumb', 'aria-hidden': 'true' });
    const node = el('div', { class: 'k-seg', role: 'radiogroup', 'aria-label': opts.ariaLabel, style: { '--k-n': String(items.length || 1) } }, thumb);
    const buttons: HTMLButtonElement[] = [];

    function render(): void {
      let index = 0;
      for (let i = 0; i < items.length; i++) {
        const on = items[i]!.value === value;
        if (on) index = i;
        const b = buttons[i]!;
        b.classList.toggle('k-on', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
      }
      node.style.setProperty('--k-i', String(index));
    }

    function choose(next: V, focus: boolean): void {
      if (next === value) return;
      value = next;
      render();
      core.tap();
      if (focus) {
        for (let i = 0; i < items.length; i++) if (items[i]!.value === value) buttons[i]!.focus();
      }
      try {
        opts.onChange(value);
      } catch (err) {
        if (typeof console !== 'undefined') console.error('[kit] segmented handler failed', err);
      }
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      const b = el(
        'button',
        { type: 'button', class: 'k-seg__opt', role: 'radio', 'aria-label': item.ariaLabel },
        el('span', { class: 'k-seg__in' }, item.icon ? core.icon(item.icon, 24) : null, item.label ? el('span', { text: item.label }) : null),
      );
      b.addEventListener('click', () => choose(item.value, false));
      b.addEventListener('keydown', (ev: KeyboardEvent) => {
        // arrow keys move the selection; "forward" follows the reading direction
        const rtl = core.i18n.isRtl();
        let step = 0;
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') step = ev.key === 'ArrowRight' && rtl ? -1 : 1;
        else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') step = ev.key === 'ArrowLeft' && rtl ? 1 : -1;
        if (!step) return;
        ev.preventDefault();
        const next = items[(i + step + items.length) % items.length];
        if (next) choose(next.value, true);
      });
      buttons.push(b);
      node.appendChild(b);
    }
    render();
    return {
      el: node,
      get: () => value,
      set(next: V): void {
        value = next;
        render();
      },
    };
  }

  // ───────────────────────────── number tween ─────────────────────────────

  const tweens = new WeakMap<Element, () => void>();

  function tweenNumber(node: Element, from: number, to: number, ms: number, format?: (n: number) => string): Promise<void> {
    const show = format || core.i18n.num;
    const previous = tweens.get(node);
    if (previous) previous();
    if (!(ms > 0) || from === to || core.reducedMotion()) {
      node.textContent = show(to);
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const start = now();
      let raf = 0;
      let timer = 0;
      let done = false;
      const stop = (final: boolean): void => {
        if (done) return;
        done = true;
        cancelAnimationFrame(raf);
        window.clearTimeout(timer);
        if (tweens.get(node) === cancel) tweens.delete(node);
        if (final) node.textContent = show(to);
        resolve();
      };
      const cancel = (): void => stop(false);
      const frame = (): void => {
        const k = clamp01((now() - start) / ms);
        if (k >= 1) {
          stop(true);
          return;
        }
        const eased = 1 - Math.pow(1 - k, 3);
        node.textContent = show(Math.round(from + (to - from) * eased));
        raf = requestAnimationFrame(frame);
      };
      tweens.set(node, cancel);
      node.textContent = show(from);
      raf = requestAnimationFrame(frame);
      // frames stop while the page is hidden; never leave the caller waiting
      timer = window.setTimeout(() => stop(true), ms + 250);
    });
  }

  // ───────────────────────────── countdown ─────────────────────────────

  function countdown(opts: CountdownOptions): Countdown {
    const show = opts.format || core.i18n.clock;
    const clock = el('span', { class: 'k-num' });
    const node = el(
      'span',
      { class: 'k-countdown' + (opts.className ? ' ' + opts.className : '') },
      opts.icon ? core.icon(opts.icon, 20) : null,
      opts.label ? el('span', { class: 'k-countdown__label', text: opts.label }) : null,
      clock,
    );
    let timer = 0;
    let wasConnected = false;
    let finished = false;
    const left = (): number => {
      const ms = opts.remaining ? opts.remaining() : (opts.until || 0) - Date.now();
      return ms > 0 ? ms : 0;
    };
    function stop(): void {
      if (timer) window.clearInterval(timer);
      timer = 0;
    }
    function tick(): void {
      if (node.isConnected) wasConnected = true;
      else if (wasConnected) {
        stop(); // the element left the document: nothing left to update
        return;
      }
      const ms = left();
      const text = show(ms);
      if (clock.textContent !== text) clock.textContent = text;
      if (ms <= 0 && !finished) {
        finished = true;
        stop();
        if (opts.onDone) {
          try {
            opts.onDone();
          } catch (err) {
            if (typeof console !== 'undefined') console.error('[kit] countdown onDone failed', err);
          }
        }
      }
    }
    clock.textContent = show(left());
    timer = window.setInterval(tick, 250);
    return { el: node, stop };
  }

  // ───────────────────────────── static containers ─────────────────────────────

  return {
    chip,
    progress,
    starRow,
    toggle,
    segmented,
    tweenNumber,
    countdown,

    screen: (className?: string) => el('div', { class: 'k-screen' + (className ? ' ' + className : '') }),

    panel(className?: string | null, ...children: Child[]): HTMLDivElement {
      return el('div', { class: 'k-panel' + (className ? ' ' + className : '') }, el('div', { class: 'k-panel__inner' }, children));
    },

    title(text: string, size?: 'sm' | 'md' | 'lg'): HTMLHeadingElement {
      return el('h2', { class: 'k-title' + (size && size !== 'md' ? ' k-title--' + size : ''), text });
    },

    text(text: string, className?: string): HTMLParagraphElement {
      return el('p', { class: 'k-text' + (className ? ' ' + className : ''), text });
    },

    rule: () => el('div', { class: 'k-rule', 'aria-hidden': 'true' }, el('i')),

    spinner: () => el('span', { class: 'k-spinner', role: 'status' }),
  };
}
