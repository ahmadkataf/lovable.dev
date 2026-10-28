import { useRef, useState } from 'react'
import { ImagePlus, Store, Trash2 } from 'lucide-react'
import { useStore, toast } from '../../../state/store'
import { useT } from '../../../i18n'
import { Button, Field, Input, Textarea } from '../../../components/ui'
import type { Settings } from '../../../db/types'
import { useDraft, SaveBar, SectionCard, Note } from '../shared'
import { resizeImageFile } from '../logo'

type StoreInfo = Settings['store']

export default function StoreSection() {
  const t = useT()
  const store = useStore(s => s.settings.store)
  const updateSettings = useStore(s => s.updateSettings)
  const d = useDraft<StoreInfo>(
    store,
    async draft => updateSettings({ store: { name: draft.name.trim(), phone: draft.phone.trim(), address: draft.address.trim(), taxNumber: (draft.taxNumber ?? '').trim(), logo: draft.logo ?? '' } }),
    draft => (draft.name.trim() ? null : t('settings.store.nameRequired')),
  )
  const fileRef = useRef<HTMLInputElement>(null)
  const [reading, setReading] = useState(false)

  const pickLogo = async (f: File | null | undefined) => {
    if (!f) return
    setReading(true)
    try { d.patch({ logo: await resizeImageFile(f, 256) }) }
    catch { toast(t('settings.store.logoError'), 'error') }
    finally { setReading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  return (
    <>
      <SectionCard title={t('settings.sec.store')} icon={<Store size={16} />}>
        <div className="form-grid">
          <Field label={t('settings.store.name')} error={d.error ?? undefined} span2>
            <Input value={d.draft.name} onChange={e => d.patch({ name: e.target.value })} placeholder={t('settings.store.namePh')} invalid={!!d.error} maxLength={60} autoFocus />
          </Field>
          <Field label={t('settings.store.phone')}>
            <Input ltr inputMode="tel" value={d.draft.phone} onChange={e => d.patch({ phone: e.target.value })} maxLength={30} />
          </Field>
          <Field label={t('settings.store.taxNumber')} hint={t('settings.store.taxNumberHint')}>
            <Input ltr value={d.draft.taxNumber ?? ''} onChange={e => d.patch({ taxNumber: e.target.value })} maxLength={30} />
          </Field>
          <Field label={t('settings.store.address')} span2>
            <Textarea value={d.draft.address} onChange={e => d.patch({ address: e.target.value })} rows={2} maxLength={160} style={{ minHeight: 64 }} />
          </Field>
        </div>
        <Note>{t('settings.store.onReceipt')}</Note>
      </SectionCard>

      <SectionCard title={t('settings.store.logo')} icon={<ImagePlus size={16} />}>
        <div className="logo-row">
          <div className="logo-box">{d.draft.logo ? <img src={d.draft.logo} alt="" /> : <ImagePlus size={28} />}</div>
          <div className="col" style={{ gap: 8 }}>
            <div className="row wrap">
              <Button icon={<ImagePlus size={16} />} loading={reading} onClick={() => fileRef.current?.click()}>{d.draft.logo ? t('settings.store.logoChange') : t('settings.store.logoPick')}</Button>
              {d.draft.logo && <Button variant="soft-danger" icon={<Trash2 size={16} />} onClick={() => d.patch({ logo: '' })}>{t('settings.store.logoRemove')}</Button>}
            </div>
            <span className="xs faint">{t('settings.store.logoHint')}</span>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => void pickLogo(e.target.files?.[0])} />
      </SectionCard>

      <SaveBar dirty={d.dirty} saving={d.saving} onSave={() => void d.save()} onReset={d.reset} />
    </>
  )
}
