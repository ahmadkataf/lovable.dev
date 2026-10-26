"""Writes the Android resources (app name + launcher icons) into <out>/res.
Usage: python3 scripts/android-res.py <out_dir>"""
import os, sys
from PIL import Image, ImageDraw

out = sys.argv[1]
res = os.path.join(out, 'res')
os.makedirs(os.path.join(res, 'values'), exist_ok=True)
open(os.path.join(res, 'values', 'strings.xml'), 'w', encoding='utf-8').write(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="app_name">صناديق الليزر</string>\n</resources>\n')

BASE, SHADE, INK = (180, 83, 9), (144, 66, 7), (255, 244, 230)
for density, size in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    d = os.path.join(res, f'mipmap-{density}'); os.makedirs(d, exist_ok=True)
    s = size * 4  # draw large, then shrink for smooth edges
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0)); dr = ImageDraw.Draw(img)
    dr.rounded_rectangle([0, 0, s - 1, s - 1], radius=s * 0.22, fill=BASE + (255,))
    dr.rectangle([0, int(s * 0.86), s - 1, s - 1], fill=SHADE + (255,))
    dr.rounded_rectangle([0, int(s * 0.80), s - 1, s - 1], radius=s * 0.22, fill=SHADE + (255,))
    dr.rectangle([0, int(s * 0.80), s - 1, int(s * 0.86)], fill=SHADE + (255,))
    # an open box seen from above-front: a cube with a lifted lid
    w = int(s * 0.055)
    cx, cy = s * 0.5, s * 0.52
    top = [(cx, cy - s * 0.26), (cx + s * 0.26, cy - s * 0.13), (cx, cy), (cx - s * 0.26, cy - s * 0.13)]
    left = [(cx - s * 0.26, cy - s * 0.13), (cx, cy), (cx, cy + s * 0.27), (cx - s * 0.26, cy + s * 0.14)]
    right = [(cx + s * 0.26, cy - s * 0.13), (cx, cy), (cx, cy + s * 0.27), (cx + s * 0.26, cy + s * 0.14)]
    for poly in (left, right, top):
        dr.polygon(poly, outline=INK + (255,), width=w)
    # finger-joint hint along the front edge
    for k in range(3):
        x0 = cx - s * 0.26 + k * s * 0.17 + s * 0.03
        dr.rectangle([x0, cy + s * 0.14 + (k % 2) * s * 0.02, x0 + s * 0.06, cy + s * 0.2], fill=INK + (255,))
    img = img.resize((size, size), Image.LANCZOS)
    img.save(os.path.join(d, 'ic_launcher.png'))
print('res ->', res)
