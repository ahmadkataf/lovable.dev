#!/usr/bin/env python3
"""Text -> WAV with Google Gemini TTS (Interactions API). Standard library only.

  python3 gemini_tts.py --in voice/vo.txt --out voice/vo.wav --voice Charon --style "warm, unhurried ad narrator"
  python3 gemini_tts.py --list-voices --search ar-

The API key is read from the environment variable GEMINI_API_KEY (never stored in the repo).
Exit codes: 0 saved (or skipped: file exists), 3 daily free quota used up (resets midnight Pacific), 1 other error.
Free tier (gemini-3.8-flash-tts): 3 requests/min, 10 requests/day. One request = the whole narration.
"""
import argparse, base64, json, os, re, sys, time, urllib.error, urllib.parse, urllib.request, wave

API = "https://generativelanguage.googleapis.com/v1beta"


def key():
    k = os.environ.get("GEMINI_API_KEY")
    if not k:
        sys.exit("GEMINI_API_KEY is not set")
    return k


def request(method, path, body=None, max_retries=6):
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    last = ""
    for attempt in range(1, max_retries + 1):
        req = urllib.request.Request(API + path, data=data, method=method,
                                     headers={"x-goog-api-key": key(), "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8", "replace")
            if e.code == 429:
                last = "429"
                if re.search(r"per ?day|per_day|daily", err, re.I):
                    print("DAILY_QUOTA_EXHAUSTED: resume after midnight Pacific time.\n" + err[:800], file=sys.stderr)
                    sys.exit(3)
                m = re.search(r'"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"', err)
                wait = float(m.group(1)) + 1 if m else 25
                print(f"429 per-minute limit; waiting {wait:.0f}s (try {attempt}/{max_retries})", file=sys.stderr)
                time.sleep(wait)
            elif e.code >= 500:
                last = f"HTTP {e.code}"
                print(f"HTTP {e.code}; retrying in {10 * attempt}s", file=sys.stderr)
                time.sleep(10 * attempt)
            else:
                sys.exit(f"HTTP {e.code}: {err[:2000]}")
        except urllib.error.URLError as e:
            last = f"network: {e.reason}"
            print(f"Network error ({e.reason}); retrying in {10 * attempt}s", file=sys.stderr)
            time.sleep(10 * attempt)
    if last == "429":
        sys.exit(3)
    sys.exit(f"Gave up after {max_retries} tries ({last}).")


def tts(text, model, voice, style):
    item = {"type": "text", "text": text}  # read verbatim; inline tags like <long pause> are allowed
    if style:
        item["annotations"] = [{"type": "speech_metadata", "style": style}]
    resp = request("POST", "/interactions", {
        "model": model,
        "input": [{"type": "user_input", "content": [item]}],
        "response_format": {"type": "audio"},
        "generation_config": {"speech_config": [{"voice": voice}]},
    })
    audio = [c for s in resp.get("steps", []) if s.get("type") == "model_output"
             for c in s.get("content", []) if c.get("type") == "audio" and c.get("data")]
    if not audio:
        sys.exit("No audio in response:\n" + json.dumps(resp, ensure_ascii=False, indent=2)[:3000])
    return base64.b64decode(audio[-1]["data"])


def tts_classic(text, model, voice, style):
    """Older models (gemini-2.5-*-preview-tts) via generateContent: the style goes in the prompt, pause tags become
    paragraph breaks. Used when the main model's daily quota is spent (each model has its own quota)."""
    body = re.sub(r"\s*<long pause>\s*", "\n\n...\n\n", text).strip()
    prompt = f"Say in the voice of {style}:\n{body}" if style else body
    resp = request("POST", f"/models/{model}:generateContent", {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseModalities": ["AUDIO"],
                             "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}},
    })
    parts = [p for c in resp.get("candidates", []) for p in c.get("content", {}).get("parts", []) if p.get("inlineData")]
    if not parts:
        sys.exit("No audio in response:\n" + json.dumps(resp, ensure_ascii=False, indent=2)[:3000])
    return base64.b64decode(parts[-1]["inlineData"]["data"])


def save_wav(audio, path):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    if audio[:4] == b"RIFF":
        with open(path, "wb") as f:
            f.write(audio)
    else:
        with wave.open(path, "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(audio)
    with wave.open(path) as w:
        return w.getnframes() / float(w.getframerate())


def list_voices(search):
    voices, token = [], None
    while True:
        q = {"page_size": 1000}
        if token:
            q["page_token"] = token
        resp = request("GET", "/voices?" + urllib.parse.urlencode(q))
        voices += resp.get("voices", [])
        token = resp.get("next_page_token") or resp.get("nextPageToken")
        if not token:
            break
    s = (search or "").lower()
    for v in voices:
        g = lambda *k: next((v[x] for x in k if v.get(x)), "")
        line = " | ".join(str(x) for x in (g("id", "name"), g("display_name", "displayName"),
                                            g("language_code", "languageCode"), g("gender"), g("description")))
        if s in line.lower():
            print(line)


def main():
    p = argparse.ArgumentParser(description="Text -> WAV with Gemini TTS")
    p.add_argument("--text")
    p.add_argument("--in", dest="infile")
    p.add_argument("--out")
    p.add_argument("--model", default="gemini-3.8-flash-tts")
    p.add_argument("--voice", default="Charon")
    p.add_argument("--style", default="")
    p.add_argument("--force", action="store_true")
    p.add_argument("--classic", action="store_true", help="generateContent API (gemini-2.5-*-preview-tts)")
    p.add_argument("--list-voices", action="store_true")
    p.add_argument("--search", default="")
    a = p.parse_args()
    if a.list_voices:
        return list_voices(a.search)
    if not a.out or (a.text is None) == (a.infile is None):
        p.error("give --out and exactly one of --text / --in")
    if os.path.exists(a.out) and os.path.getsize(a.out) > 44 and not a.force:
        print(f"SKIP (already exists): {a.out}")
        return
    text = a.text if a.text is not None else open(a.infile, encoding="utf-8").read().strip()
    if not text:
        sys.exit("Empty text")
    dur = save_wav((tts_classic if a.classic else tts)(text, a.model, a.voice, a.style), a.out)
    print(f"SAVED {a.out} ({dur:.1f}s)")


if __name__ == "__main__":
    main()
