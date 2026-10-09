# Sound design for the SUFIX promo: no music. Quiet, cinematic — air swells, soft deep impacts, faint ticks, one tap.
# python3 sfx.py → sfx.wav (stereo 44.1 kHz, 35 s)
import numpy as np, wave
SR = 44100; DUR = 35.0; N = int(SR * DUR)
rng = np.random.default_rng(11)
L = np.zeros(N); R = np.zeros(N)

def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR); j = min(N, i + len(sig))
    if j <= i: return
    s = sig[:j - i] * gain
    L[i:j] += s * np.sqrt((1 - pan) / 2) * 1.414; R[i:j] += s * np.sqrt((1 + pan) / 2) * 1.414

def lp(x, fc):
    # one-pole lowpass; fc may be a scalar or a per-sample array (sweeps)
    a = np.exp(-2 * np.pi * np.broadcast_to(np.asarray(fc, dtype=float), x.shape) / SR)
    y = np.empty_like(x); acc = 0.0
    for n in range(len(x)):
        acc = acc * a[n] + x[n] * (1 - a[n]); y[n] = acc
    return y
def hp(x, fc): return x - lp(x, fc)

def swell(dur=2.0, g=1.0, f0=200, f1=2200):
    # a slow breath of filtered air that rises then settles
    n = int(dur * SR); t = np.arange(n) / SR; x = t / dur
    nz = rng.standard_normal(n)
    s = hp(lp(nz, f0 + (f1 - f0) * np.sin(np.pi * x) ** 1.2), 120)
    return s * np.sin(np.pi * x) ** 1.6 * 0.28 * g
def whoosh(dur=0.7, g=1.0):
    n = int(dur * SR); t = np.arange(n) / SR; x = t / dur
    nz = rng.standard_normal(n)
    s = hp(lp(nz, 400 + 3000 * x), 200)
    return s * np.sin(np.pi * x) ** 1.4 * 0.35 * g
def thud(g=1.0, f=46, dec=0.6):
    # deep, soft impact — felt more than heard
    n = int(2.0 * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * (f + 30 * np.exp(-t / 0.09)) * t) * np.exp(-t / dec)
    s += lp(rng.standard_normal(n), 900) * np.exp(-t / 0.18) * 0.25
    return np.tanh(s * 1.3) * 0.7 * g
def tick(g=0.25):
    n = int(0.03 * SR); t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 3500) * np.exp(-t / 0.003) * g
def tap(g=0.5):
    n = int(0.06 * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * 1400 * t) * np.exp(-t / 0.005) + hp(rng.standard_normal(n), 2500) * np.exp(-t / 0.003) * 0.5
    return s * g
def shimmer(g=0.3):
    # a soft glassy tone for the success moment (single strike, no melody)
    n = int(1.6 * SR); t = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * 1760 * h * t) * np.exp(-t / (0.5 / h)) / (h * 1.3) for h in (1, 2.01, 3.03))
    return s * g
def drone(dur, g=1.0):
    # a barely-there low bed, so the silence is not digital silence
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * 52 * t) * 0.5 + np.sin(2 * np.pi * 52.5 * t) * 0.5
    e = np.minimum(1, t / 2.0) * np.minimum(1, (dur - t) / 2.5)
    return lp(s * e, 120) * 0.08 * g

# ---- bed
add(drone(34.5), 0.0)
# ---- 1 brand (0.5 wordmark, 1.3 caption)
add(swell(2.2, 0.8, 150, 1400), 0.3); add(tick(0.2), 1.3)
# ---- 2 hero: drone arrives 3.4–5.6, words 4.3–5.2, caption 5.9, exit 8.4
add(swell(2.6, 1.2, 200, 2600), 3.3); add(thud(0.9, 44, 0.8), 4.2)
for i in range(4): add(tick(0.22), 4.3 + i * 0.24, pan=(i % 2 - 0.5) * 0.4)
add(tick(0.18), 5.9); add(whoosh(0.9, 0.6), 8.3)
# ---- 3 three words 9.1 / 9.9 / 10.7, caption 11.7, exit 13.0
for k, tt in enumerate((9.1, 9.9, 10.7)): add(thud(0.55 + k * 0.1, 48, 0.5), tt); add(tick(0.2), tt + 0.05)
add(tick(0.18), 11.7); add(whoosh(0.8, 0.55), 12.9)
# ---- 4 phone: arrives 13.5–15.4, scroll 15.3–17.3, taps 17.5/18.9/19.55, zoom 19.6–20.9, focus 20.9, exit 22.6
add(swell(2.4, 1.0, 180, 2200), 13.4); add(thud(0.6, 42, 0.7), 14.6)
for i in range(10): add(tick(0.14), 15.5 + i * 0.17, pan=0.25)
for tt in (17.5, 18.9, 19.55): add(tap(0.55), tt); add(whoosh(0.35, 0.3), tt + 0.05, pan=0.3)
add(swell(1.6, 0.8, 300, 3000), 19.5); add(thud(0.7, 40, 0.9), 20.8); add(shimmer(0.32), 20.95)
add(whoosh(0.8, 0.5), 22.5)
# ---- 5 repair: rule 23.2, title 23.4, sub 24.2, steps 24.8–26.2, exit 27.2
add(swell(1.6, 0.6, 200, 1800), 23.1); add(thud(0.5, 46, 0.6), 23.4)
for i, tt in enumerate((24.8, 25.15, 25.5, 25.85, 26.2)): add(tick(0.3), tt, pan=(i - 2) * 0.25)
add(shimmer(0.2), 26.2); add(whoosh(0.7, 0.5), 27.1)
# ---- 6 numbers 27.7 / 28.9 / 30.0
for k, tt in enumerate((27.7, 28.9, 30.0)):
    add(thud(0.6, 44, 0.6), tt); add(swell(1.0, 0.4, 300, 2000), tt)
    for i in range(9): add(tick(0.16), tt + 0.1 + i * 0.09, pan=(i % 2 - 0.5) * 0.4)
# ---- 7 end: logo 31.1, line 31.9, pill 32.5, number 33.0
add(swell(2.4, 1.0, 150, 2400), 30.9); add(thud(1.0, 40, 1.0), 31.3); add(shimmer(0.25), 31.4)
add(tick(0.2), 31.9); add(tap(0.4), 32.5); add(tick(0.2), 33.0)

mix = np.stack([L, R]); mix = np.tanh(mix * 1.1) * 0.95
fade = np.ones(N); fo = int(1.2 * SR); fade[-fo:] = np.linspace(1, 0, fo)
mix *= fade
pcm = (np.clip(mix, -1, 1) * 32767).astype('<i2').T.reshape(-1)
with wave.open('sfx.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('sfx.wav', DUR, 's')
