"""Builds build/icon.ico (multi-size Windows icon) from the PNGs rendered by scripts/make-icons.mjs.

    node scripts/make-icons.mjs build 16 20 24 32 40 48 64 128 256 512
    python3 build/make-ico.py

Every size is rendered from the SVG by Chromium, so the small sizes stay sharp (no downscaling blur).
Sizes a PNG is missing for are produced by Pillow from the 512 px master.
"""
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]

master = Image.open(os.path.join(HERE, 'icon-512.png')).convert('RGBA')
frames = []
for s in SIZES:
    p = os.path.join(HERE, f'icon-{s}.png')
    img = Image.open(p).convert('RGBA') if os.path.exists(p) else master.resize((s, s), Image.LANCZOS)
    if img.size != (s, s):
        img = img.resize((s, s), Image.LANCZOS)
    frames.append(img)

out = os.path.join(HERE, 'icon.ico')
largest = frames[-1]
largest.save(out, format='ICO', sizes=[(s, s) for s in SIZES], append_images=frames[:-1])
check = Image.open(out)
print('icon.ico', sorted(check.info.get('sizes', [])), os.path.getsize(out), 'bytes')
sys.exit(0)
