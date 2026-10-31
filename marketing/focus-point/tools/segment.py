#!/usr/bin/env python3
"""Split one narration WAV into its lines by the pauses between them, and write timings.json.

  python3 segment.py voice/vo.wav voice/script.json voice/timings.json [--min-gap 0.42]

The narration is generated from script.json with a <long pause> tag between lines, so the gaps
between lines are longer than the gaps between sentences. The N-1 longest gaps split N lines.
Output: {"duration": s, "lines": [{"id", "start", "end", "text"}...], "gaps": [...]} .
"""
import json, sys, wave
import numpy as np


def load(path):
    with wave.open(path) as w:
        sr = w.getframerate(); ch = w.getnchannels()
        x = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float64) / 32768
    if ch > 1:
        x = x.reshape(-1, ch).mean(1)
    return x, sr


def main():
    wav, script, out = sys.argv[1:4]
    min_gap = float(sys.argv[sys.argv.index('--min-gap') + 1]) if '--min-gap' in sys.argv else 0.42
    x, sr = load(wav)
    lines = json.load(open(script, encoding='utf-8'))['lines']
    n = len(lines)
    hop = int(sr * 0.01)
    env = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, len(x) - hop, hop)])
    thr = max(env.max() * 0.02, 0.003)
    voiced = env > thr
    # runs of silence
    runs, i = [], 0
    while i < len(voiced):
        if not voiced[i]:
            j = i
            while j < len(voiced) and not voiced[j]:
                j += 1
            runs.append((i * hop / sr, j * hop / sr))
            i = j
        else:
            i += 1
    first_voice = next((k for k, v in enumerate(voiced) if v), 0) * hop / sr
    last_voice = (len(voiced) - next((k for k, v in enumerate(voiced[::-1]) if v), 0)) * hop / sr
    inner = [(a, b) for a, b in runs if a > first_voice and b < last_voice and b - a >= min_gap]
    inner.sort(key=lambda r: r[1] - r[0], reverse=True)
    cuts = sorted(inner[:n - 1], key=lambda r: r[0])
    if len(cuts) < n - 1:
        print(f"WARNING: found {len(cuts)} gaps >= {min_gap}s but need {n - 1}; splitting the rest by text length", file=sys.stderr)
    bounds = [first_voice]
    for a, b in cuts:
        bounds.append((a + b) / 2)
    bounds.append(last_voice)
    # if too few cuts, distribute remaining lines proportionally inside the last segment
    while len(bounds) - 1 < n:
        seg_start, seg_end = bounds[-2], bounds[-1]
        k = n - (len(bounds) - 1) + 1  # lines to fit in the last segment
        texts = [len(l['vo']) for l in lines[-k:]]
        tot = sum(texts); acc = seg_start; new = [seg_start]
        for t in texts[:-1]:
            acc += (seg_end - seg_start) * t / tot; new.append(acc)
        new.append(seg_end)
        bounds = bounds[:-2] + new
    # inner pauses (>= 0.22 s) inside each line, e.g. the "..." before the address: the page can cut on them
    def inner(i):
        a, b = bounds[i], bounds[i + 1]
        return [[round(p, 3), round(q, 3)] for p, q in runs if p > a + .2 and q < b - .2 and q - p >= 0.22 and (p, q) not in cuts]
    res = {"duration": len(x) / sr, "first_voice": first_voice, "last_voice": last_voice,
           "lines": [{"id": l.get('id', str(i)), "start": round(bounds[i], 3), "end": round(bounds[i + 1], 3),
                      "voice_end": round(next((a for a, b in cuts if abs((a + b) / 2 - bounds[i + 1]) < 1e-6), bounds[i + 1]), 3),
                      "text": l['vo'], "screen": l.get('screen', ''), "pauses": inner(i)} for i, l in enumerate(lines)],
           "gaps": [[round(a, 3), round(b, 3)] for a, b in cuts]}
    json.dump(res, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # same data as a script the page can load from file:// (no fetch needed)
    open(out[:-5] + '.js' if out.endswith('.json') else out + '.js', 'w', encoding='utf-8').write('window.TIMINGS=' + json.dumps(res, ensure_ascii=False) + ';\n')
    for l in res['lines']:
        print(f"{l['id']:>3} {l['start']:6.2f} → {l['end']:6.2f}  ({l['end'] - l['start']:.2f}s)  {l['text'][:50]}")
    print(f"total {res['duration']:.2f}s, speech {first_voice:.2f}–{last_voice:.2f}")


if __name__ == '__main__':
    main()
