import { Languages, Monitor, Moon, Palette, Sun } from 'lucide-react'
import { useStore, toast } from '../../../state/store'
import { useT } from '../../../i18n'
import { Field, Seg } from '../../../components/ui'
import type { Settings } from '../../../db/types'
import { AutosaveHint, SectionCard, Note } from '../shared'

export default function AppearanceSection() {
  const t = useT()
  const lang = useStore(s => s.settings.lang)
  const theme = useStore(s => s.settings.theme)
  const updateSettings = useStore(s => s.updateSettings)
  const set = (p: Partial<Pick<Settings, 'lang' | 'theme'>>) => void updateSettings(p).catch(() => toast(t('settings.saveFailed'), 'error'))
  const themes: { value: Settings['theme']; label: string; icon: JSX.Element }[] = [
    { value: 'light', label: t('settings.appearance.light'), icon: <Sun size={18} /> },
    { value: 'dark', label: t('settings.appearance.dark'), icon: <Moon size={18} /> },
    { value: 'system', label: t('settings.appearance.system'), icon: <Monitor size={18} /> },
  ]
  return (
    <>
      <AutosaveHint />
      <SectionCard title={t('settings.appearance.lang')} icon={<Languages size={16} />}>
        <Field>
          <Seg<Settings['lang']> block value={lang} onChange={v => set({ lang: v })} options={[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]} />
        </Field>
      </SectionCard>
      <SectionCard title={t('settings.appearance.theme')} icon={<Palette size={16} />}>
        <div className="theme-grid" role="radiogroup">
          {themes.map(o => (
            <button key={o.value} type="button" role="radio" aria-checked={theme === o.value} className={`theme-opt ${theme === o.value ? 'on' : ''}`} onClick={() => set({ theme: o.value })}>
              <span className={`swatch ${o.value}`}>{o.icon}</span>
              {o.label}
            </button>
          ))}
        </div>
        <Note>{t('settings.appearance.systemDesc')} {t('settings.appearance.instant')}</Note>
      </SectionCard>
    </>
  )
}
