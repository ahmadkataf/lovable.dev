/**
 * Test doubles for the shell's own screenshots and end-to-end tests (loaded on demand, only with
 * the debug flags): a generated level list of any length and a simulated store.
 */
import type { ChapterTheme } from '../../art/types.ts';
import type { Goal, LevelDef } from '../../engine/types.ts';
import type { AdPlacement, ProductDef, ProductId, PurchaseOutcome, RewardedOutcome, StoreApi } from '../../monetize/types.ts';
import type { ProfileApi } from '../../state/types.ts';
import type { ChapterInfo, World } from '../types.ts';

const THEMES: readonly ChapterTheme[] = ['oasis', 'dunes', 'bazaar', 'palace', 'caverns', 'stars'];

/** `count` playable levels in 6 chapters (the last chapter takes the remainder). */
export function mockWorld(count: number): World {
  const n = Math.max(1, Math.floor(count));
  const row = '........';
  const board = [row, row, row, row, row, row, row, row];
  const levels: LevelDef[] = [];
  for (let id = 1; id <= n; id++) {
    const kind = id % 5;
    const goals: Goal[] =
      kind === 0
        ? [{ kind: 'sand' }]
        : kind === 1
          ? [{ kind: 'score', target: 1500 + id * 40 }]
          : kind === 2
            ? [
                { kind: 'color', color: ((id % 6) as 0 | 1 | 2 | 3 | 4 | 5), target: 12 + (id % 9) },
                { kind: 'color', color: (((id + 2) % 6) as 0 | 1 | 2 | 3 | 4 | 5), target: 10 },
              ]
            : kind === 3
              ? [{ kind: 'color', color: ((id % 6) as 0 | 1 | 2 | 3 | 4 | 5), target: 20 }, { kind: 'sand' }]
              : [{ kind: 'score', target: 2500 }];
    const level: LevelDef = {
      id,
      cols: 8,
      rows: 8,
      colors: 5,
      moves: 18 + (id % 10),
      pieces: board,
      goals,
      stars: [1500, 3000, 4500],
    };
    if (goals.some((g) => g.kind === 'sand')) level.floor = board.map(() => '00111100');
    if (id % 10 === 8 || id % 20 === 15) level.hard = true;
    levels.push(level);
  }
  const chapters: ChapterInfo[] = [];
  const per = Math.max(1, Math.ceil(n / THEMES.length));
  for (let i = 0, from = 1; i < THEMES.length && from <= n; i++, from += per) {
    const theme = THEMES[i]!;
    chapters.push({ index: i, theme, nameKey: 'chapter.' + theme, from, to: Math.min(n, from + per - 1) });
  }
  return { levels, chapters };
}

const CATALOGUE: readonly { def: ProductDef; price: string }[] = [
  { def: { id: 'coins_small', kind: 'consumable', grants: [{ kind: 'coins', amount: 1000 }], removesAds: false }, price: 'US$0.99' },
  { def: { id: 'coins_medium', kind: 'consumable', grants: [{ kind: 'coins', amount: 5500 }], removesAds: false }, price: 'US$4.99' },
  { def: { id: 'coins_large', kind: 'consumable', grants: [{ kind: 'coins', amount: 12000 }], removesAds: false, badge: 'popular' }, price: 'US$9.99' },
  { def: { id: 'coins_xl', kind: 'consumable', grants: [{ kind: 'coins', amount: 26000 }], removesAds: false }, price: 'US$19.99' },
  { def: { id: 'coins_mega', kind: 'consumable', grants: [{ kind: 'coins', amount: 70000 }], removesAds: false, badge: 'best' }, price: 'US$49.99' },
  {
    def: {
      id: 'starter_pack',
      kind: 'entitlement',
      grants: [
        { kind: 'coins', amount: 4000 },
        { kind: 'booster', id: 'hammer', amount: 3 },
        { kind: 'booster', id: 'freeSwap', amount: 3 },
        { kind: 'booster', id: 'prism', amount: 2 },
      ],
      removesAds: true,
    },
    price: 'US$1.99',
  },
  { def: { id: 'remove_ads', kind: 'entitlement', grants: [], removesAds: true }, price: 'US$2.99' },
];

export interface MockStore extends StoreApi {
  /** What the next buy() resolves with (default 'purchased'); resets after one use. */
  nextOutcome: PurchaseOutcome | null;
  /** What the next showRewarded() resolves with (default 'earned'); resets after one use. */
  nextAd: RewardedOutcome | null;
  /** Switch a part of the store on or off and notify listeners. */
  set(patch: { iap?: boolean; ads?: boolean; rewarded?: boolean; consent?: boolean }): void;
  /** Calls made, for assertions. */
  readonly log: string[];
}

/** A store that "sells" instantly and grants through the profile — never used outside tests. */
export function createMockStore(profile: ProfileApi): MockStore {
  const listeners: (() => void)[] = [];
  const owned: Record<string, true> = Object.create(null);
  const state = { iap: true, ads: true, rewarded: true, consent: true };
  let coinAdsLeft = 3;
  let lifeAdsLeft = 3;
  const log: string[] = [];

  function notify(): void {
    for (const fn of listeners.slice()) fn();
  }

  function wait<T>(value: T, ms: number): Promise<T> {
    return new Promise((resolve) => setTimeout(() => resolve(value), ms));
  }

  const store: MockStore & { rewardedLeft(p: AdPlacement): number } = {
    nextOutcome: null,
    nextAd: null,
    log,

    set(patch): void {
      if (patch.iap !== undefined) state.iap = patch.iap;
      if (patch.ads !== undefined) state.ads = patch.ads;
      if (patch.rewarded !== undefined) state.rewarded = patch.rewarded;
      if (patch.consent !== undefined) state.consent = patch.consent;
      notify();
    },

    iapAvailable: () => state.iap,
    products: () => (state.iap ? CATALOGUE.map((p) => ({ def: p.def, info: { id: p.def.id, price: p.price } })) : []),

    buy(id: ProductId): Promise<PurchaseOutcome> {
      log.push('buy:' + id);
      const entry = CATALOGUE.filter((p) => p.def.id === id)[0];
      if (!state.iap || !entry) return wait<PurchaseOutcome>('unavailable', 120);
      if (entry.def.kind === 'entitlement' && owned[id]) return wait<PurchaseOutcome>('alreadyOwned', 120);
      const outcome = store.nextOutcome || 'purchased';
      store.nextOutcome = null;
      return wait(outcome, 260).then((result) => {
        if (result === 'purchased') {
          profile.grant(entry.def.grants);
          if (entry.def.kind === 'entitlement') owned[id] = true;
          notify();
        }
        return result;
      });
    },

    restore(): Promise<number> {
      log.push('restore');
      return wait(Object.keys(owned).length, 200);
    },

    owns: (id: ProductId) => owned[id] === true,

    adsAvailable: () => state.ads,
    rewardedReady: () => state.ads && state.rewarded,
    freeCoinAdsLeft: () => coinAdsLeft,
    rewardedLeft: (placement: AdPlacement) => (placement === 'freeCoins' ? coinAdsLeft : placement === 'freeLife' ? lifeAdsLeft : 99),

    showRewarded(placement: AdPlacement): Promise<RewardedOutcome> {
      log.push('ad:' + placement);
      if (!state.ads || !state.rewarded) return wait<RewardedOutcome>('unavailable', 100);
      const outcome = store.nextAd || 'earned';
      store.nextAd = null;
      return wait(outcome, 300).then((result) => {
        if (result === 'earned') {
          if (placement === 'freeCoins') coinAdsLeft = Math.max(0, coinAdsLeft - 1);
          if (placement === 'freeLife') lifeAdsLeft = Math.max(0, lifeAdsLeft - 1);
          notify();
        }
        return result;
      });
    },

    maybeShowInterstitial: () => Promise.resolve(false),
    privacyOptionsRequired: () => state.ads && state.consent,
    showPrivacyOptions(): Promise<void> {
      log.push('privacy-options');
      return wait(undefined, 100);
    },

    onChange(listener: () => void): () => void {
      listeners.push(listener);
      return () => {
        const i = listeners.indexOf(listener);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
  };
  return store;
}
