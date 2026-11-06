// The video course pages (/videos, /videos/<slug> and /en/…; server/videos/render.ts): the time links of the
// transcript seek the player, "play all" goes on to the next chapter when a video ends (remembered in localStorage,
// with the watched chapters ticked in the chapter lists), keyboard shortcuts, and the transcript line of the moment
// highlighted. The pages work without this script: native controls, plain links (a time link reloads the page at
// ?t=), no toggle. Elements marked data-js are shown only once it runs.
(() => {
  const PLAY_ALL = 'dentora.videos.playAll', WATCHED = 'dentora.videos.watched'
  // localStorage may be off (private mode, storage full): then nothing is remembered, nothing breaks
  const store = {
    get(k) { try { return localStorage.getItem(k) } catch { return null } },
    set(k, v) { try { localStorage.setItem(k, v) } catch { /* forgotten */ } },
  }
  const watched = () => {
    try { const v = JSON.parse(store.get(WATCHED) || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [] } catch { return [] }
  }

  // ---- ticks: every card or list item of a watched chapter (the home page and the chapter list) -------------------
  function tick() {
    const done = new Set(watched())
    for (const list of document.querySelectorAll('[data-watched-label]')) {
      const label = list.getAttribute('data-watched-label') || ''
      for (const el of list.querySelectorAll('[data-slug]')) {
        const is = done.has(el.getAttribute('data-slug'))
        el.classList.toggle('is-watched', is)
        let sr = el.querySelector('.vc-watched-sr')
        if (is && !sr) {
          sr = document.createElement('span')
          sr.className = 'sr-only vc-watched-sr'
          sr.textContent = ` (${label})`
          ;(el.querySelector('.vc-item-title, .vc-card-title a') || el).append(sr)
        } else if (!is && sr) sr.remove()
      }
    }
  }
  function markWatched(slug) {
    const w = watched()
    if (w.includes(slug)) return
    w.push(slug)
    store.set(WATCHED, JSON.stringify(w.slice(-200)))
    tick()
  }

  document.documentElement.classList.add('js')
  for (const el of document.querySelectorAll('[data-js]')) el.hidden = false
  tick()

  // ?autoplay=1 is how "play all" arrives on the next chapter; the address is cleaned at once, so a reload or a
  // shared link does not start by itself (also on a chapter without a video yet)
  const params = new URLSearchParams(location.search)
  const autoplay = params.get('autoplay') === '1'
  if (params.has('autoplay')) {
    params.delete('autoplay')
    const rest = [...params].length ? `?${params}` : ''
    try { history.replaceState(null, '', location.pathname + rest + location.hash) } catch { /* ignore */ }
  }

  const player = document.getElementById('player')
  const video = player && player.querySelector('video')
  if (!video) return   // the home page, or a chapter not recorded yet
  const slug = player.getAttribute('data-slug') || ''
  const next = player.getAttribute('data-next')
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

  // ---- play all ---------------------------------------------------------------------------------------------------
  const playAll = () => store.get(PLAY_ALL) === '1'
  const toggle = document.getElementById('vc-playall')
  if (toggle) {
    toggle.checked = playAll()
    toggle.addEventListener('change', () => store.set(PLAY_ALL, toggle.checked ? '1' : '0'))
  }

  // the chapter list keeps the current chapter in view: scrolled inside its own box only (a strip on a phone, a
  // column on a desktop), never the page
  const current = document.querySelector('.vc-item.is-current')
  const box = current && current.closest('.vc-items')
  if (box) {
    const r = current.getBoundingClientRect(), b = box.getBoundingClientRect()
    if (box.scrollWidth > box.clientWidth + 1) box.scrollLeft += (r.left + r.width / 2) - (b.left + b.width / 2)
    else if (box.scrollHeight > box.clientHeight + 1) box.scrollTop += (r.top + r.height / 2) - (b.top + b.height / 2)
  }

  // ---- seeking: the time links, ?t= of a shared link, the autoplay of "play all" -----------------------------------
  const seek = (t, play) => {
    const go = () => { video.currentTime = t; if (play) video.play().catch(() => {}) }
    if (video.readyState >= 1) go(); else video.addEventListener('loadedmetadata', go, { once: true })
  }
  for (const a of document.querySelectorAll('.vc-time[data-t]')) {
    a.addEventListener('click', e => {
      e.preventDefault()
      seek(Number(a.getAttribute('data-t')) || 0, true)
      player.scrollIntoView({ block: 'start', behavior: reduced ? 'instant' : 'smooth' })
    })
  }
  const t = Number(params.get('t'))
  if (t > 0) seek(t, false)
  if (autoplay && playAll()) video.play().catch(() => {})

  // ---- watched, the transcript line of the moment, the next chapter -------------------------------------------------
  const lines = [...document.querySelectorAll('.vc-line[data-start]')].map(li => ({
    li, start: Number(li.getAttribute('data-start')) || 0, end: Number(li.getAttribute('data-end')) || Infinity,
  }))
  let active = null
  video.addEventListener('timeupdate', () => {
    const now = video.currentTime
    if (video.duration && now / video.duration >= 0.9) markWatched(slug)
    const line = lines.find(l => now >= l.start && now < l.end) || null
    if (line === active) return
    if (active) { active.li.classList.remove('is-active'); active.li.removeAttribute('aria-current') }
    active = line
    if (active) { active.li.classList.add('is-active'); active.li.setAttribute('aria-current', 'true') }
  })
  video.addEventListener('ended', () => {
    markWatched(slug)
    if (next && playAll()) location.assign(`${next}?autoplay=1`)
  })

  // ---- keyboard: by physical key, so an Arabic layout works the same --------------------------------------------
  const editable = el => el instanceof HTMLElement && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName))
  function fullscreen() {
    if (document.fullscreenElement) { if (document.exitFullscreen) document.exitFullscreen().catch(() => {}); return }
    if (video.requestFullscreen) video.requestFullscreen().catch(() => {})
    else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen()
  }
  function captions() {
    const track = video.textTracks && video.textTracks[0]
    if (track) track.mode = track.mode === 'showing' ? 'hidden' : 'showing'
  }
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || editable(e.target)) return
    const code = e.code || ''
    const key = code === 'Space' ? ' ' : /^Key[A-Z]$/.test(code) ? code.slice(3).toLowerCase() : String(e.key || '').toLowerCase()
    // space on a link, a button or the player's own controls does its own thing already
    if (key === ' ' && (e.target === video || (e.target instanceof HTMLElement && e.target.closest('a, button, summary, label, [role="button"]')))) return
    switch (key) {
      case ' ': case 'k': e.preventDefault(); if (video.paused) video.play().catch(() => {}); else video.pause(); break
      case 'j': e.preventDefault(); video.currentTime = Math.max(0, video.currentTime - 10); break
      case 'l': e.preventDefault(); video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10); break
      case 'f': e.preventDefault(); fullscreen(); break
      case 'c': e.preventDefault(); captions(); break
    }
  })
})()
