// The platform layer's save/pick/print contracts with stand-ins for the Windows (window.dentora) and Android
// (window.DentoraAndroid) bridges: files cross in chunks, never as one string; one save at a time; the shells' answers
// (cancelled, failed, busy) reach the caller; a late file is not lost; print jobs carry a name.
import { appVersion, pickFile, print, printJobName, saveFile, saveStream, SaveError } from '../src/platform'
import { crc32, fromBase64 } from '../src/platform/bytes'

const bytes = (n: number, seed = 1) => { const b = new Uint8Array(n); for (let i = 0; i < n; i++) b[i] = (i * 31 + seed) & 255; return b }
const join = (parts: Uint8Array[]) => { const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length } return out }
const produce = (data: Uint8Array, step = 100_000) => async (write: (c: Uint8Array) => Promise<void>) => { for (let i = 0; i < data.length; i += step) await write(data.slice(i, i + step)) }
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i])
const w = window as any

afterEach(() => { delete w.dentora; delete w.DentoraAndroid })

describe('Windows bridge (Electron)', () => {
  function fakeElectron(opts: { cancel?: boolean; failEnd?: string } = {}) {
    const st = { chunks: [] as Uint8Array[], ended: null as null | { size: number; crc: number }, aborted: 0, active: 0, maxActive: 0 }
    w.dentora = {
      platform: 'electron',
      appVersion: async () => '1.2.3',
      saveBegin: async () => { if (opts.cancel) return null; st.active++; st.maxActive = Math.max(st.maxActive, st.active); return { id: 'x', name: 'chosen.dentora' } },
      saveChunk: async (_id: string, c: Uint8Array) => { st.chunks.push(c); await new Promise(r => setTimeout(r, 1)); return { ok: true } },
      saveEnd: async (_id: string, size: number, crc: number) => { st.ended = { size, crc }; st.active--; return opts.failEnd ? { ok: false, reason: opts.failEnd } : { ok: true, name: 'chosen.dentora' } },
      saveAbort: async () => { st.aborted++; st.active-- },
    }
    return st
  }
  it('sends chunks of at most 4 MB, then the size and CRC-32 the shell checks', { timeout: 60_000 }, async () => {
    const st = fakeElectron()
    const data = bytes(9 * 1024 * 1024 + 123)
    const r = await saveStream('b.dentora', 'application/octet-stream', produce(data))
    expect(r).toEqual({ status: 'saved', name: 'chosen.dentora', bytes: data.length })
    expect(st.chunks.every(c => c.length <= 4 * 1024 * 1024)).toBe(true)
    expect(same(join(st.chunks), data)).toBe(true)
    expect(st.ended).toEqual({ size: data.length, crc: crc32(data) })
  })
  it('a cancelled dialog is "cancelled"; a failed check is a SaveError and nothing is reported saved', async () => {
    fakeElectron({ cancel: true })
    expect(await saveStream('b', 'x', produce(bytes(10)))).toEqual({ status: 'cancelled' })
    fakeElectron({ failEnd: 'verify' })
    await expect(saveStream('b', 'x', produce(bytes(10)))).rejects.toMatchObject({ reason: 'verify' })
    fakeElectron({ failEnd: 'space' })
    await expect(saveStream('b', 'x', produce(bytes(10)))).rejects.toBeInstanceOf(SaveError)
  })
  it('a failure while writing aborts the save (the shell deletes its part file)', async () => {
    const st = fakeElectron()
    await expect(saveStream('b', 'x', async write => { await write(bytes(10)); throw new Error('read failed') })).rejects.toMatchObject({ reason: 'io' })
    expect(st.aborted).toBe(1)
  })
  it('saves never overlap, and a double tap on the same file is ignored', async () => {
    const st = fakeElectron()
    const blob = new Blob([bytes(5000) as BlobPart], { type: 'text/csv' })
    const [a, b, c] = await Promise.all([saveFile('x.csv', blob), saveFile('x.csv', blob), saveFile('y.csv', new Blob([bytes(7000) as BlobPart]))])
    expect([a, b, c]).toEqual([true, false, true])
    expect(st.maxActive).toBe(1)
  })
  it('reports the version of the installed app', async () => {
    fakeElectron()
    expect(typeof appVersion()).toBe('string')
  })
})

describe('Android bridge', () => {
  function fakeAndroid(opts: { result?: 'ok' | 'cancel' | 'verify'; busy?: boolean } = {}) {
    const st = { chunks: [] as string[], end: null as null | { size: string; crc: string }, aborted: 0, quiet: '' }
    w.DentoraAndroid = {
      deviceId: () => 'abc', appVersion: () => '2.0.1', print: () => undefined, openExternal: () => undefined,
      saveBegin: (_n: string, _m: string, _h: string, quiet: string) => { st.quiet = quiet; return opts.busy ? '{"error":"busy"}' : '{"id":"s1"}' },
      saveChunk: (_id: string, b64: string) => { st.chunks.push(b64); return '' },
      saveEnd: (id: string, size: string, crc: string) => {
        st.end = { size, crc }
        const detail = opts.result === 'cancel' ? { id, ok: false, cancelled: true } : opts.result === 'verify' ? { id, ok: false, cancelled: false, reason: 'verify' } : { id, ok: true, cancelled: false, name: 'picked.dentora' }
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('dentora:saved', { detail: { id: 'other', ok: false } }))   // another save's answer is ignored
          window.dispatchEvent(new CustomEvent('dentora:saved', { detail }))
        }, 5)
        return ''
      },
      saveAbort: () => { st.aborted++ },
    }
    return st
  }
  it('sends base64 pieces of at most 1 MB that decode to the file, and waits for the shell’s answer', { timeout: 60_000 }, async () => {
    const st = fakeAndroid()
    const data = bytes(3 * 1024 * 1024 + 7, 9)
    const r = await saveStream('b.dentora', 'application/octet-stream', produce(data, 333_333), { quiet: true })
    expect(r).toEqual({ status: 'saved', name: 'picked.dentora', bytes: data.length })
    expect(st.chunks.every(c => c.length <= 1024 * 1024)).toBe(true)
    expect(same(join(st.chunks.map(fromBase64)), data)).toBe(true)
    expect(st.end).toEqual({ size: String(data.length), crc: String(crc32(data)) })
    expect(st.quiet).toBe('1')
  })
  it('cancelled, failed and busy answers reach the caller', async () => {
    fakeAndroid({ result: 'cancel' })
    expect(await saveStream('b', 'x', produce(bytes(10)))).toEqual({ status: 'cancelled' })
    fakeAndroid({ result: 'verify' })
    await expect(saveStream('b', 'x', produce(bytes(10)))).rejects.toMatchObject({ reason: 'verify' })
    fakeAndroid({ busy: true })
    await expect(saveStream('b', 'x', produce(bytes(10)))).rejects.toMatchObject({ reason: 'busy' })
    expect(await saveFile('x.csv', new Blob(['a']))).toBe(false)
  })
  it('the version comes from the installed app', () => {
    fakeAndroid()
    expect(appVersion()).toBe('2.0.1')
  })
})

describe('picking a file', () => {
  it('the Android shell’s "cancelled" ends the pick', async () => {
    w.DentoraAndroid = { appVersion: () => '' }
    const p = pickFile('.dentora')
    window.dispatchEvent(new Event('dentora:pick-cancelled'))
    expect(await p).toBeNull()
  })
  it('on Android, regaining focus does not give up on a file that is still coming', async () => {
    w.DentoraAndroid = { appVersion: () => '' }
    const p = pickFile('.dentora')
    const input = [...document.querySelectorAll('input[type=file]')].at(-1) as HTMLInputElement
    window.dispatchEvent(new Event('focus'))
    await new Promise(r => setTimeout(r, 900))
    const f = new File(['x'], 'b.dentora')
    Object.defineProperty(input, 'files', { value: [f], configurable: true })
    input.dispatchEvent(new Event('change'))
    expect(await p).toBe(f)
  })
  it('in a browser without the cancel event, a file arriving after focus is still taken', async () => {
    const p = pickFile('.json')
    const input = [...document.querySelectorAll('input[type=file]')].at(-1) as HTMLInputElement
    window.dispatchEvent(new Event('focus'))
    await new Promise(r => setTimeout(r, 1200))
    const f = new File(['y'], 'old.json')
    Object.defineProperty(input, 'files', { value: [f], configurable: true })
    expect(await p).toBe(f)
  })
})

describe('print job names', () => {
  it('cleans a name for use as a file name', () => {
    expect(printJobName(' فاتورة INV-000034 / محمد: العلي ')).toBe('فاتورة INV-000034 محمد العلي')
    expect(printJobName('a\nb*?"<>|c')).toBe('a b c')
    expect(printJobName()).toBe('')
  })
  it('names the job through the page title until the print ends', () => {
    const printed: string[] = []
    const original = window.print
    window.print = () => { printed.push(document.title) }
    document.title = 'Dentora — نظام إدارة عيادات الأسنان'
    print('وصفة - سارة')
    expect(printed).toEqual(['وصفة - سارة'])
    window.dispatchEvent(new Event('afterprint'))
    expect(document.title).toBe('Dentora — نظام إدارة عيادات الأسنان')
    print()
    expect(printed[1]).toBe('Dentora — نظام إدارة عيادات الأسنان')
    window.print = original
  })
})
