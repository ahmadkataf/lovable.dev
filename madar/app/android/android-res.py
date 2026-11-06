#!/usr/bin/env python3
"""Draws the launcher icons and the splash image of the مَدار app from the pitch site's icon.svg.

    python3 android-res.py [icon.svg] [res_dir]        defaults: ../../site/icon.svg and ./res (next to this file)

Writes under res/:
  mipmap-{mdpi…xxxhdpi}/ic_launcher.png             legacy icon (Android 7.x launchers): the whole SVG, rounded square
  mipmap-{mdpi…xxxhdpi}/ic_launcher_round.png       the same inside a circle (Android 7.1 round launchers)
  mipmap-{mdpi…xxxhdpi}/ic_launcher_foreground.png  adaptive-icon foreground: the orbit on a transparent 108 dp canvas,
                                                    sized to sit inside the 66 dp safe zone whatever mask the launcher uses
  mipmap-{mdpi…xxxhdpi}/ic_launcher_monochrome.png  the same in one colour, for themed icons (Android 13+)
  drawable-nodpi/splash_icon.png                    the whole SVG at 528 px for the splash (132 dp at xxxhdpi)
  values/ic_launcher_background.xml                 the SVG's background colour, behind the adaptive foreground
The adaptive-icon XML, the theme and the strings are hand-written in res/ and are not touched here.

Needs Pillow (pip install pillow). The icon is a rounded square and a handful of circles, so instead of an SVG
renderer this draws those two shapes itself (fill, opacity, stroke, stroke-width, stroke-dasharray). Anything else
in the SVG stops the script, so that the icon can never silently lose a part.
"""
import math
import os
import re
import sys
import xml.etree.ElementTree as ET

from PIL import Image, ImageChops, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
SVG = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '..', 'site', 'icon.svg')
RES = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'res')
DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
SS = 4  # supersampling: Pillow does not anti-alias, so everything is drawn 4x larger and scaled down
ADAPTIVE_CANVAS, ADAPTIVE_FIT = 108, 60   # dp: the icon's 64 units become 60 dp, safely inside the 66 dp mask
SPLASH_PX = 528


def rgba(colour, opacity=1.0):
    m = re.fullmatch(r'#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})', colour.strip())
    if not m:
        raise SystemExit(f'icon.svg: colour {colour!r} is not a hex colour')
    h = m.group(1)
    h = ''.join(c * 2 for c in h) if len(h) == 3 else h
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (round(255 * opacity),)


def load(path):
    root = ET.parse(path).getroot()
    vb = [float(v) for v in root.get('viewBox', '').split()]
    if len(vb) != 4 or vb[0] or vb[1] or vb[2] != vb[3]:
        raise SystemExit('icon.svg: expected a square viewBox starting at 0 0')
    shapes = []
    for el in root:
        tag = el.tag.split('}')[-1]
        if tag not in ('rect', 'circle'):
            raise SystemExit(f'icon.svg: <{tag}> is not drawn by android-res.py; extend it before changing the icon')
        shapes.append((tag, el.attrib))
    return vb[2], shapes


def draw(units, shapes, px, fit, mono=None):
    """Renders `shapes` (SVG user units) on a transparent px×px canvas, the viewBox scaled to fit×fit px and centred.
    With `mono` every shape takes that one colour (the alpha channel is what themed icons use)."""
    big = px * SS
    k = fit * SS / units
    off = (big - fit * SS) / 2

    def x(v):
        return off + v * k

    img = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    for tag, a in shapes:
        layer = Image.new('RGBA', (big, big), (0, 0, 0, 0))   # one layer per shape so that opacity blends
        d = ImageDraw.Draw(layer)
        op = float(a.get('opacity', 1))
        fill = a.get('fill', 'black')
        if tag == 'rect':
            rx, ry, w, h = (float(a.get(n, 0)) for n in ('x', 'y', 'width', 'height'))
            d.rounded_rectangle([x(rx), x(ry), x(rx + w), x(ry + h)], radius=round(float(a.get('rx', 0)) * k), fill=rgba(mono or fill, op))
        else:
            cx, cy, r = (float(a[n]) for n in ('cx', 'cy', 'r'))
            if fill != 'none':
                d.ellipse([x(cx - r), x(cy - r), x(cx + r), x(cy + r)], fill=rgba(mono or fill, op))
            stroke = a.get('stroke', 'none')
            if stroke != 'none':
                w = float(a.get('stroke-width', 1))
                outer = r + w / 2
                box = [x(cx - outer), x(cy - outer), x(cx + outer), x(cy + outer)]
                colour, wpx = rgba(mono or stroke, op), max(1, round(w * k))
                dash = a.get('stroke-dasharray')
                if dash:
                    on, gap = (float(v) for v in re.split(r'[ ,]+', dash.strip()))
                    circ = 2 * math.pi * r
                    pos = 0.0
                    while pos < circ:   # SVG starts a circle's dashes at 3 o'clock and runs clockwise, as Pillow's arc does
                        d.arc(box, 360 * pos / circ, 360 * min(pos + on, circ) / circ, fill=colour, width=wpx)
                        pos += on + gap
                else:
                    d.ellipse(box, outline=colour, width=wpx)
        img = Image.alpha_composite(img, layer)
    return img.resize((px, px), Image.LANCZOS)


def in_circle(img):
    px = img.size[0]
    mask = Image.new('L', (px * SS, px * SS), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, px * SS - 1, px * SS - 1], fill=255)
    out = img.copy()
    out.putalpha(ImageChops.multiply(img.getchannel('A'), mask.resize((px, px), Image.LANCZOS)))
    return out


def save(img, *parts):
    path = os.path.join(RES, *parts)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True)
    return path


units, shapes = load(SVG)
backgrounds = [a for t, a in shapes if t == 'rect' and float(a.get('width', 0)) >= units and float(a.get('height', 0)) >= units]
if not backgrounds:
    raise SystemExit('icon.svg: no full-size background <rect>')
background = backgrounds[0]
foreground = [(t, a) for t, a in shapes if a is not background]

written = []
for density, scale in DENSITIES.items():
    folder = f'mipmap-{density}'
    legacy = draw(units, shapes, round(48 * scale), round(48 * scale))
    written.append(save(legacy, folder, 'ic_launcher.png'))
    written.append(save(in_circle(legacy), folder, 'ic_launcher_round.png'))
    canvas, fit = round(ADAPTIVE_CANVAS * scale), round(ADAPTIVE_FIT * scale)
    written.append(save(draw(units, foreground, canvas, fit), folder, 'ic_launcher_foreground.png'))
    written.append(save(draw(units, foreground, canvas, fit, mono='#000000'), folder, 'ic_launcher_monochrome.png'))
written.append(save(draw(units, shapes, SPLASH_PX, SPLASH_PX), 'drawable-nodpi', 'splash_icon.png'))

colour = background.get('fill', '#ffffff')
rgba(colour)   # validates
path = os.path.join(RES, 'values', 'ic_launcher_background.xml')
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, 'w', encoding='utf-8') as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<!-- written by android-res.py: the background <rect> of ../../site/icon.svg -->\n'
            f'<resources>\n    <color name="ic_launcher_background">{colour}</color>\n</resources>\n')
written.append(path)
print(f'{len(written)} files from {os.path.relpath(SVG, HERE)} -> {os.path.relpath(RES, HERE)}/')
