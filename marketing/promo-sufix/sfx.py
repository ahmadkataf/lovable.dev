# Sound effects for the SUFIX promo (no music): whooshes, impacts, pops, clicks, ticks, risers — all synthesized.
# python3 sfx.py → sfx.wav (stereo 44.1 kHz, 24.5 s)
import numpy as np, wave
SR = 44100; DUR = 24.5; N = int(SR * DUR)
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
def tone(f, dur, decay, harm=(1,)):
    n = int(dur * SR); t = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * f * h * t) / (1 + k) for k, h in enumerate(harm))
    return s * np.exp(-t / decay)

def whoosh(dur=0.5, g=1.0, up=True):
    n = int(dur * SR); t = np.arange(n) / SR; x = t / dur
    nz = rng.standard_normal(n)
    a = lp(nz, 600 + 3500 * (x if up else 1 - x)); b = hp(a, 200)
    return b * np.sin(np.pi * x) ** 1.3 * 0.5 * g
def impact(g=1.0):
    n = int(1.6 * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * (42 + 60 * np.exp(-t / 0.07)) * t) * np.exp(-t / 0.5)
    s += lp(rng.standard_normal(n), 1600) * np.exp(-t / 0.25) * 0.45
    return np.tanh(s * 1.7) * 0.85 * g
def pop(f=900, dur=0.14, g=0.5):
    n = int(dur * SR); t = np.arange(n) / SR
    fr = f * (1 + 1.1 * np.exp(-t / 0.012)); s = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t / 0.035)
    return s * g
def click(g=0.6):
    n = int(0.05 * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * 1900 * t) * np.exp(-t / 0.004) + hp(rng.standard_normal(n), 3000) * np.exp(-t / 0.002) * 0.6
    return s * g
def tick(g=0.35):
    n = int(0.03 * SR); t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 4000) * np.exp(-t / 0.003) * g
def riser(dur=1.0, g=0.8):
    n = int(dur * SR); t = np.arange(n) / SR; x = t / dur
    nz = hp(lp(rng.standard_normal(n), 300 + 6000 * x ** 2), 150)
    return nz * (x ** 2) * 0.6 * g
def swipe(dur=0.3, g=0.5):
    n = int(dur * SR); t = np.arange(n) / SR; x = t / dur
    nz = rng.standard_normal(n); s = (hp(lp(nz, 2500), 400) * (1 - x) + hp(nz, 1500) * x * 0.5) * np.sin(np.pi * x) ** 1.5
    return s * g
def sparkle(t0, k=5):
    for i in range(k): add(pop(2200 + rng.uniform(-400, 900), 0.08, 0.16), t0 + i * 0.045 + rng.uniform(0, .02), pan=rng.uniform(-.6, .6))
def ding(g=0.4):  # soft success bell (non-musical, single strike)
    return tone(1760, 0.8, 0.18, (1, 2.76, 5.4)) * g
def shutter():
    return np.concatenate([click(0.9), np.zeros(int(0.04 * SR)), click(0.6)])

# ---- A: hook words (0.05 / 0.95 / 1.85) + ink drop 2.45
for i, tt in enumerate((0.05, 0.95, 1.85)):
    add(impact(0.55 + i * 0.1), tt); add(swipe(0.35, 0.8), tt + 0.02, pan=(-0.3, 0.3, 0)[i])
    add(whoosh(0.22, 0.6, up=False), tt + 0.78 + (0 if i < 2 else -0.08))
add(riser(0.55, 0.9), 2.05); add(impact(1.0), 2.6); sparkle(2.65)
# ---- B: logo flip 2.65, shine 3.3, tag 3.3, pills 3.9/4.15/4.45, exit 5.75
add(whoosh(0.7, 1.0), 2.65); add(swipe(0.4, 0.7), 3.3, pan=-0.3); add(pop(1200, 0.12, 0.4), 3.45)
for k, tt in enumerate((3.9, 4.15, 4.45)): add(pop(820 + k * 140, 0.13, 0.55), tt, pan=(-0.4, 0.4, 0)[k]); add(click(0.35), tt + 0.02)
add(whoosh(0.5, 0.8), 5.75)
# ---- C: phone in 6.0, scroll 6.9–8.4, taps, screens, zoom 12.9, check 13.65, exit 14.7
add(whoosh(0.9, 1.1, up=True), 6.0); add(impact(0.6), 6.85)
for k in range(8): add(tick(0.3), 7.0 + k * 0.17, pan=0.2)             # scrolling
add(pop(1000, 0.12, 0.45), 7.4)                                          # callout
for tt in (8.45, 9.85, 11.05, 12.15, 12.95): add(click(0.8), tt); add(swipe(0.3, 0.5), tt + 0.1, pan=0.3)
for tt in (10.1, 11.9, 13.9): add(pop(950, 0.12, 0.45), tt)
for tt in (6.3, 8.7, 11.2): add(swipe(0.4, 0.6), tt, pan=-0.4)         # titles
add(riser(0.7, 0.7), 12.9); add(impact(0.7), 13.6); add(ding(0.45), 13.68); sparkle(13.7, 7)
add(whoosh(0.5, 0.8, up=False), 14.7)
# ---- D: repair 15.1 title, card 15.5, steps 15.9–17.7, exit 18.2
add(swipe(0.4, 0.6), 15.1); add(pop(900, 0.12, 0.45), 15.5)
for k, tt in enumerate((15.9, 16.35, 16.8, 17.25, 17.7)): add(click(0.6), tt); add(pop(700 + k * 120, 0.12, 0.4), tt + 0.22)
add(ding(0.35), 17.95); sparkle(18.0, 4)
add(whoosh(0.45, 0.7), 18.2)
# ---- E: stats 18.6/18.85/19.1 with counters, bars 19.3/19.55, exit 21.2
for k, tt in enumerate((18.6, 18.85, 19.1)):
    add(impact(0.45), tt); add(pop(850, 0.12, 0.4), tt + 0.05)
    for i in range(14): add(tick(0.32), tt + 0.1 + i * 0.085, pan=(i % 2 - 0.5) * 0.5)
add(swipe(0.4, 0.5), 19.3, pan=-0.3); add(swipe(0.4, 0.5), 19.55, pan=0.3)
add(riser(0.5, 0.7), 20.7); add(whoosh(0.4, 0.7), 21.2)
# ---- F: CTA logo 21.55, text 22.0, button 22.5, number 23.0, pulses
add(impact(0.9), 21.55); sparkle(21.6, 6)
add(swipe(0.4, 0.6), 22.0); add(impact(0.6), 22.5); add(click(0.9), 22.52); add(pop(1100, 0.12, 0.5), 22.6)
add(swipe(0.35, 0.5), 23.0, pan=0.3)
for tt in (22.8, 23.4, 24.0): add(pop(600, 0.2, 0.25), tt)

# master: gentle limiter, fade out
mix = np.stack([L, R]); mix = np.tanh(mix * 0.9) * 0.95
fade = np.ones(N); fo = int(0.6 * SR); fade[-fo:] = np.linspace(1, 0, fo)
mix *= fade
pcm = (np.clip(mix, -1, 1) * 32767).astype('<i2').T.reshape(-1)
with wave.open('sfx.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('sfx.wav', DUR, 's')
