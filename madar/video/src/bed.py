"""Soft ambient music bed for the brief video (numpy only): warm pad chords + a slow pluck motif.
   python3 bed.py bed.wav [seconds]"""
import sys, wave, numpy as np
out = sys.argv[1]; DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 198.0
SR = 44100; N = int(SR * DUR); t = np.arange(N) / SR
rng = np.random.default_rng(3)
def note(m): return 440 * 2 ** ((m - 69) / 12)
def lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); s = 0.0
    for i in range(0, len(x), 4096):
        seg = x[i:i+4096]; o = np.empty_like(seg)
        for j in range(len(seg)): s = s * a + seg[j] * (1 - a); o[j] = s
        y[i:i+4096] = o
    return y
# chord progression (C major, calm): Cmaj7 – Am7 – Fmaj7 – G6, 8 s each, looped
chords = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 64]]
L = np.zeros(N); R = np.zeros(N)
BAR = 8.0
for k in range(int(np.ceil(DUR / BAR))):
    i0 = int(k * BAR * SR); i1 = min(N, int((k + 1) * BAR * SR) + int(1.5 * SR))
    if i0 >= N: break
    n = i1 - i0; tt = np.arange(n) / SR
    env = np.minimum(1, tt / 1.6) * np.minimum(1, np.maximum(0, (n / SR - tt)) / 1.5)
    pad = np.zeros(n)
    for m in chords[k % 4]:
        f = note(m - 12)
        for h, gain in ((1, 1), (2, .35), (3, .12)):
            pad += gain * np.sin(2 * np.pi * f * h * tt + rng.random() * 6.28) * (1 + .15 * np.sin(2 * np.pi * .13 * tt + m))
    pad = pad / 12 * env
    L[i0:i1] += pad * (1 + .1 * np.sin(2 * np.pi * .05 * tt)); R[i0:i1] += pad * (1 - .1 * np.sin(2 * np.pi * .05 * tt))
# gentle pluck motif every 2 s, pentatonic over the chord
motif = [72, 76, 79, 83, 79, 76]
for k, st in enumerate(np.arange(0, DUR, 2.0)):
    i0 = int(st * SR); n = int(1.6 * SR); i1 = min(N, i0 + n)
    if i0 >= N: break
    tt = np.arange(i1 - i0) / SR; m = motif[k % 6] + (0 if (int(st // BAR) % 4) in (0, 2) else -3)
    f = note(m)
    s = (np.sin(2 * np.pi * f * tt) + .4 * np.sin(2 * np.pi * 2 * f * tt)) * np.exp(-tt / .45) * .09
    pan = .4 * np.sin(k * .7)
    L[i0:i1] += s * (1 - pan); R[i0:i1] += s * (1 + pan)
# soft air
air = rng.standard_normal(N) * .004
L += air; R += air
fade = np.minimum(1, t / 2.0) * np.minimum(1, np.maximum(0, DUR - t) / 3.0)
L *= fade; R *= fade
mx = max(np.abs(L).max(), np.abs(R).max()); L /= mx / .7; R /= mx / .7
st = np.stack([L, R], 1); pcm = (st * 32767).astype('<i2')
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('wrote', out, f'{DUR:.0f}s')
