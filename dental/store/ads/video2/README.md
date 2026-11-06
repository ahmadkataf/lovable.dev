# Promo ad, second cut (Syrian dialect)

A fast ad (about 54 s) that shows the app's professional power: the tooth chart, treatment plans with a printed
estimate, the allergy warning on prescriptions, invoices from finished work, the profit report, and then the lab,
inventory, staff roles, WhatsApp reminders and encrypted backups, offline on Windows or Android, the offer and the call
to action. Two formats: `story` (1080×1920, for Instagram/Facebook stories, WhatsApp status and TikTok) and `square`
(1080×1080, for the feed).

| File | What | In git |
|---|---|---|
| `script.json` | the lines: `text` (the caption, colloquial spelling) and `spoken` (what the voice read, with Damascene pronunciation hints), the TTS voice and style | yes |
| `narration.txt` | the `spoken` lines, as sent to Gemini TTS | yes |
| `narration.wav`, `words.json` | the chosen take with its long pauses shortened, and every word's time (`ad-words.py`) | wav no, json yes |
| `dentora-ad2-<format>-ar.mp4/.jpg` | the videos and their covers | no |

The voice: Gemini TTS `gemini-3.8-flash-tts`, voice `ar-001-training-2` (the course's voice), style in `script.json`;
take 4 of 4 (`store/voiceover/audio/AD2-promo_take4.wav`, logged in `store/voiceover/requests.csv`).

## Rebuilding

```sh
# 1. the narration (one request; the key only from the environment)
GEMINI_API_KEY=… python3 store/scripts/voiceover/gemini_tts.py --in store/ads/video2/narration.txt \
  --out store/voiceover/audio/AD2-promo_take5.wav --voice ar-001-training-2 --style "<script.json style>"
# 2. shorten the long pauses (the voice is never sped up) and time every word (speech recognition)
$ASR_PYTHON store/scripts/ad-words.py store/voiceover/audio/AD2-promo_take5.wav store/ads/video2
# 3. the videos: frames drawn by Chromium (store/scripts/ad-promo-page.js); the sound is the voice alone
#    (--music adds the synthesised music and cut effects of store/scripts/ad-music.py)
ASR_PYTHON=$ASR_PYTHON node store/scripts/ad-promo.mjs [--formats=story,square] [--stills=3.2,9.5] [--music]
```

`ASR_PYTHON` is the voice-over venv (faster-whisper, numpy, scipy). The cuts, camera moves, highlights and titles are
tied to the words in `words.json`, so a new take needs no retiming; the footage regions are in `ad-promo.mjs`.
The published cut has no music, at the owner's request (16 October 2026); the optional music is synthesised from
scratch (no samples or licences). Every claim stays true of the app and the offer
(`server/src/pages/content.ts`): 59$ once per device, a 7-day trial with every feature.
