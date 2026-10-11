"""Writes the Android resources of Dentora into <out_dir>/res: the app name and the launcher icons.

Usage (from the dental/ folder, as scripts/build-apk.sh does):
    python3 scripts/android-res.py <out_dir>

Icons come from public/icon.svg, rendered by scripts/make-icons.mjs (Chromium, shared with the Windows build):
  - mipmap-{mdpi..xxxhdpi}/ic_launcher.png            48/72/96/144/192 px: the icon as drawn (Android 7, and any launcher)
  - mipmap-anydpi-v26/ic_launcher.xml + *_background / *_foreground PNGs (108 dp layers): the adaptive icon of
    Android 8+, which the launcher masks to its own shape (circle, squircle…) and Android 12+ shows on the
    splash screen; the foreground doubles as the monochrome layer of Android 13 themed icons.
If Chromium cannot run (a CI machine without the Playwright browser), a small built-in SVG rasterizer (Pillow)
draws the same icon instead and a warning is printed.
"""
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

from PIL import Image, ImageChops, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SVG_PATH = os.path.join(ROOT, 'public', 'icon.svg')
APP_NAME = 'Dentora'

LEGACY = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
ADAPTIVE = {d: s * 108 // 48 for d, s in LEGACY.items()}      # 108 dp layers: 108/162/216/324/432 px
BIG = 432                                                   # the render the adaptive layers are cut from


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)


def xml_escape(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace("'", "\\'").replace('"', '\\"')


# ---- rendering ---------------------------------------------------------------------------------------------

def render_with_chromium(sizes, out_dir):
    """scripts/make-icons.mjs <dir> <size>... → <dir>/icon-<size>.png. Returns {size: Image} or None."""
    try:
        r = subprocess.run(['node', os.path.join('scripts', 'make-icons.mjs'), out_dir] + [str(s) for s in sizes],
                           cwd=ROOT, capture_output=True, text=True, timeout=180)
    except (OSError, subprocess.TimeoutExpired) as e:
        print(f'  (icon renderer did not run: {e})')
        return None
    if r.returncode != 0:
        print('  (icon renderer failed: ' + (r.stderr.strip().splitlines() or ['?'])[-1] + ')')
        return None
    imgs = {}
    for s in sizes:
        p = os.path.join(out_dir, f'icon-{s}.png')
        if not os.path.isfile(p):
            return None
        imgs[s] = Image.open(p).convert('RGBA')
    return imgs


def hex_rgb(h):
    h = h.strip().lstrip('#')
    if len(h) == 3:
        h = ''.join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def gradient_stops(svg_text):
    """[(offset, (r,g,b))…] of the first linearGradient, or None."""
    stops = re.findall(r'<stop[^>]*offset="([\d.]+)"[^>]*stop-color="(#[0-9a-fA-F]{3,6})"', svg_text)
    return [(float(o), hex_rgb(c)) for o, c in stops] or None


def lerp_color(stops, t):
    t = min(1.0, max(0.0, t))
    for (o1, c1), (o2, c2) in zip(stops, stops[1:]):
        if o1 <= t <= o2:
            k = 0 if o2 == o1 else (t - o1) / (o2 - o1)
            return tuple(round(a + (b - a) * k) for a, b in zip(c1, c2))
    return stops[0][1] if t < stops[0][0] else stops[-1][1]


def diagonal_gradient(size, stops):
    """A square filled with the icon's top-left → bottom-right gradient (objectBoundingBox 0,0 → 1,1)."""
    row = Image.new('RGB', (2 * size, 1))
    for i in range(2 * size):
        row.putpixel((i, 0), lerp_color(stops, (i + 1) / (2 * size)))
    img = Image.new('RGB', (size, size))
    for y in range(size):                                       # each row is the ramp shifted by one pixel
        img.paste(row.crop((y, 0, y + size, 1)), (0, y))
    return img


def path_points(d, steps=24):
    """Flattens an SVG path (M L H V C S Q T Z, absolute and relative) into polygons."""
    tokens = re.findall(r'[MmLlHhVvCcSsQqTtZzAa]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?', d)
    polys, cur, i = [], [], 0
    x = y = sx = sy = 0.0
    cmd, last_ctrl = None, None

    def nums(n):
        nonlocal i
        vals = [float(v) for v in tokens[i:i + n]]
        i += n
        return vals

    while i < len(tokens):
        if re.match(r'[A-Za-z]', tokens[i]):
            cmd = tokens[i]
            i += 1
            if cmd in 'Zz':
                if cur:
                    polys.append(cur)
                cur, x, y, last_ctrl = [], sx, sy, None
                continue
        if cmd in 'Aa':
            raise ValueError('arcs are not supported')
        rel = cmd.islower()
        c = cmd.upper()
        ox, oy = (x, y) if rel else (0.0, 0.0)
        if c == 'M':
            px_, py_ = nums(2)
            if cur:
                polys.append(cur)
            x, y = ox + px_, oy + py_
            sx, sy, cur = x, y, [(x, y)]
            cmd = 'l' if rel else 'L'
            last_ctrl = None
        elif c == 'L':
            px_, py_ = nums(2); x, y = ox + px_, oy + py_; cur.append((x, y)); last_ctrl = None
        elif c == 'H':
            (px_,) = nums(1); x = ox + px_; cur.append((x, y)); last_ctrl = None
        elif c == 'V':
            (py_,) = nums(1); y = oy + py_; cur.append((x, y)); last_ctrl = None
        elif c in 'CS':
            if c == 'C':
                x1, y1, x2, y2, ex, ey = nums(6)
                x1, y1 = ox + x1, oy + y1
            else:
                x2, y2, ex, ey = nums(4)
                x1, y1 = (2 * x - last_ctrl[0], 2 * y - last_ctrl[1]) if last_ctrl else (x, y)
            x2, y2, ex, ey = ox + x2, oy + y2, ox + ex, oy + ey
            for k in range(1, steps + 1):
                t = k / steps; u = 1 - t
                cur.append((u ** 3 * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3 * ex,
                            u ** 3 * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3 * ey))
            last_ctrl, x, y = (x2, y2), ex, ey
        elif c in 'QT':
            if c == 'Q':
                qx, qy, ex, ey = nums(4); qx, qy = ox + qx, oy + qy
            else:
                ex, ey = nums(2)
                qx, qy = (2 * x - last_ctrl[0], 2 * y - last_ctrl[1]) if last_ctrl else (x, y)
            ex, ey = ox + ex, oy + ey
            for k in range(1, steps + 1):
                t = k / steps; u = 1 - t
                cur.append((u * u * x + 2 * u * t * qx + t * t * ex, u * u * y + 2 * u * t * qy + t * t * ey))
            last_ctrl, x, y = (qx, qy), ex, ey
    if cur:
        polys.append(cur)
    return polys


def render_with_pillow(svg_text, sizes):
    """Draws the icon (gradient rounded square, white tooth path, circle) without a browser."""
    root = ET.fromstring(svg_text)
    ns = '{http://www.w3.org/2000/svg}'
    vb = [float(v) for v in (root.get('viewBox') or '0 0 256 256').split()]
    stops = gradient_stops(svg_text) or [(0, (20, 184, 166)), (1, (14, 143, 134))]
    ss = 4                                                      # supersampling
    imgs = {}
    for size in sizes:
        big = size * ss
        k = big / vb[2]
        canvas = Image.new('RGBA', (big, big), (0, 0, 0, 0))
        for el in root.iter():
            tag = el.tag.replace(ns, '')
            fill = el.get('fill', '')
            opacity = float(el.get('opacity', '1'))
            mask = Image.new('L', (big, big), 0)
            dr = ImageDraw.Draw(mask)
            if tag == 'rect':
                w, h = float(el.get('width', vb[2])) * k, float(el.get('height', vb[3])) * k
                rx = float(el.get('rx', '0')) * k
                x0, y0 = float(el.get('x', '0')) * k, float(el.get('y', '0')) * k
                dr.rounded_rectangle([x0, y0, x0 + w - 1, y0 + h - 1], radius=rx, fill=255)
            elif tag == 'circle':
                cx, cy, r = (float(el.get(a)) * k for a in ('cx', 'cy', 'r'))
                dr.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
            elif tag == 'path':
                for poly in path_points(el.get('d', '')):
                    if len(poly) > 2:
                        dr.polygon([(px * k, py * k) for px, py in poly], fill=255)
            else:
                continue
            if fill.startswith('url('):
                paint = diagonal_gradient(big, stops).convert('RGBA')
            else:
                paint = Image.new('RGBA', (big, big), hex_rgb(fill or '#000') + (255,))
            if opacity < 1:
                mask = mask.point(lambda v: round(v * opacity))
            layer = Image.new('RGBA', (big, big), (0, 0, 0, 0))
            layer.paste(paint, (0, 0), mask)
            canvas = Image.alpha_composite(canvas, layer)
        imgs[size] = canvas.resize((size, size), Image.LANCZOS)
    return imgs


# ---- adaptive icon layers ----------------------------------------------------------------------------------

def foreground_from(icon, stops):
    """The white mark of the icon on transparency: how far each pixel is from the background gradient towards white."""
    size = icon.size[0]
    bg = diagonal_gradient(size, stops)
    r, _, _, a = icon.split()
    bg_r = bg.split()[0]
    lift = ImageChops.subtract(r, bg_r)                         # 0 on the background, up to (255 - bg) on white
    span = Image.eval(bg_r, lambda v: max(1, 255 - v))
    alpha = Image.new('L', icon.size)
    lp, sp, ap, out = lift.load(), span.load(), a.load(), alpha.load()
    for y in range(size):
        for x in range(size):
            out[x, y] = min(255, round(255 * lp[x, y] / sp[x, y])) * ap[x, y] // 255
    mark = Image.new('RGBA', icon.size, (255, 255, 255, 0))
    mark.putalpha(alpha)
    return mark


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    out = os.path.abspath(sys.argv[1])
    res = os.path.join(out, 'res')
    write(os.path.join(res, 'values', 'strings.xml'),
          '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
          f'    <string name="app_name">{xml_escape(APP_NAME)}</string>\n</resources>\n')

    svg_text = open(SVG_PATH, encoding='utf-8').read()
    stops = gradient_stops(svg_text) or [(0, (20, 184, 166)), (1, (14, 143, 134))]
    sizes = sorted(set(LEGACY.values()) | {BIG})
    tmp = tempfile.mkdtemp(prefix='dentora-icons-')
    try:
        imgs = render_with_chromium(sizes, tmp)
        if imgs is None:
            print('WARNING: Chromium (Playwright) could not render public/icon.svg; drawing the icon with Pillow instead.')
            imgs = render_with_pillow(svg_text, sizes)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    for density, size in LEGACY.items():
        d = os.path.join(res, f'mipmap-{density}')
        os.makedirs(d, exist_ok=True)
        imgs[size].save(os.path.join(d, 'ic_launcher.png'), optimize=True)

    # adaptive: the 256-unit artwork spans the 72 dp visible part of the 108 dp layer, centred
    mark = foreground_from(imgs[BIG], stops)
    inner = round(BIG * 72 / 108)
    fg_big = Image.new('RGBA', (BIG, BIG), (255, 255, 255, 0))
    fg_big.alpha_composite(mark.resize((inner, inner), Image.LANCZOS), ((BIG - inner) // 2, (BIG - inner) // 2))
    bg_big = diagonal_gradient(BIG, stops).convert('RGBA')
    for density, size in ADAPTIVE.items():
        d = os.path.join(res, f'mipmap-{density}')
        fg = fg_big if size == BIG else fg_big.resize((size, size), Image.LANCZOS)
        bg = bg_big if size == BIG else bg_big.resize((size, size), Image.LANCZOS)
        fg.save(os.path.join(d, 'ic_launcher_foreground.png'), optimize=True)
        bg.convert('RGB').save(os.path.join(d, 'ic_launcher_background.png'), optimize=True)
    write(os.path.join(res, 'mipmap-anydpi-v26', 'ic_launcher.xml'),
          '<?xml version="1.0" encoding="utf-8"?>\n'
          '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
          '    <background android:drawable="@mipmap/ic_launcher_background" />\n'
          '    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n'
          '    <monochrome android:drawable="@mipmap/ic_launcher_foreground" />\n'
          '</adaptive-icon>\n')
    print('android res ->', os.path.relpath(res, ROOT))


if __name__ == '__main__':
    main()
