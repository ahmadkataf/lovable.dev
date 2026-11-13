/**
 * Monetisation contract: real-money purchases (Google Play Billing) and ads (AdMob), both
 * implemented natively in the Android wrapper and reached through the bridge below.
 * The web game itself never talks to the network. Design: docs/DESIGN.md §7.
 *
 * Money safety rules that every implementation must keep:
 *  - A paid item is granted exactly once per purchase token, and only after the store reports
 *    the purchase as PURCHASED (never for PENDING). Tokens already granted are remembered.
 *  - A purchase is "finished" (consumed / acknowledged) only after the grant has been saved.
 *  - Prices shown are always the store's own localised price strings — never hard-coded.
 *  - If billing or ads are unavailable the game stays fully playable and simply hides the offers.
 */
import type { Reward } from '../state/types.ts';

export type ProductId =
  | 'coins_small'
  | 'coins_medium'
  | 'coins_large'
  | 'coins_xl'
  | 'coins_mega'
  | 'starter_pack'
  | 'remove_ads';

export interface ProductDef {
  id: ProductId;
  /** consumable = can be bought again (coin packs); entitlement = owned forever, restorable. */
  kind: 'consumable' | 'entitlement';
  /** What the player receives when the purchase completes. */
  grants: Reward[];
  /** Owning it disables interstitial ads. */
  removesAds: boolean;
  /** Ribbon shown in the shop. */
  badge?: 'popular' | 'best';
}

export interface ProductInfo {
  id: ProductId;
  /** Localised, formatted price from the store, e.g. "US$0.99", "٣٫٩٩ ر.س". */
  price: string;
}

export type PurchaseOutcome =
  /** paid and granted */
  | 'purchased'
  /** payment is pending (e.g. cash / slow method); it is granted later when it completes */
  | 'pending'
  | 'cancelled'
  | 'alreadyOwned'
  | 'unavailable'
  | 'error';

/** Where a rewarded ad is offered. Each is strictly opt-in and states the reward before the ad starts. */
export type AdPlacement =
  /** lose dialog: +3 moves (fewer than the paid continue), once per attempt */
  | 'extraMoves'
  /** out-of-lives dialog: +1 life, limited per day */
  | 'freeLife'
  /** shop: bonus coins, limited per day */
  | 'freeCoins'
  /** win dialog: double the coins earned for the level */
  | 'doubleReward';

export type RewardedOutcome = 'earned' | 'dismissed' | 'unavailable';

export interface StoreApi {
  // ── purchases ──
  /** True when real-money products can be shown (billing connected and prices known). */
  iapAvailable(): boolean;
  /** Catalogue entries whose price is known, in display order. */
  products(): { def: ProductDef; info: ProductInfo }[];
  buy(id: ProductId): Promise<PurchaseOutcome>;
  /** Re-check owned entitlements (also runs automatically at start). Resolves to how many were restored. */
  restore(): Promise<number>;
  owns(id: ProductId): boolean;

  // ── ads ──
  /** True when this build contains the ad SDK and consent allows requesting ads. */
  adsAvailable(): boolean;
  /**
   * True when a rewarded ad could be shown right now for at least one placement: an ad is loaded,
   * the player has reached the level where rewarded ads start, and today's total is not used up.
   */
  rewardedReady(): boolean;
  /** How many more 'freeCoins' ads may be watched today. */
  freeCoinAdsLeft(): number;
  /**
   * How many more rewarded ads of this placement may be watched today (its own daily limit and the
   * daily total, whichever is lower). Says nothing about an ad being loaded: see rewardedReady().
   * Optional in the contract so that older test doubles stay valid; `createStore` always provides it.
   */
  rewardedLeft?(placement: AdPlacement): number;
  /**
   * Show a rewarded ad. The store only does the bookkeeping (daily counts): the CALLER applies the
   * reward when this resolves 'earned'.
   */
  showRewarded(placement: AdPlacement): Promise<RewardedOutcome>;
  /**
   * Called when a level has ended and the result dialog was dismissed. Shows an interstitial if the
   * frequency rules allow; resolves when the ad is closed (immediately with false if none shown).
   */
  maybeShowInterstitial(): Promise<boolean>;
  /** Whether a "Privacy options" entry must be shown in settings (consent regions). */
  privacyOptionsRequired(): boolean;
  showPrivacyOptions(): Promise<void>;

  /** Fires when products, ownership, ad readiness or consent state change. */
  onChange(listener: () => void): () => void;
}

/** What `createStore` returns: the contract with every optional member present. */
export interface FullStoreApi extends StoreApi {
  rewardedLeft(placement: AdPlacement): number;
}

// ───────────────────── native bridge (Android wrapper) ─────────────────────

/** Extra methods on window.AndroidBridge. All return immediately; results arrive as StoreEvents. */
export interface MonetizeBridge {
  /** JSON: { "billing": boolean, "ads": boolean } — what this build was compiled with. */
  storeCaps(): string;
  /** Ask for product details. `idsJson` = JSON array of { id, kind: 'consumable' | 'entitlement' }. → 'products' event */
  iapQuery(idsJson: string): void;
  /** Start the purchase flow. → 'purchase' event(s) */
  iapBuy(id: string): void;
  /** JS has granted and saved this purchase: consume (consumable) or acknowledge (entitlement) it. */
  iapFinish(token: string): void;
  /** Re-report every purchase the store knows about. → 'owned' event, plus 'purchase' events for unfinished ones */
  iapRestore(): void;
  /** → 'adResult' event */
  adShowRewarded(placement: string): void;
  /** → 'adResult' event */
  adShowInterstitial(): void;
  /** Open the consent "privacy options" form. → 'ads' event afterwards */
  adPrivacyOptions(): void;
  /**
   * Optional (feature-detected). Called once when the page has installed `window.__native.store`:
   * the wrapper should then (re)send its current 'ads' event, because anything it emitted before
   * the page was listening is lost. Without this method the wrapper should do the same on the
   * page's first iapQuery / iapRestore.
   */
  storeSync?(): void;
}

export type StoreEvent =
  | { type: 'products'; products: { id: string; price: string }[] }
  | {
      type: 'purchase';
      id: string;
      state: 'purchased' | 'pending' | 'cancelled' | 'alreadyOwned' | 'unavailable' | 'error';
      /** Present for 'purchased': the purchase token to pass to iapFinish. */
      token?: string;
      /** True when the store had already acknowledged it earlier (a restore, not a fresh buy). */
      acknowledged?: boolean;
    }
  /**
   * Entitlements currently owned (acknowledged, non-consumable).
   * `complete: true` (optional) says that `ids` is the whole answer of a SUCCESSFUL query of the
   * store; only then is ownership of an entitlement that is not listed taken away. Without it the
   * list can only add ownership — so a store that could not connect, and therefore reports an
   * empty list, never removes anything.
   */
  | { type: 'owned'; ids: string[]; complete?: boolean }
  | { type: 'ads'; canRequestAds: boolean; rewardedReady: boolean; interstitialReady: boolean; privacyOptionsRequired: boolean }
  | { type: 'adResult'; format: 'rewarded' | 'interstitial'; result: 'earned' | 'dismissed' | 'failed' };

/**
 * The wrapper delivers events by calling `window.__native.store(json)` with a JSON-encoded StoreEvent.
 */
