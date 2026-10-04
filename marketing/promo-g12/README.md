# Emar 12 promo video (Instagram/WhatsApp story)

`Emar12-promo-story.mp4`: 1080×1920, 21.5 s, 30 fps, H.264 + AAC, sound effects only (no music), synthesized in `sfx.py`.

Regenerate:

1. `python3 sfx.py` writes `sfx.wav` (it reuses the sound generators in `music.py`).
2. `node render.mjs $PWD/promo.html <framesDir> 30 0-645` renders frames (time-driven `render(t)` in promo.html).
3. Encode:
   `ffmpeg -framerate 30 -i <framesDir>/f%05d.jpg -i sfx.wav -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart Emar12-promo-story.mp4`

The `s-*.png` files are real screenshots of the web build (captured with `shots.mjs`).

## Square video (feed post)

`Emar12-promo-square.mp4` (1080×1080, 20.5 s) and a lighter `Emar12-square-small.mp4`.
Light editorial style, sound effects only. Sources are in `square/`:

1. `python3 sfx2.py` writes `sfx2.wav`.
2. `H=1080 node render2.mjs $PWD/square.html <framesDir> 30 0-615`
3. Encode the frames with `sfx2.wav` as above.
