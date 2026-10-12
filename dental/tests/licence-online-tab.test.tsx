// Settings → Licence with a licence key: the key goes to the activation server (a mocked fetch here), and the code that
// comes back activates the app only if the app's own check accepts it. Codes are signed with the seller's real private
// key (never in the repository: DENTORA_LICENSE_KEY or ../secrets-for-user), so lic.activate() runs exactly as in the
// app; without the key file these tests are skipped.
import fs from 'node:fs'
import path from 'node:path'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { db, resetDatabase } from '../src/db'
import { I18nProvider, translate } from '../src/i18n'
import { ConfirmProvider, ToastProvider } from '../src/ui'
import { LicenseProvider } from '../src/license/useLicense'
import { SessionProvider } from '../src/app/session'
import LicenseTab from '../src/features/settings/LicenseTab'
import { ACTIVATION_PAGE_EN, ACTIVATION_URL } from '../src/license/online'
import { importSigningKey, makeCode, parsePrivateKey } from '../tools/generator-lib'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const KEY_FILE = process.env.DENTORA_LICENSE_KEY || path.resolve(__dirname, '../../secrets-for-user/dentora/license-private.jwk')
const keyText = fs.existsSync(KEY_FILE) ? fs.readFileSync(KEY_FILE, 'utf8') : ''
const KEY = 'ABCD-EFGH-JKLM-NPQR'
const en = (key: string, params?: Record<string, string | number>) => translate('en', key, params)

describe.skipIf(!keyText)('Settings → Licence with a licence key', () => {
  let signingKey: CryptoKey
  let host: HTMLDivElement
  let root: Root
  const $ = <T extends Element = HTMLElement>(sel: string) => host.querySelector<T>(sel)
  const until = async (cond: () => boolean, what: string) => {
    for (let i = 0; i < 150 && !cond(); i++) await act(() => new Promise(r => setTimeout(r, 20)))
    if (!cond()) throw new Error(`timed out waiting for ${what}`)
  }
  const type = async (text: string) => {
    const el = $<HTMLTextAreaElement>('[data-qa=code-input]')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(el, text)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }
  const pressActivate = async () => {
    await act(async () => { $('[data-qa=code-input]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })) })
  }
  const fieldError = () => $('.field-error')?.textContent ?? ''
  const device = () => $('[data-qa=device-number]')!.textContent!.trim()
  /** The activation server's answer for the next request(s). */
  const server = (answer: (body: { key: string; device: string }) => Response | Promise<Response>) => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => answer(JSON.parse(String(init?.body))))
    vi.stubGlobal('fetch', fetch)
    return fetch
  }
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  beforeAll(async () => {
    const p = parsePrivateKey(keyText)
    if (!p.ok) throw new Error(`the licence key file is not usable (${p.reason})`)
    signingKey = await importSigningKey(p.jwk)
  })
  beforeEach(async () => {
    await resetDatabase(); localStorage.clear(); sessionStorage.clear()
    host = document.createElement('div'); document.body.appendChild(host)
    root = createRoot(host)
    await act(async () => {
      root.render(
        <I18nProvider initial="en"><ToastProvider><ConfirmProvider><LicenseProvider><SessionProvider>
          <LicenseTab />
        </SessionProvider></LicenseProvider></ConfirmProvider></ToastProvider></I18nProvider>,
      )
    })
    await until(() => !!$('[data-qa=device-number]') && !!$('[data-qa=code-input]'), 'the licence screen')
  })
  afterEach(async () => {
    await act(async () => { root.unmount() })
    host.remove()
    vi.unstubAllGlobals(); vi.restoreAllMocks()
  })

  it('recognises a key pasted inside the seller’s message and says what will be sent', async () => {
    await type(`Hello,\nHere is your Dentora licence key:\n${KEY.toLowerCase()}\nPro plan — lifetime licence\nhttps://dentora.raqeem.dev/en/activate`)
    expect($<HTMLTextAreaElement>('[data-qa=code-input]')!.value).toBe(KEY)
    expect($('[data-qa=key-detected]')).toBeTruthy()
    expect(host.textContent).toContain(en('license.key.hint'))
    // a code being typed is not mistaken for a key once it grows past 16 characters
    await type(`${KEY}-ST`)
    expect($('[data-qa=key-detected]')).toBeNull()
    expect(host.textContent).toContain('18/112')
  })

  it('activates with the code the server signs for this device, through the app’s own check', async () => {
    const dev = device()
    let release!: () => void
    const held = new Promise<void>(r => { release = r })
    const fetch = server(async body => {
      await held
      return json(200, { code: await makeCode(body.device, 'pro', null, signingKey), device: body.device, plan: 'pro', until: null })
    })
    await type(KEY.toLowerCase().replace(/-/g, ' '))
    await pressActivate()
    // while the server is asked: a progress line, the field locked, the button busy
    await until(() => !!$('[data-qa=key-contacting]'), 'the progress line')
    expect($('[data-qa=key-contacting]')!.textContent).toContain(en('license.key.contacting'))
    expect($<HTMLTextAreaElement>('[data-qa=code-input]')!.readOnly).toBe(true)
    expect($<HTMLButtonElement>('[data-qa=activate]')!.disabled).toBe(true)
    release()
    await until(() => $('[data-qa=license-status]')?.getAttribute('data-status') === 'active', 'the active status')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toBe(ACTIVATION_URL)
    expect(JSON.parse(String(fetch.mock.calls[0][1]!.body))).toEqual({ key: KEY, device: dev })
    const stored = (await db.settings.get('license'))?.value as { plan: string; until: string | null; code: string }
    expect(stored).toMatchObject({ plan: 'pro', until: null })
    expect(stored.code).toMatch(/^([2-9A-Z]{4}-){27}[2-9A-Z]{4}$/)
    expect((await db.activity.toArray()).some(a => a.message === en('license.act.activatedKey', { plan: en('license.plan.pro') }))).toBe(true)
  })

  it('refuses a code a lying server signed for another device', async () => {
    server(async () => json(200, { code: await makeCode('ZZZZ-ZZZZ', 'pro', null, signingKey), device: 'ZZZZ-ZZZZ', plan: 'pro', until: null }))
    await type(KEY)
    await pressActivate()
    await until(() => !!fieldError(), 'the error')
    expect(fieldError()).toBe(en('license.key.err.check'))
    expect(await db.settings.get('license')).toBeUndefined()
    expect($('[data-qa=license-status]')!.getAttribute('data-status')).toBe('trial')
    expect($('[data-qa=key-browser-offer]')).toBeNull()
  })

  it('says when the licence a key gives is already over (the same device getting its old code back)', async () => {
    server(async body => json(200, { code: await makeCode(body.device, 'standard', new Date(Date.UTC(2026, 0, 31)), signingKey), device: body.device, plan: 'standard', until: '2026-01-31' }))
    await type(KEY)
    await pressActivate()
    await until(() => !!fieldError(), 'the error')
    expect(fieldError()).toBe(en('license.key.err.ended', { date: '31 January 2026' }))
    expect(await db.settings.get('license')).toBeUndefined()
  })

  it('offline: says so and offers the activation page for this device, in English for the English screen', async () => {
    server(() => { throw new TypeError('Failed to fetch') })
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    await type(KEY)
    await pressActivate()
    await until(() => !!fieldError(), 'the error')
    expect(fieldError()).toBe(en('license.key.err.offline'))
    expect(host.textContent).toContain('dentora.raqeem.dev/en/activate')
    await act(async () => { $<HTMLButtonElement>('[data-qa=key-browser]')!.click() })
    expect(open).toHaveBeenCalledWith(`${ACTIVATION_PAGE_EN}?device=${device()}`, '_blank', 'noopener')
    // editing the field takes the offer away until the next failure
    await type(`${KEY}-`)
    expect($('[data-qa=key-browser-offer]')).toBeNull()
  })

  it('gives each refusal its own sentence, and offers the browser only when the server failed', async () => {
    const cases: [Response, string, boolean][] = [
      [json(409, { error: 'used' }), en('license.key.err.used'), false],
      [json(404, { error: 'unknown' }), en('license.key.err.unknown'), false],
      [json(410, { error: 'void' }), en('license.key.err.void'), false],
      [json(410, { error: 'expired' }), en('license.key.err.expired'), false],
      [json(429, { error: 'locked', retryAfter: 840 }), en('license.key.err.locked', { n: 14 }), false],
      [json(503, { error: 'signing' }), en('license.key.err.server'), true],
    ]
    for (const [res, sentence, offer] of cases) {
      server(() => res)
      await type(KEY)
      await pressActivate()
      await until(() => !!fieldError(), `the error for ${res.status}`)
      expect(fieldError()).toBe(sentence)
      expect(!!$('[data-qa=key-browser-offer]'), `${res.status}: browser offer`).toBe(offer)
    }
    expect(await db.settings.get('license')).toBeUndefined()
  })

  it('still takes an activation code, offline, without asking any server', async () => {
    const fetch = server(() => json(500, {}))
    await type(`Here is your Dentora activation code:\n${await makeCode(device(), 'standard', null, signingKey)}\nThank you!`)
    expect($('[data-qa=key-detected]')).toBeNull()
    await pressActivate()
    await until(() => $('[data-qa=license-status]')?.getAttribute('data-status') === 'active', 'the active status')
    expect(fetch).not.toHaveBeenCalled()
    // an incomplete entry says how long a code and a key are
    await act(async () => { $<HTMLButtonElement>('[data-qa=renew]')!.click() })
    await type('ABCD-EFGH')
    await pressActivate()
    expect(fieldError()).toBe(en('license.err.incomplete'))
  })
})
