#!/usr/bin/env python3
"""Background sound for the lesson (no voice): a quiet ambient chord bed that ducks under the narration,
a soft whoosh at every scene change, and a swell at the start and end. Everything is synthesised here,
so there are no licensing questions. Reads timeline.json, writes fx.wav (44.1 kHz stereo).

  python3 sound.py [--bed-db -30] [--no-bed]
"""
import argparse, json, os, wave
import numpy as np
from scipy.signal import lfilter

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 44100
rng = np.random.default_rng(12)


def note(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def onepole_lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    return lfilter([1 - a], [1, -a], x).astype(np.float32)


def _comb(x, d, g):
    y = x.copy()
    for i in range(d, len(x), d):
        j = min(len(x), i + d)
        y[i:j] += g * y[i - d:j - d]
    return y


def _allpass(x, d, g):
    y = -g * x
    y[d:] += x[:-d]
    for i in range(d, len(x), d):
        j = min(len(x), i + d)
        y[i:j] += g * y[i - d:j - d]
    return y


def reverb(x, mix=.35):
    """Small Schroeder reverb (4 combs + 2 allpasses), block-vectorised."""
    out = sum(_comb(x, d, g) for d, g in ((1557, .80), (1617, .79), (1491, .81), (1422, .78))) / 4
    for d, g in ((225, .5), (556, .5)):
        out = _allpass(out, d, g)
    return ((1 - mix) * x + mix * out).astype(np.float32)


# calm, slightly hopeful loop: Cmaj7 – Am7 – Fmaj7 – G6sus (8 s each)
CHORDS = [[48, 55, 64, 71], [45, 52, 60, 67], [41, 53, 57, 64], [43, 50, 59, 62]]
CHORD_LEN = 8.0


def pad_voice(m, n, det, phase):
    t = np.arange(n, dtype=np.float32) / SR
    f = note(m) * (1 + det)
    trem = 1 + .06 * np.sin(2 * np.pi * .23 * t + phase)
    s = np.sin(2 * np.pi * f * t + phase) + .28 * np.sin(4 * np.pi * f * t) + .08 * np.sin(6 * np.pi * f * t)
    return (s * trem).astype(np.float32)


def bed(total):
    n = int(total * SR)
    L = np.zeros(n, np.float32); R = np.zeros(n, np.float32)
    k, t0 = 0, 0.0
    while t0 < total:
        ch = CHORDS[k % 4]
        dur = CHORD_LEN + 3.0                       # overlap for smooth changes
        m = int(dur * SR)
        tt = np.arange(m, dtype=np.float32) / SR
        env = np.minimum(1, tt / 2.5) * np.minimum(1, np.maximum(0, (dur - tt) / 3.0))
        for j, mn in enumerate(ch):
            v = env * .18 / (1 + j * .15)
            i0 = int(t0 * SR); i1 = min(n, i0 + m); seg = slice(0, i1 - i0)
            L[i0:i1] += (pad_voice(mn, m, -.0015, j * .7) * v)[seg]
            R[i0:i1] += (pad_voice(mn, m, +.0015, j * 1.3) * v)[seg]
        # a high, airy note every other chord
        if k % 2 == 0:
            mn = ch[-1] + 12
            i0 = int((t0 + 1.5) * SR); m2 = int(5 * SR); i1 = min(n, i0 + m2)
            if i0 < n:
                t2 = np.arange(m2, dtype=np.float32) / SR
                e2 = np.minimum(1, t2 / 1.5) * np.exp(-t2 / 2.5) * .05
                s2 = (np.sin(2 * np.pi * note(mn) * t2) * e2)[:i1 - i0]
                L[i0:i1] += s2 * .7; R[i0:i1] += s2
        t0 += CHORD_LEN; k += 1
    L = onepole_lp(onepole_lp(L, 1800), 2400); R = onepole_lp(onepole_lp(R, 1800), 2400)
    return reverb(L), reverb(R)


def whoosh(dur=.9):
    n = int(dur * SR); x = np.arange(n) / n
    nz = rng.standard_normal(n).astype(np.float32)
    # sweep the band up then down
    lo = onepole_lp(nz, 900); hi = onepole_lp(nz, 4500) - lo
    s = (lo * (1 - x) + hi * x) * np.sin(np.pi * x) ** 3
    return s.astype(np.float32) * .35


def swell(dur=3.0):
    n = int(dur * SR); t = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * note(m) * t) for m in (60, 67, 72, 76)) / 4
    e = (t / dur) ** 2 * np.minimum(1, (dur - t) / .4)
    return reverb((s * e * .25).astype(np.float32), .5)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--bed-db', type=float, default=-30.0, help='bed level between lines (dBFS RMS)')
    ap.add_argument('--duck-db', type=float, default=-9.0, help='extra attenuation while the narrator speaks')
    ap.add_argument('--no-bed', action='store_true')
    ap.add_argument('--no-music', action='store_true', help='no bed and no swells: only the soft scene whooshes')
    ap.add_argument('--video', default='')
    a = ap.parse_args()
    vdir = os.path.join(HERE, a.video)
    tl = json.load(open(os.path.join(vdir, 'timeline.json'), encoding='utf-8'))
    total = tl['total'] + 2.0
    n = int(total * SR)
    L = np.zeros(n, np.float32); R = np.zeros(n, np.float32)
    if a.no_music:
        a.no_bed = True
    if not a.no_bed:
        bl, br = bed(total)
        rms = float(np.sqrt(np.mean(bl[:SR * 60] ** 2 + br[:SR * 60] ** 2) / 2) + 1e-9)
        g = 10 ** (a.bed_db / 20) / rms
        # ducking envelope from the timeline (ramps of 0.35 s)
        speak = np.zeros(n, np.float32)
        for sc in tl['scenes']:
            for ln in sc['lines']:
                speak[int(ln['start'] * SR):int(ln['end'] * SR)] = 1
        k = int(.35 * SR)
        speak = np.convolve(speak, np.ones(k, np.float32) / k, mode='same')
        duck = 10 ** (a.duck_db * speak / 20)
        fade = np.minimum(1, np.arange(n) / (SR * 2.0)) * np.minimum(1, (n - np.arange(n)) / (SR * 4.0))
        L += bl * g * duck * fade; R += br * g * duck * fade
    for sc in tl['scenes'][1:]:
        w = whoosh(); i = int((sc['start'] - .45) * SR)
        L[i:i + len(w)] += w * .5; R[i:i + len(w)] += w * .45
    if not a.no_music:
        s = swell(2.5); L[:len(s)] += s * .4; R[:len(s)] += s * .4
        s = swell(3.0); i = int((tl['total'] - 3.2) * SR); L[i:i + len(s)] += s * .5; R[i:i + len(s)] += s * .5
    y = np.stack([L, R], 1)
    peak = np.abs(y).max()
    if peak > .9:
        y *= .9 / peak
    with wave.open(os.path.join(vdir, 'fx.wav'), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((y * 32767).astype('<i2').tobytes())
    print(f'fx.wav: {total:.1f} s')


if __name__ == '__main__':
    main()
