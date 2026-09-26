#!/usr/bin/env bash
# Builds the Android app of one book from its Vite build, with the Android build-tools only (no Gradle):
# an APK to hand out directly, and, when bundletool is available, the App Bundle (AAB) Google Play asks for.
#   BOOK=g12 npm run build && ./scripts/build-apk.sh g12   -> android/build/Emar12.apk (+ Emar12.aab)
# Requires ANDROID_HOME with build-tools and a platform (the newest installed are used) and JDK 17+.
# Optional environment:
#   ANDROID_KEYSTORE, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS   the signing (upload) key
#   VERSION_CODE, VERSION_NAME                                       override the manifest's version
#   BUNDLETOOL                                                       bundletool-all.jar, or a bundletool launcher script, to build the AAB
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BOOK="${1:-${BOOK:-g8}}"
SDK="${ANDROID_HOME:-/opt/android-sdk}"
BT="$SDK/build-tools/$(ls "$SDK/build-tools" | grep -E '^[0-9.]+$' | sort -V | tail -1)"
PLATFORM="$(ls "$SDK/platforms" | grep -E '^android-[0-9]+$' | sort -V | tail -1)"
AJ="$SDK/platforms/$PLATFORM/android.jar"
TARGET="${PLATFORM#android-}"
A="$ROOT/android"
B="$A/build/$BOOK"
META="$ROOT/src/books/$BOOK/book.json"
PKG=$(python3 -c "import json;print(json.load(open('$META'))['packageId'])")
APPNAME=$(python3 -c "import json;print(json.load(open('$META'))['appName'].replace(' ',''))")
KS="${ANDROID_KEYSTORE:-$A/release.keystore}"
KS_PASS="${ANDROID_KEYSTORE_PASSWORD:-emar8pass}"
KS_ALIAS="${ANDROID_KEY_ALIAS:-emar8}"
VERSION=()
[ -n "${VERSION_CODE:-}" ] && VERSION+=(--version-code "$VERSION_CODE")
[ -n "${VERSION_NAME:-}" ] && VERSION+=(--version-name "$VERSION_NAME")
echo "build-tools $(basename "$BT"), target SDK $TARGET"

rm -rf "$B"
mkdir -p "$B/gen" "$B/obj" "$B/dex" "$B/assets/www"
cp -r "$ROOT/dist/$BOOK/." "$B/assets/www/"
rm -f "$B/assets/www/artifact.html"
(cd "$ROOT" && python3 scripts/android-res.py "$BOOK" "$B")

"$BT/aapt2" compile --dir "$B/res" -o "$B/res.zip"
# the code keeps its own package; each book gets its own application id so they can be installed side by side
LINK=(-I "$AJ" --manifest "$A/AndroidManifest.xml" -R "$B/res.zip" --auto-add-overlay -A "$B/assets"
  --min-sdk-version 24 --target-sdk-version "$TARGET" --rename-manifest-package "$PKG" "${VERSION[@]}")
"$BT/aapt2" link -o "$B/unsigned.apk" --java "$B/gen" "${LINK[@]}"
javac --release 17 -cp "$AJ" -d "$B/obj" $(find "$B/gen" "$A/src" -name '*.java')
(cd "$B/obj" && jar cf ../classes.jar .)
"$BT/d8" --release --lib "$AJ" --min-api 24 --output "$B/dex" "$B/classes.jar"
(cd "$B/dex" && zip -q -u "$B/unsigned.apk" classes.dex)
"$BT/zipalign" -f -p 4 "$B/unsigned.apk" "$B/aligned.apk"

if [ ! -f "$KS" ]; then
  keytool -genkeypair -v -keystore "$KS" -alias "$KS_ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" -dname "CN=Emar, OU=Education, O=Emar, L=Damascus, C=SY" >/dev/null 2>&1
fi
OUT="$A/build/$APPNAME.apk"
"$BT/apksigner" sign --ks "$KS" --ks-key-alias "$KS_ALIAS" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" --out "$OUT" "$B/aligned.apk"
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
