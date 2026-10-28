# Placeholder voice-over via Microsoft Edge neural voices (free). Swap with tts_google.py when Google TTS credentials are available.
import os, sys, json, asyncio, certifi
certifi.where = lambda: '/root/.ccr/ca-bundle.crt'   # trust the session proxy CA
import edge_tts
VOICES = {'ar': ('ar-JO-TaimNeural', '+8%', '+0Hz'), 'en': ('en-US-AndrewMultilingualNeural', '+6%', '+0Hz')}
async def one(text, lang, out):
    v, rate, pitch = VOICES[lang]
    c = edge_tts.Communicate(text, v, rate=rate, pitch=pitch, proxy=os.environ.get('HTTPS_PROXY'))
    await c.save(out)
async def main():
    s = json.load(open('script.json'))
    os.makedirs('vo', exist_ok=True)
    for lang in sys.argv[1:] or ['ar', 'en']:
        for sc in s['scenes']:
            out = f"vo/{lang}-{sc['id']}.mp3"
            await one(sc[lang], lang, out); print('ok', out)
asyncio.run(main())
