# SUFIX promo video (Reels / TikTok / Story)

`SUFIX-promo.mp4`: 1080×1920, 24.5 s, 30 fps, H.264 + AAC, sound effects only (no music), synthesized in `sfx.py`.

Scenes: kinetic hook (درونك تعطّل؟ / هاتفك انكسر؟ / بدك قطعة DJI أصلية؟) → logo reveal → 3D phone tour of the real site
(home, shop, DJI models, product, checkout, the WhatsApp order button) → repair ticket timeline → counters → call to action with the WhatsApp number.

Regenerate:

1. `node shots.mjs` captures the phone screenshots in `shots/` from the site running on `http://localhost:8791` (`cd sufix && npm run build && PORT=8791 npm run server`).
2. `python3 sfx.py` writes `sfx.wav`.
3. `node render.mjs $PWD/promo.html <framesDir> 30 0-735` renders the frames (time-driven `render(t)` in `promo.html`; `PNG=1` for lossless frames).
4. Encode:
   `ffmpeg -framerate 30 -i <framesDir>/f%05d.jpg -i sfx.wav -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart SUFIX-promo.mp4`

`fonts.css` and the `.woff2` files are the site's own fonts (IBM Plex Sans Arabic, Inter) so the video renders without network access.
