// The activation page (/activate, /en/activate): cleans the device number and the licence key the way the server
// does, posts them to /api/activate and shows the activation code, or one sentence for what went wrong
// (docs/LICENCE-KEYS.md → Public activation). The words come from the page's JSON block (src/pages/activate.ts).
(() => {
  const form = document.getElementById('act-form')
  const data = document.getElementById('act-text')
  if (!(form instanceof HTMLFormElement) || !data) return
  const T = JSON.parse(data.textContent || '{}')
  const $ = id => document.getElementById(id)
  const device = $('act-device'), key = $('act-key')
  const submit = form.querySelector('.act-submit'), submitLabel = submit.querySelector('span')
  const alertBox = $('act-alert').querySelector('.act-alert')
  const start = $('act-start'), done = $('act-done'), status = $('act-status')
  const copyBtn = $('act-copy'), copyLabel = copyBtn.querySelector('span'), copyNote = $('act-copy-note')
  const help = $('act-wa'), langLink = document.querySelector('.legal-lang')
  const SUBMIT = submitLabel.textContent

  // ---- the server's cleaning (cleanCode in src/license/core.ts): Arabic-Indic digits as Latin, upper case, letters
  // and digits only. Persian digits too, which the server would drop: they are sent as Latin digits.
  const latin = s => String(s || '')
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x6F0))
  const clean = s => latin(s).toUpperCase().replace(/[^0-9A-Z]/g, '')
  const group = s => (s.match(/.{1,4}/g) || []).join('-')
  const SYMBOL = '[2-9A-HJ-NP-Z]'   // the code alphabet: no 0/O, no 1/I
  const DEVICE_RE = new RegExp(`^${SYMBOL}{8}$`), KEY_RE = new RegExp(`^${SYMBOL}{16}$`)
  const CODE_RE = new RegExp(`${SYMBOL}{112}`)   // an activation code pasted where the key goes

  /** The one key (4 groups) or device number (2 groups) written with its dashes in a longer text, e.g. the seller's
   * whole message pasted from WhatsApp; '' when there is none, or more than one. */
  function pick(text, groups) {
    const re = new RegExp(`(?:^|[^0-9A-Za-z-])(${SYMBOL}{4}(?:-${SYMBOL}{4}){${groups - 1}})(?![0-9A-Za-z-])`, 'g')
    const found = new Set([...latin(text).matchAll(re)].map(m => m[1]))
    return found.size === 1 ? [...found][0] : ''
  }
  const keyOf = raw => (clean(raw).length > 16 && clean(pick(raw, 4))) || clean(raw)

  // ---- typing: upper case and dashes as you go, the caret kept after the same character ----------------------------
  function formatting(input, size, groups) {
    input.addEventListener('input', e => {
      if (e.isComposing) return
      const raw = input.value
      // anything but letters, digits, spaces and dashes (Arabic letters from the wrong keyboard) stays as typed
      if (!/^[0-9A-Za-z٠-٩۰-۹\s-]*$/.test(raw)) return
      const c = clean(raw)
      if (c.length > size) return
      const next = group(c)
      if (next === raw) return
      const before = clean(raw.slice(0, input.selectionStart ?? raw.length)).length
      input.value = next
      let at = 0
      for (let n = 0; at < next.length && n < before; at++) if (next[at] !== '-') n++
      input.setSelectionRange(at, at)
    })
    // A whole message pasted (the newlines it needs to find the key are gone once it is in the field)
    input.addEventListener('paste', e => {
      const found = pick(e.clipboardData?.getData('text') || '', groups)
      if (!found) return
      e.preventDefault()
      input.value = found
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    // an edit makes the last answer stale
    input.addEventListener('input', () => { clearField(input); showAlert(''); links() })
  }
  formatting(device, 8, 2)
  formatting(key, 16, 4)

  /** The help message names the device number and the key once they look right; the language switch keeps the number. */
  function links() {
    const d = clean(device.value), k = keyOf(key.value)
    const lines = [T.wa]
    if (DEVICE_RE.test(d)) lines.push(T.waDevice.replace('{device}', group(d)))
    if (KEY_RE.test(k)) lines.push(T.waKey.replace('{key}', group(k)))
    help.href = `${T.chat}?text=${encodeURIComponent(lines.join('\n'))}`
    if (langLink) {
      const url = new URL(langLink.href)
      if (DEVICE_RE.test(d)) url.searchParams.set('device', group(d)); else url.searchParams.delete('device')
      langLink.href = url.pathname + url.search
    }
  }
  links()

  // ---- messages ----------------------------------------------------------------------------------------------------
  const errOf = input => $(`${input.id}-err`)
  function clearField(input) {
    input.removeAttribute('aria-invalid')
    const el = errOf(input)
    el.hidden = true
    el.querySelector('span').textContent = ''
  }
  function fieldError(input, text) {
    input.setAttribute('aria-invalid', 'true')
    const el = errOf(input)
    el.querySelector('span').textContent = text
    el.hidden = false
  }
  function showAlert(text) {
    alertBox.querySelector('span').textContent = text
    alertBox.hidden = !text
  }
  const announce = text => { status.textContent = ''; setTimeout(() => { status.textContent = text }, 50) }
  function minutes(seconds) {
    const n = Math.max(1, Math.ceil((Number(seconds) || 900) / 60))
    let rule = 'other'
    try { rule = new Intl.PluralRules(T.locale).select(n) } catch { /* old browser: the general form */ }
    return (T.minutes[rule] || T.minutes.other).replace('{n}', String(n))
  }
  /** "Valid until 12 October 2027" with the date isolated, or the plain day if Intl cannot write it. */
  function validity(el, until) {
    if (!until) { el.textContent = T.lifetime; return }
    let day = until
    try {
      day = new Intl.DateTimeFormat(T.locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${until}T00:00:00Z`))
    } catch { /* keep YYYY-MM-DD */ }
    const [a, b] = T.until.split('{date}')
    const bdi = document.createElement('bdi')
    bdi.textContent = day
    el.replaceChildren(a, bdi, b || '')
  }

  // ---- sending -----------------------------------------------------------------------------------------------------
  /** The answers of /api/activate (and no answer at all) that have a sentence of their own; anything else is 'server'. */
  const ANSWERS = ['unknown', 'used', 'void', 'expired', 'signing', 'network']
  let busy = false
  function sending(on) {
    busy = on
    form.setAttribute('aria-busy', String(on))
    submit.classList.toggle('is-busy', on)
    // aria-disabled, not disabled: a disabled button would drop the keyboard focus
    submit.setAttribute('aria-disabled', String(on))
    device.readOnly = key.readOnly = on
    submitLabel.textContent = on ? T.sending : SUBMIT
    if (on) announce(T.sending)
  }
  async function post(body) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 20_000)
    try {
      const res = await fetch('/api/activate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        credentials: 'omit', cache: 'no-store', signal: ctrl.signal,
      })
      let json = null
      try { json = await res.json() } catch { /* not JSON: an error page from on the way */ }
      return { status: res.status, json }
    } catch {
      return { status: 0, json: null }
    } finally { clearTimeout(timer) }
  }

  form.addEventListener('submit', async e => {
    e.preventDefault()
    if (busy) return
    clearField(device); clearField(key); showAlert('')
    const d = clean(device.value), k = keyOf(key.value)
    const bad = []
    if (!d) bad.push([device, T.err.deviceEmpty])
    else if (!DEVICE_RE.test(d)) bad.push([device, T.err.device])
    if (!k) bad.push([key, T.err.keyEmpty])
    else if (CODE_RE.test(latin(key.value).toUpperCase().replace(/[\s-]/g, ''))) bad.push([key, T.err.code])
    else if (!KEY_RE.test(k)) bad.push([key, T.err.key])
    if (bad.length) {
      for (const [input, text] of bad) fieldError(input, text)
      bad[0][0].focus()
      return
    }
    device.value = group(d)
    key.value = group(k)
    sending(true)
    const { status: code, json } = await post({ key: k, device: d })
    sending(false)
    if (code === 200 && json && typeof json.code === 'string' && json.code) return success(json, d)
    const reason = code === 0 ? 'network' : String(json?.error || '')
    if (reason === 'device' || reason === 'key') {
      fieldError(reason === 'device' ? device : key, T.err[reason])
      ;(reason === 'device' ? device : key).focus()
      return
    }
    if (reason === 'locked') showAlert(T.err.locked.replace('{time}', minutes(json?.retryAfter)))
    else showAlert(T.err[ANSWERS.includes(reason) ? reason : 'server'])
  })

  // ---- the code ----------------------------------------------------------------------------------------------------
  let current = ''
  function success(r, d) {
    current = String(r.code)
    const groups = group(clean(current)).split('-')
    $('act-code').replaceChildren(...groups.map((g, i) => {
      const span = document.createElement('span')
      span.textContent = g
      if (i < groups.length - 1) {
        const dash = document.createElement('span')
        dash.className = 'act-dash'
        dash.textContent = '-'
        span.append(dash)
      }
      return span
    }))
    $('act-plan').textContent = T.plans[r.plan] || String(r.plan || '')
    validity($('act-validity'), r.until)
    $('act-done-device').textContent = r.device || group(d)
    resetCopy()
    start.hidden = true
    done.hidden = false
    $('act-done-title').focus()
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Older browsers without the async clipboard: a selected textarea and execCommand.
      const ta = document.createElement('textarea')
      ta.className = 'act-sr'
      ta.readOnly = true
      ta.value = text
      document.body.append(ta)
      ta.select()
      let ok = false
      try { ok = document.execCommand('copy') } catch { /* unsupported */ }
      ta.remove()
      return ok
    }
  }
  let copyTimer = 0
  function resetCopy() {
    clearTimeout(copyTimer)
    copyBtn.classList.remove('is-done')
    copyLabel.textContent = T.copy
    copyNote.hidden = true
  }
  copyBtn.addEventListener('click', async () => {
    resetCopy()
    if (await copyText(current)) {
      copyBtn.classList.add('is-done')
      copyLabel.textContent = T.copied
      announce(T.copied)
      copyTimer = setTimeout(resetCopy, 2500)
      return
    }
    // leave the code selected so it can be copied by hand
    const sel = window.getSelection()
    sel?.selectAllChildren($('act-code'))
    copyNote.textContent = T.copyFailed
    copyNote.hidden = false
    announce(T.copyFailed)
  })

  $('act-again').addEventListener('click', () => {
    done.hidden = true
    start.hidden = false
    key.value = ''
    current = ''
    $('act-code').replaceChildren()
    links()
    device.focus()
    device.select()
  })
})()
