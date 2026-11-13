#!/usr/bin/env bash
# Smoke test on a running emulator or device: install an APK, start it, look at it, read its log.
#
#   tools/android/emu-smoke.sh <apk> [diag]
#
#   <apk>   any build of the app (debug or release)
#   diag    debug builds only: open the built-in diagnostics page and drive it to the end —
#           two launches (the second proves the save survives a killed process), Back while the
#           page is not at its root, Home and return, then Back at the root (must leave the app).
#           Every line of the page must end up PASS.
#
# Screenshots and the log go to shots/android/smoke-<debug|release>[-diag]-*.
# Exit code 0 only if nothing crashed: no FATAL EXCEPTION or ANR of the app, no "Uncaught" JavaScript
# error, no lost WebView renderer, the page loaded, and (diag) no FAIL and nothing left waiting.
#
# Environment: ANDROID_SERIAL (default emulator-5554), ANDROID_HOME (default /opt/android-sdk),
# SMOKE_TIMEOUT seconds to wait for the page (default 240 — software-rendered emulators are slow).
set -uo pipefail

APK="${1:-}"
MODE="${2:-}"
if [ -z "$APK" ] || [ ! -f "$APK" ] || { [ -n "$MODE" ] && [ "$MODE" != "diag" ]; }; then
  sed -n '2,17p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' >&2
  exit 2
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/opt/android-sdk}}"
SERIAL="${ANDROID_SERIAL:-emulator-5554}"
WAIT="${SMOKE_TIMEOUT:-240}"
ADB_BIN="$SDK/platform-tools/adb"
AAPT2="$(ls -1d "$SDK"/build-tools/*/aapt2 2>/dev/null | sort -V | tail -n 1)"
[ -x "$ADB_BIN" ] || { echo "emu-smoke: adb not found under $SDK" >&2; exit 2; }
[ -x "$AAPT2" ] || { echo "emu-smoke: aapt2 not found under $SDK/build-tools" >&2; exit 2; }

adb() { timeout "${ADB_TIMEOUT:-120}" "$ADB_BIN" -s "$SERIAL" "$@"; }
say() { printf '── %s\n' "$*"; }

badging="$("$AAPT2" dump badging "$APK" 2>/dev/null)"
PKG="$(printf '%s\n' "$badging" | sed -n "s/^package: name='\([^']*\)'.*/\1/p")"
[ -n "$PKG" ] || { echo "emu-smoke: cannot read the package name from $APK" >&2; exit 2; }
VARIANT=release
if printf '%s\n' "$badging" | grep -q '^application-debuggable'; then VARIANT=debug; fi
if [ "$MODE" = "diag" ] && [ "$VARIANT" != "debug" ]; then
  echo "emu-smoke: the diagnostics page only exists in debug builds" >&2
  exit 2
fi
COMPONENT="$PKG/com.zumurud.game.MainActivity"
OUT="$ROOT/shots/android"
PREFIX="$OUT/smoke-$VARIANT${MODE:+-$MODE}"
LOG="$PREFIX.log"
mkdir -p "$OUT"
shot_no=0
failures=()

fail() { failures+=("$*"); echo "   FAIL: $*" >&2; }

shot() { # shot <label>
  shot_no=$((shot_no + 1))
  local file
  file="$(printf '%s-%02d-%s.png' "$PREFIX" "$shot_no" "$1")"
  if ADB_TIMEOUT=90 adb exec-out screencap -p > "$file" && [ -s "$file" ]; then echo "   screenshot $file"; else fail "screenshot $1 failed"; fi
}

log_now() { adb logcat -d -v threadtime 2>/dev/null; }

# A slow emulator sometimes shows "<some system app> isn't responding" on top of everything.
# That is the emulator, not the app under test: press its "Wait" button and carry on.
dismiss_system_anr() {
  local focus
  focus="$(adb shell dumpsys window 2>/dev/null | grep -m1 'mCurrentFocus' || true)"
  case "$focus" in
    *"Application Not Responding"*"$PKG"*) return 0 ;; # ours: leave it for the crash check
    *"Application Not Responding"*)
      local xml bounds
      adb shell uiautomator dump /sdcard/emu-smoke-ui.xml >/dev/null 2>&1 || return 0
      xml="$(adb shell cat /sdcard/emu-smoke-ui.xml 2>/dev/null)"
      bounds="$(printf '%s' "$xml" | grep -o 'text="Wait"[^>]*bounds="\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]"' | grep -o '\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]' | head -n 1)"
      if [ -n "$bounds" ]; then
        # shellcheck disable=SC2046
        set -- $(printf '%s' "$bounds" | tr -c '0-9' ' ')
        adb shell input tap $((($1 + $3) / 2)) $((($2 + $4) / 2))
        echo "   (dismissed a system 'not responding' dialog: $focus)"
      fi
      ;;
  esac
}

wait_for_log() { # wait_for_log <extended regex> <seconds> → 0 when a matching line appears
  local deadline=$((SECONDS + $2))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if log_now | grep -Eq "$1"; then return 0; fi
    dismiss_system_anr
    sleep 3
  done
  return 1
}

launch() { # launch [extra am arguments…]
  adb shell am start -n "$COMPONENT" "$@" >/dev/null 2>&1 || fail "am start failed"
}

in_foreground() {
  adb shell dumpsys activity activities 2>/dev/null | grep -m1 'mResumedActivity' | grep -q "$PKG/"
}

say "device $SERIAL: Android $(adb shell getprop ro.build.version.release | tr -d '\r') (API $(adb shell getprop ro.build.version.sdk | tr -d '\r')), WebView $(adb shell dumpsys webviewupdate 2>/dev/null | sed -n 's/.*Current WebView package (name, version): (\(.*\))/\1/p' | tr -d '\r')"
say "installing $APK ($PKG, $VARIANT)"
adb shell am force-stop "$PKG" >/dev/null 2>&1
if ! ADB_TIMEOUT=600 adb install -r -t "$APK" 2>&1 | tail -n 1 | grep -q Success; then
  echo "emu-smoke: install failed" >&2
  exit 1
fi
adb logcat -c

if [ "$MODE" = "diag" ]; then
  say "diagnostics, first launch"
  launch --ez diag true
  wait_for_log 'ZumurudJS.*DIAG (WAIT|PASS) lifecycle' "$WAIT" || fail "the diagnostics page did not finish its checks within ${WAIT}s"
  sleep 2
  shot run1

  say "kill the process, launch again (the save must survive)"
  adb shell am force-stop "$PKG"
  first_run_log="$(log_now)"
  adb logcat -c
  launch --ez diag true
  wait_for_log 'ZumurudJS.*DIAG (WAIT|PASS) lifecycle' "$WAIT" || fail "second launch: the diagnostics page did not finish within ${WAIT}s"
  log_now | grep -q 'DIAG PASS save-restart' || fail "the save did not survive the process kill"

  say "Back while the page is not at its root → the page must receive it"
  adb shell input keyevent KEYCODE_BACK
  wait_for_log 'DIAG PASS back' 30 || fail "Back did not reach the page"
  in_foreground || fail "Back closed the app although the page was not at its root"

  say "Home, then return → pause and resume hooks"
  adb shell input keyevent KEYCODE_HOME
  sleep 4
  in_foreground && fail "Home did not leave the app"
  launch --ez diag true
  wait_for_log 'DIAG PASS lifecycle' 60 || fail "pause/resume hooks did not fire"
  sleep 3
  shot final
  summary="$(log_now | grep 'DIAG SUMMARY' | tail -n 1 | sed 's/.*DIAG SUMMARY //; s/ (.*//')"
  say "result: $summary"
  case "$summary" in
    *"fail=0 wait=0"*) ;;
    *) fail "diagnostics did not end with fail=0 wait=0 (got: ${summary:-nothing})" ;;
  esac

  say "Back at the root → the system takes the app off the screen"
  adb shell input keyevent KEYCODE_BACK
  sleep 5
  in_foreground && fail "Back at the root did not leave the app"
  full_log="$first_run_log
$(log_now)"
else
  say "launching"
  launch
  wait_for_log "Zumurud *: page loaded" "$WAIT" || fail "the game page did not load within ${WAIT}s"
  sleep 6
  dismiss_system_anr
  shot started
  in_foreground || fail "the app is not in the foreground after launch"

  say "Home, then return"
  adb shell input keyevent KEYCODE_HOME
  sleep 4
  launch
  sleep 6
  shot resumed
  in_foreground || fail "the app did not come back to the foreground"
  full_log="$(log_now)"
fi

# ── the log: everything the app and its page said, plus crashes ──
# (threadtime format: "MM-DD HH:MM:SS.mmm  PID  TID L Tag     : message")
printf '%s\n' "$full_log" | grep -E ' [VDIWEF] (ZumurudJS|Zumurud|ZumurudDiag|chromium|cr_[A-Za-z]*) *: | [EF] AndroidRuntime *: |ANR in ' > "$LOG" || true
[ -s "$LOG" ] || fail "no log lines from the app were captured"
say "log ($LOG):"
sed 's/^/   /' "$LOG"

if printf '%s\n' "$full_log" | grep -A3 'FATAL EXCEPTION' | grep -q "Process: $PKG"; then fail "the app crashed (FATAL EXCEPTION)"; fi
if printf '%s\n' "$full_log" | grep -q "ANR in $PKG"; then fail "the app stopped responding (ANR)"; fi
if grep -E 'ZumurudJS' "$LOG" | grep -q 'Uncaught'; then fail "uncaught JavaScript error in the page"; fi
if grep -q 'WebView renderer gone' "$LOG"; then fail "the WebView renderer was lost"; fi
if grep -q 'the game page could not be shown' "$LOG"; then fail "the game page failed to load (error screen shown)"; fi
if grep -E 'ZumurudJS' "$LOG" | grep -q 'DIAG FAIL'; then fail "a diagnostics check failed"; fi

if [ "${#failures[@]}" -gt 0 ]; then
  say "SMOKE TEST FAILED (${#failures[@]}):"
  printf '   - %s\n' "${failures[@]}"
  exit 1
fi
say "smoke test passed"
