#!/usr/bin/env python3
"""Mix the sound for the Focus Point reel: voice-over + music bed (ducked) + Mixkit effects aligned to the
visual events. Writes mix.wav (44.1 kHz stereo).

  python3 mix.py                      # reads voice/vo.wav, voice/timings.json, assets/music-bed.mp3, sfx/*.wav

The scene boundaries use the same formulas as reel.html (VO pad 1.4 s, visuals lead the voice by 0.28 s).
Effects: Mixkit (free commercial license, not redistributed) — download by id into sfx/ as in README.md.
"""
import json, os, re, subprocess, sys, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 44100
VO_PAD, LEAD, TAIL = 1.4, 0.28, 3.4
MUSIC_IN = float(os.environ.get('MUSIC_IN', '24.0'))      # where in the bed the steady part starts
MUSIC_GAIN = float(os.environ.get('MUSIC_GAIN', '0.28'))  # linear, before ducking
DUCK_DB = float(os.environ.get('DUCK_DB', '-7'))


def load(path, sr=SR):
    """Any audio file → float stereo array at sr (via ffmpeg for mp3)."""
    if not path.endswith('.wav'):
        tmp = path + '.tmp.wav'
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', path, '-ar', str(sr), '-ac', '2', tmp], check=True)
        x = load(tmp, sr); os.remove(tmp); return x
    w = wave.open(path); fsr = w.getframerate(); ch = w.getnchannels()
    x = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float64) / 32768
    x = x.reshape(-1, ch)
    if ch == 1: x = np.repeat(x, 2, 1)
    if fsr != sr:
        t = np.arange(int(len(x) * sr / fsr)) / sr; src = np.arange(len(x)) / fsr
        x = np.stack([np.interp(t, src, x[:, c]) for c in range(2)], 1)
    return x


def main():
    os.chdir(HERE)
    T = json.load(open('voice/timings.json', encoding='utf-8'))
    vo = load('voice/vo.wav')
    L = [{**l, 'start': l['start'] + VO_PAD, 'end': l['end'] + VO_PAD, 'voice_end': l.get('voice_end', l['end']) + VO_PAD} for l in T['lines']]
    N = len(L)
    S = [(0 if i == 0 else L[i]['start'] - LEAD) for i in range(N)]          # scene starts
    END = L[-1]['voice_end'] + TAIL
    n = int(END * SR); mix = np.zeros((n, 2))
    info = json.load(open('sfx/info.json'))

    def put(x, t, g=1.0, cut=None, fade=.05, pan=0.0):
        x = x.copy()
        if cut: x = x[:int(cut * SR)]; f = int(fade * SR); x[-f:] *= np.linspace(1, 0, f)[:, None]
        i = int(round(t * SR))
        if i < 0: x = x[-i:]; i = 0
        j = min(n, i + len(x)); y = x[:j - i] * g
        if pan: y = y * np.array([1 - pan, 1 + pan])[None, :]
        mix[i:j] += y

    cache = {}
    def sfx(id):
        if id not in cache: cache[id] = load(f'sfx/{id}.wav')
        return cache[id]
    def hit(id, tev, g=1.0, **k):      # align the effect's peak with the visual event
        put(sfx(id), tev - info[id]['peak'], g, **k)

    # ---- voice: RMS-normalise to about -20 dBFS, then place
    rms = np.sqrt(np.mean(vo ** 2)); vo = vo * (10 ** (-20 / 20) / max(rms, 1e-6))
    vo = np.clip(vo, -0.98, 0.98)
    put(vo, VO_PAD, 1.0)

    # ---- music bed: steady section, fade in/out, ducked under the voice
    bed = load('assets/music-bed.mp3')[int(MUSIC_IN * SR):]
    bed = bed[:n] if len(bed) >= n else np.vstack([bed, np.zeros((n - len(bed), 2))])
    env = np.ones(n)
    fi = int(1.2 * SR); env[:fi] = np.linspace(0, 1, fi)
    fo = int(2.6 * SR); env[-fo:] *= np.linspace(1, 0, fo)
    # ducking: lower the bed while the voice is active (smooth 80 ms window)
    vo_env = np.zeros(n); i0 = int(VO_PAD * SR); seg = np.abs(vo).mean(1); vo_env[i0:i0 + len(seg)] = seg[:n - i0]
    k = int(0.08 * SR); vo_env = np.convolve(vo_env, np.ones(k) / k, 'same')
    gate = (vo_env > 0.01).astype(float)
    k2 = int(0.35 * SR); gate = np.convolve(gate, np.ones(k2) / k2, 'same'); gate = np.clip(gate, 0, 1)
    duck = 10 ** (DUCK_DB / 20)
    env *= (1 - gate) + gate * duck
    # gentle high-shelf cut so the glockenspiel accents sit under sibilance (first-order one-pole lowpass blend)
    a = np.exp(-2 * np.pi * 6000 / SR); lp = np.zeros_like(bed); acc = np.zeros(2)
    for i in range(len(bed)):
        acc = a * acc + (1 - a) * bed[i]; lp[i] = acc
    bed = 0.55 * bed + 0.45 * lp
    mix += bed * (MUSIC_GAIN * env)[:, None]

    # ---- effects (cue times mirror reel.html: scene i starts at S[i])
    s = lambda i: S[i] if i < N else END
    # 0 hook: the point pulses, phrases land as page turns, snap into focus, the point pops
    hit('2535', 0.12, 0.35)
    hook_n = max(1, len([w for w in re.split(r'[.،!؟]+', L[0].get('screen') or '') if w.strip()]))
    t0 = max(1.0, L[0]['start'] - .15); per = min(.6, max(.3, (s(1) - t0 - 1.2) / hook_n))
    for i in range(hook_n): hit('3115', t0 + i * per + .05, 0.55, pan=(i % 2) * .4 - .2)
    hit('2870', t0 + per * hook_n + .3, 0.45, cut=1.2, fade=.4)
    hit('2568', s(1) - .7, 0.7)
    put(sfx('1492'), s(1) - .35, 0.45, cut=.9, fade=.3)                 # words scatter away
    # 1 where?: headline, two cards pop, shaking (no sound: the music carries it), freeze + big question
    hit('3115', s(1) + .15, 0.5)
    hit('2568', s(1) + .45, 0.6, pan=-.3); hit('2568', s(1) + .7, 0.6, pan=.3)
    D1 = s(2) - s(1); qAt = s(1) + max(1.6, D1 * .58)
    put(sfx('2870'), qAt - .45, 0.4, cut=1.0, fade=.4)
    hit('3060', qAt + .05, 0.6); hit('2608', qAt + .08, 0.3, cut=1.2, fade=.5)
    # 2 corridor: the burgundy point hits, a long soft whoosh for the dolly, chime when the logo is close
    hit('2354', s(2) - .05, 0.5, cut=1.8, fade=.7)
    put(sfx('2903'), s(2) + .2, 0.5, cut=3.2, fade=1.2)
    hit('3115', s(2) + .95, 0.4)
    hit('2003', s(3) - 1.1, 0.45)
    # 3 door: latch, swing, push-through, chips
    hit('2073', s(3) + .5, 0.8)
    put(sfx('1492'), s(3) + .55, 0.6, cut=.9, fade=.3)
    put(sfx('2870'), s(3) + 1.3, 0.5, cut=1.4, fade=.5)
    hit('3115', s(3) + 2.6, 0.4)
    for i in range(4): hit('2568', s(3) + 2.9 + i * .14 + .1, 0.6, pan=(i % 2) * .5 - .25)
    # 4 card: swoosh in, headline, four chips
    hit('3060', s(4) + .25, 0.6); hit('3115', s(4) + .4, 0.4)
    for i in range(4): hit('2568', s(4) + 1.0 + i * .16 + .1, 0.55, pan=(i % 2) * .5 - .25)
    # 5 hours → map: clock in, ticks during the sweep, chime at 11; map draws, pin drops, card
    a5, b5 = s(5), s(6); D5 = b5 - a5
    ps = [p for p in (L[5].get('pauses') or [])]
    if ps:
        pz = max(ps, key=lambda p: p[1] - p[0]); M = max(a5 + 2.2, min(b5 - 2.0, (pz[0] + pz[1]) / 2 + VO_PAD - .1))
    else: M = a5 + D5 * .52
    hit('1492', a5 + .15, 0.5); hit('3115', a5 + .3, 0.4)
    tk = a5 + .8
    while tk < max(a5 + 1.5, M - .6): hit('2357', tk, 0.35); tk += .22
    hit('3005', max(a5 + 1.5, M - .6) + .05, 0.45)
    put(sfx('2870'), M - .1, 0.35, cut=1.3, fade=.5)
    hit('2364', M + 1.4, 0.9); hit('3005', M + 1.45, 0.5)
    hit('2568', M + 1.7, 0.6)
    # 6 CTA: the pin's colour wipes, logo chime, letters tick in, call chip pops, final chime
    hit('2354', s(6) - .05, 0.5, cut=1.8, fade=.7)
    hit('2003', s(6) + .35, 0.6)
    for i in range(11): hit('2357', s(6) + .55 + i * .05 + .02, 0.22, pan=-.4 + i * .08)
    hit('3115', s(6) + 1.15, 0.35); hit('3115', s(6) + 1.55, 0.35)
    hit('2568', s(6) + 2.1, 0.7); hit('2535', s(6) + 2.15, 0.5)
    hit('2568', s(6) + 2.45, 0.5)

    # ---- master: soft clip and normalise to -1 dBFS peak
    peak = np.abs(mix).max(); mix = mix * (10 ** (-1 / 20) / max(peak, 1e-6))
    out = wave.open('mix.wav', 'wb'); out.setnchannels(2); out.setsampwidth(2); out.setframerate(SR)
    out.writeframes((np.clip(mix, -1, 1) * 32767).astype('<i2').tobytes()); out.close()
    print(f'mix.wav: {END:.2f}s, scenes at ' + ', '.join(f'{x:.2f}' for x in S))
    json.dump({'duration': END, 'scenes': S}, open('voice/scenes.json', 'w'), indent=1)


if __name__ == '__main__':
    main()
