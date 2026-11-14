import { describe, expect, it } from 'vitest';
import { NO_FLAGS, decodeSaveParam, parseQuery, readFlags } from '../../src/ui/flags.ts';

const atob = (s: string): string => Buffer.from(s, 'base64').toString('binary');
const b64 = (s: string): string => Buffer.from(s, 'utf8').toString('base64');

describe('debug flags', () => {
  it('parses a query string', () => {
    expect(parseQuery('?a=1&b=two%20words&c')).toEqual({ a: '1', b: 'two words', c: '' });
    expect(parseQuery('')).toEqual({});
    expect(parseQuery('?x=%E0%A4%A')).toEqual({}); // malformed escape: skipped
    expect(parseQuery('a=1&a=2')).toEqual({ a: '2' });
  });

  it('are all off outside dev unless ?debug=1 is given', () => {
    expect(readFlags('?lang=ar&mocklevels=120&gate=off&screen=map', false, atob)).toEqual(NO_FLAGS);
    const on = readFlags('?debug=1&lang=ar&mocklevels=120&gate=off&screen=map&still=1', false, atob);
    expect(on).toEqual({ debug: true, lang: 'ar', mockLevels: 120, save: null, gateOff: true, screen: 'map', still: true });
    expect(readFlags('', true, atob).debug).toBe(true);
  });

  it('ignore nonsense values', () => {
    const f = readFlags('?lang=fr&mocklevels=-3&screen=shop&save=!!!', true, atob);
    expect(f.lang).toBe(null);
    expect(f.mockLevels).toBe(0);
    expect(f.screen).toBe(null);
    expect(f.save).toBe(null);
    expect(readFlags('?mocklevels=99999', true, atob).mockLevels).toBe(0);
  });

  it('decode a save from base64 (standard and URL-safe), UTF-8 included', () => {
    const json = JSON.stringify({ version: 1, coins: 42, note: 'زمرد' });
    expect(decodeSaveParam(b64(json), atob)).toBe(json);
    const urlSafe = b64(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(decodeSaveParam(urlSafe, atob)).toBe(json);
    expect(decodeSaveParam(b64('[1,2]'), atob)).toBe(null);
    expect(decodeSaveParam(b64('not json'), atob)).toBe(null);
    expect(decodeSaveParam('', atob)).toBe(null);
    expect(readFlags('?save=' + encodeURIComponent(b64(json)), true, atob).save).toBe(json);
  });
});
