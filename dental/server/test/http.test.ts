import { describe, expect, it } from 'vitest'
import { b64url, csvCell, escapeHtml, fromB64url, readJson, timingSafeEqual, toCsv } from '../src/http'

describe('escapeHtml', () => {
  it('escapes markup and both quotes', () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;')
  })
  it('turns null and numbers into text', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(59)).toBe('59')
  })
})

describe('base64url', () => {
  it('round-trips any bytes without padding or + /', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i)
    const s = b64url(bytes)
    expect(s).not.toMatch(/[+/=]/)
    expect(Array.from(fromB64url(s)!)).toEqual(Array.from(bytes))
  })
  it('rejects characters outside the alphabet', () => {
    expect(fromB64url('ab+c')).toBeNull()
    expect(fromB64url('ab c')).toBeNull()
  })
})

describe('timingSafeEqual', () => {
  it('compares bytes', () => {
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true)
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false)
    expect(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false)
  })
})

describe('CSV', () => {
  it('quotes commas, quotes and line breaks', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('two\nlines')).toBe('"two\nlines"')
    expect(csvCell(null)).toBe('')
    expect(csvCell(59.5)).toBe('59.5')
  })
  it('defuses cells Excel would run as formulas', () => {
    expect(csvCell('=HYPERLINK("http://x","y")')).toBe(`"'=HYPERLINK(""http://x"",""y"")"`)
    expect(csvCell('+963 996 489 504')).toBe("'+963 996 489 504")
    expect(csvCell('-1')).toBe("'-1")
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(csvCell('عيادة النور')).toBe('عيادة النور')
  })
  it('starts with a BOM and ends lines with CRLF', () => {
    const csv = toCsv(['a', 'b'], [['عيادة', 1], ['x,y', null]])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toBe('\uFEFFa,b\r\nعيادة,1\r\n"x,y",\r\n')
  })
})

describe('readJson', () => {
  const req = (body: string, headers: Record<string, string> = {}) => new Request('https://x/api', { method: 'POST', body, headers })
  it('reads an object', async () => {
    expect(await readJson(req('{"a":1}'))).toEqual({ a: 1 })
    expect(await readJson(req(''))).toEqual({})
  })
  it('refuses arrays, invalid JSON and large bodies', async () => {
    expect(await readJson(req('[1]'))).toBeNull()
    expect(await readJson(req('{oops'))).toBeNull()
    expect(await readJson(req(JSON.stringify({ a: 'x'.repeat(20_000) })))).toBeNull()
  })
})
