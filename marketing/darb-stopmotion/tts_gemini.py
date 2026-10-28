#!/usr/bin/env python3
"""Voice-over with Gemini TTS (Interactions API), one request per language per video, then split into scene clips.

  GEMINI_API_KEY=... python3 tts_gemini.py --script script.json --out vo [--langs ar en] [--voice-ar ID] [--voice-en ID]

Each language's narration is sent as ONE request with "<long pause>" between scenes (keeps the voice consistent and
uses one quota unit per language). The returned WAV is split on the longest silences into vo/<lang>-<scene>.mp3.
Falls back to one request per scene (--per-scene) when the pause split does not line up.
The key is read from the GEMINI_API_KEY environment variable only; it is never written anywhere.
Exit code 3 = daily free quota used up (resume after midnight Pacific time).
"""
import argparse, base64, json, os, re, subprocess, sys, time, urllib.error, urllib.request, wave
import numpy as np

API = "https://generativelanguage.googleapis.com/v1beta"
MODEL = os.environ.get("GEMINI_TTS_MODEL", "gemini-3.8-flash-tts")
STYLE = {"ar": "excited, energetic YouTuber delivery, clear, fast pace", "en": "excited, energetic YouTuber delivery, clear, fast pace"}
PAUSE = " <long pause> "


def key():
    k = os.environ.get("GEMINI_API_KEY")
    if not k:
        sys.exit("GEMINI_API_KEY is not set")
    return k


def request(body, max_retries=6):
    data = json.dumps(body).encode("utf-8")
    for attempt in range(1, max_retries + 1):
        req = urllib.request.Request(API + "/interactions", data=data, method="POST",
                                     headers={"x-goog-api-key": key(), "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8", "replace")
            if e.code == 429:
                if re.search(r"per ?day|per_day|daily", err, re.I):
                    print("DAILY_QUOTA_EXHAUSTED\n" + err[:600], file=sys.stderr); sys.exit(3)
                m = re.search(r'"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"', err)
                wait = float(m.group(1)) + 1 if m else 25
                print(f"429 per-minute limit; waiting {wait:.0f}s ({attempt}/{max_retries})", file=sys.stderr); time.sleep(wait)
            elif e.code >= 500:
                print(f"HTTP {e.code}; retrying in {10 * attempt}s", file=sys.stderr); time.sleep(10 * attempt)
            else:
                sys.exit(f"HTTP {e.code}: {err[:1500]}")
        except urllib.error.URLError as e:
            print(f"network error ({e.reason}); retrying in {10 * attempt}s", file=sys.stderr); time.sleep(10 * attempt)
    sys.exit(3)


def tts(text, voice, style):
    item = {"type": "text", "text": text}
    if style:
        item["annotations"] = [{"type": "speech_metadata", "style": style}]
    resp = request({"model": MODEL, "input": [{"type": "user_input", "content": [item]}],
                    "response_format": {"type": "audio"}, "generation_config": {"speech_config": [{"voice": voice}]}})
    audio = [c for s in resp.get("steps", []) if s.get("type") == "model_output"
             for c in s.get("content", []) if c.get("type") == "audio" and c.get("data")]
    if not audio:
        sys.exit("No audio in response:\n" + json.dumps(resp, ensure_ascii=False)[:2000])
    raw = base64.b64decode(audio[-1]["data"])
    if raw[:4] == b"RIFF":
        return raw
    import io
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(raw)
    return buf.getvalue()


def read_wav(path):
    with wave.open(path) as w:
        sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), "<i2").astype(float) / 32768
        if w.getnchannels() > 1: x = x.reshape(-1, w.getnchannels()).mean(1)
    return sr, x


def split_on_silence(sr, x, texts, min_gap=0.3):
    """Split x into len(texts) parts. Each boundary is expected at the cumulative share of characters of the
    narration; the silence (>= min_gap) nearest to that expectation is used (longer silences preferred),
    falling back to the quietest 10 ms within +-3 s."""
    n_parts = len(texts)
    hop = int(sr * 0.01); env = np.array([np.abs(x[i:i + hop]).max() for i in range(0, len(x) - hop, hop)])
    thr = max(0.012, float(np.percentile(env, 20)) * 1.5)
    quiet = env < thr
    gaps = []; i = 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]: j += 1
            if (j - i) * 0.01 >= min_gap: gaps.append((i * hop, j * hop, (j - i) * 0.01))
            i = j
        else: i += 1
    # speech span (first/last loud sample) and expected boundaries by character share
    loud = np.where(env >= thr)[0]; t0 = loud[0] * hop; t1 = loud[-1] * hop; span = t1 - t0
    lens = [max(1, len(re.sub(r"\s+", " ", t))) for t in texts]; cum = np.cumsum(lens) / sum(lens)
    expected = [t0 + span * c for c in cum[:-1]]
    win = min(8 * sr, 0.12 * span)
    cuts = [0]
    for e in expected:
        cands = [g for g in gaps if abs((g[0] + g[1]) / 2 - e) <= win and (g[0] + g[1]) / 2 > cuts[-1] + sr]
        if cands:
            g = min(cands, key=lambda g: abs((g[0] + g[1]) / 2 - e) / (sr * 1.0) - 2.0 * g[2])
            cuts.append((g[0] + g[1]) // 2)
        else:
            a = int(max(cuts[-1] + sr, e - 3 * sr) // hop); b = int(min(len(env) - 1, (e + 3 * sr) // hop))
            cuts.append(int((a + int(np.argmin(env[a:b]))) * hop))
            print(f"  note: no silence near {e / sr:.1f}s; cut at quietest point {cuts[-1] / sr:.1f}s", file=sys.stderr)
    cuts.append(len(x))
    return [(cuts[k], cuts[k + 1]) for k in range(n_parts)], gaps


def trim(x, sr, thr=0.01, pad=0.12):
    idx = np.where(np.abs(x) > thr)[0]
    if not len(idx): return x
    a = max(0, idx[0] - int(pad * sr)); b = min(len(x), idx[-1] + int(pad * sr))
    return x[a:b]


def write_mp3(x, sr, path):
    tmp = path + ".wav"
    with wave.open(tmp, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-ar", "44100", "-b:a", "160k", path], check=True)
    os.remove(tmp)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--script", default="script.json"); p.add_argument("--out", default="vo")
    p.add_argument("--langs", nargs="*", default=["ar", "en"])
    p.add_argument("--voice-ar", default=os.environ.get("VOICE_AR", "Fenrir")); p.add_argument("--voice-en", default=os.environ.get("VOICE_EN", "Puck"))
    p.add_argument("--per-scene", action="store_true", help="one request per scene instead of one per language")
    p.add_argument("--style", default=None, help="short delivery note applied to both languages")
    p.add_argument("--force", action="store_true")
    a = p.parse_args()
    s = json.load(open(a.script)); scenes = s["scenes"]; os.makedirs(a.out, exist_ok=True)
    if a.style is not None:
        STYLE["ar"] = STYLE["en"] = a.style
    for lang in a.langs:
        voice = a.voice_ar if lang == "ar" else a.voice_en
        full = os.path.join(a.out, f"{lang}-full.wav")
        if a.per_scene:
            for sc in scenes:
                out = os.path.join(a.out, f"{lang}-{sc['id']}.mp3")
                if os.path.exists(out) and not a.force: print("skip", out); continue
                wav = tts(sc[lang], voice, STYLE[lang]); open(full, "wb").write(wav)
                sr, x = read_wav(full); write_mp3(trim(x, sr), sr, out); print("ok", out); time.sleep(21)
            continue
        if not (os.path.exists(full) and os.path.getsize(full) > 1000) or a.force:
            text = PAUSE.join(sc[lang].strip() for sc in scenes)
            open(full, "wb").write(tts(text, voice, STYLE[lang])); print("saved", full)
        sr, x = read_wav(full)
        parts, gaps = split_on_silence(sr, x, [sc[lang] for sc in scenes])
        print(lang, "silences >= 0.3 s:", [(round(g0 / sr, 2), round(d, 2)) for g0, g1, d in gaps])
        for sc, (i, j) in zip(scenes, parts):
            write_mp3(trim(x[i:j], sr), sr, os.path.join(a.out, f"{lang}-{sc['id']}.mp3"))
            print("ok", lang, sc["id"], round((j - i) / sr, 1), "s")


if __name__ == "__main__":
    main()
