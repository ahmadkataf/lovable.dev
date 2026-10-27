# Focus Point — stop-motion ad (Modern Standard Arabic voice-over)

`FocusPoint-stopmotion.mp4`: 1080×1920, 24 fps, 51 s, H.264 + AAC. The owner's real photos printed and taped on a
white paper desk, paper cut-out words, a paper FOCUS switch (the hall's wall decal), a wooden frame tilting over
THINK OUTSIDE THE BOX, a paper clock and map, the real booking screen in a paper phone, and the logo built on a wine
card like the wall sign. Voice only (no music, no click effects), captions without diacritics.

## How it is made
- **Stop-motion look** (`engine.js`): poses change 12 times a second and each is held for two 24-fps frames; every
  piece sits slightly differently in each pose (seeded "hand placement"); the light breathes ±1 % between poses and
  starts dim until the switch flips ON. Deterministic: a frame always renders the same.
- **Parts** (`parts.js`): `photoPrint`, `caption` (words laid down one by one, ragged scissor cut), `focusSwitch`,
  `woodFrame`, `paperClock`, `paperPhone`, `paperTag`, `paperMap`, `logoCard`.
- **Scenes** (`scenes.js`): timed to the voice line by line (`voice/timings.js`); scene changes fall on the pauses
  inside lines. One caption at a time — a caption leaves before the next one lands.
- **Photos** (`photos/p1…p12.jpg`): resized, lightly balanced; `p12` was brightened (dark original);
  `p11-machine.jpg` is the coffee corner cropped to the machine (third-party drink brands out of the main frame).

## Rebuild
```bash
cd marketing/focus-point
export GEMINI_API_KEY=...                       # never commit it
python3 tools/build_vo_text.py stopmotion/voice/script.json stopmotion/voice/vo.txt
python3 tools/gemini_tts.py --in stopmotion/voice/vo.txt --out stopmotion/voice/vo-raw.wav --voice Charon \
  --style "warm, confident, modern Arabic ad narrator; clear Modern Standard Arabic (fusha) pronunciation; brisk, energetic but unhurried"
python3 tools/qa_audio.py stopmotion/voice/vo.wav stopmotion/voice/script.json --msa      # Gemini listens: words + إعراب
python3 tools/tighten.py stopmotion/voice/vo-raw.wav stopmotion/voice/script.json stopmotion/voice/vo.wav stopmotion/voice/timings.json --gap 0.55 --inner 0.35 --tempo 1.07
cd stopmotion
ffmpeg -i voice/vo.wav -af "highpass=f=70,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120,loudnorm=I=-14:TP=-1.5:LRA=7,apad=whole_dur=51" -ar 48000 -ac 2 mix.wav
node ../render.mjs $PWD/ad.html <frames> 24 0-1224
ffmpeg -framerate 24 -i <frames>/f%05d.jpg -i mix.wav -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -t 51 -movflags +faststart FocusPoint-stopmotion.mp4
```
The script (`voice/script.json`) was chosen from a three-writer panel (angle "the switch"), then edited and its
tashkeel checked; Gemini's listening check (`voice/qa.json`): no missing or wrong words, naturalness 9/10, pace good.
