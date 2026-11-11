"""Writes the Android resources of Kaseb (app name + launcher icons) into <out>/res.
Usage: python3 scripts/android-res.py <out_dir> [icon.png] [icon-fg.png] [icon-bg.png]
Defaults: build/icon.png (legacy icon), build/icon-fg.png + build/icon-bg.png (adaptive icon layers, from scripts/make-icons.mjs).
Needs Pillow (pip install pillow)."""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'android', 'build', 'app')
icon = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'build', 'icon.png')
icon_fg = sys.argv[3] if len(sys.argv) > 3 else os.path.join(ROOT, 'build', 'icon-fg.png')
icon_bg = sys.argv[4] if len(sys.argv) > 4 else os.path.join(ROOT, 'build', 'icon-bg.png')

APP_NAME = 'كاسب'
# launcher icon: 48dp; adaptive layers: 108dp
DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}

res = os.path.join(out, 'res')
os.makedirs(os.path.join(res, 'values'), exist_ok=True)
with open(os.path.join(res, 'values', 'strings.xml'), 'w', encoding='utf-8') as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
            f'    <string name="app_name">{APP_NAME}</string>\n'
            '</resources>\n')


def resized(path, size):
    img = Image.open(path).convert('RGBA')
    return img.resize((size, size), Image.LANCZOS)


if not os.path.isfile(icon):
    sys.exit(f'android-res: {icon} is missing — run `node scripts/make-icons.mjs` first')

adaptive = os.path.isfile(icon_fg) and os.path.isfile(icon_bg)
for density, scale in DENSITIES.items():
    d = os.path.join(res, f'mipmap-{density}')
    os.makedirs(d, exist_ok=True)
    resized(icon, int(48 * scale)).save(os.path.join(d, 'ic_launcher.png'))
    if adaptive:
        resized(icon_fg, int(108 * scale)).save(os.path.join(d, 'ic_launcher_foreground.png'))
        resized(icon_bg, int(108 * scale)).save(os.path.join(d, 'ic_launcher_background.png'))

if adaptive:
    # Android 8+ masks the icon into the launcher's shape (circle, squircle...) from these two layers;
    # older phones use the plain ic_launcher.png above.
    d = os.path.join(res, 'mipmap-anydpi-v26')
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, 'ic_launcher.xml'), 'w', encoding='utf-8') as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n'
                '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
                '    <background android:drawable="@mipmap/ic_launcher_background"/>\n'
                '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
                '</adaptive-icon>\n')

print('android res ->', res, '(adaptive icon)' if adaptive else '(legacy icon only)')
