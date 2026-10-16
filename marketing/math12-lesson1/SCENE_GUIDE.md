# Scene authoring guide

The video is the page `lesson.html` rendered frame by frame (1920×1080, 30 fps) by `render.mjs`.
`timeline.js` (generated from `script.json` by `python3 build.py timeline`) gives every scene and
every narration line its start/end time. Each scene lives in its own file `scenes/<id>.js`.

```js
scene('s05', {
  build(root, S) {          // once, after fonts load. root = full-stage div (1920×1080), laid out & untransformed
    this.title = rich('…', 'h2'); root.appendChild(this.title); place(this.title, 1800, 160, { anchor: 'tr' })
    this.f = tex('u_{n+1} = f(u_n)', 'ml'); root.appendChild(this.f); place(this.f, 960, 540, { anchor: 'c' })
    this.box = hlBox(this.f, root)          // measuring helpers work here (layout is ready)
  },
  render(lt, S) {           // every frame. lt = seconds since the scene started
    rise(this.title, S.p(lt, 0))            // animate when line 0 starts
    wipe(this.f, S.p(lt, 1, .3, 1.2), 'ltr')// write the formula 0.3 s after line 1 starts, over 1.2 s
    this.box(S.p(lt, 2, .5))                // highlight it 0.5 s into line 2
  },
})
```

## Hard rules
1. **Pure function of time.** `render(lt)` must set every animated property from `lt` alone. Frames are
   rendered out of order and in parallel; no state carried between frames, no CSS transitions/animations,
   no `Date`, no `Math.random` (use a fixed seed or index-based values).
2. **Cue to lines, never to absolute seconds.** Line durations change when the real voice is generated.
   Use `S.at(i)` (start of line i, scene-local), `S.end(i)`, `S.p(lt, i, delay, dur, ease)` (eased 0→1
   progress of an animation that starts `delay` s after line i starts) and `S.f(lt, i, a, b)` (how far the
   narrator is through line i, for things that should follow the speech). `S.dur` = scene length.
   The narration of line i is in `S.lines[i].text`; what the screen must show is in `script.json` → `screen`.
3. Only edit your own `scenes/<id>.js`. Do **not** edit `lib.js`, `main.js`, `lesson.html` or other scenes.
   If you need a helper, define it inside your file (inside the `scene(...)` object or an IIFE — no new globals).
4. Element ids inside KaTeX (`\htmlId{…}`) must be prefixed with your scene id (`s05-lhs`) — the page is shared.
5. Every line must produce a visible change on screen when it starts (new element, highlight, transform…),
   and what is on screen must match what is being said at that moment.

## Stage, layout, type
- Stage 1920×1080. **Safe content area: x 120–1800, y 140–990.** Top 0–120 is the chrome (breadcrumb +
  book page chip), bottom 1000–1080 is the progress bar. Never put content there.
- Arabic text is RTL and right-aligned: anchor Arabic blocks on the right (`place(e, 1800, y, {anchor:'tr', w})`).
  Maths is LTR (KaTeX elements are `<bdi class="m">`, already LTR, nowrap). Mixed text: `rich('… $u_n$ …', cls)`.
- Text classes: `h1` 96px · `h2` 64px · `h3` 46px · `p` 40px · `s` 32px (muted). Math classes:
  `ms` 38 · `mm` 48 · `mx` 64 · `ml` 80 · `mxl` 110. Colour classes: `yel pur grn red blu org mute`, `b` = bold.
- Max ~25 Arabic words on screen at once. Big, few, clear. The narration explains; the screen anchors.
- Colours by role (`C.yel` etc.): yellow = look here now; purple = definitions; green = correct/increasing;
  red/pink = decreasing/warning; blue = indices/secondary; muted = context. In KaTeX: `\textcolor{#ffd23f}{…}`.
- Keep the board clean: when a beat is over, fade/move the old content out (`op(e, 1 - S.p(lt, k))`, or
  shrink it to a corner) before the next thing comes in. No overlaps.

## lib.js reference (globals)
- Timing: `clamp, lerp, prog(t,t0,d,ease), env(t,a,b,fi,fo)`, easings `E.lin E.io E.out E.in E.expo E.back E.sine`.
- DOM: `el(tag, cls, html, parent)`, `place(e, x, y, {w, h, anchor})` anchors `tl tc tr cl c cr bl bc br`
  (uses CSS `translate`, so `transform` stays free for animation).
- Content: `tex(latex, cls='mx', display=false)`, `rich(str, cls='p')`, `splitWords(e)` + `typeWords(e, p)`.
- Animate: `op(e,v)`, `rise(e,p,dy)`, `drop`, `slide(e,p,dx)`, `pop(e,p)`, `zoom(e,s)`, `wipe(e,p,'ltr'|'rtl'|'ttb'|'btt')`,
  `swap(a,b,p)`, `color(e,c)`, `mixColor(c1,c2,p)`. (They set `opacity`/`transform`/`clip-path`; if you need
  to combine, set `e.style.transform` yourself.)
- Measure (in build only): `rectIn(target, root)`, `hlBox(target, root, {pad,color})` → setter(p),
  `hlBg(target, root, {color})` → setter(p), `underline(target, root, {color, dir})` → setter(p).
- Consistency helpers (use them — every scene must look like part of one video):
  `heading(root, html, {y, cls, color})` → `{el, set(p)}`: the scene title, always top-right at y≈150;
  `keyBox(root, latex, x, y, {anchor, color, label, cls})` → `{el, f, set(p)}`: framed box for every result worth remembering.
- Components: `card(root, type, x, y, w, {anchor, tag, h})` → `{el, body}` with types `def tip think ex warn exam`;
  `chip(root, html, x, y, {anchor, color})`; `counter(e, a, b, p, fmt)`; `countdown(root, x, y, r, label)` →
  setter(p, secondsLeft); `bookThumb(root, page, x, y, w, {x,y,w,h})` (page 6–11, highlight in page fractions);
  `table(root, rows, x, y, {headRow, headCol, anchor})` → `{el, cells}`.
- SVG: `svg(root,x,y,w,h)`, `sv(parent, tag, attrs)`, `draw(path, p)` (draw-on stroke), `arrow(svg,x1,y1,x2,y2,{color,width,bend})` →
  `{path, set(p)}`, `plot(root, x, y, w, h, {xmin,xmax,ymin,ymax,pad})` → `{X, Y, s, layer, dot(), label(html,vx,vy,anchor,cls), xAxis, yAxis}`.
- Constants: `W, H, C` (colours).

Look at the two example scenes in `scenes/_examples/` (odd-number dot squares; definition card) for style.

## Check your work (mandatory)
```
python3 build.py timeline --estimate          # only if timeline.js is missing
node render.mjs --scene s05 <dir>             # stills at start/middle/end of every line + scene end
node render.mjs --scene s05 <dir> --every 1   # one still per second
```
Open **every** still with the Read tool and fix: overlaps, text outside the safe area, clipped or wrapped
formulas, wrong reading order, unreadable contrast, red KaTeX error text, content that does not match what
the narrator says at that moment, empty or static stretches, anything ugly. Also fix any `pageerror`/`console`
error the renderer prints for your scene. Iterate until every still looks like a premium explainer video.
