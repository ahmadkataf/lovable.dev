import {
  CURRENCIES, CUSTOM_CURRENCY, FRESH_GUARD, LOCK_MS, MAX_ATTEMPTS, attemptsLeft, buildClinicPatch, cleanCurrencyCode, currencyPreset, defaultDecimals, displayName,
  dotCount, formatCountdown, greetingKey, isEmail, isLocked, isPhone, lockRemaining, normalizeDigits, normalizeGuard, orderedDays, parseGuard, pinError, pinErrorKey,
  plainName, registerFailure, resolveCurrency, sanitizePin, toggleDay, validateClinicStep, validateMoneyStep, validateOwnerStep, type MoneyDraft, type OwnerDraft,
} from '../src/features/auth/lib'
import {
  AREAS, ROLES, ROLE_PERMS, STAFF_COLORS, activeAdmins, deactivateBlock, deleteBlock, filterStaff, lastLoginMap, nextFreeColor, roleAreas, roleCan, saveBlock, sortStaff,
  validateStaff, type StaffDraft,
} from '../src/features/staff/lib'
import { hashPin, isValidPin, verifyPin } from '../src/lib/crypto'
import { translate } from '../src/i18n'
import auth from '../src/i18n/modules/auth'
import staff from '../src/i18n/modules/staff'
import type { Role, User } from '../src/db/types'

describe('auth: currency presets', () => {
  it('maps every preset code to its symbol and decimals', () => {
    expect(currencyPreset('SYP')).toEqual({ code: 'SYP', symbol: 'ل.س', decimals: 0 })
    expect(currencyPreset('sar')?.symbol).toBe('ر.س')
    expect(currencyPreset('AED')?.symbol).toBe('د.إ')
    expect(currencyPreset('TRY')?.symbol).toBe('₺')
    expect(currencyPreset('XXX')).toBeUndefined()
    expect(CURRENCIES.map(c => c.code)).toEqual(['USD', 'SYP', 'SAR', 'AED', 'EGP', 'JOD', 'IQD', 'KWD', 'QAR', 'OMR', 'BHD', 'LBP', 'TRY', 'EUR', 'GBP', 'MAD', 'DZD', 'TND', 'LYD'])
    expect(new Set(CURRENCIES.map(c => c.code)).size).toBe(CURRENCIES.length)
  })
  it('chooses decimals by currency (weak currencies without cents)', () => {
    expect(defaultDecimals('SYP')).toBe(0)
    expect(defaultDecimals('IQD')).toBe(0)
    expect(defaultDecimals('LBP')).toBe(0)
    expect(defaultDecimals('USD')).toBe(2)
    expect(defaultDecimals('KWD')).toBe(2)
    expect(defaultDecimals('YER')).toBe(2)       // unknown → 2
    for (const c of CURRENCIES) expect([0, 2]).toContain(c.decimals)
  })
  it('resolves presets and custom currencies into clinic fields', () => {
    const base = { customCode: '', customSymbol: '', decimals: 2 as const }
    expect(resolveCurrency({ ...base, currency: 'EGP' })).toEqual({ currency: 'EGP', currencySymbol: 'ج.م', currencyDecimals: 2 })
    expect(resolveCurrency({ ...base, currency: 'SYP', decimals: 0 })).toEqual({ currency: 'SYP', currencySymbol: 'ل.س', currencyDecimals: 0 })
    expect(resolveCurrency({ currency: CUSTOM_CURRENCY, customCode: 'yer', customSymbol: ' ر.ي ', decimals: 0 })).toEqual({ currency: 'YER', currencySymbol: 'ر.ي', currencyDecimals: 0 })
    expect(resolveCurrency({ currency: CUSTOM_CURRENCY, customCode: 'sdg', customSymbol: '', decimals: 2 }).currencySymbol).toBe('SDG')
    expect(cleanCurrencyCode('y-e r1x9z')).toBe('YERX')
  })
  it('every preset has a name in both languages', () => {
    for (const c of CURRENCIES) {
      expect(auth.ar[`cur.${c.code}`], c.code).toBeTruthy()
      expect(auth.en[`cur.${c.code}`], c.code).toBeTruthy()
    }
  })
})

describe('auth: PIN validation', () => {
  it('keeps digits only, converts Arabic-Indic digits, caps at 6', () => {
    expect(normalizeDigits('١٢٣٤')).toBe('1234')
    expect(normalizeDigits('۵۶')).toBe('56')
    expect(sanitizePin('12a3 4')).toBe('1234')
    expect(sanitizePin('٠٩٨٧٦٥٤٣')).toBe('098765')
    expect(sanitizePin('')).toBe('')
  })
  it('requires 4–6 digits and a matching confirmation', () => {
    expect(pinError('')).toBe('required')
    expect(pinError('123')).toBe('format')
    expect(pinError('1234567')).toBe('format')
    expect(pinError('12a4')).toBe('format')
    expect(pinError('1234')).toBeNull()
    expect(pinError('123456')).toBeNull()
    expect(pinError('1234', '1243')).toBe('mismatch')
    expect(pinError('1234', '1234')).toBeNull()
    expect(pinErrorKey('format')).toBe('v.pin')
    expect(pinErrorKey('mismatch')).toBe('auth.v.pinMismatch')
    // agrees with the crypto helper the session uses
    for (const p of ['1234', '99999', '000000', '123', '1234567', 'abcd']) expect(pinError(p) === null).toBe(isValidPin(p))
  })
  it('hashes with the salt and verifies', async () => {
    const h = await hashPin('2468', 'salt-a')
    expect(await verifyPin('2468', 'salt-a', h)).toBe(true)
    expect(await verifyPin('2469', 'salt-a', h)).toBe(false)
    expect(await verifyPin('2468', 'salt-b', h)).toBe(false)
  })
  it('shows 4 dots, one spare after the 4th digit, at most 6', () => {
    expect([0, 1, 3, 4, 5, 6, 9].map(dotCount)).toEqual([4, 4, 4, 5, 6, 6, 6])
  })
})

describe('auth: lockout timing', () => {
  const t0 = 1_000_000
  it('locks for 30 s after 5 wrong PINs in a row', () => {
    let g = FRESH_GUARD
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      g = registerFailure(g, t0 + i)
      expect(isLocked(g, t0 + i)).toBe(false)
      expect(attemptsLeft(g, t0 + i)).toBe(MAX_ATTEMPTS - i)
    }
    g = registerFailure(g, t0 + 10)
    expect(isLocked(g, t0 + 10)).toBe(true)
    expect(attemptsLeft(g, t0 + 10)).toBe(0)
    expect(lockRemaining(g, t0 + 10)).toBe(LOCK_MS)
    expect(lockRemaining(g, t0 + 10 + 5000)).toBe(LOCK_MS - 5000)
    expect(isLocked(g, t0 + 10 + LOCK_MS - 1)).toBe(true)
    expect(isLocked(g, t0 + 10 + LOCK_MS)).toBe(false)
  })
  it('ignores attempts while locked and starts a fresh round afterwards', () => {
    let g = FRESH_GUARD
    for (let i = 0; i < MAX_ATTEMPTS; i++) g = registerFailure(g, t0)
    const locked = registerFailure(g, t0 + 1000)
    expect(locked).toEqual(g)                         // no extension while locked
    const after = t0 + LOCK_MS + 1
    expect(normalizeGuard(g, after)).toEqual(FRESH_GUARD)
    expect(attemptsLeft(g, after)).toBe(MAX_ATTEMPTS)
    const next = registerFailure(g, after)
    expect(next).toEqual({ fails: 1, until: 0 })
  })
  it('reads the stored guard defensively and formats the countdown', () => {
    expect(parseGuard(null)).toEqual(FRESH_GUARD)
    expect(parseGuard('nonsense')).toEqual(FRESH_GUARD)
    expect(parseGuard('{"fails":-1,"until":0}')).toEqual(FRESH_GUARD)
    expect(parseGuard('{"fails":3,"until":123}')).toEqual({ fails: 3, until: 123 })
    expect(formatCountdown(30_000)).toBe('0:30')
    expect(formatCountdown(25_100)).toBe('0:26')
    expect(formatCountdown(61_000)).toBe('1:01')
    expect(formatCountdown(-5)).toBe('0:00')
  })
})

describe('auth: setup wizard steps', () => {
  const money: MoneyDraft = { currency: 'USD', customCode: '', customSymbol: '', decimals: 2, workingDays: [0, 1, 2, 3, 4, 6], workStart: '09:00', workEnd: '18:00', slotMinutes: 30, taxPercent: null }
  const owner: OwnerDraft = { name: 'أحمد الخطيب', title: 'د.', specialty: '', phone: '', pin: '1234', pin2: '1234' }
  it('validates the clinic step', () => {
    expect(validateClinicStep({ name: '', phone: '', address: '', email: '' })).toEqual({ name: 'v.required' })
    expect(validateClinicStep({ name: 'عيادة', phone: '12', address: '', email: 'x@' })).toEqual({ phone: 'v.phone', email: 'v.email' })
    expect(validateClinicStep({ name: 'عيادة', phone: '0944 123 456', address: '', email: 'a@b.co' })).toEqual({})
    expect(isPhone('+963 944-123-456')).toBe(true)
    expect(isPhone('٠٩٤٤١٢٣٤٥٦')).toBe(true)
    expect(isPhone('call me')).toBe(false)
    expect(isEmail('clinic@example.com')).toBe(true)
    expect(isEmail('clinic@example')).toBe(false)
  })
  it('validates currency, days, hours and tax', () => {
    expect(validateMoneyStep(money)).toEqual({})
    expect(validateMoneyStep({ ...money, workingDays: [] })).toEqual({ workingDays: 'auth.v.days' })
    expect(validateMoneyStep({ ...money, workEnd: '09:00' })).toEqual({ workEnd: 'auth.v.hours' })
    expect(validateMoneyStep({ ...money, workStart: '' })).toEqual({ workStart: 'v.required' })
    expect(validateMoneyStep({ ...money, taxPercent: 120 })).toEqual({ taxPercent: 'auth.v.tax' })
    expect(validateMoneyStep({ ...money, taxPercent: 0 })).toEqual({})
    expect(validateMoneyStep({ ...money, currency: CUSTOM_CURRENCY })).toEqual({ customCode: 'v.required', customSymbol: 'v.required' })
    expect(validateMoneyStep({ ...money, currency: CUSTOM_CURRENCY, customCode: 'Y', customSymbol: 'ر.ي' })).toEqual({ customCode: 'auth.v.code' })
    expect(validateMoneyStep({ ...money, currency: CUSTOM_CURRENCY, customCode: 'YER', customSymbol: 'ر.ي' })).toEqual({})
  })
  it('validates the owner step', () => {
    expect(validateOwnerStep(owner)).toEqual({})
    expect(validateOwnerStep({ ...owner, name: ' ' })).toEqual({ name: 'v.required' })
    expect(validateOwnerStep({ ...owner, pin: '12', pin2: '12' })).toEqual({ pin: 'v.pin' })
    expect(validateOwnerStep({ ...owner, pin2: '' })).toEqual({ pin2: 'v.required' })
    expect(validateOwnerStep({ ...owner, pin2: '4321' })).toEqual({ pin2: 'auth.v.pinMismatch' })
  })
  it('working days toggle and display Saturday first', () => {
    expect(toggleDay([0, 1, 6], 1)).toEqual([0, 6])
    expect(toggleDay([0, 6], 3)).toEqual([0, 3, 6])
    expect(orderedDays([0, 1, 2, 3, 4, 6])).toEqual([6, 0, 1, 2, 3, 4])
  })
  it('builds the clinic patch', () => {
    const p = buildClinicPatch('ar', { name: '  عيادة الابتسامة ', phone: '', address: 'دمشق', email: '' }, { ...money, currency: 'SYP', decimals: 0, slotMinutes: 15, taxPercent: 5, workingDays: [6, 0, 1] })
    expect(p).toMatchObject({ name: 'عيادة الابتسامة', address: 'دمشق', currency: 'SYP', currencySymbol: 'ل.س', currencyDecimals: 0, lang: 'ar', slotMinutes: 15, defaultAppointmentMinutes: 30, taxPercent: 5, workingDays: [0, 1, 6] })
    expect(p.phone).toBeUndefined()
    expect(buildClinicPatch('en', { name: 'A', phone: '', address: '', email: '' }, { ...money, slotMinutes: 60 }).defaultAppointmentMinutes).toBe(60)
    expect(buildClinicPatch('en', { name: 'A', phone: '', address: '', email: '' }, { ...money, taxPercent: null }).taxPercent).toBe(0)
  })
  it('names and greetings', () => {
    expect(displayName({ name: 'أحمد الخطيب', title: 'د.' })).toBe('د. أحمد الخطيب')
    expect(displayName({ name: 'د. ليلى حداد', title: 'د.' })).toBe('د. ليلى حداد')
    expect(displayName({ name: 'Sara' })).toBe('Sara')
    expect(plainName('د. أحمد الخطيب')).toBe('أحمد الخطيب')
    expect(plainName('Dr. John Smith')).toBe('John Smith')
    expect(plainName('Dr')).toBe('Dr')
    expect(greetingKey(8)).toBe('goodMorning')
    expect(greetingKey(15)).toBe('goodEvening')
    expect(greetingKey(2)).toBe('goodEvening')
  })
})

describe('staff: roles and guards', () => {
  const u = (id: string, role: Role, active = true, extra: Partial<User> = {}): User => ({ id, name: id, role, active, pinHash: '', pinSalt: '', color: '#0E8F86', createdAt: '', updatedAt: '', ...extra })
  const team = [u('owner', 'admin'), u('doc', 'doctor'), u('rec', 'receptionist'), u('old', 'assistant', false)]

  it('permission matrix', () => {
    expect(roleAreas('admin')).toEqual(AREAS)
    expect(roleCan('doctor', 'staff')).toBe(false)
    expect(roleCan('receptionist', 'clinical')).toBe(false)
    expect(roleCan('receptionist', 'billing')).toBe(true)
    expect(roleCan('assistant', 'billing')).toBe(false)
    expect(new Set(AREAS).size).toBe(9)
    for (const r of ROLES) for (const p of ROLE_PERMS[r]) expect(AREAS).toContain(p)
    for (const r of ROLES) { expect(staff.ar[`roleDesc.${r}`]).toBeTruthy(); expect(staff.en[`roleDesc.${r}`]).toBeTruthy() }
  })
  it('never leaves the clinic without an active admin', () => {
    expect(activeAdmins(team).map(x => x.id)).toEqual(['owner'])
    expect(deactivateBlock(team[0], team, 'doc')).toBe('lastAdmin')
    expect(deactivateBlock(team[0], team, 'owner')).toBe('self')
    expect(deactivateBlock(team[1], team, 'owner')).toBeNull()
    expect(deleteBlock(team[0], team, 'doc')).toBe('lastAdmin')
    expect(deleteBlock(team[1], team, 'doc')).toBe('self')
    expect(deleteBlock(team[2], team, 'owner')).toBeNull()
    expect(saveBlock(team[0], { role: 'doctor', active: true }, team, 'doc')).toBe('lastAdmin')
    expect(saveBlock(team[0], { role: 'admin', active: false }, team, 'doc')).toBe('lastAdmin')
    expect(saveBlock(team[0], { role: 'admin', active: true }, team, 'owner')).toBeNull()
    expect(saveBlock(team[1], { role: 'doctor', active: false }, team, 'doc')).toBe('self')
    const two = [...team, u('admin2', 'admin')]
    expect(deactivateBlock(two[0], two, 'admin2')).toBeNull()
    expect(saveBlock(two[0], { role: 'doctor', active: true }, two, 'owner')).toBeNull()
    // an inactive second admin does not count
    const inactive2 = [...team, u('admin2', 'admin', false)]
    expect(deleteBlock(inactive2[0], inactive2, 'doc')).toBe('lastAdmin')
    expect(deleteBlock(inactive2[4], inactive2, 'owner')).toBeNull()
  })
  it('sorts, filters and finds the last sign-in', () => {
    expect(sortStaff([team[3], team[2], team[1], team[0]]).map(x => x.id)).toEqual(['owner', 'doc', 'rec', 'old'])
    expect(filterStaff(team, 'inactive').map(x => x.id)).toEqual(['old'])
    expect(filterStaff(team, 'active')).toHaveLength(3)
    expect(lastLoginMap([
      { action: 'login', by: 'doc', at: '2026-10-01T08:00:00.000Z' },
      { action: 'login', by: 'doc', at: '2026-10-03T08:00:00.000Z' },
      { action: 'create', by: 'rec', at: '2026-10-04T08:00:00.000Z' },
      { action: 'login', by: 'owner', at: '2026-10-02T08:00:00.000Z' },
    ])).toEqual({ doc: '2026-10-03T08:00:00.000Z', owner: '2026-10-02T08:00:00.000Z' })
  })
  it('picks a colour nobody active uses', () => {
    expect(nextFreeColor([])).toBe(STAFF_COLORS[0])
    expect(nextFreeColor([{ color: '#0e8f86', active: true }])).toBe(STAFF_COLORS[1])
    expect(nextFreeColor([{ color: STAFF_COLORS[0], active: false }])).toBe(STAFF_COLORS[0])
    expect(nextFreeColor(STAFF_COLORS.map(color => ({ color, active: true })))).toBe(STAFF_COLORS[0])
  })
  it('validates the member form', () => {
    const d: StaffDraft = { name: 'ليلى حداد', title: '', role: 'doctor', specialty: '', phone: '', email: '', color: STAFF_COLORS[0], active: true, pin: '1234', pin2: '1234' }
    expect(validateStaff(d, true)).toEqual({})
    expect(validateStaff({ ...d, name: '' }, true)).toEqual({ name: 'v.required' })
    expect(validateStaff(d, true, [{ name: 'ليلى  حداد'.replace('  ', ' ') }])).toEqual({ name: 'staff.v.duplicate' })
    expect(validateStaff({ ...d, pin: '', pin2: '' }, false)).toEqual({})
    expect(validateStaff({ ...d, pin: '12' }, true)).toEqual({ pin: 'v.pin' })
    expect(validateStaff({ ...d, pin2: '9999' }, true)).toEqual({ pin2: 'auth.v.pinMismatch' })
    expect(validateStaff({ ...d, email: 'nope', phone: 'x' }, false)).toEqual({ email: 'v.email', phone: 'v.phone' })
  })
})

describe('auth/staff dictionaries', () => {
  it('ar and en carry the same keys', () => {
    expect(Object.keys(auth.ar).sort()).toEqual(Object.keys(auth.en).sort())
    expect(Object.keys(staff.ar).sort()).toEqual(Object.keys(staff.en).sort())
  })
  it('resolves through the translator, with params', () => {
    expect(translate('ar', 'auth.setup.stepOf', { n: 2, total: 5 })).toBe('الخطوة 2 من 5')
    expect(translate('en', 'staff.toast.added', { name: 'Layla' })).toBe('Layla joined the team')
    expect(translate('en', 'auth.v.pinMismatch')).toBe('The two PINs do not match')
    for (const a of AREAS) expect(translate('ar', `staff.area.${a}`)).not.toBe(`area.${a}`)
  })
})
