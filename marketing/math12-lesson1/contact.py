#!/usr/bin/env python3
"""Contact sheet of stills for quick review: python3 contact.py <stills dir> <out.jpg> [cols] [width]"""
import glob, os, sys
from PIL import Image, ImageDraw

d, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
w = int(sys.argv[4]) if len(sys.argv) > 4 else 480
files = sorted(glob.glob(os.path.join(d, '*.png')))
h = w * 9 // 16
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (w + 8) + 8, rows * (h + 30) + 8), (20, 20, 28))
dr = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((w, h), Image.LANCZOS)
    x, y = 8 + (i % cols) * (w + 8), 8 + (i // cols) * (h + 30)
    sheet.paste(im, (x, y))
    dr.text((x + 4, y + h + 6), os.path.basename(f)[:-4], fill=(200, 200, 220))
sheet.save(out, quality=85)
print(f'{len(files)} stills → {out}')
