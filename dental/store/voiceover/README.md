# Gemini voice-over of the Arabic video course

The course videos (`/videos` on the site, recorded by `store/scripts/video/make.mjs`) get a new Arabic narration made
with Gemini TTS, following the owner's brief: one TTS request per chapter (one section of 3–5 minutes), one model,
one voice and one style for the whole course, never a regenerated file, never a sped-up voice.

Locked for the whole course (chosen by the owner on 16 October 2026 from three samples of chapter 1):
model `gemini-3.8-flash-tts`, voice `ar-001-training-2` (Modern Standard Arabic, instructional video host),
style "clear, friendly instructor". Each chapter is published on the site as soon as it is finished.

## Folders

| Path | What | In git |
|---|---|---|
| `scripts/<lesson>-<slug>_s1.txt` | what the voice reads: the chapter's narration, scene by scene, separated by `<long pause>` | yes |
| `scripts/<lesson>-<slug>_s1.json` | the same per scene: `text` (the caption, as on screen) and `spoken` (numbers and English terms as spoken, diacritics on words that could be misread) | yes |
| `manifest.csv` | lesson, section, script, wav, start_sec, status: updated after every file | yes |
| `requests.csv` | every TTS request: time, quota day (Pacific), voice, file, exit code | yes |
| `audio/` | the generated speech, one WAV per chapter (24 kHz mono, as returned) | no |
| `narration/ar/<slug>/` | the speech cut into scenes (`split.mjs`): one WAV and one JSON (duration, caption cues) per scene, `asr.json`, `report.json` | no |
| `recorded/` | the chapters re-recorded with the new narration (`make.mjs` with `VIDEO_NARRATION_DIR`) | no |
| `final/<slug>.mp4` | the finished videos, under the original videos' names, with `.vtt` captions and `.jpg` posters | no |
| `samples/` | the voice test (the same chapter in three voices) | no |

## Steps (tools in `store/scripts/voiceover/`)

1. `build-scripts.mjs <spoken.json>`: writes `scripts/` and the manifest rows from the spoken versions.
2. `run_tts.py --lesson <lesson-slug> --voice <voice>`: one request (`gemini_tts.py`, model `gemini-3.8-flash-tts`,
   style "clear, friendly instructor"), at most 8 per quota day (2 kept for retakes), 25 s apart, logged; exit 3 = the
   day's free quota is used up: stop and continue after midnight Pacific time (10:00 Damascus, 11:00 from 1 November).
   The key comes from `GEMINI_API_KEY` only and is never written to the repository.
3. `split.mjs <lesson-slug>_s1`: cuts the speech into scenes. Speech recognition (`asr_align.py`, faster-whisper in the
   venv given by `ASR_PYTHON`) anchors the script's words in time, so each cut falls in the pause between the last
   word of one scene and the first of the next; the captions start at their sentences' first words.
4. `make.mjs` with `VIDEO_NARRATION_DIR=store/voiceover/narration VIDEO_OUT=store/voiceover/recorded`: re-records the
   chapter so every scene lasts as long as its own narration (the picture follows the words, nothing is stretched).
5. `finalize.mjs <slug>`: `add_voice.py` puts every scene clip at its scene's start, the video stream untouched, and
   writes `final/<slug>.mp4`.
6. `publish.mjs <slug>`: copies the final video, captions and poster into `server/site/videos/ar/` with its manifest
   entry; `npm run deploy` in `server/` puts it online.

`chapter.sh <lesson-slug> [--deploy]` runs steps 2–6 for one chapter (and the deploy), stopping on the first failure;
its exit code 3 or 4 means the day's requests are used up.
