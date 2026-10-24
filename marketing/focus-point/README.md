# Focus Point — reel (motion graphics + Hourani voice-over)

`FocusPoint-reel.mp4`: 1080×1920 (Instagram reel / story), 30 fps, H.264 + AAC. Light mode, the brand's
burgundy / plum / cream / wood palette, the owner's real room photos, and a voice-over in the Hourani (Daraa) dialect.

Everything is generated from the sources in this folder; nothing is hand-edited in a video editor.

## Pipeline

1. **Script** — `voice/script.json`: the lines (`vo` = what is spoken, with tashkeel; `screen` = the short on-screen
   text; `visual` = scene hint). Written and judged in Hourani dialect by a writer/judge/critic panel.
2. **Voice-over** — Google Gemini TTS, one request for the whole narration (free tier: 10 requests a day):
   ```bash
   export GEMINI_API_KEY=...          # never commit it; the tools read it from the environment only
   python3 tools/build_vo_text.py     # voice/vo.txt: the lines joined with <long pause> tags
   python3 tools/gemini_tts.py --in voice/vo.txt --out voice/vo.wav --voice Charon --style "warm, confident, unhurried ad narrator"
   python3 tools/qa_audio.py voice/vo.wav voice/script.json                     # Gemini listens and checks the dialect
   # pacing: cut the pauses between lines to 0.6 s, the "..." pauses to 0.4 s, 6 % faster, and write the line timings
   python3 tools/tighten.py voice/vo-raw.wav voice/script.json voice/vo.wav voice/timings.json
   # (tools/segment.py writes the same timings.json from an untightened take)
   ```
   The delivered take is `voice/vo-intro.wav` (L0) + `voice/vo-main.wav` (L1–L7), joined with a 0.9 s pause into
   `voice/vo-raw.wav`, then tightened into `voice/vo.wav`.
   `voice/timings.json` (and its `timings.js` twin) drive the whole video: scene boundaries follow the voice, so a
   new take only needs steps 2–4 again, then the mix and the render.
3. **Music** — `assets/music-bed.mp3` was generated with Google's Lyria model from a text prompt (calm acoustic
   guitar, light percussion, no vocals), so it carries no third-party license.
4. **Effects** — Mixkit sound effects (free for commercial use under the Mixkit license, not redistributed here):
   ```bash
   mkdir -p sfx && for id in 1492 2003 2073 2354 2357 2364 2535 2568 2870 2903 3005 3060 3115; do
     curl -s -o sfx/$id.mp3 https://assets.mixkit.co/active_storage/sfx/$id/$id-preview.mp3
     ffmpeg -loglevel error -i sfx/$id.mp3 -ar 44100 -ac 2 sfx/$id.wav
   done
   ```
   `sfx/info.json` holds each clip's peak time (effects are aligned by their peak); `sfx/labels.json` says what each one sounds like.
5. **Mix** — `MUSIC_GAIN=0 python3 mix.py` → `mix.wav` (voice + effects; the delivered reel has no music bed. Drop the variable, or set e.g. `MUSIC_GAIN=0.28`, to mix the Lyria bed in, ducked under the voice) and `voice/scenes.json`.
6. **Frames** — `node render.mjs $PWD/reel.html <framesDir> 30 0-<frames>` (time-driven `render(t)` in `reel.html`;
   `window.DURATION` is the video length once `voice/timings.js` is loaded).
7. **Encode**:
   ```bash
   ffmpeg -framerate 30 -i <framesDir>/f%05d.jpg -i mix.wav -c:v libx264 -crf 18 -pix_fmt yuv420p \
     -c:a aac -b:a 192k -shortest -movflags +faststart FocusPoint-reel.mp4
   ```

## Brand assets
- `assets/logo.svg` / `mark.svg` / `mark-dark.svg`: the Focus Point mark redrawn as vectors from the Instagram avatar.
- `assets/room-*.jpg`: the owner's photos of the meeting room, colour-balanced and cropped.
- Fonts: Alexandria (Arabic + Latin) and Poppins (the Latin wordmark).

## Scenes
Hook (kinetic phrases: noise → focus) → the burgundy "point" wipes to a 3D corridor of burgundy doors (their real
corridor) → a door opens onto the real room → the meeting room on a floating card with feature chips → opening hours
on a clock (sun → moon) → a map pin on the street → end card with the number and the Instagram handle.

## Static post (1080×1350)
`FocusPoint-post.jpg` is rendered from `post.html` with `node shot.mjs $PWD/post.html FocusPoint-post.png 1080 1350`
(same palette, fonts, logo and photos as the reel; headline, hours, address and number are plain HTML to edit).
