#!/usr/bin/env python3
"""Soundtrack for the hook short: narration + sound effects only (no music).
Cues come from hits4-<lang>.json (exported from hook.html by hits.mjs), so motion, captions and sound share one list.
   node hits.mjs ar && python3 mix4.py ar   -> mix4-ar.wav
"""
import json, sys, subprocess, numpy as np
lang = sys.argv[1]; SR = 44100; VO = 'vo4t'
TL = json.load(open(f'timeline4-{lang}.json')); HITS = json.load(open(f'hits4-{lang}.json'))['hits']
info = json.load(open('sfx/info.json'))

def load(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, '<f4').reshape(-1, 2).astype(np.float32)

N = int((TL['total'] + 1.0) * SR); voice = np.zeros((N, 2), np.float32); fx = np.zeros((N, 2), np.float32)

def put(buf, x, t, g=1.0, cut=None, fade=0.0):
    x = x.copy()
    if cut: x = x[:int(cut * SR)]
    if fade and len(x): n = min(len(x), int(fade * SR)); x[-n:] *= np.linspace(1, 0, n, dtype=np.float32)[:, None]
    i = int(round(t * SR))
    if i < 0: x = x[-i:]; i = 0
    n = min(len(x), N - i)
    if n > 0: buf[i:i + n] += x[:n] * g

cache = {}
def S(i):
    if i not in cache: cache[i] = load(f'sfx/{i}.wav')
    return cache[i]
def shift(x, semi):                      # pitch shift by resampling (short hits only)
    f = 2 ** (semi / 12); n = int(len(x) / f); idx = np.arange(n) * f
    return np.stack([np.interp(idx, np.arange(len(x)), x[:, c]) for c in range(2)], 1).astype(np.float32)
def hit(i, t, g=1.0, align='onset', semi=0, cut=None, fade=0.0):
    x = S(str(i))
    if semi: x = shift(x, semi)
    off = info[str(i)][align] / (2 ** (semi / 12))
    put(fx, x, t - off, g, cut=cut, fade=fade)

# kind -> list of (id, gain, align, semi, cut, fade)
KIND = {
  'hit':      [(2655, .8, 'peak', 0, 1.2, .3)],
  'snap':     [(2364, .55, 'onset', 0, None, 0)],
  'tick':     [(2568, .5, 'onset', 0, None, 0)],
  'tear':     [(2384, .9, 'onset', 0, None, 0), (2380, .5, 'onset', 0, .6, .1)],
  'whoosh':   [(1490, .5, 'onset', 0, .5, .1)],
  'slice':    [(2384, .85, 'onset', 0, None, 0)],
  'pop':      [(2357, .6, 'onset', 0, None, 0)],
  'rise':     [(1492, .5, 'onset', 0, None, 0)],
  'notif':    [(2354, .6, 'onset', 0, None, 0)],
  'ringtick': [(2356, .5, 'onset', 0, None, 0)],
  'slide':    [(1530, .6, 'onset', 0, None, 0)],
  'soft':     [(2365, .35, 'onset', 0, None, 0)],
  'click':    [(1109, .5, 'onset', 0, None, 0)],
  'swipe':    [(2627, .5, 'onset', 0, .6, .15)],
  'tickroll': [(1395, .4, 'onset', 0, .5, .12)],
  'accept':   [(2364, .7, 'onset', 0, None, 0), (2854, .4, 'onset', 0, None, 0)],
  'chime':    [(2867, .5, 'onset', 0, None, 0)],
  'chime2':   [(951, .5, 'onset', 0, None, 0)],
  'stamp':    [(2182, .95, 'onset', 0, None, 0)],
  'stamp2':   [(2182, 1.0, 'onset', 1, None, 0), (772, .45, 'peak', 0, 1.0, .3)],
  'printer':  [(2369, .6, 'onset', 0, .6, .1)],
  'paper':    [(2385, .4, 'onset', 0, .5, .1)],
  'link':     [(2854, .45, 'onset', 0, None, 0)],
  'bell1':    [(2870, .5, 'onset', 0, None, 0)],
  'bell2':    [(2870, .5, 'onset', 2, None, 0)],
  'bell3':    [(2870, .5, 'onset', 4, None, 0)],
  'swish':    [(1490, .5, 'onset', 0, .5, .1)],
  'flip':     [(1104, .6, 'onset', 0, None, 0)],
  'whooshout':[(1492, .4, 'onset', 0, None, 0)],
}
for h in HITS:
    k = h['sfx']; g0 = h.get('g', 1.0)
    if k == 'riser':                      # the riser's peak lands on the next hit (cued 0.5 s before it)
        hit(790, h['t'] + 0.5, .45 * g0, align='peak'); continue
    for (i, g, al, semi, cut, fade) in KIND[k]: hit(i, h['t'], g * g0, align=al, semi=semi, cut=cut, fade=fade)
    if k == 'hit' and h.get('sh'): hit(772, h['t'], .45 * g0, align='peak', cut=1.0, fade=.3)   # shake hits get a deeper layer

# narration
for sc in TL['scenes']: put(voice, load(f"{VO}/{lang}-{sc['id']}.mp3"), sc['voStart'])
voice *= 0.85 / (np.abs(voice).max() or 1)
# duck effects 6 dB under speech (60 ms moving average of the narration)
mono = np.abs(voice).mean(1); w = int(0.06 * SR); cs = np.cumsum(np.concatenate([[0], mono])); env = (cs[w:] - cs[:-w]) / w
env = np.concatenate([env, np.zeros(N - len(env))]); env = np.clip(env / (np.percentile(env, 97) or 1), 0, 1)
duck = (1 - 0.5 * env).astype(np.float32)
fx *= 0.9 / max(np.abs(fx).max(), 1e-6) * 0.9
m = voice + fx * duck[:, None]
pk = np.abs(m).max()
if pk > 0.97: m *= 0.97 / pk
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', f'mix4-{lang}.wav'], input=m.astype(np.float32).tobytes(), check=True)
print(lang, 'mix4 written', round(N / SR, 2), 's; peak', round(float(pk), 3), '; cues', len(HITS))
