/**
 * Debug switches read from the page URL. They only work in a dev server or with `?debug=1`;
 * otherwise every flag keeps its neutral value.
 *
 *   ?debug=1          enable the switches below and `window.__app` in a production build
 *   ?lang=ar|en       start in this language (not saved)
 *   ?mocklevels=120   run on a generated level list of that length (6 chapters)
 *   ?save=<base64>    start from this save (base64 of the JSON; nothing is written to real storage)
 *   ?mockstore=1      the shell's own simulated store (purchases + ads), independent of src/monetize
 *   ?gate=off         every feature and booster counts as unlocked
 *   ?screen=map       open this screen right after boot (title | map)
 *   ?still=1          no ambient animation loops (stable screenshots)
 */
import type { Lang } from '../i18n/types.ts';

export interface Flags {
  debug: boolean;
  lang: Lang | null;
  mockLevels: number;
  /** Decoded save JSON, or null. */
  save: string | null;
  mockStore: boolean;
  gateOff: boolean;
  screen: 'title' | 'map' | null;
  still: boolean;
}

export const NO_FLAGS: Flags = {
  debug: false,
  lang: null,
  mockLevels: 0,
  save: null,
  mockStore: false,
  gateOff: false,
  screen: null,
  still: false,
};

/** "a=1&b=two" → { a: '1', b: 'two' } (later keys win; values are URI-decoded). */
export function parseQuery(search: string): Record<string, string> {
  const out: Record<string, string> = Object.create(null);
  const text = typeof search === 'string' ? search.replace(/^[?#]/, '') : '';
  if (!text) return out;
  for (const part of text.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const rawKey = eq < 0 ? part : part.slice(0, eq);
    const rawValue = eq < 0 ? '' : part.slice(eq + 1);
    try {
      out[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue.replace(/\+/g, ' '));
    } catch {
      // a malformed escape: skip this pair
    }
  }
  return out;
}

/** Decode the ?save= value: base64 (standard or URL-safe) of a UTF-8 JSON object. Null when unusable. */
export function decodeSaveParam(value: string, atobFn: (s: string) => string): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  try {
    let b64 = value.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '+');
    while (b64.length % 4 !== 0) b64 += '=';
    const binary = atobFn(b64);
    let escaped = '';
    for (let i = 0; i < binary.length; i++) {
      const code = binary.charCodeAt(i);
      escaped += '%' + (code < 16 ? '0' : '') + code.toString(16);
    }
    const json = decodeURIComponent(escaped);
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    return json;
  } catch {
    return null;
  }
}

/**
 * Flags for a page URL. `dev` = running under the dev server (import.meta.env.DEV).
 * Without dev and without ?debug=1 the result is NO_FLAGS.
 */
export function readFlags(search: string, dev: boolean, atobFn: (s: string) => string): Flags {
  const q = parseQuery(search);
  const debug = dev || q['debug'] === '1';
  if (!debug) return { ...NO_FLAGS };
  const lang = q['lang'] === 'ar' || q['lang'] === 'en' ? q['lang'] : null;
  const n = Math.floor(Number(q['mocklevels']));
  const screen = q['screen'] === 'map' || q['screen'] === 'title' ? q['screen'] : null;
  return {
    debug: true,
    lang,
    mockLevels: n >= 1 && n <= 2000 ? n : 0,
    save: q['save'] ? decodeSaveParam(q['save'], atobFn) : null,
    mockStore: q['mockstore'] === '1',
    gateOff: q['gate'] === 'off',
    screen,
    still: q['still'] === '1',
  };
}
