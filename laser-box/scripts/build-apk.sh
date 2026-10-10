#!/usr/bin/env bash
# Builds the Android app from the Vite build, with the Android build-tools only (no Gradle):
#   npm run build && ./scripts/build-apk.sh   -> android/build/LaserBox.apk (to share) and LaserBox.aab (for Google Play)
# Requires ANDROID_HOME with build-tools and a platform (the newest installed are used), JDK 17+, and for the .aab
# bundletool (BUNDLETOOL_CP: a classpath with its jars; /opt/bundletool/lib/* by default).
# Signing: the app must always be signed with the same key, or phones refuse its updates and Google Play refuses
# the upload. The key is never kept in the repository (it is public). Give it as either
#   ANDROID_KEYSTORE_BASE64   the .p12 keystore, base64 (for an environment secret), or
#   ANDROID_KEYSTORE          a path to it,
# with ANDROID_KEYSTORE_PASSWORD and optionally ANDROID_KEY_ALIAS (default laserbox). Without them the build is
# signed with a throwaway key and says so: fine for a test, never for sharing.
# Optional: VERSION_CODE, VERSION_NAME override the manifest's version.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SDK="${ANDROID_HOME:-/opt/android-sdk}"
BT="$SDK/build-tools/$(ls "$SDK/build-tools" | grep -E '^[0-9.]+$' | sort -V | tail -1)"
PLATFORM="$(ls "$SDK/platforms" | grep -E '^android-[0-9]+$' | sort -V | tail -1)"
AJ="$SDK/platforms/$PLATFORM/android.jar"
TARGET="${PLATFORM#android-}"
A="$ROOT/android"
B="$A/build/work"
KS_ALIAS="${ANDROID_KEY_ALIAS:-laserbox}"
BUNDLETOOL_CP="${BUNDLETOOL_CP:-/opt/bundletool/lib/*}"
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
# one self-contained page (the script and the styles inline): the app loads it directly, with nothing to fetch
python3 - "$B/assets/www" <<'PY'
import re, sys, os
www = sys.argv[1]
html = open(os.path.join(www, 'index.html'), encoding='utf-8').read()
def inline_js(m):
    js = open(os.path.join(www, m.group(1)), encoding='utf-8').read()
    assert '</script' not in js
    return '<script type="module">' + js + '</script>'
def inline_css(m):
    return '<style>' + open(os.path.join(www, m.group(1)), encoding='utf-8').read() + '</style>'
html, nj = re.subn(r'<script type="module"[^>]*src="\./(assets/[^"]+\.js)"[^>]*></script>', inline_js, html)
html, nc = re.subn(r'<link rel="stylesheet"[^>]*href="\./(assets/[^"]+\.css)"[^>]*>', inline_css, html)
assert nj == 1 and nc == 1, (nj, nc)
# the module runs after the body is parsed, as it did from its own file
html = html.replace('<script type="module">', '<script type="module" data-inline>')
open(os.path.join(www, 'index.html'), 'w', encoding='utf-8').write(html)
PY
rm -rf "$B/assets/www/assets"   # inlined above: the separate script and styles would only double the app's size
(cd "$ROOT" && python3 scripts/android-res.py "$B")

"$BT/aapt2" compile --dir "$B/res" -o "$B/res.zip"
"$BT/aapt2" link -o "$B/unsigned.apk" --java "$B/gen" -I "$AJ" --manifest "$A/AndroidManifest.xml" -R "$B/res.zip" \
  --auto-add-overlay -A "$B/assets" --min-sdk-version 24 --target-sdk-version "$TARGET" "${VERSION[@]}"
javac --release 17 -encoding UTF-8 -cp "$AJ" -d "$B/obj" $(find "$B/gen" "$A/src" -name '*.java')
(cd "$B/obj" && jar cf ../classes.jar .)
"$BT/d8" --release --lib "$AJ" --min-api 24 --output "$B/dex" "$B/classes.jar"
(cd "$B/dex" && zip -q -u "$B/unsigned.apk" classes.dex)
"$BT/zipalign" -f -p 4 "$B/unsigned.apk" "$B/aligned.apk"

# the signing key (see the top of this file)
RELEASE=1
if [ -n "${ANDROID_KEYSTORE_BASE64:-}" ]; then
  KS="$B/release.p12"; printf '%s' "$ANDROID_KEYSTORE_BASE64" | base64 -d > "$KS"
elif [ -n "${ANDROID_KEYSTORE:-}" ]; then
  KS="$ANDROID_KEYSTORE"
else
  RELEASE=0; KS="$B/throwaway.p12"; ANDROID_KEYSTORE_PASSWORD="$(head -c 18 /dev/urandom | base64 | tr -dc A-Za-z0-9)"
  keytool -genkeypair -keystore "$KS" -storetype PKCS12 -alias "$KS_ALIAS" -keyalg RSA -keysize 2048 -validity 30 \
    -storepass "$ANDROID_KEYSTORE_PASSWORD" -keypass "$ANDROID_KEYSTORE_PASSWORD" -dname "CN=Throwaway test key" >/dev/null 2>&1
fi
[ -f "$KS" ] || { echo "No keystore at $KS"; exit 1; }
[ -n "${ANDROID_KEYSTORE_PASSWORD:-}" ] || { echo "Set ANDROID_KEYSTORE_PASSWORD"; exit 1; }
export LB_KS_PASS="$ANDROID_KEYSTORE_PASSWORD"
OUT="$A/build/LaserBox.apk"
"$BT/apksigner" sign --ks "$KS" --ks-type PKCS12 --ks-key-alias "$KS_ALIAS" --ks-pass env:LB_KS_PASS --key-pass env:LB_KS_PASS --out "$OUT" "$B/aligned.apk"
"$BT/apksigner" verify "$OUT"
ls -la "$OUT"

# the Google Play bundle: the same app linked with protobuf resources, laid out as a bundle module, signed with the same key
if java -cp "$BUNDLETOOL_CP" com.android.tools.build.bundletool.BundleToolMain version >/dev/null 2>&1; then
  "$BT/aapt2" link --proto-format -o "$B/proto.zip" -I "$AJ" --manifest "$A/AndroidManifest.xml" -R "$B/res.zip" \
    --auto-add-overlay -A "$B/assets" --min-sdk-version 24 --target-sdk-version "$TARGET" "${VERSION[@]}"
  rm -rf "$B/module" && mkdir -p "$B/module/manifest" "$B/module/dex"
  (cd "$B/module" && unzip -q "$B/proto.zip" && mv AndroidManifest.xml manifest/ && cp "$B/dex/classes.dex" dex/ && zip -q -r ../base.zip .)
  AAB="$A/build/LaserBox.aab"; rm -f "$AAB"
  java -cp "$BUNDLETOOL_CP" com.android.tools.build.bundletool.BundleToolMain build-bundle --modules="$B/base.zip" --output="$AAB"
  jarsigner -keystore "$KS" -storetype PKCS12 -storepass:env LB_KS_PASS -keypass:env LB_KS_PASS -sigalg SHA256withRSA -digestalg SHA-256 "$AAB" "$KS_ALIAS" >/dev/null
  java -cp "$BUNDLETOOL_CP" com.android.tools.build.bundletool.BundleToolMain validate --bundle="$AAB" >/dev/null
  ls -la "$AAB"
else
  echo "bundletool not found (BUNDLETOOL_CP): no .aab built"
fi
echo "signed by: $(keytool -list -v -keystore "$KS" -storetype PKCS12 -storepass:env LB_KS_PASS -alias "$KS_ALIAS" 2>/dev/null | grep -m1 'SHA256:' | sed 's/^[[:space:]]*//')"
[ "$RELEASE" = 1 ] || echo "WARNING: signed with a THROWAWAY key (no ANDROID_KEYSTORE / ANDROID_KEYSTORE_BASE64): do not share this build"
# the claude.ai viewer page can carry only text beside it: the app as base64, for its «تطبيق أندرويد» button
base64 -w0 "$OUT" > "$A/build/LaserBox-apk.b64.txt"
