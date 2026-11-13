import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  APP_VERSION_CODE,
  APP_VERSION_NAME,
  SAVE_KEY,
  createPlatform,
  normalizeLocale,
  parseAndroidInfo,
} from '../../src/platform/index.ts';
import type { AndroidBridge, HapticKind, NativeHooks } from '../../src/platform/types.ts';

// ───────────────────────────── fakes ─────────────────────────────

type Handler = (event: Record<string, unknown>) => void;

interface FakeWindowOptions {
  language?: string | undefined;
  languages?: string[];
  hidden?: boolean;
  vibrate?: ((pattern: number | number[]) => boolean) | null;
  /** What happens when localStorage is touched. */
  storage?: 'ok' | 'missing' | 'throwsOnAccess' | 'throwsOnRead' | 'throwsOnWrite';
  bridge?: Partial<AndroidBridge> | null;
  native?: Record<string, unknown>;
}

interface FakeWindow {
  win: Record<string, unknown>;
  store: Map<string, string>;
  vibrations: (number | number[])[];
  /** Dispatch a window event (keydown …). */
  fire(type: string, event?: Record<string, unknown>): Record<string, unknown>;
  /** Change the page visibility and dispatch visibilitychange. */
  setHidden(hidden: boolean): void;
  hooks(): NativeHooks;
}

function fakeWindow(options: FakeWindowOptions = {}): FakeWindow {
  const store = new Map<string, string>();
  const vibrations: (number | number[])[] = [];
  const winListeners: Record<string, Handler[]> = {};
  const docListeners: Record<string, Handler[]> = {};
  const mode = options.storage ?? 'ok';

  const localStorage = {
    getItem(key: string): string | null {
      if (mode === 'throwsOnRead') throw new Error('SecurityError');
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string): void {
      if (mode === 'throwsOnWrite') throw new Error('QuotaExceededError');
      store.set(key, String(value));
    },
  };

  const document = {
    hidden: options.hidden === true,
    visibilityState: options.hidden === true ? 'hidden' : 'visible',
    addEventListener(type: string, fn: Handler): void {
      (docListeners[type] ||= []).push(fn);
    },
  };

  const navigator: Record<string, unknown> = {};
  if (!('language' in options)) navigator.language = 'en-GB';
  else if (options.language !== undefined) navigator.language = options.language;
  if (options.languages) navigator.languages = options.languages;
  if (options.vibrate !== null) {
    navigator.vibrate =
      options.vibrate ??
      ((pattern: number | number[]): boolean => {
        vibrations.push(pattern);
        return true;
      });
  }

  const win: Record<string, unknown> = {
    document,
    navigator,
    addEventListener(type: string, fn: Handler): void {
      (winListeners[type] ||= []).push(fn);
    },
  };
  if (mode === 'throwsOnAccess') {
    Object.defineProperty(win, 'localStorage', {
      get() {
        throw new Error('SecurityError: storage is disabled');
      },
    });
  } else if (mode !== 'missing') {
    win.localStorage = localStorage;
  }
  if (options.bridge) win.AndroidBridge = options.bridge;
  if (options.native) win.__native = options.native;

  return {
    win,
    store,
    vibrations,
    fire(type, event = {}) {
      for (const fn of winListeners[type] || []) fn(event);
      return event;
    },
    setHidden(hidden) {
      document.hidden = hidden;
      document.visibilityState = hidden ? 'hidden' : 'visible';
      for (const fn of docListeners.visibilitychange || []) fn({});
    },
    hooks: () => win.__native as NativeHooks,
  };
}

function install(options: FakeWindowOptions = {}): FakeWindow {
  const fake = fakeWindow(options);
  vi.stubGlobal('window', fake.win);
  return fake;
}

interface FakeBridge {
  bridge: AndroidBridge;
  calls: { name: string; args: unknown[] }[];
  state: { save: string; info: string };
}

function fakeBridge(initial: { save?: string; info?: string } = {}): FakeBridge {
  const calls: { name: string; args: unknown[] }[] = [];
  const state = {
    save: initial.save ?? '',
    info: initial.info ?? JSON.stringify({ versionName: '2.3.1', versionCode: 17, locale: 'ar-SY' }),
  };
  const bridge: AndroidBridge = {
    loadSave() {
      calls.push({ name: 'loadSave', args: [] });
      return state.save;
    },
    storeSave(json) {
      calls.push({ name: 'storeSave', args: [json] });
      state.save = json;
    },
    haptic(kind) {
      calls.push({ name: 'haptic', args: [kind] });
    },
    setAtRoot(atRoot) {
      calls.push({ name: 'setAtRoot', args: [atRoot] });
    },
    info() {
      calls.push({ name: 'info', args: [] });
      return state.info;
    },
    rate() {
      calls.push({ name: 'rate', args: [] });
    },
  };
  return { bridge, calls, state };
}

function keydown(key: string, extra: Record<string, unknown> = {}): Record<string, unknown> & { prevented: number } {
  const event = {
    key,
    repeat: false,
    prevented: 0,
    preventDefault(): void {
      event.prevented += 1;
    },
    ...extra,
  };
  return event;
}

const ALL_HAPTICS: HapticKind[] = ['light', 'medium', 'heavy', 'success', 'error'];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ───────────────────────────── no window at all (Node) ─────────────────────────────

describe('platform without a window (Node)', () => {
  it('the test environment really has no window or document', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
  });

  it('can be created and every method is safe', () => {
    const p = createPlatform();
    expect(p.info()).toEqual({ versionName: APP_VERSION_NAME, versionCode: APP_VERSION_CODE, locale: 'en-US', platform: 'web' });
    expect(p.loadSave()).toBeNull();
    expect(() => {
      p.storeSave('{"coins":1}');
      for (const kind of ALL_HAPTICS) p.haptic(kind);
      p.setBackHandler(() => true);
      p.setAtRoot(true);
      p.setAtRoot(false);
      p.rateApp();
      p.onPause(() => {});
      p.onResume(() => {});
    }).not.toThrow();
  });

  it('keeps the save in memory for the session', () => {
    const p = createPlatform();
    p.storeSave('first');
    p.storeSave('second');
    expect(p.loadSave()).toBe('second');
    // …but it is not shared with another instance
    expect(createPlatform().loadSave()).toBeNull();
  });
});

// ───────────────────────────── browser ─────────────────────────────

describe('browser platform: info', () => {
  it('reports the web build version and the browser language', () => {
    install({ language: 'ar-SY' });
    expect(createPlatform().info()).toEqual({
      versionName: APP_VERSION_NAME,
      versionCode: APP_VERSION_CODE,
      locale: 'ar-SY',
      platform: 'web',
    });
  });

  it('the version constant matches package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };
    expect(APP_VERSION_NAME).toBe(pkg.version);
    expect(Number.isInteger(APP_VERSION_CODE) && APP_VERSION_CODE >= 1).toBe(true);
  });

  it('normalises the language tag and falls back sensibly', () => {
    install({ language: 'ar_EG' });
    expect(createPlatform().info().locale).toBe('ar-EG');
    install({ language: undefined, languages: ['fr-CA', 'en'] });
    expect(createPlatform().info().locale).toBe('fr-CA');
    install({ language: undefined });
    expect(createPlatform().info().locale).toBe('en-US');
    install({ language: '' });
    expect(createPlatform().info().locale).toBe('en-US');
    install({ language: '<script>' });
    expect(createPlatform().info().locale).toBe('en-US');
  });

  it('follows a language change between calls', () => {
    const fake = install({ language: 'en-US' });
    const p = createPlatform();
    expect(p.info().locale).toBe('en-US');
    (fake.win.navigator as { language: string }).language = 'ar';
    expect(p.info().locale).toBe('ar');
  });

  it('works when the window has no navigator or document', () => {
    vi.stubGlobal('window', {});
    const p = createPlatform();
    expect(p.info().platform).toBe('web');
    expect(p.info().locale).toBe('en-US');
    expect(() => {
      p.haptic('light');
      p.storeSave('x');
      p.setBackHandler(() => false);
    }).not.toThrow();
    expect(p.loadSave()).toBe('x');
  });
});

describe('browser platform: save', () => {
  it('returns null when nothing was saved', () => {
    install();
    expect(createPlatform().loadSave()).toBeNull();
  });

  it('stores under one key and reads it back', () => {
    const fake = install();
    const p = createPlatform();
    p.storeSave('{"coins":5}');
    expect([...fake.store.keys()]).toEqual([SAVE_KEY]);
    expect(fake.store.get(SAVE_KEY)).toBe('{"coins":5}');
    expect(p.loadSave()).toBe('{"coins":5}');
    p.storeSave('{"coins":6}');
    expect([...fake.store.keys()]).toEqual([SAVE_KEY]);
    expect(p.loadSave()).toBe('{"coins":6}');
  });

  it('a new instance (a page reload) reads what the previous one stored', () => {
    const fake = install();
    createPlatform().storeSave('persisted');
    expect(createPlatform().loadSave()).toBe('persisted');
    expect(fake.store.size).toBe(1);
  });

  it('an empty stored value counts as nothing saved', () => {
    const fake = install();
    fake.store.set(SAVE_KEY, '');
    expect(createPlatform().loadSave()).toBeNull();
  });

  it('ignores other keys', () => {
    const fake = install();
    fake.store.set('someone-else', 'data');
    expect(createPlatform().loadSave()).toBeNull();
  });

  for (const storage of ['missing', 'throwsOnAccess', 'throwsOnRead', 'throwsOnWrite'] as const) {
    it(`never throws when localStorage is ${storage}, and still reads back within the session`, () => {
      install({ storage });
      const p = createPlatform();
      expect(() => p.loadSave()).not.toThrow();
      expect(() => p.storeSave('kept in memory')).not.toThrow();
      expect(() => p.storeSave('kept in memory 2')).not.toThrow();
      if (storage !== 'throwsOnRead') expect(p.loadSave()).toBe('kept in memory 2');
      else expect(() => p.loadSave()).not.toThrow();
    });
  }

  it('when a write fails, the newer in-memory value wins over the stale stored one', () => {
    const fake = fakeWindow();
    fake.store.set(SAVE_KEY, 'old');
    let failWrites = false;
    const real = fake.win.localStorage as { getItem(k: string): string | null; setItem(k: string, v: string): void };
    fake.win.localStorage = {
      getItem: (k: string) => real.getItem(k),
      setItem: (k: string, v: string) => {
        if (failWrites) throw new Error('QuotaExceededError');
        real.setItem(k, v);
      },
    };
    vi.stubGlobal('window', fake.win);
    const p = createPlatform();
    expect(p.loadSave()).toBe('old');
    failWrites = true;
    p.storeSave('new');
    expect(p.loadSave()).toBe('new');
    failWrites = false;
    p.storeSave('newer');
    expect(fake.store.get(SAVE_KEY)).toBe('newer');
    expect(p.loadSave()).toBe('newer');
  });

  it('ignores a non-string save', () => {
    const fake = install();
    const p = createPlatform();
    p.storeSave(undefined as unknown as string);
    p.storeSave({} as unknown as string);
    expect(fake.store.size).toBe(0);
    expect(p.loadSave()).toBeNull();
  });
});

describe('browser platform: haptics', () => {
  it('vibrates with a pattern per kind', () => {
    const fake = install();
    const p = createPlatform();
    for (const kind of ALL_HAPTICS) p.haptic(kind);
    expect(fake.vibrations.length).toBe(5);
    for (const pattern of fake.vibrations) {
      const parts = Array.isArray(pattern) ? pattern : [pattern];
      expect(parts.length).toBeGreaterThan(0);
      for (const ms of parts) expect(ms > 0 && ms <= 60).toBe(true);
    }
    // heavier kinds are not shorter than lighter ones
    const [light, medium, heavy] = fake.vibrations as number[];
    expect(light! <= medium! && medium! <= heavy!).toBe(true);
  });

  it('does nothing when vibration is not supported', () => {
    install({ vibrate: null });
    const p = createPlatform();
    expect(() => {
      for (const kind of ALL_HAPTICS) p.haptic(kind);
    }).not.toThrow();
  });

  it('a throwing vibrate does not propagate', () => {
    install({
      vibrate: () => {
        throw new Error('NotAllowedError');
      },
    });
    expect(() => createPlatform().haptic('success')).not.toThrow();
  });

  it('an unknown kind is ignored', () => {
    const fake = install();
    createPlatform().haptic('earthquake' as unknown as HapticKind);
    expect(fake.vibrations).toEqual([]);
  });
});

describe('browser platform: Back (the Escape key)', () => {
  it('Escape calls the back handler; a consumed press is prevented', () => {
    const fake = install();
    const p = createPlatform();
    let presses = 0;
    p.setBackHandler(() => {
      presses++;
      return true;
    });
    const event = fake.fire('keydown', keydown('Escape'));
    expect(presses).toBe(1);
    expect(event.prevented).toBe(1);
  });

  it('a press the handler did not consume is left alone', () => {
    const fake = install();
    const p = createPlatform();
    p.setBackHandler(() => false);
    expect(fake.fire('keydown', keydown('Escape')).prevented).toBe(0);
  });

  it('other keys and auto-repeat are ignored', () => {
    const fake = install();
    const p = createPlatform();
    let presses = 0;
    p.setBackHandler(() => {
      presses++;
      return true;
    });
    for (const key of ['Enter', 'a', ' ', 'Backspace', 'ArrowLeft', 'escape']) fake.fire('keydown', keydown(key));
    fake.fire('keydown', keydown('Escape', { repeat: true }));
    expect(presses).toBe(0);
    fake.fire('keydown', keydown('Esc')); // legacy name
    expect(presses).toBe(1);
  });

  it('without a handler nothing happens', () => {
    const fake = install();
    createPlatform();
    expect(() => fake.fire('keydown', keydown('Escape'))).not.toThrow();
  });

  it('the latest handler replaces the previous one', () => {
    const fake = install();
    const p = createPlatform();
    const calls: string[] = [];
    p.setBackHandler(() => {
      calls.push('old');
      return true;
    });
    p.setBackHandler(() => {
      calls.push('new');
      return true;
    });
    fake.fire('keydown', keydown('Escape'));
    expect(calls).toEqual(['new']);
  });

  it('a throwing handler does not propagate', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fake = install();
    const p = createPlatform();
    p.setBackHandler(() => {
      throw new Error('boom');
    });
    let event: { prevented: number } | undefined;
    expect(() => {
      event = fake.fire('keydown', keydown('Escape')) as unknown as { prevented: number };
    }).not.toThrow();
    expect(event!.prevented).toBe(0);
  });

  it('setAtRoot and rateApp are harmless no-ops', () => {
    install();
    const p = createPlatform();
    expect(() => {
      p.setAtRoot(true);
      p.setAtRoot(false);
      p.rateApp();
    }).not.toThrow();
  });
});

describe('browser platform: pause / resume (page visibility)', () => {
  it('hiding the page pauses, showing it resumes', () => {
    const fake = install();
    const p = createPlatform();
    const log: string[] = [];
    p.onPause(() => log.push('pause'));
    p.onResume(() => log.push('resume'));
    fake.setHidden(true);
    fake.setHidden(false);
    fake.setHidden(true);
    expect(log).toEqual(['pause', 'resume', 'pause']);
  });

  it('repeated events for the same state fire once', () => {
    const fake = install();
    const p = createPlatform();
    const log: string[] = [];
    p.onPause(() => log.push('pause'));
    p.onResume(() => log.push('resume'));
    fake.setHidden(false); // already visible
    fake.setHidden(true);
    fake.setHidden(true);
    fake.setHidden(false);
    fake.setHidden(false);
    expect(log).toEqual(['pause', 'resume']);
  });

  it('a page that starts hidden resumes when it is first shown', () => {
    const fake = install({ hidden: true });
    const p = createPlatform();
    const log: string[] = [];
    p.onPause(() => log.push('pause'));
    p.onResume(() => log.push('resume'));
    fake.setHidden(true);
    expect(log).toEqual([]);
    fake.setHidden(false);
    expect(log).toEqual(['resume']);
  });

  it('several listeners are all called, in order, even if one throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fake = install();
    const p = createPlatform();
    const log: string[] = [];
    p.onPause(() => log.push('a'));
    p.onPause(() => {
      throw new Error('boom');
    });
    p.onPause(() => log.push('c'));
    expect(() => fake.setHidden(true)).not.toThrow();
    expect(log).toEqual(['a', 'c']);
  });
});

// ───────────────────────────── Android ─────────────────────────────

describe('android platform: detection', () => {
  it('is used when window.AndroidBridge exists', () => {
    const b = fakeBridge();
    install({ bridge: b.bridge });
    expect(createPlatform().info().platform).toBe('android');
  });

  it('is not used without the bridge', () => {
    install({ bridge: null });
    expect(createPlatform().info().platform).toBe('web');
    vi.stubGlobal('window', { AndroidBridge: undefined });
    expect(createPlatform().info().platform).toBe('web');
    vi.stubGlobal('window', { AndroidBridge: 'yes' });
    expect(createPlatform().info().platform).toBe('web');
  });
});

describe('android platform: info', () => {
  it('comes from the bridge', () => {
    const b = fakeBridge();
    install({ bridge: b.bridge });
    expect(createPlatform().info()).toEqual({ versionName: '2.3.1', versionCode: 17, locale: 'ar-SY', platform: 'android' });
  });

  it('is asked once and then remembered', () => {
    const b = fakeBridge();
    install({ bridge: b.bridge });
    const p = createPlatform();
    p.info();
    p.info();
    p.info();
    expect(b.calls.filter((c) => c.name === 'info').length).toBe(1);
  });

  it('garbage from the bridge falls back field by field', () => {
    const cases: [string, { versionName: string; versionCode: number; locale: string }][] = [
      ['', { versionName: APP_VERSION_NAME, versionCode: APP_VERSION_CODE, locale: 'en-GB' }],
      ['not json', { versionName: APP_VERSION_NAME, versionCode: APP_VERSION_CODE, locale: 'en-GB' }],
      ['null', { versionName: APP_VERSION_NAME, versionCode: APP_VERSION_CODE, locale: 'en-GB' }],
      ['[1,2]', { versionName: APP_VERSION_NAME, versionCode: APP_VERSION_CODE, locale: 'en-GB' }],
      ['{}', { versionName: APP_VERSION_NAME, versionCode: APP_VERSION_CODE, locale: 'en-GB' }],
      ['{"versionName":"3.0"}', { versionName: '3.0', versionCode: APP_VERSION_CODE, locale: 'en-GB' }],
      ['{"versionName":5,"versionCode":"12","locale":"ar_SA"}', { versionName: APP_VERSION_NAME, versionCode: 12, locale: 'ar-SA' }],
      ['{"versionName":"","versionCode":-4,"locale":""}', { versionName: APP_VERSION_NAME, versionCode: APP_VERSION_CODE, locale: 'en-GB' }],
      ['{"versionName":"1.2","versionCode":7.9,"locale":42}', { versionName: '1.2', versionCode: 7, locale: 'en-GB' }],
      ['{"versionCode":"abc","locale":"not a locale!"}', { versionName: APP_VERSION_NAME, versionCode: APP_VERSION_CODE, locale: 'en-GB' }],
      ['{"versionCode":"","locale":null}', { versionName: APP_VERSION_NAME, versionCode: APP_VERSION_CODE, locale: 'en-GB' }],
      ['{"versionCode":"1e3","versionName":null}', { versionName: APP_VERSION_NAME, versionCode: APP_VERSION_CODE, locale: 'en-GB' }],
      ['{"versionCode":0,"versionName":"0.0.1-debug","locale":"en"}', { versionName: '0.0.1-debug', versionCode: 0, locale: 'en' }],
    ];
    for (const [raw, expected] of cases) {
      const b = fakeBridge({ info: raw });
      install({ bridge: b.bridge, language: 'en-GB' });
      expect(createPlatform().info(), raw).toEqual({ ...expected, platform: 'android' });
    }
  });

  it('a throwing info() falls back, and is retried later', () => {
    const b = fakeBridge();
    let fail = true;
    const real = b.bridge.info;
    b.bridge.info = () => {
      if (fail) throw new Error('bridge down');
      return real();
    };
    install({ bridge: b.bridge, language: 'ar-EG' });
    const p = createPlatform();
    expect(p.info()).toEqual({ versionName: APP_VERSION_NAME, versionCode: APP_VERSION_CODE, locale: 'ar-EG', platform: 'android' });
    fail = false;
    expect(p.info()).toEqual({ versionName: '2.3.1', versionCode: 17, locale: 'ar-SY', platform: 'android' });
  });
});

describe('android platform: save', () => {
  it('"" from the bridge means nothing saved', () => {
    const b = fakeBridge({ save: '' });
    install({ bridge: b.bridge });
    expect(createPlatform().loadSave()).toBeNull();
  });

  it('loads and stores through the bridge', () => {
    const b = fakeBridge({ save: '{"coins":9}' });
    install({ bridge: b.bridge });
    const p = createPlatform();
    expect(p.loadSave()).toBe('{"coins":9}');
    p.storeSave('{"coins":10}');
    expect(b.state.save).toBe('{"coins":10}');
    expect(b.calls.filter((c) => c.name === 'storeSave')).toEqual([{ name: 'storeSave', args: ['{"coins":10}'] }]);
    expect(p.loadSave()).toBe('{"coins":10}');
  });

  it('keeps a mirror copy in the WebView storage', () => {
    const b = fakeBridge();
    const fake = install({ bridge: b.bridge });
    createPlatform().storeSave('{"coins":10}');
    expect(fake.store.get(SAVE_KEY)).toBe('{"coins":10}');
  });

  it('the native save always wins over the mirror', () => {
    const b = fakeBridge({ save: 'native' });
    const fake = install({ bridge: b.bridge });
    fake.store.set(SAVE_KEY, 'mirror');
    expect(createPlatform().loadSave()).toBe('native');
  });

  it('the mirror is used only when the bridge has nothing or fails', () => {
    const empty = fakeBridge({ save: '' });
    const fake = install({ bridge: empty.bridge });
    fake.store.set(SAVE_KEY, 'mirror');
    expect(createPlatform().loadSave()).toBe('mirror');

    const broken = fakeBridge();
    broken.bridge.loadSave = () => {
      throw new Error('bridge down');
    };
    const fake2 = install({ bridge: broken.bridge });
    fake2.store.set(SAVE_KEY, 'mirror');
    expect(createPlatform().loadSave()).toBe('mirror');
  });

  it('a bridge that returns something odd is treated as empty', () => {
    for (const odd of [null, undefined, 42, {}]) {
      const b = fakeBridge();
      b.bridge.loadSave = () => odd as unknown as string;
      install({ bridge: b.bridge });
      expect(createPlatform().loadSave()).toBeNull();
    }
  });

  it('a throwing storeSave does not propagate and the mirror still gets the save', () => {
    const b = fakeBridge();
    b.bridge.storeSave = () => {
      throw new Error('disk full');
    };
    b.bridge.loadSave = () => {
      throw new Error('bridge down');
    };
    const fake = install({ bridge: b.bridge });
    const p = createPlatform();
    expect(() => p.storeSave('precious')).not.toThrow();
    expect(fake.store.get(SAVE_KEY)).toBe('precious');
    expect(p.loadSave()).toBe('precious');
  });

  it('works when the WebView has no DOM storage at all', () => {
    for (const storage of ['missing', 'throwsOnAccess', 'throwsOnWrite', 'throwsOnRead'] as const) {
      const b = fakeBridge();
      install({ bridge: b.bridge, storage });
      const p = createPlatform();
      expect(() => p.storeSave('via bridge')).not.toThrow();
      expect(p.loadSave()).toBe('via bridge');
    }
  });
});

describe('android platform: haptics, root, rating', () => {
  it('passes every haptic kind to the bridge', () => {
    const b = fakeBridge();
    const fake = install({ bridge: b.bridge });
    const p = createPlatform();
    for (const kind of ALL_HAPTICS) p.haptic(kind);
    expect(b.calls.filter((c) => c.name === 'haptic').map((c) => c.args[0])).toEqual(ALL_HAPTICS);
    expect(fake.vibrations).toEqual([]); // not doubled through navigator.vibrate
  });

  it('setAtRoot passes a real boolean', () => {
    const b = fakeBridge();
    install({ bridge: b.bridge });
    const p = createPlatform();
    p.setAtRoot(true);
    p.setAtRoot(false);
    p.setAtRoot(1 as unknown as boolean);
    p.setAtRoot(undefined as unknown as boolean);
    expect(b.calls.filter((c) => c.name === 'setAtRoot').map((c) => c.args[0])).toEqual([true, false, false, false]);
  });

  it('rateApp opens the store page through the bridge', () => {
    const b = fakeBridge();
    install({ bridge: b.bridge });
    createPlatform().rateApp();
    expect(b.calls.filter((c) => c.name === 'rate').length).toBe(1);
  });
});

describe('android platform: native hooks', () => {
  it('registers window.__native with back, pause and resume', () => {
    const b = fakeBridge();
    const fake = install({ bridge: b.bridge });
    createPlatform();
    const hooks = fake.hooks();
    expect(typeof hooks.back).toBe('function');
    expect(typeof hooks.pause).toBe('function');
    expect(typeof hooks.resume).toBe('function');
  });

  it('back() calls the back handler', () => {
    const b = fakeBridge();
    const fake = install({ bridge: b.bridge });
    const p = createPlatform();
    expect(() => fake.hooks().back()).not.toThrow(); // no handler yet
    let presses = 0;
    p.setBackHandler(() => {
      presses++;
      return presses % 2 === 0;
    });
    fake.hooks().back();
    fake.hooks().back();
    expect(presses).toBe(2);
  });

  it('the Escape key is not wired on Android (Back comes from the wrapper)', () => {
    const b = fakeBridge();
    const fake = install({ bridge: b.bridge });
    const p = createPlatform();
    let presses = 0;
    p.setBackHandler(() => {
      presses++;
      return true;
    });
    fake.fire('keydown', keydown('Escape'));
    expect(presses).toBe(0);
  });

  it('pause() and resume() notify the listeners', () => {
    const b = fakeBridge();
    const fake = install({ bridge: b.bridge });
    const p = createPlatform();
    const log: string[] = [];
    p.onPause(() => log.push('pause'));
    p.onResume(() => log.push('resume'));
    fake.hooks().pause();
    fake.hooks().resume();
    expect(log).toEqual(['pause', 'resume']);
  });

  it('the hooks and the page visibility do not double-report', () => {
    const b = fakeBridge();
    const fake = install({ bridge: b.bridge });
    const p = createPlatform();
    const log: string[] = [];
    p.onPause(() => log.push('pause'));
    p.onResume(() => log.push('resume'));
    // going to the background: both sources report, in either order
    fake.hooks().pause();
    fake.setHidden(true);
    fake.hooks().pause();
    // coming back
    fake.setHidden(false);
    fake.hooks().resume();
    expect(log).toEqual(['pause', 'resume']);
    // visibility alone is enough if the wrapper's hook is late or missing
    fake.setHidden(true);
    fake.setHidden(false);
    expect(log).toEqual(['pause', 'resume', 'pause', 'resume']);
  });

  it('hooks registered earlier by another module are kept', () => {
    const b = fakeBridge();
    const store = (): string => 'store hook';
    const fake = install({ bridge: b.bridge, native: { store } });
    createPlatform();
    const hooks = fake.hooks() as NativeHooks & { store?: () => string };
    expect(hooks.store).toBe(store);
    expect(typeof hooks.back).toBe('function');
  });

  it('throwing listeners and handlers never reach the wrapper', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const b = fakeBridge();
    const fake = install({ bridge: b.bridge });
    const p = createPlatform();
    const log: string[] = [];
    p.setBackHandler(() => {
      throw new Error('boom');
    });
    p.onPause(() => {
      throw new Error('boom');
    });
    p.onPause(() => log.push('still called'));
    p.onResume(() => {
      throw new Error('boom');
    });
    expect(() => {
      fake.hooks().back();
      fake.hooks().pause();
      fake.hooks().resume();
    }).not.toThrow();
    expect(log).toEqual(['still called']);
  });
});

describe('android platform: a bridge that throws everywhere', () => {
  function explodingBridge(): AndroidBridge {
    const boom = (): never => {
      throw new Error('Java exception was raised during method invocation');
    };
    return { loadSave: boom, storeSave: boom, haptic: boom, setAtRoot: boom, info: boom, rate: boom };
  }

  it('nothing propagates into the game', () => {
    install({ bridge: explodingBridge(), language: 'ar-SY' });
    let p!: ReturnType<typeof createPlatform>;
    expect(() => {
      p = createPlatform();
    }).not.toThrow();
    expect(() => {
      expect(p.loadSave()).toBeNull();
      p.storeSave('{"coins":1}');
      for (const kind of ALL_HAPTICS) p.haptic(kind);
      p.setAtRoot(true);
      p.setAtRoot(false);
      p.rateApp();
      p.setBackHandler(() => true);
      p.onPause(() => {});
      p.onResume(() => {});
    }).not.toThrow();
    expect(p.info()).toEqual({ versionName: APP_VERSION_NAME, versionCode: APP_VERSION_CODE, locale: 'ar-SY', platform: 'android' });
    // the mirror copy keeps the session's progress readable
    expect(p.loadSave()).toBe('{"coins":1}');
  });

  it('a bridge with missing methods is survivable too', () => {
    install({ bridge: {} as AndroidBridge });
    const p = createPlatform();
    expect(() => {
      p.loadSave();
      p.storeSave('x');
      p.haptic('light');
      p.setAtRoot(true);
      p.rateApp();
      p.info();
    }).not.toThrow();
    expect(p.info().platform).toBe('android');
  });

  it('a window that refuses new properties does not stop creation', () => {
    const b = fakeBridge();
    const fake = fakeWindow({ bridge: b.bridge });
    Object.defineProperty(fake.win, '__native', {
      get() {
        throw new Error('nope');
      },
      set() {
        throw new Error('nope');
      },
    });
    vi.stubGlobal('window', fake.win);
    expect(() => createPlatform()).not.toThrow();
    expect(createPlatform().loadSave()).toBeNull();
  });
});

// ───────────────────────────── pure helpers ─────────────────────────────

describe('normalizeLocale', () => {
  it('accepts language tags and tidies underscores', () => {
    expect(normalizeLocale('ar-SY')).toBe('ar-SY');
    expect(normalizeLocale('ar_SY')).toBe('ar-SY');
    expect(normalizeLocale(' en-US ')).toBe('en-US');
    expect(normalizeLocale('en')).toBe('en');
    expect(normalizeLocale('zh-Hans-CN')).toBe('zh-Hans-CN');
    expect(normalizeLocale('fil')).toBe('fil');
    expect(normalizeLocale('ar-u-nu-latn')).toBe('ar-u-nu-latn');
  });

  it('rejects everything else', () => {
    for (const bad of ['', ' ', 'e', 'english!', 'en US', '<b>', '12', 'en-', '-US', null, undefined, 5, {}, []]) {
      expect(normalizeLocale(bad)).toBeNull();
    }
  });
});

describe('parseAndroidInfo', () => {
  it('reads a complete answer', () => {
    expect(parseAndroidInfo('{"versionName":"1.4.0","versionCode":140,"locale":"ar-SY"}', 'en-US')).toEqual({
      versionName: '1.4.0',
      versionCode: 140,
      locale: 'ar-SY',
      platform: 'android',
    });
  });

  it('never lets the bridge decide the platform field', () => {
    expect(parseAndroidInfo('{"platform":"web","versionName":"9"}', 'en-US').platform).toBe('android');
  });

  it('uses the fallback locale, or en-US when even that is unusable', () => {
    expect(parseAndroidInfo('{}', 'ar_EG').locale).toBe('ar-EG');
    expect(parseAndroidInfo('{}', '???').locale).toBe('en-US');
    expect(parseAndroidInfo(undefined, undefined as unknown as string).locale).toBe('en-US');
  });

  it('ignores absurd values', () => {
    const info = parseAndroidInfo(JSON.stringify({ versionName: 'x'.repeat(500), versionCode: 1e999, locale: 'x'.repeat(50) }), 'en-US');
    expect(info).toEqual({ versionName: APP_VERSION_NAME, versionCode: APP_VERSION_CODE, locale: 'en-US', platform: 'android' });
    expect(parseAndroidInfo('{"versionCode":null}', 'en-US').versionCode).toBe(APP_VERSION_CODE);
  });
});
