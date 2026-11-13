#!/usr/bin/env bash
# Builds the Android app end to end: the web game first, then the Gradle project.
#
#   tools/android/build.sh [debug|release|bundle|all] [--skip-web] [-- extra gradle arguments]
#
#     debug     debuggable APK with the diagnostics page          → zumurud-<version>-debug.apk
#     release   R8-optimised APK for testing on a device          → zumurud-<version>.apk
#     bundle    Android App Bundle, the file Google Play wants    → zumurud-<version>.aab
#     all       release + bundle (default)
#
#   --skip-web  reuse the existing ../dist instead of running `npm run build`
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
skip_web=0
gradle_args=()
while [ $# -gt 0 ]; do
  case "$1" in
    debug|release|bundle|all) what="$1" ;;
    --skip-web) skip_web=1 ;;
    --) shift; gradle_args=("$@"); break ;;
    -h|--help) sed -n '2,19p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "build.sh: unknown argument '$1' (try --help)" >&2; exit 2 ;;
  esac
  shift
done

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
  # Maven Central sometimes answers HTTP 429 while dependencies are resolved: one retry is enough.
  ./gradlew --console=plain "$@" "${gradle_args[@]}" || {
    echo "build.sh: Gradle failed, retrying once…" >&2
    sleep 5
    ./gradlew --console=plain "$@" "${gradle_args[@]}"
  }
}

tasks=()
case "$what" in
  debug) tasks=(:app:assembleDebug) ;;
  release) tasks=(:app:lintRelease :app:assembleRelease) ;;
  bundle) tasks=(:app:lintRelease :app:bundleRelease) ;;
  all) tasks=(:app:lintRelease :app:assembleRelease :app:bundleRelease) ;;
esac
echo "── android: ./gradlew ${tasks[*]}"
gradle "${tasks[@]}"

# ── 3. collect the results under readable names ──
info="$(./gradlew -q --console=plain :app:buildInfo "${gradle_args[@]}")"
value() { printf '%s\n' "$info" | sed -n "s/^$1=//p" | tail -n 1; }
version="$(value versionName)"
signing="$(value signing)"
[ -n "$version" ] || { echo "build.sh: could not read the version from Gradle" >&2; exit 1; }
suffix=""
if [ "$signing" != "upload-key" ]; then suffix="-DEBUGSIGNED"; fi

mkdir -p "$OUT"
copy() { # copy <source> <target name>
  [ -f "$1" ] || { echo "build.sh: expected output is missing: $1" >&2; exit 1; }
  cp -f "$1" "$OUT/$2"
  echo "   $OUT/$2  ($(du -h "$1" | cut -f1))"
}
echo "── outputs"
case "$what" in
  debug) copy app/build/outputs/apk/debug/app-debug.apk "zumurud-$version-debug.apk" ;;
esac
case "$what" in
  release|all) copy app/build/outputs/apk/release/app-release.apk "zumurud-$version$suffix.apk" ;;
esac
case "$what" in
  bundle|all) copy app/build/outputs/bundle/release/app-release.aab "zumurud-$version$suffix.aab" ;;
esac

echo "   applicationId $(value applicationId), versionCode $(value versionCode), targetSdk $(value targetSdk), signing: $signing"
if [ -n "$suffix" ] && [ "$what" != "debug" ]; then
  echo
  echo "   NOTE: no upload key is configured, so these files carry the debug signature."
  echo "         They install on a test device but are NOT FOR GOOGLE PLAY."
fi
if [ "$what" = "release" ] || [ "$what" = "all" ]; then
  echo "   Google Play accepts only the .aab for a new app; the .apk is for testing on a device."
fi
