/**
 * Hardening: the platform against a hostile or absent Android bridge, a browser whose storage
 * throws (private mode, quota), half-built windows, and native hooks that fire before or after the
 * game has registered its handlers. Nothing may throw; a good save must never be lost to a bad one.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SAVE_KEY, createPlatform, normalizeLocale, parseAndroidInfo } from '../../src/platform/index.ts';
import type { AndroidBridge, HapticKind, NativeHooks, PlatformApi } from '../../src/platform/types.ts';
import { createProfile } from '../../src/state/index.ts';

// ───────────────────────────── a window to break ─────────────────────────────

type Listener = (event: unknown) => void;

interface Lab {
  win: Record<string, unknown>;
  /** What localStorage holds (when it works). */
  disk: Map<string, string>;
  /** Fire a window event. */
  key(event: unknown): void;
  /** Change the page visibility and fire visibilitychange. */
  hide(hidden: boolean): void;
  native(): NativeHooks & Record<string, unknown>;
}

type StorageMode = 'ok' | 'absent' | 'null' | 'getterThrows' | 'readThrows' | 'writeThrows' | 'allThrow' | 'silentlyDrops' | 'returnsJunk' | 'notAnObject';

function lab(options: { storage?: StorageMode; hidden?: boolean; bridge?: unknown; native?: unknown } = {}): Lab {
  const disk = new Map<string, string>();
  const winListeners: Record<string, Listener[]> = {};
  const docListeners: Record<string, Listener[]> = {};
  const mode = options.storage ?? 'ok';
  const boom = (name: string) => (): never => {
    const err = new Error(name);
    err.name = name;
    throw err;
  };
  const storage = {
    getItem: (key: string): unknown => {
      if (mode === 'readThrows' || mode === 'allThrow') return boom('SecurityError')();
      if (mode === 'returnsJunk') return { not: 'a string' };
      return disk.has(key) ? disk.get(key)! : null;
    },
    setItem: (key: string, value: string): void => {
      if (mode === 'writeThrows' || mode === 'allThrow') return boom('QuotaExceededError')();
      if (mode === 'silentlyDrops') return;
      disk.set(key, String(value));
    },
    removeItem: (key: string): void => void disk.delete(key),
  };
  const document = {
    hidden: options.hidden === true,
    visibilityState: options.hidden === true ? 'hidden' : 'visible',
    addEventListener: (type: string, fn: Listener): void => void (docListeners[type] ||= []).push(fn),
  };
  const win: Record<string, unknown> = {
    document,
    navigator: { language: 'ar-SY', vibrate: () => true },
    addEventListener: (type: string, fn: Listener): void => void (winListeners[type] ||= []).push(fn),
  };
  if (mode === 'getterThrows') Object.defineProperty(win, 'localStorage', { get: boom('SecurityError') });
  else if (mode === 'null') win.localStorage = null;
  else if (mode === 'notAnObject') win.localStorage = 'localStorage';
  else if (mode !== 'absent') win.localStorage = storage;
  if ('bridge' in options) win.AndroidBridge = options.bridge;
  if ('native' in options) win.__native = options.native;
  vi.stubGlobal('window', win);
  return {
    win,
    disk,
    key: (event) => (winListeners.keydown || []).forEach((fn) => fn(event)),
    hide: (hidden) => {
      document.hidden = hidden;
      document.visibilityState = hidden ? 'hidden' : 'visible';
      (docListeners.visibilitychange || []).forEach((fn) => fn({}));
    },
    native: () => win.__native as NativeHooks & Record<string, unknown>,
  };
}

const KINDS: HapticKind[] = ['light', 'medium', 'heavy', 'success', 'error'];
const GOOD_SAVE = JSON.stringify({ version: 1, coins: 4321, levels: { '1': { stars: 3, best: 900 } } });

/** Call every method of the API, with ordinary and with hostile arguments. Throws if any call throws. */
function hammerApi(p: PlatformApi): void {
  const anything: unknown[] = [undefined, null, 0, NaN, '', 'x', {}, [], () => true, Symbol('s'), 10n];
  const info = p.info();
  expect(typeof info.versionName).toBe('string');
  expect(Number.isFinite(info.versionCode)).toBe(true);
  expect(normalizeLocale(info.locale)).toBe(info.locale);
  expect(['android', 'web']).toContain(info.platform);
  const loaded = p.loadSave();
  expect(loaded === null || typeof loaded === 'string').toBe(true);
  p.storeSave(GOOD_SAVE);
  p.loadSave();
  for (const kind of KINDS) p.haptic(kind);
  p.setAtRoot(true);
  p.setAtRoot(false);
  p.rateApp();
  p.setBackHandler(() => true);
  p.setBackHandler(() => {
    throw new Error('handler bug');
  });
  p.onPause(() => {
    throw new Error('listener bug');
  });
  p.onResume(() => {
    throw new Error('listener bug');
  });
  for (const junk of anything) {
    p.storeSave(junk as string);
    p.haptic(junk as HapticKind);
    p.setAtRoot(junk as boolean);
    p.setBackHandler(junk as () => boolean);
    p.onPause(junk as () => void);
    p.onResume(junk as () => void);
  }
  p.setBackHandler(() => false);
}

let errors: ReturnType<typeof vi.spyOn>;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function quiet(): void {
  errors = vi.spyOn(console, 'error').mockImplementation(() => {});
}

// ───────────────────────────── hostile bridges ─────────────────────────────

describe('hardening: a hostile Android bridge', () => {
  const thrower = (value: unknown) => (): never => {
    throw value;
  };

  /** Bridges that are objects (so the Android implementation is chosen) but misbehave in every way. */
  function hostileBridges(): [string, unknown][] {
    const methods = ['loadSave', 'storeSave', 'haptic', 'setAtRoot', 'info', 'rate'];
    const all = (make: (name: string) => unknown): Record<string, unknown> => Object.fromEntries(methods.map((m) => [m, make(m)]));
    return [
      ['no methods at all', {}],
      ['an array', []],
      ['methods are not functions', all(() => 'not a function')],
      ['methods are null', all(() => null)],
      ['every method throws an Error', all(() => thrower(new Error('Java exception was raised during method invocation')))],
      ['every method throws a string', all(() => thrower('boom'))],
      ['every method throws null', all(() => thrower(null))],
      ['every method throws undefined', all(() => thrower(undefined))],
      ['every method returns undefined', all(() => () => undefined)],
      ['every method returns null', all(() => () => null)],
      ['every method returns a number', all(() => () => 42)],
      ['every method returns an object', all(() => () => ({ coins: 1 }))],
      ['every method returns a promise', all(() => () => Promise.resolve('{}'))],
      ['every method returns "null"', all(() => () => 'null')],
      ['every method returns "undefined"', all(() => () => 'undefined')],
      ['every method returns HTML', all(() => () => '<html><body>502 Bad Gateway</body></html>')],
      ['every method returns broken JSON', all(() => () => '{"version":1,"coins":')],
      ['every method returns a JSON array', all(() => () => '[1,2,3]')],
      ['every method returns a huge string', all(() => () => 'x'.repeat(2_000_000))],
      ['property access throws', new Proxy({}, { get: thrower(new Error('trap')), has: thrower(new Error('trap')) })],
      ['frozen and empty', Object.freeze({})],
      ['a Date', new Date(0)],
    ];
  }

  it.each(hostileBridges())('%s: nothing throws and every answer is well-formed', (_name, bridge) => {
    quiet();
    const l = lab({ bridge });
    let p!: PlatformApi;
    expect(() => {
      p = createPlatform();
    }).not.toThrow();
    expect(p.info().platform).toBe('android');
    expect(() => hammerApi(p)).not.toThrow();
    // The wrapper's hooks work as well, whatever the bridge does.
    const hooks = l.native();
    expect(() => {
      hooks.back();
      hooks.pause();
      hooks.resume();
      hooks.pause();
      hooks.back();
    }).not.toThrow();
    // The game keeps its save through the mirror copy even though the bridge is useless.
    p.storeSave(GOOD_SAVE);
    expect(l.disk.get(SAVE_KEY)).toBe(GOOD_SAVE);
    expect(createPlatform().loadSave()).toBe(GOOD_SAVE);
  });

  it('a bridge that hands back text that is not a save never beats a readable mirror copy', () => {
    for (const garbage of ['null', 'undefined', '[object Object]', '<html>', '{"version":1,"coins":', '[1,2]', '"text"', '0', 'true', '\u0000', ' ']) {
      const l = lab({ bridge: { loadSave: () => garbage } });
      l.disk.set(SAVE_KEY, GOOD_SAVE);
      expect(createPlatform().loadSave(), JSON.stringify(garbage)).toBe(GOOD_SAVE);
      // Without a mirror the text is handed on as it is (the profile then starts fresh) — or nothing.
      l.disk.clear();
      expect(createPlatform().loadSave(), JSON.stringify(garbage)).toBe(garbage);
      // And an unreadable mirror never beats text from the wrapper.
      l.disk.set(SAVE_KEY, '{broken');
      expect(createPlatform().loadSave(), JSON.stringify(garbage)).toBe(garbage);
    }
  });

  it('a readable save from the wrapper always wins, also in sloppy wrappings', () => {
    const newer = JSON.stringify({ version: 1, coins: 9 });
    for (const wrapped of [newer, '\uFEFF' + newer, JSON.stringify(newer), '  ' + newer + '\n']) {
      const l = lab({ bridge: { loadSave: () => wrapped } });
      l.disk.set(SAVE_KEY, GOOD_SAVE);
      expect(createPlatform().loadSave()).toBe(wrapped);
      // The profile understands every one of these wrappings.
      const profile = createProfile({ load: () => createPlatform().loadSave(), save: () => {}, now: () => 1e12, levelCount: 120 });
      expect(profile.coins()).toBe(9);
    }
  });

  it('whatever a bridge returns from loadSave, a profile can be built on it', () => {
    quiet();
    const answers: unknown[] = [undefined, null, 0, 42, true, {}, [], '', 'null', '{}', '[]', 'x', '{"coins":"many"}', GOOD_SAVE, () => GOOD_SAVE, Symbol('s')];
    for (const answer of answers) {
      let native: unknown = answer;
      lab({ bridge: { loadSave: () => native, storeSave: (json: string) => void (native = json) } });
      const platform = createPlatform();
      const profile = createProfile({ load: platform.loadSave, save: platform.storeSave, now: Date.now, levelCount: 120 });
      expect(profile.coins()).toBe(answer === GOOD_SAVE ? 4321 : 150);
      profile.addCoins(1);
      expect(createPlatform().loadSave()).toContain('"coins":' + (answer === GOOD_SAVE ? 4322 : 151));
    }
  });

  it('only real saves and real haptic kinds are passed to the wrapper', () => {
    const calls: unknown[][] = [];
    const bridge: AndroidBridge = {
      loadSave: () => '',
      storeSave: (json) => void calls.push(['storeSave', json]),
      haptic: (kind) => void calls.push(['haptic', kind]),
      setAtRoot: (atRoot) => void calls.push(['setAtRoot', atRoot]),
      info: () => '{}',
      rate: () => void calls.push(['rate']),
    };
    lab({ bridge });
    const p = createPlatform();
    for (const junk of [undefined, null, 5, {}, [], true, () => 'x']) p.storeSave(junk as unknown as string);
    for (const junk of [undefined, null, '', 'LIGHT', 'constructor', 'toString', '__proto__', 'hasOwnProperty', 7, {}]) p.haptic(junk as HapticKind);
    for (const junk of [undefined, null, 0, 1, 'true', {}, []]) p.setAtRoot(junk as unknown as boolean);
    expect(calls.filter((c) => c[0] === 'storeSave')).toEqual([]);
    expect(calls.filter((c) => c[0] === 'haptic')).toEqual([]);
    expect(calls.filter((c) => c[0] === 'setAtRoot').every((c) => c[1] === false)).toBe(true);
    for (const kind of KINDS) p.haptic(kind);
    p.storeSave('{}');
    p.setAtRoot(true);
    expect(calls.slice(-7)).toEqual([...KINDS.map((k) => ['haptic', k]), ['storeSave', '{}'], ['setAtRoot', true]]);
  });

  it('info(): garbage in, complete AppInfo out — and callers cannot spoil it for each other', () => {
    const answers: unknown[] = [
      undefined, null, 5, {}, [], '', 'x', 'null', '[]', '"s"', '{', '{"versionName":5,"versionCode":"x","locale":7}',
      '{"versionName":"","versionCode":-1,"locale":""}', '{"versionCode":1e999,"locale":"../../etc"}', '{"__proto__":{"platform":"web"},"platform":"web"}',
      JSON.stringify({ versionName: 'v'.repeat(10_000), versionCode: 2 ** 60, locale: 'ar'.repeat(500) }),
    ];
    for (const answer of answers) {
      lab({ bridge: { info: () => answer } });
      const p = createPlatform();
      const info = p.info();
      expect(info.platform).toBe('android');
      expect(info.versionName.length > 0 && info.versionName.length <= 64).toBe(true);
      expect(Number.isSafeInteger(info.versionCode) && info.versionCode >= 0, String(answer).slice(0, 40)).toBe(true);
      expect(normalizeLocale(info.locale)).toBe(info.locale);
      // Mutating what one caller got does not change what the next caller gets.
      const before = JSON.stringify(info);
      info.locale = 'xx';
      info.versionCode = -5;
      (info as unknown as Record<string, unknown>).platform = 'web';
      expect(JSON.stringify(p.info())).toBe(before);
    }
    expect(parseAndroidInfo('{"versionCode":9007199254740993}', 'en').versionCode).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
  });

  it('things that are not a bridge select the browser implementation', () => {
    for (const notABridge of [undefined, null, false, 0, '', 'bridge', 7, true, () => ({}), Symbol('b')]) {
      lab({ bridge: notABridge });
      const p = createPlatform();
      expect(p.info().platform).toBe('web');
      expect(() => hammerApi(p)).not.toThrow();
    }
    // Reading window.AndroidBridge itself may throw.
    const l = lab();
    Object.defineProperty(l.win, 'AndroidBridge', {
      get() {
        throw new Error('denied');
      },
    });
    expect(createPlatform().info().platform).toBe('web');
  });
});

// ───────────────────────────── storage that fails ─────────────────────────────

describe('hardening: localStorage that throws or lies', () => {
  const MODES: StorageMode[] = ['absent', 'null', 'getterThrows', 'readThrows', 'writeThrows', 'allThrow', 'silentlyDrops', 'returnsJunk', 'notAnObject'];

  it.each(MODES)('browser, storage %s: nothing throws and the session still reads back what it wrote', (storage) => {
    quiet();
    lab({ storage });
    let p!: PlatformApi;
    expect(() => {
      p = createPlatform();
    }).not.toThrow();
    expect(() => hammerApi(p)).not.toThrow();
    expect(p.loadSave() === null || typeof p.loadSave() === 'string').toBe(true);
    for (const save of ['{"a":1}', '{"a":2}', '', '{"a":3}']) {
      p.storeSave(save);
      expect(p.loadSave(), storage).toBe(save === '' ? null : save);
    }
  });

  it.each(MODES)('Android, storage %s: the wrapper alone keeps the save', (storage) => {
    quiet();
    let native = '';
    lab({ storage, bridge: { loadSave: () => native, storeSave: (json: string) => void (native = json), info: () => '{}' } });
    const p = createPlatform();
    expect(() => hammerApi(p)).not.toThrow();
    p.storeSave(GOOD_SAVE);
    expect(native).toBe(GOOD_SAVE);
    expect(createPlatform().loadSave()).toBe(GOOD_SAVE);
  });

  it.each(MODES)('a whole profile session works on storage %s', (storage) => {
    quiet();
    lab({ storage });
    const platform = createPlatform();
    const profile = createProfile({ load: platform.loadSave, save: platform.storeSave, now: Date.now, levelCount: 120 });
    profile.addCoins(50);
    profile.buyBooster('hammer');
    profile.recordWin(1, 3, 1000, 2);
    profile.loseLife();
    expect(profile.coins()).toBe(150 + 50 - 90 + 50);
    // The same page can re-create the profile from what the platform holds.
    const again = createProfile({ load: platform.loadSave, save: platform.storeSave, now: Date.now, levelCount: 120 });
    expect(again.coins()).toBe(160);
    expect(again.highestUnlocked()).toBe(2);
  });

  it('a quota that fills up mid-session keeps the newest save in memory and recovers', () => {
    const l = lab();
    let full = false;
    const real = l.win.localStorage as { setItem(k: string, v: string): void };
    const setItem = real.setItem;
    real.setItem = (k, v) => {
      if (full) {
        const err = new Error('The quota has been exceeded.');
        err.name = 'QuotaExceededError';
        throw err;
      }
      setItem(k, v);
    };
    const p = createPlatform();
    p.storeSave('{"n":1}');
    full = true;
    p.storeSave('{"n":2}');
    p.storeSave('{"n":3}');
    expect(p.loadSave()).toBe('{"n":3}'); // newest, although the disk still holds n:1
    expect(l.disk.get(SAVE_KEY)).toBe('{"n":1}');
    full = false;
    p.storeSave('{"n":4}');
    expect(l.disk.get(SAVE_KEY)).toBe('{"n":4}');
    expect(createPlatform().loadSave()).toBe('{"n":4}');
  });

  it('storage that changes its mind between calls is never trusted blindly', () => {
    quiet();
    const l = lab();
    const storage = l.win.localStorage as Record<string, unknown>;
    const p = createPlatform();
    p.storeSave('{"n":1}');
    storage.getItem = () => {
      throw new Error('SecurityError');
    };
    expect(p.loadSave()).toBeNull();
    storage.setItem = () => {
      throw new Error('SecurityError');
    };
    p.storeSave('{"n":2}');
    expect(p.loadSave()).toBe('{"n":2}');
    delete l.win.localStorage;
    p.storeSave('{"n":3}');
    expect(p.loadSave()).toBe('{"n":3}');
  });

  it('half-built windows do not stop creation', () => {
    quiet();
    const builds: ((win: Record<string, unknown>) => void)[] = [
      (win) => delete win.document,
      (win) => delete win.navigator,
      (win) => delete win.addEventListener,
      (win) => (win.document = null),
      (win) => (win.document = 'document'),
      (win) => (win.navigator = null),
      (win) => (win.addEventListener = 'nope'),
      (win) => (win.addEventListener = () => {
        throw new Error('no listeners');
      }),
      (win) => ((win.document as Record<string, unknown>).addEventListener = () => {
        throw new Error('no listeners');
      }),
      (win) => Object.defineProperty(win, 'document', { get: () => { throw new Error('denied'); } }),
      (win) => Object.defineProperty(win, 'navigator', { get: () => { throw new Error('denied'); } }),
      (win) => Object.defineProperty(win.document as object, 'hidden', { get: () => { throw new Error('denied'); } }),
      (win) => Object.defineProperty(win.navigator as object, 'language', { get: () => { throw new Error('denied'); } }),
      (win) => ((win.navigator as Record<string, unknown>).vibrate = () => { throw new Error('NotAllowedError'); }),
      (win) => Object.freeze(win),
    ];
    for (const withBridge of [false, true]) {
      for (const build of builds) {
        const l = withBridge ? lab({ bridge: { loadSave: () => '', storeSave: () => {}, info: () => '{}' } }) : lab();
        build(l.win);
        let p!: PlatformApi;
        expect(() => {
          p = createPlatform();
        }, build.toString()).not.toThrow();
        expect(() => hammerApi(p), build.toString()).not.toThrow();
        expect(p.info().platform).toBe(withBridge ? 'android' : 'web');
      }
    }
  });
});

// ───────────────────────────── hooks before / after handlers ─────────────────────────────

describe('hardening: native hooks and the order things are registered in', () => {
  const bridge = (): Partial<AndroidBridge> => ({ loadSave: () => '', storeSave: () => {}, info: () => '{}', setAtRoot: () => {}, haptic: () => {}, rate: () => {} });

  it('Back before any handler is set does nothing; after, it reaches the latest handler', () => {
    const l = lab({ bridge: bridge() });
    const p = createPlatform();
    const hooks = l.native();
    expect(() => hooks.back()).not.toThrow();
    const log: string[] = [];
    p.setBackHandler(() => {
      log.push('first');
      return true;
    });
    hooks.back();
    p.setBackHandler(() => {
      log.push('second');
      return false;
    });
    hooks.back();
    hooks.back();
    expect(log).toEqual(['first', 'second', 'second']);
    // Clearing the handler (anything that is not a function) makes Back a no-op again.
    p.setBackHandler(null as unknown as () => boolean);
    expect(() => hooks.back()).not.toThrow();
    expect(log).toHaveLength(3);
    // The hook object captured by the wrapper earlier keeps working after handlers change.
    const captured = hooks.back;
    p.setBackHandler(() => log.push('third') > 0);
    captured();
    expect(log[3]).toBe('third');
  });

  it('pause / resume fired before any listener exists are not lost: a late pause listener learns it at once', () => {
    const l = lab({ bridge: bridge() });
    const p = createPlatform();
    const hooks = l.native();
    hooks.pause(); // the wrapper paused while the game was still starting
    const log: string[] = [];
    p.onResume(() => log.push('resume'));
    expect(log).toEqual([]);
    p.onPause(() => log.push('pause A'));
    expect(log).toEqual(['pause A']);
    p.onPause(() => log.push('pause B'));
    expect(log).toEqual(['pause A', 'pause B']);
    hooks.resume();
    expect(log).toEqual(['pause A', 'pause B', 'resume']);
    hooks.pause();
    expect(log).toEqual(['pause A', 'pause B', 'resume', 'pause A', 'pause B']);
  });

  it('a pause and resume that both happened before anyone listened leave no trace', () => {
    const l = lab({ bridge: bridge() });
    const p = createPlatform();
    l.native().pause();
    l.native().resume();
    const log: string[] = [];
    p.onPause(() => log.push('pause'));
    p.onResume(() => log.push('resume'));
    expect(log).toEqual([]);
    l.native().resume(); // a resume without a pause: not a change
    expect(log).toEqual([]);
    l.native().pause();
    l.native().pause();
    expect(log).toEqual(['pause']);
  });

  it('listeners registered before and after a hook fires all take part from then on, in order', () => {
    const l = lab({ bridge: bridge() });
    const p = createPlatform();
    const log: string[] = [];
    p.onPause(() => log.push('p1'));
    p.onResume(() => log.push('r1'));
    l.native().pause();
    l.native().resume();
    p.onPause(() => log.push('p2'));
    p.onResume(() => log.push('r2'));
    l.native().pause();
    l.native().resume();
    expect(log).toEqual(['p1', 'r1', 'p1', 'p2', 'r1', 'r2']);
  });

  it('pause and resume always alternate for every listener, whatever order hooks and visibility arrive in', () => {
    const l = lab({ bridge: bridge() });
    const p = createPlatform();
    const hooks = l.native();
    let seed = 12345;
    const random = (): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const logs: string[][] = [];
    const add = (): void => {
      const log: string[] = [];
      logs.push(log);
      p.onPause(() => log.push('pause'));
      p.onResume(() => log.push('resume'));
    };
    add();
    for (let i = 0; i < 2000; i++) {
      const roll = random();
      if (roll < 0.25) hooks.pause();
      else if (roll < 0.5) hooks.resume();
      else if (roll < 0.7) l.hide(true);
      else if (roll < 0.9) l.hide(false);
      else if (logs.length < 6) add();
    }
    for (const log of logs) {
      expect(log.length).toBeGreaterThan(10);
      for (let i = 1; i < log.length; i++) expect(log[i]).not.toBe(log[i - 1]);
      // A listener that joined while paused hears "pause" first; one that joined while running hears "pause" first too.
      expect(log[0]).toBe('pause');
    }
  });

  it('a listener that reports a change itself does not confuse the others', () => {
    quiet();
    const l = lab({ bridge: bridge() });
    const p = createPlatform();
    const hooks = l.native();
    const log: string[] = [];
    p.onPause(() => {
      log.push('p1');
      hooks.resume(); // e.g. a dialog that immediately brings the app back
    });
    p.onPause(() => log.push('p2'));
    p.onResume(() => log.push('r1'));
    hooks.pause();
    // p1 → (nested) r1; p2 is not told about a pause that is already over.
    expect(log).toEqual(['p1', 'r1']);
    hooks.pause();
    expect(log).toEqual(['p1', 'r1', 'p1', 'r1']);
  });

  it('hooks installed by other modules survive, whether they came before or after', () => {
    const earlier = { store: vi.fn(), custom: 1 };
    const l = lab({ bridge: bridge(), native: earlier });
    const p = createPlatform();
    const log: string[] = [];
    p.setBackHandler(() => log.push('back') > 0);
    p.onPause(() => log.push('pause'));
    expect(l.native()).toBe(earlier); // the same object the other module (and the wrapper) already hold
    expect(l.native().store).toBe(earlier.store);

    // A module that starts later and adds its hook the polite way:
    l.native().later = 'added';
    // …and one that replaces the whole object:
    const replacement = { store: vi.fn(), back: () => log.push('HIJACKED'), extra: 2 };
    l.win.__native = replacement;
    const hooks = l.native();
    hooks.back();
    hooks.pause();
    expect(log).toEqual(['back', 'pause']);
    expect(hooks.store).toBe(replacement.store); // the newcomer's own hook is live
    expect(hooks.extra).toBe(2);
    expect(hooks.later).toBe('added');
    expect(hooks.custom).toBe(1);
    // Junk assignments are ignored.
    for (const junk of [null, undefined, 5, 'x', true]) l.win.__native = junk;
    expect(l.native().back).toBe(hooks.back);
    l.native().back();
    expect(log).toEqual(['back', 'pause', 'back']);
  });

  it('an existing __native that is frozen, or not an object, is replaced without losing its hooks', () => {
    const store = vi.fn();
    const frozen = lab({ bridge: bridge(), native: Object.freeze({ store }) });
    const p = createPlatform();
    const log: string[] = [];
    p.setBackHandler(() => log.push('back') > 0);
    frozen.native().back();
    expect(log).toEqual(['back']);
    expect(frozen.native().store).toBe(store);
    for (const junk of [null, 5, 'hooks', true, () => {}]) {
      const l = lab({ bridge: bridge(), native: junk });
      const platform = createPlatform();
      platform.setBackHandler(() => log.push('again') > 0);
      expect(() => {
        l.native().back();
        l.native().pause();
        l.native().resume();
      }).not.toThrow();
    }
  });

  it('creating the platform twice (hot reload) leaves working hooks for the newest instance', () => {
    const l = lab({ bridge: bridge() });
    const first = createPlatform();
    const second = createPlatform();
    const log: string[] = [];
    first.setBackHandler(() => log.push('first') > 0);
    second.setBackHandler(() => log.push('second') > 0);
    second.onPause(() => log.push('pause'));
    l.native().back();
    l.native().pause();
    expect(log).toEqual(['second', 'pause']);
  });

  it('things that are not functions are never registered as listeners or handlers', () => {
    quiet();
    for (const withBridge of [true, false]) {
      const l = withBridge ? lab({ bridge: bridge() }) : lab();
      const p = createPlatform();
      for (const junk of [undefined, null, 0, 'listener', {}, [], true]) {
        p.onPause(junk as unknown as () => void);
        p.onResume(junk as unknown as () => void);
        p.setBackHandler(junk as unknown as () => boolean);
      }
      const log: string[] = [];
      p.onPause(() => log.push('pause'));
      p.onResume(() => log.push('resume'));
      for (let i = 0; i < 3; i++) {
        l.hide(true);
        l.hide(false);
        if (withBridge) l.native().back();
        else l.key({ key: 'Escape' });
      }
      expect(log).toEqual(['pause', 'resume', 'pause', 'resume', 'pause', 'resume']);
      expect(errors).not.toHaveBeenCalled(); // nothing bogus was called, so nothing failed
    }
  });

  it('throwing handlers and listeners never reach the wrapper, and are reported once each', () => {
    quiet();
    const l = lab({ bridge: bridge() });
    const p = createPlatform();
    p.setBackHandler(() => {
      throw new Error('back bug');
    });
    p.onPause(() => {
      throw 'pause bug';
    });
    p.onResume(() => {
      throw null;
    });
    const hooks = l.native();
    expect(() => {
      hooks.back();
      hooks.pause();
      hooks.resume();
    }).not.toThrow();
    expect(errors).toHaveBeenCalledTimes(3);
    // Even a console that throws cannot make a hook throw.
    errors.mockImplementation(() => {
      throw new Error('console is gone');
    });
    expect(() => {
      hooks.back();
      hooks.pause();
      hooks.resume();
    }).not.toThrow();
  });
});

describe('hardening: Back in a browser (Escape)', () => {
  it('works before and after a handler is set, and with odd events', () => {
    quiet();
    const l = lab();
    const p = createPlatform();
    const event = (extra: Record<string, unknown> = {}): { key: string; prevented: number; preventDefault(): void } & Record<string, unknown> => {
      const e = { key: 'Escape', prevented: 0, preventDefault: () => void (e.prevented += 1), ...extra };
      return e;
    };
    const before = event();
    expect(() => l.key(before)).not.toThrow();
    expect(before.prevented).toBe(0);
    const log: string[] = [];
    p.setBackHandler(() => log.push('back') > 0);
    const consumed = event();
    l.key(consumed);
    expect(consumed.prevented).toBe(1);
    // Events that are not a plain Escape press.
    for (const odd of [undefined, null, {}, 'Escape', 5, { key: 'escape' }, { key: 'Enter' }, { key: 27 }, { key: null }, event({ repeat: true })]) {
      expect(() => l.key(odd)).not.toThrow();
    }
    expect(log).toEqual(['back']);
    // An event that cannot be prevented, or whose preventDefault throws.
    expect(() => l.key({ key: 'Escape' })).not.toThrow();
    expect(() => l.key({ key: 'Esc', preventDefault: () => { throw new Error('passive'); } })).not.toThrow();
    expect(log).toEqual(['back', 'back', 'back']);
    // A handler that answers with something other than `true` has not consumed the press.
    for (const answer of [false, undefined, null, 1, 'yes', {}]) {
      p.setBackHandler(() => answer as boolean);
      const e = event();
      l.key(e);
      expect(e.prevented, String(answer)).toBe(0);
    }
  });

  it('a page opened in the background tells a late pause listener at once', () => {
    const l = lab({ hidden: true });
    const p = createPlatform();
    const log: string[] = [];
    p.onResume(() => log.push('resume'));
    p.onPause(() => log.push('pause'));
    expect(log).toEqual(['pause']);
    l.hide(false);
    l.hide(false);
    expect(log).toEqual(['pause', 'resume']);
  });
});
