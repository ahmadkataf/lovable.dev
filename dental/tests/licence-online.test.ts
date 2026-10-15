// Licence keys in the app (src/license/online.ts, docs/LICENCE-KEYS.md): reading a key out of whatever the clinic
// pastes, the one request to the activation server, and the reason the screen shows for every answer it can get.
import { ACTIVATION_PAGE, ACTIVATION_PAGE_EN, ACTIVATION_URL, REDEEM_TIMEOUT_MS, activationPageUrl, extractKey, findKeys, formatKey, isLicenceKey, redeemKey } from '../src/license/online'
import { translate } from '../src/i18n'
import license from '../src/i18n/modules/license'

const KEY = 'ABCD-EFGH-JKLM-NPQR'
const DEVICE = '2345-ABCD'
const CODE = Array.from({ length: 28 }, () => 'WXYZ').join('-')

describe('reading a licence key', () => {
  it('takes a key in any case, with or without dashes or spaces, with Arabic-Indic digits', () => {
    expect(isLicenceKey(KEY)).toBe(true)
    expect(isLicenceKey('abcd-efgh-jklm-npqr')).toBe(true)
    expect(isLicenceKey('ABCDEFGHJKLMNPQR')).toBe(true)
    expect(isLicenceKey(' abcd efgh\njklm npqr ')).toBe(true)
    expect(isLicenceKey('٢٣٤٥-٦٧٨٩-ABCD-EFGH')).toBe(true)
    // the dashes and marks messaging apps put in: en dash, em dash, tatweel, a left-to-right mark
    expect(isLicenceKey('‎2345–6789—abcdـefgh')).toBe(true)
    expect(formatKey('٢٣٤٥ ٦٧٨٩ abcd efgh')).toBe('2345-6789-ABCD-EFGH')
    expect(formatKey('abcdefghjklmnpqr')).toBe(KEY)
  })
  it('refuses what is not a key: 0/O/1/I, a wrong length, an activation code', () => {
    for (const s of ['ABCD-EFGH-JKLM-NPQO', 'ABCD-EFGH-JKLM-NPQ1', 'ABCD-EFGH-JKLM-NPQI', 'ABCD-EFGH-JKLM-NP0R', 'ABCD-EFGH-JKLM-NPQ', 'ABCD-EFGH-JKLM-NPQR-S', '', CODE]) {
      expect(isLicenceKey(s), s).toBe(false)
    }
  })
  it('finds the key inside the seller’s whole message, in Arabic or English', () => {
    const ar = `مرحباً د. سامي،\nهذا مفتاح ترخيص برنامج Dentora الخاص بكم:\n‎${KEY.toLowerCase()}\nالباقة الاحترافية — ترخيص دائم\nhttps://dentora.raqeem.dev/activate\nيعمل المفتاح على جهاز واحد فقط. شكراً لثقتكم!`
    expect(extractKey(ar)).toBe(KEY)
    const en = `Hello Dr. Sami,\nHere is your Dentora licence key:\n${KEY}\nPro plan — valid for one year from activation\nhttps://dentora.raqeem.dev/en/activate\nThe key works on one device only. Thank you!`
    expect(extractKey(en)).toBe(KEY)
    expect(extractKey(`${KEY}\n${KEY}`)).toBe(KEY)                                // the same key twice
    expect(extractKey(`${KEY}\n2345-6789-ABCD-EFGH`)).toBeNull()                   // two keys: the clinic must choose
    expect(findKeys(`${KEY}\n2345-6789-ABCD-EFGH\n${KEY.toLowerCase()}`)).toEqual([KEY, '2345-6789-ABCD-EFGH'])   // … and is told which
    expect(findKeys(` abcd efgh\njklm npqr `)).toEqual([KEY])
    expect(findKeys('ABCD-EF')).toEqual([])
    expect(extractKey(`Here is your activation code:\n${CODE}`)).toBeNull()        // groups of a code are not a key
    expect(extractKey('ABCD-EF')).toBeNull()
  })
  it('opens the activation page for this device, in the interface language', () => {
    expect(activationPageUrl(DEVICE, 'ar')).toBe(`${ACTIVATION_PAGE}?device=${DEVICE}`)
    expect(activationPageUrl('2345abcd', 'en')).toBe(`${ACTIVATION_PAGE_EN}?device=${DEVICE}`)
    expect(activationPageUrl('', 'en')).toBe('https://dentora.raqeem.dev/en/activate')
    expect(ACTIVATION_PAGE).toBe('https://dentora.raqeem.dev/activate')
    expect(ACTIVATION_URL).toBe('https://dentora.raqeem.dev/api/activate')
  })
})

describe('redeeming a key', () => {
  const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
  const answer = (res: Response | (() => Promise<Response>)) => {
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) => (typeof res === 'function' ? res() : res))
    vi.stubGlobal('fetch', fetch)
    return fetch
  }
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

  it('sends only the key and the device number, without cookies, referrer or cache', async () => {
    const fetch = answer(json(200, { code: CODE, device: DEVICE, plan: 'pro', until: null }))
    expect(await redeemKey('abcd efgh jklm npqr', '2345abcd')).toEqual({ ok: true, code: CODE })
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe(ACTIVATION_URL)
    expect(init).toMatchObject({ method: 'POST', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', headers: { 'Content-Type': 'application/json' } })
    expect(JSON.parse(String(init!.body))).toEqual({ key: KEY, device: DEVICE })
    expect(init!.signal).toBeInstanceOf(AbortSignal)
  })

  it('maps every answer of the server to its reason', async () => {
    const cases: [Response, unknown][] = [
      [json(400, { error: 'key' }), { ok: false, reason: 'key' }],
      [json(400, { error: 'device' }), { ok: false, reason: 'device' }],
      [json(400, { error: 'field', field: 'body' }), { ok: false, reason: 'server' }],
      [json(404, { error: 'unknown' }), { ok: false, reason: 'unknown' }],
      [json(409, { error: 'used' }), { ok: false, reason: 'used' }],
      [json(410, { error: 'void' }), { ok: false, reason: 'void' }],
      [json(410, { error: 'expired' }), { ok: false, reason: 'expired' }],
      [json(429, { error: 'locked', retryAfter: 600 }), { ok: false, reason: 'locked', retryAfter: 600 }],
      [json(429, { error: 'locked', retryAfter: 59.2 }), { ok: false, reason: 'locked', retryAfter: 60 }],
      [json(429, '', { 'Retry-After': '120' }), { ok: false, reason: 'locked', retryAfter: 120 }],
      [json(429, 'Too Many Requests'), { ok: false, reason: 'locked' }],
      [json(503, { error: 'signing' }), { ok: false, reason: 'server' }],
      [json(500, { error: 'internal' }), { ok: false, reason: 'server' }],
      [json(502, '<html>Bad gateway</html>'), { ok: false, reason: 'server' }],
      // a 404 that is not the server's "no such key" (a proxy page, a route not deployed) is not "unknown"
      [json(404, '<html>Not found</html>'), { ok: false, reason: 'server' }],
      [json(404, { error: 'not_found' }), { ok: false, reason: 'server' }],
      // a refusal status with another status's error is not believed either
      [json(409, { error: 'void' }), { ok: false, reason: 'server' }],
      [json(410, { error: 'used' }), { ok: false, reason: 'server' }],
    ]
    for (const [res, want] of cases) {
      answer(res)
      expect(await redeemKey(KEY, DEVICE), `${res.status}`).toEqual(want)
    }
  })

  it('reads a malformed success as a server failure', async () => {
    for (const body of ['not json', '<html>Sign in to the Wi-Fi</html>', '', 'null', '[]', '{}', '{"code":""}', '{"code":42}']) {
      answer(json(200, body))
      expect(await redeemKey(KEY, DEVICE), body).toEqual({ ok: false, reason: 'server' })
    }
  })

  it('calls a network error offline', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    expect(await redeemKey(KEY, DEVICE)).toEqual({ ok: false, reason: 'offline' })
  })

  it('calls an answer cut off before its body arrived offline (the connection dropped), not a server failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, headers: new Headers(), json: () => Promise.reject(new TypeError('network error')) }) as unknown as Response))
    expect(await redeemKey(KEY, DEVICE)).toEqual({ ok: false, reason: 'offline' })
  })

  it('gives up after 20 seconds without an answer, or without the rest of it', async () => {
    vi.useFakeTimers()
    // no answer at all
    let signal: AbortSignal | undefined
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      signal = init?.signal ?? undefined
      signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })))
    let done: unknown = null
    void redeemKey(KEY, DEVICE).then(r => { done = r })
    await vi.advanceTimersByTimeAsync(REDEEM_TIMEOUT_MS - 100)
    expect(done).toBeNull()
    expect(signal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(200)
    expect(done).toEqual({ ok: false, reason: 'offline' })
    // the status arrives, the body never does
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => ({
      ok: true, status: 200, headers: new Headers(),
      json: () => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
    }) as unknown as Response))
    done = null
    void redeemKey(KEY, DEVICE).then(r => { done = r })
    await vi.advanceTimersByTimeAsync(REDEEM_TIMEOUT_MS + 100)
    expect(done).toEqual({ ok: false, reason: 'offline' })
  })

  it('has a sentence for every reason, in Arabic and English', () => {
    for (const reason of ['offline', 'key', 'device', 'unknown', 'used', 'void', 'expired', 'locked', 'server', 'lockedSoon', 'check', 'ended', 'many']) {
      for (const lang of ['ar', 'en'] as const) expect(license[lang][`key.err.${reason}`], `${lang} key.err.${reason}`).toBeTruthy()
    }
    expect(translate('ar', 'license.key.err.locked', { n: 1 })).toContain('دقيقة واحدة')
    expect(translate('ar', 'license.key.err.locked', { n: 2 })).toContain('دقيقتين')
    expect(translate('ar', 'license.key.err.locked', { n: 10 })).toContain('10 دقائق')
    expect(translate('ar', 'license.key.err.locked', { n: 15 })).toContain('15 دقيقة')
    expect(translate('en', 'license.key.err.locked', { n: 1 })).toContain('a minute')
    expect(translate('en', 'license.key.err.locked', { n: 15 })).toContain('15 minutes')
    // the address stays in one piece inside Arabic text
    expect(license.ar['key.hint']).toContain('⁦dentora.raqeem.dev⁩')
    expect(license.ar['key.browserHint']).toContain('⁦{url}⁩')
  })
})
