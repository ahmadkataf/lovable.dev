#!/usr/bin/env bash
# Builds the web version of an online book (for iPhone and computers) into the server's public app folder,
# served at <server>/app/.   ./scripts/build-web.sh g12
# It is the same app as the Android one, with the free unit only; the rest comes from the server after activation.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BOOK="${1:-g12}"
cd "$ROOT"
[ -f "generated/$BOOK/index.ts" ] || node scripts/split-online.mjs "$BOOK"
EMAR_STORE=web BOOK="$BOOK" npx vite build --outDir "dist/web-$BOOK" >/dev/null
rm -f "dist/web-$BOOK/artifact.html"
# the home-screen icon iPhones want: a PNG, drawn like the Android launcher icon
python3 - "$BOOK" "dist/web-$BOOK/apple-touch-icon.png" <<'PY'
import json, sys
from PIL import Image, ImageDraw, ImageFont
book, out = sys.argv[1], sys.argv[2]
m = json.load(open(f'src/books/{book}/book.json'))
size = 180
img = Image.new('RGB', (size, size), m['color'])
d = ImageDraw.Draw(img)
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 88)
except Exception: font = ImageFont.load_default()
bb = d.textbbox((0, 0), m['iconText'], font=font)
d.text(((size - (bb[2] - bb[0])) / 2 - bb[0], (size - (bb[3] - bb[1])) / 2 - bb[1]), m['iconText'], font=font, fill='white')
img.save(out)
PY
rm -rf "server/content/app"
cp -r "dist/web-$BOOK" "server/content/app"
echo "web app for $BOOK -> server/content/app ($(du -sh server/content/app | cut -f1))"
