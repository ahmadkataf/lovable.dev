#!/bin/bash
# One chapter of the Gemini voice-over, end to end (store/voiceover/README.md):
#   speech (one TTS request, skipped when the WAV exists) -> scenes (split.mjs) -> re-recording with that narration
#   (make.mjs) -> final video (finalize.mjs, add_voice.py) -> the site's video folder (publish.mjs) -> deploy (--deploy).
# usage: GEMINI_API_KEY=... ASR_PYTHON=<venv python> QA_DIST=<QA build> QA_PORT=<port> chapter.sh L02-interface [--deploy]
# The voice is fixed for the whole course (VOICE, default ar-001-training-2, chosen by the owner). Exit codes:
# 3 the day's free quota is used up, 4 this pipeline's daily budget is spent (resume after midnight Pacific),
# 5 doubtful scene cuts (listen before recording), 1/6/7/8/9 a failing step.
set -u
lesson=$1; slug=${lesson#L??-}
HERE=$(cd "$(dirname "$0")" && pwd); APP=$(cd "$HERE/../../.." && pwd); W=$APP/store/voiceover
VOICE=${VOICE:-ar-001-training-2}
status() { python3 - "$W/manifest.csv" "$lesson" "$1" <<'PY'
import csv, sys
p, lesson, status = sys.argv[1:]
rows = list(csv.DictReader(open(p, encoding="utf-8")))
for r in rows:
    if r["lesson"] == lesson and r["section"] == "s1": r["status"] = status
w = csv.DictWriter(open(p, "w", newline="", encoding="utf-8"), fieldnames=list(rows[0].keys()), lineterminator="\n")
w.writeheader(); w.writerows(rows)
PY
}
step() { echo "== $lesson: $1 ($(date -u +%H:%M:%S))"; }

step "speech"
python3 "$HERE/run_tts.py" --lesson "$lesson" --voice "$VOICE"; rc=$?
[ $rc -ne 0 ] && exit $rc
step "scenes"
node "$HERE/split.mjs" "${lesson}_s1" || { status "split-doubtful"; exit 5; }
status split
step "recording"
VIDEO_NARRATION_DIR="$W/narration" VIDEO_OUT="$W/recorded" node "$APP/store/scripts/video/make.mjs" --chapters="$slug" --langs=ar || { status "record-failed"; exit 6; }
status recorded
step "final video"
node "$HERE/finalize.mjs" "$slug" || { status "final-failed"; exit 7; }
step "site folder"
node "$HERE/publish.mjs" "$slug" || exit 8
if [ "${2:-}" = "--deploy" ]; then
  step "deploy"
  (cd "$APP/server" && CLOUDFLARE_API_TOKEN="$(cat "$APP/../secrets-for-user/dentora/.cloudflare-token")" npm run deploy > "$W/deploy-$slug.log" 2>&1) || { status "deploy-failed"; exit 9; }
  grep -E "Version ID|Uploaded [0-9]+ of" "$W/deploy-$slug.log" | tail -2
  status published
fi
step "done"
