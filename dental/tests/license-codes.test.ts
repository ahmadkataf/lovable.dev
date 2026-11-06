// Activation codes pasted inside the seller's whole message, and the admin PIN reset codes.
import {
  CODE_CHARS, RESET_KIND, checkCode, checkResetCode, cleanCode, codeKind, dayNumber, deviceNumber, expiryDay, extractCode, formatCode, fromBase32, packCode, packResetCode,
  resetMessage, signedMessage, type Plan,
} from '../src/license/core'
import { clinicMessage, issueCode, issueResetCode, resetClinicMessage, toCSV } from '../tools/generator-lib'

async function testKeys() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  return { priv: kp.privateKey, pub: await crypto.subtle.exportKey('jwk', kp.publicKey) }
}
async function sign(priv: CryptoKey, device: string, plan: Plan, until: Date | null) {
  const day = expiryDay(until)
  return packCode(plan, day, new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, signedMessage(device, plan, day))))
}
async function signReset(priv: CryptoKey, device: string, day: number) {
  return packResetCode(day, new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, resetMessage(device, day))))
}

describe('pasting the seller’s whole message into the activation field', () => {
  it('finds the code in the Arabic and the English message the generator writes', async () => {
    const k = await testKeys()
    const device = await deviceNumber('clinic-pc')
    const issued = await issueCode(device, 'pro', new Date(Date.UTC(2027, 9, 11)), k.priv, k.pub)
    for (const lang of ['ar', 'en'] as const) {
      const msg = clinicMessage(issued, lang, 'عيادة النور')
      expect(cleanCode(msg)).not.toHaveLength(CODE_CHARS)                     // the old cleaning kept "DENTORA" and the device
      expect(extractCode(msg)).toBe(cleanCode(issued.code))
      expect((await checkCode(device, msg, new Date(Date.UTC(2026, 9, 11)), k.pub)).ok).toBe(true)
    }
  })
  it('copes with what messaging apps do to the text', async () => {
    const k = await testKeys()
    const device = await deviceNumber('x')
    const code = await sign(k.priv, device, 'standard', null)
    const clean = cleanCode(code)
    const variants = [
      code,
      code.toLowerCase(),
      code.replace(/-/g, ' '),
      clean,
      `Here is the code:\n‎${code}\nThanks`,
      // a word made only of code letters right before the code, and the device number right after it
      `THE\n${code}\nDevice: ${device}`,
      `WXYZ ${code.replace(/-/g, ' ')} ${device}`,
      // wrapped by the messaging app into lines of uneven length
      clean.replace(/(.{37})/g, '$1\n'),
      // Arabic-Indic digits typed by a phone keyboard
      `الرمز: ${code.replace(/[2-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)])}`,
    ]
    for (const v of variants) expect(extractCode(v), v).toBe(clean)
  })
  it('keeps every character while a code is typed by hand, and reports a typo as a typo', async () => {
    expect(extractCode('abcd-ef')).toBe('ABCDEF')
    const k = await testKeys()
    const device = await deviceNumber('y')
    const clean = cleanCode(await sign(k.priv, device, 'pro', null))
    const typo = clean.slice(0, 50) + (clean[50] === 'Z' ? 'Y' : 'Z') + clean.slice(51)
    expect(extractCode(`Your code:\n${formatCode(typo)}\nDevice ${device}`)).toBe(typo)
    expect(await checkCode(device, typo, new Date(), k.pub)).toEqual({ ok: false, reason: 'format' })
  })
})

describe('admin PIN reset codes', () => {
  const today = dayNumber(new Date(Date.UTC(2026, 9, 11, 12)))
  const at = (dayOffset: number, hour = 12) => new Date(Date.UTC(2026, 9, 11 + dayOffset, hour))

  it('signs "dentora|reset|<device>|<day>" and works on that device, that day and the next', async () => {
    const k = await testKeys()
    const device = await deviceNumber('clinic-pc')
    expect(new TextDecoder().decode(resetMessage(device.toLowerCase(), today))).toBe(`dentora|reset|${device.replace('-', '')}|${today}`)
    const code = await signReset(k.priv, device, today)
    expect(cleanCode(code)).toHaveLength(CODE_CHARS)
    expect(fromBase32(cleanCode(code))![0]).toBe(RESET_KIND)
    expect(codeKind(code)).toBe('reset')
    expect(await checkResetCode(device, code, at(0), k.pub)).toEqual({ ok: true, day: today })
    expect(await checkResetCode(device, code, at(1, 23), k.pub)).toEqual({ ok: true, day: today })
    expect(await checkResetCode(device, code, at(2, 0), k.pub)).toEqual({ ok: false, reason: 'expired' })
    // a device clock a day behind the seller's still accepts it; a week behind does not
    expect((await checkResetCode(device, code, at(-1), k.pub)).ok).toBe(true)
    expect(await checkResetCode(device, code, at(-7), k.pub)).toEqual({ ok: false, reason: 'expired' })
  })
  it('belongs to one device and cannot be mistaken for an activation code (or the reverse)', async () => {
    const k = await testKeys()
    const a = await deviceNumber('a'), b = await deviceNumber('b')
    const reset = await signReset(k.priv, a, today)
    expect(await checkResetCode(b, reset, at(0), k.pub)).toEqual({ ok: false, reason: 'device' })
    expect(await checkCode(a, reset, at(0), k.pub)).toEqual({ ok: false, reason: 'kind' })
    const activation = await sign(k.priv, a, 'pro', null)
    expect(codeKind(activation)).toBe('activation')
    expect(await checkResetCode(a, activation, at(0), k.pub)).toEqual({ ok: false, reason: 'kind' })
    expect(await checkResetCode(a, 'nonsense', at(0), k.pub)).toEqual({ ok: false, reason: 'format' })
    // the app's own key refuses a reset code signed by any other key
    expect(await checkResetCode(a, reset, at(0))).toEqual({ ok: false, reason: 'device' })
  })
  it('the seller tools issue it, check it back and write a message the app reads the code from', async () => {
    const k = await testKeys()
    const device = await deviceNumber('clinic-pc')
    const issued = await issueResetCode(device.toLowerCase().replace('-', ''), k.priv, at(0), k.pub)
    expect(issued).toMatchObject({ device, day: '2026-10-11', lastDay: '2026-10-12' })
    for (const lang of ['ar', 'en'] as const) {
      const msg = resetClinicMessage(issued, lang)
      expect(msg).toContain(lang === 'ar' ? 'نسيت رمز الدخول؟' : 'Forgot your PIN?')
      expect(await checkResetCode(device, msg, at(1), k.pub)).toEqual({ ok: true, day: today })
    }
    await expect(issueResetCode('nope', k.priv, at(0), k.pub)).rejects.toThrow('device')
    await expect(issueResetCode(device, k.priv, at(0))).rejects.toThrow('self-check')   // not the app's key
    const csv = toCSV([{ code: issued.code, device, until: issued.lastDay, kind: 'reset', note: '', at: '2026-10-11T10:00:00Z' }])
    expect(csv).toContain(`,${device},pin-reset,2026-10-12,`)
  })
})
