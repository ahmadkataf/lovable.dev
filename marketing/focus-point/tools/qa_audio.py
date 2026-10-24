#!/usr/bin/env python3
"""Ask Gemini to listen to the narration and check it against the script (transcription + dialect notes).

  python3 qa_audio.py voice/vo.wav voice/script.json [--model gemini-3.8-flash]
Reads GEMINI_API_KEY from the environment. Prints the model's JSON review.
"""
import base64, json, os, sys, urllib.request

API = "https://generativelanguage.googleapis.com/v1beta"


def main():
    wav, script = sys.argv[1:3]
    model = sys.argv[sys.argv.index('--model') + 1] if '--model' in sys.argv else 'gemini-3.8-flash'
    key = os.environ.get('GEMINI_API_KEY') or sys.exit('GEMINI_API_KEY is not set')
    lines = json.load(open(script, encoding='utf-8'))['lines']
    expected = "\n".join(f"{i + 1}. {l['vo']}" for i, l in enumerate(lines))
    prompt = f"""You are a Syrian dialect coach from Daraa (Hourani dialect) and an audio QA engineer.
Listen to the attached Arabic voice-over. The intended script (one line per video scene) is:

{expected}

Return ONLY JSON with these keys:
- "transcript": verbatim transcription in Arabic script of what is actually said (as pronounced).
- "line_count_heard": how many separate lines/segments you hear separated by clear pauses.
- "mismatches": list of {{"expected","heard","severity":"minor|major"}} where a word is skipped, added, or mispronounced.
- "dialect_notes": list of words pronounced in Modern Standard Arabic or a non-Hourani way (e.g. qaf as /q/ instead of hard /g/, full MSA case endings, Egyptian/Gulf vowels), each with the word and what you heard.
- "naturalness": 1-10 how natural and native the delivery sounds for a premium ad in Syrian Hourani dialect.
- "pace": "too slow" | "good" | "too fast".
- "overall": one sentence verdict, in Arabic.
"""
    body = {"contents": [{"parts": [{"text": prompt},
                                     {"inline_data": {"mime_type": "audio/wav",
                                                      "data": base64.b64encode(open(wav, 'rb').read()).decode()}}]}],
            "generationConfig": {"response_mime_type": "application/json", "temperature": 0.2}}
    req = urllib.request.Request(f"{API}/models/{model}:generateContent", data=json.dumps(body).encode(),
                                 headers={"x-goog-api-key": key, "Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            resp = json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read().decode('utf-8', 'replace')[:1500]}")
    text = "".join(p.get('text', '') for p in resp['candidates'][0]['content']['parts'])
    try:
        print(json.dumps(json.loads(text), ensure_ascii=False, indent=1))
    except Exception:
        print(text)


if __name__ == '__main__':
    main()
