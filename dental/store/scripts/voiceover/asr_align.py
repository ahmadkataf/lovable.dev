#!/usr/bin/env python3
"""Where each sentence of a narration is spoken: local speech recognition (faster-whisper, CPU) aligned to the script.

  <venv>/bin/python store/scripts/voiceover/asr_align.py <in.json> <out.json>

in.json:  { "wav": "<path>", "sentences": [{ "scene": i, "sentence": k, "words": ["...", ...] }] }  (the spoken text)
out.json: { "words": [{ "w", "start", "end" }], "sentences": [{ "scene", "sentence", "first", "last", "matched", "total" }] }
          first = start of the sentence's first recognised word, last = end of its last one (null when none matched).

The recogniser only anchors the words in time, so its Arabic does not have to be perfect: a global alignment (banded
Needleman-Wunsch on normalised words, scored by spelling similarity) maps script words to recognised words, and a
sentence's span comes from the words that matched well. split.mjs then cuts at the pause between the last word of one
scene and the first word of the next, which works even when the pause between scenes is as short as any other.
Needs: pip install faster-whisper requests (the model, "small" by default or ASR_MODEL, downloads once to HF_HOME).
"""
import json, os, re, sys, wave
from difflib import SequenceMatcher

import numpy as np


def norm(w):
    w = re.sub(r"[ً-ْٰـ]", "", w)
    w = re.sub(r"[إأآٱ]", "ا", w).replace("ى", "ي").replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي")
    return re.sub(r"[^\w]", "", w).lower()


def load16k(path):
    import subprocess
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768


def transcribe(path):
    from faster_whisper import WhisperModel
    model = WhisperModel(os.environ.get("ASR_MODEL", "small"), device="cpu", compute_type="int8", cpu_threads=os.cpu_count() or 4)
    segs, _ = model.transcribe(load16k(path), language="ar", word_timestamps=True, beam_size=1, vad_filter=False,
                               condition_on_previous_text=False)
    return [{"w": w.word.strip(), "start": round(float(w.start), 3), "end": round(float(w.end), 3)} for s in segs for w in s.words if w.word.strip()]


def align(script, asr, band=80):
    """Global alignment of two word lists; returns {script index: (asr index, similarity)}."""
    n, m = len(script), len(asr)
    GAP = -0.45
    sim_cache = {}
    def sim(i, j):
        key = (script[i], asr[j])
        if key not in sim_cache:
            a, b = key
            sim_cache[key] = 1.0 if a == b else (SequenceMatcher(None, a, b).ratio() if a and b else 0.0)
        return sim_cache[key]
    NEG = -1e18
    score = np.full((n + 1, m + 1), NEG)
    move = np.zeros((n + 1, m + 1), dtype=np.int8)   # 1 diag, 2 up (skip script), 3 left (skip asr)
    score[0, 0] = 0
    for j in range(1, m + 1):
        score[0, j] = j * GAP; move[0, j] = 3
    for i in range(1, n + 1):
        centre = int(i * m / max(n, 1))
        lo, hi = max(0, centre - band), min(m, centre + band)
        if lo == 0:
            score[i, 0] = i * GAP; move[i, 0] = 2
        for j in range(max(1, lo), hi + 1):
            best, mv = NEG, 0
            if score[i - 1, j - 1] > NEG:
                s = score[i - 1, j - 1] + (2 * sim(i - 1, j - 1) - 1)
                if s > best: best, mv = s, 1
            if score[i - 1, j] > NEG and score[i - 1, j] + GAP > best: best, mv = score[i - 1, j] + GAP, 2
            if score[i, j - 1] > NEG and score[i, j - 1] + GAP > best: best, mv = score[i, j - 1] + GAP, 3
            score[i, j], move[i, j] = best, mv
    # trace back from the best cell of the last script row (the recognition may run past or stop short)
    i, j = n, int(np.argmax(score[n]))
    pairs = {}
    while i > 0 and j > 0:
        mv = move[i, j]
        if mv == 1:
            pairs[i - 1] = (j - 1, sim(i - 1, j - 1)); i -= 1; j -= 1
        elif mv == 2: i -= 1
        elif mv == 3: j -= 1
        else: break
    return pairs


def main():
    src, out = sys.argv[1], sys.argv[2]
    job = json.load(open(src, encoding="utf-8"))
    words = transcribe(job["wav"])
    script, owner = [], []
    for si, s in enumerate(job["sentences"]):
        for w in s["words"]:
            nw = norm(w)
            if nw:
                script.append(nw); owner.append(si)
    pairs = align(script, [norm(w["w"]) for w in words])
    spans = [{"scene": s["scene"], "sentence": s["sentence"], "first": None, "last": None, "matched": 0, "total": 0} for s in job["sentences"]]
    for idx, si in enumerate(owner):
        spans[si]["total"] += 1
        if idx in pairs and pairs[idx][1] >= 0.6:
            a = words[pairs[idx][0]]
            sp = spans[si]
            sp["matched"] += 1
            sp["first"] = a["start"] if sp["first"] is None else sp["first"]
            sp["last"] = a["end"]
    json.dump({"words": words, "sentences": spans}, open(out, "w", encoding="utf-8"), ensure_ascii=False)
    matched = sum(s["matched"] for s in spans); total = sum(s["total"] for s in spans)
    print(f"asr: {len(words)} words recognised, {matched}/{total} script words anchored ({100 * matched / max(total, 1):.0f}%)")


if __name__ == "__main__":
    main()
