// The centre's price list, from the live settings and rooms (the same numbers the booking uses, shared/pricing.ts).
// Shown on /book (above the picker, with the three steps) and on /spaces.
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
  const desk = active.find((r) => r.type === 'desk')
  const privates = active.filter((r) => r.type === 'private' && r.price_hour > 0).map((r) => r.price_hour)
  const hall = active.some((r) => r.type === 'meeting' || r.type === 'hall')
  const wa = whatsapp && intlPhone(whatsapp) ? `${whatsappLink(whatsapp)}?text=${encodeURIComponent('مرحبا، بدي استفسر عن حجز القاعة التدريبية لكورس شخصي')}` : ''
  return (
    <div className="price-list">
      {steps && (
        <ol className="pl-steps">
          <li><b>1</b><span>اختر اليوم والوقت</span></li>
          <li><b>2</b><span>اضغط على المكان</span></li>
          <li><b>3</b><span>اكتب اسمك وادفع</span></li>
        </ol>
      )}
      <h2 className="h3 price-list-title"><Icon name="cash" size={18} /> الأسعار <span className="muted tiny">بالليرة السورية الجديدة</span></h2>
      <ul className="price-rows">
        {desk && (
          <li>
            <span><b>{desk.name}</b><small>طاولة لشخص واحد · بتحجز مقعد أو أكتر</small></span>
            <span className="money">{fmtMoney(desk.price_hour)} <small>للشخص بالساعة</small></span>
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
        {privates.length > 0 && (
          <li>
            <span><b>الغرف الخاصة</b><small>الغرفة كاملة إلك أو لفريقك</small></span>
            <span className="money">{Math.min(...privates) === Math.max(...privates) ? '' : 'من '}{fmtMoney(Math.min(...privates))} <small>للغرفة بالساعة</small></span>
          </li>
        )}
        {hall && (
          <li className="price-hall">
            <span><b>القاعة التدريبية</b><small>بالساعة، حسب الجهة</small></span>
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
