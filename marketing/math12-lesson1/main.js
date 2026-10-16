// Loads scenes/<id>.js for every scene in the timeline, builds them, and exposes render(t).
const stage = document.getElementById('stage')
const FADE_IN = .5, FADE_OUT = .4
const BRAND = ''            // optional platform name shown bottom-left (empty = hidden)
const SHOW_SUBS = new URLSearchParams(location.search).has('sub')
const built = []

function loadScript(src) {
  return new Promise(res => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { console.warn('missing ' + src); res() }; document.body.appendChild(s) })
}

function ctx(sc) {
  const L = sc.lines
  const at = i => (L[i] ? L[i].start - sc.start : Infinity)
  const end = i => (L[i] ? L[i].end - sc.start : Infinity)
  return {
    lines: L, dur: sc.end - sc.start, at, end,
    // eased progress of an animation starting `delay` s after line i starts
    p: (lt, i, delay = 0, d = .6, ease = E.io) => prog(lt, at(i) + delay, d, ease),
    // fraction of line i elapsed (0 at its start, 1 at its end) — for animations that follow the speech
    f: (lt, i, a = 0, b = 1) => clamp(((lt - at(i)) / Math.max(.01, end(i) - at(i)) - a) / (b - a)),
  }
}

window.READY = (async () => {
  await document.fonts.ready
  for (const sc of TL.scenes) await loadScript(`scenes/${sc.id}.js`)
  // chrome: progress ticks at scene boundaries where the section changes
  const bar = document.getElementById('bar')
  let prev = null
  for (const sc of TL.scenes) {
    if (prev !== null && sc.section !== prev) { const t = el('div', 'tick', null, bar); t.style.right = (sc.start / TL.total * 100) + '%' }
    prev = sc.section
  }
  document.getElementById('brand').textContent = BRAND
  for (const sc of TL.scenes) {
    const def = SCENES[sc.id]
    const root = el('div', 'scene', null, stage)
    root.dataset.id = sc.id
    root.style.display = 'block'
    const S = ctx(sc)
    if (def && def.build) {
      try { def.build(root, S) } catch (e) { console.error(sc.id, e); el('div', 'h2 abs', `⚠ ${sc.id}: ${e.message}`, root).style.cssText += 'left:200px;top:400px;color:#ff5c8a' }
    } else {
      // placeholder for scenes not built yet: show the on-screen description of each line
      const box = el('div', 'abs ar', null, root); place(box, 160, 200, { w: 1600 })
      el('div', 'h3 yel', sc.id + ' · ' + sc.section, box)
      S._ph = sc.lines.map(l => el('div', 's', l.screen || l.text, box))
    }
    root.style.display = 'none'
    built.push({ sc, def, root, S })
  }
  await Promise.all([...document.images].map(i => i.decode().catch(() => {})))
  return true
})()

function render(t) {
  // background drift
  const g1 = document.getElementById('gl1'), g2 = document.getElementById('gl2')
  g1.style.transform = `translate(${1100 + Math.sin(t * .07) * 260}px, ${-200 + Math.cos(t * .05) * 160}px)`
  g2.style.transform = `translate(${-100 + Math.cos(t * .06) * 220}px, ${450 + Math.sin(t * .045) * 150}px)`
  document.getElementById('grid').style.transform = `translate(${(t * 6) % 80}px, ${(t * 3) % 80}px)`
  let cur = null
  for (const b of built) {
    const { sc, def, root, S } = b
    const on = t >= sc.start && t < sc.end
    if (!on) { if (root.style.display !== 'none') root.style.display = 'none'; continue }
    cur = b
    root.style.display = 'block'
    const lt = t - sc.start
    const a = Math.min(prog(lt, 0, FADE_IN, E.out), 1 - prog(lt, S.dur - FADE_OUT, FADE_OUT, E.in))
    const last = sc === TL.scenes[TL.scenes.length - 1]
    root.style.opacity = last ? Math.min(1, prog(lt, 0, FADE_IN, E.out)) : a
    root.style.transform = `translateY(${(1 - prog(lt, 0, FADE_IN, E.out)) * 24}px)`
    if (def && def.render) {
      try { def.render(lt, S) } catch (e) { if (!b.err) { b.err = 1; console.error(`${sc.id} render: ${e.message}`) } }
    } else if (S._ph) S._ph.forEach((e, i) => op(e, lt >= S.at(i) ? 1 : .25))
  }
  // chrome
  const sec = document.getElementById('sec'), pg = document.getElementById('pg')
  if (cur) {
    const sc = cur.sc
    if (sec.textContent !== sc.section) sec.textContent = sc.section
    const ph = sc.bookPage ? `<span>📖 الكتاب</span><span class="box">ص ${sc.bookPage}</span>` : ''
    if (pg.innerHTML !== ph) pg.innerHTML = ph
    const lt = t - sc.start
    sec.style.opacity = prog(lt, 0, .5)
    const chromeHide = sc.chrome === false
    document.getElementById('top').style.opacity = chromeHide ? 0 : 1
    if (SHOW_SUBS) {
      const sub = document.getElementById('sub'); sub.style.display = 'block'
      const ln = sc.lines.find(l => t >= l.start && t < l.end + .3)
      sub.textContent = ln ? ln.text : ''
    }
  }
  document.getElementById('barfill').style.width = (t / TL.total * 100) + '%'
}
