import { useState } from 'react'
import { Check, DollarSign } from 'lucide-react'
import { saveSettings, useSettings } from '../db/store'
import type { CurrencyDisplay } from '../db/types'
import { CURRENCY_SYMBOL, fmtDateTime, otherCurrency } from '../lib/format'
import { Field, NumberInput } from './components'
import { Modal } from './modal'
import { useToast } from './toast'

/** The dollar rate and how prices are shown: reachable from the top bar on every screen, because the
 *  pound moves and the shop changes the rate several times a week. The rate is shared with all devices. */
export function RateModal({ onClose }: { onClose: () => void }) {
  const s = useSettings()
  const [rate, setRate] = useState(s.rate)
  const [display, setDisplay] = useState<CurrencyDisplay>(s.display)
  const toast = useToast()
  const base = s.baseCurrency
  const other = otherCurrency(base)
  const save = async () => {
    if (display !== 'base' && rate <= 0) { toast.error('أدخل سعر الدولار أولاً'); return }
    await saveSettings({ rate, display })
    toast.success(rate ? `تم الحفظ: 1 $ = ${rate.toLocaleString('en-US')} ل.س` : 'تم الحفظ')
    onClose()
  }
  return (
    <Modal title="سعر الدولار وعرض الأسعار" onClose={onClose} size="narrow" icon={<DollarSign />} footer={<><button className="btn primary" onClick={save}><Check /> حفظ</button><button className="btn" onClick={onClose}>إلغاء</button></>}>
      <div className="stack">
        <Field label="سعر صرف الدولار الواحد بالليرة السورية" help={s.updatedAt ? `آخر تعديل: ${fmtDateTime(s.updatedAt)}` : undefined}>
          <NumberInput value={rate} onChange={setRate} lg autoFocus suffix="ل.س لكل 1 $" onEnter={save} />
        </Field>
        <Field label="عرض الأسعار في البرنامج والفواتير">
          <div className="tabs wrap">
            <button className={display === 'base' ? 'active' : ''} onClick={() => setDisplay('base')}>{CURRENCY_SYMBOL[base]} فقط</button>
            <button className={display === 'other' ? 'active' : ''} onClick={() => setDisplay('other')}>{CURRENCY_SYMBOL[other]} فقط</button>
            <button className={display === 'both' ? 'active' : ''} onClick={() => setDisplay('both')}>كلاهما</button>
          </div>
        </Field>
        <p className="help">الأسعار محفوظة بـ{base === 'SYP' ? 'الليرة السورية' : 'الدولار'} (العملة الأساسية، تُغيَّر من الإعدادات → المحل). تغيير سعر الصرف يغيّر فقط ما يُعرض بالعملة الأخرى، ولا يمس الأرقام المحفوظة.</p>
      </div>
    </Modal>
  )
}
