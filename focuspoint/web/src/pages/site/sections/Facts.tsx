// Flat facts strip: only real facts (counts and hours come from the live API when available).
import { hoursLabel, type SiteData } from '../site'
import { SiteIcon, type SiteIconName } from '../SiteIcon'

export function Facts({ data }: { data: SiteData }) {
  const privateCount = data.rooms.filter((r) => r.type === 'private').length || 4
  const items: { icon: SiteIconName; value: string; label: string }[] = [
    { icon: 'grid', value: `${privateCount} غرف خاصة`, label: 'وقاعة اجتماعات ومساحة مفتوحة' },
    { icon: 'pin', value: 'شارع المجمع الحكومي', label: 'بدرعا، بناء العايش' },
    { icon: 'clock', value: `${data.hoursPerDay} ساعة يومياً`, label: `كل يوم، ${hoursLabel(data)}` },
    { icon: 'user', value: 'حجز بدون حساب', label: 'اسمك ورقم موبايلك وبس' },
  ]
  return (
    <section className="fp-facts-wrap" aria-label="فوكس بوينت بالأرقام">
      <div className="fp-container">
        <ul className="fp-facts">
          {items.map((it) => (
            <li key={it.value}>
              <SiteIcon name={it.icon} size={22} className="fp-facts-ico" />
              <b>{it.value}</b>
              <span>{it.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
