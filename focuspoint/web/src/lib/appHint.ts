// The Android app opens the site with ?np=1 or ?np=0: whether the app itself may show notifications (it asks at
// launch, like any app). Chrome re-reads that permission only once per Chrome process, so the page can briefly see a
// stale "not asked yet"; the hint lets it register by itself when allowed, and not ask again right after a refusal.
// Read once at startup, kept for the session (in-app navigation drops the query) and removed from the address.
const KEY = 'fp_np', APP_KEY = 'fp_in_app'
let hint: '1' | '0' | null = null
let viaApp = false

export function readAppHint(): void {
  try {
    const u = new URL(location.href)
    const np = u.searchParams.get('np')
    if (np === '1' || np === '0') {
      sessionStorage.setItem(KEY, np)
      u.searchParams.delete('np')
      history.replaceState(history.state, '', u.pathname + u.search + u.hash)
    }
    const v = sessionStorage.getItem(KEY)
    hint = v === '1' || v === '0' ? v : null
    // Opened by the app without the hint (an older app build, or a tab Chrome restored after a restart).
    if (document.referrer.startsWith('android-app://com.focuspoint.app')) sessionStorage.setItem(APP_KEY, '1')
    viaApp = hint !== null || sessionStorage.getItem(APP_KEY) === '1'
  } catch { hint = null }
}

/** '1' = the Android app may notify, '0' = it may not, null = unknown (a normal browser, or an older app build). */
export const appNotifHint = (): '1' | '0' | null => hint
/** Opened inside the Focus Point Android app. */
export const inAndroidApp = (): boolean => viaApp
