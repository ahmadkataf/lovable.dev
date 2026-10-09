#!/usr/bin/env bash
# Builds the Android app of Kaseb from its Vite build, with the Android build-tools only (no Gradle):
# an APK to hand out directly and, when bundletool is available, the App Bundle (AAB) Google Play asks for.
#   npm run build:apk            -> android/build/Kaseb.apk (+ Kaseb.aab)
# Requires ANDROID_HOME with build-tools and a platform (the newest installed are used), JDK 17+, python3 + Pillow,
# and the icons from `node scripts/make-icons.mjs` (build/icon.png).
# Optional environment:
#   ANDROID_KEYSTORE, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS   the signing (upload) key; a throwaway one is
#                                                                    generated at android/release.keystore when missing
#   VERSION_CODE, VERSION_NAME                                       override the manifest's version
#   BUNDLETOOL                                                       bundletool-all.jar, or a bundletool launcher, to build the AAB
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/opt/android-sdk}}"
[ -d "$SDK/build-tools" ] || { echo "No Android SDK at $SDK (set ANDROID_HOME)"; exit 1; }
BT="$SDK/build-tools/$(ls "$SDK/build-tools" | grep -E '^[0-9.]+$' | sort -V | tail -1)"
PLATFORM="$(ls "$SDK/platforms" | grep -E '^android-[0-9]+$' | sort -V | tail -1)"
AJ="$SDK/platforms/$PLATFORM/android.jar"
TARGET="${PLATFORM#android-}"
A="$ROOT/android"
B="$A/build/app"
APPNAME="Kaseb"
PKG=$(sed -n 's/.*package="\([^"]*\)".*/\1/p' "$A/AndroidManifest.xml" | head -1)
KS="${ANDROID_KEYSTORE:-$A/release.keystore}"
KS_PASS="${ANDROID_KEYSTORE_PASSWORD:-kasebpass}"
KS_ALIAS="${ANDROID_KEY_ALIAS:-kaseb}"
VERSION=()
[ -n "${VERSION_CODE:-}" ] && VERSION+=(--version-code "$VERSION_CODE")
[ -n "${VERSION_NAME:-}" ] && VERSION+=(--version-name "$VERSION_NAME")
# aapt2 only fills in a version the manifest lacks unless told to replace it
[ ${#VERSION[@]} -gt 0 ] && VERSION+=(--replace-version)
[ -d "$ROOT/dist" ] && [ -f "$ROOT/dist/index.html" ] || { echo "No web build at $ROOT/dist — run 'npx vite build' first"; exit 1; }
[ -f "$ROOT/build/icon.png" ] || { echo "No icons at $ROOT/build — run 'node scripts/make-icons.mjs' first"; exit 1; }
echo "Kaseb ($PKG): build-tools $(basename "$BT"), target SDK $TARGET"

rm -rf "$B"
mkdir -p "$B/gen" "$B/obj" "$B/dex" "$B/assets/www"
cp -r "$ROOT/dist/." "$B/assets/www/"
python3 "$ROOT/scripts/android-res.py" "$B"

"$BT/aapt2" compile --dir "$B/res" -o "$B/res.zip"
LINK=(-I "$AJ" --manifest "$A/AndroidManifest.xml" -R "$B/res.zip" --auto-add-overlay -A "$B/assets"
  --min-sdk-version 24 --target-sdk-version "$TARGET" "${VERSION[@]}")
"$BT/aapt2" link -o "$B/unsigned.apk" --java "$B/gen" "${LINK[@]}"
javac --release 17 -encoding UTF-8 -Xlint:-options -cp "$AJ" -d "$B/obj" $(find "$B/gen" "$A/src" -name '*.java')
(cd "$B/obj" && jar cf ../classes.jar .)
"$BT/d8" --release --lib "$AJ" --min-api 24 --output "$B/dex" "$B/classes.jar"
(cd "$B/dex" && zip -q -u "$B/unsigned.apk" classes.dex)
"$BT/zipalign" -f -p 4 "$B/unsigned.apk" "$B/aligned.apk"

if [ ! -f "$KS" ]; then
  echo "No keystore at $KS: generating one (keep it safe — updates must be signed with the same key)"
  keytool -genkeypair -v -keystore "$KS" -alias "$KS_ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" -dname "CN=Kaseb, OU=POS, O=Kaseb, L=Damascus, C=SY" >/dev/null 2>&1
fi
mkdir -p "$A/build"
OUT="$A/build/$APPNAME.apk"
"$BT/apksigner" sign --ks "$KS" --ks-key-alias "$KS_ALIAS" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" --out "$OUT" "$B/aligned.apk"
"$BT/apksigner" verify --print-certs "$OUT" | grep -i 'SHA-256' || true
"$BT/apksigner" verify "$OUT"
ls -la "$OUT"

# ---- App Bundle for Google Play: the same app, with resources in protobuf form, packed by bundletool
if [ -n "${BUNDLETOOL:-}" ] && [ -f "$BUNDLETOOL" ]; then
  bt() { if [[ "$BUNDLETOOL" == *.jar ]]; then java -jar "$BUNDLETOOL" "$@"; else "$BUNDLETOOL" "$@"; fi; }
  "$BT/aapt2" link --proto-format -o "$B/proto.zip" "${LINK[@]}"
  M="$B/base"; rm -rf "$M"; mkdir -p "$M/manifest" "$M/dex"
  (cd "$M" && unzip -q "$B/proto.zip")
  mv "$M/AndroidManifest.xml" "$M/manifest/AndroidManifest.xml"
  cp "$B/dex/classes.dex" "$M/dex/classes.dex"
  rm -f "$B/base.zip"; (cd "$M" && zip -q -r "$B/base.zip" .)
  AAB="$A/build/$APPNAME.aab"; rm -f "$AAB"
  bt build-bundle --modules="$B/base.zip" --output="$AAB"
  jarsigner -keystore "$KS" -storepass "$KS_PASS" -keypass "$KS_PASS" -sigalg SHA256withRSA -digestalg SHA-256 "$AAB" "$KS_ALIAS" >/dev/null
  bt validate --bundle="$AAB" >/dev/null
  ls -la "$AAB"
else
  echo "(no BUNDLETOOL: skipped the App Bundle)"
fi
