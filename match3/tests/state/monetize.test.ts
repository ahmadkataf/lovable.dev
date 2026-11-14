/**
 * The monetisation section of the save (ProfileShop in src/state/extensions.ts): purchase tokens are
 * granted once and remembered, entitlements and the purchased flag stick, ad counters follow the
 * local day — and all of it is repaired when damaged and survives a reset. The rules that USE this
 * storage are tested in tests/monetize.
 */
import { describe, expect, it } from 'vitest';
import { MAX_PURCHASE_TOKENS, createProfile, freshShop, purchaseKey } from '../../src/state/index.ts';
import type { Reward, ShopSave } from '../../src/state/types.ts';
import { DAY, HOUR, MINUTE, T0, fromSave, harness, rng, sampleSave } from './harness.ts';

const TODAY = Math.floor(T0 / DAY);
const PACK: Reward[] = [
  { kind: 'coins', amount: 4000 },
  { kind: 'booster', id: 'hammer', amount: 3 },
];

function withShop(patch: Record<string, unknown>): Record<string, unknown> {
  const save = sampleSave() as unknown as Record<string, unknown>;
  save.shop = { ...(save.shop as object), ...patch };
  return save;
}

function shopOf(patch: Record<string, unknown>): Readonly<ShopSave> {
  return fromSave(withShop(patch)).profile.shop();
}

describe('purchase tokens', () => {
  it('short tokens are remembered verbatim, long ones as a digest of fixed size', () => {
    expect(purchaseKey('GPA.1234-5678-9012-34567')).toBe('GPA.1234-5678-9012-34567');
    expect(purchaseKey('a'.repeat(40))).toBe('a'.repeat(40));
    // The digest is part of the save format: these values must never change.
    expect(purchaseKey('a'.repeat(41))).toBe('#15.5fbf56d45b70ef2de6292e07142f69a7');
    expect(purchaseKey('#abc')).toBe('#4.b343d26fcb6f74e41d0d2d574977f288'); // '#' is reserved for digests
    for (const length of [41, 150, 400, 4096]) expect(purchaseKey('t'.repeat(length))!.length).toBeLessThanOrEqual(37);
    for (const bad of ['', 'x'.repeat(4097), null, undefined, 5, {}, ['t'], true]) expect(purchaseKey(bad)).toBeNull();
  });

  it('different long tokens never share a key (4,000 random store-like tokens)', () => {
    const random = rng(99);
    const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.';
    const keys = new Set<string>();
    const prefix = 'kfnnpjhhgbncpmaefdjlhopi.AO-J1O';
    for (let i = 0; i < 4000; i++) {
      let token = prefix;
      for (let n = 120 + Math.floor(random() * 80); n > 0; n--) token += alphabet[Math.floor(random() * alphabet.length)];
      keys.add(purchaseKey(token)!);
      // one character changed, one swapped pair: still different keys
      keys.add(purchaseKey(token.slice(0, -1) + (token.slice(-1) === 'a' ? 'b' : 'a'))!);
    }
    expect(keys.size).toBe(8000);
  });

  it('a purchase is granted once: rewards, token, entitlement and the purchased flag in ONE save', () => {
    const h = harness();
    const saves: ShopSave[] = [];
    const coinsInSaves: number[] = [];
    h.profile.subscribe(() => {
      saves.push(h.saved().shop);
      coinsInSaves.push(h.saved().coins);
    });
    expect(h.profile.purchaseGranted('tok-A')).toBe(false);
    expect(h.profile.grantPurchase('tok-A', PACK, 'starter_pack')).toBe(true);
    expect(h.storage.writes).toBe(1);
    expect(h.notifications.count).toBe(1);
    expect(coinsInSaves).toEqual([6000]); // what was stored already held the coins AND the token
    expect(saves[0]).toMatchObject({ tokens: ['tok-A'], owned: ['starter_pack'], purchased: true });
    expect(h.profile.boosterCount('hammer')).toBe(3);
    expect(h.profile.purchaseGranted('tok-A')).toBe(true);
    expect(h.profile.lastSaveOk()).toBe(true);
    // the same token again: nothing
    expect(h.profile.grantPurchase('tok-A', PACK, 'starter_pack')).toBe(false);
    expect(h.profile.coins()).toBe(6000);
    expect(h.storage.writes).toBe(1);
    // …also in the next session
    const again = h.restart();
    expect(again.profile.purchaseGranted('tok-A')).toBe(true);
    expect(again.profile.grantPurchase('tok-A', PACK)).toBe(false);
    expect(again.profile.coins()).toBe(6000);
    // a different token of the same product is a different purchase
    expect(again.profile.grantPurchase('tok-B', [{ kind: 'coins', amount: 1000 }])).toBe(true);
    expect(again.profile.coins()).toBe(7000);
    expect(again.saved().shop.tokens).toEqual(['tok-A', 'tok-B']);
  });

  it('long tokens work the same way and never reach the save in full', () => {
    const h = harness();
    const token = 'kfnnpjhhgbncpmaefdjlhopi.AO-J1O' + 'y3pUDWZ8t5e9zQw7mXcVbNm1LkJhGfDsA2qWeRtYuIoP'.repeat(6);
    expect(h.profile.grantPurchase(token, PACK)).toBe(true);
    expect(h.profile.grantPurchase(token, PACK)).toBe(false);
    expect(h.restart().profile.purchaseGranted(token)).toBe(true);
    expect(h.restart().profile.purchaseGranted(token + 'x')).toBe(false);
    expect(h.storage.json).not.toContain('y3pUDWZ8');
    expect(h.saved().shop.tokens[0]!.length).toBeLessThanOrEqual(37);
  });

  it('remembers the last 200 tokens: the oldest are forgotten first', () => {
    const h = harness();
    for (let i = 0; i < 230; i++) expect(h.profile.grantPurchase('tok-' + i, [{ kind: 'coins', amount: 1 }])).toBe(true);
    expect(MAX_PURCHASE_TOKENS).toBe(200);
    const tokens = h.profile.shop().tokens;
    expect(tokens.length).toBe(200);
    expect(tokens[0]).toBe('tok-30');
    expect(tokens[199]).toBe('tok-229');
    expect(h.profile.purchaseGranted('tok-229')).toBe(true);
    expect(h.profile.purchaseGranted('tok-29')).toBe(false);
    expect(h.restart().profile.shop().tokens).toEqual(tokens);
    expect(h.profile.coins()).toBe(2000 + 230);
  });

  it('unusable tokens and odd rewards grant nothing they should not', () => {
    const h = harness();
    for (const bad of ['', null, undefined, 7, {}, 'x'.repeat(5000)]) {
      expect(h.profile.grantPurchase(bad as string, PACK, 'remove_ads')).toBe(false);
      expect(h.profile.purchaseGranted(bad as string)).toBe(false);
    }
    expect(h.storage.writes).toBe(0);
    expect(h.profile.shop()).toEqual(freshShop());
    // rewards that are not a list, hostile amounts, an entitlement id that is not one: the purchase is still recorded
    expect(h.profile.grantPurchase('tok-odd', null as unknown as Reward[], 'Not An Id')).toBe(true);
    expect(h.profile.grantPurchase('tok-odd-2', [{ kind: 'coins', amount: -5 }, { kind: 'coins', amount: Infinity }, null as unknown as Reward], null)).toBe(true);
    expect(h.profile.coins()).toBe(2000);
    expect(h.profile.shop()).toMatchObject({ tokens: ['tok-odd', 'tok-odd-2'], owned: [], purchased: true });
  });

  it('lastSaveOk tells when a grant did not reach storage', () => {
    let failing = false;
    const storage = { json: null as string | null };
    const profile = createProfile({
      load: () => storage.json,
      save: (json) => {
        if (failing) throw new Error('disk full');
        storage.json = json;
      },
      now: () => T0,
      levelCount: 120,
    });
    expect(profile.lastSaveOk()).toBe(true);
    failing = true;
    expect(profile.grantPurchase('tok-A', PACK)).toBe(true); // granted in memory…
    expect(profile.lastSaveOk()).toBe(false); // …but not stored: must not be finished yet
    expect(storage.json).toBeNull();
    failing = false;
    profile.addCoins(1); // the next successful save carries the grant
    expect(profile.lastSaveOk()).toBe(true);
    expect(JSON.parse(storage.json!).shop.tokens).toEqual(['tok-A']);
  });
});

describe('entitlements and the purchased flag', () => {
  it('setEntitlement sets and clears ownership without granting anything', () => {
    const h = harness();
    expect(h.profile.setEntitlement('remove_ads', true)).toBe(true);
    expect(h.profile.setEntitlement('remove_ads', true)).toBe(false);
    expect(h.profile.setEntitlement('starter_pack', true)).toBe(true);
    expect(h.storage.writes).toBe(2);
    expect(h.profile.shop().owned).toEqual(['remove_ads', 'starter_pack']);
    expect(h.profile.coins()).toBe(2000);
    expect(h.profile.data().boosters.hammer).toBe(0);
    expect(h.profile.setEntitlement('remove_ads', false)).toBe(true);
    expect(h.profile.setEntitlement('remove_ads', false)).toBe(false);
    expect(h.restart().profile.shop().owned).toEqual(['starter_pack']);
  });

  it('the purchased flag is set by any purchase or entitlement and is never cleared', () => {
    const a = harness();
    expect(a.profile.shop().purchased).toBe(false);
    a.profile.grantPurchase('tok-1', [{ kind: 'coins', amount: 1000 }]);
    expect(a.profile.shop().purchased).toBe(true);
    const b = harness();
    b.profile.setEntitlement('remove_ads', true);
    b.profile.setEntitlement('remove_ads', false); // e.g. refunded
    expect(b.profile.shop().owned).toEqual([]);
    expect(b.restart().profile.shop().purchased).toBe(true);
  });

  it('at most 16 entitlements — the oldest makes room, so a new one can always be recorded — and only ids that look like product ids', () => {
    const h = harness();
    for (let i = 0; i < 20; i++) expect(h.profile.setEntitlement('product_' + i, true)).toBe(true);
    expect(h.profile.shop().owned.length).toBe(16);
    expect(h.profile.shop().owned[0]).toBe('product_4');
    // a full list (only a damaged save has one) never keeps a real entitlement out
    expect(h.profile.setEntitlement('remove_ads', true)).toBe(true);
    expect(h.profile.shop().owned.length).toBe(16);
    expect(h.profile.shop().owned.indexOf('remove_ads')).toBe(15);
    expect(h.profile.grantPurchase('tok-full', [], 'starter_pack')).toBe(true);
    expect(h.profile.shop().owned.slice(-2)).toEqual(['remove_ads', 'starter_pack']);
    expect(h.restart().profile.shop().owned).toEqual(h.profile.shop().owned);
    for (const bad of ['', 'Remove Ads', 'a'.repeat(41), '_x', null, 5, undefined]) {
      expect(h.profile.setEntitlement(bad as string, true)).toBe(false);
      expect(h.profile.setEntitlement(bad as string, false)).toBe(false);
    }
  });

  it('reset keeps every purchase record, the ad counters and the first-play day', () => {
    const h = harness({ cleared: 30 });
    h.profile.grantPurchase('tok-1', PACK, 'starter_pack');
    h.profile.setEntitlement('remove_ads', true);
    h.profile.noteRewarded('freeCoins', true);
    h.profile.noteLevelFinished();
    h.profile.noteInterstitial();
    const shop = JSON.parse(JSON.stringify(h.profile.shop())) as ShopSave;
    const firstDay = h.saved().firstDay;
    h.profile.reset();
    expect(h.profile.coins()).toBe(2000); // the goodies are progress and are gone…
    expect(h.profile.boosterCount('hammer')).toBe(0);
    expect(h.profile.shop()).toEqual(shop); // …the record of what was paid for is not
    expect(h.saved().shop).toEqual(shop);
    expect(h.saved().firstDay).toBe(firstDay);
    expect(h.profile.grantPurchase('tok-1', PACK, 'starter_pack')).toBe(false);
    expect(h.restart().profile.shop()).toEqual(shop);
  });
});

describe('ad counters', () => {
  it('rewarded ads are counted per placement when earned; a closed ad only leaves its time', () => {
    const h = harness();
    expect(h.profile.adsToday()).toEqual({ rewarded: { extraMoves: 0, freeLife: 0, freeCoins: 0, doubleReward: 0 }, rewardedTotal: 0, interstitials: 0 });
    h.profile.noteRewarded('freeCoins', true);
    h.clock.now += MINUTE;
    h.profile.noteRewarded('freeCoins', true);
    h.profile.noteRewarded('freeLife', true);
    h.clock.now += MINUTE;
    h.profile.noteRewarded('extraMoves', false);
    expect(h.profile.adsToday()).toEqual({ rewarded: { extraMoves: 0, freeLife: 1, freeCoins: 2, doubleReward: 0 }, rewardedTotal: 3, interstitials: 0 });
    expect(h.saved().shop).toMatchObject({ adDay: TODAY, lastRewarded: T0 + 2 * MINUTE, lastInterstitial: 0 });
    expect(h.storage.writes).toBe(4);
    expect(h.notifications.count).toBe(4);
    h.profile.noteRewarded('banner' as 'freeCoins', true); // unknown placement: only the time
    expect(h.profile.adsToday().rewardedTotal).toBe(3);
    expect(h.restart().profile.adsToday().rewarded.freeCoins).toBe(2);
  });

  it('the counters start again on the next local day — and only then', () => {
    const h = harness({ now: T0 }); // 12:00
    h.profile.noteRewarded('freeCoins', true);
    h.profile.noteInterstitial();
    h.clock.now = T0 + 12 * HOUR - 1;
    expect(h.profile.adsToday()).toMatchObject({ rewardedTotal: 1, interstitials: 1 });
    h.clock.now += 1; // midnight
    const writes = h.storage.writes;
    expect(h.profile.adsToday()).toMatchObject({ rewardedTotal: 0, interstitials: 0 });
    expect(h.storage.writes).toBe(writes); // looking never writes
    expect(h.restart().profile.adsToday().rewardedTotal).toBe(0);
    h.profile.noteRewarded('freeLife', true);
    expect(h.profile.adsToday()).toEqual({ rewarded: { extraMoves: 0, freeLife: 1, freeCoins: 0, doubleReward: 0 }, rewardedTotal: 1, interstitials: 0 });
    expect(h.saved().shop.adDay).toBe(TODAY + 1);
  });

  it('a clock set back cannot win a second allowance for the same day', () => {
    const h = harness();
    for (let i = 0; i < 3; i++) h.profile.noteRewarded('freeCoins', true);
    for (const back of [HOUR, DAY, 3 * DAY, 400 * DAY]) {
      h.clock.now = T0 - back;
      expect(h.profile.adsToday().rewarded.freeCoins).toBe(3);
      h.profile.noteRewarded('freeLife', true); // counted into the latest day seen, which stays
      expect(h.saved().shop.adDay).toBe(TODAY);
    }
    expect(h.profile.adsToday()).toMatchObject({ rewardedTotal: 7 });
    h.clock.now = T0 + DAY;
    expect(h.profile.adsToday().rewardedTotal).toBe(0);
  });

  it('interstitials: counted per day, remember their time and restart the finished-level count', () => {
    const h = harness();
    expect(h.profile.noteLevelFinished()).toBe(1);
    expect(h.profile.noteLevelFinished()).toBe(2);
    expect(h.restart().profile.noteLevelFinished()).toBe(3);
    h.clock.now += 5 * MINUTE;
    h.profile.noteInterstitial();
    expect(h.saved().shop).toMatchObject({ finished: 0, interstitials: 1, lastInterstitial: T0 + 5 * MINUTE, adDay: TODAY });
    expect(h.profile.noteLevelFinished()).toBe(1);
    h.clock.now += DAY;
    expect(h.profile.adsToday().interstitials).toBe(0);
    expect(h.profile.shop().finished).toBe(1); // the level count is not a per-day counter
  });

  it('without a clock nothing is lost: ads are still counted, times are simply not recorded', () => {
    let now = NaN;
    const profile = createProfile({ load: () => null, save: () => {}, now: () => now, levelCount: 120 });
    profile.noteRewarded('freeCoins', true);
    profile.noteInterstitial();
    expect(profile.shop()).toMatchObject({ adDay: -1, lastRewarded: 0, lastInterstitial: 0, interstitials: 1 });
    expect(profile.adsToday()).toMatchObject({ rewardedTotal: 1, interstitials: 1 });
    now = T0;
    expect(profile.adsToday().rewardedTotal).toBe(0); // the first real day starts clean
  });
});

describe('repair of the monetisation section', () => {
  it('a missing or foreign section is a clean one; the rest of the save is untouched', () => {
    for (const bad of [undefined, null, 5, 'shop', [], [1]]) {
      const save = sampleSave() as unknown as Record<string, unknown>;
      if (bad === undefined) delete save.shop;
      else save.shop = bad;
      const h = fromSave(save);
      expect(h.profile.shop()).toEqual(freshShop());
      expect(h.profile.coins()).toBe(777);
    }
  });

  it('tokens: distinct non-empty strings up to 64 characters, the newest 200', () => {
    expect(shopOf({ tokens: ['a', 'b', 'a', '', 5, null, { t: 1 }, ['c'], 'x'.repeat(65), 'c'] }).tokens).toEqual(['b', 'a', 'c']);
    const many = Array.from({ length: 1000 }, (_, i) => 't' + i);
    const kept = shopOf({ tokens: many }).tokens;
    expect(kept.length).toBe(200);
    expect(kept[0]).toBe('t800');
    expect(kept[199]).toBe('t999');
    for (const bad of [undefined, null, 'a,b', { 0: 'a', length: 1 }, 7]) expect(shopOf({ tokens: bad, owned: [] }).tokens).toEqual([]);
  });

  it('owned: product-like ids only, once each, at most 16', () => {
    expect(shopOf({ owned: ['remove_ads', 'remove_ads', 'Starter Pack', '', 7, null, 'starter_pack'] }).owned).toEqual(['remove_ads', 'starter_pack']);
    expect(shopOf({ owned: Array.from({ length: 40 }, (_, i) => 'p' + i) }).owned.length).toBe(16);
    expect(shopOf({ owned: 'remove_ads' }).owned).toEqual([]);
  });

  it('purchased: only `true` counts — but a token or an entitlement proves a purchase', () => {
    expect(shopOf({ tokens: [], owned: [], purchased: true }).purchased).toBe(true);
    for (const v of [false, 1, 'true', null, undefined]) expect(shopOf({ tokens: [], owned: [], purchased: v }).purchased).toBe(false);
    expect(shopOf({ tokens: ['t'], owned: [], purchased: false }).purchased).toBe(true);
    expect(shopOf({ tokens: [], owned: ['remove_ads'], purchased: 'no' }).purchased).toBe(true);
  });

  it('counters and times: whole numbers within range, anything else is the default', () => {
    const shop = shopOf({ adDay: 20_000.9, rewarded: { freeCoins: 2.7, freeLife: -1, extraMoves: '3', banner: 9 }, interstitials: 1e300, finished: -4, lastInterstitial: 12.5, lastRewarded: 'now' });
    expect(shop.adDay).toBe(20_000);
    expect(shop.rewarded).toEqual({ extraMoves: 0, freeLife: 0, freeCoins: 2, doubleReward: 0 });
    expect(shop.interstitials).toBe(9_999);
    expect(shop.finished).toBe(0);
    expect(shop.lastInterstitial).toBe(12);
    expect(shop.lastRewarded).toBe(0);
    expect(shopOf({ adDay: -9 }).adDay).toBe(-1);
    expect(shopOf({ rewarded: [1, 2, 3] }).rewarded).toEqual({ extraMoves: 0, freeLife: 0, freeCoins: 0, doubleReward: 0 });
    expect(shopOf({ lastRewarded: 1e300 }).lastRewarded).toBe(8_640_000_000_000_000);
  });

  it('a valid section is loaded exactly as it is, and nothing is written for it', () => {
    const h = fromSave(sampleSave());
    expect(h.profile.shop()).toEqual(sampleSave().shop);
    expect(h.storage.writes).toBe(0);
  });
});
