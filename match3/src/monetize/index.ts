// PLACEHOLDER — replaced by the monetisation module. Everything unavailable.
import type { StoreApi } from './types.ts';

export function createStore(): StoreApi {
  return {
    iapAvailable: () => false,
    products: () => [],
    buy: () => Promise.resolve('unavailable'),
    restore: () => Promise.resolve(0),
    owns: () => false,
    adsAvailable: () => false,
    rewardedReady: () => false,
    freeCoinAdsLeft: () => 0,
    showRewarded: () => Promise.resolve('unavailable'),
    maybeShowInterstitial: () => Promise.resolve(false),
    privacyOptionsRequired: () => false,
    showPrivacyOptions: () => Promise.resolve(),
    onChange: () => () => {},
  };
}
