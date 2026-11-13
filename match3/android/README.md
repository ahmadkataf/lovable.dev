# Zumurud — Android app

A single-activity Kotlin app that shows the bundled web game (`../dist`) in a full-screen WebView.
The game is served from the APK only; the page cannot reach the network.

## Build

```sh
tools/android/build.sh            # web build + lint + release APK + App Bundle → android/out/
tools/android/build.sh debug      # debuggable APK with the diagnostics page
tools/android/build.sh bundle     # only the .aab (the file Google Play wants)
tools/android/build.sh all --skip-web   # reuse the existing ../dist
```

Needs JDK 17+ and the Android SDK (`ANDROID_HOME`, platform `android-37.0`). Always build through
`./gradlew` (Gradle 9.9.1, checksum-pinned); AGP 9.5 has built-in Kotlin, so there is no Kotlin plugin.

| Setting | Default | Override |
|---|---|---|
| `APP_ID` | `com.zumurud.game` | `-PAPP_ID=…` or environment |
| `VERSION_CODE` | `1` | `-PVERSION_CODE=…` or environment — must grow with every Play upload |
| `VERSION_NAME` | `1.0.0` | `-PVERSION_NAME=…` or environment |
| `TARGET_SDK` | `36` | `-PTARGET_SDK=…` or environment |
| `WEB_DIST` | `../dist` | `-PWEB_DIST=/path` or environment |

## Signing

Copy `keystore.properties.example` to `keystore.properties` (git-ignored) or set
`ZUMURUD_KEYSTORE`, `ZUMURUD_KEYSTORE_PASSWORD`, `ZUMURUD_KEY_ALIAS`, `ZUMURUD_KEY_PASSWORD`.
Without a key the release still builds, signed with the debug key, prints
`NOT FOR GOOGLE PLAY` and is named `…-DEBUGSIGNED`. Never commit a keystore or a password.

## Test on an emulator or device

```sh
tools/android/emu-smoke.sh android/out/zumurud-1.0.0-debug.apk diag   # every wrapper feature, must end "fail=0 wait=0"
tools/android/emu-smoke.sh android/out/zumurud-1.0.0.apk              # the real game: loads, survives Home/return, clean log
```

The diagnostics page exists only in debug builds:
`adb shell am start -n com.zumurud.game/.MainActivity --ez diag true`
(source: `app/src/debug/assets/diag`, commands: `app/src/debug/kotlin/…/Diagnostics.kt`).
Page warnings and errors appear in Logcat under `ZumurudJS`, the wrapper's own lines under `Zumurud`.

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
| `StoreController.kt` | seam for purchases and ads; this build ships `NoStore` — return another implementation from `StoreControllers.create` |
| `src/main/keepRules/bridge.keep` | R8 keep rules for the JavaScript bridge |
| `lint.xml` | the two justified lint suppressions |
