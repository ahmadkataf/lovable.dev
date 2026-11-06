// What the viewer sees happen on the screen: a visible cursor that glides to the elements, a click ripple, typing at a
// human pace, a brand-teal highlight, smooth scrolling and short callout labels. Everything is drawn in one overlay
// element on top of the app (pointer-events: none, re-created after a reload by the context's init script), and every
// helper waits until its motion is over, so a chapter script reads like the steps a person takes:
//   await ui.click(page.getByRole('link', { name: 'المرضى' }))
//   await ui.type(page.locator('input[type="search"]'), 'أحمد')
//   await ui.point(page.locator('.rp-dash-kpis'), 1800)      // the cursor glides onto it, then the teal outline
// The real mouse follows the drawn cursor (hover states look natural) and the clicks are Playwright's own, so an
// element that is covered or detached fails loudly instead of silently clicking something else.

export const OVERLAY_ID = '__dentora-video'
/** The brand teal of the ripple, highlight and callouts (public/icon.svg). */
export const TEAL = '#0E8F86'

/**
 * The page-side part: window.__dv (cursor, ripple, highlight, callout, card). Passed to context.addInitScript() so it
 * exists in every document the context loads; the DOM is made lazily by ensure() and lives under <html>, outside the
 * React root and outside <body> (a dialog that makes body's children inert does not touch it).
 */
export function installOverlay(cfg) {
  const ID = cfg.id, TEAL = cfg.teal, KUFI = cfg.kufi
  const FONT = KUFI ? "'Noto Kufi Arabic Variable', 'Inter Variable', 'Segoe UI', Tahoma, sans-serif" : "'Inter Variable', 'Noto Kufi Arabic Variable', 'Segoe UI', Tahoma, sans-serif"
  const CSS = `
#${ID} { position: fixed; inset: 0; pointer-events: none; z-index: 2147483647; overflow: hidden; direction: ${cfg.dir}; }
#${ID} * { box-sizing: border-box; }
#${ID} .dv-cursor { position: absolute; left: 0; top: 0; width: 28px; height: 34px; margin: -2px 0 0 -3px; will-change: transform;
  transition: transform 600ms cubic-bezier(.45, 0, .25, 1); filter: drop-shadow(0 2px 3px rgba(0,0,0,.45)); }
#${ID} .dv-ripple { position: absolute; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%; background: ${TEAL};
  opacity: .55; animation: dv-ripple 520ms ease-out forwards; }
@keyframes dv-ripple { from { transform: scale(.25); opacity: .6 } to { transform: scale(1.15); opacity: 0 } }
#${ID} .dv-hl { position: absolute; border: 3px solid ${TEAL}; border-radius: 10px; box-shadow: 0 0 0 5px rgba(14,143,134,.22), 0 0 22px rgba(14,143,134,.5);
  opacity: 0; transition: opacity 260ms ease; }
#${ID} .dv-callout { position: absolute; max-width: 360px; padding: 7px 14px; border-radius: 999px; background: ${TEAL}; color: #fff; font: 600 16px/1.5 ${FONT};
  white-space: nowrap; box-shadow: 0 6px 18px rgba(0,0,0,.25); opacity: 0; transform: translateY(6px); transition: opacity 220ms ease, transform 220ms ease; }
#${ID} .dv-card { position: absolute; inset: 0; opacity: 1; transition: opacity 350ms ease; font-family: ${FONT}; }
#${ID} .dv-nudge { position: absolute; left: 0; bottom: 0; width: 1px; height: 1px; background: rgba(0,0,0,.015); }`
  const svg = `<svg class="dv-cursor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 34" width="28" height="34">
  <path d="M3 2 L3 26 L9.5 20.5 L13.5 31 L18 29 L14 18.5 L23 18.5 Z" fill="#fff" stroke="#1a1a1a" stroke-width="2" stroke-linejoin="round"/></svg>`
  const dv = {
    pos: { x: cfg.x, y: cfg.y },
    root() { return document.getElementById(ID) },
    /** Creates the overlay if the document lost it (a reload), the cursor at the last known position. */
    ensure(pos) {
      if (pos) dv.pos = pos
      let root = dv.root()
      if (root) return
      root = document.createElement('div')
      root.id = ID
      root.innerHTML = `<style>${CSS}</style>${svg}<div class="dv-layer"></div><div class="dv-nudge"></div>`
      document.documentElement.appendChild(root)
      const c = root.querySelector('.dv-cursor')
      c.style.transitionDuration = '0ms'
      c.style.transform = `translate(${dv.pos.x}px, ${dv.pos.y}px)`
      void c.getBoundingClientRect()
      c.style.transitionDuration = ''
    },
    /** Glides the cursor to (x, y) in `ms`. */
    moveTo(x, y, ms) {
      dv.ensure()
      const c = dv.root().querySelector('.dv-cursor')
      c.style.transitionDuration = `${ms}ms`
      c.style.transform = `translate(${x}px, ${y}px)`
      dv.pos = { x, y }
    },
    ripple(x, y) {
      dv.ensure()
      const r = document.createElement('div')
      r.className = 'dv-ripple'
      r.style.left = `${x}px`; r.style.top = `${y}px`
      dv.root().querySelector('.dv-layer').appendChild(r)
      setTimeout(() => r.remove(), 700)
    },
    /** A teal outline around `rect` ({ x, y, width, height }) that fades after `ms`. */
    highlight(rect, ms) {
      dv.ensure()
      const h = document.createElement('div')
      h.className = 'dv-hl'
      h.style.left = `${rect.x - 5}px`; h.style.top = `${rect.y - 5}px`
      h.style.width = `${rect.width + 10}px`; h.style.height = `${rect.height + 10}px`
      dv.root().querySelector('.dv-layer').appendChild(h)
      requestAnimationFrame(() => { h.style.opacity = '1' })
      setTimeout(() => { h.style.opacity = '0'; setTimeout(() => h.remove(), 300) }, ms)
    },
    /** A label near the cursor, on the reading side of it (right in LTR, left in RTL) unless it would leave the screen. */
    callout(text, ms) {
      dv.ensure()
      const b = document.createElement('div')
      b.className = 'dv-callout'
      b.textContent = text
      const layer = dv.root().querySelector('.dv-layer')
      layer.appendChild(b)
      const w = b.offsetWidth, h = b.offsetHeight, W = window.innerWidth, H = window.innerHeight
      const { x, y } = dv.pos
      const rtl = cfg.dir === 'rtl'
      let left = rtl ? x - 14 - w : x + 26
      if (left < 8 || left + w > W - 8) left = rtl ? x + 26 : x - 14 - w
      left = Math.max(8, Math.min(W - w - 8, left))
      let top = y + 30
      if (top + h > H - 8) top = y - h - 14
      b.style.left = `${left}px`; b.style.top = `${top}px`
      requestAnimationFrame(() => { b.style.opacity = '1'; b.style.transform = 'translateY(0)' })
      setTimeout(() => { b.style.opacity = '0'; b.style.transform = 'translateY(6px)'; setTimeout(() => b.remove(), 300) }, ms)
    },
    /** A full-screen card (title / end card) over everything, the cursor included; `html` replaces the previous one. */
    card(html) {
      dv.ensure()
      dv.uncard(0)
      const c = document.createElement('div')
      c.className = 'dv-card'
      c.innerHTML = html
      dv.root().appendChild(c)
    },
    /** Fades the card out over `ms` and removes it. */
    uncard(ms) {
      const c = dv.root()?.querySelector('.dv-card')
      if (!c) return
      if (!ms) { c.remove(); return }
      c.style.transitionDuration = `${ms}ms`
      c.style.opacity = '0'
      setTimeout(() => c.remove(), ms + 50)
    },
    /** Changes one almost invisible pixel: the compositor produces a frame even when the page is idle. */
    nudge() {
      dv.ensure()
      const n = dv.root().querySelector('.dv-nudge')
      n.style.background = n.style.background.includes('.015') ? 'rgba(0,0,0,.02)' : 'rgba(0,0,0,.015)'
    },
  }
  window.__dv = dv
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

/**
 * The helpers a chapter script gets as `ui`. `page` is the Playwright page of a context that had
 * installOverlay() added as an init script (lib/clinic.mjs does it). Every method takes a Locator (or a selector).
 */
export function createUi(page, { lang = 'ar' } = {}) {
  let pos = { x: 640, y: 420 }           // the last cursor position, re-applied when a reload lost the overlay
  const loc = l => (typeof l === 'string' ? page.locator(l) : l)
  const ensure = () => page.evaluate(p => window.__dv.ensure(p), pos)

  /** The element's centre in viewport pixels, scrolling it into view (smoothly) first when it is off-screen. */
  async function centre(locator) {
    const l = loc(locator).first()
    await l.waitFor({ state: 'visible', timeout: 10000 })
    const vp = page.viewportSize()
    let box = await l.boundingBox()
    if (!box) throw new Error('the element has no box (hidden?)')
    const visible = box.y >= 0 && box.x >= 0 && box.y + box.height <= vp.height && box.x + box.width <= vp.width
    if (!visible) { await scrollTo(l); box = await l.boundingBox() }
    return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2), box }
  }

  /** Glides the cursor to the element (500–700 ms by distance) and parks the real mouse there. */
  async function moveTo(locator, { ms } = {}) {
    await ensure()
    const { x, y } = await centre(locator)
    const dist = Math.hypot(x - pos.x, y - pos.y)
    const duration = ms ?? Math.round(Math.min(700, 500 + dist / 6))
    await page.evaluate(([x, y, ms]) => window.__dv.moveTo(x, y, ms), [x, y, duration])
    pos = { x, y }
    await page.mouse.move(x, y, { steps: 4 })
    await sleep(duration + 60)
  }

  /** moveTo, a ripple, then Playwright's own click (it waits for the element to be ready and fails if it is covered). */
  async function click(locator, options = {}) {
    await moveTo(locator)
    await page.evaluate(p => window.__dv.ripple(p.x, p.y), pos)
    await loc(locator).first().click({ timeout: 10000, ...options })
    await sleep(160)
  }

  /** Clicks the field and types at a human pace (60–90 ms per character). */
  async function type(locator, text, { delay = 75 } = {}) {
    await click(locator)
    await loc(locator).first().pressSequentially(text, { delay })
    await sleep(120)
  }

  /** The brand-teal outline around the element for `ms` (the helper waits that long). */
  async function highlight(locator, ms = 1500) {
    await ensure()
    const { box } = await centre(locator)
    await page.evaluate(([r, ms]) => window.__dv.highlight(r, ms), [{ x: box.x, y: box.y, width: box.width, height: box.height }, ms])
    await sleep(ms + 320)
  }

  /** moveTo then highlight: the cursor glides onto the element and stays there while the outline shows for `ms`. */
  async function point(locator, ms = 1500) {
    await moveTo(locator)
    await highlight(locator, ms)
  }

  /** Smooth-scrolls the element to the middle of its scroll container and waits until it stops moving. */
  async function scrollTo(locator, { block = 'center' } = {}) {
    const l = loc(locator).first()
    await l.waitFor({ state: 'attached', timeout: 10000 })
    await l.evaluate((el, block) => el.scrollIntoView({ behavior: 'smooth', block, inline: 'nearest' }), block)
    let last = null
    for (let i = 0; i < 40; i++) {
      await sleep(80)
      const b = await l.boundingBox()
      const key = b && `${Math.round(b.x)},${Math.round(b.y)}`
      if (key && key === last) break
      last = key
    }
    await sleep(120)
  }

  async function pause(ms) { await sleep(ms) }

  /** A short label next to the cursor for `ms` (Kufi for Arabic). */
  async function callout(text, { ms = 1800 } = {}) {
    await ensure()
    await page.evaluate(([t, ms]) => window.__dv.callout(t, ms), [text, ms])
    await sleep(ms + 320)
  }

  return { ensure, moveTo, click, type, highlight, point, scrollTo, pause, callout, get position() { return pos }, lang }
}

/** The init-script argument for installOverlay(): the overlay's language, direction and the cursor's first position. */
export function overlayConfig(lang, { x = 640, y = 420 } = {}) {
  return { id: OVERLAY_ID, teal: TEAL, kufi: lang === 'ar', dir: lang === 'ar' ? 'rtl' : 'ltr', x, y }
}
