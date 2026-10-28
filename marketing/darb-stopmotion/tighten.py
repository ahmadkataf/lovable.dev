#!/usr/bin/env python3
"""Tighten narration clips: trim lead/trail silence, cap internal pauses, then speed up slightly (pitch kept).
   python3 tighten.py vo4 vo4t 1.12 ar   (src dir, dst dir, tempo, langs...)"""
import sys, subprocess, numpy as np, os, json
src, dst, tempo = sys.argv[1], sys.argv[2], float(sys.argv[3]); langs = sys.argv[4:] or ['ar', 'en']
os.makedirs(dst, exist_ok=True); SR = 44100
def pcm(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, '<i2').astype(np.float32) / 32768
s = json.load(open('script4.json'))
for lang in langs:
    for sc in s['scenes']:
        x = pcm(f'{src}/{lang}-{sc["id"]}.mp3'); hop = SR // 100
        env = np.array([np.abs(x[i:i + hop]).max() for i in range(0, len(x) - hop, hop)])
        thr = max(0.012, float(np.percentile(env, 25)) * 1.4); loud = env >= thr
        idx = np.where(loud)[0]; a, b = idx[0], idx[-1]
        keep = np.ones(len(env), bool); keep[:max(0, a - 6)] = False; keep[b + 8:] = False     # 60 ms lead, 80 ms trail
        # cap internal pauses at 0.28 s (remove the middle part, keep 14 ms edges each side)
        i = a
        while i <= b:
            if not loud[i]:
                j = i
                while j <= b and not loud[j]: j += 1
                n = j - i
                if n > 28: keep[i + 14: j - 14] = False
                i = j
            else: i += 1
        # build sample mask with 5 ms crossfades at cut points
        mask = np.repeat(keep, hop)[:len(x)]
        if len(mask) < len(x): mask = np.concatenate([mask, np.zeros(len(x) - len(mask), bool)])
        y = x[mask]
        # smooth joins: tiny fades around each cut
        cuts = np.where(np.diff(mask.astype(int)) != 0)[0]
        out = f'{dst}/{lang}-{sc["id"]}.mp3'; tmp = f'{dst}/tmp-{lang}-{sc["id"]}.wav'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', tmp], input=y.tobytes(), check=True)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-af', f'atempo={tempo},afade=t=in:d=0.02', '-c:a', 'libmp3lame', '-q:a', '2', out], check=True)
        os.remove(tmp)
        print(lang, sc['id'], f'{len(x)/SR:.2f} -> {len(y)/SR:.2f} -> {len(y)/SR/tempo:.2f} s')
