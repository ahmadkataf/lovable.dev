// "ليش فوكس بوينت؟" — six flat tiles with neutral icon squares.
import { Section, SectionHead, TileIcon } from '../site'
import type { SiteIconName } from '../SiteIcon'

// Accent colours are reserved for coding space types; the feature tiles stay neutral.
const FEATURES: { icon: SiteIconName; title: string; text: string }[] = [
  { icon: 'quiet', title: 'هدوء يساعدك تركّز', text: 'مكان معمول للتركيز، بعيد عن عجقة البيت والمقاهي، لتخلّص شغلك وإنت مرتاح.' },
  { icon: 'sun', title: 'ضوء طبيعي', text: 'شبابيك كبيرة بتدخّل الضوء الطبيعي طول النهار.' },
  { icon: 'wifi', title: 'إنترنت سريع', text: 'واي فاي سريع لاجتماعاتك أونلاين، رفع ملفاتك، ودراستك.' },
  { icon: 'ac', title: 'تكييف', text: 'تكييف بيخلّي الجو مريح، لتركّز بشغلك وبس.' },
  { icon: 'coffee', title: 'قهوة جنبك', text: 'فنجان قهوة قريب منك وقت ما بدك تاخد نفَس.' },
  { icon: 'screen', title: 'قاعة اجتماعات مجهّزة', text: 'شاشة وسبورة لـ10 أشخاص، للاجتماعات والعروض والدورات.' },
]

export function Features() {
  return (
    <Section id="why" labelledBy="fp-why-title">
      <SectionHead id="fp-why-title" kicker="ليش فوكس بوينت؟" title="كل شي بتحتاجه لتشتغل بتركيز" lead={<>جو <bdi dir="ltr" className="fp-nowrap">THINK OUTSIDE THE BOX</bdi>: مكان مرتب وهادئ، بيعطيك مساحة تفكّر وتبدع.</>} />
      <ul className="fp-grid fp-grid-3 fp-tiles">
        {FEATURES.map((f) => (
          <li key={f.title} className="fp-tile">
            <TileIcon name={f.icon} tone="neutral" />
            <h3 className="fp-h3">{f.title}</h3>
            <p>{f.text}</p>
          </li>
        ))}
      </ul>
    </Section>
  )
}
