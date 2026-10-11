'use strict'
// Dentora — the plain decisions of the Windows shell (no Electron in here), so that tests/electron-shell.test.ts can
// check them on any machine: where the window opens, which file URL is the app's own page, which command-line
// switches a packaged app refuses, the right-click menu, and how the device id stays the same for an installation.

// ---- window placement ----------------------------------------------------------------------------------------
/**
 * Where the main window opens. Saved bounds are kept, but always whole on one screen: the screen the window overlaps
 * most (or the primary one when it overlaps none, e.g. a monitor that is no longer connected). A window larger than
 * that screen (saved on a big monitor, opened on a laptop) is shrunk to fit and opens maximised; one partly off the
 * screen (a monitor that was left of or above the main one) is moved fully into view, title bar included.
 *   saved     { x, y, width, height, maximized } from window-state.json (anything missing → the default)
 *   displays  [{ workArea: { x, y, width, height } }]   primary  the primary display's workArea
 *   sizes     { minW, minH, defaultW, defaultH }
 * Returns { bounds: { x, y, width, height }, minW, minH, maximize }.
 */
function fitBounds(saved, displays, primary, sizes) {
  const s = saved && typeof saved === 'object' ? saved : {}
  const { x, y, width, height } = s
  const valid = [x, y, width, height].every(Number.isFinite) && width > 0 && height > 0
  if (valid) {
    let wa = null
    let best = 0
    for (const d of displays || []) {
      const a = d && d.workArea
      if (!a) continue
      const w = Math.min(x + width, a.x + a.width) - Math.max(x, a.x)
      const h = Math.min(y + height, a.y + a.height) - Math.max(y, a.y)
      if (w > 0 && h > 0 && w * h > best) { best = w * h; wa = a }
    }
    const onScreen = !!wa
    wa = wa || primary
    const minW = Math.min(sizes.minW, wa.width)
    const minH = Math.min(sizes.minH, wa.height)
    const tooBig = width > wa.width || height > wa.height
    const w = Math.round(Math.max(minW, Math.min(width, wa.width)))
    const h = Math.round(Math.max(minH, Math.min(height, wa.height)))
    // off every screen: centre it on the primary one; otherwise keep its place, moved just enough to be whole
    const nx = onScreen ? Math.min(Math.max(x, wa.x), wa.x + wa.width - w) : Math.round(wa.x + (wa.width - w) / 2)
    const ny = onScreen ? Math.min(Math.max(y, wa.y), wa.y + wa.height - h) : Math.round(wa.y + (wa.height - h) / 2)
    return { bounds: { x: Math.round(nx), y: Math.round(ny), width: w, height: h }, minW, minH, maximize: !!s.maximized || tooBig }
  }
  const wa = primary
  const minW = Math.min(sizes.minW, wa.width)
  const minH = Math.min(sizes.minH, wa.height)
  const w = Math.min(sizes.defaultW, wa.width)
  const h = Math.min(sizes.defaultH, wa.height)
  // first run on a small laptop screen (1366×768, 1280×720…): start maximised
  const maximize = typeof s.maximized === 'boolean' ? s.maximized : (wa.width < sizes.defaultW + 40 || wa.height < sizes.defaultH + 20)
  return { bounds: { width: w, height: h, x: Math.round(wa.x + (wa.width - w) / 2), y: Math.round(wa.y + (wa.height - h) / 2) }, minW, minH, maximize }
}

// ---- the app's own page ----------------------------------------------------------------------------------------
/** Percent-escapes decoded as UTF-8 bytes; a lone '%' (not followed by two hex digits) stays as it is. */
function decodePercent(s) {
  return s.replace(/(?:%[0-9A-Fa-f]{2})+/g, run => Buffer.from(run.replace(/%/g, ''), 'hex').toString('utf8'))
}

/**
 * A file: URL reduced to what identifies the file: host (UNC) and the decoded path, without query or hash; case-folded
 * on Windows. Two spellings of one path (Node's pathToFileURL and Chromium's own escaping of %, #, spaces, Arabic
 * letters, brackets…) give the same key. null for anything that is not a file: URL.
 */
function fileUrlKey(href, win32) {
  let u
  try { u = new URL(String(href)) } catch { return null }
  if (u.protocol !== 'file:') return null
  const key = `${u.host}|${decodePercent(u.pathname)}`
  return win32 ? key.toLowerCase() : key
}

/** true when `url` is the page at `appUrl` (any hash route), false for every other address. */
function sameFileUrl(url, appUrl, win32) {
  const a = fileUrlKey(url, win32)
  return a !== null && a === fileUrlKey(appUrl, win32)
}

// ---- command-line switches a packaged app refuses ------------------------------------------------------------------
// Each would let another program drive the app (read or change the clinic's records, skip the PIN or the licence):
// Chromium's remote debugging and Node's inspector. Chromium on Windows also reads "-name" and "/name", any case.
const DEBUG_SWITCHES = ['remote-debugging-port', 'remote-debugging-pipe', 'remote-debugging-address', 'remote-allow-origins',
  'inspect', 'inspect-brk', 'inspect-port', 'inspect-publish-uid', 'debug', 'debug-brk', 'js-flags', 'auto-open-devtools-for-tabs']

/** The first debugging switch in argv (its name), or null. */
function debugSwitch(argv) {
  for (const raw of argv || []) {
    const m = /^(?:--|-|\/)([A-Za-z][A-Za-z0-9-]*)(?:=|$)/.exec(String(raw))
    if (m && DEBUG_SWITCHES.includes(m[1].toLowerCase())) return m[1].toLowerCase()
  }
  return null
}

// ---- the right-click menu --------------------------------------------------------------------------------------
/**
 * The items of the right-click menu for Electron's context-menu params: Cut/Copy/Paste/Select all in a field, Copy
 * over selected text, nothing elsewhere. Roles do the work (they also respect read-only fields); labels in the app's
 * language. Returns [] when there is nothing to offer.
 */
function contextMenuItems(params, s) {
  const p = params || {}
  const f = p.editFlags || {}
  const selected = typeof p.selectionText === 'string' && p.selectionText.trim().length > 0
  if (p.isEditable) {
    return [
      { role: 'cut', label: s.cut, enabled: !!f.canCut },
      { role: 'copy', label: s.copy, enabled: !!f.canCopy },
      { role: 'paste', label: s.paste, enabled: !!f.canPaste },
      { type: 'separator' },
      { role: 'selectAll', label: s.selectAll, enabled: f.canSelectAll !== false },
    ]
  }
  if (selected) return [{ role: 'copy', label: s.copy, enabled: f.canCopy !== false }]
  return []
}

// ---- the device id -----------------------------------------------------------------------------------------------
/**
 * The device id of this installation, stable from the first run on. The activation code is made for it, so it must
 * never change by itself.
 *   - The first id is cached in userData (device-id.json) with where it came from: the machine (Windows MachineGuid,
 *     hashed), or, when the machine id cannot be read on that first run, the id of Dentora 1.0's fallback file or a
 *     new random one.
 *   - Every later run uses the cached id. A machine id that cannot be read (reg.exe blocked by a policy, an antivirus,
 *     a timeout) changes nothing.
 *   - The machine id is read again each run, only to notice that the data folder was copied to another computer (or
 *     Windows was reinstalled and the folder restored): then that computer's own id is used from then on, so one
 *     code cannot be used on two computers by copying the folder.
 * deps: readCache() → {id, source, machine} | null · writeCache(obj) · readLegacy() → hex | null ·
 *       machineId(firstRun) → Promise<{ kind: 'win' | 'host', id } | null> (already hashed) · randomId() → hex · log(...)
 * Resolves { id, source, changed } (changed: the id differs from the cached one, logged).
 */
async function resolveDeviceId(deps) {
  const valid = v => typeof v === 'string' && /^[0-9a-f]{32,64}$/.test(v)
  let cache = null
  try { cache = deps.readCache() } catch { cache = null }
  if (cache && !valid(cache.id)) cache = null
  let machine = null
  try { machine = await deps.machineId(!cache) } catch (err) { deps.log('machine id failed', err) }
  if (machine && !valid(machine.id)) machine = null
  const save = obj => {
    try { deps.writeCache({ v: 1, ...obj, at: new Date().toISOString() }) } catch (err) { deps.log('device id not cached', err) }
    return obj
  }
  if (cache) {
    const bindable = machine && machine.kind === 'win'
    if (bindable && valid(cache.machine) && cache.machine !== machine.id) {
      deps.log('device id: this data folder belongs to another computer; using this computer\'s id')
      const next = save({ id: machine.id, source: 'win', machine: machine.id })
      return { id: next.id, source: next.source, changed: true }
    }
    if (bindable && !valid(cache.machine)) save({ id: cache.id, source: cache.source || 'win', machine: machine.id })
    if (!machine) deps.log(`device id: machine id unavailable, using the cached id (${cache.source || 'unknown'})`)
    return { id: cache.id, source: cache.source || 'win', changed: false }
  }
  if (machine) {
    const next = save({ id: machine.id, source: machine.kind, ...(machine.kind === 'win' ? { machine: machine.id } : {}) })
    return { id: next.id, source: next.source, changed: false }
  }
  let legacy = null
  try { legacy = deps.readLegacy() } catch { legacy = null }
  if (valid(legacy)) {
    deps.log('device id: machine id unavailable on the first run; using the earlier fallback id')
    const next = save({ id: legacy, source: 'legacy' })
    return { id: next.id, source: next.source, changed: false }
  }
  deps.log('device id: machine id unavailable on the first run; using a random id for this installation')
  const next = save({ id: deps.randomId(), source: 'random' })
  return { id: next.id, source: next.source, changed: false }
}

module.exports = { fitBounds, decodePercent, fileUrlKey, sameFileUrl, DEBUG_SWITCHES, debugSwitch, contextMenuItems, resolveDeviceId }
