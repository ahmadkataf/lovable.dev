#!/usr/bin/env bash
# Builds the Android app end to end: the web game first, then the Gradle project.
#
#   tools/android/build.sh [debug|release|bundle|all] [--flavor plain|ads|both] [--allow-test-ads]
#                          [--skip-web] [-- extra gradle arguments]
#
#     debug     debuggable APK with the diagnostics page          → zumurud-<version>-<flavour>-debug.apk
#               (the ads flavour's debug build always shows Google's test ads, never real ones)
#     release   R8-optimised APK for testing on a device          → zumurud-<version>-<flavour>.apk
#     bundle    Android App Bundle, the file Google Play wants    → zumurud-<version>-<flavour>.aab
#     all       release + bundle (default)
#
#   --flavor plain   purchases (Google Play Billing), no ad SDK                      (default)
#   --flavor ads     purchases + AdMob ads. A release needs the three AdMob ids: ADMOB_APP_ID,
#                    ADMOB_REWARDED_ID, ADMOB_INTERSTITIAL_ID as environment variables, in
#                    android/admob.properties (see admob.properties.example) or as -P properties after "--".
#   --flavor both    plain, then ads, with the same options (one web build for both)
#   --allow-test-ads build a release of the ads flavour with Google's sample ids instead (test ads
#                    only), whether or not real ids are configured — for trying a release build on
#                    a device. The files are named "…-TESTADS" and must never be uploaded.
#   --skip-web       reuse the existing ../dist instead of running `npm run build`
#
# Results are copied to android/out/. Version and application id come from android/gradle.properties
# and can be overridden through the environment (VERSION_CODE=7 VERSION_NAME=1.0.6 tools/android/build.sh).
#
# Signing: put the upload key in android/keystore.properties (see keystore.properties.example) or set
# ZUMURUD_KEYSTORE, ZUMURUD_KEYSTORE_PASSWORD, ZUMURUD_KEY_ALIAS, ZUMURUD_KEY_PASSWORD. Without a
# key the release files are signed with the debug key and named "…-DEBUGSIGNED": fine for a test
# device, NOT FOR GOOGLE PLAY.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"          # match3/
ANDROID="$ROOT/android"
OUT="$ANDROID/out"

what="all"
flavour="plain"
skip_web=0
allow_test_ads=0
gradle_args=()
while [ $# -gt 0 ]; do
  case "$1" in
    debug|release|bundle|all) what="$1" ;;
    --flavor|--flavour)
      shift
      flavour="${1:-}"
      ;;
    --flavor=*|--flavour=*) flavour="${1#*=}" ;;
    --allow-test-ads) allow_test_ads=1 ;;
    --skip-web) skip_web=1 ;;
    --) shift; gradle_args=("$@"); break ;;
    -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "build.sh: unknown argument '$1' (try --help)" >&2; exit 2 ;;
  esac
  shift
done
case "$flavour" in
  plain) Flavour=Plain ;;
  ads) Flavour=Ads ;;
  both)
    # plain first (it builds the web game unless --skip-web), then ads reusing that web build.
    [ "$allow_test_ads" -eq 0 ] || { echo "build.sh: --allow-test-ads only makes sense with --flavor ads" >&2; exit 2; }
    web_flag=()
    [ "$skip_web" -eq 1 ] && web_flag=(--skip-web)
    "${BASH_SOURCE[0]}" "$what" --flavor plain ${web_flag[@]+"${web_flag[@]}"} -- ${gradle_args[@]+"${gradle_args[@]}"}
    exec "${BASH_SOURCE[0]}" "$what" --flavor ads --skip-web -- ${gradle_args[@]+"${gradle_args[@]}"}
    ;;
  *) echo "build.sh: --flavor must be 'plain', 'ads' or 'both' (got '$flavour')" >&2; exit 2 ;;
esac
if [ "$allow_test_ads" -eq 1 ]; then
  [ "$flavour" = "ads" ] || { echo "build.sh: --allow-test-ads only makes sense with --flavor ads" >&2; exit 2; }
  gradle_args+=("-PuseSampleAdIds=true" "-PallowTestAds=true")
fi

if [ -z "${ANDROID_HOME:-}" ] && [ -z "${ANDROID_SDK_ROOT:-}" ] && [ ! -f "$ANDROID/local.properties" ]; then
  if [ -d /opt/android-sdk ]; then
    export ANDROID_HOME=/opt/android-sdk
  else
    echo "build.sh: set ANDROID_HOME to the Android SDK directory (or write sdk.dir into android/local.properties)" >&2
    exit 2
  fi
fi

# ── 1. the web game ──
if [ "$skip_web" -eq 0 ]; then
  echo "── web: building the game (npm run build)"
  cd "$ROOT"
  if [ ! -d node_modules ]; then npm ci; fi
  npm run build
fi
if [ ! -f "$ROOT/dist/index.html" ]; then
  echo "build.sh: $ROOT/dist/index.html is missing — the web build did not produce the game" >&2
  exit 1
fi

# ── 2. Gradle ──
cd "$ANDROID"
gradle() {
  # Maven Central sometimes answers HTTP 429 while dependencies are resolved: retrying is enough.
  # Anything else (a compile error, a refused test-ads release…) is reported at once.
  local log attempt
  log="$(mktemp)"
  for attempt in 1 2 3; do
    if ./gradlew --console=plain "$@" ${gradle_args[@]+"${gradle_args[@]}"} 2>&1 | tee "$log"; then
      rm -f "$log"
      return 0
    fi
    if [ "$attempt" -lt 3 ] && grep -q 'status code 429' "$log"; then
      echo "build.sh: the package server asked to slow down (HTTP 429), retrying in 20 s…" >&2
      sleep 20
    else
      rm -f "$log"
      return 1
    fi
  done
}

tasks=()
case "$what" in
  debug) tasks=(":app:assemble${Flavour}Debug") ;;
  release) tasks=(":app:lint${Flavour}Release" ":app:assemble${Flavour}Release") ;;
  bundle) tasks=(":app:lint${Flavour}Release" ":app:bundle${Flavour}Release") ;;
  all) tasks=(":app:lint${Flavour}Release" ":app:assemble${Flavour}Release" ":app:bundle${Flavour}Release") ;;
esac
echo "── android ($flavour): ./gradlew ${tasks[*]} ${gradle_args[*]+${gradle_args[*]}}"
gradle "${tasks[@]}"

# ── 3. collect the results under readable names ──
info="$(./gradlew -q --console=plain :app:buildInfo ${gradle_args[@]+"${gradle_args[@]}"})"
value() { printf '%s\n' "$info" | sed -n "s/^$1=//p" | tail -n 1; }
version="$(value versionName)"
signing="$(value signing)"
ads="$(value ads)"
[ -n "$version" ] || { echo "build.sh: could not read the version from Gradle" >&2; exit 1; }
suffix=""
if [ "$flavour" = "ads" ] && [ "$ads" != "real-ids" ]; then suffix="$suffix-TESTADS"; fi
if [ "$signing" != "upload-key" ]; then suffix="$suffix-DEBUGSIGNED"; fi

mkdir -p "$OUT"
copy() { # copy <source> <target name>
  [ -f "$1" ] || { echo "build.sh: expected output is missing: $1" >&2; exit 1; }
  cp -f "$1" "$OUT/$2"
  echo "   $OUT/$2  ($(du -h "$1" | cut -f1))"
}
echo "── outputs"
case "$what" in
  debug) copy "app/build/outputs/apk/$flavour/debug/app-$flavour-debug.apk" "zumurud-$version-$flavour-debug.apk" ;;
esac
case "$what" in
  release|all) copy "app/build/outputs/apk/$flavour/release/app-$flavour-release.apk" "zumurud-$version-$flavour$suffix.apk" ;;
esac
case "$what" in
  bundle|all) copy "app/build/outputs/bundle/${flavour}Release/app-$flavour-release.aab" "zumurud-$version-$flavour$suffix.aab" ;;
esac

echo "   applicationId $(value applicationId), versionCode $(value versionCode), targetSdk $(value targetSdk), flavour $flavour, signing: $signing"
if [ "$flavour" = "ads" ] && [ "$what" = "debug" ]; then
  echo "   (debug builds of the ads flavour always use Google's sample ad ids: test ads only)"
elif [ "$flavour" = "ads" ] && [ "$ads" != "real-ids" ]; then
  echo
  echo "   NOTE: these files use Google's SAMPLE ad ids and show test ads only. NEVER UPLOAD them."
  echo "         A real build needs ADMOB_APP_ID, ADMOB_REWARDED_ID and ADMOB_INTERSTITIAL_ID and no --allow-test-ads."
fi
if [ "$signing" != "upload-key" ] && [ "$what" != "debug" ]; then
  echo
  echo "   NOTE: no upload key is configured, so these files carry the debug signature."
  echo "         They install on a test device but are NOT FOR GOOGLE PLAY."
fi
if [ "$what" = "release" ] || [ "$what" = "all" ]; then
  echo "   Google Play accepts only the .aab for a new app; the .apk is for testing on a device."
fi
