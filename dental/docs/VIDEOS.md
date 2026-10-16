# Video course: the contract between the chapter scripts, the recorder and the website

The website gets a video course (`/videos`, `/en/videos`, one page per chapter at `/videos/<slug>` and
`/en/videos/<slug>`): screen recordings of the real app with the demo clinic, narrated in Arabic and in English by a
synthetic voice, with captions and a transcript, one chapter per area of the app, in the order of the user guide
(`server/guide/`). A clinic that cannot read the guide watches the videos; the seller sends a link instead of
explaining by hand.

Everything is generated from text and code, so a chapter can be re-recorded after any change of the app without a
studio: `node store/scripts/video/make.mjs` (see its header for the options).

## Parts and owners

| Path | What |
|---|---|
| `store/scripts/video/make.mjs`, `store/scripts/video/lib/*.mjs` | the recorder: runs a chapter script in Chromium on the QA build with the demo clinic, synthesises the narration, assembles the video |
| `store/scripts/video/chapters/<slug>.mjs` | one chapter script per chapter (phase 2, written from the guide's topics) |
| `server/videos/types.ts`, `server/videos/index.ts` | the chapter list (slug, order, titles, summaries, guide topic) |
| `server/videos/render.ts`, `server/site/css/videos.css`, `server/site/js/videos.js` | the course pages |
| `server/site/videos/<lang>/<slug>.mp4`, `.vtt`, `.jpg`, `server/site/videos/manifest.json` | the output (git-ignored, like the installer: published, not committed) |
| `server/scripts/fetch-published.mjs` | before a deploy, downloads the big published files (videos, the Windows installer) that this machine does not have, so a deploy never drops them |

## Chapter script (`store/scripts/video/chapters/<slug>.mjs`)

```js
export const chapter = {
  slug: 'patients',                       // = the slug in server/videos/index.ts and the guide topic
  scenes: [
    {
      id: 'open',                         // kebab-case, unique in the chapter
      say: { ar: 'نفتح قائمة المرضى من الشريط الجانبي.', en: 'Open Patients from the sidebar.' },
      run: async ({ page, ui, lang }) => { await ui.click(page.getByRole('link', { name: /المرضى|Patients/ })) },
    },
  ],
}
```

- A scene is one or two spoken sentences and the actions that go with them. The recorder starts the narration and,
  300 ms later, `run`; the scene ends when both the narration (plus a 600 ms pause) and `run` are done. Keep scenes
  short so the picture follows the words.
- `say` is plain text, both languages, the facts and the actions identical. Labels are quoted as the app shows them in
  that language. No markup. Numbers and names the voice should read as in the app.
- `run` gets `{ page, ui, lang, device }`. `ui` (from `lib/ui.mjs`) does what a person would see: `ui.moveTo(locator)`
  glides the visible cursor to the element, `ui.click(locator)` moves then clicks with a ripple, `ui.type(locator, text)`
  clicks then types at a human pace, `ui.highlight(locator, ms)` draws the brand-teal outline for a moment,
  `ui.point(locator, ms)` glides the cursor onto the element and then outlines it (the cursor stays there),
  `ui.scrollTo(locator)`, `ui.pause(ms)`, `ui.callout(text)` shows a short label near the cursor for a moment. Nothing
  else should touch the page (no `page.click` directly: the viewer would not see the cursor move).
- A chapter may add `before: async (ctx) => {}` (set-up done before recording starts, e.g. open a patient),
  `title: { ar, en }` to override the chapter's title card, and `poster: '<scene id>'`: the poster is then the screen at
  the end of that scene (the chapter's own page), so the course home does not show the same dashboard on every card.
- The recorder opens the app signed in with the demo clinic loaded, in the scene's language, at a 1280×720 layout
  rendered at 1920×1080 (device scale 1.5), the clock fixed to the same weekday as the store screenshots, the trial bar
  hidden, the fake cursor shown. Every chapter starts from a fresh demo clinic.

## Output (`server/site/videos/`)

- `<lang>/<slug>.mp4`: H.264 (yuv420p, 30 fps, 1920×1080, crf tuned so a chapter stays under 24 MiB, else the recorder
  lowers the bitrate and warns), AAC mono narration; starts with a 3 s title card (chapter number and title on the brand
  gradient, the logo), ends with a 2 s card naming the next chapter.
- `<lang>/<slug>.vtt`: captions, one cue per sentence, from the synthesiser's sentence boundaries.
- `<lang>/<slug>.jpg`: the poster, 1280×720 (the screen at the end of the chapter's `poster` scene, else the first frame
  of the first scene).
- `manifest.json`: `{ "<lang>/<slug>": { durationSeconds, sizeBytes, width, height, sha256, scenes: [{ id, start, text }] } }`
  (scene starts in seconds, for the transcript with time links).

Narration audio is cached in `$VIDEO_WORK/tts/<sha256 of voice+text>.mp3` so re-recording a chapter does not
re-synthesise unchanged sentences. The voices: Arabic `ar-SY-AmanyNeural`, English `en-US-AndrewMultilingualNeural`
(Microsoft neural voices through `edge-tts`), overridable with `VIDEO_VOICE_AR` / `VIDEO_VOICE_EN`; when that service
is unreachable the recorder says so and stops (no silent fallback to a worse voice).

## Course pages

- `/videos` (`/en/videos`): the course home: intro, the chapters as cards (poster, number, title, duration, summary) in
  order, the total length, a "watch from the start" link.
- `/videos/<slug>`: the chapter: `<video controls playsinline preload="metadata" poster=…>` with the `.vtt` track of the
  page's language (default on), the chapter list beside it (desktop) or under it (phone) with the current one marked,
  previous/next, the transcript (sentences with time links that seek the player), "read this in the guide"
  (`/guide/<slug>`), "need help? WhatsApp". When a chapter's file is not published yet, the page says the video is
  coming and still shows the transcript. Autoplay the next chapter at the end when the viewer turns "play all" on
  (remembered in localStorage, with the watched chapters ticked).
- SEO: title, description, canonical, hreflang, Open Graph `og:video`, JSON-LD `VideoObject` (name, description,
  thumbnailUrl, uploadDate, duration, contentUrl, inLanguage) and `BreadcrumbList`; all in the sitemap.
- Strict CSP (`PUBLIC_CSP`): no inline script or style; `media-src 'self'`. The captions, posters and manifest are
  static files. The `.mp4` files are not: Cloudflare's static file layer answers a `Range` request with the whole file,
  and Safari (iPhone, Mac) plays a video only from a server that answers ranges (every browser also needs them to jump
  ahead). So `build-public.mjs` publishes them under `/files/videos/`, and the Worker answers
  `/videos/<lang>/<slug>.mp4` from the edge cache, which serves ranges itself (SPEC.md).
- Same chrome as the guide and legal pages (header, footer, fonts, colours), RTL/LTR, phone 360 px, keyboard and screen
  reader friendly, print stylesheet that shows the transcript.
