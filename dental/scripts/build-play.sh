#!/usr/bin/env bash
# The Google Play build: the same app as scripts/build-apk.sh, built with VITE_DISTRIBUTION=play so that it never shows
# the price, the purchase request or a link to the website, whatever the phone reports about the installer (Play's
# Payments policy: a consumption-only app; src/features/settings/seller.ts). Output: android/build/play/Dentora.aab
# (upload this one to Play Console) and Dentora.apk (the same build, for testing). The APK on the website stays the
# regular build (npm run android:build), which shows the seller box.
#   ANDROID_KEYSTORE=… ANDROID_KEYSTORE_PASSWORD=… ANDROID_KEY_ALIAS=dentora ./scripts/build-play.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST_PLAY="$(mktemp -d "${TMPDIR:-/tmp}/dentora-dist-play-XXXXXX")"
trap 'rm -rf "$DIST_PLAY"' EXIT
cd "$ROOT"
VITE_DISTRIBUTION=play npx tsc --noEmit -p tsconfig.json
VITE_DISTRIBUTION=play npx vite build --outDir "$DIST_PLAY" --emptyOutDir
DIST="$DIST_PLAY" OUT_DIR="$ROOT/android/build/play" ./scripts/build-apk.sh
echo "Google Play bundle: $ROOT/android/build/play/Dentora.aab"
