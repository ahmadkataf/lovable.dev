#!/usr/bin/env python3
"""script.json → script-review.html (RTL page for the owner to read and approve the narration)."""
import html, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
WPS = 1.74  # ar-001-tutor-2


def esc(t):
    return html.escape(t)


def screen_html(t):
    # keep LaTeX readable: show $…$ as LTR code chips
    out = []
    for part in re.split(r'(\$[^$]+\$)', t):
        if part.startswith('$') and part.endswith('$') and len(part) > 2:
            out.append(f'<code dir="ltr">{esc(part[1:-1])}</code>')
        else:
            out.append(esc(part))
    return ''.join(out)


def main(out, video=''):
    s = json.load(open(os.path.join(HERE, video, 'script.json'), encoding='utf-8'))
    total_w = sum(len(l['say'].split()) for sc in s['scenes'] for l in sc['lines'])
    rows = []
    t = 0.0
    for sc in s['scenes']:
        w = sum(len(l['say'].split()) for l in sc['lines'])
        d = w / WPS + sum(float(l.get('hold', 0) or 0) for l in sc['lines']) + 1.8 + .5 * (len(sc['lines']) - 1)
        mm = f'{int(t // 60)}:{int(t % 60):02d}'
        lines = ''.join(
            f'<li><p class="say">{esc(l["say"])}</p><details><summary>على الشاشة</summary><p class="scr">{screen_html(l.get("screen", ""))}</p></details></li>'
            for l in sc['lines'])
        page = f'<span class="pg">ص {sc["bookPage"]}</span>' if sc.get('bookPage') else ''
        rows.append(f'<section><header><span class="id">{sc["id"]}</span><h2>{esc(sc.get("section", ""))}</h2>{page}<span class="tm">{mm}</span></header><ol>{lines}</ol></section>')
        t += d
    doc = f'''<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>نص التعليق — الدرس الأول</title>
<style>
:root{{--bg:#f6f4fb;--card:#fff;--ink:#17131f;--mut:#6b6480;--acc:#7c3aed;--line:#e6e1f2}}
@media (prefers-color-scheme:dark){{:root{{--bg:#0f0d16;--card:#191624;--ink:#eeeaf6;--mut:#a29cb6;--acc:#b794ff;--line:#2a2638}}}}
body{{margin:0;background:var(--bg);color:var(--ink);font:17px/1.9 system-ui,"Segoe UI",Tahoma,sans-serif}}
main{{max-width:860px;margin:0 auto;padding:28px 16px 80px}}
h1{{font-size:28px;margin:0 0 4px}} .sub{{color:var(--mut);margin:0 0 22px}}
section{{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px 20px;margin:0 0 16px}}
header{{display:flex;align-items:center;gap:10px;flex-wrap:wrap}}
header h2{{font-size:20px;margin:0;flex:1}}
.id,.pg,.tm{{font-size:13px;color:var(--mut);border:1px solid var(--line);border-radius:999px;padding:2px 10px}}
.id{{color:var(--acc);border-color:var(--acc)}}
ol{{margin:10px 0 0;padding:0 22px 0 0}} li{{margin:0 0 10px}}
.say{{margin:0}} details{{margin:2px 0 0}} summary{{cursor:pointer;color:var(--mut);font-size:14px}}
.scr{{margin:6px 0 0;color:var(--mut);font-size:15px;line-height:1.8}}
code{{background:rgba(124,58,237,.08);border-radius:6px;padding:1px 6px;font-size:14px;unicode-bidi:isolate}}
</style></head><body><main>
<h1>{esc(s.get("title", ""))} — نص التعليق الصوتي</h1>
<p class="sub">{len(s["scenes"])} مشهداً · {sum(len(sc["lines"]) for sc in s["scenes"])} مقطعاً · {total_w} كلمة · المدة التقريبية {t / 60:.0f} دقيقة بصوت Tutor 2. افتح «على الشاشة» لترى ما يظهر أثناء كل مقطع.</p>
{"".join(rows)}
</main></body></html>'''
    open(out, 'w', encoding='utf-8').write(doc)
    print(f'wrote {out}: {total_w} words, ~{t / 60:.1f} min')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'script-review.html'), sys.argv[2] if len(sys.argv) > 2 else '')
