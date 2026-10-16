#!/usr/bin/env python3
"""The promo ad's soundtrack: original music synthesised from scratch (no samples, no licences), the sound effects of
its cuts, and the mix with the narration.

  <venv>/bin/python store/scripts/ad-music.py <cues.json> <voice.wav> <out.wav>

cues.json: { "duration": s, "lead": s (the narration starts this late), "drop": s (the beat comes in: the brand reveal),
             "whoosh": [s...] (cuts), "impact": [s...] (the logo, the price), "riser": [s...] (the end of a riser),
             "break": [a, b] (a quieter stretch: the offer), "end": s (the last hit) }
The music: 120 BPM in A minor (Am F C G), its bars aligned so the drop falls on a downbeat; four-on-the-floor kick,
claps, hats, a pumping bass, a pad and a pluck arpeggio, ducked under the voice. Output: 48 kHz stereo float WAV,
not loudness-normalised (the video's ffmpeg pass does that, to -14 LUFS).
Needs numpy and scipy (the voice-over venv).
"""
import json, sys, wave

import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000
BPM = 120
BEAT = 60 / BPM
BAR = 4 * BEAT
rng = np.random.default_rng(7)


def t_axis(n):
    return np.arange(n) / SR


def env_ad(n, attack, decay):
    t = t_axis(n)
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-np.maximum(t - attack, 0) / decay)


def lp(x, f, order=2):
    return sosfilt(butter(order, min(f, SR / 2 - 100), 'low', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, 'high', fs=SR, output='sos'), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)


def saw(freq, n, detune=0.0, phase=0.0):
    t = t_axis(n)
    return 2 * ((freq * (1 + detune) * t + phase) % 1.0) - 1


def note_hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def add(buf, start_s, sig, gain=1.0):
    i = int(round(start_s * SR))
    if i >= len(buf) or i + len(sig) <= 0:
        return
    s0 = max(0, -i)
    i = max(0, i)
    n = min(len(sig) - s0, len(buf) - i)
    buf[i:i + n] += gain * sig[s0:s0 + n]


# ---- instruments -----------------------------------------------------------------------------------------------------
def kick():
    n = int(0.42 * SR)
    t = t_axis(n)
    f = 46 + 110 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.22)
    click = hp(rng.standard_normal(n), 3000) * np.exp(-t / 0.004) * 0.25
    return np.tanh(1.6 * (body + click))


def clap():
    n = int(0.3 * SR)
    t = t_axis(n)
    noise = bp(rng.standard_normal(n), 900, 5000)
    e = np.zeros(n)
    for k, d in enumerate([0, 0.011, 0.022]):
        e += (t >= d) * np.exp(-np.maximum(t - d, 0) / (0.006 if k < 2 else 0.09))
    return noise * e * 0.6


def hat(open_=False):
    n = int((0.22 if open_ else 0.06) * SR)
    t = t_axis(n)
    return hp(rng.standard_normal(n), 7500) * np.exp(-t / (0.07 if open_ else 0.014)) * 0.35


def pluck(midi, length=0.22):
    n = int(length * SR)
    t = t_axis(n)
    f = note_hz(midi)
    x = 0.6 * saw(f, n) + 0.4 * np.sign(np.sin(2 * np.pi * f * t))
    x = lp(x, 3800) * np.exp(-t / 0.09)
    return x * 0.5


def bass_note(midi, length):
    n = int(length * SR)
    t = t_axis(n)
    f = note_hz(midi)
    x = saw(f, n) + 0.5 * np.sin(2 * np.pi * f / 2 * t)
    x = lp(x, 420, 4)
    e = np.clip(t / 0.005, 0, 1) * np.clip((length - t) / 0.02, 0, 1)
    return np.tanh(1.4 * x * e) * 0.55


def pad_chord(midis, length):
    n = int(length * SR)
    t = t_axis(n)
    x = np.zeros(n)
    for m in midis:
        for d in (-0.006, 0.0, 0.007):
            x += saw(note_hz(m), n, d, rng.random())
    x = lp(x / (3 * len(midis)), 1800, 2)
    e = np.clip(t / 0.25, 0, 1) * np.clip((length - t) / 0.3, 0, 1)
    return x * e * 0.5


def whoosh(length=0.42):
    n = int(length * SR)
    t = t_axis(n)
    x = rng.standard_normal(n)
    # a band sweeping up then down, processed in short blocks
    out = np.zeros(n)
    blk = 512
    for i in range(0, n, blk):
        u = i / n
        c = 500 + 5500 * np.sin(np.pi * u) ** 1.5
        seg = x[max(0, i - 2048):i + blk]
        y = bp(seg, max(200, c * 0.6), min(SR / 2 - 200, c * 1.5))
        out[i:i + blk] = y[-len(out[i:i + blk]):]
    e = np.sin(np.pi * np.clip(t / length, 0, 1)) ** 2
    return out * e * 0.5


def impact():
    n = int(1.4 * SR)
    t = t_axis(n)
    f = 38 + 70 * np.exp(-t / 0.06)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.5)
    crack = lp(rng.standard_normal(n), 6000) * np.exp(-t / 0.03) * 0.5
    tail = lp(rng.standard_normal(n), 2500) * np.exp(-t / 0.35) * 0.12
    return np.tanh(1.3 * (boom + crack + tail))


def riser(length=1.6):
    n = int(length * SR)
    t = t_axis(n)
    x = rng.standard_normal(n)
    out = np.zeros(n)
    blk = 512
    for i in range(0, n, blk):
        u = i / n
        c = 300 + 7000 * u ** 2
        seg = x[max(0, i - 2048):i + blk]
        y = bp(seg, max(150, c * 0.7), min(SR / 2 - 200, c * 1.4))
        out[i:i + blk] = y[-len(out[i:i + blk]):]
    return out * (t / length) ** 2 * 0.45


# ---- the arrangement -------------------------------------------------------------------------------------------------
PROG = [(57, [57, 60, 64]), (53, [53, 57, 60]), (48, [55, 60, 64]), (55, [55, 59, 62])]   # Am F C G (roots, chords)
ARP_STEPS = [0, 1, 2, 3, 2, 1, 2, 3, 0, 2, 1, 3, 2, 3, 1, 2]   # which chord tone each sixteenth of a bar plays


def music(duration, drop, brk, end):
    n = int(duration * SR) + SR
    drums = np.zeros(n); bass = np.zeros(n); pad = np.zeros(n); arp = np.zeros(n)
    k, c, h, ho = kick(), clap(), hat(), hat(True)
    origin = drop - BAR * int(np.ceil(drop / BAR) + 1)   # bars run from before 0 so the drop is a downbeat
    bar_i = 0
    t0 = origin
    while t0 < end + BAR:
        root, chord = PROG[bar_i % 4]
        in_break = brk and brk[0] <= t0 < brk[1]
        before_drop = t0 < drop - 1e-6
        # pad: always (softer before the drop)
        add(pad, t0, pad_chord(chord, BAR + 0.2), 0.55 if before_drop else (0.8 if in_break else 0.6))
        for b in range(4):
            tb = t0 + b * BEAT
            if tb >= end:
                break
            if not before_drop and not in_break:
                add(drums, tb, k, 0.9)
                if b in (1, 3):
                    add(drums, tb, c, 0.55)
                add(drums, tb + BEAT / 2, ho if b == 3 else h, 0.6)
                add(drums, tb + BEAT / 4, h, 0.22)
                add(drums, tb + 3 * BEAT / 4, h, 0.22)
                # bass: off-beat eighths, pumping
                add(bass, tb + BEAT / 2, bass_note(root - 12, BEAT / 2 * 0.9), 1.0)
                add(bass, tb, bass_note(root - 12, BEAT / 2 * 0.5), 0.55)
            elif in_break:
                add(drums, tb + BEAT / 2, h, 0.35)
                if b == 0:
                    add(drums, tb, k, 0.6)
            else:   # the intro: a ticking hat, the tension
                add(drums, tb + BEAT / 2, h, 0.45)
                add(drums, tb, h, 0.25)
            # the pluck arpeggio, sixteenths over the chord tones
            if not before_drop or t0 >= drop - 2 * BAR:
                tones = [chord[0], chord[1], chord[2], chord[0] + 12]
                for s in range(4):
                    m = tones[ARP_STEPS[(b * 4 + s) % 16]] + 12
                    add(arp, tb + s * BEAT / 4, pluck(m, 0.2), 0.32 if not in_break else 0.4)
        t0 += BAR
        bar_i += 1
    # a snare roll into the drop
    for i in range(8):
        add(drums, drop - BEAT * 2 + i * BEAT / 4, c, 0.15 + 0.06 * i)
    mix = 0.95 * drums + 0.8 * bass + 0.5 * pad + 0.55 * arp
    # sidechain pump from the kick (not in the intro or the break)
    t = t_axis(n)
    phase = ((t - origin) % BEAT) / BEAT
    pump = 1 - 0.45 * np.exp(-phase / 0.18)
    on = (t >= drop) & ~((t >= (brk[0] if brk else 1e9)) & (t < (brk[1] if brk else -1)))
    mix = np.where(on, mix * pump + 0.95 * drums * (1 - pump), mix)
    # fade the music out after the last hit
    fade = np.clip((end + 1.6 - t) / 1.6, 0, 1)
    return mix * np.where(t > end, fade, 1.0)


def read_wav(path):
    with wave.open(path) as w:
        sr, ch, sw = w.getframerate(), w.getnchannels(), w.getsampwidth()
        raw = w.readframes(w.getnframes())
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    if sr != SR:   # linear resampling is enough for an envelope and for 24 kHz speech
        idx = np.arange(int(len(x) * SR / sr)) * sr / SR
        x = np.interp(idx, np.arange(len(x)), x)
    return x


def main():
    cues = json.load(open(sys.argv[1]))
    voice = read_wav(sys.argv[2])
    dur = cues['duration']
    n = int(dur * SR)
    v = np.zeros(n)
    add(v, cues['lead'], voice)
    m = music(dur, cues['drop'], cues.get('break'), cues['end'])[:n]
    fx = np.zeros(n)
    for s in cues.get('whoosh', []):
        add(fx, s - 0.21, whoosh(), 0.55)
    for s in cues.get('impact', []):
        add(fx, s, impact(), 0.8)
    for s in cues.get('riser', []):
        add(fx, s - 1.6, riser(), 0.6)
    # duck the music under the voice: a smoothed envelope of the speech
    e = np.abs(v)
    win = int(0.05 * SR)
    e = np.convolve(e, np.ones(win) / win, mode='same')
    e = e / (e.max() + 1e-9)
    gate = np.clip(e * 6, 0, 1)
    # release: hold the ducking a little after each word
    rel = int(0.25 * SR)
    gate = np.convolve(gate, np.ones(rel) / rel * 2, mode='full')[:n].clip(0, 1)
    duck = 1 - 0.55 * gate
    vr = np.sqrt(np.mean(v[v != 0] ** 2)) if np.any(v) else 0.1
    mr = np.sqrt(np.mean(m ** 2)) + 1e-9
    m = m / mr * vr * 0.30   # the music about 10 dB under the voice, then ducked
    fx = fx / (np.abs(fx).max() + 1e-9) * vr * 2.2
    left = v + m * duck + fx * 0.9
    d = int(0.012 * SR)   # a touch of width on the music: one side slightly later
    right = v + np.r_[np.zeros(d), (m * duck)[:-d]] + fx * 0.9
    out = np.stack([left, right], axis=1)
    peak = np.abs(out).max()
    if peak > 0.98:
        out *= 0.98 / peak
    with wave.open(sys.argv[3], 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((out * 32767).astype(np.int16).tobytes())
    print(f'mix: {dur:.1f} s, voice rms {vr:.3f}, peak {peak:.2f}')


if __name__ == '__main__':
    main()
