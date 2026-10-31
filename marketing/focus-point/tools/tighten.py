#!/usr/bin/env python3
"""Tighten a narration and write its line timings in one go.

  python3 tools/tighten.py voice/vo-raw.wav voice/script.json voice/vo.wav voice/timings.json [--gap 0.6] [--inner 0.4] [--tempo 1.06]

The N-1 longest silences of the raw take are the pauses between the N lines (the <long pause> tags); they are
cut to --gap seconds. Other silences longer than 0.6 s (the "..." inside a line) are cut to --inner. Then the
whole take is sped up by --tempo with ffmpeg's atempo (pitch unchanged). The line boundaries are tracked
through the cuts and the tempo change and written as timings.json (+ timings.js for the page).
"""
import json, os, subprocess, sys, wave
import numpy as np

src, script, dst, tout = sys.argv[1:5]
arg = lambda k, d: float(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d
GAP, INNER, TEMPO = arg('--gap', 0.6), arg('--inner', 0.4), arg('--tempo', 1.06)
lines = json.load(open(script, encoding='utf-8'))['lines']; N = len(lines)

w = wave.open(src); sr = w.getframerate(); ch = w.getnchannels()
x = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float64) / 32768
if ch > 1: x = x.reshape(-1, ch).mean(1)
hop = int(sr * 0.01)
env = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, len(x) - hop, hop)])
voiced = env > max(env.max() * 0.02, 0.003)
runs, i = [], 0
while i < len(voiced):
    if not voiced[i]:
        j = i
        while j < len(voiced) and not voiced[j]: j += 1
        runs.append((i * hop, j * hop)); i = j
    else: i += 1
first = next((k for k, v in enumerate(voiced) if v), 0) * hop
last = (len(voiced) - next((k for k, v in enumerate(voiced[::-1]) if v), 0)) * hop
inner_runs = [(a, b) for a, b in runs if a > first and b < last]
line_gaps = set(sorted(inner_runs, key=lambda r: r[1] - r[0], reverse=True)[:N - 1])
assert len(line_gaps) == N - 1, 'not enough pauses to split the lines'

out, pos, fade = [], 0, int(0.02 * sr)
new_len = 0
bounds_new, pauses_new = [], []          # line boundaries / shortened inner pauses, in output samples
first_new = None
for a, b in sorted(inner_runs):
    dur = (b - a) / sr
    is_gap = (a, b) in line_gaps
    keep = GAP if is_gap else (INNER if dur > 0.6 else None)
    if keep is None:
        if dur >= 0.22: pauses_new.append((a - pos + new_len, b - pos + new_len))
        continue
    k = int(keep * sr); half = k // 2
    seg = x[pos:a + half].copy(); seg[-fade:] *= np.linspace(1, 0, fade)
    tail = x[b - (k - half):b].copy(); tail[:fade] *= np.linspace(0, 1, fade)
    out += [seg, tail]
    new_len += len(seg)                   # position of the gap centre in the output
    if is_gap: bounds_new.append(new_len)
    else: pauses_new.append((new_len - half, new_len + (k - half)))
    new_len += len(tail); pos = b
out.append(x[pos:]); y = np.concatenate(out)
first_new = first; last_new = len(y) - (len(x) - last)

tmp = dst + '.tmp.wav'
with wave.open(tmp, 'wb') as o:
    o.setnchannels(1); o.setsampwidth(2); o.setframerate(sr); o.writeframes((np.clip(y, -1, 1) * 32767).astype('<i2').tobytes())
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', tmp, '-af', f'atempo={TEMPO}', '-ar', str(sr), '-ac', '1', dst], check=True)
os.remove(tmp)
with wave.open(dst) as o: dur_new = o.getnframes() / o.getframerate()

T = lambda smp: round(smp / sr / TEMPO, 3)
bounds = [T(first_new)] + [T(b) for b in bounds_new] + [T(last_new)]
res = {"duration": dur_new, "first_voice": bounds[0], "last_voice": bounds[-1], "lines": [], "gaps": []}
for i, l in enumerate(lines):
    a, b = bounds[i], bounds[i + 1]
    voice_end = b if i == N - 1 else round(b - GAP / 2 / TEMPO, 3)
    ps = [[T(p), T(q)] for p, q in pauses_new if T(p) > a + .2 and T(q) < b - .2]
    res["lines"].append({"id": l.get('id', str(i)), "start": a, "end": b, "voice_end": voice_end, "text": l['vo'], "screen": l.get('screen', ''), "pauses": ps})
    if i < N - 1: res["gaps"].append([voice_end, round(b + GAP / 2 / TEMPO, 3)])
json.dump(res, open(tout, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
open(tout[:-5] + '.js', 'w', encoding='utf-8').write('window.TIMINGS=' + json.dumps(res, ensure_ascii=False) + ';\n')
print(f'{len(x) / sr:.1f}s → {dur_new:.1f}s (tempo ×{TEMPO})')
for l in res['lines']: print(f"{l['id']:>3} {l['start']:6.2f} → {l['end']:6.2f} ({l['end'] - l['start']:.2f}s) pauses {l['pauses']}  {l['text'][:40]}")
