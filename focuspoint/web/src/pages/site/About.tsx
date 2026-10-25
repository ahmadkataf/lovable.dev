// "/about" — من نحن: the story, who it is for, values, gallery, CTA.
import { CENTRE, CtaBand, IMG, PageHeader, Section, SectionHead, TileIcon, hoursLabel, useSiteData, useTitle } from './site'
import { Gallery } from './sections/Gallery'
import type { SiteIconName } from './SiteIcon'

// Neutral icon tiles: the accent colours are reserved for coding space types.
const AUDIENCE: { icon: SiteIconName; title: string; text: string }[] = [
  { icon: 'book', title: 'طلاب', text: 'لدراسة الامتحانات، المشاريع، وحلقات الدراسة الجماعية بمكان هادئ.' },
  { icon: 'laptop', title: 'مستقلّين وعن بُعد', text: 'مكتب مرتب وإنترنت سريع، بعيد عن ضجة البيت والمقاهي.' },
  { icon: 'people', title: 'فرق صغيرة', text: 'غرف خاصة من 2 لـ4 أشخاص، وقاعة اجتماعات لعشرة لما يكبر الاجتماع.' },
  { icon: 'present', title: 'مدرّبين ودورات', text: 'قاعة فيها شاشة وسبورة، جاهزة للورشات والعروض والدورات.' },
]
const VALUES: { icon: SiteIconName; title: string; text: string }[] = [
  { icon: 'quiet', title: 'هدوء', text: 'المكان معمول للتركيز. كل تفصيل فيه هدفه يخليك تشتغل براحة.' },
  { icon: 'check', title: 'احترافية', text: 'حجز واضح، أسعار معلنة، وتأكيد بيوصلك بإشعار. بتعرف شو إلك قبل ما توصل.' },
  { icon: 'heart', title: 'ضيافة حورانية', text: 'أهلاً وسهلاً فيك دايماً، والقهوة موجودة وقت ما بدك.' },
]

export function About() {
  useTitle('من نحن | فوكس بوينت — المشروع الأول من نوعه بدرعا')
  const data = useSiteData()
  return (
    <div className="site">
      <PageHeader kicker="من نحن" title={<>فوكس بوينت: <span className="fp-brand-text">{CENTRE.slogan}</span></>} lead={`${CENTRE.firstOfItsKind}. مساحة عمل مشتركة بدرعا، معمولة للي بدو يركّز ويبدع.`} />

      <Section labelledBy="fp-story-title">
        <div className="fp-story">
          <div className="fp-story-text">
            <SectionHead id="fp-story-title" kicker="حكايتنا" title="مكان هادئ، قريب منك" />
            <p>
              فوكس بوينت هو المشروع الأول من نوعه بدرعا: مساحة عمل مشتركة فيها غرف خاصة، وقاعة اجتماعات، ومساحة مفتوحة،
              بتنحجز بالساعة. عملناها لأن الشغل والدراسة بدهم مكان هادئ ومرتب، مو طاولة بمقهى عجقة ولا زاوية بالبيت.
            </p>
            <p>
              عنا ضوء طبيعي من شبابيك كبيرة، تكييف، إنترنت سريع، وقهوة جنبك. مفتوحين كل يوم {hoursLabel(data)}،
              وبتحجز مكانك من موبايلك بخطوات بسيطة بدون ما تعمل حساب. وعلى الحيط عنا جملة بتلخّص كل شي: <bdi dir="ltr" className="fp-nowrap">THINK OUTSIDE THE BOX</bdi>.
            </p>
          </div>
          <figure className="fp-story-media">
            <span className="fp-story-block" aria-hidden="true" />
            <img src={IMG.big.small} width={IMG.big.w} height={IMG.big.h} alt={IMG.big.alt} loading="lazy" decoding="async" />
          </figure>
        </div>
      </Section>

      <Section tint labelledBy="fp-who-title">
        <SectionHead id="fp-who-title" kicker="لمين فوكس بوينت؟" title="لكل حدا بدو مكان يركّز فيه" />
        <ul className="fp-grid fp-grid-4 fp-tiles">
          {AUDIENCE.map((a) => (
            <li key={a.title} className="fp-tile">
              <TileIcon name={a.icon} tone="neutral" />
              <h3 className="fp-h3">{a.title}</h3>
              <p>{a.text}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section labelledBy="fp-values-title">
        <SectionHead id="fp-values-title" kicker="قيمنا" title="شو اللي بيميّزنا" center />
        <ul className="fp-grid fp-grid-3 fp-values fp-tiles">
          {VALUES.map((v) => (
            <li key={v.title} className="fp-value">
              <TileIcon name={v.icon} tone="neutral" />
              <h3 className="fp-h3">{v.title}</h3>
              <p>{v.text}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Gallery tint kicker="المكان" title="جولة سريعة بفوكس بوينت" />
      <CtaBand />
    </div>
  )
}

export default About
