#!/usr/bin/env bash
# Builds the Android app (APK) from the web build in dist/, with the Android build-tools only (no Gradle).
#   npm run build && ./android/build-apk.sh        -> android/build/AlRadwan-Garage.apk
# Needs ANDROID_HOME (build-tools + a platform) and JDK 17+. Optional: ANDROID_KEYSTORE, ANDROID_KEYSTORE_PASSWORD,
# ANDROID_KEY_ALIAS (the signing key; a throwaway one is made when absent), VERSION_CODE, VERSION_NAME, and
# BUNDLETOOL (the path of bundletool-all.jar): with it the Google Play bundle android/build/AlRadwan-Garage.aab is
# made too, signed with the same key (Google Play takes only bundles, signed with the shop's permanent upload key).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/opt/android-sdk}}"
BT="$SDK/build-tools/$(ls "$SDK/build-tools" | grep -E '^[0-9.]+$' | sort -V | tail -1)"
PLATFORM="$(ls "$SDK/platforms" | grep -E '^android-[0-9]+$' | sort -V | tail -1)"
AJ="$SDK/platforms/$PLATFORM/android.jar"
A="$ROOT/android"
B="$A/build/work"
KS="${ANDROID_KEYSTORE:-$A/release.keystore}"
KS_PASS="${ANDROID_KEYSTORE_PASSWORD:-alradwan-pass}"
KS_ALIAS="${ANDROID_KEY_ALIAS:-alradwan}"
# version: from the environment (CI), else the package version and the minute of the build (a local build still updates over an older one)
VERSION_NAME="${VERSION_NAME:-$(node -p "require('$ROOT/package.json').version")}"
VERSION_CODE="${VERSION_CODE:-$(( ($(date +%s) - 1700000000) / 60 ))}"
VERSION=(--version-code "$VERSION_CODE" --version-name "$VERSION_NAME")
[ ${#VERSION[@]} -gt 0 ] && VERSION+=(--replace-version)
echo "build-tools $(basename "$BT"), platform $PLATFORM"
[ -f "$ROOT/dist/index.html" ] || { echo "Run 'npm run build' first (dist/ is missing)"; exit 1; }

rm -rf "$B"
mkdir -p "$B/gen" "$B/obj" "$B/dex" "$B/assets/www"
cp -r "$ROOT/dist/." "$B/assets/www/"

"$BT/aapt2" compile --dir "$A/res" -o "$B/res.zip"
"$BT/aapt2" link -o "$B/unsigned.apk" --java "$B/gen" -I "$AJ" --manifest "$A/AndroidManifest.xml" -R "$B/res.zip" --auto-add-overlay -A "$B/assets" \
  --min-sdk-version 24 --target-sdk-version "${PLATFORM#android-}" "${VERSION[@]}"
javac --release 17 -encoding UTF-8 -cp "$AJ" -d "$B/obj" $(find "$B/gen" "$A/src" -name '*.java')
(cd "$B/obj" && jar cf ../classes.jar .)
"$BT/d8" --release --lib "$AJ" --min-api 24 --output "$B/dex" "$B/classes.jar"
(cd "$B/dex" && zip -q -u "$B/unsigned.apk" classes.dex)
"$BT/zipalign" -f -p 4 "$B/unsigned.apk" "$B/aligned.apk"

if [ ! -f "$KS" ]; then
  keytool -genkeypair -v -keystore "$KS" -alias "$KS_ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" -dname "CN=AlRadwan Garage, O=AlRadwan, L=Damascus, C=SY" >/dev/null 2>&1
fi
OUT="$A/build/AlRadwan-Garage.apk"
"$BT/apksigner" sign --ks "$KS" --ks-key-alias "$KS_ALIAS" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" --out "$OUT" "$B/aligned.apk"
"$BT/apksigner" verify "$OUT"
ls -la "$OUT"

if [ -n "${BUNDLETOOL:-}" ]; then
  # the bundle: the same app with its resources in protobuf form, laid out as bundletool's "base" module
  "$BT/aapt2" link --proto-format -o "$B/proto.apk" -I "$AJ" --manifest "$A/AndroidManifest.xml" -R "$B/res.zip" --auto-add-overlay -A "$B/assets" \
    --min-sdk-version 24 --target-sdk-version "${PLATFORM#android-}" "${VERSION[@]}"
  mkdir -p "$B/base/manifest" "$B/base/dex"
  (cd "$B/base" && unzip -q ../proto.apk && mv AndroidManifest.xml manifest/)
  cp "$B/dex/classes.dex" "$B/base/dex/"
  (cd "$B/base" && zip -q -r ../base.zip .)
  AAB="$A/build/AlRadwan-Garage.aab"
  java -jar "$BUNDLETOOL" build-bundle --modules="$B/base.zip" --output="$AAB" --overwrite
  jarsigner -sigalg SHA256withRSA -digestalg SHA-256 -keystore "$KS" -storepass "$KS_PASS" -keypass "$KS_PASS" "$AAB" "$KS_ALIAS" >/dev/null
  jarsigner -verify "$AAB" | tail -1
  java -jar "$BUNDLETOOL" validate --bundle="$AAB" >/dev/null
  ls -la "$AAB"
fi
