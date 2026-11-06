// The seller's WhatsApp on the licence screen: shown on Windows, the web build and an APK the seller shares, also when
// the phone does not report who installed the app (many phones, for an APK opened from a file); hidden only in a copy
// installed from Google Play (Play payments policy). The legal texts list only the contacts that are set.
import { installSource } from '../src/platform'
import { SELLER, sellerShown } from '../src/features/settings/seller'
import { whatsappLink } from '../src/lib/format'
import { sellerContact } from '../src/features/legal/lib'

// only the methods these checks use: a stand-in for the phone's bridge
const setAndroid = (bridge: Record<string, unknown> | undefined) => { (window as unknown as { DentoraAndroid?: unknown }).DentoraAndroid = bridge }

describe('install source and the seller box', () => {
  afterEach(() => setAndroid(undefined))

  it('Windows / web: direct, the seller box shows', () => {
    expect(installSource()).toBe('direct')
    expect(sellerShown()).toBe(true)
  })

  it('Android from Google Play: hidden', () => {
    setAndroid({ deviceId: () => 'x', installSource: () => 'com.android.vending' })
    expect(installSource()).toBe('play')
    expect(sellerShown()).toBe(false)
  })

  it('Android, an APK shared by the seller (system installer, a file manager, WhatsApp): shown', () => {
    for (const pkg of ['com.google.android.packageinstaller', 'com.android.packageinstaller', 'com.samsung.android.packageinstaller']) {
      setAndroid({ deviceId: () => 'x', installSource: () => pkg })
      expect(installSource(), pkg).toBe('direct')
      expect(sellerShown(), pkg).toBe(true)
    }
  })

  it('Android where the phone does not say who installed it (a sideload on many phones, adb) or an older shell: shown', () => {
    for (const bridge of [
      { deviceId: () => 'x', installSource: () => '' },
      { deviceId: () => 'x' },
      { deviceId: () => 'x', installSource: () => { throw new Error('bridge') } },
    ]) {
      setAndroid(bridge)
      expect(installSource()).toBe('unknown')
      expect(sellerShown()).toBe(true)
    }
  })
})

describe('seller contacts', () => {
  it('the WhatsApp button opens a chat with the seller, the request already written', () => {
    expect(SELLER.whatsapp).toBe('+963 996 489 504')
    const link = whatsappLink(SELLER.whatsapp, 'رقم الجهاز: ABCD-1234')
    expect(link.startsWith('https://wa.me/963996489504?text=')).toBe(true)
    expect(decodeURIComponent(link.split('?text=')[1])).toBe('رقم الجهاز: ABCD-1234')
  })

  it('the legal contact line leaves out an empty contact', () => {
    for (const lang of ['ar', 'en'] as const) {
      const line = sellerContact(lang)
      expect(line).toContain(SELLER.whatsapp)
      if (!SELLER.email) expect(line).not.toMatch(/البريد الإلكتروني|email/)
    }
  })
})
