#!/usr/bin/env bash
# Builds an APK for one book from its Vite build, with the Android build-tools only (no Gradle).
#   BOOK=bac npm run build && ./scripts/build-apk.sh bac      -> android/build/EmarBac.apk
# Requires: ANDROID_HOME with build-tools 34.0.0 + platforms/android-34, and JDK 17+.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BOOK="${1:-${BOOK:-g8}}"
SDK="${ANDROID_HOME:-/opt/android-sdk}"
BT="$SDK/build-tools/34.0.0"
AJ="$SDK/platforms/android-34/android.jar"
A="$ROOT/android"
B="$A/build/$BOOK"
META="$ROOT/src/books/$BOOK/book.json"
PKG=$(python3 -c "import json;print(json.load(open('$META'))['packageId'])")
APPNAME=$(python3 -c "import json;print(json.load(open('$META'))['appName'].replace(' ',''))")

rm -rf "$B"
mkdir -p "$B/gen" "$B/obj" "$B/dex" "$B/assets/www"
cp -r "$ROOT/dist/$BOOK/." "$B/assets/www/"
rm -f "$B/assets/www/artifact.html"
(cd "$ROOT" && python3 scripts/android-res.py "$BOOK" "$B")

"$BT/aapt2" compile --dir "$B/res" -o "$B/res.zip"
# the code keeps its own package; each book gets its own application id so both can be installed
"$BT/aapt2" link -o "$B/unsigned.apk" -I "$AJ" --manifest "$A/AndroidManifest.xml" -R "$B/res.zip" \
  --java "$B/gen" --auto-add-overlay -A "$B/assets" --min-sdk-version 24 --target-sdk-version 34 \
  --rename-manifest-package "$PKG"
javac --release 17 -cp "$AJ" -d "$B/obj" $(find "$B/gen" "$A/src" -name '*.java')
(cd "$B/obj" && jar cf ../classes.jar .)
"$BT/d8" --release --lib "$AJ" --min-api 24 --output "$B/dex" "$B/classes.jar"
(cd "$B/dex" && zip -q -u "$B/unsigned.apk" classes.dex)
"$BT/zipalign" -f -p 4 "$B/unsigned.apk" "$B/aligned.apk"

KS="$A/release.keystore"
if [ ! -f "$KS" ]; then
  keytool -genkeypair -v -keystore "$KS" -alias emar8 -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass emar8pass -keypass emar8pass -dname "CN=Emar, OU=Education, O=Emar, L=Damascus, C=SY" >/dev/null 2>&1
fi
OUT="$A/build/$APPNAME.apk"
"$BT/apksigner" sign --ks "$KS" --ks-key-alias emar8 --ks-pass pass:emar8pass --key-pass pass:emar8pass --out "$OUT" "$B/aligned.apk"
"$BT/apksigner" verify "$OUT"
ls -la "$OUT"
