# Open issues for the Android hardening pass (from the lead)

Read this before auditing. Each item must be fixed or explicitly refuted with evidence, then removed
from this file.

## A. Owner's rule on ad ids (binding)
`android/admob.properties` now holds the REAL AdMob ids of this app. The owner requires:
- **release** builds of the `ads` flavour use the real ids;
- **debug / development** builds ALWAYS use Google's public sample ids (test ads), even when real ids are
  configured — real ads must never be requested from a development build.
The current Gradle logic applies whatever is configured to every build type. Make the ids
build-type aware (BuildConfig fields and the manifest app-id placeholder), keep the release guard
against sample ids, and verify both by inspecting the built APKs (`aapt2 dump xmltree` for the manifest
meta-data and the BuildConfig constants in the dex).

## B. Findings from the independent review of the web-side store logic (cross-checked against the Kotlin)
1. `BillingController.kt` — in `report()` the `else -> Unit` branch together with clearing `buying`:
   an OK `onPurchasesUpdated` whose purchase is in `UNSPECIFIED_STATE` clears the open flow but sends
   NO `purchase` event, so the page's `buy()` gets no answer (the page recovers only 30 s after the app
   returns). Send an explicit `error` result for that product.
2. `BillingController.kt` — `STALE_BUY_MS = 60 s` is measured from the start of the purchase, while the
   page frees the shop 30 s after the app returns; a retry in between gets one `error`. End a silent
   flow from the wrapper itself on resume.
3. `AdMobController.kt` — the "did not open" timeout acts only while resumed and is never repeated, and
   the resume check requires `state.shown`: an ad that never opened while the app was briefly in the
   background leaves `showing` set for ever, so every later ad request answers `failed` until restart.
4. `GameBridge.kt` — `storeSave` returns nothing even when `SaveStore.store()` refuses the payload
   (harmless now because the page reads the save back, but log it).

## C. Contract additions made on the web side (already tolerated, confirm on the native side)
- `purchase` events may carry `quantity` (> 1 only) — multi-quantity consumables grant quantity ×.
- `alreadyOwned` is NOT treated as ownership by the page: it only triggers a listing request
  (`iapRestore`). Make sure an `owned` listing follows.
- The page reads the save back through `loadSave()` before calling `iapFinish` and, on Android, also
  requires the wrapper's own copy to hold the purchase.
