# Soundtrack for the vertical Short: narration + effects only (no music). Times mirror short.html scene fractions.
import json, sys, subprocess, numpy as np, wave
SR = 44100
lang = sys.argv[1]; TL = json.load(open(f'timeline3-{lang}.json')); N = int((TL['total'] + 0.3) * SR); mix = np.zeros((N, 2))
info = json.load(open('sfx/info.json'))
def load(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, '<f4').reshape(-1, 2).astype(float)
cache = {}
def S(i):
    if i not in cache: cache[i] = load(f'sfx/{i}.wav')
    return cache[i]
def put(x, t, g=1.0, cut=None, fade=.05):
    x = x.copy()
    if cut: x = x[:int(cut * SR)]; f = int(fade * SR); x[-f:] *= np.linspace(1, 0, f)[:, None]
    i = int(round(t * SR))
    if i < 0: x = x[-i:]; i = 0
    j = min(N, i + len(x)); mix[i:j] += x[:j - i] * g
def hit(i, tev, g=1.0, **k): put(S(str(i)), tev - info[str(i)]['onset'], g, **k)
sc = {s['id']: s for s in TL['scenes']}
def K(id, f): s = sc[id]; return s['start'] + (s['end'] - s['start']) * f
vo = np.zeros((N, 2))
for s in TL['scenes']:
    x = load(s['file']); i = int(s['voStart'] * SR); j = min(N, i + len(x)); vo[i:j] += x[:j - i]
vo = vo / (np.abs(vo).max() + 1e-9) * 0.9
for s in TL['scenes']: hit(1530, s['start'] + 0.05, 0.5)
hit(1133, K('hook', .2), .8); hit(2364, sc['hook']['start'] + .1, .6); hit(704, sc['hook']['start'] + .5, .6, cut=1.0, fade=.3)
hit(1999, K('hook', .2), .7); hit(2357, K('hook', .24), .5); hit(2364, K('hook', .42), .7); hit(2357, K('hook', .46), .5)
hit(2894, K('hook', .66), .8); hit(2359, K('hook', .7), .6); hit(1492, sc['hook']['end'] - .5, .6)
hit(2380, sc['number']['start'] + .05, .6); hit(2356, sc['number']['start'] + .25, .5); hit(2357, K('number', .06), .5); hit(1993, K('number', .08), .7); hit(2357, K('number', .12), .5)
hit(1490, K('number', .24), .7); hit(744, K('number', .3), .4, cut=1.4, fade=.4); hit(2003, K('number', .42), .8); hit(2003, K('number', .46), .6); hit(2364, K('number', .5), .9)
hit(2731, K('number', .6), .3, cut=1.4, fade=.5); hit(2356, K('number', .64), .5); hit(473, K('number', .78), .7, cut=1.8, fade=.4); hit(2365, K('number', .9), .6)
hit(2380, sc['reveal']['start'] + .05, .5); hit(2357, sc['reveal']['start'] + .15, .5); hit(2731, sc['reveal']['start'] + .2, .3, cut=1.2, fade=.4)
for i in range(3): hit(2384, K('reveal', .18) + i * .28, .9)
hit(744, K('reveal', .3), .5, cut=1.6, fade=.4); hit(2870, K('reveal', .34), .6); hit(938, K('reveal', .52), .8); hit(2359, K('reveal', .52), .5)
for f in (.0, .27, .5, .72): hit(2627, K('how', f), .6); hit(2357, K('how', f) + .15, .5)
hit(1395, K('how', .0) + .4, .5, cut=1.2, fade=.3); hit(2354, K('how', .0) + .5, .7)
hit(2357, K('how', .27) + .4, .5); hit(2867, K('how', .27) + .9, .8)
hit(1993, K('how', .5) + .2, .6); hit(2364, K('how', .5) + .8, .9); hit(2364, K('how', .5) + 1.2, .9)
for i in range(3): hit(1104, K('how', .72) + i * .3, .7); hit(2364, K('how', .72) + i * .3 + .4, .7)
hit(2356, K('how', .72) + .9, .5); hit(2365, K('how', .72) + 1.8, .7)
hit(2357, K('punch', .02), .5); hit(1993, K('punch', .04), .7); hit(2364, K('punch', .08), .6); hit(2356, K('punch', .1), .4)
hit(2357, K('punch', .22), .5); hit(2364, K('punch', .26), .5); hit(2356, K('punch', .3), .4); hit(2357, K('punch', .4), .5); hit(2356, K('punch', .44), .4)
hit(2903, K('punch', .58), .9); hit(2359, K('punch', .58), .6); hit(938, K('punch', .6), .6); hit(3005, K('punch', .8), .7); hit(3060, K('punch', .9), .6)
mix += vo
pk = np.abs(mix).max(); mix = mix / pk * 1.15; mix = np.tanh(mix) * 0.92
f = int(.3 * SR); mix[-f:] *= np.linspace(1, 0, f)[:, None]
with wave.open(f'mix3-{lang}.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype('<i2').tobytes())
print('ok', lang, 'peak', round(float(pk), 2), 'len', round(N / SR, 1))
