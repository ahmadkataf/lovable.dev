#!/usr/bin/env bash
# Assemble a finished video from the voice sections and the scenes.
#   ./make_video.sh            → out/L01-lesson.mp4
#   ./make_video.sh solutions  → out/L01-solutions.mp4
# Needs: section WAVs (python3 build.py [--video v] restore, if only the FLACs are present),
# faster-whisper (first run only; the word timings are cached), ffmpeg, Playwright's Chromium,
# and add_voice.py from the voice-over brief (ADD_VOICE=/path/to/add_voice.py).
set -euo pipefail
cd "$(dirname "$0")"
V="${1:-}"
VF=(); [ -n "$V" ] && VF=(--video "$V")
NAME="L01-${V:-lesson}"
DIR="${V:-.}"
ADD_VOICE="${ADD_VOICE:-add_voice.py}"
WORKERS="${WORKERS:-4}"
mkdir -p out
python3 build.py "${VF[@]}" restore
python3 build.py "${VF[@]}" split
python3 build.py "${VF[@]}" timeline
python3 sound.py "${VF[@]}"
node render.mjs "out/$NAME-silent.mp4" "${VF[@]}" --workers "$WORKERS"
ffmpeg -loglevel error -y -i "out/$NAME-silent.mp4" -i "$DIR/fx.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest "out/$NAME-fx.mp4"
python3 "$ADD_VOICE" --video "out/$NAME-fx.mp4" --clip "$DIR/voice/narration.wav" --mode mix --bg-volume 1.0 --out "out/$NAME.mp4"
ffprobe -v error -show_entries format=duration:stream=codec_type,width,height -of compact "out/$NAME.mp4"
