// Settings → About → Help: the user guide and the video course open on the website, in the app's language, through
// the platform's openExternal (the Windows and Android shells hand the address to the system browser). The address is
// built by helpUrl() (src/features/settings/help.ts), which the account menu in the shell uses as well.
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { resetDatabase } from '../src/db'
import { I18nProvider, translate } from '../src/i18n'
import { ConfirmProvider, ToastProvider } from '../src/ui'
import { LicenseProvider } from '../src/license/useLicense'
import { SessionProvider } from '../src/app/session'
import AboutTab from '../src/features/settings/AboutTab'
import { helpUrl } from '../src/features/settings/help'
import { installSource, openExternal } from '../src/platform'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// the browser build would call window.open; here the platform's door is a spy
vi.mock('../src/platform', async importOriginal => ({
  ...(await importOriginal<typeof import('../src/platform')>()),
  openExternal: vi.fn(),
  installSource: vi.fn(() => 'unknown'),
}))

const SITE = 'https://dentora.raqeem.dev'

describe('help addresses', () => {
  it('point at the guide and the videos in the app’s language', () => {
    expect(helpUrl('guide', 'ar')).toBe(`${SITE}/guide`)
    expect(helpUrl('videos', 'ar')).toBe(`${SITE}/videos`)
    expect(helpUrl('guide', 'en')).toBe(`${SITE}/en/guide`)
    expect(helpUrl('videos', 'en')).toBe(`${SITE}/en/videos`)
  })
})

describe('Settings → About → Help', () => {
  let host: HTMLDivElement
  let root: Root
  const $ = <T extends Element = HTMLElement>(sel: string) => host.querySelector<T>(sel)
  const until = async (cond: () => boolean, what: string) => {
    for (let i = 0; i < 150 && !cond(); i++) await act(() => new Promise(r => setTimeout(r, 20)))
    if (!cond()) throw new Error(`timed out waiting for ${what}`)
  }
  const render = async (lang: 'ar' | 'en', wait = true) => {
    await resetDatabase(); localStorage.clear(); sessionStorage.clear()
    host = document.createElement('div'); document.body.appendChild(host)
    root = createRoot(host)
    await act(async () => {
      root.render(
        <I18nProvider initial={lang}><ToastProvider><ConfirmProvider><LicenseProvider><SessionProvider>
          <AboutTab />
        </SessionProvider></LicenseProvider></ConfirmProvider></ToastProvider></I18nProvider>,
      )
    })
    if (wait) await until(() => !!$('[data-qa=about-guide]') && !!$('[data-qa=about-videos]'), 'the About screen')
    else await until(() => !!host.textContent?.includes(translate(lang, 'settings.about.device')), 'the About screen')
  }
  afterEach(async () => {
    await act(async () => { root.unmount() })
    host.remove()
    vi.mocked(openExternal).mockClear()
    vi.mocked(installSource).mockReturnValue('unknown')
  })

  for (const [lang, guide, videos] of [['ar', `${SITE}/guide`, `${SITE}/videos`], ['en', `${SITE}/en/guide`, `${SITE}/en/videos`]] as const) {
    it(`${lang}: the two buttons open the guide and the videos through openExternal`, async () => {
      await render(lang)
      expect($('[data-qa=about-help]')!.textContent).toContain(translate(lang, 'settings.about.help'))
      expect($('[data-qa=about-guide]')!.textContent).toContain(translate(lang, 'settings.about.guide'))
      expect($('[data-qa=about-videos]')!.textContent).toContain(translate(lang, 'settings.about.videos'))
      await act(async () => { $('[data-qa=about-guide]')!.click() })
      expect(openExternal).toHaveBeenLastCalledWith(guide)
      await act(async () => { $('[data-qa=about-videos]')!.click() })
      expect(openExternal).toHaveBeenLastCalledWith(videos)
      expect(openExternal).toHaveBeenCalledTimes(2)
    })
  }

  it('is not shown in a copy installed from Google Play (the guide explains how to buy outside Play)', async () => {
    vi.mocked(installSource).mockReturnValue('play')
    await render('en', false)
    expect($('[data-qa=about-help]')).toBeNull()
    expect($('[data-qa=about-guide]')).toBeNull()
    expect(openExternal).not.toHaveBeenCalled()
  })

  it('is worded as help, never as a purchase', async () => {
    expect(translate('ar', 'settings.about.guide')).toBe('دليل الاستخدام')
    expect(translate('ar', 'settings.about.videos')).toBe('الفيديوهات التعليمية')
    expect(translate('ar', 'nav.help')).toBe('مساعدة')
    for (const lang of ['ar', 'en'] as const) {
      const words = ['help', 'helpSub', 'guide', 'guideSub', 'videos', 'videosSub'].map(k => translate(lang, `settings.about.${k}`)).join(' ')
      expect(words).not.toMatch(/buy|purchase|price|\$|شراء|سعر|اشتر/i)
    }
  })
})
