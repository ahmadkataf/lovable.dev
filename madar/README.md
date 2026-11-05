# مَدار (Madar) — pitch site and brief video

A proposal for the Daraa Directorate of Education: one Arabic platform linking the directorate, the school,
the teacher, the student and the parent. Everything here is the *pitch*: the concept, an interactive mock-up
and a narrated 3-minute video. The product itself is phase 1 of the roadmap.

| What | Where |
|---|---|
| Concept, scope and specifications (Arabic) | `docs/concept.md` |
| Pitch site with the interactive mock-up | `site/index.html` (static, self-hosted fonts in `site/fonts/`) |
| Brief video, 1080p and a WhatsApp-sized 720p | `video/madar-brief.mp4`, `video/madar-brief-720p.mp4` |
| Video sources: scenes, renderer, narration script | `video/src/`, `video/narration.txt` |

## Deployment

`.github/workflows/deploy-madar.yml` publishes `site/` as a static Cloudflare Worker named `madar`
(config in `wrangler.toml`) using the repository's existing `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
secrets. It runs on every push that touches the site, or by hand from the Actions tab, and prints the URLs in
the run summary:

- always: `https://madar.<account>.workers.dev`
- when the `raqeem.dev` zone is in the same Cloudflare account: `https://madar.raqeem.dev` (attached by the
  workflow; if the token lacks DNS permission, add it once by hand: Workers & Pages → madar → Settings →
  Domains & Routes → Custom domain).

## Regenerating the video

1. Narration: `video/narration.txt` was read by Gemini TTS (voice `ar-001-advisor-10`, style
   "clear, warm, professional narrator, moderate pace") with the owner's `gemini_tts.py` helper; keep the
   resulting `narration.wav` (24 kHz mono). The scene cue times in `video/src/brief.html` follow the pauses
   of that recording (`ffmpeg -af silencedetect`), so a new recording needs the cues checked.
2. Frames (time-driven `render(t)` in `brief.html`, 1920×1080, 30 fps, 4 parallel pages):
   `node video/src/render.mjs frames 30 0-5895 4`
3. Encode the silent video, then put the narration on it (no music) with the owner's `add_voice.py` helper:
   ```
   ffmpeg -framerate 30 -i frames/f%05d.jpg -c:v libx264 -crf 23 -pix_fmt yuv420p silent.mp4
   python3 add_voice.py --video silent.mp4 --clip narration.wav@0 --mode replace --out video/madar-brief.mp4
   ```
