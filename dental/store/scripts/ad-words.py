#!/usr/bin/env python3
"""The promo ad's narration, ready for the edit: its long pauses shortened and every word of the script placed in time.

  <venv>/bin/python store/scripts/ad-words.py <take.wav> store/ads/video2

Reads <dir>/script.json ({ sentences: [{ id, text, spoken }] }). Writes <dir>/narration.wav: the take with every pause
longer than MAX_PAUSE cut down to it (the middle of the silence goes; the speech itself is untouched, never sped up),
and <dir>/words.json: { duration, sentences: [{ id, start, end, words: [{ w, start, end }] }] }, the spoken words of
each sentence with their times in narration.wav (speech recognition, asr_align.py, aligned to the script; a word the
recogniser missed gets its time from its neighbours).
Needs the voice-over venv (faster-whisper, numpy).
"""
import json, os, re, subprocess, sys, wave

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'voiceover'))
import asr_align as A   # noqa: E402

MAX_PAUSE = 0.30


def read(path):
    with wave.open(path) as w:
        return w.getframerate(), np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)


def write(path, sr, x):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(x.astype(np.int16).tobytes())


def silences(path):
    err = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', 'silencedetect=noise=-38dB:d=0.2', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', err)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', err)]
    return list(zip(starts, ends))


def tighten(src, dst):
    sr, x = read(src)
    keep, pos = [], 0
    total = len(x) / sr
    for a, b in silences(src):
        if a <= 0.05:   # leading silence: keep 0.1 s
            cut0, cut1 = 0.0, max(0.0, b - 0.1)
        elif b >= total - 0.05:   # trailing: keep 0.4 s
            cut0, cut1 = a + 0.4, total
        elif b - a > MAX_PAUSE:
            mid = (a + b) / 2
            cut0, cut1 = mid - (b - a - MAX_PAUSE) / 2, mid + (b - a - MAX_PAUSE) / 2
        else:
            continue
        i0, i1 = int(cut0 * sr), int(cut1 * sr)
        if i1 > i0:
            keep.append(x[pos:i0]); pos = i1
    keep.append(x[pos:])
    y = np.concatenate(keep)
    write(dst, sr, y)
    return total, len(y) / sr


def main():
    take, d = sys.argv[1], sys.argv[2]
    script = json.load(open(os.path.join(d, 'script.json'), encoding='utf-8'))
    out_wav = os.path.join(d, 'narration.wav')
    before, after = tighten(take, out_wav)
    asr = A.transcribe(out_wav)
    flat, owner = [], []
    for si, s in enumerate(script['sentences']):
        for w in s['spoken'].split():
            if A.norm(w):
                flat.append(w); owner.append(si)
    pairs = A.align([A.norm(w) for w in flat], [A.norm(w['w']) for w in asr])
    times = [None] * len(flat)
    for i in range(len(flat)):
        if i in pairs and pairs[i][1] >= 0.5:
            a = asr[pairs[i][0]]
            times[i] = [a['start'], a['end']]
    matched = sum(t is not None for t in times)
    # fill the gaps: share the time between the known neighbours, by letters
    i = 0
    while i < len(flat):
        if times[i] is not None:
            i += 1; continue
        j = i
        while j < len(flat) and times[j] is None:
            j += 1
        lo = times[i - 1][1] if i > 0 else 0.0
        hi = times[j][0] if j < len(flat) else after
        lens = [len(A.norm(w)) for w in flat[i:j]]
        acc = lo
        for k, n in enumerate(lens):
            dt = (hi - lo) * n / max(sum(lens), 1)
            times[i + k] = [round(acc, 3), round(acc + dt, 3)]
            acc += dt
        i = j
    sentences = []
    for si, s in enumerate(script['sentences']):
        ws = [{'w': flat[k], 'start': times[k][0], 'end': times[k][1]} for k in range(len(flat)) if owner[k] == si]
        sentences.append({'id': s['id'], 'start': ws[0]['start'], 'end': ws[-1]['end'], 'words': ws})
    json.dump({'duration': round(after, 3), 'sentences': sentences}, open(os.path.join(d, 'words.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print(f'narration: {before:.1f} s -> {after:.1f} s (pauses at most {MAX_PAUSE} s); words anchored {matched}/{len(flat)}')
    for s in sentences:
        print(f"  {s['id']:8s} {s['start']:6.2f}-{s['end']:6.2f}  {' '.join(w['w'] for w in s['words'])[:60]}")


if __name__ == '__main__':
    main()
