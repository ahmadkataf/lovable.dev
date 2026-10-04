# Emar 12 square promo, version 2

`../Emar12-promo-square-v2.mp4`: 1080×1080, 20 s. Kinetic typography, a 3D phone with UI cards
popping out of the real app screens, quick-cut numbers, and a call to action.

Sound: effects only, no music. The effects are from Mixkit (free for commercial use under the
Mixkit Sound Effects Free License, no attribution required). The raw files are not redistributed
here; download them by id before mixing:

```
mkdir -p sfx && for id in 166 168 772 1053 1063 1143 1492 2003 2073 2299 2350 2354 2357 2364 2568 2608 2655 2870 2903 3005 3060 3115 3120; do
  curl -s -o sfx/$id.mp3 https://assets.mixkit.co/active_storage/sfx/$id/$id-preview.mp3
  ffmpeg -loglevel error -i sfx/$id.mp3 -ar 44100 -ac 2 sfx/$id.wav
done
cp sfx-info.json sfx/info.json
```

The word «misguide» is the app's own Kokoro voice (af_heart) at normal and slow speed (`voice-*.wav`).

1. `python3 mix.py` writes `sfx3.wav`.
2. `H=1080 node render2.mjs $PWD/sq.html <framesDir> 30 0-600`
3. Encode the frames with `sfx3.wav` (libx264, yuv420p, AAC).
