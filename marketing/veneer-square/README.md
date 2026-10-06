# Veneer factory square post (1080×1080)

Third promo for منجرة الإبداع, same layout as `../carpentry-square`. It covers pressing natural and artificial wood veneer onto MDF and particle board.

The palette is forest green, brass and cream.

- `template.html` holds the source. `build.py` adds the wood-grain patterns and the veneer sample fan, then writes `design.html`.
- `veneer-square.png` is the exported image at 2160×2160.
- `wa-qr.svg` is the WhatsApp QR code. It opens a chat with https://wa.me/963996489504.

Rebuild and re-export after edits:

```
python3 build.py
node render.mjs "$PWD/design.html" "$PWD/veneer-square.png"
```
