// The user guide's pages (server/guide/render.ts): the search on the home, the table of contents that follows the
// reading, the pictures' lightbox, copying a section's link, printing. Nothing here is needed to read a page: without
// it the table of contents is plain links and a picture opens its large file. No inline styles (the CSP): classes
// and the hidden attribute only.
(() => {
  'use strict'
  const doc = document
  const root = doc.documentElement
  const rtl = root.dir === 'rtl'
  const lang = root.lang === 'en' ? 'en' : 'ar'

  // pieces that only work with this script
  for (const el of doc.querySelectorAll('[data-js][hidden]')) el.hidden = false

  const typing = (el) => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))

  // ---- the home: search ---------------------------------------------------------------------------------------
  /**
   * Text as the search compares it: no diacritics or tatweel, أ/إ/آ/ٱ → ا, ى → ي, ة → ه, ؤ → و, ئ → ي, Arabic-Indic
   * digits → 0–9, lower case, punctuation → spaces.
   */
  function norm(s) {
    return String(s || '')
      .normalize('NFKD')
      .replace(/[̀-ͯؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
      .replace(/[آأإٱٲٳ]/g, 'ا')
      .replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660))
      .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x6f0))
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
  }
  /** The words of a query; an Arabic word loses its "ال" so "الفاتورة" also finds "فاتورة". */
  const words = q => norm(q).split(' ').filter(Boolean).map(w => (/^ال../.test(w) && w.length > 4 ? w.slice(2) : w))

  const form = doc.querySelector('.gd-search')
  const cardsList = doc.querySelector('.gd-cards')
  if (form && cardsList) {
    const input = form.querySelector('input')
    const clear = form.querySelector('.gd-search-clear')
    const status = doc.getElementById('gd-status')
    const empty = doc.querySelector('.gd-empty')
    const cards = [...cardsList.querySelectorAll('.gd-card')].map(el => ({
      el,
      text: norm(`${el.querySelector('.gd-card-title')?.textContent || ''} ${el.querySelector('.gd-card-sum')?.textContent || ''}`),
      box: el.querySelector('.gd-card-secs'),
      secs: [...el.querySelectorAll('.gd-card-secs li')].map(li => ({ li, text: norm(li.textContent) })),
    }))
    const forms = (status?.dataset.forms || '').split('|')
    const countText = (n) => {
      if (lang === 'en') return n === 1 ? forms[0] : (forms[3] || '').replace('{n}', n)
      if (n === 1) return forms[0]
      if (n === 2) return forms[1]
      return `${n} ${n >= 3 && n <= 10 ? forms[2] : forms[3]}`
    }
    const apply = (q, { fromUser = false } = {}) => {
      const ws = words(q)
      let shown = 0
      for (const c of cards) {
        const all = `${c.text} ${c.secs.map(s => s.text).join(' ')}`
        const hit = !ws.length || ws.every(w => all.includes(w))
        c.el.hidden = !hit
        if (hit) shown++
        // the sections that match, as direct links (all words in the section's title, else any of them)
        let any = false
        if (c.box) {
          const full = ws.length ? c.secs.filter(s => ws.every(w => s.text.includes(w))) : []
          const some = ws.length && !full.length && !ws.every(w => c.text.includes(w)) ? c.secs.filter(s => ws.some(w => s.text.includes(w))) : []
          const pick = new Set((full.length ? full : some).slice(0, 5))
          for (const s of c.secs) s.li.hidden = !pick.has(s)
          any = hit && pick.size > 0
          c.box.hidden = !any
        }
      }
      form.classList.toggle('has-q', !!q)
      if (clear) clear.hidden = !q
      if (empty) empty.hidden = shown > 0
      if (status) status.textContent = ws.length ? countText(shown) : ''
      if (fromUser) {
        // the address carries the search, so it can be sent as a link
        try {
          const url = new URL(location.href)
          if (q.trim()) url.searchParams.set('q', q.trim()); else url.searchParams.delete('q')
          history.replaceState(history.state, '', url)
        } catch { /* a page opened from a file */ }
      }
    }
    input.addEventListener('input', () => apply(input.value, { fromUser: true }))
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      // Enter opens the first result (a matching section first)
      const first = cards.find(c => !c.el.hidden)
      if (!first || !input.value.trim()) return
      const sec = first.box && !first.box.hidden && first.box.querySelector('li:not([hidden]) a')
      const link = sec || first.el.querySelector('.gd-card-title a')
      if (link) location.href = link.href
    })
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && input.value) { e.preventDefault(); input.value = ''; apply('', { fromUser: true }) }
    })
    clear?.addEventListener('click', () => { input.value = ''; apply('', { fromUser: true }); input.focus() })
    doc.addEventListener('keydown', (e) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(doc.activeElement)) { e.preventDefault(); input.focus() }
    })
    const q0 = new URLSearchParams(location.search).get('q')
    if (q0) { input.value = q0; apply(q0) }
  }

  // ---- a topic: the table of contents follows the reading -----------------------------------------------------
  const blocks = [...doc.querySelectorAll('.gd-block[id]')]
  const tocLinks = new Map()
  for (const a of doc.querySelectorAll('.gd-toc-list a[href^="#"]')) {
    const id = decodeURIComponent(a.getAttribute('href').slice(1))
    if (!tocLinks.has(id)) tocLinks.set(id, [])
    tocLinks.get(id).push(a)
  }
  const tocSide = doc.querySelector('.gd-toc-side')
  const headerH = () => (doc.querySelector('.site-header, .legal-top')?.getBoundingClientRect().height || 68)
  let active = null
  function spy() {
    if (!blocks.length) return
    const line = headerH() + Math.min(140, window.innerHeight * 0.25)
    let current = blocks[0]
    for (const b of blocks) { if (b.getBoundingClientRect().top <= line) current = b; else break }
    // at the very bottom, the last block is the one being read
    if (window.innerHeight + window.scrollY >= doc.documentElement.scrollHeight - 4) current = blocks[blocks.length - 1]
    if (current === active) return
    if (active) for (const a of tocLinks.get(active.id) || []) { a.classList.remove('is-active'); a.removeAttribute('aria-current') }
    active = current
    for (const a of tocLinks.get(active.id) || []) {
      a.classList.add('is-active')
      a.setAttribute('aria-current', 'location')
      // keep the active entry in view inside the side column (without moving the page)
      if (tocSide && tocSide.contains(a) && tocSide.scrollHeight > tocSide.clientHeight) {
        const top = a.getBoundingClientRect().top - tocSide.getBoundingClientRect().top + tocSide.scrollTop
        if (top < tocSide.scrollTop + 20 || top > tocSide.scrollTop + tocSide.clientHeight - 60) tocSide.scrollTop = Math.max(0, top - tocSide.clientHeight / 3)
      }
    }
  }
  if (blocks.length) {
    let queued = false
    const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; spy() }) } }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    window.addEventListener('hashchange', onScroll)
    spy()
  }
  // the phone's "On this page" closes once a section is chosen
  const tocM = doc.querySelector('.gd-toc-m')
  tocM?.addEventListener('click', (e) => { if (e.target.closest('a')) tocM.open = false })

  // the topics column shows the current topic (it scrolls on its own on a desktop)
  const side = doc.querySelector('.gd-side')
  const here = side?.querySelector('[aria-current="page"]')
  if (side && here && side.scrollHeight > side.clientHeight) {
    const top = here.getBoundingClientRect().top - side.getBoundingClientRect().top + side.scrollTop
    if (top > side.clientHeight - 60) side.scrollTop = top - side.clientHeight / 3
  }

  // ---- a section's link: copied when its # is clicked ------------------------------------------------------------
  const article = doc.querySelector('.gd-article')
  let toast = null, toastTimer = 0
  function note(text) {
    if (!toast) {
      toast = doc.createElement('p')
      toast.className = 'gd-toast'
      toast.setAttribute('role', 'status')
      doc.body.appendChild(toast)
    }
    toast.textContent = text
    toast.classList.add('is-shown')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => toast.classList.remove('is-shown'), 2200)
  }
  doc.addEventListener('click', (e) => {
    const a = e.target.closest?.('.gd-anchor')
    if (!a || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return
    const url = `${location.origin}${location.pathname}${a.getAttribute('href')}`
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(() => note(article?.dataset.copied || url), () => {})
  })

  // ---- print --------------------------------------------------------------------------------------------------
  for (const b of doc.querySelectorAll('.gd-print')) b.addEventListener('click', () => window.print())

  // ---- pictures: the lightbox ---------------------------------------------------------------------------------
  const zooms = [...doc.querySelectorAll('.gd-zoom')]
  const strings = doc.querySelector('.gd-lb-strings')?.dataset || {}
  if (zooms.length && typeof HTMLDialogElement === 'function' && 'showModal' in HTMLDialogElement.prototype) {
    const SVG = 'http://www.w3.org/2000/svg'
    const svg = (...paths) => {
      const s = doc.createElementNS(SVG, 'svg')
      s.setAttribute('viewBox', '0 0 24 24')
      s.setAttribute('aria-hidden', 'true')
      for (const d of paths) { const p = doc.createElementNS(SVG, 'path'); p.setAttribute('d', d); s.appendChild(p) }
      return s
    }
    const button = (cls, label, icon) => {
      const b = doc.createElement('button')
      b.type = 'button'
      b.className = cls
      b.setAttribute('aria-label', label || '')
      b.appendChild(icon)
      return b
    }
    let dialog = null, img, cap, count, prevBtn, nextBtn, at = 0, opener = null
    function build() {
      dialog = doc.createElement('dialog')
      dialog.className = 'gd-lb'
      dialog.setAttribute('aria-label', strings.zoom || '')
      const inner = doc.createElement('div')
      inner.className = 'gd-lb-in'
      const fig = doc.createElement('figure')
      img = doc.createElement('img')
      img.decoding = 'async'
      cap = doc.createElement('figcaption')
      fig.append(img, cap)
      inner.appendChild(fig)
      count = doc.createElement('p')
      count.className = 'gd-lb-count'
      count.dir = 'ltr'
      const close = button('gd-lb-close', strings.close, svg('M18 6 6 18', 'm6 6 12 12'))
      // "previous" points against the reading direction: right in Arabic, left in English
      prevBtn = button('gd-lb-prev', strings.prev, svg(rtl ? 'm9 18 6-6-6-6' : 'm15 18-6-6 6-6'))
      nextBtn = button('gd-lb-next', strings.next, svg(rtl ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'))
      dialog.append(inner, count, prevBtn, nextBtn, close)
      close.addEventListener('click', () => dialog.close())
      prevBtn.addEventListener('click', () => show(at - 1))
      nextBtn.addEventListener('click', () => show(at + 1))
      // a click outside the picture closes it
      dialog.addEventListener('click', (e) => { if (e.target === dialog || e.target === inner || e.target === fig) dialog.close() })
      dialog.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault()
          const forward = (e.key === 'ArrowLeft') === rtl
          show(at + (forward ? 1 : -1))
        }
      })
      dialog.addEventListener('close', () => {
        img.removeAttribute('src')
        if (opener && doc.contains(opener)) opener.focus()
      })
      doc.body.appendChild(dialog)
    }
    function show(i) {
      at = (i + zooms.length) % zooms.length
      const link = zooms[at]
      const small = link.querySelector('img')
      const figure = link.closest('figure')
      img.src = link.href
      img.alt = small?.alt || ''
      if (link.dataset.w) img.width = Number(link.dataset.w)
      if (link.dataset.h) img.height = Number(link.dataset.h)
      cap.textContent = figure?.querySelector('figcaption')?.textContent?.trim() || ''
      dialog.classList.toggle('is-phone', !!figure?.classList.contains('gd-fig-phone'))
      const many = zooms.length > 1
      prevBtn.hidden = !many
      nextBtn.hidden = !many
      count.hidden = !many
      count.textContent = `${at + 1} / ${zooms.length}`
    }
    zooms.forEach((link, i) => link.addEventListener('click', (e) => {
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return
      e.preventDefault()
      if (!dialog) build()
      opener = link
      show(i)
      dialog.showModal()
      dialog.querySelector('.gd-lb-close').focus()
    }))
  }
})()
