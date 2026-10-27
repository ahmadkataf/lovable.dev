// Paper parts for the stop-motion ad. Each returns a piece (engine.js) whose state follows the snapped time.
'use strict'

const W = 1080, H = 1920
const offscreen = { left: [-700, 0], right: [W + 700, 0], top: [0, -1200], bottom: [0, H + 1200] }

/** in → rest → out timing for a piece that slides onto the desk and later leaves (or is covered). */
function slide(tq, at, from, to, enter = 0.5, leave = null, leaveTo = null) {
  if (tq < at) return null
  let k = prog(tq, at, enter, ease.back)
  let x = lerp(from.x, to.x, k), y = lerp(from.y, to.y, k), r = lerp(from.r ?? 0, to.r ?? 0, k)
  let moving = k < 1
  if (leave !== null && tq >= leave) {
    const q = prog(tq, leave, 0.42, ease.in)
    if (q >= 1) return null
    const lt = leaveTo || { x: to.x, y: H + 1400, r: (to.r ?? 0) + 18 }
    x = lerp(to.x, lt.x, q); y = lerp(to.y, lt.y, q); r = lerp(to.r ?? 0, lt.r ?? 0, q); moving = true
  }
  return { x, y, r, amp: moving ? 0.4 : 1 }
}

/** A printed photo with a white border, a soft shadow and two strips of tape. */
function photoPrint(id, src, o) {
  const tapes = o.tape === false ? '' : '<i class="tape tl"></i><i class="tape br"></i>'
  return piece(id, `<div class="print" style="width:${o.w}px;height:${o.h}px"><img src="${src}" style="object-position:${o.pos || 'center'}"></div>${tapes}`, 'p-print',
    (tq) => {
      const s = slide(tq, o.at, o.from, o.to, o.enter ?? 0.5, o.leave ?? null, o.leaveTo ?? null)
      if (!s) return null
      return { ...s, s: o.s ?? 1, z: o.z ?? 20, extra: (el) => {
        // tape lands a beat after the print settles
        const on = tq >= o.at + (o.enter ?? 0.5) + 1 / POSES
        el.querySelectorAll('.tape').forEach((t) => (t.style.opacity = on ? '1' : '0'))
      } }
    })
}

/**
 * A caption: words cut from paper, laid down one by one (right to left, Arabic order). style: 'white' (wine words on
 * white paper) or 'wine' (white words on wine paper). Words have no diacritics.
 */
function caption(id, text, o) {
  const words = text.split(/\s+/).filter(Boolean)
  const r0 = rand(id, 0)
  const spans = words.map((w, i) => {
    const r = rand(id + ':' + i, 1)
    const rot = ((r() - 0.5) * 5).toFixed(2)
    const clip = `polygon(${(r() * 4).toFixed(1)}% ${(r() * 8).toFixed(1)}%, ${(100 - r() * 4).toFixed(1)}% ${(r() * 6).toFixed(1)}%, ${(100 - r() * 3).toFixed(1)}% ${(100 - r() * 8).toFixed(1)}%, ${(r() * 3).toFixed(1)}% ${(100 - r() * 6).toFixed(1)}%)`
    return `<span class="w ${o.style || 'white'}" data-i="${i}" style="--rot:${rot}deg;clip-path:${clip}">${w}</span>`
  }).join('')
  const gap = o.wordGap ?? 0.16
  return piece(id, `<div class="cap" style="font-size:${o.size || 84}px;max-width:${o.maxW || 940}px">${spans}</div>`, 'p-cap',
    (tq) => {
      if (tq < o.at) return null
      if (o.leave !== undefined && tq >= o.leave + 0.42) return null
      let y = o.y, x = o.x ?? W / 2, r = o.r ?? (r0() - 0.5) * 2
      if (o.leave !== undefined && tq >= o.leave) { const q = prog(tq, o.leave, 0.42, ease.in); x = lerp(x, x + (o.leaveDx ?? -1300), q) }
      return { x, y, r, z: o.z ?? 40, extra: (el) => {
        el.querySelectorAll('.w').forEach((s) => {
          const i = +s.dataset.i, t0 = o.at + i * gap
          if (tq < t0) { s.style.visibility = 'hidden'; return }
          s.style.visibility = 'visible'
          const k = clamp((tq - t0) * POSES)       // pose 0 → big, pose 1 → overshoot, pose 2+ → rest
          const sc = k < 1 ? 1.25 : (tq - t0) < 2 / POSES ? 0.94 : 1
          s.style.transform = `rotate(var(--rot)) scale(${sc})`
        })
      } }
    })
}

/** The FOCUS switch from the hall wall, in paper: the knob jumps OFF → ON in three poses at `on`. */
function focusSwitch(id, o) {
  return piece(id, `<div class="switch"><div class="sw-word">FOCUS</div><div class="sw-track"><span class="sw-on">ON</span><span class="sw-off">OFF</span><i class="sw-knob"></i></div></div>`, 'p-switch',
    (tq) => {
      const s = slide(tq, o.at, o.from, o.to, 0.5, o.leave ?? null, o.leaveTo ?? null)
      if (!s) return null
      return { ...s, s: o.s ?? 1, z: o.z ?? 30, extra: (el) => {
        const k = clamp(Math.floor((tq - o.on) * POSES) / 3)    // 0, 1/3, 2/3, 1: three hand moves
        el.querySelector('.sw-knob').style.setProperty('--k', String(tq < o.on ? 0 : k))
        el.classList.toggle('is-on', tq >= o.on + 3 / POSES)
      } }
    })
}

/** A square wooden frame (the "box" from the wall) that tilts in steps. */
function woodFrame(id, o) {
  return piece(id, `<div class="frame" style="width:${o.size}px;height:${o.size}px"></div>`, 'p-frame',
    (tq) => {
      const s = slide(tq, o.at, o.from, o.to, 0.5, o.leave ?? null, o.leaveTo ?? null)
      if (!s) return null
      const tilt = o.tiltAt !== undefined ? lerp(0, o.tilt, prog(tq, o.tiltAt, o.tiltDur ?? 0.6, ease.inOut)) : 0
      return { ...s, r: s.r + tilt, z: o.z ?? 45 }
    })
}

/** A paper clock: the hour hand steps from `from` to `to` o'clock; a sun and a moon swap on the face. */
function paperClock(id, o) {
  return piece(id, `<div class="clock"><div class="c-face">${[...Array(12)].map((_, i) => `<i class="tick" style="--a:${i * 30}deg"></i>`).join('')}<i class="hand h"></i><i class="hand m"></i><i class="pin"></i></div></div>`, 'p-clock',
    (tq) => {
      const s = slide(tq, o.at, o.fromPos, o.to, 0.5, o.leave ?? null, o.leaveTo ?? null)
      if (!s) return null
      return { ...s, z: o.z ?? 30, extra: (el) => {
        const k = prog(tq, o.spinAt, o.spinDur, (x) => x)
        const hours = lerp(o.from, o.to24, k)
        el.querySelector('.h').style.transform = `rotate(${(hours % 12) * 30}deg)`
        el.querySelector('.m').style.transform = `rotate(${(hours * 360) % 360}deg)`
      } }
    })
}

/** A paper phone with the real booking screen. */
function paperPhone(id, src, o) {
  return piece(id, `<div class="phone"><div class="ph-screen"><img src="${src}"></div><i class="ph-notch"></i></div>`, 'p-phone',
    (tq) => { const s = slide(tq, o.at, o.from, o.to, 0.55, o.leave ?? null, o.leaveTo ?? null); return s && { ...s, z: o.z ?? 30, s: o.s ?? 1 } })
}

/** A sticky note / paper tag with free HTML. */
function paperTag(id, html, o) {
  return piece(id, `<div class="tag ${o.cls || ''}">${html}</div>`, 'p-tag',
    (tq) => { const s = slide(tq, o.at, o.from, o.to, o.enter ?? 0.45, o.leave ?? null, o.leaveTo ?? null); return s && { ...s, z: o.z ?? 35, s: o.s ?? 1 } })
}

Object.assign(window, { W, H, offscreen, slide, photoPrint, caption, focusSwitch, woodFrame, paperClock, paperPhone, paperTag })

/** The end card: a wine panel like the wall sign; the two halves of the mark arrive separately, then FOCUS / POINT. */
function logoCard(id, o) {
  const mark = `<svg viewBox="36 20 28 60" class="lg-mark">
    <path class="lg-a" d="M52.7,32.6 L62,32.6 L62,58.5 C62,69.5 52.5,78.2 40.5,78.2 L38.4,78.2 L38.4,68.9 L40.5,68.9 C47,68.9 52.4,64.5 52.4,58.5 L52.4,56.9 L38.4,56.9 L52.7,45.6 Z" fill="#efe9e2"/>
    <path class="lg-b" d="M52.6,22 L38.3,33.2 L38.3,56.4 L52.6,45.3 Z" fill="#ffffff"/></svg>`
  return piece(id, `<div class="logo-card"><div class="lg-row">${mark}<div class="lg-words"><span class="lg-w1">FOCUS</span><span class="lg-w2">POINT</span></div></div></div>`, 'p-logo',
    (tq) => {
      const s = slide(tq, o.at, o.from, o.to, 0.5)
      if (!s) return null
      return { ...s, z: o.z ?? 50, extra: (el) => {
        const step = (k, d) => tq >= o.at + 0.5 + k * d
        const seq = [['.lg-b', 0], ['.lg-a', 1], ['.lg-w1', 2], ['.lg-w2', 3]]
        for (const [sel, k] of seq) {
          const e = el.querySelector(sel); const on = step(k, 0.25)
          const just = on && !step(k + 1 / 3, 0.25)
          e.style.opacity = on ? '1' : '0'
          e.style.transform = just ? 'translate(0, -14px) scale(1.06)' : 'none'
        }
      } }
    })
}

/** A paper street map: strips for streets, a block for the building, a pin that drops in two poses. */
function paperMap(id, o) {
  return piece(id, `<div class="map"><i class="st s1"></i><i class="st s2"></i><i class="st s3"></i><i class="st s4"></i><i class="blk"></i><i class="mpin"></i></div>`, 'p-map',
    (tq) => {
      const s = slide(tq, o.at, o.from, o.to, 0.5, o.leave ?? null, o.leaveTo ?? null)
      if (!s) return null
      return { ...s, z: o.z ?? 25, extra: (el) => {
        const pin = el.querySelector('.mpin')
        const k = tq < o.pinAt ? -1 : Math.floor((tq - o.pinAt) * POSES)
        pin.style.opacity = k < 0 ? '0' : '1'
        pin.style.transform = k === 0 ? 'translateY(-160px) scale(1.15)' : k === 1 ? 'translateY(12px) scale(0.95)' : 'none'
      } }
    })
}
Object.assign(window, { logoCard, paperMap })
