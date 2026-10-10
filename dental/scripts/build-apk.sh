#!/usr/bin/env bash
# Builds Dentora for Android from the Vite build (dist/) with the Android build-tools only (no Gradle):
#   android/build/Dentora.apk   to install directly on a phone or hand to a clinic
#   android/build/Dentora.aab   the App Bundle Google Play asks for (when bundletool is available)
#
#   cd dental && npm run build && ./scripts/build-apk.sh        (the same as: npm run android:build)
#
# Needs: an Android SDK with build-tools and a platform (the newest installed are used; android-35 or newer),
#        JDK 17+ (javac, keytool, jarsigner), python3 with Pillow, node (renders the icon), zip/unzip.
# Optional environment:
#   ANDROID_HOME                       the SDK (default: $ANDROID_SDK_ROOT, else /opt/android-sdk)
#   ANDROID_KEYSTORE                   the signing (upload) key, must exist; default android/release.keystore (created when missing)
#   ANDROID_KEYSTORE_PASSWORD          its password (default dentora-release: set your own before the first build)
#   ANDROID_KEY_ALIAS                  the key alias (default dentora)
#   VERSION_NAME                       default: the version in package.json (1.2.3)
#   VERSION_CODE                       default: major*10000 + minor*100 + patch of VERSION_NAME (1.2.3 → 10203)
#   TARGET_SDK                         default 35 (must not exceed the newest installed platform)
#   BUNDLETOOL                         bundletool-all.jar or a bundletool launcher; default $ANDROID_HOME/bundletool.jar
#   DIST                               the web build to package (default: dist)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
A="$ROOT/android"
OUT="$A/build"
B="$OUT/work"
APK="$OUT/Dentora.apk"
AAB="$OUT/Dentora.aab"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/opt/android-sdk}}"
DIST="$(cd "${DIST:-$ROOT/dist}" 2>/dev/null && pwd || echo "${DIST:-$ROOT/dist}")"
MIN_SDK=24

die() { echo "build-apk: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "'$1' was not found: $2"; }

# ---- tools ---------------------------------------------------------------------------------------------
[ -f "$DIST/index.html" ] || die "$DIST/index.html is missing: build the web app first (cd dental && npm run build)."
[ -d "$SDK/build-tools" ] || die "no Android SDK at $SDK (set ANDROID_HOME). It needs build-tools and platforms;android-35."
newest() { for d in "$1"/*/; do [ -d "$d" ] && basename "$d"; done | grep -E "$2" | sort -V | tail -1 || true; }
BT_VERSION="$(newest "$SDK/build-tools" '^[0-9]+(\.[0-9]+)*$')"
[ -n "$BT_VERSION" ] || die "no build-tools in $SDK/build-tools (sdkmanager 'build-tools;35.0.0')"
BT="$SDK/build-tools/$BT_VERSION"
PLATFORM="$(newest "$SDK/platforms" '^android-[0-9]+$')"
[ -n "$PLATFORM" ] || die "no platform in $SDK/platforms (sdkmanager 'platforms;android-35')"
AJ="$SDK/platforms/$PLATFORM/android.jar"
COMPILE_SDK="${PLATFORM#android-}"
TARGET_SDK="${TARGET_SDK:-35}"
[ "$TARGET_SDK" -le "$COMPILE_SDK" ] || die "TARGET_SDK=$TARGET_SDK needs platforms;android-$TARGET_SDK (newest installed: $PLATFORM)"
need javac "install a JDK 17 or newer"
need java "install a JDK 17 or newer"
need jar "install a JDK 17 or newer"
need keytool "install a JDK 17 or newer"
need jarsigner "install a JDK 17 or newer"
need python3 "install Python 3 with Pillow (pip install pillow)"
need zip "install zip"
need unzip "install unzip"
# a key named on purpose must exist: a new key there (a typo in the path) would make every phone refuse the update
if [ -n "${ANDROID_KEYSTORE:-}" ] && [ ! -s "$ANDROID_KEYSTORE" ]; then
  die "ANDROID_KEYSTORE=$ANDROID_KEYSTORE does not exist or is empty. Fix the path (or unset it to use android/release.keystore)."
fi
JAVAC_MAJOR="$(javac -version 2>&1 | grep -oE 'javac [0-9]+' | grep -oE '[0-9]+' | head -1 || true)"
if [ -z "$JAVAC_MAJOR" ] || [ "$JAVAC_MAJOR" -lt 17 ]; then die "javac 17 or newer is needed (found: $(javac -version 2>&1 | tail -1))"; fi

# ---- version -------------------------------------------------------------------------------------------
PKG_VERSION="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['version'])" "$ROOT/package.json")"
VERSION_NAME="${VERSION_NAME:-$PKG_VERSION}"
if [ -z "${VERSION_CODE:-}" ]; then
  VERSION_CODE="$(python3 - "$VERSION_NAME" <<'PY'
import re, sys
m = re.match(r'^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?', sys.argv[1].strip())
if not m:
    sys.exit(f'cannot read a version number from "{sys.argv[1]}": set VERSION_CODE')
major, minor, patch = (int(g or 0) for g in m.groups())
if minor > 99 or patch > 99:
    sys.exit(f'{sys.argv[1]}: minor and patch must be below 100 for the automatic VERSION_CODE: set VERSION_CODE')
print(max(1, major * 10000 + minor * 100 + patch))
PY
)"
fi
if ! [[ "$VERSION_CODE" =~ ^[1-9][0-9]{0,9}$ ]] || [ "$VERSION_CODE" -gt 2100000000 ]; then
  die "VERSION_CODE must be a whole number from 1 to 2100000000 (got '$VERSION_CODE')"
fi
echo "Dentora $VERSION_NAME (versionCode $VERSION_CODE) · build-tools $BT_VERSION · compile $PLATFORM · target SDK $TARGET_SDK · min SDK $MIN_SDK"

# ---- the shell's own checks (plain Java, no Android needed) ---------------------------------------------
rm -rf "$B"
mkdir -p "$B/gen" "$B/obj" "$B/dex" "$B/test" "$B/assets/www"
javac -nowarn -encoding UTF-8 -d "$B/test" "$A/src/com/dentora/app/WebFiles.java" "$A/test/WebFilesTest.java"
java -ea -cp "$B/test" com.dentora.app.WebFilesTest

# ---- web app + resources -------------------------------------------------------------------------------
cp -R "$DIST/." "$B/assets/www/"
find "$B/assets/www" \( -name '*.map' -o -name '.DS_Store' \) -delete
(cd "$ROOT" && python3 scripts/android-res.py "$B")

# ---- APK -----------------------------------------------------------------------------------------------
"$BT/aapt2" compile --dir "$B/res" -o "$B/res.zip"
LINK=(-I "$AJ" --manifest "$A/AndroidManifest.xml" -A "$B/assets" "$B/res.zip"
  --min-sdk-version "$MIN_SDK" --target-sdk-version "$TARGET_SDK"
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" --replace-version)
"$BT/aapt2" link -o "$B/unsigned.apk" --java "$B/gen" "${LINK[@]}"
find "$B/gen" "$A/src" -name '*.java' | sort | sed 's/.*/"&"/' > "$B/sources.txt"
javac --release 17 -encoding UTF-8 -Xlint:-options -nowarn -cp "$AJ" -d "$B/obj" @"$B/sources.txt"
(cd "$B/obj" && jar cf ../classes.jar .)
"$BT/d8" --release --lib "$AJ" --min-api "$MIN_SDK" --output "$B/dex" "$B/classes.jar"
(cd "$B/dex" && zip -q -u "$B/unsigned.apk" classes.dex)
"$BT/zipalign" -f -p 4 "$B/unsigned.apk" "$B/aligned.apk"

# ---- signing key ---------------------------------------------------------------------------------------
KS="${ANDROID_KEYSTORE:-$A/release.keystore}"
export DENTORA_KS_PASS="${ANDROID_KEYSTORE_PASSWORD:-dentora-release}"
KS_ALIAS="${ANDROID_KEY_ALIAS:-dentora}"
if [ ! -s "$KS" ]; then
  mkdir -p "$(dirname "$KS")"
  rm -f "$KS"
  keytool -genkeypair -keystore "$KS" -storetype PKCS12 -alias "$KS_ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass:env DENTORA_KS_PASS -keypass:env DENTORA_KS_PASS -dname "CN=Dentora, O=Dentora" >/dev/null 2>&1 \
    || die "keytool could not create $KS"
  chmod 600 "$KS" || true
  if [ -n "${GITHUB_ACTIONS:-}" ]; then
    echo "::warning::No signing key was given: signed with a throwaway key. Fine for testing; never upload this build to Google Play."
  else
  cat >&2 <<EOF

##############################################################################################
##  A NEW SIGNING KEY WAS CREATED:  $KS
##  alias: $KS_ALIAS     password: $( [ -n "${ANDROID_KEYSTORE_PASSWORD:-}" ] && echo '(your ANDROID_KEYSTORE_PASSWORD)' || echo 'dentora-release (the default)')
##
##  BACK IT UP NOW, in two safe places, together with its password.
##  Every update of Dentora (on Google Play, or an APK installed over an older one) must be signed
##  with THIS key. If it is lost, phones that have the app can never receive an update: the clinic
##  would have to uninstall, and uninstalling deletes all of its data on that phone.
##  On Android 8+ the device number used for activation also depends on this key.
##  The file is ignored by git on purpose: never commit it.
##############################################################################################

EOF
  fi
fi
"$BT/apksigner" sign --ks "$KS" --ks-key-alias "$KS_ALIAS" --ks-pass env:DENTORA_KS_PASS --key-pass env:DENTORA_KS_PASS \
  --v4-signing-enabled false --out "$APK" "$B/aligned.apk"
"$BT/apksigner" verify --min-sdk-version "$MIN_SDK" "$APK"
echo "APK  $APK  ($(du -h "$APK" | cut -f1))"

# ---- App Bundle for Google Play: the same app, resources in protobuf form, packed by bundletool ----------
BUNDLETOOL="${BUNDLETOOL:-}"
[ -z "$BUNDLETOOL" ] && [ -f "$SDK/bundletool.jar" ] && BUNDLETOOL="$SDK/bundletool.jar"
if [ -n "$BUNDLETOOL" ] && [ -f "$BUNDLETOOL" ]; then
  bt() { if [[ "$BUNDLETOOL" == *.jar ]]; then java -jar "$BUNDLETOOL" "$@"; else "$BUNDLETOOL" "$@"; fi; }
  "$BT/aapt2" link --proto-format -o "$B/proto.zip" "${LINK[@]}"
  M="$B/base"; rm -rf "$M"; mkdir -p "$M/manifest" "$M/dex"
  (cd "$M" && unzip -q "$B/proto.zip")
  mv "$M/AndroidManifest.xml" "$M/manifest/AndroidManifest.xml"
  cp "$B/dex/classes.dex" "$M/dex/classes.dex"
  rm -f "$B/base.zip"; (cd "$M" && zip -q -r "$B/base.zip" .)
  rm -f "$AAB"
  bt build-bundle --modules="$B/base.zip" --output="$AAB"
  jarsigner -keystore "$KS" -storepass:env DENTORA_KS_PASS -keypass:env DENTORA_KS_PASS \
    -sigalg SHA256withRSA -digestalg SHA-256 "$AAB" "$KS_ALIAS" >/dev/null
  jarsigner -verify -strict "$AAB" >/dev/null 2>&1 || jarsigner -verify "$AAB" >/dev/null || die "the App Bundle signature does not verify"
  bt validate --bundle="$AAB" >/dev/null
  echo "AAB  $AAB  ($(du -h "$AAB" | cut -f1))"
else
  echo "(no bundletool: skipped the App Bundle; set BUNDLETOOL=/path/to/bundletool-all.jar to build it)"
fi

CERT="$("$BT/apksigner" verify --print-certs "$APK" 2>/dev/null | grep -m1 'SHA-256 digest' | sed 's/.*: //' || true)"
echo "signed with key '$KS_ALIAS' from $KS${CERT:+ (SHA-256 $CERT)}"
