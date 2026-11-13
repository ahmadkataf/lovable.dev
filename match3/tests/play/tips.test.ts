import { describe, expect, it } from 'vitest';
import table from '../../src/i18n/strings/play.ts';
import { FINALE_KEY, PRAISE_KEYS } from '../../src/play/feedback.ts';
import { TIP_IDS, isTipId, tipSeenKey } from '../../src/play/tutorial.ts';

describe('tutorial tips', () => {
  it('cover every mechanic the levels introduce', () => {
    expect([...TIP_IDS].sort()).toEqual(['beam', 'chain', 'collect', 'combo', 'lamp', 'match', 'nova', 'prism', 'sand', 'sand2', 'stone', 'vine']);
  });
  it('have a title and a text in both languages', () => {
    for (const id of TIP_IDS) {
      for (const lang of ['en', 'ar'] as const) {
        expect(table[lang]['play.tut.' + id + '.title'], id + ' title ' + lang).toBeTruthy();
        expect(table[lang]['play.tut.' + id + '.text'], id + ' text ' + lang).toBeTruthy();
      }
    }
  });
  it('are remembered under tut.<id>', () => {
    expect(tipSeenKey('beam')).toBe('tut.beam');
    expect(isTipId('beam')).toBe(true);
    expect(isTipId('nope')).toBe(false);
    expect(isTipId(undefined)).toBe(false);
  });
});

describe('praise words', () => {
  it('exist in both languages, four tiers plus the finale phrase, all different', () => {
    for (const lang of ['en', 'ar'] as const) {
      const words = [...PRAISE_KEYS, FINALE_KEY].map((k) => table[lang][k]);
      for (const w of words) expect(w).toBeTruthy();
      expect(new Set(words).size).toBe(5);
    }
  });
  it('are the closed list of the strategy document', () => {
    expect(PRAISE_KEYS.map((k) => table.en[k])).toEqual(['Sparkling!', 'Radiant!', 'Dazzling!', 'Splendour!']);
    expect(table.en[FINALE_KEY]).toBe('Oasis Glow!');
  });
});
