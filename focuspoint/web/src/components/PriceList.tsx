// The centre's price list, from the live settings and rooms (the same numbers the booking uses, shared/pricing.ts).
// Shown on /book (below the rooms, so the picker stays above the fold) and on /spaces. PriceSteps is the
// «1-2-3» strip that /book shows at the top of its picker.
import type { PublicSettings, Room } from '@shared/types'
import { fmtMoney } from '@shared/pricing'
import { intlPhone, whatsappLink } from '@shared/content'
import { Icon } from '../ui'
import { pricing } from '../lib/booking'

export function PriceList({ settings, rooms, whatsapp, onSubscribe, steps = false }: {
  settings: PublicSettings | undefined; rooms: Room[]; whatsapp?: string
  /** Shows «اشترك» buttons that switch the booking page to subscriptions. */
  onSubscribe?: (kind: 'week' | 'month') => void
  steps?: boolean
}) {
  const p = pricing(settings)
  const active = rooms.filter((r) => r.active)
  const desks = active.filter((r) => r.type === 'desk')
  const desk = desks[0]
  const privates = active.filter((r) => r.type === 'private' && r.price_hour > 0).map((r) => r.price_hour)
  const hourly = desk?.price_hour ?? (privates.length ? Math.min(...privates) : 100)
  const hallRoom = active.find((r) => r.type === 'meeting' || r.type === 'hall')
  const hall = !!hallRoom
  const wa = whatsapp && intlPhone(whatsapp) ? `${whatsappLink(whatsapp)}?text=${encodeURIComponent('مرحبا، بدي استفسر عن حجز القاعة التدريبية لكورس شخصي')}` : ''
  return (
    <div className="price-list">
      {steps && <PriceSteps />}
      <h2 className="h3 price-list-title"><Icon name="cash" size={18} /> الأسعار <span className="muted tiny">بالليرة السورية الجديدة</span></h2>
      <ul className="price-rows">
        {(desk || privates.length > 0) && (
          <li>
            <span><b>الساعة</b><small>{[...desks.map((d) => d.name), ...(privates.length ? ['غرفة خاصة'] : [])].join(' أو ')} · لكل شخص كرسي</small></span>
            <span className="money">{fmtMoney(hourly)} <small>للشخص</small></span>
          </li>
        )}
        {desk && p.subscriptions_enabled && (
          <li>
            <span><b>اشتراك أسبوعي</b><small>مقعدك بالمساحة المفتوحة كل يوم طول الدوام · 7 أيام</small></span>
            <span className="money">{fmtMoney(p.sub_week_price)}{onSubscribe && <button type="button" className="btn btn-soft btn-sm" onClick={() => onSubscribe('week')}>اشترك</button>}</span>
          </li>
        )}
        {desk && p.subscriptions_enabled && (
          <li>
            <span><b>اشتراك شهري</b><small>مقعدك بالمساحة المفتوحة كل يوم طول الدوام · 30 يوم</small></span>
            <span className="money">{fmtMoney(p.sub_month_price)}{onSubscribe && <button type="button" className="btn btn-soft btn-sm" onClick={() => onSubscribe('month')}>اشترك</button>}</span>
          </li>
        )}
        {hall && (
          <li className="price-hall">
            <span><b>القاعة التدريبية</b><small>بتنحجز كاملة{hallRoom ? ` (${hallRoom.capacity} كرسي)` : ''} · نفس السعر لأي عدد · بالساعة حسب الجهة</small></span>
            <span className="price-tiers">
              <span>الجهات الخاصة والمنظمات: <b className="money">{fmtMoney(p.hall_org_usd_hour, 'USD')}</b></span>
              <span>الجهات الحكومية: <b className="money">{fmtMoney(p.hall_gov_hour)}</b></span>
              <span>الكورسات الشخصية: <b>{p.course_share_percent}% من قيمة الكورس</b> بالاتفاق
                {wa && <a className="link" href={wa} target="_blank" rel="noopener noreferrer"> · راسلنا</a>}</span>
            </span>
          </li>
        )}
      </ul>
    </div>
  )
}

export function PriceSteps() {
  return (
    <ol className="pl-steps">
      <li><b>1</b><span>اختر اليوم والوقت</span></li>
      <li><b>2</b><span>اضغط على المكان</span></li>
      <li><b>3</b><span>اكتب اسمك وادفع</span></li>
    </ol>
  )
}
