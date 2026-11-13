/**
 * The two sides of the bridge, held against each other: the Kotlin wrapper (android/, read here as
 * text — never changed from this side) and the contract in src/monetize/types.ts.
 *
 * A method the page calls and the wrapper does not have, an event field spelled differently, a
 * wrapper timeout that outlasts the page's patience: each of these is silent in both test suites
 * and expensive on a phone. Skipped when the Android project is not in the checkout.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AD_PLACEMENTS, AD_RESUME_GRACE_MS, AD_WATCHDOG_MS, BUY_RESUME_GRACE_MS, PRODUCTS, RESTORE_WATCHDOG_MS } from '../../src/monetize/index.ts';
import { purchaseKey } from '../../src/state/index.ts';

const ROOT = new URL('../../android/app/src/', import.meta.url);
const file = (path: string): URL => new URL(path, ROOT);
const present = existsSync(file('main/kotlin/com/zumurud/game/GameBridge.kt'));
const read = (path: string): string => readFileSync(file(path), 'utf8');

/**
 * `const val NAME = 30_000L` / `15 * 60_000L` → milliseconds; null when the wrapper has no constant
 * of that name (any more) — the comparison that needs it is then left out: names inside the wrapper
 * are its own business, only what crosses the bridge is the contract.
 */
function kotlinMs(source: string, name: string): number | null {
  const match = new RegExp('const val ' + name + '\\s*=\\s*([0-9_ *L]+)').exec(source);
  if (!match) return null;
  return match[1]!
    .split('*')
    .map((part) => Number(part.replace(/[_L\s]/g, '')))
    .reduce((a, b) => a * b, 1);
}

/** The pattern of a Kotlin `Regex("…")` constant, anchored like Kotlin's `matches`; null when there is none of that name. */
function kotlinRegex(source: string, name: string): RegExp | null {
  const match = new RegExp('val ' + name + '\\s*=\\s*Regex\\("([^"]+)"\\)').exec(source);
  return match ? new RegExp('^(?:' + match[1]! + ')$') : null;
}

describe.skipIf(!present)('the Kotlin wrapper and the page agree', () => {
  const bridge = present ? read('main/kotlin/com/zumurud/game/GameBridge.kt') : '';
  const store = present ? read('main/kotlin/com/zumurud/game/StoreController.kt') : '';
  const billing = present ? read('main/kotlin/com/zumurud/game/BillingController.kt') : '';
  const admob = present && existsSync(file('ads/kotlin/com/zumurud/game/AdMobController.kt')) ? read('ads/kotlin/com/zumurud/game/AdMobController.kt') : '';

  it('every bridge method the page calls is exported to JavaScript, with the arity the page uses', () => {
    const methods: [string, number][] = [
      ['loadSave', 0],
      ['storeSave', 1],
      ['storeCaps', 0],
      ['storeSync', 0],
      ['iapQuery', 1],
      ['iapBuy', 1],
      ['iapFinish', 1],
      ['iapRestore', 0],
      ['adShowRewarded', 1],
      ['adShowInterstitial', 0],
      ['adPrivacyOptions', 0],
    ];
    for (const [name, arity] of methods) {
      const match = new RegExp('@JavascriptInterface\\s+fun ' + name + '\\(([^)]*)\\)').exec(bridge);
      expect(match, name + ' is not a @JavascriptInterface method of GameBridge').not.toBeNull();
      const parameters = match![1]!.trim();
      expect(parameters.length === 0 ? 0 : parameters.split(',').length, name).toBe(arity);
      if (arity === 1) expect(parameters, name + ' takes a string').toMatch(/:\s*String\??$/);
    }
  });

  it('every event the wrapper sends has the type and the field names of StoreEvent', () => {
    const events: Record<string, string[]> = {
      products: ['products', 'id', 'price'],
      purchase: ['id', 'state', 'token', 'acknowledged', 'quantity'],
      owned: ['ids', 'complete'],
      ads: ['canRequestAds', 'rewardedReady', 'interstitialReady', 'privacyOptionsRequired'],
      adResult: ['format', 'result'],
    };
    for (const type of Object.keys(events)) {
      expect(store, 'event type ' + type).toContain('put("type", "' + type + '")');
      for (const field of events[type]!) expect(store, type + '.' + field).toContain('put("' + field + '"');
    }
    // nothing else is put into an event
    const fields = new Set<string>();
    const put = /\.put\("([A-Za-z]+)"/g;
    for (let m = put.exec(store); m; m = put.exec(store)) fields.add(m[1]!);
    const known = new Set(['type', 'billing', 'ads'].concat(...Object.keys(events).map((t) => events[t]!)));
    expect(Array.from(fields).filter((f) => !known.has(f))).toEqual([]);
    // 'complete' is only ever sent as true; 'quantity' only above 1
    expect(store).toMatch(/if \(complete\) event\.put\("complete", true\)/);
    expect(store).toMatch(/if \(quantity > 1\) event\.put\("quantity", quantity\)/);
    // the capabilities object
    expect(store).toMatch(/put\("billing", true\)\.put\("ads", AdsFactory\.HAS_ADS\)/);
  });

  it('the purchase states and ad results the wrapper can send are exactly the ones the page understands', () => {
    const states = new Set<string>();
    const quoted = /"(purchased|pending|cancelled|alreadyOwned|unavailable|error|canceled|owned|failed|refunded)"/g;
    for (let m = quoted.exec(billing); m; m = quoted.exec(billing)) states.add(m[1]!);
    expect(Array.from(states).sort()).toEqual(['alreadyOwned', 'cancelled', 'error', 'pending', 'purchased', 'unavailable']);
    if (admob) {
      const results = new Set<string>();
      const result = /"(earned|dismissed|failed)"/g;
      for (let m = result.exec(admob); m; m = result.exec(admob)) results.add(m[1]!);
      expect(Array.from(results).sort()).toEqual(['dismissed', 'earned', 'failed']);
      expect(admob).toMatch(/Slot<RewardedAd>\("rewarded"/);
      expect(admob).toMatch(/Slot<InterstitialAd>\("interstitial"/);
    }
  });

  it('the wrapper’s input checks accept every product id, every placement and every token the page can send', () => {
    for (const pattern of [kotlinRegex(bridge, 'PRODUCT_ID'), kotlinRegex(billing, 'PRODUCT_ID')]) {
      if (pattern) for (const def of PRODUCTS) expect(pattern.test(def.id), def.id).toBe(true);
    }
    const placement = kotlinRegex(bridge, 'PLACEMENT');
    if (placement) for (const p of AD_PLACEMENTS) expect(placement.test(p), p).toBe(true);
    // the longest token the page grants is the longest token the wrapper finishes
    const limit = /MAX_TOKEN_CHARS = (\d+)/.exec(bridge);
    if (limit) {
      const maxToken = Number(limit[1]);
      expect(purchaseKey('t'.repeat(maxToken))).not.toBeNull();
      expect(purchaseKey('t'.repeat(maxToken + 1))).toBeNull();
    }
    // the product query (7 products) fits the wrapper's limit many times over
    const query = JSON.stringify(PRODUCTS.map((p) => ({ id: p.id, kind: p.kind })));
    expect(query.length).toBeLessThan(16 * 1024);
    expect(billing).toMatch(/"consumable" -> Kind\.CONSUMABLE/);
    expect(billing).toMatch(/"entitlement" -> Kind\.ENTITLEMENT/);
  });

  it('no product id and no price is written into the wrapper: both come from the page and from the store', () => {
    for (const source of [bridge, store, billing]) {
      for (const def of PRODUCTS) expect(source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''), def.id).not.toContain('"' + def.id + '"');
      expect(source).not.toMatch(/[$€£]\s?\d+[.,]\d\d/);
    }
  });

  it('money safety on the wrapper’s side: PURCHASED only, the save on disk before consume / acknowledge, "complete" never asserted blindly', () => {
    const code = billing.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    // "purchased" is only ever sent for PurchaseState.PURCHASED, with the token, the acknowledged flag and the quantity
    const sends: number[] = [];
    for (let at = code.indexOf('"purchased"'); at >= 0; at = code.indexOf('"purchased"', at + 1)) sends.push(at);
    expect(sends.length).toBeGreaterThan(0);
    for (const at of sends) {
      expect(code.slice(Math.max(0, at - 200), at), 'a "purchased" event that is not behind a PURCHASED check').toContain('PurchaseState.PURCHASED');
      expect(code.slice(at, at + 200)).toMatch(/purchaseToken[\s\S]*isAcknowledged[\s\S]*quantity/);
    }
    expect(code).toMatch(/PurchaseState\.PENDING\s*->\s*emitPurchase\([^)]*"pending"\)/);
    // a listing is marked complete by a computed truth, never by a literal — and a failed query says "not complete"
    expect(code).not.toMatch(/owned\([^)]*complete\s*=\s*true/);
    expect(code).toMatch(/owned\(emptyList\(\),\s*complete\s*=\s*false\)/);
    // the grant must be on disk before the store is told "delivered": something that flushes comes first
    const finish = code.slice(code.indexOf('private fun finishKnown'), code.indexOf('private fun finishDone'));
    const flush = finish.search(/flush|OnDisk|commit/i);
    expect(flush, 'finishKnown does not put the save on disk first').toBeGreaterThan(0);
    expect(flush).toBeLessThan(finish.indexOf('consumeAsync'));
    expect(flush).toBeLessThan(finish.indexOf('acknowledgePurchase'));
    expect(finish).toMatch(/!purchase\.purchased/); // a pending payment is never finished
    const saves = read('main/kotlin/com/zumurud/game/SaveStore.kt');
    expect(saves).toMatch(/\.commit\(\)/); // a synchronous write whose result is known
  });

  it('the page waits longer than the wrapper may take', () => {
    // a restore may first have to connect to Google Play
    const connect = kotlinMs(billing, 'CONNECT_TIMEOUT_MS');
    if (connect !== null) expect(RESTORE_WATCHDOG_MS).toBeGreaterThan(connect);
    // an ad that never opens is reported by the wrapper before the page gives up in front…
    const show = kotlinMs(admob, 'SHOW_TIMEOUT_MS');
    if (show !== null) expect(AD_WATCHDOG_MS).toBeGreaterThan(show);
    // …and after a return the wrapper's own "it must have closed" comes before the page's
    const back = kotlinMs(admob, 'RETURN_GRACE_MS');
    const reward = kotlinMs(admob, 'REWARD_GRACE_MS');
    if (back !== null) expect(AD_RESUME_GRACE_MS).toBeGreaterThan(back + (reward || 0));
    expect(BUY_RESUME_GRACE_MS).toBeGreaterThanOrEqual(20_000);
  });
});
