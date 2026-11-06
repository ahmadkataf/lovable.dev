# Focus Point — photo montage (Modern Standard Arabic voice-over)

`FocusPoint-montage.mp4`: 1080×1920, 30 fps, 52 s, H.264 + AAC. The owner's real photos, full frame, drifting
sideways (no zoom); a wine panel wipes across between lines, short cross-fades on pauses inside a line; one caption at
a time (no diacritics on screen); the real booking screen in a phone; a white end card with the logo and contacts.
Voice only (no music, no effects).

## Rebuild
```bash
cd marketing/focus-point
export GEMINI_API_KEY=...        # never commit it
python3 tools/build_vo_text.py montage/voice/script.json montage/voice/vo.txt
# gemini-3.8-flash-tts was out of daily quota, so this voice came from gemini-2.5-pro-preview-tts (--classic)
python3 tools/gemini_tts.py --classic --model gemini-2.5-pro-preview-tts --in montage/voice/vo.txt --out montage/voice/vo-raw.wav --voice Charon \
  --style "a professional Arabic documentary advertisement narrator, deep, warm and calmly confident, in clear Modern Standard Arabic, measured and cinematic"
python3 tools/qa_audio.py montage/voice/vo-raw.wav montage/voice/script.json --msa   # no missing words, naturalness 9/10
python3 tools/tighten.py montage/voice/vo-raw.wav montage/voice/script.json montage/voice/vo.wav montage/voice/timings.json --gap 0.6 --inner 0.38 --tempo 1.04
cd montage
ffmpeg -i voice/vo.wav -af "highpass=f=70,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120,loudnorm=I=-14:TP=-1.5:LRA=7,apad=whole_dur=52" -ar 48000 -ac 2 mix.wav
node ../render.mjs $PWD/montage.html <frames> 30 0-1560
ffmpeg -framerate 30 -i <frames>/f%05d.jpg -i mix.wav -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -t 52 -movflags +faststart FocusPoint-montage.mp4
```
Photos are shared with the stop-motion ad (`../stopmotion/photos`).
