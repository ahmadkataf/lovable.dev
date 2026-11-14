import { describe, expect, it } from 'vitest';
import type { Goal, LevelDef } from '../../src/engine/types.ts';
import { createI18nFromTables } from '../../src/i18n/index.ts';
import common from '../../src/i18n/strings/common.ts';
import meta from '../../src/i18n/strings/meta.ts';
import type { AdPlacement, ProductDef, StoreApi } from '../../src/monetize/types.ts';
import {
  SHOP_BOOSTER_IDS,
  START_BOOSTER_IDS,
  boosterIcon,
  boosterList,
  coinPackArt,
  coinsIn,
  compactNumber,
  focusLevel,
  goalIcon,
  goalText,
  levelById,
  mergeBoosters,
  nodeState,
  rewardView,
  rewardedLeft,
  splitProducts,
} from '../../src/ui/helpers.ts';
import { ALL_BOOSTERS } from '../../src/state/types.ts';
import { backdropScale, BACKDROP_MAX_PIXELS } from '../../src/ui/screens/backdrop.ts';

const en = createI18nFromTables([common, meta], 'en');
const ar = createI18nFromTables([common, meta], 'ar');

const GOALS: Goal[] = [
  { kind: 'score', target: 1500 },
  { kind: 'color', color: 2, target: 15 },
  { kind: 'sand' },
  { kind: 'lamp', target: 3 },
  { kind: 'stone' },
  { kind: 'vine' },
  { kind: 'chain' },
];

describe('goals', () => {
  it('every goal kind has an icon and a sentence in both languages', () => {
    for (const goal of GOALS) {
      expect(typeof goalIcon(goal)).toBe('string');
      for (const i18n of [en, ar]) {
        const text = goalText(i18n.t, goal);
        expect(text.length).toBeGreaterThan(3);
        expect(/[{}]|goal\./.test(text)).toBe(false);
      }
    }
    expect(goalIcon({ kind: 'color', color: 4, target: 9 })).toBe('gem4');
    expect(goalText(en.t, { kind: 'color', color: 2, target: 15 })).toBe('Collect 15 Emerald gems');
    expect(goalText(en.t, { kind: 'score', target: 1500 })).toBe('Reach 1,500 points');
    expect(goalText(ar.t, { kind: 'sand' })).toBe('أزل كل الرمال');
  });
});

describe('map nodes', () => {
  it('a level is done, current, open or locked', () => {
    expect(nodeState(3, 5, 2)).toBe('done');
    expect(nodeState(5, 5, 0)).toBe('current');
    expect(nodeState(6, 5, 0)).toBe('locked');
    expect(nodeState(120, 120, 3)).toBe('done'); // the journey is finished: no current node
    // a damaged save can hold a playable level below the frontier that was never won: it is open,
    // and there is still exactly one current level
    expect(nodeState(4, 5, 0)).toBe('open');
    const states = [1, 2, 3, 4, 5, 6, 7].map((id) => nodeState(id, 5, id === 2 ? 3 : 0));
    expect(states).toEqual(['open', 'done', 'open', 'open', 'current', 'locked', 'locked']);
  });

  it('the focus level stays inside the level list', () => {
    expect(focusLevel(1, 120)).toBe(1);
    expect(focusLevel(47, 120)).toBe(47);
    expect(focusLevel(500, 120)).toBe(120);
    expect(focusLevel(0, 120)).toBe(1);
    expect(focusLevel(NaN, 120)).toBe(1);
    expect(focusLevel(3, 0)).toBe(1);
  });
});

describe('boosters', () => {
  it('the shop lists all six boosters once, the intro the three start boosters', () => {
    expect(SHOP_BOOSTER_IDS.slice().sort()).toEqual(ALL_BOOSTERS.slice().sort());
    expect(START_BOOSTER_IDS.slice().sort()).toEqual(['beamNova', 'extraMoves', 'prism']);
    expect(boosterIcon('prism')).toBe('prismBooster');
    expect(boosterIcon('hammer')).toBe('hammer');
  });

  it('merges the chosen boosters with the Caravan gift', () => {
    expect(mergeBoosters({ prism: true }, { beamNova: true })).toEqual({ prism: true, beamNova: true });
    expect(mergeBoosters({ prism: true }, { prism: true })).toEqual({ prism: true });
    expect(mergeBoosters(null, undefined)).toEqual({});
    expect(mergeBoosters({ extraMoves: false }, {})).toEqual({});
    expect(boosterList({ extraMoves: true, beamNova: true })).toEqual(['beamNova', 'extraMoves']);
    expect(boosterList(null)).toEqual([]);
  });
});

describe('rewards', () => {
  it('describes coins, boosters and lives', () => {
    expect(rewardView(en.t, en.num, { kind: 'coins', amount: 1500 })).toEqual({ icon: 'coin', amount: '1,500', text: '1,500 coins' });
    expect(rewardView(en.t, en.num, { kind: 'booster', id: 'hammer', amount: 3 })).toEqual({ icon: 'hammer', amount: '×3', text: '3 × Hammer' });
    expect(rewardView(en.t, en.num, { kind: 'booster', id: 'prism', amount: 1 }).text).toBe('Prism');
    expect(rewardView(en.t, en.num, { kind: 'lives' }).icon).toBe('heart');
    expect(rewardView(en.t, en.num, { kind: 'lives', amount: 1 }).amount).toBe('+1');
    expect(rewardView(ar.t, ar.num, { kind: 'coins', amount: 100 }).text).toBe('100 عملة');
  });

  it('sorts the store catalogue into packs and offers', () => {
    const def = (id: ProductDef['id'], coins: number, kind: ProductDef['kind'] = 'consumable'): { def: ProductDef } => ({
      def: { id, kind, grants: coins > 0 ? [{ kind: 'coins', amount: coins }] : [], removesAds: kind === 'entitlement' },
    });
    const split = splitProducts([def('coins_large', 12000), def('remove_ads', 0, 'entitlement'), def('coins_small', 1000), def('starter_pack', 4000, 'entitlement'), def('coins_mega', 70000)]);
    expect(split.packs.map((p) => p.def.id)).toEqual(['coins_small', 'coins_large', 'coins_mega']);
    expect(split.starter && split.starter.def.id).toBe('starter_pack');
    expect(split.removeAds && split.removeAds.def.id).toBe('remove_ads');
    expect(splitProducts([])).toEqual({ packs: [], starter: null, removeAds: null });
    expect(coinsIn([{ kind: 'coins', amount: 5 }, { kind: 'booster', id: 'hammer', amount: 2 }, { kind: 'coins', amount: 7 }])).toBe(12);
    expect([0, 0.25, 0.5, 0.75, 1].map(coinPackArt)).toEqual(['coin', 'coinPile', 'coinPile', 'coinChest', 'coinChest']);
  });
});

describe('ads', () => {
  const base = (left: number): StoreApi =>
    ({
      freeCoinAdsLeft: () => left,
    }) as unknown as StoreApi;

  it('reads the allowance from either store API', () => {
    expect(rewardedLeft(base(2), 'freeCoins')).toBe(2);
    expect(rewardedLeft(base(2), 'freeLife')).toBe(null);
    const extended = { freeCoinAdsLeft: () => 9, rewardedLeft: (p: AdPlacement) => (p === 'freeLife' ? 1 : 3) } as unknown as StoreApi;
    expect(rewardedLeft(extended, 'freeLife')).toBe(1);
    expect(rewardedLeft(extended, 'freeCoins')).toBe(3);
    expect(rewardedLeft(base(-4), 'freeCoins')).toBe(0);
    const broken = {
      freeCoinAdsLeft: () => {
        throw new Error('x');
      },
    } as unknown as StoreApi;
    expect(rewardedLeft(broken, 'freeCoins')).toBe(null);
  });
});

describe('numbers in little room', () => {
  it('writes large counts in short, rounded down', () => {
    const num = en.num;
    expect(compactNumber(0, num)).toBe('0');
    expect(compactNumber(9999, num)).toBe('9,999');
    expect(compactNumber(10000, num)).toBe('10K');
    expect(compactNumber(12850, num)).toBe('12.8K');
    expect(compactNumber(99999, num)).toBe('99.9K');
    expect(compactNumber(100000, num)).toBe('100K');
    expect(compactNumber(987654, num)).toBe('987K');
    expect(compactNumber(999999, num)).toBe('999K');
    expect(compactNumber(1000000, num)).toBe('1M');
    expect(compactNumber(1234567, num)).toBe('1.2M');
    expect(compactNumber(12345678, num)).toBe('12.3M');
    expect(compactNumber(123456789, num)).toBe('123M');
    expect(compactNumber(999999999, num)).toBe('999M');
    expect(compactNumber(-5, num)).toBe('0');
    expect(compactNumber(NaN, num)).toBe('0');
    // never longer than five characters, never more than the real amount
    for (const n of [10000, 54321, 99999, 100000, 555555, 999999, 1000000, 7654321, 99999999, 999999999]) {
      const text = compactNumber(n, num);
      expect(text.length).toBeLessThanOrEqual(5);
      const value = parseFloat(text) * (text.endsWith('M') ? 1e6 : 1e3);
      expect(value).toBeLessThanOrEqual(n);
      expect(value).toBeGreaterThan(n * 0.89);
    }
  });
});

describe('levels', () => {
  it('finds a level by id, wherever it sits in the list', () => {
    const mk = (id: number): LevelDef => ({ id, cols: 8, rows: 8, colors: 4, moves: 10, pieces: [], goals: [], stars: [1, 2, 3] });
    const list = [mk(1), mk(2), mk(3)];
    expect(levelById(list, 2)).toBe(list[1]);
    expect(levelById(list, 4)).toBe(null);
    expect(levelById(list, 0)).toBe(null);
    const shuffled = [mk(3), mk(1), mk(2)];
    expect(levelById(shuffled, 1)).toBe(shuffled[1]);
  });
});

describe('backdrop resolution', () => {
  it('never exceeds the pixel budget, the device ratio or the cap', () => {
    for (const [w, h, dpr] of [
      [360, 640, 2],
      [412, 915, 2.625],
      [800, 1280, 2],
      [1280, 800, 1],
      [320, 480, 3],
    ] as const) {
      const s = backdropScale(w, h, dpr);
      expect(s).toBeLessThanOrEqual(dpr);
      expect(s).toBeLessThanOrEqual(2);
      expect(w * h * s * s).toBeLessThanOrEqual(BACKDROP_MAX_PIXELS * 1.001);
      expect(backdropScale(w, h, dpr, 1.5)).toBeLessThanOrEqual(1.5);
    }
    expect(backdropScale(360, 640, 0)).toBe(1);
    expect(backdropScale(4000, 4000, 2)).toBe(0.5);
  });
});
