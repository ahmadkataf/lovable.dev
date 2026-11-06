#!/usr/bin/env bash
# Builds the مَدار Android shell into an installable APK with the Android build-tools alone (no Gradle), the way
# scripts/build-apk.sh at the repository root builds the Emar apps:
#   aapt2 compile/link  →  javac --release 17  →  d8  →  zipalign  →  apksigner
#
#   ./build-apk.sh                                   → ../../site/app/madar.apk  (served by the pitch site at /app/madar.apk)
#   VERSION_CODE=2 VERSION_NAME=1.1 ./build-apk.sh   → the same with the manifest's version replaced
#
# Needs a JDK 17+ (javac, jar, keytool), zip, and ANDROID_HOME (default /opt/android-sdk) holding build-tools and the
# android-34 platform (a newer platform is used when 34 is absent; the newest build-tools present are used). python3 with
# Pillow is needed only when the icons are regenerated: REGEN_RES=1, or when res/ has no PNGs yet (see android-res.py).
# Optional: OUT (output path), ANDROID_KEYSTORE / ANDROID_KEYSTORE_PASSWORD / ANDROID_KEY_ALIAS (defaults: release.keystore
# here, madar-2026, madar). The keystore is created on the first build and committed, so that every build signs with the
# same key — Android installs an update only over an app with the same signature.
set -euo pipefail
A="$(cd "$(dirname "$0")" && pwd)"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/opt/android-sdk}}"
newest() { ls "$1" 2>/dev/null | grep -E "$2" | sort -V | tail -1; }
BT="$SDK/build-tools/$(newest "$SDK/build-tools" '^[0-9.]+$')"
PLATFORM="$([ -d "$SDK/platforms/android-34" ] && echo android-34 || newest "$SDK/platforms" '^android-[0-9]+$')"
AJ="$SDK/platforms/$PLATFORM/android.jar"
[ -x "$BT/aapt2" ] && [ -f "$AJ" ] || { echo "No build-tools or platform under $SDK — see README.md for sdkmanager." >&2; exit 1; }
B="$A/build"
OUT="${OUT:-$A/../../site/app/madar.apk}"
KS="${ANDROID_KEYSTORE:-$A/release.keystore}"
KS_PASS="${ANDROID_KEYSTORE_PASSWORD:-madar-2026}"
KS_ALIAS="${ANDROID_KEY_ALIAS:-madar}"
VERSION=()
[ -n "${VERSION_CODE:-}" ] && VERSION+=(--version-code "$VERSION_CODE")
[ -n "${VERSION_NAME:-}" ] && VERSION+=(--version-name "$VERSION_NAME")
# aapt2 only fills in a version the manifest lacks unless told to replace it
[ ${#VERSION[@]} -gt 0 ] && VERSION+=(--replace-version)
echo "build-tools $(basename "$BT"), platform $PLATFORM"

rm -rf "$B"
mkdir -p "$B/gen" "$B/obj" "$B/dex"
if [ -n "${REGEN_RES:-}" ] || [ ! -f "$A/res/mipmap-xxxhdpi/ic_launcher.png" ]; then
  python3 "$A/android-res.py"
fi

"$BT/aapt2" compile --dir "$A/res" -o "$B/res.zip"
"$BT/aapt2" link -o "$B/unsigned.apk" --java "$B/gen" -I "$AJ" --manifest "$A/AndroidManifest.xml" -R "$B/res.zip" \
  --auto-add-overlay -A "$A/assets" ${VERSION[@]+"${VERSION[@]}"}
mapfile -t SOURCES < <(find "$B/gen" "$A/src" -name '*.java' | sort)
javac --release 17 -encoding UTF-8 -cp "$AJ" -d "$B/obj" "${SOURCES[@]}"
(cd "$B/obj" && jar cf ../classes.jar .)
"$BT/d8" --release --lib "$AJ" --min-api 24 --output "$B/dex" "$B/classes.jar"
(cd "$B/dex" && zip -q -u "$B/unsigned.apk" classes.dex)
"$BT/zipalign" -f -p 4 "$B/unsigned.apk" "$B/aligned.apk"

if [ ! -f "$KS" ]; then
  echo "creating $KS (alias $KS_ALIAS)"
  keytool -genkeypair -keystore "$KS" -alias "$KS_ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" -dname "CN=Madar, OU=Education, O=Raqeem, L=Daraa, C=SY" >/dev/null 2>&1
fi
mkdir -p "$(dirname "$OUT")"
"$BT/apksigner" sign --ks "$KS" --ks-key-alias "$KS_ALIAS" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" \
  --v4-signing-enabled false --out "$OUT" "$B/aligned.apk"   # no .idsig side-file next to the APK
"$BT/apksigner" verify "$OUT"
ls -la "$OUT"
