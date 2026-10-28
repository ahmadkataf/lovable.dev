#!/usr/bin/env python3
"""Approximate word timestamps for each narration clip (for word-by-word captions).

  python3 wordtimes.py --script script4.json --vo vo4 --timeline timeline4 --out words4

For each scene clip the words are placed by their share of characters across the voiced span, then each boundary is
snapped to the nearest energy dip within +-140 ms. Output: words4-<lang>.json = [{scene, word, start, end}] in VIDEO time
(scene voStart added), ready to be inlined into the page.
"""
import argparse, json, re, subprocess, numpy as np

def pcm(p, sr=16000):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '1', '-ar', str(sr), '-f', 's16le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, '<i2').astype(float) / 32768

def word_weight(w):
    core = re.sub(r"[^\w؀-ۿ]", "", w)
    return max(1.0, len(core)) + (0.9 if re.search(r"[.!?؟…,،]$", w) else 0.0)   # punctuation = a small pause

def words_for(text, x, sr=16000):
    hop = int(sr * 0.01); env = np.array([np.abs(x[i:i + hop]).max() for i in range(0, max(hop, len(x) - hop), hop)])
    thr = max(0.01, float(np.percentile(env, 25)) * 1.4)
    loud = np.where(env >= thr)[0]
    t0 = (loud[0] * hop) / sr if len(loud) else 0.0; t1 = (loud[-1] * hop) / sr if len(loud) else len(x) / sr
    ws = [w for w in re.split(r"\s+", text.strip()) if w]
    wts = np.array([word_weight(w) for w in ws]); cum = np.concatenate([[0], np.cumsum(wts)]) / wts.sum()
    bounds = [t0 + (t1 - t0) * c for c in cum]
    # snap inner boundaries to the quietest 10 ms within +-140 ms, keeping order
    snapped = [bounds[0]]
    for b in bounds[1:-1]:
        a = int(max(snapped[-1] + 0.08, b - 0.14) / 0.01); z = int(min(t1, b + 0.14) / 0.01)
        if z - a >= 3:
            k = a + int(np.argmin(env[a:z])); snapped.append(max(k * 0.01, snapped[-1] + 0.05))
        else:
            snapped.append(max(b, snapped[-1] + 0.05))
    snapped.append(bounds[-1])
    return [(ws[i], snapped[i], snapped[i + 1]) for i in range(len(ws))]

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--script', required=True); ap.add_argument('--vo', required=True)
    ap.add_argument('--timeline', required=True); ap.add_argument('--out', required=True); ap.add_argument('--langs', nargs='*', default=['ar', 'en'])
    a = ap.parse_args(); s = json.load(open(a.script))
    for lang in a.langs:
        tl = json.load(open(f'{a.timeline}-{lang}.json')); out = []
        for sc, tsc in zip(s['scenes'], tl['scenes']):
            x = pcm(f"{a.vo}/{lang}-{sc['id']}.mp3")
            for w, b0, b1 in words_for(sc[lang], x):
                out.append({'scene': sc['id'], 'word': w, 'start': round(tsc['voStart'] + b0, 3), 'end': round(tsc['voStart'] + b1, 3)})
        json.dump(out, open(f'{a.out}-{lang}.json', 'w'), ensure_ascii=False)
        print(lang, len(out), 'words;', 'first:', out[0]['word'], out[0]['start'], 'last:', out[-1]['word'], out[-1]['end'])

if __name__ == '__main__':
    main()
