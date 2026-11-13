# Zumurud — Android app

A single-activity Kotlin app that shows the bundled web game (`../dist`) in a full-screen WebView.
The game is served from the APK only; the page cannot reach the network. Purchases (Google Play
Billing) and ads (AdMob) are native and talk to the page over a small bridge.

## Two flavours

| Flavour | Contains | Use it when |
|---|---|---|
| `plain` | Google Play Billing. No ad SDK, no advertising-id permission. | the game is published without ads |
| `ads` | Google Play Billing + AdMob (GMA Next-Gen SDK) + Google's consent SDK (UMP) | the AdMob account and its three ids exist |

Both have the same application id — publish one of them. `storeCaps()` tells the page which one it is
running in (`{"billing":true,"ads":false|true}`).

## Build

```sh
tools/android/build.sh                          # plain: web build + lint + release APK + App Bundle → android/out/
tools/android/build.sh all --flavor ads         # the same with ads (needs the AdMob ids, below)
tools/android/build.sh debug --flavor ads       # debuggable APK with the diagnostics page (always test ads)
tools/android/build.sh bundle                   # only the .aab (the file Google Play wants)
tools/android/build.sh all --skip-web           # reuse the existing ../dist
tools/android/build.sh all --flavor ads --allow-test-ads   # a release with Google's sample ad ids: test ads, never upload
```

Needs JDK 17+ and the Android SDK (`ANDROID_HOME`, platform `android-37.0`). Always build through
`./gradlew` (Gradle 9.9.1, checksum-pinned); AGP 9.5 has built-in Kotlin, so there is no Kotlin plugin.
Gradle tasks carry the flavour in their name: `:app:assemblePlainDebug`, `:app:bundleAdsRelease`,
`:app:lintPlainRelease`, …

| Setting | Default | Override |
|---|---|---|
| `APP_ID` | `com.zumurud.game` | `-PAPP_ID=…` or environment |
| `VERSION_CODE` | `1` | `-PVERSION_CODE=…` or environment — must grow with every Play upload |
| `VERSION_NAME` | `1.0.0` | `-PVERSION_NAME=…` or environment |
| `TARGET_SDK` | `36` | `-PTARGET_SDK=…` or environment |
| `WEB_DIST` | `../dist` | `-PWEB_DIST=/path` or environment |
| `ADMOB_APP_ID`, `ADMOB_REWARDED_ID`, `ADMOB_INTERSTITIAL_ID` | `android/admob.properties` | `-P…` or environment (both win over the file) |

Output names say what a file is: `zumurud-<version>-<flavour>[-TESTADS][-DEBUGSIGNED].aab|.apk`.
Only a file with neither suffix is fit for Google Play.

On GitHub the same build runs from the Actions tab: workflow **Build Zumurud**
(`.github/workflows/build-match3.yml`, started by hand only; inputs: flavour, version code, version name).

## Signing

Copy `keystore.properties.example` to `keystore.properties` (git-ignored) or set
`ZUMURUD_KEYSTORE`, `ZUMURUD_KEYSTORE_PASSWORD`, `ZUMURUD_KEY_ALIAS`, `ZUMURUD_KEY_PASSWORD`.
Without a key the release still builds, signed with the debug key, prints
`NOT FOR GOOGLE PLAY` and is named `…-DEBUGSIGNED`. Never commit a keystore or a password.

## AdMob ids (ads flavour)

Three ids, none of them secret: the app id (with a `~`) and one rewarded and one interstitial ad
unit (each with a `/`). Give them as environment variables, as `-P` properties or in
`android/admob.properties` (see `admob.properties.example`).

- **Release** builds carry these ids. **Debug** builds never do: they always use Google's public
  **sample ids** (test ads only, `BuildConfig.ADS_TEST` is true), so real ads are never requested
  while developing.
- All three missing → a release of the ads flavour would ship the sample ids, so
  `assembleAdsRelease` / `bundleAdsRelease` are refused with a message that says so.
- To try a release build on a device with test ads: `--allow-test-ads` (Gradle:
  `-PuseSampleAdIds=true -PallowTestAds=true`). Gradle prints a loud `TEST ADS` warning and the
  files are named `…-TESTADS` — a build with test ads cannot be uploaded by accident.
- Only some of the three, or one that does not look like an AdMob id → the build stops and says which.
- Debug builds only: `ADS_TEST_DEVICE_IDS` (comma-separated test device ids) and
  `UMP_DEBUG_GEOGRAPHY` (`EEA`, `REGULATED_US_STATE`, `OTHER`) to see the consent form anywhere.

Before the first release with ads: create the consent messages in AdMob → Privacy & messaging
(European regulations, US states), and set the app's maximum ad content rating in AdMob to match the
game's rating. The app itself asks for ads rated up to PG and sets no child-directed tag (audience 13+).

## What the app is allowed to do

Merged manifest, by flavour (checked after every dependency change with
`aapt2 dump permissions <apk>` and the merge report `app/build/outputs/logs/manifest-merger-*-report.txt`):

| Permission | plain | ads | Comes from |
|---|---|---|---|
| `com.android.vending.BILLING` | ✓ | ✓ | Play Billing Library (`billing`) |
| `android.permission.INTERNET` | ✓ | ✓ | the Billing Library's transport (`transport-backend-cct`); in `ads` also the ad SDK |
| `android.permission.ACCESS_NETWORK_STATE` | ✓ | ✓ | `transport-backend-cct`, `transport-runtime`; in `ads` also the ad SDK and `androidx.work` |
| `<applicationId>.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` (signature level, the app's own) | ✓ | ✓ | `androidx.core` |
| `com.google.android.gms.permission.AD_ID` |  | ✓ | ad SDK (`ads-mobile-sdk`, `play-services-ads-identifier`) |
| `android.permission.READ_BASIC_PHONE_STATE` |  | ✓ | ad SDK |
| `android.permission.WAKE_LOCK`, `android.permission.FOREGROUND_SERVICE` |  | ✓ | `androidx.work` (a dependency of the ad SDK) |

`androidx.work` also asks for `RECEIVE_BOOT_COMPLETED`; the ad SDK's own manifest removes it again, so
it is in neither flavour. No flavour contains native code (`lib/` is absent from APK and AAB).

The app's own manifest declares none of them. INTERNET is there for the Google libraries only:
the game's WebView blocks every network load (`blockNetworkLoads`), answers every request to another
origin itself with an empty 403 (`LocalContent`), and its pages carry a policy that forbids
connections and frames to other origins. The diagnostics page proves all three on a device.

## Purchases and ads: how it behaves

- `BillingController` (both flavours): one-time products through Billing Library 9. Product ids,
  kinds and prices are not in the app: the page names the products (`iapQuery`) and shows Play's own
  price text. A purchase is reported as `purchased` only when Play says PURCHASED (never while
  PENDING); the page grants it, stores its save, and calls `iapFinish`, which first forces the save
  onto disk and then consumes (consumable) or acknowledges (entitlement). Unfinished purchases are
  reported again on every start, every return to the app and on "restore".
- `AdMobController` (ads flavour): consent first (UMP), then the ad SDK, then one rewarded and one
  interstitial ad kept ready (reloaded after showing or failing, thrown away after 55 minutes).
  Nothing is requested from ad servers before consent allows it.
- Where Google Play or the network is missing, every request is still answered: an empty product
  list, `purchase → unavailable`, `adResult → failed` — the game simply hides its offers.
- A purchase of several units at once (Play Console's optional multi-quantity setting, off by
  default) arrives as one purchase event with `quantity`; the game multiplies the pack by it.
- Purchases are verified by Google Play on the device only; there is no server check (a server is
  optional hardening, see `docs/research/billing.md`).

## Test on an emulator or device

```sh
tools/android/emu-smoke.sh android/out/zumurud-1.0.0-plain-debug.apk diag   # every wrapper feature, must end "fail=0 wait=0"
tools/android/emu-smoke.sh android/out/zumurud-1.0.0-ads-debug.apk diag
tools/android/emu-smoke.sh android/out/zumurud-1.0.0-plain-DEBUGSIGNED.apk  # the real game: loads, survives Home/return, clean log
```

The diagnostics page exists only in debug builds:
`adb shell am start -n com.zumurud.game/.MainActivity --ez diag true`
(source: `app/src/debug/assets/diag`, commands: `app/src/debug/kotlin/…/Diagnostics.kt`).
Its **store** panel (button at the top, or `adb shell input keyevent KEYCODE_S`) calls every purchase
and ad method by hand and lists every event the wrapper sends back.
Page warnings and errors appear in Logcat under `ZumurudJS`, the wrapper's own lines under `Zumurud`,
purchases under `ZumurudStore`, ads and consent under `ZumurudAds`.

To check a **release** (R8) build end to end, build it with the diagnostics page as its content and
run the same script in `diagcontent` mode:

```sh
cd android
./gradlew :app:assemblePlainRelease -PWEB_DIST=app/src/debug/assets/diag
./gradlew :app:assembleAdsRelease -PuseSampleAdIds=true -PallowTestAds=true -PWEB_DIST=app/src/debug/assets/diag
../tools/android/emu-smoke.sh app/build/outputs/apk/plain/release/app-plain-release.apk diagcontent
```

`-PadsDiagForceInit=true` (sample ids only) additionally starts the ad SDK without a consent answer,
so its start-up and "no ad" paths can be exercised on a device without network. Test bench only.

Real purchases and real ads need a device with Google Play: upload a build to the internal testing
track, add yourself as a licence tester, and use the store panel of a debug build with the same
application id.

## Icons

`node tools/android/make-icons.cjs` (with `npx vite --port 5187 --strictPort` running) redraws the
launcher icons, the splash emblem and `store/graphics/icon-512.png` from the game's emblem.
Re-run it whenever the emblem art changes and look at `shots/android/icon-preview.png`.

## Where things are

| File | What it does |
|---|---|
| `MainActivity.kt` | window (edge to edge, immersive, cutout), splash, WebView, Back, lifecycle, error screen, renderer recovery |
| `LocalContent.kt` | the only content the WebView may load: MIME types, request filter, page policy |
| `GameBridge.kt` | `window.AndroidBridge` (contract: `src/platform/types.ts`, `src/monetize/types.ts`) |
| `SaveStore.kt` | the save, in SharedPreferences file `zumurud_save` (the only thing backed up) |
| `StoreController.kt` | the store seam: `GameStore` = billing + the flavour's ads; the StoreEvent JSON |
| `BillingController.kt` | Google Play Billing: connection, products, buying, owned purchases, consume / acknowledge |
| `src/ads/…/AdMobController.kt` | ads flavour: consent (UMP), GMA Next-Gen SDK, rewarded + interstitial |
| `src/plain/…/AdsFactory.kt` | plain flavour: "no ads" answers |
| `src/ads/AndroidManifest.xml` | the AdMob app id for the consent SDK — the only manifest entry added by hand |
| `src/main/keepRules/bridge.keep` | R8 keep rules for the JavaScript bridge (the Google libraries ship their own) |
| `lint.xml` | the justified lint suppressions |
