/**
 * The store proper: purchases and ads over a MonetizeBridge. The same code serves the Android
 * wrapper (events arrive through `window.__native.store`) and the browser test store (./fake.ts
 * emits the same JSON events) — there is exactly one grant path.
 *
 * Money safety (src/monetize/types.ts), as implemented here:
 *  - Only a 'purchase' event with state 'purchased' and a usable token grants anything, and the
 *    grant goes through `profile.grantPurchase`, which refuses a token it has seen before and
 *    writes rewards + token + ownership in ONE save.
 *  - `bridge.iapFinish(token)` is called only when that save is known to be in storage: the profile
 *    reads its save back and finds the token in it (`profile.purchaseSaved`). That a save function
 *    returned without throwing is not enough — the platform's never throws. The same check guards
 *    every later finish of a token the store delivers again (its earlier finish was lost). A
 *    purchase whose grant is not in storage stays unfinished: the store delivers it again.
 *  - The promise returned by `buy()` is only a convenience for the screen that started the purchase.
 *    Grants never depend on it: a purchase that completes later (pending payments, a result that
 *    arrives after a restart) is granted by its event all the same.
 *  - Ownership of an entitlement is set only by what the store positively reports: a listing
 *    ('owned') or a 'purchased' event. "Already owned" as the answer to a purchase attempt is not
 *    proof (the store says the same about a payment that is still pending): it only triggers a
 *    listing. Ownership is sticky: cleared only by an 'owned' event that says it is the complete
 *    answer of a successful query.
 *
 * Ads: the store keeps the books (daily counts, the time of the last full-screen ad) in the
 * profile; the CALLER applies every reward. Only one full-screen ad at a time; every promise
 * resolves — a watchdog answers for a bridge that never does.
 *
 * Nothing in here throws, whatever the bridge sends or a listener does.
 */
import type { PlatformApi } from '../platform/types.ts';
import type { FullProfile } from '../state/extensions.ts';
import type { Reward } from '../state/types.ts';
import type { AdPlacement, FullStoreApi, MonetizeBridge, ProductDef, ProductId, ProductInfo, PurchaseOutcome, RewardedOutcome } from './types.ts';
import {
  AD_PLACEMENTS,
  AD_RESUME_GRACE_MS,
  AD_WATCHDOG_MS,
  BUY_RESUME_GRACE_MS,
  BUY_WATCHDOG_MS,
  INTERSTITIALS_PER_DAY,
  INTERSTITIAL_AFTER_REWARDED_MS,
  INTERSTITIAL_EVERY_LEVELS,
  INTERSTITIAL_MIN_DAYS_PLAYED,
  INTERSTITIAL_MIN_GAP_MS,
  INTERSTITIAL_MIN_LEVEL,
  MAX_PURCHASE_QUANTITY,
  PRIVACY_WATCHDOG_MS,
  PRODUCTS,
  RESTORE_SETTLE_MS,
  RESTORE_WATCHDOG_MS,
  RESUME_RESTORE_GAP_MS,
  REWARDED_PER_DAY,
  REWARDED_PER_DAY_TOTAL,
  productDef,
} from './catalog.ts';

export interface CoreDeps {
  profile: FullProfile;
  platform: PlatformApi;
  /** Epoch milliseconds. */
  now(): number;
  bridge: MonetizeBridge;
  /**
   * How long after the app returned to the front a purchase that is still open may take to report
   * (the store's own purchase screen covers the app, so "back in front" means that screen has
   * closed). Then buy() answers 'error' and a listing is asked for. Default BUY_RESUME_GRACE_MS;
   * null = returning says nothing about the purchase (the browser test store draws its sheet
   * inside the page).
   */
  buyResumeGraceMs?: number | null;
}

export interface CoreStore extends FullStoreApi {
  /** Deliver one StoreEvent: its JSON text (or the parsed object). Garbage is ignored; never throws. */
  receive(event: unknown): void;
  /** Ask the store for prices and for what the player owns. Call once, when events can be received. */
  start(): void;
}

type Timer = ReturnType<typeof setTimeout>;

/** `away`: the app went to the background while the ad was open — something full-screen was in front. */
type ActiveAd =
  | { format: 'rewarded'; placement: AdPlacement; resolve(outcome: RewardedOutcome): void; timer: Timer | null; away: boolean }
  | { format: 'interstitial'; placement: null; resolve(shown: boolean): void; timer: Timer | null; away: boolean };

interface OpenPurchase {
  id: ProductId;
  resolve(outcome: PurchaseOutcome): void;
  /** Gives the whole flow up. */
  timer: Timer;
  /** Runs after the app returned to the front with the flow still open. */
  grace: Timer | null;
  /** The app went to the background since buy(): the store's purchase screen was up. */
  away: boolean;
}

const MAX_PRICE_LENGTH = 40;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function log(what: string, err: unknown): void {
  try {
    if (typeof console !== 'undefined') console.error('[store] ' + what, err);
  } catch {
    // even logging failed: nothing may escape from here
  }
}

/** What the build was compiled with. Anything unreadable means "nothing". */
function readCaps(bridge: MonetizeBridge): { billing: boolean; ads: boolean } {
  const caps = { billing: false, ads: false };
  try {
    const raw: unknown = bridge.storeCaps();
    const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (isObject(parsed)) {
      caps.billing = parsed.billing === true;
      caps.ads = parsed.ads === true;
    }
  } catch {
    // no usable answer: a build without purchases and ads
  }
  return caps;
}

/** A price string as the store formatted it, or null when the value is not one. */
function cleanPrice(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const price = v.trim();
  return price.length > 0 && price.length <= MAX_PRICE_LENGTH ? price : null;
}

function isPlacement(p: unknown): p is AdPlacement {
  return typeof p === 'string' && (AD_PLACEMENTS as readonly string[]).indexOf(p) >= 0;
}

/** Units bought in one purchase: a whole number from 1 to MAX_PURCHASE_QUANTITY; anything else is 1. */
function purchaseQuantity(v: unknown): number {
  if (typeof v !== 'number' || !isFinite(v) || v < 2) return 1;
  return Math.min(MAX_PURCHASE_QUANTITY, Math.floor(v));
}

/** The grants of `quantity` units of a product (fresh objects). */
function grantsOf(def: ProductDef, quantity: number): Reward[] {
  const out: Reward[] = [];
  for (const r of def.grants) {
    if (r.kind === 'coins') out.push({ kind: 'coins', amount: r.amount * quantity });
    else if (r.kind === 'booster') out.push({ kind: 'booster', id: r.id, amount: r.amount * quantity });
    else out.push({ ...r });
  }
  return out;
}

export function createCoreStore(deps: CoreDeps): CoreStore {
  const { profile, platform, bridge } = deps;
  const caps = readCaps(bridge);
  const buyResumeGraceMs = deps.buyResumeGraceMs === null ? null : typeof deps.buyResumeGraceMs === 'number' && deps.buyResumeGraceMs >= 0 ? deps.buyResumeGraceMs : BUY_RESUME_GRACE_MS;

  function now(): number {
    try {
      const t = deps.now();
      return typeof t === 'number' && isFinite(t) ? t : 0;
    } catch {
      return 0;
    }
  }

  /** Call the bridge; a bridge that throws is reported as `false`. */
  function tell(what: string, fn: () => void): boolean {
    try {
      fn();
      return true;
    } catch (err) {
      log(what + ' failed', err);
      return false;
    }
  }

  // ───────────────────────────── change notifications ─────────────────────────────
  // Batched: one round per handled event or public call, however much changed. Never re-entrant:
  // a change made BY a listener is announced in a further round after the current one.

  const listeners: { fn: () => void }[] = [];
  let depth = 0;
  let dirty = false;
  let notifying = false;

  function flush(): void {
    if (notifying || !dirty) return;
    notifying = true;
    try {
      for (let round = 0; dirty && round < 10; round++) {
        dirty = false;
        for (const entry of listeners.slice()) {
          if (listeners.indexOf(entry) < 0) continue; // removed by an earlier listener of this round
          try {
            entry.fn();
          } catch (err) {
            log('listener failed', err);
          }
        }
      }
    } finally {
      notifying = false;
    }
  }

  function touch(): void {
    dirty = true;
    if (depth === 0) flush();
  }

  function batch(fn: () => void): void {
    depth += 1;
    try {
      fn();
    } catch (err) {
      log('internal error', err);
    } finally {
      depth -= 1;
      if (depth === 0) flush();
    }
  }

  // ───────────────────────────── purchases: state ─────────────────────────────

  const prices: Partial<Record<ProductId, string>> = {};
  let priceCount = 0;
  let buying: OpenPurchase | null = null;
  /** Entitlements bought (granted) in this session: an 'owned' listing that predates their acknowledgement must not clear them. */
  const boughtNow: Partial<Record<ProductId, true>> = {};
  let restoreWaiters: ((count: number) => void)[] = [];
  let restoredCount = 0;
  let restoreTimer: Timer | null = null;
  let restoreSettling = false;
  let lastRestoreRequest = -Infinity;

  function owned(id: ProductId): boolean {
    return profile.shop().owned.indexOf(id) >= 0;
  }

  /** Record ownership of an entitlement (no goodies). True when it was not owned before. */
  function own(id: ProductId): boolean {
    const changed = profile.setEntitlement(id, true);
    if (changed) {
      restoredCount += 1;
      touch();
    }
    return changed;
  }

  function settleBuy(id: ProductId, outcome: PurchaseOutcome): void {
    const open = buying;
    if (!open || open.id !== id) return;
    buying = null;
    clearTimeout(open.timer);
    if (open.grace !== null) clearTimeout(open.grace);
    open.resolve(outcome);
  }

  /** Consume / acknowledge — only for a grant that is proven to be in storage. */
  function finish(token: string): void {
    let saved = false;
    try {
      saved = profile.purchaseSaved(token) === true;
    } catch (err) {
      log('cannot check the save', err);
    }
    if (!saved) return; // not in storage: leave it unfinished, the store delivers it again
    tell('iapFinish', () => bridge.iapFinish(token));
  }

  function queryProducts(): void {
    const ids = PRODUCTS.map((p) => ({ id: p.id, kind: p.kind }));
    tell('iapQuery', () => bridge.iapQuery(JSON.stringify(ids)));
  }

  function requestRestore(): boolean {
    lastRestoreRequest = now();
    return tell('iapRestore', () => bridge.iapRestore());
  }

  function settleRestore(): void {
    if (restoreTimer !== null) clearTimeout(restoreTimer);
    restoreTimer = null;
    restoreSettling = false;
    const waiters = restoreWaiters;
    restoreWaiters = [];
    for (const resolve of waiters) resolve(restoredCount);
  }

  // ───────────────────────────── purchases: events ─────────────────────────────

  function onProducts(ev: Record<string, unknown>): void {
    if (!Array.isArray(ev.products)) return;
    const next: Partial<Record<ProductId, string>> = {};
    let count = 0;
    for (const item of ev.products as unknown[]) {
      if (!isObject(item)) continue;
      const def = productDef(item.id);
      const price = cleanPrice(item.price);
      if (!def || price === null) continue;
      if (next[def.id] === undefined) count += 1;
      next[def.id] = price;
    }
    let changed = count !== priceCount;
    for (const def of PRODUCTS) {
      if (prices[def.id] !== next[def.id]) changed = true;
      if (next[def.id] === undefined) delete prices[def.id];
      else prices[def.id] = next[def.id];
    }
    priceCount = count;
    if (changed) touch();
  }

  function onPurchased(def: ProductDef, ev: Record<string, unknown>): void {
    const token = ev.token;
    if (typeof token !== 'string' || token.length === 0) {
      settleBuy(def.id, 'error'); // paid, says the event, but nothing to finish it with: the store will report it again
      return;
    }
    const entitlement = def.kind === 'entitlement';

    // A restore: the store acknowledged this entitlement earlier. Ownership, never the goodies again.
    if (entitlement && ev.acknowledged === true) {
      own(def.id);
      settleBuy(def.id, 'alreadyOwned');
      return;
    }

    // Granted before (in this or an earlier session): its finish was lost — finish it again.
    if (profile.purchaseGranted(token)) {
      if (entitlement) own(def.id);
      finish(token);
      // Not a new purchase: whoever is waiting in buy() did not pay again.
      settleBuy(def.id, entitlement ? 'alreadyOwned' : 'error');
      return;
    }

    // The one place where paid goods are handed over: rewards + token + ownership in one save…
    // (several units of a coin pack bought at once are one purchase with one token)
    const quantity = entitlement ? 1 : purchaseQuantity(ev.quantity);
    if (!profile.grantPurchase(token, grantsOf(def, quantity), entitlement ? def.id : null)) {
      settleBuy(def.id, 'error'); // a token the profile cannot remember: never grant what cannot be recorded
      return;
    }
    if (entitlement) boughtNow[def.id] = true;
    restoredCount += 1;
    // …and only then the store is told that the purchase is done.
    finish(token);
    settleBuy(def.id, 'purchased');
    touch();
  }

  function onPurchase(ev: Record<string, unknown>): void {
    const def = productDef(ev.id);
    if (!def) return; // not a product of this game: never granted, never finished
    switch (ev.state) {
      case 'purchased':
        onPurchased(def, ev);
        return;
      case 'pending':
        // Nothing is granted for a pending payment; its 'purchased' event arrives when it completes.
        settleBuy(def.id, 'pending');
        return;
      case 'cancelled':
      case 'unavailable':
      case 'error':
        settleBuy(def.id, ev.state);
        return;
      case 'alreadyOwned': {
        const waiting = buying !== null && buying.id === def.id;
        // Not proof of ownership: the store answers the same for a payment that is still pending.
        // Nothing is recorded here — the listing asked for below says what is really owned, and
        // delivers whatever is unfinished, so that it is granted (once) and finished.
        // (A coin pack: an earlier purchase of it was never finished; nothing new was bought.)
        settleBuy(def.id, def.kind === 'entitlement' ? 'alreadyOwned' : 'error');
        if (waiting) requestRestore();
        return;
      }
      default:
        return; // an unknown state says nothing
    }
  }

  function onOwned(ev: Record<string, unknown>): void {
    if (!Array.isArray(ev.ids)) return;
    const listed: Partial<Record<ProductId, true>> = {};
    for (const id of ev.ids as unknown[]) {
      const def = productDef(id);
      if (!def || def.kind !== 'entitlement') continue;
      listed[def.id] = true;
      own(def.id);
    }
    // Only a complete, successful listing may take ownership away — and never from something that
    // was bought a moment ago and is not acknowledged yet.
    if (ev.complete === true) {
      for (const def of PRODUCTS) {
        if (def.kind !== 'entitlement' || listed[def.id] || boughtNow[def.id] || !owned(def.id)) continue;
        if (profile.setEntitlement(def.id, false)) touch();
      }
    }
    // A restore is answered; unfinished purchases may follow right behind the list.
    if (restoreWaiters.length > 0 && !restoreSettling) {
      restoreSettling = true;
      if (restoreTimer !== null) clearTimeout(restoreTimer);
      restoreTimer = setTimeout(settleRestore, RESTORE_SETTLE_MS);
    }
  }

  // ───────────────────────────── ads: state ─────────────────────────────

  const ads = { canRequestAds: false, rewardedReady: false, interstitialReady: false, privacyOptionsRequired: false };
  let ad: ActiveAd | null = null;
  /** An ad the watchdog gave up on: if its result still arrives, the books record that an ad was on screen. */
  let lateAd: { format: 'rewarded'; placement: AdPlacement } | { format: 'interstitial'; placement: null } | null = null;
  let privacyWaiters: (() => void)[] = [];
  let privacyTimer: Timer | null = null;

  function adsAvailable(): boolean {
    return caps.ads && ads.canRequestAds;
  }

  function rewardedLeft(placement: AdPlacement): number {
    if (!isPlacement(placement)) return 0;
    const today = profile.adsToday();
    const totalLeft = REWARDED_PER_DAY_TOTAL - today.rewardedTotal;
    const limit = REWARDED_PER_DAY[placement];
    const ownLeft = limit === null ? totalLeft : limit - today.rewarded[placement];
    return Math.max(0, Math.min(totalLeft, ownLeft));
  }

  function rewardedUnlocked(): boolean {
    return profile.featureUnlocked('rewardedAds');
  }

  function expireAd(): void {
    const current = ad;
    if (!current) return;
    ad = null;
    current.timer = null;
    if (current.away) {
      // The app was covered while this ad was open and no result came back: for the frequency
      // rules an ad WAS on screen (the cautious reading). No reward — nothing says it was earned.
      lateAd = null;
      if (current.format === 'rewarded') profile.noteRewarded(current.placement, false);
      else profile.noteInterstitial();
    } else if (current.format === 'rewarded') {
      lateAd = { format: 'rewarded', placement: current.placement };
    } else {
      lateAd = { format: 'interstitial', placement: null };
    }
    if (current.format === 'rewarded') current.resolve('unavailable');
    else current.resolve(false);
    touch();
  }

  /**
   * The bridge refused the ad that was just started: it never opened. False when that ad is not
   * the open one any more (a bridge that reported back inside the call) — then nothing is touched.
   */
  function abortAd(mine: ActiveAd): boolean {
    if (ad !== mine) return false;
    ad = null;
    if (mine.timer !== null) clearTimeout(mine.timer);
    mine.timer = null;
    return true;
  }

  function armAdWatchdog(ms: number): void {
    const current = ad;
    if (!current) return;
    if (current.timer !== null) clearTimeout(current.timer);
    current.timer = setTimeout(() => batch(expireAd), ms);
  }

  /**
   * True when less than `window` has passed since `stamp` (epoch ms of an earlier ad, 0 = never).
   * A stamp ahead of the clock (it was set back since) blocks as well — but not for ever: the
   * profile pulls such a stamp back to "now" with every finished level (`noteLevelFinished`).
   */
  function within(stamp: number, window: number, t: number): boolean {
    return stamp > 0 && t - stamp < window;
  }

  function interstitialAllowed(finished: number): boolean {
    if (!adsAvailable() || !ads.interstitialReady || ad !== null) return false;
    const shop = profile.shop();
    if (shop.purchased || shop.owned.length > 0) return false; // whoever paid for anything never sees one
    if (profile.highestUnlocked() < INTERSTITIAL_MIN_LEVEL) return false;
    if (profile.daysSinceFirstPlay() < INTERSTITIAL_MIN_DAYS_PLAYED) return false;
    if (finished < INTERSTITIAL_EVERY_LEVELS) return false;
    if (profile.adsToday().interstitials >= INTERSTITIALS_PER_DAY) return false;
    const t = now();
    if (t <= 0) return false; // no clock: the waiting times cannot be kept, so no ad
    if (within(shop.lastInterstitial, INTERSTITIAL_MIN_GAP_MS, t)) return false;
    if (within(shop.lastRewarded, INTERSTITIAL_AFTER_REWARDED_MS, t)) return false;
    return true;
  }

  // ───────────────────────────── ads: events ─────────────────────────────

  function onAds(ev: Record<string, unknown>): void {
    const next = {
      canRequestAds: ev.canRequestAds === true,
      rewardedReady: ev.rewardedReady === true,
      interstitialReady: ev.interstitialReady === true,
      privacyOptionsRequired: ev.privacyOptionsRequired === true,
    };
    if (
      next.canRequestAds !== ads.canRequestAds ||
      next.rewardedReady !== ads.rewardedReady ||
      next.interstitialReady !== ads.interstitialReady ||
      next.privacyOptionsRequired !== ads.privacyOptionsRequired
    ) {
      ads.canRequestAds = next.canRequestAds;
      ads.rewardedReady = next.rewardedReady;
      ads.interstitialReady = next.interstitialReady;
      ads.privacyOptionsRequired = next.privacyOptionsRequired;
      touch();
    }
    settlePrivacy(); // the consent form (if one was open) has reported back
  }

  function settlePrivacy(): void {
    if (privacyTimer !== null) clearTimeout(privacyTimer);
    privacyTimer = null;
    const waiters = privacyWaiters;
    privacyWaiters = [];
    for (const resolve of waiters) resolve();
  }

  function onAdResult(ev: Record<string, unknown>): void {
    const format = ev.format;
    const result = ev.result;
    if (format !== 'rewarded' && format !== 'interstitial') return;
    if (result !== 'earned' && result !== 'dismissed' && result !== 'failed') return;
    const shown = result !== 'failed';
    const current = ad;
    if (current && current.format === format) {
      ad = null;
      if (current.timer !== null) clearTimeout(current.timer);
      if (current.format === 'rewarded') {
        const earned = result === 'earned';
        if (shown) profile.noteRewarded(current.placement, earned);
        current.resolve(earned ? 'earned' : shown ? 'dismissed' : 'unavailable');
      } else {
        if (shown) profile.noteInterstitial();
        current.resolve(shown);
      }
      touch();
      return;
    }
    const late = lateAd;
    if (late && late.format === format) {
      lateAd = null;
      if (!shown) return;
      // The caller was already told "no ad" and gave no reward — but an ad WAS on screen.
      if (late.format === 'rewarded') profile.noteRewarded(late.placement, false);
      else profile.noteInterstitial();
      touch();
    }
  }

  // ───────────────────────────── the event door ─────────────────────────────

  function receive(event: unknown): void {
    let ev: unknown = event;
    try {
      if (typeof ev === 'string') ev = JSON.parse(ev);
      if (typeof ev === 'string') ev = JSON.parse(ev); // a bridge that encodes twice
    } catch {
      return;
    }
    if (!isObject(ev)) return;
    const data = ev;
    batch(() => {
      switch (data.type) {
        case 'products':
          onProducts(data);
          break;
        case 'purchase':
          onPurchase(data);
          break;
        case 'owned':
          onOwned(data);
          break;
        case 'ads':
          onAds(data);
          break;
        case 'adResult':
          onAdResult(data);
          break;
        default:
          break; // an event of a newer wrapper: not for us
      }
    });
  }

  // ───────────────────────────── app lifecycle ─────────────────────────────

  platform.onPause(() => {
    // A full-screen ad (or the store's own screen) is in front: its time does not count against it.
    if (ad) {
      ad.away = true;
      if (ad.timer !== null) clearTimeout(ad.timer);
      ad.timer = null;
    }
    const open = buying;
    if (open) {
      open.away = true;
      if (open.grace !== null) clearTimeout(open.grace);
      open.grace = null;
    }
  });

  /** Back in front with a purchase still open: the store's screen has closed, its answer is due. */
  function armBuyGrace(open: OpenPurchase): void {
    if (buyResumeGraceMs === null || !open.away) return;
    if (open.grace !== null) clearTimeout(open.grace);
    open.grace = setTimeout(() => {
      batch(() => {
        if (buying !== open) return;
        // No answer: whoever waits is told so, and the store is asked what really happened — a
        // payment that did go through is then delivered, granted and finished like any other.
        settleBuy(open.id, 'error');
        requestRestore();
      });
    }, buyResumeGraceMs);
  }

  platform.onResume(() => {
    batch(() => {
      if (ad) {
        armAdWatchdog(AD_RESUME_GRACE_MS); // back in front: the result is due now
        return;
      }
      if (!caps.billing) return;
      if (buying) {
        armBuyGrace(buying);
        return;
      }
      // A payment may have completed while the game was away, and prices may have been missing.
      if (priceCount === 0) queryProducts();
      // (the distance on either side: a clock that was set back must not silence this)
      if (Math.abs(now() - lastRestoreRequest) >= RESUME_RESTORE_GAP_MS) requestRestore();
    });
  });

  // ───────────────────────────── public API ─────────────────────────────

  const api: CoreStore = {
    receive,

    start(): void {
      batch(() => {
        // Optional in the contract: feature-detected inside the guard, so that a bridge which
        // cannot even be asked about it does not cost the queries below.
        tell('storeSync', () => {
          if (typeof bridge.storeSync === 'function') bridge.storeSync();
        });
        if (!caps.billing) return;
        queryProducts();
        requestRestore();
      });
    },

    // ── purchases ──

    iapAvailable(): boolean {
      return caps.billing && priceCount > 0;
    },

    products(): { def: ProductDef; info: ProductInfo }[] {
      const out: { def: ProductDef; info: ProductInfo }[] = [];
      if (!caps.billing) return out;
      for (const def of PRODUCTS) {
        const price = prices[def.id];
        if (price !== undefined) out.push({ def, info: { id: def.id, price } });
      }
      return out;
    },

    buy(id: ProductId): Promise<PurchaseOutcome> {
      const def = productDef(id);
      if (!def || !caps.billing || prices[def.id] === undefined) return Promise.resolve<PurchaseOutcome>('unavailable');
      if (buying) return Promise.resolve<PurchaseOutcome>('error'); // one purchase at a time
      if (def.kind === 'entitlement' && owned(def.id)) return Promise.resolve<PurchaseOutcome>('alreadyOwned');
      return new Promise<PurchaseOutcome>((resolve) => {
        const open: OpenPurchase = {
          id: def.id,
          resolve,
          timer: setTimeout(() => {
            if (buying === open) settleBuy(open.id, 'error');
          }, BUY_WATCHDOG_MS),
          grace: null,
          away: false,
        };
        buying = open;
        if (!tell('iapBuy', () => bridge.iapBuy(def.id)) && buying === open) settleBuy(open.id, 'error');
      });
    },

    restore(): Promise<number> {
      if (!caps.billing) return Promise.resolve(0);
      return new Promise<number>((resolve) => {
        restoreWaiters.push(resolve);
        if (restoreWaiters.length > 1) return; // already under way: answered together
        restoredCount = 0;
        restoreSettling = false;
        restoreTimer = setTimeout(settleRestore, RESTORE_WATCHDOG_MS);
        if (!requestRestore()) settleRestore();
      });
    },

    owns(id: ProductId): boolean {
      const def = productDef(id);
      return def !== null && def.kind === 'entitlement' && owned(def.id);
    },

    // ── ads ──

    adsAvailable,

    rewardedReady(): boolean {
      return adsAvailable() && ads.rewardedReady && rewardedUnlocked() && profile.adsToday().rewardedTotal < REWARDED_PER_DAY_TOTAL;
    },

    freeCoinAdsLeft(): number {
      return rewardedLeft('freeCoins');
    },

    rewardedLeft,

    showRewarded(placement: AdPlacement): Promise<RewardedOutcome> {
      if (!isPlacement(placement) || ad !== null || !adsAvailable() || !ads.rewardedReady || !rewardedUnlocked() || rewardedLeft(placement) <= 0) {
        return Promise.resolve<RewardedOutcome>('unavailable');
      }
      return new Promise<RewardedOutcome>((resolve) => {
        const mine: ActiveAd = { format: 'rewarded', placement, resolve, timer: null, away: false };
        ad = mine;
        lateAd = null;
        armAdWatchdog(AD_WATCHDOG_MS);
        if (!tell('adShowRewarded', () => bridge.adShowRewarded(placement)) && abortAd(mine)) resolve('unavailable');
      });
    },

    maybeShowInterstitial(): Promise<boolean> {
      if (!caps.ads) return Promise.resolve(false); // a build without the ad SDK has nothing to count
      // Every call is one finished level, whether or not an ad follows.
      const finished = profile.noteLevelFinished();
      if (!interstitialAllowed(finished)) return Promise.resolve(false);
      return new Promise<boolean>((resolve) => {
        const mine: ActiveAd = { format: 'interstitial', placement: null, resolve, timer: null, away: false };
        ad = mine;
        lateAd = null;
        armAdWatchdog(AD_WATCHDOG_MS);
        if (!tell('adShowInterstitial', () => bridge.adShowInterstitial()) && abortAd(mine)) resolve(false);
      });
    },

    privacyOptionsRequired(): boolean {
      return caps.ads && ads.privacyOptionsRequired;
    },

    showPrivacyOptions(): Promise<void> {
      if (!caps.ads) return Promise.resolve();
      return new Promise<void>((resolve) => {
        privacyWaiters.push(resolve);
        if (privacyTimer !== null) clearTimeout(privacyTimer);
        privacyTimer = setTimeout(settlePrivacy, PRIVACY_WATCHDOG_MS);
        if (!tell('adPrivacyOptions', () => bridge.adPrivacyOptions())) settlePrivacy();
      });
    },

    onChange(listener: () => void): () => void {
      if (typeof listener !== 'function') return () => {};
      const entry = { fn: listener };
      listeners.push(entry);
      return () => {
        const i = listeners.indexOf(entry);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
  };

  return api;
}
