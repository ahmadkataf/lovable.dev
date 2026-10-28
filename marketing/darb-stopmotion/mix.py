# Mixes voice-over + music + sound effects into mix-<lang>.wav, driven by timeline-<lang>.json (same scene fractions as stopmotion.html).
import json, sys, subprocess, numpy as np
SR = 44100
lang = sys.argv[1]; TL = json.load(open(f'timeline-{lang}.json')); N = int((TL['total'] + 0.5) * SR); mix = np.zeros((N, 2))
info = json.load(open('sfx/info.json'))
def load(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, '<f4').reshape(-1, 2).astype(float)
cache = {}
def S(i):
    if i not in cache: cache[i] = load(f'sfx/{i}.wav')
    return cache[i]
def put(x, t, g=1.0, cut=None, fade=.05, pan=0.0):
    x = x.copy()
    if cut: x = x[:int(cut * SR)]; f = int(fade * SR); x[-f:] *= np.linspace(1, 0, f)[:, None]
    i = int(round(t * SR))
    if i < 0: x = x[-i:]; i = 0
    j = min(N, i + len(x)); y = x[:j - i] * g
    if pan: y = y * np.array([1 - pan, 1 + pan])[None, :]
    mix[i:j] += y
def hit(i, tev, g=1.0, **k): put(S(str(i)), tev - info[str(i)]['onset'], g, **k)
sc = {s['id']: s for s in TL['scenes']}
def K(id, f): s = sc[id]; return s['start'] + (s['end'] - s['start']) * f
def A(id, secs): return sc[id]['start'] + secs
# ---- voice-over
vo = np.zeros((N, 2))
for s in TL['scenes']:
    x = load(s['file']); i = int(s['voStart'] * SR); j = min(N, i + len(x)); vo[i:j] += x[:j - i]
vo = vo / (np.abs(vo).max() + 1e-9) * 0.85
# ---- music (Mixkit "Playful", free licence) ducked under the voice
mu = load('music/10.mp3'); mu = mu / (np.abs(mu).max() + 1e-9)
if len(mu) < N: mu = np.concatenate([mu, mu])[:N]
mu = mu[:N].copy()
env = np.abs(vo).max(1); k = int(0.25 * SR); env = np.convolve(env, np.ones(k) / k, 'same'); duck = 1 - 0.65 * np.clip(env / 0.2, 0, 1)
mu *= duck[:, None]; mu[:int(1.0 * SR)] *= np.linspace(0, 1, int(1.0 * SR))[:, None]
tail = int(2.5 * SR); mu[-tail:] *= np.linspace(1, 0, tail)[:, None]
mix += mu * 0.16
# ---- sound effects, scene by scene (times mirror stopmotion.html)
for s in TL['scenes']: hit(1530, s['start'] + 0.05, 0.5)              # animator's hand: paper slide
# hook
hit(1133, A('hook', .25), .8); hit(2364, A('hook', .15), .6); hit(704, A('hook', .9), .7, cut=1.2, fade=.3)
hit(2894, K('hook', .32), .7); hit(2359, K('hook', .55), .6); hit(3005, K('hook', .62), .8); hit(1492, sc['hook']['end'] - .6, .6)
# problem
hit(2380, A('problem', .05), .6); hit(2356, A('problem', .3), .6); hit(2357, K('problem', .08), .6)
hit(1993, K('problem', .1), .7); hit(2357, K('problem', .13), .5)
hit(1490, K('problem', .2), .7); hit(744, K('problem', .3), .45, cut=1.6, fade=.4)
hit(2003, K('problem', .36), .8); hit(2003, K('problem', .4), .6); hit(2364, K('problem', .44), .9)
hit(2356, K('problem', .5), .5); hit(2731, K('problem', .6), .35, cut=1.6, fade=.5); hit(2356, K('problem', .64), .5)
hit(2357, K('problem', .72), .5); hit(2364, K('problem', .76), .5); hit(473, K('problem', .84), .7, cut=2.0, fade=.4); hit(2365, K('problem', .93), .6)
# discovery
hit(2357, A('discovery', .05), .5); hit(2357, A('discovery', .1), .5); hit(2380, A('discovery', .15), .5)
hit(1999, K('discovery', .14), .7); hit(2357, K('discovery', .17), .4)
for i in range(4): hit(2384, K('discovery', .2) + i * .35, .9)
hit(2894, K('discovery', .28), .7); hit(1993, K('discovery', .32), .6); hit(2870, K('discovery', .33), .7)
v0 = K('discovery', .55); d = sc['discovery']['end'] - sc['discovery']['start']
hit(2380, v0 + .05, .5); hit(2357, v0 + .15, .5); hit(2731, v0 + .25, .35, cut=1.4, fade=.4); hit(2364, v0 + .35, .6)
for i in range(3): hit(2384, v0 + d * .1 + i * .3, .9)
hit(744, v0 + d * .18, .55, cut=1.8, fade=.4); hit(2870, v0 + d * .2, .6); hit(938, v0 + d * .3, .8); hit(2359, v0 + d * .3, .5)
# how
hit(2627, A('how', .05), .7)
for f, i in [(.1, 0), (.4, 1), (.66, 2)]:
    t = K('how', f); hit(1530, t, .7); hit(2357, t + .2, .5); hit(2356, t + .6, .4)
    if i == 0: hit(1395, t + .5, .5, cut=1.3, fade=.3); hit(2354, t + .55, .7)
    if i == 1: hit(2357, t + .5, .5); hit(2867, t + 1.0, .8)
    if i == 2: hit(1993, t + .2, .6); hit(2364, t + .9, .9); hit(2364, t + 1.3, .9)
for i in range(3): t = K('how', .84) + i * .5; hit(2356, t, .5); hit(2384, t + .25, .9)
# ledger
for i in range(5):
    t = K('ledger', .04 + i * .07); hit(1104, t, .7); hit(2364, t + .45, .8)
    if i > 0: hit(2854, t + .2, .5)
hit(2357, K('ledger', .1), .5); hit(2357, K('ledger', .3), .5); hit(2356, K('ledger', .42), .5); hit(2365, K('ledger', .5), .7)
hit(2853, K('ledger', .6), .9); hit(2356, K('ledger', .63), .5); hit(2380, K('ledger', .74), .6); hit(2364, K('ledger', .8), 1.0); hit(2870, K('ledger', .9), .7)
# wins
for i in range(3): hit(1530, A('wins', i * .1 + .02), .5)
hit(2357, K('wins', .05), .5); hit(1993, K('wins', .07), .7); hit(2356, K('wins', .1), .4); hit(2364, K('wins', .12), .6)
hit(2357, K('wins', .3), .5); hit(2364, K('wins', .33), .5); hit(2356, K('wins', .35), .4)
hit(2357, K('wins', .5), .5); hit(2356, K('wins', .53), .4)
hit(2732, K('wins', .62), .3, cut=3.0, fade=.8); hit(2356, K('wins', .62), .5)
hit(938, K('wins', .8), .8); hit(2359, K('wins', .8), .5); hit(744, K('wins', .9), .4, cut=1.5, fade=.4); hit(2365, K('wins', .9), .5)
# cta
hit(2364, A('cta', .1), .6); hit(2356, K('cta', .08), .5); hit(2903, K('cta', .3), .9); hit(2359, K('cta', .3), .6)
hit(2364, K('cta', .55), .8); hit(2870, K('cta', .55), .7); hit(3005, K('cta', .78), .7); hit(3060, K('cta', .9), .7)
# ---- master
mix += vo
pk = np.abs(mix).max(); mix = mix / pk * 1.15; mix = np.tanh(mix) * 0.92
f = int(.3 * SR); mix[-f:] *= np.linspace(1, 0, f)[:, None]
import wave
with wave.open(f'mix-{lang}.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype('<i2').tobytes())
print('ok', lang, 'peak', round(float(pk), 2), 'len', round(N / SR, 1))
