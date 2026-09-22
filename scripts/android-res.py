"""Writes the Android resources for one book (app name + launcher icons) into <out>/res.
Usage: python3 scripts/android-res.py <book> <out_dir>"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

book, out = sys.argv[1], sys.argv[2]
meta = json.load(open(f'src/books/{book}/book.json'))
res = os.path.join(out, 'res')
os.makedirs(os.path.join(res, 'values'), exist_ok=True)
name = meta['appName'].replace('&', '&amp;').replace('<', '&lt;')
open(os.path.join(res, 'values', 'strings.xml'), 'w').write(
    f'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="app_name">{name}</string>\n</resources>\n')

def hex_rgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

base = hex_rgb(meta['color'])
shade = tuple(max(0, int(c * 0.8)) for c in base)
font_path = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
for density, size in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    d = os.path.join(res, f'mipmap-{density}'); os.makedirs(d, exist_ok=True)
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0)); dr = ImageDraw.Draw(img)
    r = size * 0.22
    dr.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=base + (255,))
    dr.rectangle([0, int(size * 0.86), size - 1, int(size * 0.90)], fill=shade + (255,))
    text = meta['iconText']
    fs = int(size * (0.5 if len(text) <= 2 else 0.36))
    try: font = ImageFont.truetype(font_path, fs)
    except Exception: font = ImageFont.load_default()
    bb = dr.textbbox((0, 0), text, font=font)
    dr.text(((size - (bb[2] - bb[0])) / 2 - bb[0], (size * 0.9 - (bb[3] - bb[1])) / 2 - bb[1]), text, font=font, fill='white')
    img.save(os.path.join(d, 'ic_launcher.png'))
print('res for', book, '->', res)
