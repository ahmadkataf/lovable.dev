#!/usr/bin/env bash
# Builds the Android app from the Vite build, with the Android build-tools only (no Gradle):
#   npm run build && ./scripts/build-apk.sh   -> android/build/LaserBox.apk
# Requires ANDROID_HOME with build-tools and a platform (the newest installed are used) and JDK 17+.
# Optional environment:
#   ANDROID_KEYSTORE, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS   the signing key (a throwaway one is made otherwise)
#   VERSION_CODE, VERSION_NAME                                       override the manifest's version
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SDK="${ANDROID_HOME:-/opt/android-sdk}"
BT="$SDK/build-tools/$(ls "$SDK/build-tools" | grep -E '^[0-9.]+$' | sort -V | tail -1)"
PLATFORM="$(ls "$SDK/platforms" | grep -E '^android-[0-9]+$' | sort -V | tail -1)"
AJ="$SDK/platforms/$PLATFORM/android.jar"
TARGET="${PLATFORM#android-}"
A="$ROOT/android"
B="$A/build/work"
KS="${ANDROID_KEYSTORE:-$A/release.keystore}"
KS_PASS="${ANDROID_KEYSTORE_PASSWORD:-laserboxpass}"
KS_ALIAS="${ANDROID_KEY_ALIAS:-laserbox}"
VERSION=()
[ -n "${VERSION_CODE:-}" ] && VERSION+=(--version-code "$VERSION_CODE")
[ -n "${VERSION_NAME:-}" ] && VERSION+=(--version-name "$VERSION_NAME")
[ ${#VERSION[@]} -gt 0 ] && VERSION+=(--replace-version)
echo "build-tools $(basename "$BT"), target SDK $TARGET"

[ -f "$ROOT/dist/index.html" ] || { echo "Run 'npm run build' first (no dist/index.html)"; exit 1; }
rm -rf "$B"
mkdir -p "$B/gen" "$B/obj" "$B/dex" "$B/assets/www"
cp -r "$ROOT/dist/." "$B/assets/www/"
rm -f "$B/assets/www/artifact.html"
(cd "$ROOT" && python3 scripts/android-res.py "$B")

"$BT/aapt2" compile --dir "$B/res" -o "$B/res.zip"
"$BT/aapt2" link -o "$B/unsigned.apk" --java "$B/gen" -I "$AJ" --manifest "$A/AndroidManifest.xml" -R "$B/res.zip" \
  --auto-add-overlay -A "$B/assets" --min-sdk-version 24 --target-sdk-version "$TARGET" "${VERSION[@]}"
javac --release 17 -encoding UTF-8 -cp "$AJ" -d "$B/obj" $(find "$B/gen" "$A/src" -name '*.java')
(cd "$B/obj" && jar cf ../classes.jar .)
"$BT/d8" --release --lib "$AJ" --min-api 24 --output "$B/dex" "$B/classes.jar"
(cd "$B/dex" && zip -q -u "$B/unsigned.apk" classes.dex)
"$BT/zipalign" -f -p 4 "$B/unsigned.apk" "$B/aligned.apk"

if [ ! -f "$KS" ]; then
  keytool -genkeypair -v -keystore "$KS" -alias "$KS_ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" -dname "CN=LaserBox, OU=Maker, O=LaserBox, L=Damascus, C=SY" >/dev/null 2>&1
fi
OUT="$A/build/LaserBox.apk"
"$BT/apksigner" sign --ks "$KS" --ks-key-alias "$KS_ALIAS" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" --out "$OUT" "$B/aligned.apk"
"$BT/apksigner" verify "$OUT"
ls -la "$OUT"
# the claude.ai viewer page can carry only text beside it: the app as base64, for its «تطبيق أندرويد» button
base64 -w0 "$OUT" > "$A/build/LaserBox-apk.b64.txt"
