// How booking works: three numbered flat steps.
import { Link } from 'react-router-dom'
import { Section, SectionHead, type SiteData } from '../site'
import { SiteIcon, type SiteIconName } from '../SiteIcon'

export function HowItWorks({ data }: { data: SiteData }) {
  const steps: { icon: SiteIconName; title: string; text: string }[] = [
    { icon: 'calendar', title: 'اختار المساحة والوقت', text: 'شوف المخطط والغرف الفاضية، واختار اليوم والساعة والمدة اللي بدك ياها.' },
    { icon: 'user', title: 'اكتب اسمك ورقمك', text: 'بدون حساب وبدون كلمة سر. اسمك ورقم موبايلك بيكفّوا.' },
    {
      icon: 'check',
      title: data.payOnArrival ? 'ادفع بشام كاش أو عند الوصول' : 'ادفع بشام كاش',
      text: data.payOnArrival
        ? 'حوّل بشام كاش واكتب رقم العملية، أو اختار الدفع عند الوصول. ويوصلك التأكيد بإشعار.'
        : 'حوّل بشام كاش (رمز QR أو الرقم) واكتب رقم العملية، ويوصلك التأكيد بإشعار.',
    },
  ]
  return (
    <Section id="how" labelledBy="fp-how-title">
      <SectionHead id="fp-how-title" kicker="كيف بتحجز؟" title="3 خطوات وحجزك جاهز" center />
      <ol className="fp-steps">
        {steps.map((s, i) => (
          <li key={s.title} className="fp-step">
            <span className="fp-step-num num" aria-hidden="true">{i + 1}</span>
            <span className="fp-step-ico"><SiteIcon name={s.icon} size={22} /></span>
            <h3 className="fp-h3">{s.title}</h3>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>
      <div className="fp-center-row">
        <Link to="/book" className="btn btn-primary btn-lg fp-btn">ابدأ الحجز <SiteIcon name="arrow" size={20} /></Link>
      </div>
    </Section>
  )
}
