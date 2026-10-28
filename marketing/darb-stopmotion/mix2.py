# Soundtrack for the cinematic video: narration + ambient bed (Mixkit "Echoes") + drums from the experiment on
# (Mixkit "Epical Drums 01") + cinematic effects. Times mirror the scene fractions in cinematic.html.
import json, sys, os, subprocess, numpy as np, wave
NO_MUSIC = os.environ.get('NO_MUSIC') == '1'   # NO_MUSIC=1: narration + effects only
SR = 44100
lang = sys.argv[1]; TL = json.load(open(f'timeline2-{lang}.json')); N = int((TL['total'] + 0.5) * SR); mix = np.zeros((N, 2))
info = json.load(open('sfx/info.json'))
def load(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, '<f4').reshape(-1, 2).astype(float)
cache = {}
def S(i):
    if i not in cache: cache[i] = load(f'sfx/{i}.wav')
    return cache[i]
def put(x, t, g=1.0, cut=None, fade=.05, fin=0.0):
    x = x.copy()
    if cut: x = x[:int(cut * SR)]; f = int(fade * SR); x[-f:] *= np.linspace(1, 0, f)[:, None]
    if fin: f = int(fin * SR); x[:f] *= np.linspace(0, 1, f)[:, None]
    i = int(round(t * SR))
    if i < 0: x = x[-i:]; i = 0
    j = min(N, i + len(x)); mix[i:j] += x[:j - i] * g
def hit(i, tev, g=1.0, **k): put(S(str(i)), tev - info[str(i)]['onset'], g, **k)
sc = {s['id']: s for s in TL['scenes']}
def K(id, f): s = sc[id]; return s['start'] + (s['end'] - s['start']) * f
# ---- narration
vo = np.zeros((N, 2))
for s in TL['scenes']:
    x = load(s['file']); i = int(s['voStart'] * SR); j = min(N, i + len(x)); vo[i:j] += x[:j - i]
vo = vo / (np.abs(vo).max() + 1e-9) * 0.85
env = np.abs(vo).max(1); k = int(0.3 * SR); c = np.cumsum(np.concatenate([[0.0], env])); env = (c[k:] - c[:-k]) / k; env = np.concatenate([env, np.full(len(c) - 1 - len(env), env[-1] if len(env) else 0.0)]); duck = 1 - 0.5 * np.clip(env / 0.2, 0, 1)
# ---- ambient bed for the whole film
bed = load('music/188.mp3'); bed = bed / (np.abs(bed).max() + 1e-9)
if len(bed) < N: bed = np.concatenate([bed, bed[::-1]])
bed = bed[:N].copy(); bed[:int(2 * SR)] *= np.linspace(0, 1, int(2 * SR))[:, None]; tail = int(3 * SR); bed[-tail:] *= np.linspace(1, 0, tail)[:, None]
if not NO_MUSIC: mix += bed * duck[:, None] * 0.22
# ---- drums from the experiment to the end of "why", fading out before the ending
dr = load('music/676.mp3'); dr = dr / (np.abs(dr).max() + 1e-9)
t0 = K('experiment', .0); t1 = sc['why']['end']
seg = dr[:int((t1 - t0) * SR)].copy(); f = int(1.5 * SR); seg[:f] *= np.linspace(0, 1, f)[:, None]; f2 = int(3 * SR); seg[-f2:] *= np.linspace(1, 0, f2)[:, None]
i = int(t0 * SR); j = min(N, i + len(seg))
if not NO_MUSIC: mix[i:j] += seg[:j - i] * duck[i:j, None] * 0.12
# ---- effects
hit(494, 0.3, .3, cut=12, fade=3)                                    # slow heartbeat under the cold open
hit(1372, K('cold', .02), .35, cut=3.2, fade=.5)                     # typewriter for the title
hit(1492, K('cold', .16), .5)
for f in (.2, .45, .74): hit(2364, K('cold', f), .7); hit(2350, K('cold', f) + .1, .4)
for f in (.34, .59): hit(2384, K('cold', f), .9)                     # strike-through slices
hit(632, K('cold', .74) - 1.5, .5, cut=5, fade=1.5)                  # drama riser into the third node
hit(2918, K('number', .0), .6, cut=4, fade=1)
hit(2627, K('number', .1), .6); hit(1993, K('number', .12), .5)
hit(2365, K('number', .22), .8); hit(2595, K('number', .4), .7)
for f in (.58, .7, .84): hit(2568, K('number', f), .7); hit(2357, K('number', f) + .1, .4)
for f in (.05, .32, .6): hit(1490, K('pattern', f), .6)
for f in (.2, .47): hit(2903, K('pattern', f), .6, cut=1.6, fade=.4); hit(2870, K('pattern', f) + .2, .5)
hit(679, K('pattern', .72), .5, cut=3, fade=.8)                      # suspense hit on the "?"
hit(790, K('pattern', .86) - 2.2, .6)                                # trailer riser into the question
hit(2918, K('experiment', .0), .5, cut=4, fade=1)
for f in (.12, .3, .48): hit(1530, K('experiment', f), .5); hit(2357, K('experiment', f) + .3, .4)
hit(2854, K('experiment', .3) + .8, .5); hit(2364, K('experiment', .48) + .9, .7); hit(2364, K('experiment', .48) + 1.3, .7)
for i in range(5): hit(2568, K('experiment', .62 + i * .035), .6); hit(2853, K('experiment', .62 + i * .035) + .3, .35)
hit(2918, K('experiment', .88) - 1.0, .7, cut=4, fade=1)
for f in (.08, .2, .34): hit(2350, K('why', f), .45)
hit(577, K('why', .4), .35, cut=5, fade=1.5)                         # tension drum roll under the gauge
hit(2903, K('why', .66), .6, cut=1.8, fade=.5); hit(2731, K('why', .78), .3, cut=2, fade=.6)
hit(2350, K('end', .04), .4)
hit(1372, K('end', .3), .35, cut=3.5, fade=.5)                       # typewriter for the question
hit(490, K('end', .58), .6); hit(490, K('end', .58) + .9, .6); hit(490, K('end', .58) + 1.8, .5)
hit(2918, K('end', .72) - 1.0, .7, cut=5, fade=1.5)
hit(2350, K('end', .95), .3)
# ---- master
mix += vo
pk = np.abs(mix).max(); mix = mix / pk * 1.1; mix = np.tanh(mix) * 0.92
f = int(1.0 * SR); mix[-f:] *= np.linspace(1, 0, f)[:, None]
with wave.open(f'mix2-{lang}.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype('<i2').tobytes())
print('ok', lang, 'peak', round(float(pk), 2), 'len', round(N / SR, 1))
