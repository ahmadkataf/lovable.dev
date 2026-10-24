#!/usr/bin/env bash
# Build the signed release APK (and AAB for Google Play) of the Focus Point app.
#   ./build.sh https://your-domain.example [versionCode] [versionName]
# Needs: JDK 17+, Gradle 8.11+ (or /opt/gradle), ANDROID_HOME with platforms;android-35 + build-tools;35.0.0,
# and the release keystore in keystore/ (focuspoint-release.jks + README-PRIVATE.txt with the password).
set -euo pipefail
cd "$(dirname "$0")"
URL="${1:?usage: ./build.sh https://domain [versionCode] [versionName]}"
VC="${2:-1}"; VN="${3:-1.0.0}"
PASS=$(grep -m1 'store password:' keystore/README-PRIVATE.txt | sed 's/.*: //')
export ANDROID_HOME="${ANDROID_HOME:-/opt/android-sdk}"
GRADLE="${GRADLE:-$(command -v gradle || echo /opt/gradle/bin/gradle)}"
"$GRADLE" --no-daemon -q ${GRADLE_FLAGS:-} -PtwaUrl="$URL" -PversionCode="$VC" -PversionName="$VN" \
  -PksFile="$PWD/keystore/focuspoint-release.jks" -PksPass="$PASS" -PkeyAlias=focuspoint -PkeyPass="$PASS" \
  assembleRelease bundleRelease
mkdir -p out
cp app/build/outputs/apk/release/app-release.apk "out/FocusPoint-$VN.apk"
cp app/build/outputs/bundle/release/app-release.aab "out/FocusPoint-$VN.aab"
"$ANDROID_HOME/build-tools/35.0.0/apksigner" verify --print-certs "out/FocusPoint-$VN.apk" | grep -E 'SHA-256|Verified' | head -3
echo "→ out/FocusPoint-$VN.apk (direct install) and out/FocusPoint-$VN.aab (Google Play)"
echo "Serve assetlinks.json at $URL/.well-known/assetlinks.json so Android trusts the app for this site."
