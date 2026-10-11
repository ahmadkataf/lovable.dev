// The native shells' plain decisions (electron/lib.cjs) and the page side of the Android back key and print name
// (src/platform): window placement on a smaller or rearranged screen, the app's own file URL whatever the install path
// holds, the debugging switches a packaged app refuses, the right-click menu, a device id that never changes by itself.
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { act, createElement, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { handleBackButton, onBackButton, print } from '../src/platform'
import { Menu, Modal } from '../src/ui/Overlay'

const lib = createRequire(import.meta.url)('../electron/lib.cjs')
const SIZES = { minW: 1024, minH: 680, defaultW: 1360, defaultH: 860 }
const screen = (x: number, y: number, width: number, height: number) => ({ workArea: { x, y, width, height } })

describe('window placement (fitBounds)', () => {
  const laptop = screen(0, 0, 1366, 728)
  it('a window saved on a 1920×1080 monitor opens whole and maximised on a 1366×768 laptop', () => {
    const r = lib.fitBounds({ x: 280, y: 110, width: 1360, height: 860, maximized: false }, [laptop], laptop.workArea, SIZES)
    expect(r.maximize).toBe(true)
    expect(r.bounds.x).toBeGreaterThanOrEqual(0)
    expect(r.bounds.x + r.bounds.width).toBeLessThanOrEqual(1366)
    expect(r.bounds.y + r.bounds.height).toBeLessThanOrEqual(728)
  })
  it('a window partly above the screen (a monitor that was on top) comes down with its title bar visible', () => {
    const r = lib.fitBounds({ x: 100, y: -600, width: 1200, height: 700 }, [laptop], laptop.workArea, SIZES)
    expect(r.bounds).toEqual({ x: 100, y: 0, width: 1200, height: 700 })
    expect(r.maximize).toBe(false)
  })
  it('a window that fits stays exactly where it was, maximised or not', () => {
    expect(lib.fitBounds({ x: 40, y: 20, width: 1100, height: 700, maximized: true }, [laptop], laptop.workArea, SIZES))
      .toEqual({ bounds: { x: 40, y: 20, width: 1100, height: 700 }, minW: 1024, minH: 680, maximize: true })
  })
  it('a second monitor on the left (negative x) is used as it is', () => {
    const left = screen(-1920, 0, 1920, 1040)
    const r = lib.fitBounds({ x: -1700, y: 100, width: 1200, height: 800 }, [laptop, left], laptop.workArea, SIZES)
    expect(r.bounds).toEqual({ x: -1700, y: 100, width: 1200, height: 800 })
  })
  it('a window on a monitor that is gone is centred on the primary screen', () => {
    const r = lib.fitBounds({ x: 2500, y: 100, width: 1200, height: 700 }, [laptop], laptop.workArea, SIZES)
    expect(r.bounds).toEqual({ x: 83, y: 14, width: 1200, height: 700 })
  })
  it('first run: the default size, maximised on a small screen', () => {
    expect(lib.fitBounds({}, [laptop], laptop.workArea, SIZES).maximize).toBe(true)
    const big = screen(0, 0, 1920, 1040)
    expect(lib.fitBounds(null, [big], big.workArea, SIZES)).toEqual({ bounds: { x: 280, y: 90, width: 1360, height: 860 }, minW: 1024, minH: 680, maximize: false })
  })
  it('a screen smaller than the minimum window: the minimum shrinks with it', () => {
    const tiny = screen(0, 0, 1000, 600)
    const r = lib.fitBounds({ x: 0, y: 0, width: 1360, height: 860 }, [tiny], tiny.workArea, SIZES)
    expect(r).toMatchObject({ minW: 1000, minH: 600, bounds: { x: 0, y: 0, width: 1000, height: 600 }, maximize: true })
  })
})

describe("the app's own page (sameFileUrl)", () => {
  const paths = [
    '/home/u/Dr. Ali #2 (clinic) 100%/Dentora/resources/app.asar/dist/index.html',
    '/home/u/عيادة الأسنان/Dentora/dist/index.html',
    '/opt/a b/[x] {y} ^z`/dist/index.html',
  ]
  it('matches the URL Node builds and the way Chromium spells it, with any hash route', () => {
    for (const p of paths) {
      const app = pathToFileURL(p).href
      expect(lib.sameFileUrl(app, app, false)).toBe(true)
      expect(lib.sameFileUrl(`${app}#/patients/p-1?tab=chart`, app, false)).toBe(true)
      // Chromium leaves some characters escaped that Node does not (and the other way round)
      const chromium = app.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/%5B/g, '[').replace(/%5D/g, ']')
      expect(lib.sameFileUrl(chromium, app, false)).toBe(true)
    }
  })
  it('a raw % (what loadFile used to leave in the URL) no longer breaks the check', () => {
    const p = paths[0]
    expect(lib.fileUrlKey('file://' + p.replace(/ /g, '%20').replace('#', '%23'), false)).toBe(lib.fileUrlKey(pathToFileURL(p).href, false))
  })
  it('Windows: drive letters and folder names in any case', () => {
    expect(lib.sameFileUrl('file:///c:/Users/ALI/AppData/Local/Programs/Dentora/resources/app.asar/dist/index.html#/',
      'file:///C:/Users/Ali/AppData/Local/Programs/Dentora/resources/app.asar/dist/index.html', true)).toBe(true)
  })
  it('refuses every other page', () => {
    const app = pathToFileURL(paths[1]).href
    expect(lib.sameFileUrl(app.replace('index.html', 'other.html'), app, false)).toBe(false)
    expect(lib.sameFileUrl(app.replace('/dist/', '/dist/x/'), app, false)).toBe(false)
    expect(lib.sameFileUrl('https://evil.example/dist/index.html', app, false)).toBe(false)
    expect(lib.sameFileUrl('blob:file:///abc', app, false)).toBe(false)
    expect(lib.sameFileUrl('not a url', app, false)).toBe(false)
    expect(lib.sameFileUrl(app, app.replace('file:///', 'file://server/'), false)).toBe(false)
  })
})

describe('switches a packaged app refuses (debugSwitch)', () => {
  it('finds remote debugging and the inspector in any spelling Chromium reads', () => {
    expect(lib.debugSwitch(['Dentora.exe', '--remote-debugging-port=9222'])).toBe('remote-debugging-port')
    expect(lib.debugSwitch(['Dentora.exe', '/REMOTE-DEBUGGING-PORT=9222'])).toBe('remote-debugging-port')
    expect(lib.debugSwitch(['Dentora.exe', '-remote-debugging-pipe'])).toBe('remote-debugging-pipe')
    expect(lib.debugSwitch(['Dentora.exe', '--inspect'])).toBe('inspect')
    expect(lib.debugSwitch(['Dentora.exe', '--inspect-brk=0.0.0.0:9229'])).toBe('inspect-brk')
    expect(lib.debugSwitch(['Dentora.exe', '--js-flags=--expose-gc'])).toBe('js-flags')
  })
  it('lets the normal ones through', () => {
    expect(lib.debugSwitch(['Dentora.exe'])).toBeNull()
    expect(lib.debugSwitch(['Dentora.exe', '--disable-gpu', '--updated', 'C:\\inspect\\file.dentora'])).toBeNull()
    expect(lib.debugSwitch(['Dentora.exe', '--inspector-like-name'])).toBeNull()
  })
})

describe('right-click menu (contextMenuItems)', () => {
  const ar = { cut: 'قص', copy: 'نسخ', paste: 'لصق', selectAll: 'تحديد الكل' }
  it('a field: Cut, Copy, Paste, Select all, enabled as the field allows', () => {
    const items = lib.contextMenuItems({ isEditable: true, selectionText: '', editFlags: { canCut: false, canCopy: false, canPaste: true, canSelectAll: true } }, ar)
    expect(items.map((i: any) => i.role ?? i.type)).toEqual(['cut', 'copy', 'paste', 'separator', 'selectAll'])
    expect(items.map((i: any) => i.enabled)).toEqual([false, false, true, undefined, true])
    expect(items[2].label).toBe('لصق')
  })
  it('selected text outside a field: Copy only; nothing selected: no menu', () => {
    expect(lib.contextMenuItems({ isEditable: false, selectionText: 'محمد العلي', editFlags: { canCopy: true } }, ar).map((i: any) => i.role)).toEqual(['copy'])
    expect(lib.contextMenuItems({ isEditable: false, selectionText: '  ', editFlags: {} }, ar)).toEqual([])
  })
})

describe('device id (resolveDeviceId)', () => {
  const A = 'a'.repeat(64), B = 'b'.repeat(64), R = 'c'.repeat(32), L = 'd'.repeat(32)
  function env(o: { cache?: any; machine?: { kind: string; id: string } | null; legacy?: string | null; failWrite?: boolean }) {
    const st = { cache: o.cache ?? null, writes: 0, logs: [] as string[], firstRunAsked: [] as boolean[] }
    const deps = {
      readCache: () => st.cache,
      writeCache: (v: any) => { if (o.failWrite) throw new Error('read-only'); st.cache = v; st.writes++ },
      readLegacy: () => o.legacy ?? null,
      machineId: async (first: boolean) => { st.firstRunAsked.push(first); return o.machine ?? null },
      randomId: () => R,
      log: (...a: unknown[]) => { st.logs.push(a.map(String).join(' ')) },
    }
    return { st, deps }
  }
  it('first run: the machine id, cached with its source (and the longer first-run tries asked for)', async () => {
    const { st, deps } = env({ machine: { kind: 'win', id: A } })
    expect(await lib.resolveDeviceId(deps)).toEqual({ id: A, source: 'win', changed: false })
    expect(st.cache).toMatchObject({ v: 1, id: A, source: 'win', machine: A })
    expect(st.firstRunAsked).toEqual([true])
  })
  it('reg.exe blocked on a later run: the cached id, not a random one', async () => {
    const { st, deps } = env({ cache: { id: A, source: 'win', machine: A }, machine: null })
    expect((await lib.resolveDeviceId(deps)).id).toBe(A)
    expect(st.firstRunAsked).toEqual([false])
    expect(st.logs.join()).toMatch(/cached id/)
  })
  it('the data folder copied to another computer: that computer gets its own id', async () => {
    const { st, deps } = env({ cache: { id: A, source: 'win', machine: A }, machine: { kind: 'win', id: B } })
    expect(await lib.resolveDeviceId(deps)).toEqual({ id: B, source: 'win', changed: true })
    expect(st.cache.id).toBe(B)
  })
  it('first run without a machine id: a random id that stays, even when reg.exe works later', async () => {
    const first = env({ machine: null })
    expect(await lib.resolveDeviceId(first.deps)).toEqual({ id: R, source: 'random', changed: false })
    const later = env({ cache: first.st.cache, machine: { kind: 'win', id: A } })
    expect((await lib.resolveDeviceId(later.deps)).id).toBe(R)
    expect(later.st.cache).toMatchObject({ id: R, source: 'random', machine: A })      // now bound to this computer
    const copied = env({ cache: later.st.cache, machine: { kind: 'win', id: B } })
    expect((await lib.resolveDeviceId(copied.deps)).id).toBe(B)
  })
  it("Dentora 1.0's fallback id is kept when the machine id cannot be read on the first run after the update", async () => {
    const { deps } = env({ machine: null, legacy: L })
    expect(await lib.resolveDeviceId(deps)).toEqual({ id: L, source: 'legacy', changed: false })
  })
  it('an update where reg.exe works gives the same id Dentora 1.0 showed (the machine id), not the old fallback file', async () => {
    const { deps } = env({ machine: { kind: 'win', id: A }, legacy: L })
    expect((await lib.resolveDeviceId(deps)).id).toBe(A)
  })
  it('a host fingerprint (Linux, macOS development) never replaces a cached id', async () => {
    const { deps } = env({ cache: { id: A, source: 'host' }, machine: { kind: 'host', id: B } })
    expect((await lib.resolveDeviceId(deps)).id).toBe(A)
  })
  it('a cache that cannot be written still gives the machine id; a broken cache file is ignored', async () => {
    expect((await lib.resolveDeviceId(env({ machine: { kind: 'win', id: A }, failWrite: true }).deps)).id).toBe(A)
    expect((await lib.resolveDeviceId(env({ cache: { id: 'zz' }, machine: { kind: 'win', id: A } }).deps)).id).toBe(A)
  })
})

describe('Android back key (window.__dentoraBack)', () => {
  let host: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
  afterEach(() => { act(() => root.unmount()); host.remove() })
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

  it('is installed for the shell and answers false when nothing is open', () => {
    expect(window.__dentoraBack).toBe(handleBackButton)
    expect(handleBackButton()).toBe(false)
  })
  it('closes the top-most dialog first, then a step of the screen, then lets the shell go back', () => {
    const closed: string[] = []
    let steps = 1
    const off = onBackButton(() => { if (steps === 0) return false; steps--; closed.push('step'); return true })
    act(() => root.render(createElement(Modal, { open: true, onClose: () => closed.push('dialog'), title: 'x', children: 'body' })))
    expect(handleBackButton()).toBe(true)
    expect(closed).toEqual(['dialog'])
    act(() => root.render(createElement('div')))
    expect(handleBackButton()).toBe(true)
    expect(handleBackButton()).toBe(false)
    expect(closed).toEqual(['dialog', 'step'])
    off()
  })
  it('a list open under a field in a dialog (patient or drug picker) closes alone; the form stays', () => {
    const closed: string[] = []
    function Picker() {
      const [open, setOpen] = useState(true)
      return createElement('div', null,
        createElement('input', { id: 'pick', role: 'combobox', 'aria-expanded': open, onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); closed.push('list') } } }),
        open ? createElement('div', { role: 'listbox' }, 'options') : null)
    }
    act(() => root.render(createElement(Modal, { open: true, onClose: () => closed.push('dialog'), title: 'x', children: createElement(Picker) })))
    act(() => { (document.getElementById('pick') as HTMLInputElement).focus() })
    act(() => { expect(handleBackButton()).toBe(true) })
    expect(closed).toEqual(['list'])
    expect(document.querySelector('[role="listbox"]')).toBeNull()
    act(() => { expect(handleBackButton()).toBe(true) })
    expect(closed).toEqual(['list', 'dialog'])
  })
  it('a field that ignores Escape over an open list: the dialog closes, as with a keyboard', () => {
    const closed: string[] = []
    act(() => root.render(createElement(Modal, { open: true, onClose: () => closed.push('dialog'), title: 'x',
      children: createElement('div', null, createElement('input', { id: 'plain' }), createElement('div', { role: 'listbox' }, 'o')) })))
    act(() => { (document.getElementById('plain') as HTMLInputElement).focus() })
    act(() => { expect(handleBackButton()).toBe(true) })
    expect(closed).toEqual(['dialog'])
  })
  it('closes an open kit menu', () => {
    act(() => root.render(createElement(Menu, { trigger: () => createElement('button', { id: 'trig' }, 'more'), items: [{ label: 'a' }] })))
    act(() => { (host.querySelector('#trig')!.parentElement as HTMLElement).click() })
    expect(document.querySelector('.menu-portal')).not.toBeNull()
    act(() => { expect(handleBackButton()).toBe(true) })
    expect(document.querySelector('.menu-portal')).toBeNull()
  })
  it('a removed or broken screen handler never traps the key', () => {
    const off = onBackButton(() => true)
    off()
    const off2 = onBackButton(() => { throw new Error('x') })
    expect(handleBackButton()).toBe(false)
    off2()
  })
})

describe('Android print job name', () => {
  afterEach(() => { delete (window as any).DentoraAndroid })
  it('goes to the shell with the call, and print() without a name stays a call without arguments', () => {
    const calls: unknown[][] = []
    ;(window as any).DentoraAndroid = { print: (...a: unknown[]) => { calls.push(a) }, deviceId: () => '', appVersion: () => '' }
    print('فاتورة INV-000034 / محمد العلي')
    window.dispatchEvent(new Event('afterprint'))
    print()
    expect(calls).toEqual([['فاتورة INV-000034 محمد العلي'], []])
  })
})
