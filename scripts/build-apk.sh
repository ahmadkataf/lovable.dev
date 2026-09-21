#!/usr/bin/env bash
# Builds android/build/Emar8.apk from the Vite build (dist/) using only the Android build-tools (no Gradle).
# Requires: ANDROID_HOME with build-tools 34.0.0 + platforms/android-34, JDK 17+, and a prior `npm run build`.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SDK="${ANDROID_HOME:-/opt/android-sdk}"
BT="$SDK/build-tools/34.0.0"
AJ="$SDK/platforms/android-34/android.jar"
A="$ROOT/android"
B="$A/build"
rm -rf "$B" "$A/assets"
mkdir -p "$B/gen" "$B/obj" "$B/dex" "$A/assets/www"
cp -r "$ROOT/dist/." "$A/assets/www/"
rm -f "$A/assets/www/artifact.html"

"$BT/aapt2" compile --dir "$A/res" -o "$B/res.zip"
"$BT/aapt2" link -o "$B/unsigned.apk" -I "$AJ" --manifest "$A/AndroidManifest.xml" -R "$B/res.zip" \
  --java "$B/gen" --auto-add-overlay -A "$A/assets" --min-sdk-version 24 --target-sdk-version 34
javac --release 17 -cp "$AJ" -d "$B/obj" $(find "$B/gen" "$A/src" -name '*.java')
"$BT/d8" --release --lib "$AJ" --min-api 24 --output "$B/dex" $(find "$B/obj" -name '*.class')
(cd "$B/dex" && zip -q -u "$B/unsigned.apk" classes.dex)
"$BT/zipalign" -f -p 4 "$B/unsigned.apk" "$B/aligned.apk"

KS="$A/release.keystore"
if [ ! -f "$KS" ]; then
  keytool -genkeypair -v -keystore "$KS" -alias emar8 -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass emar8pass -keypass emar8pass -dname "CN=Emar 8, OU=Education, O=Emar, L=Damascus, C=SY" >/dev/null 2>&1
fi
"$BT/apksigner" sign --ks "$KS" --ks-key-alias emar8 --ks-pass pass:emar8pass --key-pass pass:emar8pass \
  --out "$B/Emar8.apk" "$B/aligned.apk"
"$BT/apksigner" verify "$B/Emar8.apk"
ls -la "$B/Emar8.apk"
