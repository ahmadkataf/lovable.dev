# Emar 12 promo video (Instagram/WhatsApp story)

`Emar12-promo-story.mp4`: 1080×1920, 21.5 s, 30 fps, H.264 + AAC, original synthesized music.

Regenerate:

1. `python3 music.py` writes `music.wav`.
2. `node render.mjs $PWD/promo.html <framesDir> 30 0-645` renders frames (time-driven `render(t)` in promo.html).
3. Encode:
   `ffmpeg -framerate 30 -i <framesDir>/f%05d.jpg -i music.wav -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart Emar12-promo-story.mp4`

The `s-*.png` files are real screenshots of the web build (captured with `shots.mjs`).
