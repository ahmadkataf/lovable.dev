#!/bin/sh
# Packs the Zumurud launch kit into zip files under release/ and prints their sizes.
#
#   sh store/make-package.sh        (from match3/, or from anywhere: paths are resolved from this file)
#
#   release/Zumurud-store-kit.zip           everything needed for a complete Play Console upload:
#                                           the signed .aab and .apk (if built), the guides and the upload
#                                           runbook, play-console.json, listing texts, ASO notes, the privacy
#                                           page, the graphics and the PHONE screenshots with MANIFEST.md
#   release/Zumurud-store-kit-tablets.zip   the 7-inch and 10-inch tablet screenshots (optional on Play)
#   release/Zumurud-ads-creatives.zip       the ad creatives as JPEG (with and without the store line),
#                                           the ad copy and the social captions
#
# Left out everywhere: store/screenshots/raw/ (raw captures, only needed to lay the screenshots out
# again) and store/promo/png (the same creatives as PNG, several times heavier than the JPEGs).
# Every zip is rebuilt from scratch and stays under GitHub's 100 MB per-file limit. Needs python3.
set -eu

HERE=$(cd "$(dirname "$0")" && pwd)
MATCH3=$(dirname "$HERE")
OUT_DIR="$MATCH3/release"
mkdir -p "$OUT_DIR"

cd "$MATCH3"
# check the runbook and play-console.json before packing them
node store/build-play-console.cjs --check

python3 - "$OUT_DIR" <<'PY'
import os, sys, zipfile

out_dir = sys.argv[1]
LIMIT = 100 * 1000 * 1000  # GitHub refuses files of 100 MB and more


def walk(top):
    for root, dirs, files in os.walk(top):
        dirs.sort()
        for f in sorted(files):
            p = os.path.join(root, f).replace(os.sep, '/')
            if f == '.DS_Store' or '/node_modules/' in p:
                continue
            yield p


def pack(name, paths):
    out = os.path.join(out_dir, name)
    if os.path.exists(out):
        os.remove(out)
    paths = list(paths)
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        for src, arc in paths:
            z.write(src, arc)
    size = os.path.getsize(out)
    print('wrote %s  files: %d  size: %d bytes (%.1f MB)' % (out, len(paths), size, size / 1e6))
    if size >= LIMIT:
        sys.exit('make-package: %s is over 100 MB' % name)


TABLETS = ('store/screenshots/tablet7/', 'store/screenshots/tablet10/')
SKIP_MAIN = ('store/screenshots/raw/', 'store/promo/png/', 'store/promo/jpg/', 'store/promo/clean/') + TABLETS

main = [(p, p) for p in walk('store') if not p.startswith(SKIP_MAIN)]
for f in ('Zumurud-1.0.0-ads.aab', 'Zumurud-1.0.0-ads.apk', 'SHA256SUMS.txt'):
    src = os.path.join('release', f)
    if os.path.exists(src):
        main.append((src, 'release/' + f))
    else:
        print('note: release/%s is not built yet, so it is not in the kit' % f)
pack('Zumurud-store-kit.zip', main)

pack('Zumurud-store-kit-tablets.zip', [(p, p) for p in walk('store/screenshots') if p.startswith(TABLETS)])

ads = [(p, p) for p in walk('store/promo') if not p.startswith('store/promo/png/')]
pack('Zumurud-ads-creatives.zip', ads)
PY
