# Voice-over with Google Cloud Text-to-Speech (replaces vo/*.mp3 produced by tts_edge.py).
# Auth, either one:  GOOGLE_API_KEY=...   or   GOOGLE_APPLICATION_CREDENTIALS=/path/service-account.json (pip install google-auth)
# Usage: python3 tts_google.py [ar] [en]   then: python3 timeline.py && re-render/mix.
import os, sys, json, base64, urllib.request
VOICES = {  # Chirp 3 HD voices are the most expressive; override with env VOICE_AR / VOICE_EN
    'ar': {'languageCode': 'ar-XA', 'name': os.environ.get('VOICE_AR', 'ar-XA-Chirp3-HD-Charon')},
    'en': {'languageCode': 'en-US', 'name': os.environ.get('VOICE_EN', 'en-US-Chirp3-HD-Puck')},
}
def auth_headers():
    key = os.environ.get('GOOGLE_API_KEY')
    if key: return {}, '?key=' + key
    import google.auth, google.auth.transport.requests
    creds, _ = google.auth.default(scopes=['https://www.googleapis.com/auth/cloud-platform'])
    creds.refresh(google.auth.transport.requests.Request())
    return {'Authorization': 'Bearer ' + creds.token}, ''
def synth(text, lang, out):
    hdr, q = auth_headers()
    body = {'input': {'text': text}, 'voice': VOICES[lang],
            'audioConfig': {'audioEncoding': 'MP3', 'speakingRate': float(os.environ.get('RATE', '1.08')), 'sampleRateHertz': 24000}}
    req = urllib.request.Request('https://texttospeech.googleapis.com/v1/text:synthesize' + q, data=json.dumps(body).encode(),
                                 headers={'Content-Type': 'application/json', **hdr})
    with urllib.request.urlopen(req) as r: audio = json.load(r)['audioContent']
    open(out, 'wb').write(base64.b64decode(audio)); print('ok', out)
s = json.load(open('script.json')); os.makedirs('vo', exist_ok=True)
for lang in sys.argv[1:] or ['ar', 'en']:
    for sc in s['scenes']: synth(sc[lang], lang, f"vo/{lang}-{sc['id']}.mp3")
