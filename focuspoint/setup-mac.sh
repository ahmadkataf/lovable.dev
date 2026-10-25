#!/bin/bash
# Focus Point — deploy from a Mac with one line in Terminal:
#
#   curl -fsSL https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-06585dff-jdo0jv/focuspoint/setup-mac.sh | bash
#
# 1) installs Node.js (official installer from nodejs.org) if it is missing or older than 18
# 2) downloads only the focuspoint folder of the repository (a few MB, not the whole repo) into ~/focuspoint
# 3) runs node deploy.mjs (Cloudflare login in the browser, database, build, deploy, secrets, first admin)
# Safe to run again: it refreshes the code and deploy.mjs keeps the data and the existing secrets.
set -euo pipefail
REPO="ahmadkataf/lovable.dev"
BRANCH="ccr-06585dff-jdo0jv"
DIR="$HOME/focuspoint"
TMP="${TMPDIR:-/tmp}"
title() { printf '\n\033[1m%s\033[0m\n' "$*"; }

node_major() { node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }
if ! command -v node >/dev/null 2>&1 || [ "$(node_major)" -lt 18 ]; then
  title "1/3  تثبيت Node.js — سيطلب كلمة مرور الماك (لا تظهر أثناء الكتابة؛ اكتبها واضغط Enter)"
  PKG=$(curl -fsSL https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt | awk '/\.pkg$/{print $2; exit}')
  [ -n "$PKG" ] || { echo "تعذّر الوصول إلى nodejs.org — شغّل VPN وأعد المحاولة"; exit 1; }
  curl -fL --progress-bar "https://nodejs.org/dist/latest-v22.x/$PKG" -o "$TMP/node.pkg"
  sudo installer -pkg "$TMP/node.pkg" -target / < /dev/tty
  rm -f "$TMP/node.pkg"
  export PATH="/usr/local/bin:$PATH"
else
  title "1/3  Node.js موجود ($(node -v))"
fi

title "2/3  تنزيل ملفات النظام إلى $DIR"
mkdir -p "$DIR"
node - "$REPO" "$BRANCH" "$DIR" <<'JS'
const [repo, branch, dir] = process.argv.slice(2)
const fs = require('fs'), path = require('path')
const api = `https://api.github.com/repos/${repo}`
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function get(url, json) {
  for (let a = 0; ; a++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'focuspoint-setup', accept: json ? 'application/vnd.github+json' : '*/*' } })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return json ? r.json() : Buffer.from(await r.arrayBuffer())
    } catch (e) {
      if (a >= 4) throw new Error(`${url} → ${e.message}`)
      await sleep(1500 * (a + 1))
    }
  }
}
;(async () => {
  const root = await get(`${api}/git/trees/${encodeURIComponent(branch)}`, true)
  const fp = root.tree.find(t => t.path === 'focuspoint' && t.type === 'tree')
  if (!fp) throw new Error('focuspoint folder not found on the branch')
  const tree = await get(`${api}/git/trees/${fp.sha}?recursive=1`, true)
  // what deploying needs; the Android project and the screenshots are left out
  const files = tree.tree.filter(t => t.type === 'blob' && !/^(android|docs\/screens|docs\/smoke)\//.test(t.path))
  const queue = [...files]; let done = 0
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const t = queue.shift()
      const url = `https://raw.githubusercontent.com/${repo}/${branch}/focuspoint/${t.path.split('/').map(encodeURIComponent).join('/')}`
      const out = path.join(dir, t.path)
      fs.mkdirSync(path.dirname(out), { recursive: true })
      fs.writeFileSync(out, await get(url, false))
      process.stdout.write(`\r   ${++done}/${files.length}`)
    }
  }))
  process.stdout.write('\n')
})().catch(e => { console.error(`\n✗ تعذّر التنزيل: ${e.message}\n  تحقق من الإنترنت (أو شغّل VPN) وأعد تشغيل الأمر.`); process.exit(1) })
JS

title "3/3  النشر على Cloudflare"
cd "$DIR"
node deploy.mjs < /dev/tty
