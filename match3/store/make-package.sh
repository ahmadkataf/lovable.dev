#!/bin/sh
# Zips the Zumurud store kit into release/Zumurud-store-kit.zip and prints its size.
#
#   sh store/make-package.sh        (from match3/, or from anywhere: paths are resolved from this file)
#
# Included: everything under store/ (guides, runbook, play-console.json, listing texts, ASO, privacy page,
# graphics, the upload screenshots with MANIFEST.md, promo copy documents and the promo manifest).
# Left out: store/screenshots/raw/ (raw captures, only needed to re-lay out the screenshots) and the
# big promo image folders store/promo/clean, store/promo/png, store/promo/jpg.
# The zip is rebuilt from scratch each time. Needs `zip` (falls back to Python's zipfile).
set -eu

HERE=$(cd "$(dirname "$0")" && pwd)
MATCH3=$(dirname "$HERE")
OUT_DIR="$MATCH3/release"
OUT="$OUT_DIR/Zumurud-store-kit.zip"

mkdir -p "$OUT_DIR"
rm -f "$OUT"

cd "$MATCH3"
# check the runbook and play-console.json before packing them
node store/build-play-console.cjs --check

if command -v zip >/dev/null 2>&1; then
  zip -q -r -X "$OUT" store \
    -x 'store/screenshots/raw/*' \
    -x 'store/promo/clean/*' -x 'store/promo/png/*' -x 'store/promo/jpg/*' \
    -x '*.DS_Store' -x '*/node_modules/*'
else
  python3 - "$OUT" <<'PY'
import os, sys, zipfile
out = sys.argv[1]
skip = ('store/screenshots/raw/', 'store/promo/clean/', 'store/promo/png/', 'store/promo/jpg/')
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk('store'):
        dirs.sort()
        for f in sorted(files):
            p = os.path.join(root, f).replace(os.sep, '/')
            if p.startswith(skip) or f == '.DS_Store' or '/node_modules/' in p:
                continue
            z.write(p, p)
PY
fi

count=$(python3 -c "import zipfile,sys;print(len(zipfile.ZipFile(sys.argv[1]).namelist()))" "$OUT")
bytes=$(wc -c < "$OUT" | tr -d ' ')
echo "wrote $OUT"
echo "files: $count"
echo "size: $bytes bytes ($(du -h "$OUT" | cut -f1))"
