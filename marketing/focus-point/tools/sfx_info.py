#!/usr/bin/env python3
"""sfx/*.wav → sfx/info.json with each clip's duration, onset, peak time, end and max level (effects are aligned by peak)."""
import glob, json, os, wave
import numpy as np
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
info = {}
for f in sorted(glob.glob(os.path.join(here, 'sfx', '*.wav'))):
    w = wave.open(f); sr = w.getframerate(); ch = w.getnchannels()
    x = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(float) / 32768
    x = np.abs(x.reshape(-1, ch)).max(1)
    hop = int(sr * 0.005); env = np.array([x[i:i + hop].max() for i in range(0, len(x), hop)])
    mx = float(env.max()) if len(env) else 0.0
    above = np.where(env > mx * 0.1)[0]
    onset = float(above[0] * hop / sr) if len(above) else 0.0
    end = float(above[-1] * hop / sr) if len(above) else 0.0
    peak = float(np.argmax(env) * hop / sr)
    info[os.path.basename(f)[:-4]] = {"dur": round(len(x) / sr, 2), "onset": round(onset, 2), "peak": round(peak, 2), "end": round(end, 2), "max": round(mx, 2)}
json.dump(info, open(os.path.join(here, 'sfx', 'info.json'), 'w'), indent=1, sort_keys=True)
print(f'{len(info)} effects → sfx/info.json')
